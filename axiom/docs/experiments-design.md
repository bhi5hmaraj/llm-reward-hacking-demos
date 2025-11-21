# Experiments System Design

**Hypothesis-Driven Research Platform**

## Problem Statement

Current system is **ephemeral and ad-hoc**:
- Run tournament → see results → results lost
- No way to compare across different configurations
- Can't track which policies/prompts were tested
- No statistical analysis or reproducibility

**Need**: Structured experiments for hypothesis testing.

## Goals

1. **Persistence**: Store experiment definitions and results
2. **Reproducibility**: Re-run experiments with same parameters
3. **Comparison**: Compare results across experiments
4. **Analysis**: Statistical significance, trends, insights
5. **Collaboration**: Share experiments and findings

## Core Concepts

### Experiment

A named, persistent research question with:
- **Hypothesis**: What you're testing
- **Configuration**: Strategies, parameters, policies
- **Runs**: Multiple executions for statistical validity
- **Results**: Aggregated outcomes and analysis
- **Immutable**: No delete - experiments are permanent research records

### Example Use Cases

**Policy effectiveness**: Test if "forgiving policy" increases cooperation vs TitForTat by 20%

**Temperature sensitivity**: Measure how temperature (0.3 to 1.5) affects cooperation consistency

**Strategy comparison**: Compare GPT-4 vs Claude vs classical strategies across 100 games

## Data Model

See [experiments-schema.md](./experiments-schema.md) for complete schemas.

**Key entities**:
- `Experiment` - Hypothesis + config + status
- `ExperimentRun` - Single execution with results
- `ExperimentAnalysis` - Computed statistics across runs

## API Design

```
# Experiments
POST   /experiments              Create experiment
GET    /experiments              List with filters (status, tags)
GET    /experiments/{id}         Get details
PUT    /experiments/{id}         Update (draft only)

# Runs
POST   /experiments/{id}/runs    Start new run (or batch)
GET    /experiments/{id}/runs    List all runs

# Analysis
GET    /experiments/{id}/analysis       Aggregated stats
GET    /experiments/compare?ids=x,y,z   Compare multiple
```

**Note**: No delete endpoint - experiments are permanent research records.

## Storage Implementation

Uses existing storage layer pattern (see [storage-layer.md](./storage-layer.md)):

- `ExperimentRepository` - CRUD for experiments (no delete)
- `ExperimentRunRepository` - Manage individual runs

Redis key structure:
```
experiment:{id}              → Experiment JSON
experiment:{id}:runs         → Sorted set (by run_number)
experiment_run:{id}          → Run JSON
experiments:index            → All experiment IDs
experiments:by_status:{status} → For filtering
```

Follows same pattern as `PolicyRepository` - see `app/storage/` for reference.

## Execution Engine

`ExperimentRunner` service handles execution:

1. **Single run**: Load config → run tournament → store results
2. **Batch execution**: Run N times for statistical validity
3. **Analysis**: Aggregate stats (mean, std, confidence intervals)

Implementation in `app/services/experiment_service.py` - delegates to existing tournament runners.

## Frontend Components

New Experiments tab with:

1. **Experiment List**
   - Cards showing name, hypothesis, status
   - Filter by status, tags
   - Quick stats (runs completed, cooperation rate)

2. **Experiment Creator**
   - Name, hypothesis, description
   - Strategy selector (classical + LLM)
   - Policy selector for LLM strategies
   - Parameter configuration (turns, repetitions)
   - Run count for statistical validity

3. **Experiment Details**
   - Hypothesis and config display
   - Run history table
   - Real-time progress for running experiments
   - Results visualization (charts, tables)

4. **Analysis Dashboard**
   - Aggregated statistics
   - Confidence intervals
   - Comparison with other experiments
   - Export results (CSV, JSON)

## Phased Implementation

### Phase 1: Core Storage & Execution
- [ ] Experiment and ExperimentRun repositories
- [ ] Basic CRUD API endpoints
- [ ] Simple experiment runner
- [ ] Store results in storage layer

### Phase 2: Analysis & Statistics
- [ ] Aggregation service
- [ ] Statistical analysis (means, std, CI)
- [ ] Comparison endpoint
- [ ] Export functionality

### Phase 3: Frontend UI
- [ ] Experiment list view
- [ ] Create experiment form
- [ ] Results visualization
- [ ] Analysis dashboard

### Phase 4: Advanced Features
- [ ] Experiment templates
- [ ] Batch execution with progress
- [ ] Notifications (experiment completed)
- [ ] Collaboration (share experiments)

## Example Workflow

```
1. Create experiment with hypothesis and config
2. Run 30 times: POST /experiments/{id}/runs?count=30
3. Monitor: GET /experiments/{id} → shows progress
4. Analyze: GET /experiments/{id}/analysis → stats + confidence intervals
5. Compare: GET /experiments/compare?ids=x,y → side-by-side
```

## Success Metrics

1. **Reproducibility**: Same config → same results
2. **Statistical Rigor**: Confidence intervals, significance tests
3. **Usability**: Create experiment in < 2 minutes
4. **Performance**: Run 100 experiments in < 5 minutes
5. **Storage**: Handle 1000+ experiments efficiently

## Future Extensions

- **Experiment chains**: Run A → analyze → configure B
- **Parameter sweeps**: Auto-generate experiments for parameter ranges
- **Bayesian optimization**: Auto-tune policies
- **Collaboration**: Multi-user experiments
- **Version control**: Track experiment iterations

## Related Documents

- [Experiment Schema](./experiments-schema.md) - Detailed data models
- [Storage Layer](./storage-layer.md) - Repository implementation guide
