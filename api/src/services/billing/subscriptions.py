"""Subscription management service."""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class PlanTier(str, Enum):
    """Subscription plan tiers."""

    FREE = "free"
    EXPLORER = "explorer"
    BUILDER = "builder"
    AGENCY = "agency"


@dataclass
class PlanLimits:
    """Plan resource limits."""

    ideas_per_month: int  # -1 for unlimited
    packs_per_month: int  # -1 for unlimited
    overage_price: int  # Price per pack overage in cents


# Plan configurations
PLAN_LIMITS: dict[PlanTier, PlanLimits] = {
    PlanTier.FREE: PlanLimits(ideas_per_month=3, packs_per_month=0, overage_price=0),
    PlanTier.EXPLORER: PlanLimits(
        ideas_per_month=15, packs_per_month=3, overage_price=900
    ),
    PlanTier.BUILDER: PlanLimits(
        ideas_per_month=-1, packs_per_month=15, overage_price=700
    ),
    PlanTier.AGENCY: PlanLimits(
        ideas_per_month=-1, packs_per_month=-1, overage_price=0
    ),
}


@dataclass
class Subscription:
    """User subscription data."""

    id: str
    user_id: str
    stripe_customer_id: str
    stripe_subscription_id: Optional[str]
    plan: PlanTier
    status: str
    current_period_start: datetime
    current_period_end: datetime
    created_at: datetime
    updated_at: datetime


class SubscriptionService:
    """Service for managing user subscriptions."""

    def __init__(self, db: Any) -> None:
        """Initialize subscription service.

        Args:
            db: Database connection or ORM session.
        """
        self.db = db

    async def get_subscription(self, user_id: str) -> Optional[Subscription]:
        """Get a user's current subscription.

        Args:
            user_id: The user's ID.

        Returns:
            The subscription if found, otherwise None.
        """
        # Query database for subscription
        result = await self.db.subscriptions.find_one({"user_id": user_id})
        if not result:
            return None
        return Subscription(
            id=str(result["_id"]),
            user_id=result["user_id"],
            stripe_customer_id=result["stripe_customer_id"],
            stripe_subscription_id=result.get("stripe_subscription_id"),
            plan=PlanTier(result["plan"]),
            status=result["status"],
            current_period_start=result["current_period_start"],
            current_period_end=result["current_period_end"],
            created_at=result["created_at"],
            updated_at=result["updated_at"],
        )

    async def create_subscription(self, checkout_session: dict[str, Any]) -> Subscription:
        """Create a subscription from a completed checkout session.

        Args:
            checkout_session: Stripe checkout session data.

        Returns:
            The created subscription.
        """
        user_id = checkout_session.get("client_reference_id") or checkout_session.get(
            "metadata", {}
        ).get("user_id")
        customer_id = checkout_session["customer"]
        subscription_id = checkout_session["subscription"]

        # Determine plan from price
        plan = self._get_plan_from_session(checkout_session)

        now = datetime.utcnow()
        subscription_data = {
            "user_id": user_id,
            "stripe_customer_id": customer_id,
            "stripe_subscription_id": subscription_id,
            "plan": plan.value,
            "status": "active",
            "current_period_start": now,
            "current_period_end": now,  # Will be updated by subscription.created webhook
            "created_at": now,
            "updated_at": now,
        }

        result = await self.db.subscriptions.insert_one(subscription_data)
        return Subscription(
            id=str(result.inserted_id),
            user_id=user_id,
            stripe_customer_id=customer_id,
            stripe_subscription_id=subscription_id,
            plan=plan,
            status="active",
            current_period_start=now,
            current_period_end=now,
            created_at=now,
            updated_at=now,
        )

    async def update_subscription(
        self, subscription_event: dict[str, Any]
    ) -> Optional[Subscription]:
        """Update subscription from Stripe webhook event.

        Args:
            subscription_event: Stripe subscription event data.

        Returns:
            The updated subscription if found.
        """
        subscription_id = subscription_event["id"]
        status = subscription_event["status"]

        update_data = {
            "status": status,
            "current_period_start": datetime.fromtimestamp(
                subscription_event["current_period_start"]
            ),
            "current_period_end": datetime.fromtimestamp(
                subscription_event["current_period_end"]
            ),
            "updated_at": datetime.utcnow(),
        }

        result = await self.db.subscriptions.find_one_and_update(
            {"stripe_subscription_id": subscription_id},
            {"$set": update_data},
            return_document=True,
        )

        if not result:
            return None

        return Subscription(
            id=str(result["_id"]),
            user_id=result["user_id"],
            stripe_customer_id=result["stripe_customer_id"],
            stripe_subscription_id=result.get("stripe_subscription_id"),
            plan=PlanTier(result["plan"]),
            status=result["status"],
            current_period_start=result["current_period_start"],
            current_period_end=result["current_period_end"],
            created_at=result["created_at"],
            updated_at=result["updated_at"],
        )

    async def cancel_subscription(self, user_id: str) -> None:
        """Cancel a user's subscription.

        Args:
            user_id: The user's ID.
        """
        await self.db.subscriptions.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "status": "cancelled",
                    "plan": PlanTier.FREE.value,
                    "updated_at": datetime.utcnow(),
                }
            },
        )

    def _get_plan_from_session(self, checkout_session: dict[str, Any]) -> PlanTier:
        """Determine plan tier from checkout session.

        Args:
            checkout_session: Stripe checkout session data.

        Returns:
            The plan tier.
        """
        # Extract price ID from line items and map to plan
        line_items = checkout_session.get("line_items", {}).get("data", [])
        if not line_items:
            return PlanTier.FREE

        price_id = line_items[0].get("price", {}).get("id", "")

        # Map price IDs to plans (these would be configured in env)
        price_to_plan = {
            "price_explorer": PlanTier.EXPLORER,
            "price_builder": PlanTier.BUILDER,
            "price_agency": PlanTier.AGENCY,
        }

        return price_to_plan.get(price_id, PlanTier.FREE)

    def get_plan_limits(self, plan: PlanTier) -> PlanLimits:
        """Get limits for a subscription plan.

        Args:
            plan: The plan tier.

        Returns:
            The plan's resource limits.
        """
        return PLAN_LIMITS.get(plan, PLAN_LIMITS[PlanTier.FREE])
