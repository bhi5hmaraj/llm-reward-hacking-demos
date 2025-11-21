# Background Execution Design

**Async tournament execution with FastAPI BackgroundTasks**

## Problem

Currently, experiment runs are created but not executed. Running tournaments synchronously in API endpoints would:
- Block the API thread for minutes during execution
- Timeout on long-running tournaments (>30 seconds)
- Prevent concurrent requests
- Poor user experience

**Need**: Async background execution.

## Solution: FastAPI BackgroundTasks

Use FastAPI's built-in `BackgroundTasks` for simple, dependency-free async execution.

### Why This Approach?

**Pros**:
- ✅ Built into FastAPI - zero new dependencies
- ✅ Simple to implement - ~50 lines of code
- ✅ Good for single-server deployments
- ✅ Sufficient for research/non-production use
- ✅ Easy to upgrade later if needed

**Cons**:
- ❌ Tasks lost on server restart (acceptable for research)
- ❌ No distributed execution (not needed yet)
- ❌ No built-in retry logic (can add if needed)

**When to upgrade**: If you need persistent queues or distributed workers, migrate to RQ or multiprocessing.Pool.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Frontend)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                    POST /experiments/{id}/runs/{run_id}/execute
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Endpoint                              │
│  1. Validate run status (must be "pending")                 │
│  2. Queue task with BackgroundTasks                         │
│  3. Return immediately with "queued" status                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ background_tasks.add_task()
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Background Worker Function                    │
│  execute_experiment_run(run_id)                             │
│                                                              │
│  1. Update run status → "running"                           │
│  2. Load config from run record                             │
│  3. Execute tournament                                      │
│     - Classical strategies: AxelrodService                  │
│     - LLM strategies: LLMStrategyService                    │
│  4. Store results in run record                             │
│  5. Update run status → "completed" or "failed"             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                        Redis/In-Memory
                    (Run results stored)
```

## Integration Points

### 1. New Endpoint

```
POST /experiments/{id}/runs/{run_id}/execute
```

**Request**: None
**Response**: `{"message": "Execution queued", "run_id": "..."}`

**Validation**:
- Run must exist
- Run must be in "pending" status
- Experiment must exist

### 2. Worker Function

New file: `app/workers/experiment_worker.py`

**Responsibilities**:
- Load run config
- Execute tournament using existing services
- Handle LLM vs classical strategy matches
- Store results and errors
- Update run status

**Services Used**:
- `ExperimentService` - Get/update run
- `AxelrodService` - Run tournaments
- `LLMStrategyService` - Generate LLM actions (future)
- `PolicyService` - Apply policies (future)

### 3. Status Tracking

Run status flow:
```
pending → running → completed
                 → failed
```

Experiment status (auto-updated):
```
draft → running (when first run starts)
      → completed (when all runs finish)
```

## API Flow

### Creating and Executing Runs

```
1. Create experiment
   POST /experiments
   → Returns experiment_id

2. Create runs
   POST /experiments/{id}/runs?count=30
   → Returns 30 runs in "pending" status

3. Execute runs (one at a time or batched)
   POST /experiments/{id}/runs/{run_id}/execute
   → Returns immediately "queued"

   (Or batch execute all pending runs)
   POST /experiments/{id}/execute
   → Queues all pending runs

4. Poll for completion
   GET /experiments/{id}/runs/{run_id}
   → Check status field

5. Get results
   GET /experiments/{id}/analysis
   → Aggregated stats from all completed runs
```

## Implementation Sketch

### API Endpoint

```python
# app/api/experiments.py
from fastapi import BackgroundTasks

@router.post("/{experiment_id}/runs/{run_id}/execute")
async def execute_run(
    experiment_id: str,
    run_id: str,
    background_tasks: BackgroundTasks
):
    # Validate
    run = await experiment_service.get_run(run_id)
    if not run or run["status"] != "pending":
        raise HTTPException(400, "Invalid run")

    # Queue background task
    background_tasks.add_task(execute_experiment_run, run_id)

    return {"message": "Execution queued", "run_id": run_id}
