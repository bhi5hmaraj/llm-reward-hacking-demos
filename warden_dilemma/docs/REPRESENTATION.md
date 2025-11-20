# Representing Large k‑Bin Payoff Spaces and Compositions

This note collects practical, intuitive ways to represent and reason about the large “action × composition” spaces that arise in the k‑bin model.

## 1) Canonical Indexing (combinatorial)

- Stars & bars: compositions of N into k parts → Comp(N,k) = C(N+k−1,k−1).
- Canonical key for a composition: Key(c) = `c[a0]:c[a1]:...:c[a{k-1}]`.
- Lex/graded-lex orders for deterministic iteration; colex often has nice locality.
- Fast index/lookup: use combinatorial number system to map a composition to an integer index in [0,Comp(N,k)).

## 2) Storage Strategies

- Normalised table (recommended): k × Comp(N−1,k) (exclude-self), or sparse dict on k × Comp(N,k) with include-self constraint c[a]≥1.
- Sparse/on-demand: materialise only compositions visited; fill rest via presets/formula evaluation.
- Parametric rules: store parameters (linear/threshold/etc.) rather than full tables; derive values on the fly.
- Caching: memoize f(a,c) results by Key(c) in a bounded LRU during a round.

## 3) Visualisations that Scale

- Histogram (live and reveal): coloured bars for bin counts c; small multiples for history.
- Ternary plots (k=3): barycentric coordinates to map (c0,c1,c2)/N to the triangle; heatmap overlay for payoffs or best responses.
- Tetrahedral/parallel coordinates (k=4+): either project to parallel coordinate axes or present small multiples by fixing one dimension.
- Timeline of round snapshots: a row of mini-histograms (sparkbars) with tooltips showing composition & key payoffs.
- Sankey of transitions across rounds: bins at t → bins at t+1 (macro flow), good for coalition dynamics.
- Heatmap slices: fix k−2 counts; show 2D heatmaps of payoff for the remaining two, sweep slices.
- Isoline bands: show expected payoff contour lines over the simplex for mixed strategies.

## 4) Reasoning Aids (intuitive & standard)

- Mixed strategies as Multinomial(N−1,p): expected composition and variance; compare to realised c.
- Majorization / partial order: c ≽ d if c is “more equal” than d; helpful for fairness/inequality reasoning.
- Lattice/adjacency: edges connect compositions differing by moving one ball between bins (L1 distance 2). Shortest paths capture minimal coalition changes.
- Moments & summaries: mean vector (c/N), entropy of distribution over bins, Gini over counts, KL divergence to a target.
- Factorised rules: design f(a,c) = g_a(c_a) + h(c) (bin-specific + global term) to reduce complexity and add interpretability.
- Monotonicity constraints: enforce desirable shape (e.g., f(Share,·) increasing in c_share) to regularise tables.

## 5) UI for Large k and N

- Cap k (<=6) for mobile; paginate bins or group them when k grows.
- “Lens” controls: focus on 2 bins at a time; others grouped into “rest”.
- Tooltips and legends: always include labels/colours; allow toggling of bins.
- Progressive disclosure: default to presets and summary graphics; expand into full tables only when needed.

## 6) Performance Notes

- Counting → O(N); payoff application → O(N).
- Precompute composition indexers once per (N,k) and reuse across rounds.
- For previews over the full composition space, iterate in graded-lex order and short-circuit when plotting limits are hit.

## 7) Suggested Implementation Steps

1) Implement composition indexer utilities (key <-> index, enumeration).
2) Switch payoffs to the normalised table shape (k × Comp(N−1,k)). Keep formula mode as first-class.
3) Add histogram & timeline views (small multiples), then a ternary plot for k=3.
4) Add a “What-if” panel with Multinomial previews and expected payoffs.
5) Add optional monotonicity/regularisation in the table editor to prevent cliffs.

