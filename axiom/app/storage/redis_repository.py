"""
Redis implementations of storage repositories

Uses Redis for fast, persistent storage.
"""

import json
import os
from typing import List, Optional, Dict
from datetime import datetime
from .base import PolicyRepository, ExperimentRepository, ExperimentRunRepository

# Optional import - only load if Redis URL is available
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class RedisPolicyRepository(PolicyRepository):
    """
    Redis-based policy repository

    Stores policies as JSON in Redis with keys: policy:{policy_id}
    Maintains an index set: policies:index for listing all policies
    """

    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize Redis repository

        Args:
            redis_url: Redis connection URL (defaults to env REDIS_URL)

        Raises:
            RuntimeError: If Redis is not available
        """
        if not REDIS_AVAILABLE:
            raise RuntimeError("redis package not installed")

        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379')
        self._client: Optional[redis.Redis] = None

    async def _get_client(self) -> redis.Redis:
        """Get or create Redis client"""
        if self._client is None:
            self._client = redis.from_url(self.redis_url, decode_responses=True)
        return self._client

    def _policy_key(self, policy_id: str) -> str:
        """Generate Redis key for policy"""
        return f"policy:{policy_id}"

    def _index_key(self) -> str:
        """Redis key for policy index set"""
        return "policies:index"

    async def create(
        self,
        policy_id: str,
        name: str,
        text: str,
        description: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> Dict:
        """
        Create a new policy in Redis

        Args:
            policy_id: Unique policy identifier
            name: Human-readable policy name
            text: Policy text to be applied to system prompt
            description: Optional policy description
            tags: Optional list of tags

        Returns:
            Created policy dict
        """
        client = await self._get_client()

        policy = {
            "id": policy_id,
            "name": name,
            "text": text,
            "description": description or "",
            "tags": tags or [],
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }

        # Store policy as JSON
        key = self._policy_key(policy_id)
        await client.set(key, json.dumps(policy))

        # Add to index
        await client.sadd(self._index_key(), policy_id)

        return policy

    async def get(self, policy_id: str) -> Optional[Dict]:
        """
        Get policy by ID from Redis

        Args:
            policy_id: Policy identifier

        Returns:
            Policy dict or None if not found
        """
        client = await self._get_client()

        key = self._policy_key(policy_id)
        data = await client.get(key)

        if data:
            return json.loads(data)
        return None

    async def list_all(self) -> List[Dict]:
        """
        List all policies from Redis

        Returns:
            List of policy dicts
        """
        client = await self._get_client()

        # Get all policy IDs from index
        policy_ids = await client.smembers(self._index_key())

        # Fetch all policies
        policies = []
        for policy_id in policy_ids:
            policy = await self.get(policy_id)
            if policy:
                policies.append(policy)

        # Sort by creation date (newest first)
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
        Update an existing policy in Redis

        Args:
            policy_id: Policy identifier
            name: New name (optional)
            text: New policy text (optional)
            description: New description (optional)
            tags: New tags (optional)

        Returns:
            Updated policy dict or None if not found
        """
        client = await self._get_client()

        # Get existing policy
        policy = await self.get(policy_id)
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

        # Save updated policy
        key = self._policy_key(policy_id)
        await client.set(key, json.dumps(policy))

        return policy

    async def delete(self, policy_id: str) -> bool:
        """
        Delete a policy from Redis

        Args:
            policy_id: Policy identifier

        Returns:
            True if deleted, False if not found
        """
        client = await self._get_client()

        key = self._policy_key(policy_id)

        # Check if exists
        exists = await client.exists(key)
        if not exists:
            return False

        # Delete policy
        await client.delete(key)

        # Remove from index
        await client.srem(self._index_key(), policy_id)

        return True

    async def exists(self, policy_id: str) -> bool:
        """
        Check if policy exists in Redis

        Args:
            policy_id: Policy identifier

        Returns:
            True if exists, False otherwise
        """
        client = await self._get_client()

        key = self._policy_key(policy_id)
        return await client.exists(key) > 0

    async def close(self):
        """Close Redis connection"""
        if self._client:
            await self._client.close()


