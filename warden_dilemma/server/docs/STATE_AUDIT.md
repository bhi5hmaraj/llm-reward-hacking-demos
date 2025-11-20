# Warden's Dilemma – Server State & Transition Audit (v0.1)

Scope: Colyseus server rooms, schemas, life‑cycle, and failure modes. Targets:
- Hardening state transitions (Lobby → Game → Phases → End)
- Correctness of timers, joins/leaves, reconnection, and persistence
- Security, observability, and test coverage plan

Related code:
- Entry/boot: `server/src/index.ts`, `server/src/bootstrap/*`, `server/src/http/*`
- Rooms: `server/src/rooms/LobbyRoom.ts`, `server/src/rooms/GameRoom.ts`
- Schemas: `server/src/rooms/schemas/LobbyState.ts`, `server/src/rooms/schemas/GameState.ts`
- Services: `server/src/services/*` (logger, redis, payoff)

---

## 1) Architecture Overview

- Match‑making
  - Lobby: `gameServer.define('lobby', LobbyRoom).filterBy(['experimentId'])` → isolates lobbies per experiment.
  - Game: `matchMaker.createRoom('game', { experimentId, playerAssignments })`, clients `joinById`.
  - Driver: `@colyseus/redis-driver` with `REDIS_URL` (persistence of room cache only). Presence is local by default.

- State (Colyseus Schema)
  - LobbyState: experiment metadata, `waitingPlayers[]`, `requiredPlayers`, `isReady`, `experimenterConnected`.
  - GameState: experiment metadata, `players: MapSchema<PlayerState>`, `phase`, `currentRound / totalRounds`, `phaseEndsAt`, `currentPayoffMatrix`, `chatHistory[]`, `roundHistory[]`, `startedAt/endedAt`.

- Flow
  1. Experimenter creates experiment (REST), navigates to lobby.
  2. Players join lobby (code → experimentId). When `waitingPlayers.length >= requiredPlayers`, lobby ready.
  3. Experimenter starts → GameRoom created → clients navigate and join.
  4. Game loop (X rounds): Announcement → Communication → Action → Revelation → (next | end).
  5. Game ends → scores broadcast; experiment status updated.

---

## 2) LobbyRoom Audit (`server/src/rooms/LobbyRoom.ts`)

Strengths
- Uses `filterBy(['experimentId'])` to keep joiners on the same lobby.
- Explicit `requiredPlayers`, `isReady`, `experimenterConnected` (post‑fix) make state visible/derivable.
- Assigns deterministic `playerId` as `player_<slot>`; sends `player_assigned` to the client.

Gaps / Risks
- Trusts `role` from the client. Any client can pretend to be `experimenter`.
- No rate limiting on joins/messages (potential abuse);
- `playerSlotAssignments` map is per‑session; not persisted; rejoin restores slot only if client still holds session.
- Lobby → Game handoff: relies on client receiving `player_assigned` and then `navigate()` to game. If a player reloads mid‑handoff, they may lose `playerId` unless stored (now mitigated on client by sessionStorage).

Recommendations
- P0: Enforce an `experimenterSecret` or signed token in `onJoin()` for `role='experimenter'`.
- P1: Add join throttling per IP/session; reject bursts.
- P1: Persist `playerSlotAssignments` (e.g., `presence.hset` or REST Redis) keyed by experimentId to survive tab refreshes and reconnects.
- P2: Add a server‑side “lobby watch‑dog” (interval) logging current `waitingPlayers`, to quickly diagnose stale lobbies.

---

## 3) GameRoom Audit (`server/src/rooms/GameRoom.ts`)

Life‑cycle
- Player init: builds full `players` MapSchema from config with default `isConnected=false` for humans.
- Join: experimenter stores `experimenterSessionId`; players must supply `playerId` → marks `isConnected=true` and maps `session↔player`.
- Phases: `startNextRound()` sequences `announcement → communication → action → revelation` using timers; `isProcessingPhase` guards against reentrancy.
- Chat: allowed only in `communication`; routed 1:1 to target and mirrored to experimenter; stored in `chatHistory`.
- Action: validates phase and action, confirms to client, then computed in `phaseRevelation()`.
- End: set `phase='ended'`, `endedAt`; broadcast `game_ended`; disconnect after delay.

