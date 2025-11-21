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
          "temperature": 0.7
        }
        ```
    """
    try:
        result = await llm_strategy_service.generate_action(
            provider=request.provider,
            model=request.model,
            history=request.history,
            system_prompt=request.system_prompt,
            temperature=request.temperature
        )

        return LLMActionResponse(**result)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"LLM generation failed: {str(e)}"
        )
