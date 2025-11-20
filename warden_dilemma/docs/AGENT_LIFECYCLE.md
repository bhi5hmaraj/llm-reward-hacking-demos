# Continuous Agent Lifecycle — Design

Goal: enable AI players to run continuously across a round: at round start they receive fresh state, reason using tools and history, interact (DMs/tools) within budgets, and at the end of the window they submit a final action. Works for embedded agents (inside server) and external agents (via MCP) with the same kernelside abstractions.

## 1) Lifecycle (per round)
States: `Idle → Deliberating → Finalizing → Waiting`.

Events the kernel emits per seat:
- `phase:start` (with `phase`, `round`, `msRemaining`)
- `phase:tock` (heartbeat every X ms with `msRemaining`)
- `dm:received` (from→to, text)
- `state:changed` (diff hash for cheap triggers)
- `phase:ending_soon` (T − graceMs)
- `phase:end`

Policy (per seat or room):
- `allowedPhasesForDM = ['communication']`
- `maxToolCallsPerPhase` (default 10)
- `minToolIntervalMs` (default 1500)
- `maxInitiatedDMsPerPhase`, `perTargetCooldownMs`
- `finalizeGraceMs` (default 2500)
- `actionOnce = true` (first valid submission is final)

## 2) Kernel responsibilities
- Scheduler: `after(ms)`, `every(ms)`, `at(ts)`, `cancelAll()` scoped to seat+phase; auto‑cancels on phase change.
- Observables: `observe(selector, cb)` with structural diffing to avoid polling entire snapshots.
- Intent Gate: wraps `GameActionsPort` to enforce phase allowlist, quotas, cooldowns, and budgets.
- Budget Manager: per phase counters (tool calls, tokens if applicable).
- Abort/Deadline: `AbortSignal` passed to strategies; canceled at `ending_soon` or `end`.
- Idempotency: `submitAction` is one‑shot; late or duplicate calls are no‑ops.

## 3) Strategy contract (unchanged; powered by context)
```ts
export interface PlayerContext {
  roomId: string; seat: number; logger: any;
  actions: GameActionsPort; state: ReadOnlyStatePort;
  schedule: { after(ms:number, fn:Fn): Cancel; every(ms:number, fn:Fn): Cancel; at(ts:number, fn:Fn): Cancel; cancelAll(): void; };
  observe: <T>(sel:(s:any)=>T, cb:(curr:T, prev?:T)=>void) => Cancel;
  policy: ProactivePolicy; deadline?: number; signal?: AbortSignal;
  memory: AgentMemory; // summary + scratchpad + round history (seat-local)
}

export interface Strategy {
  onPhase(s: any, ctx: PlayerContext): Promise<void>;
  onDM(dm: { from:number; to:number; text:string; at:number }, ctx: PlayerContext): Promise<void>;
}
```

`AgentMemory` (seat‑local, persisted between rounds minimally):
- `threads`: DM thread summaries per target
- `rounds`: compact per‑round outcomes
- `scratch`: ephemeral working notes for the current round

## 4) Deliberation session (kernel harness)
The kernel creates a `DeliberationSession` on `phase:start` for seats that are AI‑driven. It:
- Starts a heartbeat (`tock`) every 2s (configurable) and an `ending_soon` timer.
- Exposes schedule/observe to the strategy.
- Enforces intent gate around `actions`.
- Ensures a single in‑flight “think/act” at a time; cancels on `ending_soon`.
- Calls `finalize()` which prompts the strategy (or its tool chain) to pick and submit the final action once.