```

### Worker Function

```python
# app/workers/experiment_worker.py
async def execute_experiment_run(run_id: str):
    # Update status
    await experiment_service.update_run_status(run_id, "running")

    try:
        # Load config
        run = await experiment_service.get_run(run_id)
        config = run["config_snapshot"]

        # Execute tournament
        results = await run_tournament(config)

        # Store results
        await experiment_service.update_run_status(
            run_id, "completed", results=results
        )

    except Exception as e:
        # Store error
        await experiment_service.update_run_status(
            run_id, "failed", error={"message": str(e)}
        )
```

### Tournament Execution

```python
async def run_tournament(config: Dict) -> Dict:
    strategies = config.get("classical_strategies", [])

    # Add LLM strategy if configured
    if "llm_strategy" in config:
        # Future: Custom LLM player
        pass

    # Run using existing service
    results = axelrod_service.run_tournament(
        strategy_names=strategies,
        turns=config["turns"],
        repetitions=config["repetitions"]
    )

    return results
```

## Monitoring Progress

### Option 1: Polling (Simple)

Frontend polls run status:
```javascript
async function waitForCompletion(runId) {
  while (true) {
    const run = await fetch(`/experiments/{id}/runs/${runId}`)
    if (run.status === 'completed' || run.status === 'failed') {
      return run
    }
    await sleep(2000)  // Poll every 2 seconds
  }
}
```

### Option 2: Batch Status Check

```
GET /experiments/{id}/runs?status=running
```
Returns all running runs for progress tracking.

### Option 3: WebSockets (Future)

Real-time updates when run completes. See `future-improvements.md`.

## Error Handling

### Graceful Failures

- Catch all exceptions in worker
- Store error message and traceback
- Mark run as "failed"
- Experiment status remains accurate (counts failures)

### Retry Logic (Future)

If needed, add simple retry:
```python
for attempt in range(3):
    try:
        await execute_experiment_run(run_id)
        break
    except Exception:
        if attempt == 2:
            raise
        await asyncio.sleep(5 ** attempt)
```

## Limitations & Upgrades

### Current Limitations

1. **Not persistent** - Tasks lost on server restart
2. **Single server** - No distributed execution
3. **No priority** - FIFO execution

### When to Upgrade

**Migrate to RQ (Redis Queue) if**:
- Need persistent task queue
- Want retry logic
- Need task prioritization
- Running multiple servers

**Migrate to multiprocessing.Pool if**:
- Need true parallel execution
- Have multi-core server
- CPU-bound bottleneck

## Testing

### Manual Testing

```bash
# 1. Create experiment
curl -X POST http://localhost:8000/experiments \
  -H "Content-Type: application/json" \
  -d '{...}'

# 2. Create runs
curl -X POST http://localhost:8000/experiments/{id}/runs?count=3

# 3. Execute a run
curl -X POST http://localhost:8000/experiments/{id}/runs/{run_id}/execute

# 4. Check status
curl http://localhost:8000/experiments/{id}/runs/{run_id}
```

### Unit Tests

```python
# Test worker function
async def test_execute_run():
    run_id = await create_test_run()
    await execute_experiment_run(run_id)
    run = await experiment_service.get_run(run_id)
    assert run["status"] == "completed"
    assert run["results"] is not None
```

## Files to Create/Modify

**New**:
- `app/workers/__init__.py`
- `app/workers/experiment_worker.py` - Worker functions

**Modified**:
- `app/api/experiments.py` - Add execute endpoint
- `app/services/experiment_service.py` - Helper methods if needed

**Future**:
- `app/workers/llm_tournament.py` - Custom LLM integration
- `app/workers/analysis.py` - Statistical analysis worker

## Deployment Notes

### Local Development

Works out of the box with `uvicorn`:
```bash
uvicorn app.main:app --reload
```

Tasks execute in the same process.

### Production

For production, consider:
- Upgrade to RQ for persistence
- Use separate worker processes
- Add monitoring (task duration, failure rates)

But for research/internal use, BackgroundTasks is sufficient!

## Next Steps

1. Implement worker function
2. Add execute endpoint
3. Test with simple tournament
4. Add batch execute endpoint
5. Frontend integration (poll status)

See also: `future-improvements.md` for enhancement ideas.
