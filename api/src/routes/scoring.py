"""RICE scoring API endpoints."""
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.models.rice import RiceScore, RiceFactors
from src.services.scoring import RiceScorer

router = APIRouter(prefix="/scoring", tags=["scoring"])


@lru_cache
def get_scorer() -> RiceScorer:
    """Get or create the RiceScorer singleton."""
    return RiceScorer()


class ScoreRequest(BaseModel):
    """Request to calculate RICE score."""

    keyword: str
    factors: RiceFactors


class ScoreBatchRequest(BaseModel):
    """Request to calculate multiple RICE scores."""

    opportunities: list[ScoreRequest]


class ScoreBatchResponse(BaseModel):
    """Response containing multiple RICE scores."""

    scores: list[RiceScore]


class PrioritizedResponse(BaseModel):
    """Response for prioritized opportunities."""

    opportunities: list[dict]
    message: str | None = None


@router.post("/score", response_model=RiceScore)
async def calculate_score(
    request: ScoreRequest, scorer: RiceScorer = Depends(get_scorer)
) -> RiceScore:
    """Calculate RICE score for a single opportunity.

    Args:
        request: ScoreRequest with keyword and factors.

    Returns:
        Complete RiceScore with all breakdowns.
    """
    try:
        return await scorer.calculate(request.keyword, request.factors)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/score/batch", response_model=ScoreBatchResponse)
async def calculate_scores_batch(
    request: ScoreBatchRequest, scorer: RiceScorer = Depends(get_scorer)
) -> ScoreBatchResponse:
    """Calculate RICE scores for multiple opportunities.

    Args:
        request: ScoreBatchRequest with list of opportunities.

    Returns:
        ScoreBatchResponse with list of scores in same order.
    """
    try:
        opportunities = [(r.keyword, r.factors) for r in request.opportunities]
        scores = await scorer.calculate_batch(opportunities)
        return ScoreBatchResponse(scores=scores)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/prioritized", response_model=PrioritizedResponse)
async def get_prioritized_opportunities(
    limit: int = 50,
    min_score: float = 0,
) -> PrioritizedResponse:
    """Get opportunities sorted by RICE score.

    Note: This endpoint requires integration with discovery service.
    For now, returns empty list - will be implemented when
    discovery engine is updated to include RICE scores.

    Args:
        limit: Maximum number of opportunities to return.
        min_score: Minimum RICE score threshold.

    Returns:
        PrioritizedResponse with list of opportunities.
    """
    # TODO: Integrate with discovery engine
    return PrioritizedResponse(
        opportunities=[],
        message="Pending discovery engine integration. Use /score endpoint for now.",
    )
