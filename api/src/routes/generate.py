"""Generation API routes."""
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..auth import get_current_user
from ..services.ai import ConsensusEngine, GenerationInput

logger = structlog.get_logger()

router = APIRouter(prefix="/generate", tags=["generation"])
limiter = Limiter(key_func=get_remote_address)
engine = ConsensusEngine()


class GenerateRequest(BaseModel):
    industry: str = Field(max_length=200)
    target_market: str = Field(max_length=200)
    description: str = Field(default="", max_length=2000)
    technologies: list[str] = Field(default_factory=list, max_length=20)


class GenerateResponse(BaseModel):
    ideas: list[dict]
    model_agreement: float
    total_cost: float


@router.post("/ideas", response_model=GenerateResponse)
@limiter.limit("10/minute")
async def generate_ideas(request: Request, body: GenerateRequest, current_user: dict = Depends(get_current_user)):
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
