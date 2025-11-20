# AI Agents Integration Plan — Warden's Dilemma

Last updated: 2025-11-20

This document proposes how to integrate OpenAI’s Agents SDK into our Colyseus‑based Warden’s Dilemma stack to support AI players (bots), an experimenter assistant, and chat moderation. It covers SDK capabilities, how they map to our architecture, server interfaces (tools), UI hooks, security, and a phased rollout with tests.

## 1) Goals

- AI players that can participate in all phases (communicate via DM, pick actions, explain choices).
- Experimenter assistant to summarize lobbies, suggest configurations, and generate reports.
- Optional chat moderation and experiment integrity guardrails.
- Keep server‑authority: agents act only via server tools; no privileged client paths.
- Tracing, observability, and rate limiting from day one.

## 2) What the Agents SDK gives us (quick tour)

- Agents are LLMs configured with instructions, a model, and tools, plus optional dynamic instructions and lifecycle hooks.
- Tools let agents take actions. We can expose our server functions as function tools; the SDK also supports hosted tools and MCP servers.
- Runs are executed with a `Runner` or the `run()` helper, supporting multi‑turn loops, tool calls, and handoffs between agents.
- Handoffs allow delegating the conversation to another agent (e.g., triage → specialist).
- Guardrails validate input/output to enforce policies before or after an agent responds.
- Streaming provides incremental output for responsive UIs; we can stream assistant “thinking” into an experimenter console.
- Tracing captures LLM generations, tool calls, handoffs, and guardrails for debugging and monitoring.
- Context: pass server dependencies/state to tools via `RunContext`, separate from model‑visible context.

## 3) How this fits our stack

Our stack: Node/TS server (Colyseus), Upstash Redis (experiments + cache), React client.

- Server‑side Agents Service: A module that owns agent creation, tools, and runs. Agents never talk directly to Colyseus sockets; they invoke server tools which in turn interact with rooms.
- Colyseus bridge: Tools call strongly‑typed helpers that enqueue room actions (DM send, action submit) and read state snapshots. This preserves server authority and reuse of validations.
- Redis: Store agent session metadata, transcripts, and run traces IDs; keep per‑game/round artifacts for export.
- Feature flag: `AGENTS_ENABLED=true` gates the integration; human-only behavior remains default.

## 4) Agent roles we support

- Player Bot Agent (per bot slot): Receives room/phase snapshots; can DM, select an action, and explain reasoning.
- Experimenter Assistant: Observes the lobby/game and suggests settings, summarizes chats, and produces reports.
- Moderator Agent (optional): Enforces chat policy and rate limits via guardrails/tools.

## 5) Tools: mapping game actions to SDK tools

We expose a minimal, safe tool surface. Each tool validates input (Zod), checks phase/slot permissions, and logs usage.

- `get_room_state(roomId, viewerSlot?) → JSON` — Read‑only snapshot shaped for LLMs (sanitized). Provides phase, your slot, DM targets, history window, payoff parameters, and legal actions.
- `list_targets(roomId, slot) → { targets: string[] }` — DM recipients available during communication.
- `send_dm(roomId, fromSlot, toSlot, message) → ack` — Emits a DM via existing server pipeline.
- `submit_action(roomId, slot, choice) → ack` — Submits player action during the action phase; server enforces idempotency and timing.
- `get_recommendations(roomId, slot) → JSON` — Returns server‑computed heuristics (e.g., tit‑for‑tat baseline, payoffs preview) to reduce prompting cost.
- Experimenter‑scoped tools: `set_phase_durations`, `start_game`, `freeze_bots`, `resume_bots`, `export_report` (guarded; not visible to player bots).

SDK notes: implement as function tools; consider “agents as tools” if we create specialist sub‑agents (e.g., Summarizer). citeturn0search3turn2search4

## 6) Prompts and context

- Static instructions per role (Player/Experimenter/Moderator) define objectives and constraints.
- Dynamic instructions function composes game constants (k bins, labels, phase timers), your slot, teammate history, and experiment rules at run‑time. citeturn0search0
- Local `RunContext` carries logger, Redis clients, and room access helpers; not visible to the LLM. citeturn2search0

## 7) Lifecycle: when we run agents

Lobby
- If a configured player is of type `agent`, spawn a Player Bot Agent when the lobby assigns the slot.

Game
- On `phase:communication` start, the runner streams DM suggestions; tool calls send messages.
- On `phase:action` start, the agent calls `submit_action` once; server enforces single submission and cutoff.
- On `phase:revelation`, the agent may generate a short rationale; we store it with the round snapshot.

Handoffs
- A Player Bot can hand off to sub‑agents (e.g., “Payoff Analyst”) behind a manager; or the Experimenter Assistant can hand off to “Summarizer”. citeturn1search0

Streaming & Tracing
- Stream text into an “Agent Console” on the experimenter UI; trace IDs stored per run for later inspection. citeturn2search1turn0search1

## 8) Security, safety, and cost

- Server‑only tools: No client‑exposed agent endpoints that bypass token/phase checks.
- Rate limits: per‑agent token budgets and call frequency caps; backoff on tool errors.
- Guardrails: input guardrails for DM toxicity/policy; output guardrails for action/rationale sanity. citeturn1search1
- Token auth: Agents use internal join tokens bound to their slot; they cannot impersonate experimenter.
- Privacy: disable tracing with `OPENAI_AGENTS_DISABLE_TRACING=1` if required by policy. citeturn0search1

## 9) UI/UX: configuring and observing agents