Strengths
- Clear explicit phase machine with single entrance (`startNextRound`) and guard flag.
- Clean split between calculation (`computePayoffs`) and application (`updateScores`), with structured logging.
- Minimal coupling to persistence; primary state always in Schema (authoritative).

Gaps / Risks
- Reconnection: There is no `onAuth` and no `reconnect()` path. If a player refreshes during game, there’s no server‑side way to restore `playerId` except our new client‑side sessionStorage heuristic.
- Timers: `phaseTimer` tracks delayed transitions, but multiple async calls (e.g., manual triggers or overlaps) could cause edge reentrancy. `isProcessingPhase` is set only at phase start, not while awaiting all async operations.
- Backpressure: Chat is unbounded; `chatHistory` can grow indefinitely. Same for `roundHistory`.
- Validation: `handleSendChat` does not check if `toPlayer.isConnected`; messages can queue to disconnected players silently.
- Security: `role` is unverified; a malicious client could join as `experimenter` and send `experimenter_start`.
- Game integrity: No minimum connected humans check before starting rounds (only “all players connected” advisory). If experimenter starts prematurely, players may never populate `otherPlayers` (now less likely with saved playerId).
- Persistence: Results are only partially stored (experiment status). Round history / chats are not persisted to Redis (only comments). Restart would lose in‑flight game.
- Large round durations in dev: long `communicationDuration` can make tests/timeouts brittle; recommend dev overrides.

Recommendations
- P0: Add `onAuth` with signed claims (experimentId, role, slot). Derive `role` server‑side; ignore `role` from client.
- P0: Implement reconnection:
  - On successful `onJoin`, issue `room.reconnectionToken` to the client.
  - Support `/reconnect` flow using `client.reconnect(token)`; recover `session↔player` mapping and restore `isConnected=true`.
- P0: Guard transitions:
  - At each phase entry, re‑check preconditions (e.g., announcement → at least 2 humans connected, or pause until recovered / timeout).
  - Widen `isProcessingPhase` coverage to include all awaited async work for the phase.
- P1: Cap histories:
  - `chatHistory`: cap per round and total; drop oldest; log caps.
  - `roundHistory`: cap or persist to Redis per round; keep only last N rounds in memory.
- P1: Chat validation & UX:
  - Only allow targets `p.isConnected===true`.
  - Add optional server echo to sender for confirmation UI.
- P2: Dev ergonomics: allow phase durations to be overridden by `ROUND_*_MS` envs (small defaults in dev/tests).

---

## 4) Schemas Audit (`server/src/rooms/schemas/*.ts`)

GameState
- Uses JSON strings for `currentPayoffMatrix`, `actions`, `payoffs`, `scores`. This is simple but error‑prone:
  - Redundant serialization → more GC pressure, harder to type‑check; peeking from client requires parsing.
Recommendations
- P1: Replace JSON strings with explicit nested schemas (e.g., `PayoffMatrixState`, `MapSchema<number>` for scores/payoffs) to avoid repeated stringify/parse.
- P2: Add versioning field (e.g., `schemaVersion`) if future migrations are expected.

LobbyState
- New `experimenterConnected` field improves clarity.
Recommendations
- P2: Add `createdAt` / `updatedAt` in LobbyState for monitoring/debug.

---

## 5) Persistence & Redis (`server/src/services/redis.service.ts`)

Strengths
- Uses Upstash REST client for experiments and results storage with a simple API.
- Health checks for Upstash Redis with `/health` surface.

Gaps / Risks
- Round‑level and chat persistence are commented out → loss on crash.
- Experiment updates (status transitions) are eventual, not atomic with phase transitions.
- Error handling uses logs but does not propagate; callers assume success.

Recommendations
- P1: Persist per‑round snapshots (matrix, actions, payoffs, scores) and chat logs with keys:
  - `exp:${experimentId}`: experiment doc
  - `exp:${experimentId}:round:${n}`: round doc
  - `exp:${experimentId}:chat:${round}:${seq}`: chat message
- P1: Use pipelining/batching for write bursts at phase end.
- P2: Add lightweight read model for results page (aggregate scores/cooperation rate).

---

## 6) Security & Abuse Controls

