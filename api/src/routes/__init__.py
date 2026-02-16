"""API routes registration."""

from fastapi import APIRouter
from .generate import router as generate_router

router = APIRouter()

# Include sub-routers
router.include_router(generate_router)


@router.get("/")
async def api_root() -> dict[str, str]:
    """API root endpoint."""
    return {"message": "Welcome to Metis API", "version": "0.1.0"}


@router.get("/ideas")
async def list_ideas() -> dict[str, list]:
    """List ideas endpoint (placeholder)."""
    return {"ideas": [], "total": 0}
