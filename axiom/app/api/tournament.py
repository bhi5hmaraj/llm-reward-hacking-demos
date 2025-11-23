"""
Tournament endpoints
"""

import logging
from fastapi import APIRouter, HTTPException
from ..models.schemas import TournamentRequest, TournamentResult
from ..services.axelrod_service import axelrod_service

logger = logging.getLogger(__name__)
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
    logger.info(f"Tournament request received: strategies={request.strategies}, turns={request.turns}, repetitions={request.repetitions}")

    try:
        logger.info("Calling axelrod_service.run_tournament...")
        result = axelrod_service.run_tournament(
            request.strategies,
            request.turns,
            request.repetitions
        )

        logger.info(f"Tournament completed successfully. Winner: {result.get('winner')}")
        logger.debug(f"Full tournament result: {result}")

        return TournamentResult(**result)
    except ValueError as e:
        logger.error(f"ValueError in tournament: {str(e)}", exc_info=True)
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Exception in tournament: {str(e)}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
