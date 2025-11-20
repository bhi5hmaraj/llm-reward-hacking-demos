# Modelling Warden's Dilemma as “Balls into Bins” (k‑Action) with Visual Payoffs

This doc explores generalising the binary Cooperate/Defect design to k actions (“bins”), modelling an N‑player round as a composition of N into k parts, and how to represent, compute, and visualise payoffs and history.

Why this model?
- Generalises beyond C/D to any finite action set A = {a1..ak}
- Aggregation by counts (c1..ck) compresses state (k actions vs k^N profiles)
- Visual metaphors (bins, colours, chips) map well to live histograms and history timelines

---

## 1) Core Objects and Notation

- Players: N human (and possibly AI/scripted) players.
- Actions (bins): k ≥ 2 actions A = {a1..ak}. Each action ai is configured with:
  - label: string (e.g., “Cooperate”, “Defect”, “Hold”, …)
  - color: string (hex)
  - metadata: optional freeform JSON (semantic tags, tooltips)
- Composition: c = (c1..ck) ∈ Z^k_{≥0} with Σi ci = N.
  - ci = number of players who chose action ai.
  - Number of possible compositions: C(N+k−1, k−1) (stars & bars).
- Symmetric payoff model: a player’s payoff depends only on
  - their own chosen bin a ∈ A
  - the round’s composition vector c (possibly with or without counting “self”).

Payoff function (symmetric):
- f: A × Z^k_{≥0} → R
  - Option A (exclude self): f(a, c−e_a)
  - Option B (include self): f(a, c)
  Choose one and stay consistent; A is common for C/D.

