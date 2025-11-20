# Actors Framework — Scope and Boundaries

Purpose: define a general, reusable kernel for building multiplayer experiences with human players, AI players, and game masters/assistants — without binding to one genre (e.g., game theory) or one transport (e.g., Colyseus). The kernel should scale from simple card/board games to social deduction, co-op coordination, and experiments.

## Guiding Principles
- Server authority: all mutations flow through validated actions on the server.
- Ports & adapters: the domain core is transport‑agnostic; adapters bind to Colyseus, Socket.IO, WebTransport, etc.
- Thin kernel, powerful seams: keep the core minimal; make it easy to plug strategies, assistants, storage, moderation, and UIs.
- Determinism optional: support seeded RNG and event sourcing for replay/research, but don’t require it for all genres.
- Observability by default: logs, metrics, and traces are first‑class.

## What the Kernel MUST Provide
- Identity & sessions
  - Actor identity (human/AI), session tokens, seat/slot assignment, capability mapping (what each actor can do now).
- Rooms/Tables and matchmaking
  - Create/join/leave, seat management, spectator support, lobbies with readiness and capacity constraints.
- Messaging primitives
  - Broadcast channels, group channels, and DMs; server filters and logging hooks; rate limiting and moderation hooks.
- Typed actions and reducers
  - Action registry with validation (e.g., Zod) and authorization; idempotency support; conflict resolution policy (queue or latest‑wins); reducer hooks for state evolution.
- Phase/timer orchestration (Game Master)
  - Deadline scheduling, phase transitions, per‑phase permissions; cancelation/abort signals to drivers and assistants.
- Event log + snapshots
  - Append‑only event store (for replay/audit) and periodic snapshots (fast restore); seedable RNG for deterministic runs.
- Ports for strategies/assistants
  - `ReadOnlyStatePort`, `GameActionsPort` for players; `ControlPort` for game master/experimenter.
- Observability & safety
  - Structured logs, tracing, metrics; rate limits per actor/tool; moderation policy hooks.

## What the Kernel WILL NOT Do
- Rendering/UI or client frameworks (React/Vue/Svelte) — provide example UIs only.
- Physics/animation or domain‑specific mechanics (e.g., card shuffling algorithms, pathfinding). Offer utilities (e.g., seedable RNG), not engines.
- Opinionated databases or migrations — provide storage adapters; the app chooses Redis/Postgres/S3, etc.
- Proprietary auth providers — ship interfaces; adapters can integrate OAuth/JWT as needed.

## Core Domain Model (Transport‑agnostic)
- Actor: identity plus current session.
- Seat: a slot at a table/room bound to an actor (optional for spectators).
- Room/Table: container for seats, channels, and state machine.
- Channel: message stream (broadcast, group, DM) with policy and logging.
- Phase: named step with timing and permissions.
- Action: validated intent from an actor (e.g., “play card”, “vote”, “submit move”).
- Event: immutable result of an action or system transition.
- Snapshot: materialized state at a point in time.

Type contracts (simplified):
```ts
export interface ReadOnlyStatePort {
  getSnapshot(roomId: string, forActor?: string): Promise<unknown>;
}

export interface GameActionsPort {
  submitAction(roomId: string, actorId: string, type: string, payload: unknown): Promise<void>;
  sendDM(roomId: string, fromId: string, toId: string, text: string): Promise<void>;
}

export interface ControlPort {
  setPhase(roomId: string, phase: string, durationMs?: number): Promise<void>;
  assignSeat(roomId: string, actorId: string, seatIndex: number): Promise<void>;
}

export interface PlayerDriver {
  start(ctx: PlayerContext): Promise<void>;
  onPhaseUpdate(snapshot: unknown): Promise<void>;
  onDM(dm: { from: string; to: string; text: string; at: number }): Promise<void>;
  stop(reason?: string): Promise<void>;
}

export interface Strategy {
  onPhase(s: unknown, ctx: PlayerContext): Promise<void>;
  onDM(dm: { from: string; to: string; text: string; at: number }, ctx: PlayerContext): Promise<void>;
}
```

## Adapters and Plugins (Draw the Line Here)
Include as separate packages so apps opt‑in and the kernel stays lean.

- Transport adapters
  - `@actors/adapter-colyseus`, `@actors/adapter-socketio`, `@actors/adapter-webtransport`.
- AI strategies
  - `@actors/strategy-agents-openai` (Agents SDK), `@actors/strategy-rulebased` (baselines), future providers.
- Assistants
  - `@actors/assistant-copilotkit` exposing read‑only insights and safe controls.
- Storage
  - `@actors/storage-redis` (KV/snapshots), `@actors/storage-postgres` (event store), `@actors/storage-s3` (exports).
- Moderation & safety
  - `@actors/plugin-moderation`, `@actors/plugin-rate-limit`, `@actors/plugin-guardrails`.
- Devtools
  - `@actors/devtools` (phase timeline, action stream, traces, token budgets).

The kernel defines interfaces; adapters implement them. If a feature can live in an adapter without leaking into the core types, it stays out of the kernel.

## Lifecycle and Scheduling
- Room creation → seats assigned → phase `setup` → `running` (phase loop) → `ended`.
- Scheduler triggers phase changes and emits abort signals to drivers/strategies.
- Drivers (human or AI) use ports; reducers validate and apply actions; events are appended and snapshots updated.

## Example: Card Game Mapping
- Actions: `draw`, `play`, `discard`, `pass`, `declare` (validated with Zod).
- State: deck (seeded shuffle), hands, discard pile, turn index, phase timers.
- Channels: broadcast table chat; DMs for table talk or partner signaling (if allowed).
- AI: strategy consumes snapshot, decides legal move, submits action; can DM within policy.
- Replay: event log + seed reconstructs the full game for analysis.

## Packaging Plan (pnpm workspace)
- `@actors/core` — interfaces, schedulers, action registry, event log API, seedable RNG utilities.
- `@actors/adapter-colyseus` — binds core ports to a Colyseus Room.
- `@actors/strategy-rulebased` — deterministic policies for CI and baselines.
- `@actors/strategy-agents-openai` — Agents SDK integration via tools mapped to ports.
- `@actors/assistant-copilotkit` — experimenter/GM assistant.
- `@actors/devtools` — debug UI components and server hooks.
- `@actors/examples` — minimal “card game” and “coordination game” templates.

## Observability and Governance
- OpenTelemetry traces around action handling, tool calls, and phase changes.
- Per‑actor token budgets and tool call limits.
- Versioning policy: additive changes to interfaces are minor; breaking changes are major.

## Where We Draw the Line
- Kernel owns: identity/session, seats, channels, phase/timers, action validation, reducers, event log/snapshots, ports, and observability hooks.
- Adapters own: transports, AI providers, assistants, storage, moderation.
- Apps own: domain rules, UI, assets, custom logic beyond the generic action/phase scaffolding.

## Next Steps
1) Extract `@actors/core` interfaces from our current repo (PlayerDriver/Strategy/Ports).
2) Build `@actors/adapter-colyseus` by wrapping our Room hooks.
3) Ship `@actors/strategy-rulebased` for deterministic CI.
4) Add `@actors/strategy-agents-openai` with tool bindings.
5) Publish examples and a short “create-actors-game” scaffolder.

