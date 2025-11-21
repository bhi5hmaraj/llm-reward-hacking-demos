"""
Experiment management endpoints
"""

import uuid
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from ..core.logging import get_logger
from ..models.experiment_schemas import (
    ExperimentCreate,
    ExperimentUpdate,
    Experiment,
    ExperimentList,
    ExperimentRunCreate,
    ExperimentRun,
    ExperimentRunList
)
from ..services.experiment_service import experiment_service
from ..workers.experiment_worker import execute_experiment_run, execute_experiment_batch

router = APIRouter(prefix="/experiments", tags=["Experiments"])
logger = get_logger(__name__, level=logging.DEBUG)


@router.post("/", response_model=Experiment, status_code=201)
async def create_experiment(request: ExperimentCreate):
    """
    Create a new experiment

    Creates a permanent research record with hypothesis and configuration.
    Experiments start in 'draft' status.

    **Example**:
    ```json
    {
      "name": "Policy X Impact",
      "hypothesis": "Policy X increases cooperation by 20% vs TitForTat",
      "config": {
        "llm_strategy": {
          "provider": "openai",
          "model": "gpt-4",
          "policy_id": "uuid-of-policy"
        },
        "classical_strategies": ["TitForTat", "Pavlov"],
        "turns": 200,
        "repetitions": 10,
        "target_runs": 30
      },
      "tags": ["cooperation", "policy-test"]
    }
    ```
    """
    # Generate unique experiment ID
    experiment_id = str(uuid.uuid4())

    experiment = await experiment_service.create_experiment(
        experiment_id=experiment_id,
        name=request.name,
        hypothesis=request.hypothesis,
        config=request.config.dict(),
        description=request.description,
        tags=request.tags
    )

    return Experiment(**experiment)


@router.get("/", response_model=ExperimentList)
async def list_experiments(
    status: Optional[str] = Query(None, description="Filter by status (draft, running, completed, failed)"),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated, match any)")
):
    """
    List all experiments

    Optional filters:
    - **status**: Filter by status (draft, running, completed, failed)
    - **tags**: Filter by tags (comma-separated, match any)

    Returns experiments sorted by creation date (newest first).
    """
    # Parse tags if provided
    tag_list = tags.split(',') if tags else None

    experiments = await experiment_service.list_experiments(
        status=status,
        tags=tag_list
    )

    return ExperimentList(
        experiments=[Experiment(**e) for e in experiments],
        total=len(experiments)
    )


@router.get("/{experiment_id}", response_model=Experiment)
async def get_experiment(experiment_id: str):
    """
    Get a specific experiment by ID

    Returns full experiment details including configuration and status.
    """
    experiment = await experiment_service.get_experiment(experiment_id)

    if not experiment:
        raise HTTPException(
            status_code=404,
            detail=f"Experiment '{experiment_id}' not found"
        )

    return Experiment(**experiment)


@router.put("/{experiment_id}", response_model=Experiment)
async def update_experiment(experiment_id: str, request: ExperimentUpdate):
    """
    Update an existing experiment

    Can update name, hypothesis, config, description, tags, and status.

    **Note**: Only experiments in 'draft' status should typically be edited.
    Status changes are used to mark experiments as running, completed, or failed.
    """
    # Build update dict (only include non-None fields)
    update_data = {}
    if request.name is not None:
        update_data['name'] = request.name
    if request.hypothesis is not None:
        update_data['hypothesis'] = request.hypothesis
    if request.config is not None:
        update_data['config'] = request.config.dict()
    if request.description is not None:
        update_data['description'] = request.description
    if request.tags is not None:
        update_data['tags'] = request.tags
    if request.status is not None:
        update_data['status'] = request.status

    experiment = await experiment_service.update_experiment(
        experiment_id=experiment_id,
        **update_data
    )

    if not experiment:
        raise HTTPException(
            status_code=404,
            detail=f"Experiment '{experiment_id}' not found"
        )

    return Experiment(**experiment)


@router.post("/{experiment_id}/runs", response_model=ExperimentRunList, status_code=201)
async def create_experiment_runs(
    experiment_id: str,
    request: ExperimentRunCreate
):
    """
    Create experiment run(s)

    Creates one or more runs of the experiment. Each run executes the
    experiment configuration independently for statistical validity.

    **count**: Number of runs to create (default: 1, max: 100)

    Returns the created runs in 'pending' status. Use a separate endpoint
    to actually execute the runs.
    """
    # Get experiment to ensure it exists and get config
    experiment = await experiment_service.get_experiment(experiment_id)

    if not experiment:
        raise HTTPException(
            status_code=404,
            detail=f"Experiment '{experiment_id}' not found"
        )

    # Create runs
    runs = []
    for _ in range(request.count):
        run_id = str(uuid.uuid4())

        run = await experiment_service.create_run(
            run_id=run_id,
            experiment_id=experiment_id,
            config_snapshot=experiment["config"]
        )

        runs.append(ExperimentRun(**run))

    return ExperimentRunList(
        runs=runs,
        total=len(runs)
    )


@router.get("/{experiment_id}/runs", response_model=ExperimentRunList)
async def list_experiment_runs(experiment_id: str):
    """
    List all runs for an experiment

    Returns runs sorted by run_number (chronological order).
    """
    # Verify experiment exists
    experiment = await experiment_service.get_experiment(experiment_id)

    if not experiment:
        raise HTTPException(
            status_code=404,
            detail=f"Experiment '{experiment_id}' not found"
        )

    runs = await experiment_service.list_runs(experiment_id)

    return ExperimentRunList(
        runs=[ExperimentRun(**r) for r in runs],
        total=len(runs)
    )


