"""API routes registration."""

from fastapi import APIRouter, Depends

from ..auth import get_current_user
from .discovery import router as discovery_router
from .generate import router as generate_router
from .packs import router as packs_router
from .billing import router as billing_router
from .webhooks import router as webhooks_router
from .scoring import router as scoring_router

router = APIRouter()

# Include sub-routers
router.include_router(generate_router)
router.include_router(discovery_router)
router.include_router(packs_router)
router.include_router(billing_router)
router.include_router(webhooks_router)
router.include_router(scoring_router)


@router.get("/")
async def api_root() -> dict[str, str]:
    """API root endpoint."""
    return {"message": "Enkai Qualify API"}


@router.get("/ideas")
async def list_ideas(user: dict = Depends(get_current_user)) -> dict[str, list]:
    """List ideas endpoint (placeholder)."""
    return {"ideas": [], "total": 0}
