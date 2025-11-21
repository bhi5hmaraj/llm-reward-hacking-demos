# Future Improvements

**Planned enhancements for Axiom**

## High Priority

### 1. Background Workers for Simulations

**Problem**: Currently runs execute synchronously in API thread, blocking requests during tournaments.

**Options** (ordered by simplicity):

#### Option A: FastAPI BackgroundTasks (Simplest)
```python
from fastapi import BackgroundTasks

@router.post("/{id}/runs/{run_id}/execute")
async def execute_run(run_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_tournament, run_id)
    return {"status": "queued"}
```

**Pros**:
- Built into FastAPI, zero dependencies
- Good for single-server deployments
- Simple to implement

**Cons**:
- Lost on server restart
- No distributed execution
- No retry logic

#### Option B: Python multiprocessing.Pool
```python
from multiprocessing import Pool

executor = Pool(processes=4)

async def execute_run(run_id: str):
    result = executor.apply_async(run_tournament, (run_id,))
    # Poll result.ready() for completion
```

**Pros**:
- True parallel execution
- CPU-bound work (tournaments) benefit from multiprocessing
- Built-in, no dependencies

**Cons**:
- More complex state management
- Serialization overhead

#### Option C: Simple Task Queue (redis-queue)
```python
from rq import Queue
from redis import Redis

redis_conn = Redis()
q = Queue(connection=redis_conn)

async def execute_run(run_id: str):
    job = q.enqueue(run_tournament, run_id)
    return job.id
```

**Pros**:
- Persistent queue (survives restarts)
- Simple retry logic
- Already using Redis

**Cons**:
- New dependency (rq)
- Need separate worker process

**Recommendation**: Start with **FastAPI BackgroundTasks** for simplicity, migrate to **multiprocessing.Pool** if parallel execution needed.

### 2. Experiment Run Execution

**Status**: Runs can be created but not executed yet.

**TODO**:
- Add `POST /experiments/{id}/runs/{run_id}/execute` endpoint
- Integrate with tournament service
- Handle LLM vs classical strategy matches
- Store results in run record
- Update experiment status (draft → running → completed)

### 3. Statistical Analysis

**Status**: No analysis endpoint yet.

**TODO**:
- Implement `GET /experiments/{id}/analysis`
- Aggregate stats across runs:
  - Mean, std, 95% confidence intervals
  - Per-strategy breakdown
  - Success/failure rates
- Add scipy for statistics (t-tests, effect sizes)

### 4. Experiment Comparison

**Status**: No comparison endpoint yet.

**TODO**:
- Implement `GET /experiments/compare?ids=x,y,z`
- Side-by-side analysis
- Statistical significance tests
- Visualizable output format

## Medium Priority

### 5. Frontend - Experiments UI

Components needed:
- Experiment list with cards
- Create/edit experiment form
- Run history table with progress
- Results visualization (charts)
- Analysis dashboard

### 6. Frontend - Policy Management UI

Components needed:
- Policy list view
- Create/edit policy modal
- Policy selector in LLM playground
- Apply policy when generating actions

### 7. Batch Execution with Progress

```python
POST /experiments/{id}/execute?runs=30

# Poll progress:
GET /experiments/{id}/progress
# Returns: {"completed": 15, "total": 30, "failed": 0}
```

### 8. Experiment Templates

Pre-configured experiment types:
- "Policy Impact Study"
- "Temperature Sensitivity Analysis"
- "LLM vs Classical Comparison"

Load template → customize → run

## Low Priority

### 9. WebSocket Updates

Real-time experiment progress:
```python
ws://localhost:8000/experiments/{id}/ws
# Streams: run started, run completed, analysis ready
```

### 10. Experiment Export

Export to CSV/JSON for external analysis:
```
GET /experiments/{id}/export?format=csv
```

### 11. Advanced Filtering

- Date range filters
- Search by hypothesis keywords
- Filter by config params
- Sort by cooperation rate, success rate

### 12. Experiment Validation

Before creating runs:
- Validate strategy names exist
- Validate LLM models available
- Check policy exists
- Estimate execution time

### 13. Rate Limiting

Protect LLM endpoints:
- Per-user rate limits
- Per-model rate limits
- Queue management

### 14. Experiment Cloning

```
POST /experiments/{id}/clone
```
Clone experiment with modifications for iteration.

## Code Quality

### Testing
- Unit tests for repositories
- Integration tests for API endpoints
- Mock LLM responses for testing

### Documentation
- API usage examples
- Tutorial: "Your First Experiment"
- Video walkthrough

### Performance
- Database indexing (if moving from Redis to Postgres)
- Caching for analysis results
- Pagination for large lists

## Implementation Order

**Phase 1** (Current Sprint):
1. Background workers
2. Run execution logic
3. Basic analysis endpoint

**Phase 2**:
4. Experiment comparison
5. Frontend experiments UI
6. Frontend policy UI

**Phase 3**:
7. Batch execution
8. Templates
9. Validation

**Phase 4**:
10. WebSockets
11. Export
12. Advanced features

## Worker Implementation Example

```python
# app/workers/experiment_worker.py
"""
Simple worker for experiment execution
Uses FastAPI BackgroundTasks initially
"""

import asyncio
from ..services.experiment_service import experiment_service
from ..services.axelrod_service import axelrod_service
from ..services.llm_strategy import llm_strategy_service

async def execute_experiment_run(run_id: str):
    """Execute a single experiment run"""

    # Get run details
    run = await experiment_service.get_run(run_id)
    if not run:
        return

    # Update status to running
    await experiment_service.update_run_status(run_id, "running")

    try:
        config = run["config_snapshot"]

        # Determine strategies
        strategies = config.get("classical_strategies", [])

        # If LLM strategy, add it
        if "llm_strategy" in config:
            strategies.append("LLM")  # Handled specially

        # Run tournament
        results = axelrod_service.run_tournament(
            strategy_names=strategies,
            turns=config.get("turns", 200),
            repetitions=config.get("repetitions", 10)
        )

        # Store results
        await experiment_service.update_run_status(
            run_id,
            "completed",
            results=results
        )

    except Exception as e:
        # Store error
        await experiment_service.update_run_status(
            run_id,
            "failed",
            error={"message": str(e)}
        )

# app/api/experiments.py
@router.post("/{experiment_id}/runs/{run_id}/execute")
async def execute_run(
    experiment_id: str,
    run_id: str,
    background_tasks: BackgroundTasks
):
    """Execute an experiment run in background"""

    # Verify run exists and is pending
    run = await experiment_service.get_run(run_id)
    if not run:
        raise HTTPException(404, "Run not found")

    if run["status"] != "pending":
        raise HTTPException(400, f"Run already {run['status']}")

    # Queue execution
    background_tasks.add_task(execute_experiment_run, run_id)

    return {"message": "Execution queued", "run_id": run_id}
```

## References

- [FastAPI BackgroundTasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Python multiprocessing](https://docs.python.org/3/library/multiprocessing.html)
- [RQ (Redis Queue)](https://python-rq.org/)
