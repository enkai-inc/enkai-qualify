# syntax=docker/dockerfile:1.4
# Multi-stage production Dockerfile for Enkai Qualify worker
# No HTTP server - just a polling loop

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM public.ecr.aws/docker/library/python:3.12-slim AS builder
WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# =============================================================================
# Stage 2: Production Runner
# =============================================================================
FROM public.ecr.aws/docker/library/python:3.12-slim AS runner
WORKDIR /app

# Create non-root user
RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid appgroup appuser

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy application code
COPY --chown=appuser:appgroup ./worker ./worker

# Switch to non-root user
USER appuser

# No EXPOSE - worker has no HTTP server
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD pgrep -f "python -m worker" || exit 1

CMD ["python", "-m", "worker"]
