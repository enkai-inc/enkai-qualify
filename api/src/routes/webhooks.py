"""Webhook handlers for external services."""

import os
from typing import Any

import stripe
from fastapi import APIRouter, Header, HTTPException, Request

from ..services.billing import SubscriptionService


router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Track processed events for idempotency
_processed_events: set[str] = set()


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

    # Idempotency check
    event_id = event["id"]
    if event_id in _processed_events:
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

        # Mark as processed for idempotency
        _processed_events.add(event_id)

        # Clean up old events to prevent memory growth
        if len(_processed_events) > 10000:
            # Remove oldest half
            to_remove = list(_processed_events)[: len(_processed_events) // 2]
            for e in to_remove:
                _processed_events.discard(e)

    except Exception as e:
        # Log error but return 200 to prevent Stripe retries for app errors
        # In production, log this properly
        print(f"Error processing webhook {event_type}: {e}")

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
