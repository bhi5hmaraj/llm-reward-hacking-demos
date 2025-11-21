"""
Abstract storage interfaces

Follows SOLID principles:
- Interface Segregation: Clean, focused repository interfaces
- Dependency Inversion: Services depend on abstractions, not concrete storage
- Single Responsibility: Each repository manages one type of entity
"""

from abc import ABC, abstractmethod
from typing import List, Optional, Dict
from datetime import datetime


class PolicyRepository(ABC):
    """
    Abstract repository for LLM strategy policies

    Policies are text-based modifications to LLM behavior that can be
    applied to system prompts to tweak strategy generation.
    """

    @abstractmethod
    async def create(
        self,
        policy_id: str,
        name: str,
        text: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict:
        """
        Create a new policy

        Args:
            policy_id: Unique policy identifier
            name: Human-readable policy name
            text: Policy text to be applied to system prompt
            description: Optional policy description
            tags: Optional list of tags

        Returns:
            Created policy dict
        """
        pass

    @abstractmethod
    async def get(self, policy_id: str) -> Optional[Dict]:
        """
        Get policy by ID

        Args:
            policy_id: Policy identifier

        Returns:
            Policy dict or None if not found
        """
        pass

    @abstractmethod
    async def list_all(self) -> List[Dict]:
        """
        List all policies

        Returns:
            List of policy dicts
        """
        pass

    @abstractmethod
    async def update(
        self,
        policy_id: str,
        name: Optional[str] = None,
        text: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Optional[Dict]:
        """
        Update an existing policy

        Args:
            policy_id: Policy identifier
            name: New name (optional)
            text: New policy text (optional)
            description: New description (optional)
            tags: New tags (optional)

        Returns:
            Updated policy dict or None if not found
        """
        pass

    @abstractmethod
    async def delete(self, policy_id: str) -> bool:
        """
        Delete a policy

        Args:
            policy_id: Policy identifier

        Returns:
            True if deleted, False if not found
        """
        pass

    @abstractmethod
    async def exists(self, policy_id: str) -> bool:
        """
        Check if policy exists

        Args:
            policy_id: Policy identifier

        Returns:
            True if exists, False otherwise
        """
        pass


class ExperimentRepository(ABC):
    """
    Abstract repository for experiments

    Experiments are permanent research records (no delete).
    """

    @abstractmethod
    async def create(
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
        pass

    @abstractmethod
    async def get(self, experiment_id: str) -> Optional[Dict]:
        """
        Get experiment by ID

        Args:
            experiment_id: Experiment identifier

        Returns:
            Experiment dict or None if not found
        """
        pass

    @abstractmethod
    async def list_all(
        self,
        status: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[Dict]:
        """
        List experiments with optional filtering

        Args:
            status: Filter by status (draft, running, completed, failed)
            tags: Filter by tags (match any)

        Returns:
            List of experiment dicts
        """
        pass

    @abstractmethod
    async def update(
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
        pass

    @abstractmethod
    async def exists(self, experiment_id: str) -> bool:
        """
        Check if experiment exists

        Args:
            experiment_id: Experiment identifier

        Returns:
            True if exists, False otherwise
        """
        pass


class ExperimentRunRepository(ABC):
    """
    Abstract repository for experiment runs

    Each run is a single execution of an experiment.
    """

    @abstractmethod
    async def create(
        self,
        run_id: str,
        experiment_id: str,
        run_number: int,
        config_snapshot: Dict
    ) -> Dict:
        """
        Create a new experiment run

        Args:
            run_id: Unique run identifier
            experiment_id: Parent experiment ID
            run_number: Run sequence number
            config_snapshot: Snapshot of experiment config at run time

        Returns:
            Created run dict
        """
        pass

    @abstractmethod
    async def get(self, run_id: str) -> Optional[Dict]:
        """
        Get run by ID

        Args:
            run_id: Run identifier

        Returns:
            Run dict or None if not found
        """
        pass

    @abstractmethod
    async def list_by_experiment(self, experiment_id: str) -> List[Dict]:
        """
        List all runs for an experiment

        Args:
            experiment_id: Experiment identifier

        Returns:
            List of run dicts, sorted by run_number
        """
        pass

    @abstractmethod
    async def update_status(
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
            status: New status (pending, running, completed, failed)
            results: Tournament results (optional)
            error: Error info if failed (optional)

        Returns:
            Updated run dict or None if not found
        """
        pass

    @abstractmethod
    async def get_run_count(self, experiment_id: str) -> int:
        """
        Count runs for an experiment

        Args:
            experiment_id: Experiment identifier

        Returns:
            Number of runs
        """
        pass
