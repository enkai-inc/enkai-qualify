"""Tests for billing portal IDOR fix (issue #397)."""

from unittest.mock import MagicMock

import pytest

from src.routes.billing import PortalRequest, create_portal


@pytest.mark.asyncio
async def test_portal_rejects_mismatched_user_id():
    """Portal endpoint returns 403 when user_id != authenticated user."""
    request = PortalRequest(customer_id="cus_123", user_id="attacker-id")
    current_user = {"sub": "legitimate-user-id"}
    stripe_client = MagicMock()

    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc_info:
        await create_portal(
            request=request,
            current_user=current_user,
            stripe_client=stripe_client,
        )

    assert exc_info.value.status_code == 403
    assert "Not authorized" in exc_info.value.detail
    stripe_client.create_portal_session.assert_not_called()


@pytest.mark.asyncio
async def test_portal_allows_matching_user_id():
    """Portal endpoint succeeds when user_id matches authenticated user."""
    request = PortalRequest(customer_id="cus_123", user_id="user-abc")
    current_user = {"sub": "user-abc"}
    stripe_client = MagicMock()
    stripe_client.create_portal_session.return_value = "https://billing.stripe.com/session/xyz"

    response = await create_portal(
        request=request,
        current_user=current_user,
        stripe_client=stripe_client,
    )

    assert response.url == "https://billing.stripe.com/session/xyz"
    stripe_client.create_portal_session.assert_called_once_with(customer_id="cus_123")


def test_portal_request_requires_user_id():
    """PortalRequest model requires user_id field."""
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        PortalRequest(customer_id="cus_123")
