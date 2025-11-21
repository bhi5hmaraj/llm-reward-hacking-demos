"""
Redis implementation of PolicyRepository

Uses Redis for fast, persistent storage of LLM strategy policies.
"""

import json
import os
from typing import List, Optional, Dict
from datetime import datetime
from .base import PolicyRepository

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
