"""
Tournament endpoints
"""

from fastapi import APIRouter, HTTPException
from ..models.schemas import TournamentRequest, TournamentResult
from ..services.axelrod_service import axelrod_service

router = APIRouter(prefix="/tournament", tags=["Tournament"])


@router.post("", response_model=TournamentResult)
async def run_tournament(request: TournamentRequest):
    """
    Run a round-robin tournament between strategies

    Each strategy plays against every other strategy for the specified
    number of turns and repetitions.

    Args:
        request: Tournament configuration

    Returns:
        Tournament results with rankings
    """
    try:
        result = axelrod_service.run_tournament(
            request.strategies,
            request.turns,
            request.repetitions
        )

        return TournamentResult(**result)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
