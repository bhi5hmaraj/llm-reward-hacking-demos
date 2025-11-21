# Experiments Schema

**Data models for hypothesis-driven research**

## Experiment

Core experiment definition:

```typescript
{
  id: string                    // UUID
  name: string                  // "Policy X Impact"
  description?: string          // Optional details
  hypothesis: string            // "Policy X increases cooperation by 20%"
  status: "draft" | "running" | "completed" | "failed"

  config: {
    // LLM strategy configuration
    llm_strategy?: {
      provider: "openai" | "anthropic"
      model: string
      policy_id?: string
      temperature?: number
    }

    // Classical strategies to test against
    classical_strategies?: string[]  // ["TitForTat", "Pavlov"]

    // Tournament parameters
    turns: number                // 200
    repetitions: number          // 10

    // Number of runs for statistical validity
    target_runs: number          // 30
  }

  created_at: string            // ISO timestamp
  created_by?: string           // User ID (future)
  tags: string[]                // ["cooperation", "policy-test"]
}
```

## ExperimentRun

Single execution of an experiment:

```typescript
{
  id: string                    // UUID
  experiment_id: string         // Parent experiment
  run_number: number            // 1, 2, 3...
  status: "pending" | "running" | "completed" | "failed"

  // Snapshot of config at execution time
  config_snapshot: object       // Copy of experiment.config

  // Tournament results
  results?: {
    rankings: Array<{
      rank: number
      strategy: string
      score: number
      cooperation_rate: number
    }>
    winner: string
    total_matches: number
  }

  // Error info if failed
  error?: {
    message: string
    timestamp: string
  }

  started_at: string
  completed_at?: string
  duration_seconds?: number
}
```

## ExperimentAnalysis

Aggregated statistics (computed on-demand):

```typescript
{
  experiment_id: string
  total_runs: number
  successful_runs: number
  failed_runs: number

  // Metrics across all successful runs
  metrics: {
    cooperation_rate: {
      mean: number
      std: number
      confidence_interval_95: [number, number]
    }
    score: {
      mean: number
      std: number
      confidence_interval_95: [number, number]
    }
  }

  // Per-strategy breakdown
  by_strategy: {
    [strategy_name: string]: {
      mean_score: number
      mean_cooperation_rate: number
      wins: number              // Times this strategy won
    }
  }

  computed_at: string
}
```

## Redis Keys

```
experiment:{id}                    → Experiment JSON
experiment:{id}:runs               → Sorted set of run IDs (scored by run_number)
experiment_run:{id}                → Run JSON
experiments:index                  → Set of all experiment IDs
experiments:by_status:{status}     → Set for filtering
experiments:by_tag:{tag}           → Set for tag-based filtering
```

## Status Transitions

```
Experiment:
  draft → running → completed
                 → failed

Run:
  pending → running → completed
                   → failed
```

## Notes

- **No delete**: Experiments are immutable research records
- **Config snapshot**: Each run stores config to handle experiment edits
- **Computed analysis**: Not stored, calculated from runs on demand
- **Timestamps**: All in ISO 8601 format