Examples:
- Binary C/D (k=2) maps to k‑bin model with labels/colors; payoffs are defined over (own action, # of others who cooperated).
- Multi‑bin: “Bid 0/1/2/3”, “Share/Save/Steal”, etc.

---

## 2) Data Model (Schema Proposal)

Replace JSON strings with explicit schemas across GameState for clarity and binary‑free visualisation.

- PayoffBinState
  - id: string ("a0".."a{k-1}")
  - label: string
  - color: string

- CompositionState
  - counts: MapSchema<string, number> // key = binId, value = count
  - total: number

- PayoffRuleState (symmetric)
  - binId: string (action of focal player)
  - functionType: "table" | "formula" | "script"
  - table?: MapSchema<string, number> // key = serialized composition key, value = payoff
  - formula?: string // e.g., linear/quadratic of counts
  - script?: string // secure sandboxed script string (optional, future)
  - params?: MapSchema<string, number>

- RoundMatrixState (one per round)
  - bins: ArraySchema<PayoffBinState>
  - composition: CompositionState // observed counts
  - rules: ArraySchema<PayoffRuleState>
  - generatedBy: "preset" | "custom" | "script"

- GameState additions
  - currentBins: ArraySchema<PayoffBinState>
  - currentComposition: CompositionState // live histogram (before lock)
  - currentRules: ArraySchema<PayoffRuleState>
  - roundMatrices: ArraySchema<RoundMatrixState> // history (last M)

- Experiment Config additions
  - bins: [{ id, label, color }..]
  - ruleSpec: one of
    - table: explicit payoff for each composition
    - formula: parametric
    - generator: preset name + params (e.g., “symmetric_linear”, “threshold”, “public_goods”)
  - UI: experimenter assigns labels & colours to bins; can re‑use presets or supply params.

Composition keying
- Key(c) = join([counts[a0], counts[a1], …, counts[a{k-1}]], ":") for rule lookups and persistence.

---

## 3) Computation & Complexity

Live rounds
- Live histogram: increment bin count as players pick (or after all submitted, for secrecy). Composition c at lock is trivial.
- Payoff application: O(N) once c is known. Each player’s payoff = f(ownBin, c (± self)).

Design‑time analysis
- Enumerating compositions: O(C(N+k−1, k−1)). For N=10, k=4 → C(13,3)=286 states (much smaller than k^N=1,048,576).
- Expected payoffs under mixed strategies p∈Δ^k: use Multinomial(N−1, p) for “others” and evaluate E[f].
- “Composition (combinatorics)” (stars and bars) is the right lens for enumerating feasible c.
- Generating functions or DP can compute distribution of c fast for given p.

Bottom line: This model is easier to compute than per‑profile, and tractable for UI “what‑if” previews and analytics.

---

## 4) Visual Design (Experimenter & Player)

Player UI
- Action palette: k coloured cards (labels under colour swatches). Single tap selects; confirm to lock.
- Live histogram (optional): shows counts per bin (if not hidden) with coloured bars.
- DM chat alongside, as implemented.

Experimenter UI
- Bin editor: add/remove bins, set label/colour, order them.
- Rule editor: choose generator (preset) or upload table/formula (guarded; script sandbox later).
- Live histogram: stacked bars per round with composition.
- Round timeline: small multiples of RoundMatrixState; hover a past round to see composition and payoff applied.
- “What‑if” panel: set N, k, p to preview distribution of c (Multinomial) and expected payoffs; export preset.

History
- Store last M RoundMatrixState (e.g., M=10) for quick rendering and export to CSV/JSON.

Colour semantics
- Provide accessible colour palette defaults; allow manual overrides with contrast checks.

---

## 5) Backwards Compatibility (C/D → k‑bins)

- k=2 with labels {Cooperate, Defect} and colours {#4CAF50, #f44336}
- Existing payoffs map to rules where f(C, c) and f(D, c) depend on number of cooperators.
- Migration path: current JSON strings → typed RoundMatrixState. Keep JSON serialization for persistence if needed.

---

## 6) Server Mechanics

Phases & state
- Announcement: generate RoundMatrixState from config/generator; publish `currentBins` + `currentRules`.
- Communication: players see palette + (optional) live histogram; chat available.
- Action: lock in; server accumulates `currentComposition`; when all submitted or timeout, compute payoffs using rules.
- Revelation: broadcast `RoundMatrixState` (bins, composition, per‑player payoffs). Append to `roundMatrices`.

Rule engines (extensible)
- Table: direct lookup by Key(c). Author once; server enforces input domain.
- Formula: standard forms (linear/quadratic/threshold/concave) in counts; parameters validated.
- Script (later): sandboxed pure function (counts → payoffs) with CPU/time limits and no side effects.

Validation & Safety
- Ensure bins.length == k and Σci == N.
- Disallow negative payoffs outside bounds; allow experimenter to set payoff bounds visible in UI.
- Log every applied rule & composition (“provenance”) for reproducibility.

---

## 7) Persistence & Analytics

Keys
- `exp:{id}` → config (incl. bins & ruleSpec)
- `exp:{id}:round:{t}` → RoundMatrixState (bins, composition, rule snapshot, payoffs)
- `exp:{id}:chat:{t}:{seq}` → chat logs per round

Analytics
- Cooperation generalises to “bin share” over time: ci/N per round.
- Per‑bin participation, transitions (Sankey from t→t+1), player trajectories.
- Expected vs realised payoffs (if using generator with parameters).

---

## 8) API & UI Contract (Sketch)

POST /api/experiments
```json
{
  "name": "K‑bin trust",
  "config": {
    "numPlayers": 8,
    "numRounds": 10,
    "maxRefusals": 2,
    "bins": [
      {"id":"a0","label":"Share","color":"#4CAF50"},
      {"id":"a1","label":"Save","color":"#2196F3"},
      {"id":"a2","label":"Steal","color":"#f44336"}
    ],
    "ruleSpec": {
      "type": "formula",
      "formula": "alpha * counts.a0 - beta * counts.a2",
      "params": {"alpha": 2, "beta": 3}
    },
    "announcementDuration": 2000,
    "communicationDuration": 10000,
    "actionDuration": 10000,
    "revelationDuration": 2000
  }
}
```

Server round payloads include:
- `currentBins`, `currentRules` in announcement
- `currentComposition` as histogram (optional live)
- `roundMatrices[t]` snapshot in revelation

---

## 9) Open Questions

- Include self or exclude self in payoff rule inputs? (choose one)
- Should rules be strictly symmetric, or allow bin‑specific heterogeneity (still symmetric w.r.t. identities)?
- Maximum k to keep UI usable on mobile (likely ≤6)?
- How to preview and validate arbitrary formulas/scripts safely? (param validation, unit tests, dry‑runs)
- Privacy toggles: reveal histogram live vs only at revelation.

---

## 10) Implementation Plan (Incremental)

P0 – Types & minimal UI
- Add typed schemas: PayoffBinState, CompositionState, PayoffRuleState, RoundMatrixState.
- Replace JSON strings in GameState with these typed fields; keep backward compatibility serialization as needed.
- Render k‑bin palette for players; render simple coloured histogram and per‑round snapshot.

P1 – Generators & analytics
- Implement rule generators: table, linear, threshold presets.
- Add expected value preview (Multinomial) in experimenter console.
- Persist RoundMatrixState + chats per round; limit in‑memory history.

P2 – Advanced UX & scripts
- Timeline of past matrices (mini charts), Sankey for bin transitions.
- Scripted payoff rules (sandboxed), with unit tests and guardrails.
- Export/import experiment templates.

---

## 11) Why “Compositions” Help

- Enumerating states: C(N+k−1, k−1) is dramatically smaller than k^N.
- Useful for: preset authoring, expected payoff/variance analysis, coverage tests, and visualisation (each c is a unique histogram).
- For live play, the computation is trivial — you just count choices once; compositions shine mostly for design and analytics.

---

## Appendix: Example

N=5, k=3, A={Share(a0), Save(a1), Steal(a2)}
- A round may end with c=(3,1,1). Histogram: 3 green, 1 blue, 1 red.
- Payoff rule (linear):
  - f(a0,c) = +2*c[a0] − 3*c[a2]
  - f(a1,c) = +1*c[a1] − 1*c[a2]
  - f(a2,c) = +4*c[a2] − 2*c[a0]
- UI: player taps a coloured card; experimenter sees histogram + the formula, and later the applied matrix snapshot in the Round timeline.

---

## 14) Dimensions and Storage (What size are these objects?)

Terminology
- N = number of players; k = number of bins/actions.
- Comp(N,k) = number of k‑part weak compositions of N: C(N+k−1, k−1) (stars & bars).

Core objects
- Bins vector: length k (labels + colours).
- Composition vector c: length k with Σ c_i = N.
- Histogram series (visual): length k.
- Round history window: M snapshots (each snapshot stores one composition, bin meta, and rule snapshot).

Payoff table (“matrix”) size
- Symmetric, action‑by‑composition representation.
- Two common normalisations:
  1) Exclude‑self: f(a, c^others), where c^others is a composition of N−1 into k parts.
     - Table size: k × Comp(N−1, k) = k × C((N−1)+k−1, k−1).
  2) Include‑self: f(a, c^all), where c^all is a composition of N into k parts.
     - Feasible pairs (a, c^all) satisfy c^all[a] ≥ 1. For each a, there is a 1‑to‑1 mapping to a composition of N−1 into k parts by subtracting one from c^all[a].
     - Effective size is still k × Comp(N−1, k). You can either store k × Comp(N−1,k) entries (normalised) or a sparse dict over k × Comp(N,k) with the c^all[a] ≥ 1 constraint.

