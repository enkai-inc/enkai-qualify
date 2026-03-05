"""Discovery API routes."""
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import get_current_user
from ..services.discovery import DiscoveryEngine, OpportunityType

logger = structlog.get_logger()

router = APIRouter(prefix="/discovery", tags=["discovery"])
engine = DiscoveryEngine()


class DiscoveryRequest(BaseModel):
    """Request body for keyword discovery."""

    seed_keywords: list[str] = Field(max_length=10)
    min_volume: int = Field(default=100, ge=0, le=1000000)
    max_competition: float = Field(default=0.7, ge=0.0, le=1.0)
    opportunity_types: list[OpportunityType] | None = None


class DiscoveryResponse(BaseModel):
    """Response body for keyword discovery."""

    results: list[dict]
    total: int


@router.post("/keywords", response_model=DiscoveryResponse)
async def discover_keywords(request: DiscoveryRequest, current_user: dict = Depends(get_current_user)) -> DiscoveryResponse:
    """Discover keyword opportunities."""
    try:
        results = await engine.discover(
            seed_keywords=request.seed_keywords,
            min_volume=request.min_volume,
            max_competition=request.max_competition,
            opportunity_types=request.opportunity_types,
        )
    except Exception as e:
        logger.error("discovery_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Discovery service error")

    return DiscoveryResponse(
        results=[r.model_dump() for r in results],
        total=len(results),
    )
