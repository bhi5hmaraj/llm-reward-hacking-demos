"""
Health check endpoint
"""

from fastapi import APIRouter
import axelrod as axl
import nashpy as nash
from ..models.schemas import HealthResponse
from ..services.axelrod_service import axelrod_service

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="ok",
        version="0.1.0",
        strategies_available=len(axelrod_service.list_strategies()),
        axelrod_version=axl.__version__,
        nashpy_version=nash.__version__
    )
