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