Example (N=6, k=3)
- Comp(6,3) = C(6+3−1, 2) = C(8,2) = 28 (full compositions of N into k).
- Comp(5,3) = C(5+3−1, 2) = C(7,2) = 21 (others‑only compositions for exclude‑self, or feasible per‑action include‑self).
- Payoff table size (recommended normalisation): k × Comp(5,3) = 3 × 21 = 63 numeric cells.

Computation costs (per round)
- Counting choices → composition: O(N).
- Applying payoffs:
  - Table: O(N) with O(1) lookup per player (compute key for c^others or derive from c^all).
  - Formula: O(N) evaluating k small expressions or one per player’s action.

Notes
- If rules were player‑specific (asymmetric), table size would explode toward k^N; our symmetric, composition‑based model avoids this.
- Opt‑out can be a first‑class bin if desired (it already is in the current model); that simply increases k by 1.

---

## 12) Experimenter Payoff Design (Generalised k‑Bin)

Goal: make it easy (and safe) for experimenters to specify, reason about, and iterate on payoffs with k actions and N players.

Design surfaces
- Presets (one‑click): common social dilemmas or public goods templates mapped to k bins; expose a few intuitive sliders (e.g., temptation, reward, punishment).
- Table editor (powerful): editable matrix keyed by composition counts (stars & bars); filter by “bin of focal player” to edit f(a, c) quickly. Provide CSV/JSON import/export.
- Formula builder (fast): define f(a, c) as parametric forms, e.g., linear/quadratic/threshold of counts with typed parameters and bounds.
- Script (advanced, sandbox): user‑provided pure function on counts; guard with CPU/time limits; require tests before activation (P2).

Safety & constraints
- Enforce action and payoff bounds globally (from config).
- Validate domain: Σi ci == N; all ci ≥ 0; k matches bin set; disallow NaNs.
- Option to “exclude self” or “include self” in f(a, c) arguments (set once per experiment to avoid confusion).

Exploration & preview
- Composition explorer: slider/inputs for counts c; immediately show payoffs per bin; render the k‑bar histogram with per‑bin payoff annotations.
- Mixed strategy preview: choose p ∈ Δ^k and compute expected payoff under Multinomial(N−1, p) (exclude‑self) or Multinomial(N, p) (include‑self). Plot expected and variance bands per bin.
- Sensitivity view: sweep one parameter (e.g., temptation) and show how expected payoffs and best responses change.

Fairness & risk controls (optional toggles)
- Regularisers on payoff tables to avoid extreme cliffs, e.g., Lipschitz‑like constraints on neighbouring compositions.
- Symmetry checks: payoffs for the same own‑bin across compositions that differ only by permuting “other” bins should be consistent if intended symmetric.

