"""
Policy management endpoints
"""

import uuid
from fastapi import APIRouter, HTTPException
from ..models.policy_schemas import (
    PolicyCreate,
    PolicyUpdate,
    Policy,
    PolicyList
)
from ..services.policy_service import policy_service

router = APIRouter(prefix="/policies", tags=["Policies"])


@router.get("/", response_model=PolicyList)
async def list_policies():
    """
    List all LLM strategy policies

    Returns all stored policies that can be applied to LLM action generation.
    """
    policies = await policy_service.list_all()

    return PolicyList(
        policies=[Policy(**p) for p in policies],
        total=len(policies)
    )


@router.get("/{policy_id}", response_model=Policy)
async def get_policy(policy_id: str):
    """
    Get a specific policy by ID

    Args:
        policy_id: Policy identifier

    Returns:
        Policy details

    Raises:
        HTTPException: 404 if policy not found
    """
    policy = await policy_service.get(policy_id)

    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy '{policy_id}' not found")

    return Policy(**policy)


@router.post("/", response_model=Policy, status_code=201)
async def create_policy(request: PolicyCreate):
    """
    Create a new LLM strategy policy

    Policies modify the LLM's behavior by appending instructions to the system prompt.

    Example policy text:
    - "Always prioritize long-term cooperation over short-term gains"
    - "Defect if opponent has defected more than 30% of the time"
    - "Use a forgiving strategy - forgive single defections but punish patterns"

    Args:
        request: Policy creation request

    Returns:
        Created policy
    """
    # Generate unique policy ID
    policy_id = str(uuid.uuid4())

    policy = await policy_service.create(
        policy_id=policy_id,
        name=request.name,
        text=request.text,
        description=request.description,
        tags=request.tags
    )

    return Policy(**policy)


@router.put("/{policy_id}", response_model=Policy)
async def update_policy(policy_id: str, request: PolicyUpdate):
    """
    Update an existing policy

    Args:
        policy_id: Policy identifier
        request: Policy update request

    Returns:
        Updated policy

    Raises:
        HTTPException: 404 if policy not found
    """
    policy = await policy_service.update(
        policy_id=policy_id,
        name=request.name,
        text=request.text,
        description=request.description,
        tags=request.tags
    )

    if not policy:
        raise HTTPException(status_code=404, detail=f"Policy '{policy_id}' not found")

    return Policy(**policy)


@router.delete("/{policy_id}", status_code=204)
async def delete_policy(policy_id: str):
    """
    Delete a policy

    Args:
        policy_id: Policy identifier

    Raises:
        HTTPException: 404 if policy not found
    """
    deleted = await policy_service.delete(policy_id)

    if not deleted:
        raise HTTPException(status_code=404, detail=f"Policy '{policy_id}' not found")
