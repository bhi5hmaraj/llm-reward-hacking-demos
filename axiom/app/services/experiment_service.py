"""
Experiment service

Orchestrates experiment management using repository abstraction.
Follows Dependency Inversion Principle.
"""

import os
from typing import List, Optional, Dict
from datetime import datetime
from ..storage import (
    ExperimentRepository,
    ExperimentRunRepository,
    InMemoryExperimentRepository,
    InMemoryExperimentRunRepository
)

# Try to use Redis if available
try:
    from ..storage import (
        RedisExperimentRepository,
        RedisExperimentRunRepository,
        REDIS_AVAILABLE
    )
except ImportError:
    REDIS_AVAILABLE = False


class ExperimentService:
    """
    Service for managing experiments

    Single Responsibility: Orchestrates experiment operations
    Dependency Inversion: Depends on ExperimentRepository abstractions
    """

    def __init__(
        self,
        experiment_repo: Optional[ExperimentRepository] = None,
        run_repo: Optional[ExperimentRunRepository] = None
    ):
        """
        Initialize service with repositories

        Args:
            experiment_repo: ExperimentRepository implementation
            run_repo: ExperimentRunRepository implementation
        """
        if experiment_repo and run_repo:
            self.experiment_repo = experiment_repo
            self.run_repo = run_repo
        else:
            # Auto-select repositories based on availability
            if REDIS_AVAILABLE and os.getenv('REDIS_URL'):
                self.experiment_repo = RedisExperimentRepository()
                self.run_repo = RedisExperimentRunRepository()
            else:
                # Fallback to in-memory
                self.experiment_repo = InMemoryExperimentRepository()
                self.run_repo = InMemoryExperimentRunRepository()

    async def create_experiment(
        self,
        experiment_id: str,
        name: str,
        hypothesis: str,
        config: Dict,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict:
        """
        Create a new experiment

        Args:
            experiment_id: Unique experiment identifier
            name: Experiment name
            hypothesis: Research hypothesis
            config: Experiment configuration
            description: Optional description
            tags: Optional tags

        Returns:
            Created experiment dict
        """
        return await self.experiment_repo.create(
            experiment_id=experiment_id,
            name=name,
            hypothesis=hypothesis,
            config=config,
            description=description,
            tags=tags
        )

    async def get_experiment(self, experiment_id: str) -> Optional[Dict]:
        """
        Get experiment by ID

        Args:
            experiment_id: Experiment identifier

        Returns:
            Experiment dict or None if not found
        """
        return await self.experiment_repo.get(experiment_id)

    async def list_experiments(
        self,
        status: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        List experiments with optional filtering

        Args:
            status: Filter by status
            tags: Filter by tags (match any)

        Returns:
            List of experiment dicts
        """
        return await self.experiment_repo.list_all(status=status, tags=tags)

    async def update_experiment(
        self,
        experiment_id: str,
        name: Optional[str] = None,
        hypothesis: Optional[str] = None,
        config: Optional[Dict] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None,
        status: Optional[str] = None
    ) -> Optional[Dict]:
        """
        Update an existing experiment

        Args:
            experiment_id: Experiment identifier
            name: New name (optional)
            hypothesis: New hypothesis (optional)
            config: New config (optional)
            description: New description (optional)
            tags: New tags (optional)
            status: New status (optional)

        Returns:
            Updated experiment dict or None if not found
        """
        return await self.experiment_repo.update(
            experiment_id=experiment_id,
            name=name,
            hypothesis=hypothesis,
            config=config,
            description=description,
            tags=tags,
            status=status
        )

    async def create_run(
        self,
        run_id: str,
        experiment_id: str,
        config_snapshot: Dict
    ) -> Dict:
        """
        Create a new experiment run

        Args:
            run_id: Unique run identifier
            experiment_id: Parent experiment ID
            config_snapshot: Snapshot of experiment config

        Returns:
            Created run dict
        """
        # Get next run number
        run_count = await self.run_repo.get_run_count(experiment_id)
        run_number = run_count + 1

        return await self.run_repo.create(
            run_id=run_id,
            experiment_id=experiment_id,
            run_number=run_number,
            config_snapshot=config_snapshot
        )

    async def get_run(self, run_id: str) -> Optional[Dict]:
        """
        Get run by ID

        Args:
            run_id: Run identifier

        Returns:
            Run dict or None if not found
        """
        return await self.run_repo.get(run_id)

    async def list_runs(self, experiment_id: str) -> List[Dict]:
        """
        List all runs for an experiment

        Args:
            experiment_id: Experiment identifier

        Returns:
            List of run dicts, sorted by run_number
        """
        return await self.run_repo.list_by_experiment(experiment_id)

    async def update_run_status(
        self,
        run_id: str,
        status: str,
        results: Optional[Dict] = None,
        error: Optional[Dict] = None
    ) -> Optional[Dict]:
        """
        Update run status and results

        Args:
            run_id: Run identifier
            status: New status
            results: Tournament results (optional)
            error: Error info (optional)

        Returns:
            Updated run dict or None if not found
        """
        return await self.run_repo.update_status(
            run_id=run_id,
            status=status,
            results=results,
            error=error
        )


# Singleton instance
experiment_service = ExperimentService()
