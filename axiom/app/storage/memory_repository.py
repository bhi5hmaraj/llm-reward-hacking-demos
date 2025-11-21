"""
In-memory implementation of PolicyRepository

Fallback implementation for development or when Redis is not available.
"""

from typing import List, Optional, Dict
from datetime import datetime
from .base import PolicyRepository


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
