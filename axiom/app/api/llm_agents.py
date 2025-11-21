"""
LLM-based strategy endpoints
"""

from fastapi import APIRouter, HTTPException
from ..models.llm_schemas import (
    LLMModelsResponse,
    LLMActionRequest,
    LLMActionResponse
)
from ..services.llm_strategy import llm_strategy_service
from ..services.policy_service import policy_service

router = APIRouter(prefix="/llm", tags=["LLM Agents"])


@router.get("/models", response_model=LLMModelsResponse)
async def list_llm_models():
    """
    List available LLM models

    Returns which LLM providers are configured and available.
    Requires API keys to be set in environment variables.
    """
    models = llm_strategy_service.get_available_models()

    return LLMModelsResponse(
        available=len(models) > 0,
        providers=models
    )


@router.post("/play", response_model=LLMActionResponse)
async def llm_play_action(request: LLMActionRequest):
    """
    Generate action using LLM

    The LLM will analyze the game history and generate a strategic action
    (Cooperate or Defect) with reasoning.

    Optionally apply a policy to modify the LLM's strategic behavior.

    Args:
        request: LLM configuration and game history

    Returns:
        Action with LLM's strategic reasoning

    Example:
        ```json
        {
          "provider": "openai",
          "model": "gpt-4",
          "history": [
            {"round": 1, "my_action": "C", "opponent_action": "D"}
          ],
          "policy_id": "uuid-of-policy",
          "temperature": 0.7
        }
        ```
    """
    try:
        system_prompt = request.system_prompt

        # Apply policy if specified
        if request.policy_id:
            policy = await policy_service.get(request.policy_id)
            if not policy:
                raise HTTPException(
                    status_code=404,
                    detail=f"Policy '{request.policy_id}' not found"
                )

            # Get base prompt from provider or use existing system_prompt
            if not system_prompt:
                # Get default prompt from LLM service
                provider = llm_strategy_service.registry.get(request.provider)
                if provider:
                    system_prompt = provider.get_default_system_prompt()

            # Apply policy to system prompt
            if system_prompt:
                system_prompt = policy_service.apply_policy(
                    system_prompt,
                    policy["text"]
                )

        result = await llm_strategy_service.generate_action(
            provider=request.provider,
            model=request.model,
            history=request.history,
            system_prompt=system_prompt,
            temperature=request.temperature
        )

        return LLMActionResponse(**result)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLM generation failed: {str(e)}"
        )
