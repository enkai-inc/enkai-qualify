"""Billing API routes."""

from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from ..auth import get_current_user
from ..services.billing import StripeClient, SubscriptionService, UsageMeter

logger = structlog.get_logger()


router = APIRouter(prefix="/billing", tags=["billing"])


# Request/Response models
class CheckoutRequest(BaseModel):
    """Request to start a checkout session."""

    price_id: str
    user_id: str


class CheckoutResponse(BaseModel):
    """Response with checkout session URL."""

    url: str


class PortalRequest(BaseModel):
    """Request for customer portal session."""

    customer_id: str


class PortalResponse(BaseModel):
    """Response with portal session URL."""

    url: str


class ChargePackRequest(BaseModel):
    """Request to charge for an extra pack."""

    customer_id: str
    user_id: str


class ChargePackResponse(BaseModel):
    """Response with payment intent ID."""

    payment_intent_id: str
    amount: int


class SubscriptionResponse(BaseModel):
    """Current subscription details."""

    plan: str
    status: str
    ideas_used: int
    ideas_limit: int
    packs_used: int
    packs_limit: int
    current_period_end: str


def get_stripe_client() -> StripeClient:
    """Dependency to get Stripe client."""
    return StripeClient()


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: CheckoutRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    stripe_client: StripeClient = Depends(get_stripe_client),
) -> CheckoutResponse:
    """Start a Stripe checkout session for subscription.

    Args:
        request: Checkout request with price_id and user_id.
        current_user: Authenticated user from ALB Cognito headers.
        stripe_client: Stripe client dependency.

    Returns:
        Checkout session URL.
    """
    if request.user_id != current_user["sub"]:
        raise HTTPException(status_code=403, detail="User ID mismatch")
    try:
        url = stripe_client.create_checkout_session(
            user_id=request.user_id,
            price_id=request.price_id,
        )
        return CheckoutResponse(url=url)
    except Exception as e:
        logger.error("checkout_session_failed", error=str(e))
        raise HTTPException(status_code=400, detail="Checkout session creation failed")


@router.post("/portal", response_model=PortalResponse)
async def create_portal(
    request: PortalRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    stripe_client: StripeClient = Depends(get_stripe_client),
) -> PortalResponse:
    """Get Stripe customer portal URL.

    Args:
        request: Portal request with customer_id.
        current_user: Authenticated user from ALB Cognito headers.
        stripe_client: Stripe client dependency.

    Returns:
        Portal session URL.
    """
    try:
        url = stripe_client.create_portal_session(customer_id=request.customer_id)
        return PortalResponse(url=url)
    except Exception as e:
        logger.error("portal_session_failed", error=str(e))
        raise HTTPException(status_code=400, detail="Portal session creation failed")


@router.get("/subscription/me", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: dict[str, Any] = Depends(get_current_user),
    db: Any = None,  # Would be injected via dependency
) -> SubscriptionResponse:
    """Get current subscription for the authenticated user.

    Args:
        current_user: Authenticated user from ALB Cognito headers.
        db: Database dependency.

    Returns:
        Current subscription details with usage.
    """
    user_id = current_user["sub"]
    subscription_service = SubscriptionService(db)
    usage_meter = UsageMeter(db, subscription_service)

    subscription = await subscription_service.get_subscription(user_id)
    usage = await usage_meter.get_usage(user_id)

    if subscription:
        limits = subscription_service.get_plan_limits(subscription.plan)
        return SubscriptionResponse(
            plan=subscription.plan.value,
            status=subscription.status,
            ideas_used=usage.ideas_used,
            ideas_limit=limits.ideas_per_month,
            packs_used=usage.packs_used,
            packs_limit=limits.packs_per_month,
            current_period_end=subscription.current_period_end.isoformat(),
        )

    # Free tier defaults
    from ..services.billing.subscriptions import PLAN_LIMITS, PlanTier

    limits = PLAN_LIMITS[PlanTier.FREE]
    return SubscriptionResponse(
        plan="free",
        status="active",
        ideas_used=usage.ideas_used,
        ideas_limit=limits.ideas_per_month,
        packs_used=usage.packs_used,
        packs_limit=limits.packs_per_month,
        current_period_end=usage.period_end.isoformat(),
    )


@router.post("/charge-pack", response_model=ChargePackResponse)
async def charge_pack(
    request: ChargePackRequest,
    current_user: dict[str, Any] = Depends(get_current_user),
    stripe_client: StripeClient = Depends(get_stripe_client),
    db: Any = None,
) -> ChargePackResponse:
    """Charge for an extra pack (overage).

    Args:
        request: Charge request with customer_id and user_id.
        current_user: Authenticated user from ALB Cognito headers.
        stripe_client: Stripe client dependency.
        db: Database dependency.

    Returns:
        Payment intent ID and amount charged.
    """
    if request.user_id != current_user["sub"]:
        raise HTTPException(status_code=403, detail="User ID mismatch")
    subscription_service = SubscriptionService(db)
    subscription = await subscription_service.get_subscription(request.user_id)

    if not subscription:
        raise HTTPException(status_code=404, detail="No subscription found")

    limits = subscription_service.get_plan_limits(subscription.plan)

    if limits.overage_price == 0:
        raise HTTPException(
            status_code=400, detail="Overage not available for this plan"
        )

    try:
        payment_intent_id = stripe_client.charge_overage(
            customer_id=request.customer_id,
            amount=limits.overage_price,
            description=f"Extra pack for {subscription.plan.value} plan",
        )
        return ChargePackResponse(
            payment_intent_id=payment_intent_id,
            amount=limits.overage_price,
        )
    except Exception as e:
        logger.error("billing_operation_failed", error=str(e))
        raise HTTPException(status_code=400, detail="Billing operation failed")
