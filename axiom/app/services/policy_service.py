"""
Policy service

Orchestrates policy management using repository abstraction.
Follows Dependency Inversion Principle.
"""

import os
from typing import List, Optional, Dict
from ..storage import PolicyRepository, InMemoryPolicyRepository

# Try to use Redis if available
try:
    from ..storage import RedisPolicyRepository, REDIS_AVAILABLE
except ImportError:
    REDIS_AVAILABLE = False


class PolicyService:
    """
    Service for managing LLM strategy policies

    Single Responsibility: Orchestrates policy operations
    Dependency Inversion: Depends on PolicyRepository abstraction
    """

    def __init__(self, repository: Optional[PolicyRepository] = None):
        """
        Initialize service with repository

        Args:
            repository: PolicyRepository implementation
                       (defaults to Redis if available, otherwise in-memory)
        """
        if repository:
            self.repository = repository
        else:
            # Auto-select repository based on availability
            if REDIS_AVAILABLE and os.getenv('REDIS_URL'):
                self.repository = RedisPolicyRepository()
            else:
                # Fallback to in-memory
                self.repository = InMemoryPolicyRepository()

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
            text: Policy text to modify LLM behavior
            description: Optional description
            tags: Optional tags

        Returns:
            Created policy dict
        """
        return await self.repository.create(
            policy_id=policy_id,
            name=name,
            text=text,
            description=description,
            tags=tags
        )

    async def get(self, policy_id: str) -> Optional[Dict]:
        """
        Get policy by ID

        Args:
            policy_id: Policy identifier

        Returns:
            Policy dict or None if not found
        """
        return await self.repository.get(policy_id)

    async def list_all(self) -> List[Dict]:
        """
        List all policies

        Returns:
            List of policy dicts
        """
        return await self.repository.list_all()

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
            text: New text (optional)
            description: New description (optional)
            tags: New tags (optional)

        Returns:
            Updated policy dict or None if not found
        """
        return await self.repository.update(
            policy_id=policy_id,
            name=name,
            text=text,
            description=description,
            tags=tags
        )

    async def delete(self, policy_id: str) -> bool:
        """
        Delete a policy

        Args:
            policy_id: Policy identifier

        Returns:
            True if deleted, False if not found
        """
        return await self.repository.delete(policy_id)

    async def exists(self, policy_id: str) -> bool:
        """
        Check if policy exists

        Args:
            policy_id: Policy identifier

        Returns:
            True if exists, False otherwise
        """
        return await self.repository.exists(policy_id)

    def apply_policy(self, base_prompt: str, policy_text: str) -> str:
        """
        Apply policy to system prompt

        Appends policy text to the base system prompt.

        Args:
            base_prompt: Base system prompt
            policy_text: Policy modifications

        Returns:
            Modified system prompt with policy applied
        """
        return f"{base_prompt}\n\nADDITIONAL POLICY:\n{policy_text}"


# Singleton instance
policy_service = PolicyService()
