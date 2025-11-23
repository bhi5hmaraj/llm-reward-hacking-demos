"""
Nash equilibrium computation endpoints
"""

from fastapi import APIRouter, HTTPException
from ..models.schemas import PayoffMatrix, NashEquilibrium
from ..services.nash import nash_service

router = APIRouter(prefix="/equilibrium", tags=["Nash Equilibrium"])


@router.post("", response_model=NashEquilibrium)
async def compute_equilibrium(payoff_matrix: PayoffMatrix):
    """
    Compute Nash equilibria for a given payoff matrix

    Args:
        payoff_matrix: Payoff matrix specification

    Returns:
        Nash equilibria (pure and mixed strategies)
    """
    try:
        result = nash_service.compute_equilibria(payoff_matrix.matrix)

        return NashEquilibrium(
            equilibria=result["equilibria"],
            is_unique=result["is_unique"],
            pure_equilibria=result["pure_equilibria"]
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
