"""Metis API - FastAPI Application Entry Point."""

from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    timestamp: str
    service: str
    version: str


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    print(f"Starting Metis API v{settings.version}")
    yield
    # Shutdown
    print("Shutting down Metis API")


app = FastAPI(
    title="Metis API",
    description="AI-powered development toolkit backend",
    version=settings.version,
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Health check endpoint for load balancer and container orchestration."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        service="metis-api",
        version=settings.version,
    )


@app.get("/", tags=["Root"])
async def root() -> dict[str, Any]:
    """Root endpoint with API information."""
    return {
        "service": "metis-api",
        "version": settings.version,
        "docs": "/docs" if settings.debug else None,
    }