class RedisExperimentRepository(ExperimentRepository):
    """
    Redis-based experiment repository

    Stores experiments as JSON with keys: experiment:{id}
    Maintains indices for filtering by status and tags
    """

    def __init__(self, redis_url: Optional[str] = None):
        """Initialize Redis repository"""
        if not REDIS_AVAILABLE:
            raise RuntimeError("redis package not installed")

        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379')
        self._client: Optional[redis.Redis] = None

    async def _get_client(self) -> redis.Redis:
        """Get or create Redis client"""
        if self._client is None:
            self._client = redis.from_url(self.redis_url, decode_responses=True)
        return self._client

    def _experiment_key(self, experiment_id: str) -> str:
        """Generate Redis key for experiment"""
        return f"experiment:{experiment_id}"

    def _index_key(self) -> str:
        """Redis key for experiment index"""
        return "experiments:index"

    def _status_key(self, status: str) -> str:
        """Redis key for status index"""
        return f"experiments:by_status:{status}"

    def _tag_key(self, tag: str) -> str:
        """Redis key for tag index"""
        return f"experiments:by_tag:{tag}"

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
        client = await self._get_client()

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

        # Store experiment
        key = self._experiment_key(experiment_id)
        await client.set(key, json.dumps(experiment))

        # Add to indices
        await client.sadd(self._index_key(), experiment_id)
        await client.sadd(self._status_key("draft"), experiment_id)

        # Add to tag indices
        for tag in experiment["tags"]:
            await client.sadd(self._tag_key(tag), experiment_id)

        return experiment

    async def get(self, experiment_id: str) -> Optional[Dict]:
        """Get experiment by ID"""
        client = await self._get_client()

        key = self._experiment_key(experiment_id)
        data = await client.get(key)

        if data:
            return json.loads(data)
        return None

    async def list_all(
        self,
        status: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[Dict]:
        """List experiments with optional filtering"""
        client = await self._get_client()

        # Start with all experiments
        if status:
            # Filter by status
            experiment_ids = await client.smembers(self._status_key(status))
        elif tags:
            # Filter by tags (union - match any tag)
            keys = [self._tag_key(tag) for tag in tags]
            experiment_ids = await client.sunion(*keys)
        else:
            # All experiments
            experiment_ids = await client.smembers(self._index_key())

        # Fetch all experiments
        experiments = []
        for experiment_id in experiment_ids:
            experiment = await self.get(experiment_id)
            if experiment:
                experiments.append(experiment)

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
        client = await self._get_client()

        # Get existing experiment
        experiment = await self.get(experiment_id)
        if not experiment:
            return None

        # Track old status and tags for index updates
        old_status = experiment["status"]
        old_tags = experiment["tags"]

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

        # Save updated experiment
        key = self._experiment_key(experiment_id)
        await client.set(key, json.dumps(experiment))

        # Update status index if changed
        if status and status != old_status:
            await client.srem(self._status_key(old_status), experiment_id)
            await client.sadd(self._status_key(status), experiment_id)

        # Update tag indices if changed
        if tags is not None:
            # Remove from old tag indices
            for tag in old_tags:
                await client.srem(self._tag_key(tag), experiment_id)
            # Add to new tag indices
            for tag in tags:
                await client.sadd(self._tag_key(tag), experiment_id)

        return experiment

    async def exists(self, experiment_id: str) -> bool:
        """Check if experiment exists"""
        client = await self._get_client()
        key = self._experiment_key(experiment_id)
        return await client.exists(key) > 0

    async def close(self):
        """Close Redis connection"""
        if self._client:
            await self._client.close()


class RedisExperimentRunRepository(ExperimentRunRepository):
    """
    Redis-based experiment run repository

    Stores runs as JSON with keys: experiment_run:{id}
    Maintains sorted sets of runs per experiment
    """

    def __init__(self, redis_url: Optional[str] = None):
        """Initialize Redis repository"""
        if not REDIS_AVAILABLE:
            raise RuntimeError("redis package not installed")

        self.redis_url = redis_url or os.getenv('REDIS_URL', 'redis://localhost:6379')
        self._client: Optional[redis.Redis] = None

    async def _get_client(self) -> redis.Redis:
        """Get or create Redis client"""
        if self._client is None:
            self._client = redis.from_url(self.redis_url, decode_responses=True)
        return self._client

    def _run_key(self, run_id: str) -> str:
        """Generate Redis key for run"""
        return f"experiment_run:{run_id}"

    def _runs_key(self, experiment_id: str) -> str:
        """Redis key for experiment's runs (sorted set by run_number)"""
        return f"experiment:{experiment_id}:runs"

    async def create(
        self,
        run_id: str,
        experiment_id: str,
        run_number: int,
        config_snapshot: Dict
    ) -> Dict:
        """Create a new experiment run"""
        client = await self._get_client()

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

        # Store run
        key = self._run_key(run_id)
        await client.set(key, json.dumps(run))

        # Add to experiment's sorted set (scored by run_number)
        runs_key = self._runs_key(experiment_id)
        await client.zadd(runs_key, {run_id: run_number})

        return run

    async def get(self, run_id: str) -> Optional[Dict]:
        """Get run by ID"""
        client = await self._get_client()

        key = self._run_key(run_id)
        data = await client.get(key)

        if data:
            return json.loads(data)
        return None

    async def list_by_experiment(self, experiment_id: str) -> List[Dict]:
        """List all runs for an experiment, sorted by run_number"""
        client = await self._get_client()

        # Get run IDs from sorted set (ordered by run_number)
        runs_key = self._runs_key(experiment_id)
        run_ids = await client.zrange(runs_key, 0, -1)

        # Fetch all runs
        runs = []
        for run_id in run_ids:
            run = await self.get(run_id)
            if run:
                runs.append(run)

        return runs

    async def update_status(
        self,
        run_id: str,
        status: str,
        results: Optional[Dict] = None,
        error: Optional[Dict] = None
    ) -> Optional[Dict]:
        """Update run status and results"""
        client = await self._get_client()

        # Get existing run
        run = await self.get(run_id)
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

        # Save updated run
        key = self._run_key(run_id)
        await client.set(key, json.dumps(run))

        return run

    async def get_run_count(self, experiment_id: str) -> int:
        """Count runs for an experiment"""
        client = await self._get_client()

        runs_key = self._runs_key(experiment_id)
        return await client.zcard(runs_key)

    async def close(self):
        """Close Redis connection"""
        if self._client:
            await self._client.close()
