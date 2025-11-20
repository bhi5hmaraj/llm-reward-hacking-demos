# Actors Framework — MVP Decisions

Goal: ship a minimal, opinionated kernel that lets developers build multiplayer experiences with humans + AI players + a game master quickly, while keeping seams to evolve. This locks down specific choices for v0 so we can iterate without bikeshedding.

## 1) Hard Choices (v0)
- Runtime: Node 20 LTS, TypeScript 5.x, ESM modules, pnpm workspaces.
- Transport: Colyseus v0.14.x (WebSocketTransport). One adapter only.
- Storage: Redis (Upstash) for ephemeral state and event log; in-memory fallback for local dev.
- Auth: server-minted join tokens bound to roomId + seatId + capabilities. HS256 with `ACTORS_SECRET`. 12h TTL.
- Concurrency model: server authority; single-threaded room loop; actions validated via Zod; sequential handling per room.
- Messaging: broadcast channel + DMs. Rate limit default: 10 messages / 10s / actor; 500 chars max.
- Phases: built-in timed loop: `setup → communication → action → revelation → ended` (rounds iterate until stop). Timers fixed per room at creation.
- Players: unified `PlayerDriver` contract. Two drivers provided:
  - `HumanDriver` (no automation; events come from clients).
  - `AIPlayerDriver` with a single strategy in v0: `RuleBasedStrategy` (deterministic baseline). LLM/Agents is opt-in (behind flag) and not required for MVP.
- Assistant: out-of-core example using CopilotKit. Not required to run MVP; ships as example/plugin.
- Observability: pino logs + basic event trace per room (kept in Redis list, capped to N=1,000 entries).
- Testing: vitest; headless simulator that plays a tiny sample game with two human stubs vs one rule-based AI.

Non-goals (v0): multiple transports, persistent SQL event store, voice, complex moderation/guardrails, migrations, deep UI components.

## 2) Domain Interfaces (frozen for v0)

Ports
```ts
export interface ReadOnlyStatePort {
  getSnapshot(roomId: string, forSeat?: number): Promise<unknown>;
}

export interface GameActionsPort {
  submitAction(roomId: string, seat: number, type: string, payload: unknown): Promise<void>;
  sendDM(roomId: string, fromSeat: number, toSeat: number, text: string): Promise<void>;
}

export interface ControlPort {
  setPhase(roomId: string, phase: string, durationMs?: number): Promise<void>;
}
```

Drivers & Strategies
```ts
export interface PlayerContext {
  roomId: string; seat: number; logger: any;
  actions: GameActionsPort; state: ReadOnlyStatePort;
  deadline?: number; signal?: AbortSignal;
}

export interface PlayerDriver {
  start(ctx: PlayerContext): Promise<void>;
  onPhaseUpdate(snapshot: unknown): Promise<void>;
  onDM(dm: { from: number; to: number; text: string; at: number }): Promise<void>;
  stop(reason?: string): Promise<void>;
}

export interface Strategy {
  onPhase(s: unknown, ctx: PlayerContext): Promise<void>;
  onDM(dm: { from: number; to: number; text: string; at: number }, ctx: PlayerContext): Promise<void>;
}
```

Action validation: Zod schemas per action type. Authorization via seat capability map per phase.

## 3) Redis Schema (v0)
- `actors:room:{roomId}:events` — LPUSH event JSON (capped length N=1000 via LTRIM).
- `actors:room:{roomId}:snapshot` — current snapshot JSON.
- `actors:room:{roomId}:seats` — seat → actor/session mapping.
- `actors:tokens:{token}` — token blob (roomId, seat, caps, exp) with TTL.

## 4) Colyseus Adapter (v0)
- `createColyseusPorts(room)` returns `GameActionsPort` and `ReadOnlyStatePort` backed by room methods.
- Room emits snapshots on phase changes and DM events; adapter forwards to registered drivers.
- Rate limiting performed in adapter before invoking room actions.

## 5) Built-in Sample (one only)
- “Draw & Play”: tiny card-like loop to demonstrate actions, DMs, timers, and AI.
  - Actions: `play_card {value}` (allowed in `action` phase).
  - Communication: optional DMs in `communication` phase.
  - Revelation: highest card wins the trick; +1 score.
  - RuleBasedStrategy: if you lead, play highest remaining; else mirror opponent last card if known; otherwise random.

## 6) Configuration (intentionally limited)
- Room creation requires: `maxSeats`, `phaseDurations`, `rateLimit` (optional), `seed` (optional).
- Everything else is fixed in v0. Extensibility comes later via adapters/plugins.

## 7) Security Defaults
- No roles in URLs. Seat-bound join tokens required to act or receive DMs.
- Server discards late `submitAction` after deadline; first valid action per seat per round wins.
- DM and action rate limits; message length capped at 500.

## 8) Packaging (workspace)
- `@actors/core` — interfaces + scheduler + token utils + minimal reducer/event log API.
- `@actors/adapter-colyseus` — single adapter for v0.
- `@actors/strategy-rulebased` — baseline AI.
- `@actors/examples` — hosts “Draw & Play”.

## 9) Roadmap to v0.1 → v0.2
- v0.1 (MVP): publish the three packages + example; docs for ports and adapter wiring.
- v0.2: add `@actors/strategy-agents-openai` (Agents SDK), `@actors/assistant-copilotkit` example, export/report helpers.

## 10) What to measure
- Time-to-first-game scaffold
- P50/P95 action latency and DM throughput
- Error rate (rejected actions, late submissions)
- Token and rate-limit violations per room

