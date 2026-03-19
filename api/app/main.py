"""Enkai Qualify API - FastAPI Application Entry Point."""

import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings

request_logger = structlog.get_logger("api.request")


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    timestamp: str
    service: str
    version: str
    dependencies: dict[str, str] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    print(f"Starting Enkai Qualify API v{settings.version}")
    yield
    # Shutdown
    print("Shutting down Enkai Qualify API")


app = FastAPI(
    title="Enkai Qualify API",
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
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """Log every request with method, path, status_code, and duration_ms."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    request_logger.info(
        "request_handled",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=duration_ms,
    )
    return response


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Health check endpoint for load balancer and container orchestration."""
    import asyncio
    import os
    deps: dict[str, str] = {}
    overall = "healthy"

    # Check Redis
    try:
        import redis.asyncio as aioredis
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        r = aioredis.from_url(redis_url, socket_connect_timeout=2)
        await asyncio.wait_for(r.ping(), timeout=2.0)
        deps["redis"] = "ok"
        await r.aclose()
    except Exception:
        deps["redis"] = "unavailable"
        overall = "degraded"

    return HealthResponse(
        status=overall,
        timestamp=datetime.utcnow().isoformat(),
        service="enkai-qualify-api",
        version=settings.version,
        dependencies=deps,
    )


@app.get("/", tags=["Root"])
async def root() -> dict[str, Any]:
    """Root endpoint with API information."""
    return {
        "service": "enkai-qualify-api",
        "version": settings.version,
        "docs": "/docs" if settings.debug else None,
    }