Create Experiment (new “AI Agents” section)
- Per slot: Type `{ human | agent }`, Persona `{ Random | Tit‑for‑Tat | LLM Rational | Custom }`, model, temperature, action timeout, DM style.
- Global: Guardrails toggles, budget cap, enable transcripts, streaming on/off.

Lobby
- Show bot badges and readiness; experimenter can pause/resume bots.

Game
- Left: DM target list (existing). Right: thread. Bot messages marked “AI”.
- “Agent Console” panel (experimenter‑only): live stream, tool calls log, token usage, and rate‑limit status.

Reports
- Post‑game export includes per‑round bot rationales, DM summaries, payoffs, and configuration.

## 10) Implementation outline (server)

Packages
- Add `@openai/agents` and `zod`. Configure `OPENAI_API_KEY`.

Modules (server/src/agents/)
- `runtime.ts` — Create a shared `Runner`, attach tracing options.
- `tools/game-tools.ts` — All function tools with Zod validation and phase/slot authorization.
- `players/player-agent.ts` — Player Bot Agent factory (instructions, tools).
- `experimenter/assistant-agent.ts` — Experimenter assistant (read‑only tools plus `start_game`, etc.).
- `moderation/moderator-agent.ts` — Guardrail helpers and moderation agent (optional).
- `index.ts` — Facade: spawn/stop agents for a room, route state updates.

Room integration
- LobbyRoom: when assigning a slot with type `agent`, spawn a Player Bot Agent bound to that slot.
- GameRoom: emit compact JSON snapshots on phase changes; tools call existing server methods (DM send, action submit).

## 11) Implementation outline (client)

- Create‑Experiment page: new “AI Agents” config fields; include quick presets.
- Game page: add “Agent Console” (experimenter only), display streaming text and tool call breadcrumbs.
- DM UI: already DM‑style; ensure AI badges and rationale toggle.

## 12) Rollout & tests

Phase 0 (behind flag)
- Random & tit‑for‑tat bots as local baselines; stub the Agents SDK behind the same interface.
- Unit tests: tool validation and phase checks; action submission idempotency.
- Integration: 1 human + 1 agent end‑to‑end (2/10/10/2 timers); verify action buttons and DM.

Phase 1
- Swap LLM‑backed Player Bot with streaming; add experimenter assistant; enable tracing.
- Tests for guardrails: reject toxic DM; enforce rate limits.

Phase 2
- Persistence & exports; richer personas; optional realtime voice agent for demos. citeturn2search6

## 13) Example skeletons

Install

```bash
pnpm -F warden-dilemma-server add @openai/agents zod
```

Runner/runtime

```ts
// server/src/agents/runtime.ts
import { Runner } from '@openai/agents';

export const runner = new Runner({
  workflowName: 'WardenDilemma Agents',
  // tracing: enabled by default; can disable via env if needed
});
```

Game tools (function tools)

```ts
// server/src/agents/tools/game-tools.ts
import { tool } from '@openai/agents';
import { z } from 'zod';

export const getRoomState = tool({
  name: 'get_room_state',
  description: 'Read-only snapshot of current game state for a given slot.',
  parameters: z.object({ roomId: z.string(), viewerSlot: z.number().nullable().optional() }),
  async execute({ roomId, viewerSlot }, ctx) {
    const state = await ctx?.context.rooms.getJsonSnapshot(roomId, viewerSlot ?? undefined);
    return JSON.stringify(state);
  },
});

export const submitAction = tool({
  name: 'submit_action',
  description: 'Submit an action for your slot during action phase.',
  parameters: z.object({ roomId: z.string(), slot: z.number(), choice: z.string() }),
  async execute({ roomId, slot, choice }, ctx) {
    return await ctx?.context.actions.submit(roomId, slot, choice);
  },
});
```

Player Bot Agent

```ts
// server/src/agents/players/player-agent.ts
import { Agent } from '@openai/agents';
import { getRoomState, submitAction } from '../tools/game-tools';

export function createPlayerAgent(persona: string) {
  return new Agent({
    name: `PlayerBot:${persona}`,
    instructions: (rc) => `You are a player in Warden's Dilemma. Obey phase rules; use tools. Persona: ${persona}.` ,
    tools: [getRoomState, submitAction],
    model: 'gpt-4.1-mini',
  });
}
```

Run a turn

```ts
// server/src/agents/index.ts
import { run } from '@openai/agents';
import { runner } from './runtime';

export async function act(roomId: string, slot: number, agent) {
  const input = `Plan your move; call submit_action when ready.`;
  return runner.run(agent, input, { context: { rooms, actions, logger } });
}
```

## 14) Environment and ops

- `OPENAI_API_KEY` must be present on the server.
- `OPENAI_AGENTS_DISABLE_TRACING=1` to disable tracing if required. citeturn0search1
- Budget caps and model selection per experiment.

## 15) Open questions

- Do we want per‑slot personas configured by the experimenter UI or predefined templates only?
- Should agent transcripts be visible to players after the experiment?
- One‑time or expiring join tokens for bots?

---

References
- Agents overview and features: https://openai.github.io/openai-agents-js/guides/agents/
- Tools (function, hosted, agents‑as‑tools, MCP): https://openai.github.io/openai-agents-js/guides/tools/
- Running agents, loops, and Runner config: https://openai.github.io/openai-agents-js/guides/running-agents/
- Handoffs: https://openai.github.io/openai-agents-js/guides/handoffs
- Guardrails: https://openai.github.io/openai-agents-js/guides/guardrails
- Streaming: https://openai.github.io/openai-agents-js/guides/streaming/
- Context and RunContext: https://openai.github.io/openai-agents-js/guides/context
- Tracing: https://openai.github.io/openai-agents-js/guides/tracing/
