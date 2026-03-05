"""Generation API routes."""
import structlog
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..services.ai import ConsensusEngine, GenerationInput

logger = structlog.get_logger()

router = APIRouter(prefix="/generate", tags=["generation"])
limiter = Limiter(key_func=get_remote_address)
engine = ConsensusEngine()


class GenerateRequest(BaseModel):
    industry: str
    target_market: str
    technologies: list[str]
    description: str | None = None


class GenerateResponse(BaseModel):
    ideas: list[dict]
    model_agreement: float
    total_cost: float


@router.post("/ideas", response_model=GenerateResponse)
@limiter.limit("10/minute")
async def generate_ideas(request: Request, body: GenerateRequest):
    try:
        input = GenerationInput(**body.model_dump())
        result = await engine.generate_with_consensus(input)
        return GenerateResponse(
            ideas=[idea.model_dump() for idea in result.ideas],
            model_agreement=result.model_agreement,
            total_cost=result.total_cost
        )
    except Exception as e:
        logger.error("idea_generation_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Idea generation failed")
