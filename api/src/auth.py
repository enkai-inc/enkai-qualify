"""Authentication middleware for ALB Cognito integration."""

import base64
import json
import os
from typing import Any

import structlog
from fastapi import HTTPException, Request

logger = structlog.get_logger()


async def get_current_user(request: Request) -> dict[str, Any]:
    """FastAPI dependency that extracts and validates the authenticated user.

    In production, AWS ALB forwards Cognito OIDC headers:
      - x-amzn-oidc-data: JWT with user claims
      - x-amzn-oidc-identity: Subject (user ID)

    In development (APP_ENV=development), accepts X-Dev-User-Id as fallback.

    Returns:
        Dict with 'sub' (user ID) and 'email' keys.

    Raises:
        HTTPException: 401 if authentication headers are missing or invalid.
    """
    # Development fallback
    if os.environ.get("APP_ENV") == "development":
        dev_user_id = request.headers.get("x-dev-user-id")
        if dev_user_id:
            logger.debug("dev_auth_fallback", user_id=dev_user_id)
            return {"sub": dev_user_id, "email": f"{dev_user_id}@dev.local"}

    oidc_data = request.headers.get("x-amzn-oidc-data")
    oidc_identity = request.headers.get("x-amzn-oidc-identity")

    if not oidc_data or not oidc_identity:
        logger.warning("auth_missing_headers", path=request.url.path)
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # JWT is three base64-encoded segments separated by dots
        parts = oidc_data.split(".")
        if len(parts) != 3:
            raise ValueError("Invalid JWT format")

        # Decode the payload (second segment)
        payload_b64 = parts[1]
        # Add padding if needed
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding

        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes)

        sub = payload.get("sub", oidc_identity)
        email = payload.get("email", "")

        logger.debug("auth_success", sub=sub, email=email)
        return {"sub": sub, "email": email}

    except Exception as e:
        logger.error("auth_jwt_decode_failed", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid authentication token")