@router.get("/{experiment_id}/runs/{run_id}", response_model=ExperimentRun)
async def get_experiment_run(experiment_id: str, run_id: str):
    """
    Get a specific experiment run by ID

    Returns full run details including status, config snapshot, and results.
    """
    run = await experiment_service.get_run(run_id)

    if not run:
        raise HTTPException(
            status_code=404,
            detail=f"Run '{run_id}' not found"
        )

    # Verify run belongs to experiment
    if run["experiment_id"] != experiment_id:
        raise HTTPException(
            status_code=404,
            detail=f"Run '{run_id}' does not belong to experiment '{experiment_id}'"
        )

    return ExperimentRun(**run)


@router.post("/{experiment_id}/runs/{run_id}/execute")
async def execute_run(
    experiment_id: str,
    run_id: str,
    background_tasks: BackgroundTasks
):
    """
    Execute an experiment run in the background

    Queues the run for async execution. The run must be in 'pending' status.
    Use GET /experiments/{experiment_id}/runs/{run_id} to poll for completion.

    **Flow**:
    1. Validates run exists and is pending
    2. Queues execution task
    3. Returns immediately with "queued" message
    4. Background worker executes tournament
    5. Run status updates to "running" → "completed"/"failed"

    **Status Polling**:
    ```
    GET /experiments/{experiment_id}/runs/{run_id}
    ```

    Returns run status and results when completed.
    """
    logger.info(f"[API] Execute run request: experiment_id={experiment_id}, run_id={run_id}")

    # Verify experiment exists
    experiment = await experiment_service.get_experiment(experiment_id)
    if not experiment:
        logger.warning(f"[API] Experiment not found: {experiment_id}")
        raise HTTPException(
            status_code=404,
            detail=f"Experiment '{experiment_id}' not found"
        )

    # Verify run exists
    run = await experiment_service.get_run(run_id)
    if not run:
        logger.warning(f"[API] Run not found: {run_id}")
        raise HTTPException(
            status_code=404,
            detail=f"Run '{run_id}' not found"
        )

    # Verify run belongs to experiment
    if run["experiment_id"] != experiment_id:
        logger.warning(f"[API] Run {run_id} does not belong to experiment {experiment_id}")
        raise HTTPException(
            status_code=404,
            detail=f"Run '{run_id}' does not belong to experiment '{experiment_id}'"
        )

    # Verify run is in pending status
    if run["status"] != "pending":
        logger.warning(f"[API] Run {run_id} is already {run['status']}, cannot execute")
        raise HTTPException(
            status_code=400,
            detail=f"Run is already {run['status']}. Only pending runs can be executed."
        )

    # Queue background task
    logger.info(f"[API] Queueing background task for run: {run_id}")
    background_tasks.add_task(execute_experiment_run, run_id)
    logger.debug(f"[API] Background task queued successfully for run: {run_id}")

    return {
        "message": "Execution queued",
        "run_id": run_id,
        "experiment_id": experiment_id,
        "status": "queued"
    }


@router.post("/{experiment_id}/execute")
async def execute_all_runs(
    experiment_id: str,
    background_tasks: BackgroundTasks
):
    """
    Execute all pending runs for an experiment

    Convenience endpoint that queues all pending runs for the experiment.
    Each run is queued as a separate background task for concurrent execution.

    **Example**:
    ```bash
    # Create experiment and runs
    exp_id=$(curl -X POST /experiments -d '{...}' | jq -r '.id')
    curl -X POST /experiments/$exp_id/runs?count=30

    # Execute all runs
    curl -X POST /experiments/$exp_id/execute
    ```

    **Monitoring Progress**:
    ```bash
    # Get all runs to check status
    curl /experiments/$exp_id/runs
    ```

    Returns count of queued runs.
    """
    logger.info(f"[API] Execute all runs request: experiment_id={experiment_id}")

    # Verify experiment exists
    experiment = await experiment_service.get_experiment(experiment_id)
    if not experiment:
        logger.warning(f"[API] Experiment not found: {experiment_id}")
        raise HTTPException(
            status_code=404,
            detail=f"Experiment '{experiment_id}' not found"
        )

    # Get all runs
    runs = await experiment_service.list_runs(experiment_id)
    logger.debug(f"[API] Found {len(runs)} total runs for experiment {experiment_id}")

    # Filter for pending runs
    pending_runs = [r for r in runs if r["status"] == "pending"]
    logger.info(f"[API] Found {len(pending_runs)} pending runs to execute")

    if not pending_runs:
        logger.info(f"[API] No pending runs to execute for experiment {experiment_id}")
        return {
            "message": "No pending runs to execute",
            "experiment_id": experiment_id,
            "pending_count": 0
        }

    # Queue each run as separate background task
    # This allows concurrent execution
    logger.info(f"[API] Queueing {len(pending_runs)} runs for concurrent execution")
    for run in pending_runs:
        background_tasks.add_task(execute_experiment_run, run["id"])
        logger.debug(f"[API] Queued run: {run['id']}")

    logger.info(f"[API] Successfully queued {len(pending_runs)} runs")
    return {
        "message": f"Queued {len(pending_runs)} runs for execution",
        "experiment_id": experiment_id,
        "queued_count": len(pending_runs),
        "run_ids": [r["id"] for r in pending_runs]
    }
