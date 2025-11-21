"""
In-memory implementations of storage repositories

Fallback implementation for development or when Redis is not available.
"""

from typing import List, Optional, Dict
from datetime import datetime
from .base import PolicyRepository, ExperimentRepository, ExperimentRunRepository


class InMemoryPolicyRepository(PolicyRepository):
    """
    In-memory policy repository

    Stores policies in a dictionary. Data is lost on restart.
    Useful for development and testing.
    """

    def __init__(self):
        """Initialize in-memory storage"""
        self._policies: Dict[str, Dict] = {}

    async def create(
        self,
        policy_id: str,
        name: str,
        text: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict:
        """
        Create a new policy in memory

        Args:
            policy_id: Unique policy identifier
            name: Human-readable policy name
            text: Policy text to be applied to system prompt
            description: Optional policy description
            tags: Optional list of tags

        Returns:
            Created policy dict
        """
        policy = {
            "id": policy_id,
            "name": name,
            "text": text,
            "description": description or "",
            "tags": tags or [],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        self._policies[policy_id] = policy
        return policy

    async def get(self, policy_id: str) -> Optional[Dict]:
        """
        Get policy by ID

        Args:
            policy_id: Policy identifier

        Returns:
            Policy dict or None if not found
        """
        return self._policies.get(policy_id)

    async def list_all(self) -> List[Dict]:
        """
        List all policies

        Returns:
            List of policy dicts, sorted by creation date (newest first)
        """
        policies = list(self._policies.values())
        policies.sort(key=lambda p: p.get("created_at", ""), reverse=True)
        return policies

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
        policy = self._policies.get(policy_id)
        if not policy:
            return None

        # Update fields
        if name is not None:
            policy["name"] = name
        if text is not None:
            policy["text"] = text
        if description is not None:
            policy["description"] = description
        if tags is not None:
            policy["tags"] = tags

        policy["updated_at"] = datetime.utcnow().isoformat()

        return policy

    async def delete(self, policy_id: str) -> bool:
        """
        Delete a policy

        Args:
            policy_id: Policy identifier

        Returns:
            True if deleted, False if not found
        """
        if policy_id in self._policies:
            del self._policies[policy_id]
            return True
        return False

    async def exists(self, policy_id: str) -> bool:
        """
        Check if policy exists

        Args:
            policy_id: Policy identifier

        Returns:
            True if exists, False otherwise
        """
        return policy_id in self._policies


class InMemoryExperimentRepository(ExperimentRepository):
    """
    In-memory experiment repository

    Stores experiments in a dictionary. Data is lost on restart.
    """

    def __init__(self):
        """Initialize in-memory storage"""
        self._experiments: Dict[str, Dict] = {}

    async def create(
        self,
        experiment_id: str,
        name: str,
        hypothesis: str,
        config: Dict,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict:
        """Create a new experiment"""
        experiment = {
            "id": experiment_id,
            "name": name,
            "hypothesis": hypothesis,
            "config": config,
            "description": description or "",
            "tags": tags or [],
            "status": "draft",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        self._experiments[experiment_id] = experiment
        return experiment

    async def get(self, experiment_id: str) -> Optional[Dict]:
        """Get experiment by ID"""
        return self._experiments.get(experiment_id)

    async def list_all(
        self,
        status: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[Dict]:
        """List experiments with optional filtering"""
        experiments = list(self._experiments.values())

        # Filter by status
        if status:
            experiments = [e for e in experiments if e["status"] == status]

        # Filter by tags (match any)
        if tags:
            experiments = [
                e for e in experiments
                if any(tag in e["tags"] for tag in tags)
            ]

        # Sort by creation date (newest first)
        experiments.sort(key=lambda e: e.get("created_at", ""), reverse=True)

        return experiments

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
        """Update an existing experiment"""
        experiment = self._experiments.get(experiment_id)
        if not experiment:
            return None

        # Update fields
        if name is not None:
            experiment["name"] = name
        if hypothesis is not None:
            experiment["hypothesis"] = hypothesis
        if config is not None:
            experiment["config"] = config
        if description is not None:
            experiment["description"] = description
        if tags is not None:
            experiment["tags"] = tags
        if status is not None:
            experiment["status"] = status

        experiment["updated_at"] = datetime.utcnow().isoformat()

        return experiment

    async def exists(self, experiment_id: str) -> bool:
        """Check if experiment exists"""
        return experiment_id in self._experiments


class InMemoryExperimentRunRepository(ExperimentRunRepository):
    """
    In-memory experiment run repository

    Stores runs in a dictionary. Data is lost on restart.
    """

    def __init__(self):
        """Initialize in-memory storage"""
        self._runs: Dict[str, Dict] = {}
        self._experiment_runs: Dict[str, List[str]] = {}  # experiment_id -> list of run_ids

    async def create(
        self,
        run_id: str,
        experiment_id: str,
        run_number: int,
        config_snapshot: Dict
    ) -> Dict:
        """Create a new experiment run"""
        run = {
            "id": run_id,
            "experiment_id": experiment_id,
            "run_number": run_number,
            "status": "pending",
            "config_snapshot": config_snapshot,
            "results": None,
            "error": None,
            "started_at": datetime.utcnow().isoformat(),
            "completed_at": None,
            "duration_seconds": None
        }

        self._runs[run_id] = run

        # Add to experiment's run list
        if experiment_id not in self._experiment_runs:
            self._experiment_runs[experiment_id] = []
        self._experiment_runs[experiment_id].append(run_id)

        return run

    async def get(self, run_id: str) -> Optional[Dict]:
        """Get run by ID"""
        return self._runs.get(run_id)

    async def list_by_experiment(self, experiment_id: str) -> List[Dict]:
        """List all runs for an experiment, sorted by run_number"""
        run_ids = self._experiment_runs.get(experiment_id, [])

        runs = [self._runs[run_id] for run_id in run_ids if run_id in self._runs]

        # Sort by run_number
        runs.sort(key=lambda r: r["run_number"])

        return runs

    async def update_status(
        self,
        run_id: str,
        status: str,
        results: Optional[Dict] = None,
        error: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Update run status and results"""
        run = self._runs.get(run_id)
        if not run:
            return None

        # Update fields
        run["status"] = status

        if results is not None:
            run["results"] = results

        if error is not None:
            run["error"] = error

        # Update completion time if completed or failed
        if status in ["completed", "failed"]:
            run["completed_at"] = datetime.utcnow().isoformat()

            # Calculate duration
            started = datetime.fromisoformat(run["started_at"])
            completed = datetime.utcnow()
            run["duration_seconds"] = (completed - started).total_seconds()

        return run

    async def get_run_count(self, experiment_id: str) -> int:
        """Count runs for an experiment"""
        return len(self._experiment_runs.get(experiment_id, []))