UI specifics
- Bins palette: colour + label chips; reorder by drag; tooltips can include semantic descriptions (e.g., “pro‑social”, “anti‑social”).
- Live preview panel: shows the current round’s generated RoundMatrixState and a miniature timeline of the last M matrices.
- Test harness: single‑round sandbox with virtual players to sanity check payoffs before going live.

Data persistence & provenance
- Store the exact ruleSpec snapshot (table/formula/params) inside each RoundMatrixState so results are reproducible even if the preset later changes.

Incremental adoption
- Start with presets + formula builder for k up to ~6; add table editor for researchers needing fine control; add script next with sandbox + unit tests.

---

## 13) Separating the Math Model from Visual Views

Principle: the math model is the canonical, role‑agnostic source of truth; views are pure, deterministic mappings from model → presentation for a given audience (experimenter vs player) and screen size.

Layers
- Math model (domain): typed structures that fully describe the game’s current decision space and outcomes.
  - Bins: PayoffBinState[] { id, label, color }
  - Rules: PayoffRuleState[] (table/formula/script + params)
  - Composition: CompositionState { counts, total }
  - Round snapshot: RoundMatrixState { bins, composition, rules, generatedBy }
  - History: RoundMatrixState[t] (last M rounds)
- View adapters (selectors): pure functions that derive the minimal data needed by a particular view from the model.
  - Examples: histogram series, palette entries, payoff legend, per‑player summary, timeline cards
- Views (renderers): visual components that render adapter outputs; no business logic.

Type sketch (TypeScript)
```ts
// Canonical, role‑agnostic model
interface MathModel {
  bins: PayoffBin[];                  // k bins
  rules: PayoffRule[];                // symmetric rules
  composition?: Composition;          // live or final histogram
  round?: RoundMatrix;                // current round snapshot
  history?: RoundMatrix[];            // recent rounds
  N: number;                          // players
}

// View options/policies
interface ViewOptions {
  audience: 'experimenter' | 'player';
  revealLiveHistogram: boolean;       // player privacy policy
  theme: 'light' | 'dark';
  viewport: { width: number; height: number; touch: boolean };
}

// Derived view models (examples)
interface HistogramVM { labels: string[]; colors: string[]; values: number[]; total: number }
interface PaletteVM   { actions: { id: string; label: string; color: string }[] }
interface LegendVM    { lines: { binId: string; label: string; color: string }[] }
interface TimelineVM  { cards: { round: number; compositionKey: string; spark: number[] }[] }

// Adapters (pure functions)
function toHistogramVM(model: MathModel, opts: ViewOptions): HistogramVM {
  const canShow = opts.audience === 'experimenter' || opts.revealLiveHistogram;
  const counts = canShow && model.composition ? model.composition.counts : {} as Record<string, number>;
  const labels = model.bins.map(b => b.label);
  const colors = model.bins.map(b => b.color);
  const values = model.bins.map(b => counts[b.id] || 0);
  return { labels, colors, values, total: values.reduce((a, b) => a + b, 0) };
}

function toPaletteVM(model: MathModel): PaletteVM {
  return { actions: model.bins.map(b => ({ id: b.id, label: b.label, color: b.color })) };
}

function toTimelineVM(model: MathModel): TimelineVM {
  const cards = (model.history || []).map((r, i) => ({
    round: i + 1,
    compositionKey: Object.values(r.composition.counts).join(':'),
    spark: model.bins.map(b => r.composition.counts[b.id] || 0),
  }));
  return { cards };
}
```

Responsibilities
- Math model: owned by server; serialised in schema (GameState) and snapshots (RoundMatrixState). Stable, testable.
- Adapters: stateless, memoizable, unit‑tested; same function can feed different renderers (SVG/Canvas/WebGL).
- Views: presentational only; responsive; accessible. Players and experimenters use different adapters/options, not different business logic.

Data flow
1) Server computes/updates MathModel parts → synchronises in GameState (currentBins/currentRules/currentComposition) and appends RoundMatrixState to history.
2) Client receives updates → adapters compute view models → views render.
3) Players act only through intents (chooseBin(id), submitAction) that don’t depend on the visual mapping.

Testing
- Unit test adapters with synthetic MathModel inputs (C(N+k−1, k−1) small cases).
- Snapshot test views by freezing adapter outputs.
- E2E test whole flow with short durations and k≤4.

Extensibility
- Adding a new representation (e.g., Sankey for bin transitions) = add a new adapter + view; MathModel stays the same.
- Changing labels/colours or privacy policies changes ViewOptions, not the model or rules.
