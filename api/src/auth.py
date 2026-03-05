"""Authentication middleware for ALB Cognito integration."""

import os
from functools import lru_cache
from typing import Any

import httpx
import jwt
import structlog
from fastapi import HTTPException, Request

logger = structlog.get_logger()

_ALB_KEY_CACHE: dict[str, str] = {}


def _get_alb_public_key(kid: str, region: str) -> str:
    """Fetch and cache ALB public key for JWT verification."""
    if kid in _ALB_KEY_CACHE:
        return _ALB_KEY_CACHE[kid]

    key_url = f"https://public-keys.auth.elb.{region}.amazonaws.com/{kid}"
    resp = httpx.get(key_url, timeout=5.0)
    resp.raise_for_status()
    public_key = resp.text
    _ALB_KEY_CACHE[kid] = public_key
    return public_key


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
        # Get the key ID from the JWT header
        unverified_header = jwt.get_unverified_header(oidc_data)
        kid = unverified_header.get("kid")
        if not kid:
            raise ValueError("JWT header missing kid")

        # Get AWS region from environment
        region = os.environ.get("AWS_REGION", "us-east-1")

        # Fetch the public key and verify the JWT
        public_key = _get_alb_public_key(kid, region)
        payload = jwt.decode(
            oidc_data,
            public_key,
            algorithms=["ES256"],
            options={"verify_exp": True},
        )

        sub = payload.get("sub", oidc_identity)
        email = payload.get("email", "")

        logger.debug("auth_success", sub=sub, email=email)
        return {"sub": sub, "email": email}

    except jwt.ExpiredSignatureError:
        logger.warning("auth_token_expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        logger.error("auth_jwt_invalid", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid authentication token")
    except Exception as e:
        logger.error("auth_jwt_decode_failed", error=str(e))
        raise HTTPException(status_code=401, detail="Invalid authentication token")