- Today: role is client‑supplied; no auth; no rate limits.
Recommendations
- P0: Add server‑only `onAuth` with JWT (claims: experimentId, role, slot, iat, exp), signed by server when lobby assigns slots.
- P0: Rate limit `send_chat`, `submit_action` per session/interval; drop and warn on excess.
- P1: Validate allowed transitions from experimenter only (start); disallow if preconditions unmet (humans connected) unless override flag set.
- P2: Basic CSRF mitigations for REST endpoints if cookies are introduced (currently pure fetch with JSON body → low risk).

---

## 7) Observability & Ops

Strengths
- Structured logger with levels and a `gameEvent()` channel; server prints useful traces around phases and actions.

Gaps
- No metrics. No trace IDs to correlate flows. Health endpoint always reports `status:'ok'` even when Redis fails (falls back silently).

Recommendations
- P1: Add counters/gauges via a minimal Prometheus export (process metrics + game metrics):
  - `wd_lobby_waiting_players{experimentId}`
  - `wd_game_phase_seconds{phase}`
  - `wd_chat_messages_total{experimentId}`
  - `wd_actions_submitted_total{experimentId,action}`
- P1: Add `health` to include `redis: up/down` + `persistenceMode: redis|in_memory` + `uptime_seconds` + `active_rooms`.
- P2: Include a simple `traceId` per experiment in logs.

---

## 8) Test Coverage Plan (High‑Value First)

Unit (vitest)
- P0: Lobby
  - onCreate sets `requiredPlayers`; `experimenterConnected` toggles on join/leave.
  - handlePlayerJoin assigns unique slots; `isReady` flips when required humans present.
  - start_game guarded by experimenter; emits `game_started`.
- P0: Game – transitions
  - initializePlayers populates MapSchema with correct fields from config.
  - join (player) maps session↔player and marks `isConnected=true`.
  - phase sequencing honors timing and prevents reentrancy.
  - chat allowed only in `communication`; routes to recipient + experimenter.
  - submit_action validates phase and values; updates flags and scores.
  - onLeave enforces min connected humans.

Integration (headless browser)
- P0 flow: experimenter + 2 players → lobby → game → send chat during communication → submit actions → end.
- P1 reconnection: disconnect player mid‑round, reconnect using token; verify state consistency.
- P1 slow client: one player lags; ensure phase timeouts proceed; auto‑opt‑out path stable.

Harnesses & Helpers
- Add short durations under `NODE_ENV=test` (e.g., announcement=200ms, communication=1s, action=1s, revelation=200ms) to make tests deterministic.

---

## 9) Prioritized Next Steps

P0 – Must Do (correctness & security)
1. Add `onAuth` + JWT claims; remove trust in client‑supplied `role`. Gate `experimenter_start` by token.
2. Implement reconnection tokens and `reconnect()` flow; restore `session↔player` mapping and `isConnected`.
3. Strengthen phase guards: at each phase entry, re‑validate preconditions; widen `isProcessingPhase` to cover awaited async code.
4. Add rate limits to `send_chat` and `submit_action`.

P1 – High Value (stability & ops)
5. Persist per‑round snapshots & chat to Redis; cap in‑memory histories.
6. Prometheus metrics + richer `/health` with Redis/persistence status.
7. Round duration overrides for test/dev; add integration tests for lobby→game→chat→actions.

P2 – Nice to Have (UX & maintainability)
8. Strongly typed, non‑JSON schemas for matrices/scores.
9. Experiment lifecycle UI (resume, abort, archive) based on persisted state.
10. Admin/monitor UI powered by `@colyseus/monitor` + custom endpoints.

---

## 10) Quick Wins Already Implemented

- Lobby → Game: store and reuse `playerId` across pages so players appear to each other in chat selector.
- Fixed client schema subscriptions for Lobby and Game (onChange/onAdd/onRemove) for live updates.
- Debug endpoints for room visibility + enhanced server logs across joins/phases.

---

## Appendix – Suggested Invariants

Validate during development (assert or log‑error):
- Lobby: `isReady === (waitingPlayers.length >= requiredPlayers)`
- Game: `phase ∈ {waiting, announcement, communication, action, revelation, ended}`
- Game: `players.size === config.numPlayers`
- Game: Before `communication`: all human `isConnected===true` (or explicit override)
- Game: After `revelation`: scores are monotonic non‑decreasing per player

