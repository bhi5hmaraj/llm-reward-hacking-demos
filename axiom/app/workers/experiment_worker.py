"""
Experiment execution worker

Background worker for executing experiment runs asynchronously.
Uses FastAPI BackgroundTasks for simple, dependency-free async execution.

Follows SOLID principles:
- Single Responsibility: Executes experiment runs
- Dependency Inversion: Depends on service abstractions via dependency injection
"""

import asyncio
import logging
from typing import Dict, Optional
from datetime import datetime
from ..core.logging import get_logger
from ..services.experiment_service import experiment_service, ExperimentService
from ..services.axelrod_service import axelrod_service, AxelrodService

# Configure logging
logger = get_logger(__name__, level=logging.DEBUG)


async def execute_experiment_run(
    run_id: str,
    experiment_svc: Optional[ExperimentService] = None,
    axelrod_svc: Optional[AxelrodService] = None
):
    """
    Execute a single experiment run in the background

    This worker function:
    1. Updates run status to "running"
    2. Loads configuration from run record
    3. Executes tournament using AxelrodService
    4. Stores results in run record
    5. Updates run status to "completed" or "failed"

    Args:
        run_id: Unique run identifier
        experiment_svc: ExperimentService instance (defaults to singleton)
        axelrod_svc: AxelrodService instance (defaults to singleton)

    Note:
        This function is designed to run in FastAPI BackgroundTasks.
        All exceptions are caught and stored in the run record.
    """
    logger.info(f"[WORKER] Starting execution for run_id: {run_id}")

    # Use singleton services if not provided (Dependency Injection)
    exp_service = experiment_svc or experiment_service
    axl_service = axelrod_svc or axelrod_service

    # Get run details
    logger.debug(f"[WORKER] Fetching run details for: {run_id}")
    run = await exp_service.get_run(run_id)
    if not run:
        # Run not found - this shouldn't happen, but handle gracefully
        logger.error(f"[WORKER] Run not found: {run_id}")
        return

    logger.info(f"[WORKER] Run found. Experiment ID: {run['experiment_id']}, Status: {run['status']}")

    # Update status to running
    logger.debug(f"[WORKER] Updating run status to 'running': {run_id}")
    await exp_service.update_run_status(run_id, "running")

    try:
        # Load configuration snapshot
        config = run["config_snapshot"]
        logger.debug(f"[WORKER] Loaded config: {config}")

        # Extract tournament parameters
        classical_strategies = config.get("classical_strategies", [])
        turns = config.get("turns", 200)
        repetitions = config.get("repetitions", 10)

        logger.info(f"[WORKER] Tournament params: strategies={classical_strategies}, turns={turns}, repetitions={repetitions}")

        # Note: LLM strategies not yet implemented in Phase 1
        # Future: Handle llm_strategy config when LLM integration complete
        if "llm_strategy" in config:
            # Placeholder for future LLM strategy integration
            # For now, just run with classical strategies
            logger.debug("[WORKER] LLM strategy in config (not yet implemented)")

        # Validate strategies exist
        if not classical_strategies:
            raise ValueError("No classical strategies specified in config")

        # Run tournament using AxelrodService
        logger.info(f"[WORKER] Starting tournament execution...")
        results = axl_service.run_tournament(
            strategy_names=classical_strategies,
            turns=turns,
            repetitions=repetitions
        )
        logger.info(f"[WORKER] Tournament completed. Results keys: {list(results.keys())}")

        # Store results and mark as completed
        logger.debug(f"[WORKER] Updating run status to 'completed': {run_id}")
        await exp_service.update_run_status(
            run_id=run_id,
            status="completed",
            results=results
        )
        logger.info(f"[WORKER] Run completed successfully: {run_id}")

    except Exception as e:
        # Store error and mark as failed
        logger.error(f"[WORKER] Run failed: {run_id}. Error: {type(e).__name__}: {str(e)}")
        error_info = {
            "message": str(e),
            "type": type(e).__name__,
            "timestamp": datetime.utcnow().isoformat()
        }

        await exp_service.update_run_status(
            run_id=run_id,
            status="failed",
            error=error_info
        )
        logger.debug(f"[WORKER] Run status updated to 'failed': {run_id}")


async def execute_experiment_batch(
    experiment_id: str,
    experiment_svc: Optional[ExperimentService] = None,
    axelrod_svc: Optional[AxelrodService] = None
):
    """
    Execute all pending runs for an experiment

    This is a convenience function for batch execution.
    Each run is executed sequentially (not in parallel).

    Args:
        experiment_id: Experiment identifier
        experiment_svc: ExperimentService instance (defaults to singleton)
        axelrod_svc: AxelrodService instance (defaults to singleton)

    Note:
        For true parallel execution, queue each run separately
        with FastAPI BackgroundTasks.
    """
    # Use singleton services if not provided
    exp_service = experiment_svc or experiment_service

    # Get all runs for this experiment
    runs = await exp_service.list_runs(experiment_id)

    # Filter for pending runs
    pending_runs = [r for r in runs if r["status"] == "pending"]

    # Execute each run sequentially
    for run in pending_runs:
        await execute_experiment_run(
            run_id=run["id"],
            experiment_svc=exp_service,
            axelrod_svc=axelrod_svc
        )
