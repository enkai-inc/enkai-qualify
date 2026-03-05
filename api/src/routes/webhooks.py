"""Webhook handlers for external services."""

import os
from typing import Any

import redis.asyncio as aioredis
import stripe
import structlog
from fastapi import APIRouter, Header, HTTPException, Request

from ..services.billing import SubscriptionService

logger = structlog.get_logger()

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Redis-based idempotency
_redis: aioredis.Redis | None = None
IDEMPOTENCY_TTL_SECONDS = 86400


async def _get_redis() -> aioredis.Redis:
    """Get or create a Redis connection for idempotency checks."""
    global _redis
    if _redis is None:
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        _redis = aioredis.from_url(redis_url, decode_responses=True)
    return _redis


@router.post("/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(alias="Stripe-Signature"),
    db: Any = None,  # Would be injected via dependency
) -> dict[str, str]:
    """Handle Stripe webhook events.

    Verifies the webhook signature and processes supported events.
    Implements idempotent handling to prevent duplicate processing.

    Args:
        request: The raw request with webhook payload.
        stripe_signature: Stripe signature header for verification.
        db: Database dependency.

    Returns:
        Acknowledgment response.

    Raises:
        HTTPException: If signature verification fails or event is invalid.
    """
    payload = await request.body()
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    if not webhook_secret:
        logger.error("stripe_webhook_secret_not_configured")
        raise HTTPException(status_code=500, detail="Webhook not configured")

    # Verify webhook signature
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=stripe_signature,
            secret=webhook_secret,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Idempotency check via Redis
    event_id = event["id"]
    r = await _get_redis()
    already_processed = await r.set(
        f"webhook:idempotency:{event_id}",
        "1",
        nx=True,
        ex=IDEMPOTENCY_TTL_SECONDS,
    )
    if already_processed is None:
        return {"status": "already_processed"}

    # Process the event
    event_type = event["type"]
    event_data = event["data"]["object"]

    subscription_service = SubscriptionService(db)

    try:
        if event_type == "checkout.session.completed":
            await _handle_checkout_completed(subscription_service, event_data)
        elif event_type == "customer.subscription.created":
            await _handle_subscription_created(subscription_service, event_data)
        elif event_type == "customer.subscription.updated":
            await _handle_subscription_updated(subscription_service, event_data)
        elif event_type == "customer.subscription.deleted":
            await _handle_subscription_deleted(subscription_service, event_data)
        else:
            # Unhandled event type - log and continue
            pass

    except Exception as e:
        # Log error but return 200 to prevent Stripe retries for app errors
        logger.error(
            "Error processing webhook",
            event_type=event_type,
            event_id=event_id,
            error=str(e),
        )

    return {"status": "processed"}


async def _handle_checkout_completed(
    subscription_service: SubscriptionService,
    checkout_session: dict[str, Any],
) -> None:
    """Handle checkout.session.completed event.

    Creates the subscription record after successful checkout.

    Args:
        subscription_service: Subscription service instance.
        checkout_session: Stripe checkout session data.
    """
    if checkout_session.get("mode") != "subscription":
        return

    await subscription_service.create_subscription(checkout_session)


async def _handle_subscription_created(
    subscription_service: SubscriptionService,
    subscription: dict[str, Any],
) -> None:
    """Handle customer.subscription.created event.

    Updates subscription with period details.

    Args:
        subscription_service: Subscription service instance.
        subscription: Stripe subscription data.
    """
    await subscription_service.update_subscription(subscription)


async def _handle_subscription_updated(
    subscription_service: SubscriptionService,
    subscription: dict[str, Any],
) -> None:
    """Handle customer.subscription.updated event.

    Updates subscription status and period.

    Args:
        subscription_service: Subscription service instance.
        subscription: Stripe subscription data.
    """
    await subscription_service.update_subscription(subscription)


async def _handle_subscription_deleted(
    subscription_service: SubscriptionService,
    subscription: dict[str, Any],
) -> None:
    """Handle customer.subscription.deleted event.

    Marks subscription as cancelled and reverts to free tier.

    Args:
        subscription_service: Subscription service instance.
        subscription: Stripe subscription data.
    """
    # Find user by subscription ID and cancel
    customer_id = subscription.get("customer")
    # In production, look up user by customer_id
    # For now, the update_subscription will handle status change
    await subscription_service.update_subscription(subscription)
