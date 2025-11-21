"""
Pydantic schemas for LLM strategy policies
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime


class PolicyBase(BaseModel):
    """Base policy fields"""
    name: str = Field(..., min_length=1, max_length=100, description="Policy name")
    text: str = Field(..., min_length=1, max_length=2000, description="Policy text")
    description: Optional[str] = Field(None, max_length=500, description="Policy description")
    tags: List[str] = Field(default_factory=list, description="Policy tags")


class PolicyCreate(PolicyBase):
    """Request to create a policy"""
    pass


class PolicyUpdate(BaseModel):
    """Request to update a policy"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    text: Optional[str] = Field(None, min_length=1, max_length=2000)
    description: Optional[str] = Field(None, max_length=500)
    tags: Optional[List[str]] = None


class Policy(PolicyBase):
    """Full policy response"""
    id: str = Field(..., description="Policy ID")
    created_at: str = Field(..., description="Creation timestamp (ISO format)")
    updated_at: str = Field(..., description="Last update timestamp (ISO format)")

    class Config:
        from_attributes = True


class PolicyList(BaseModel):
    """List of policies"""
    policies: List[Policy]
    total: int = Field(..., description="Total number of policies")
