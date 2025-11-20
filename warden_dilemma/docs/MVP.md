# MVP Plan – Warden's Dilemma (Pragmatic, Simple, Usable)

Goal: deliver a minimal but complete end‑to‑end experience for running small experiments, with clear paths to extend later. This document prioritises simplicity and reliability over completeness.

---

## 1) Who this MVP serves

- Experimenter (1): sets up a quick study with a small group (2–6 players), runs a few rounds, and exports basic results.
- Players (2–6): join with a code, coordinate with DMs, and choose a single action per round.

---

## 2) Scope (MVP)

- N (players): 2–6
- k (actions): 2–3 (default: Cooperate/Defect; optional 3rd labelled by experimenter)
- Rounds: 1–10
- Payoff rule (symmetric, simple linear): for action a and composition c
  
  f(a, c) = α_a · c_a − β_a · (Σ_{b≠a} c_b)
  
  where α_a ≥ 0 (reward when more choose a) and β_a ≥ 0 (cost when others choose differently). Defaults provided; experimenter may set α, β per bin.
- Phases: announcement → communication (DM) → action → revelation
- DM chat: per‑player list + 1:1 thread (no group chat)
- Tokens for secure join (no role in URL). Lobby creates tokens; GameRoom requires joinToken.
- Responsive UI: mobile friendly palette + DM list → thread

Out of scope (for MVP)
- k > 3, scripted rules, custom scripting
- Full round persistence beyond final scores (optional if time permits)
- Rich analytics; live public dashboards

---

## 3) Minimal User Flows

Experimenter
1. Create experiment: name, numPlayers, numRounds, durations, bins (2 or 3) with labels/colours, α/β per bin.
2. Share the 6‑char code.
3. See lobby participants (humans needed), “Ready” indicator, and Start button.
4. During rounds: view palette (readonly), simple histogram at reveal, and a timeline of last few compositions.
5. End: see final scores; optional export (JSON).

Players
1. Enter code → join lobby (no role in URL).
2. See “Players joined” count; DM list becomes active once in game.
3. Pick DM target, coordinate, lock action during action phase.
4. See reveal and cumulative score; proceed to next round.

---

## 4) Math Model (MVP)

- Bins (k≤3): [{ id, label, color }]
- Composition c (length k): counts per bin, Σc_i = N
- Rule (linear): α,β per bin in config; f(a,c) = α_a c_a − β_a (N − c_a)
- Exclude‑self policy: compute payoff using c^others by subtracting one from c at player’s chosen bin; implementation can reuse the simple formula with c^others_a = c_a − 1.

Storage (MVP)
- Keep existing JSON strings for currentPayoffMatrix to minimise refactor risk.
- Optionally compute and include a simple Round snapshot object (composition + per‑bin α/β used) in memory.

---

## 5) Views (MVP)

Player
- Action palette: 2–3 large, coloured buttons with labels.
- DM list (left) → DM thread (right) during communication phase.
- Action panel appears only in action phase; Submit button locks choice.

Experimenter
- Palette preview with labels/colours and α/β summary
- Lobby: players joined (X/Y), Start button
- Game: tiny histogram at reveal + a simple timeline (last 3 rounds) of coloured sparkbars

Adapters (kept simple)
- toPaletteVM (bins → {id,label,color}[])
- toHistogramVM (composition → bar heights)
- toTimelineVM (array of last compositions → sparkbars)

---

## 6) Backend (MVP)

- LobbyRoom
  - filterBy(['experimentId'])
  - On join: issue role‑bound token (experimenter or player) via messages; keep role out of URL.
  - Start: build token map; create GameRoom with { experimentId, tokens }.

- GameRoom
  - onJoin requires joinToken; derive role and (for players) playerId from token map.
  - Phases with simple timers; compute composition and apply linear rule.
  - Append minimal in‑memory round snapshot for experimenter timeline.

- Persistence (Upstash REST)
  - Save experiment doc and final scores; round snapshots optional in MVP.

- Security
  - Token gate for GameRoom (done). Lobby role hardening (experimenterSecret) as P1.

---

## 7) API (MVP)

- POST /api/experiments → { experimentId, lobbyCode }
- GET /api/experiments/resolve/:code → { experimentId }
- GET /health
- (Optionally) GET /results/:id → final scores summary

---

## 8) Testing (MVP)

Unit
- Lobby: requiredPlayers, isReady, experimenterConnected, start_game gated
- Game: join with token, phase transitions, composition counting, payoff application, DM routing

E2E (headless)
- Create → join 2 players → Start → pick actions → confirm payoffs and scores → repeat once

Dev durations (fast mode)
- announcement=1–2s, communication=8–10s, action=8–10s, revelation=1–2s

---

## 9) Metrics & Logging (MVP)

- Logs: phase enters/exits, player join/leave, DM counts, composition per round, per‑bin scores
- Optional: basic counters in memory; Prometheus and richer metrics are P1

---

## 10) Rollout Plan

- Phase 0: lock the token join path (no role in URL), DM UI, linear rule, 2–3 bins, responsive
- Phase 1: persistence of per‑round snapshot; lobby experimenterSecret; basic export
- Phase 2: typed schemas for RoundMatrix; histogram/timeline adapters; optional ternary plot for k=3

---

## 11) Risks & Mitigations

- Players can still spoof experimenter in Lobby: token prevents GameRoom elevation; add experimenterSecret next
- Long rounds slow testing: use fast durations in dev
- DM spam: add simple rate limiting per session if needed

---

## 12) Timeline (example)

- Day 1–2: linear rule wiring; token join end‑to‑end; DM UI
- Day 3: lobby/create UX polish; responsive tweaks; fast durations; unit tests
- Day 4: headless E2E; export final scores; bug‑bash
- Day 5: buffer + Phase 1 items (round snapshot persistence) if time

---

## 13) Non‑Goals (MVP)

- Complex scripted rules; k>3 general UIs; large‑N analytics; public dashboards; multi‑room orchestration; reconnection tokens beyond the current tab session (P1/P2)

