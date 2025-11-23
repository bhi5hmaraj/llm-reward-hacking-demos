"""
Strategy management and action endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List
from ..models.schemas import (
    StrategyInfo,
    StrategyPlayRequest,
    StrategyPlayResponse,
    StrategyAnalysisRequest,
    StrategyAnalysisResponse
)
from ..services.axelrod_service import axelrod_service

router = APIRouter(prefix="/strategies", tags=["Strategies"])


@router.get("", response_model=List[StrategyInfo])
async def list_strategies(
    basic_only: bool = Query(False, description="Only return well-known basic strategies")
):
    """
    List all available Axelrod strategies

    Args:
        basic_only: If true, only return ~15 well-known strategies

    Returns:
        List of strategy information
    """
    strategies = axelrod_service.list_strategies(filter_basic=basic_only)

    return [
        StrategyInfo(
            name=s["name"],
            classifier=s["classifier"],
            description=s["docstring"][:200] if s["docstring"] else "No description"
        )
        for s in strategies
    ]


@router.post("/{strategy_name}/play", response_model=StrategyPlayResponse)
async def play_strategy(strategy_name: str, request: StrategyPlayRequest):
    """
    Get action from a specific strategy given game history

    Args:
        strategy_name: Name of the strategy to use
        request: Game history and context

    Returns:
        Recommended action with reasoning
    """
    try:
        action, reasoning = axelrod_service.play_action(
            strategy_name,
            request.history,
            request.opponent_id
        )

        return StrategyPlayResponse(
            action=action,
            reasoning=reasoning,
            strategy_name=strategy_name
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/analyze", response_model=StrategyAnalysisResponse)
async def analyze_strategy(request: StrategyAnalysisRequest):
    """
    Analyze a strategy's behavior against standard opponents

    Tests the strategy against Cooperator, Defector, and Tit-for-Tat

    Args:
        request: Strategy analysis parameters

    Returns:
        Detailed analysis of strategy behavior
    """
    try:
        result = axelrod_service.analyze_strategy(
            request.strategy_name,
            request.turns
        )

        return StrategyAnalysisResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