## 5) Embedded agents (Agents SDK) — skeleton
```ts
// server/src/agents/loops/continuous.ts
import { run, Runner } from '@openai/agents';
import type { Strategy, PlayerContext } from '../../players/types';

export async function startContinuous(strategy: Strategy, ctx: PlayerContext) {
  // Observe new targets and greet once per phase
  ctx.observe(
    (s:any) => ({ targets: s.dmTargets, t:s.msRemaining }),
    async (curr, prev) => {
      if (!prev) return;
      const newTargets = curr.targets.filter((id:number) => !(prev.targets||[]).includes(id));
      for (const to of newTargets) await safeDM(`Hi there!`, to, ctx);
    }
  );

  // Periodic think/act loop with budgets
  ctx.schedule.every(2000, async () => {
    if (ctx.signal?.aborted) return;
    const snap = await ctx.state.getSnapshot(ctx.roomId, ctx.seat);
    await strategy.onPhase(snap, ctx); // strategy can call actions via gate
  });

  // Finalization before deadline
  const grace = Math.max(1000, (ctx.policy.finalizeGraceMs ?? 2500));
  if (ctx.deadline) {
    ctx.schedule.at(ctx.deadline - grace, async () => {
      await finalizeOnce(ctx);
    });
  }
}

async function safeDM(text:string, to:number, ctx:PlayerContext) {
  // gate enforces phase + cooldowns + quotas
  await ctx.actions.sendDM(ctx.roomId, ctx.seat, to, text);
}

let finalized = false;
async function finalizeOnce(ctx: PlayerContext) {
  if (finalized) return; finalized = true;
  const snap:any = await ctx.state.getSnapshot(ctx.roomId, ctx.seat);
  const choice = decideFinalChoice(snap, ctx.memory); // cheap heuristic or cached LLM result
  await ctx.actions.submitAction(ctx.roomId, ctx.seat, choice);
}
```

Strategy example (LLM-powered) would compute a plan on first tick, then reuse it with small updates; a rule‑based strategy can do the same deterministically.

## 6) External agents via MCP — skeleton
Kernel runs an MCP server exposing tools/resources and streams events via SSE. An external agent connects and runs the same loop on its side.

Agent loop pseudocode:
```ts
// external-agent/index.ts
import { MCPClient } from '@modelcontextprotocol/sdk/client';

const mcp = await MCPClient.connectStreamableHttp(process.env.MCP_URL!, { headers:{ Authorization:`Bearer ${TOKEN}` } });

// Subscribe to events for this room/seat
await mcp.callTool('events.watch', { roomId, seat, kinds:['phase:start','tock','dm:received','ending_soon'] });

mcp.on('event', async (evt) => {
  switch (evt.kind) {
    case 'phase:start':
      scheduleEvery(2000, thinkAct);
      scheduleAt(evt.deadline - 2500, finalize);
      break;
    case 'dm:received':
      // optional reactive behavior
      break;
    case 'ending_soon':
      await finalize();
      break;
  }
});

async function thinkAct(){
  const snap = await mcp.callTool('state.snapshot', { roomId, seat });
  const intent = decideNext(snap);
  if (intent?.dm) await mcp.callTool('dm.send', { roomId, fromSeat: seat, toSeat:intent.dm.to, text:intent.dm.text });
}

async function finalize(){
  const snap = await mcp.callTool('state.snapshot', { roomId, seat });
  const choice = decideFinalChoice(snap);
  await mcp.callTool('action.submit', { roomId, seat, type:'choose', payload:{ choice } });
}
```

## 7) Budgets and safety
- One in‑flight LLM run at a time per seat; cancel on `ending_soon`.
- Debounce plan recomputation (e.g., ≥ 5s between LLM “plan” runs) to control cost.
- Gate every `sendDM`/`submitAction` call; enforce per‑target cooldowns and per‑phase quotas.
- Log all tool calls and decisions with timestamps for audit/replay.

## 8) Recovery and replay
- Persist minimal `AgentMemory` and last chosen plan to Redis each tick (every ~5–10s) and at `finalizeOnce`.
- On server restart mid‑phase, restore `AgentMemory`, recompute timers from deadline, and resume the loop.

## 9) Tests (deterministic)
- Fake timers + rule‑based strategy: ensure at least one proactive DM is sent under policy; ensure a single final submission happens before deadline.
- Policy edge cases: quota reached → DMs suppressed; cooldown respected; late submissions dropped.
- Restart test: simulate crash/restart; agent resumes and still submits action.

## 10) Defaults (sane for MVP)
- Heartbeat `tock` every 2s; grace 2.5s; min interval between tool calls 1.5s; max 8 tool calls per phase; max 3 initiated DMs per phase; per‑target cooldown 6s.

---

This design makes agents continuously active through declarative scheduling and event observation, with explicit finalization before deadlines. It works identically for embedded Agents SDK or external MCP clients, keeping the kernel’s responsibilities clear and testable.

