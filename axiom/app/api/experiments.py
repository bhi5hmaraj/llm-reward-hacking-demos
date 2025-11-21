"""
Experiment management endpoints
"""

import uuid
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
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

router = APIRouter(prefix="/experiments", tags=["Experiments"])


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
