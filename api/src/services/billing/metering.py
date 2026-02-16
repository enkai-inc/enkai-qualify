"""Usage metering service for tracking resource consumption."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from .subscriptions import PLAN_LIMITS, PlanTier, SubscriptionService


ResourceType = Literal["idea", "pack"]


@dataclass
class Usage:
    """User usage data for current billing period."""

    user_id: str
    ideas_used: int
    packs_used: int
    period_start: datetime
    period_end: datetime


class UsageMeter:
    """Service for tracking and checking usage against limits."""

    def __init__(self, db: Any, subscription_service: SubscriptionService) -> None:
        """Initialize usage meter.

        Args:
            db: Database connection or ORM session.
            subscription_service: Subscription service for plan lookups.
        """
        self.db = db
        self.subscription_service = subscription_service

    async def track_idea(self, user_id: str) -> None:
        """Track an idea generation for a user.

        Args:
            user_id: The user's ID.
        """
        await self._increment_usage(user_id, "ideas_used")

    async def track_pack(self, user_id: str) -> None:
        """Track a pack purchase for a user.

        Args:
            user_id: The user's ID.
        """
        await self._increment_usage(user_id, "packs_used")

    async def get_usage(self, user_id: str) -> Usage:
        """Get current period usage for a user.

        Args:
            user_id: The user's ID.

        Returns:
            The user's current usage data.
        """
        subscription = await self.subscription_service.get_subscription(user_id)

        if subscription:
            period_start = subscription.current_period_start
            period_end = subscription.current_period_end
        else:
            # Free tier - use monthly periods
            now = datetime.utcnow()
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if now.month == 12:
                period_end = period_start.replace(year=now.year + 1, month=1)
            else:
                period_end = period_start.replace(month=now.month + 1)

        result = await self.db.usage.find_one(
            {
                "user_id": user_id,
                "period_start": {"$gte": period_start},
            }
        )

        if not result:
            return Usage(
                user_id=user_id,
                ideas_used=0,
                packs_used=0,
                period_start=period_start,
                period_end=period_end,
            )

        return Usage(
            user_id=user_id,
            ideas_used=result.get("ideas_used", 0),
            packs_used=result.get("packs_used", 0),
            period_start=period_start,
            period_end=period_end,
        )

    async def check_limit(self, user_id: str, resource_type: ResourceType) -> bool:
        """Check if user is within limits for a resource type.

        Args:
            user_id: The user's ID.
            resource_type: Type of resource to check ("idea" or "pack").

        Returns:
            True if within limits, False if limit exceeded.
        """
        subscription = await self.subscription_service.get_subscription(user_id)
        plan = subscription.plan if subscription else PlanTier.FREE
        limits = PLAN_LIMITS[plan]

        usage = await self.get_usage(user_id)

        if resource_type == "idea":
            # -1 means unlimited
            if limits.ideas_per_month == -1:
                return True
            return usage.ideas_used < limits.ideas_per_month
        elif resource_type == "pack":
            if limits.packs_per_month == -1:
                return True
            return usage.packs_used < limits.packs_per_month

        return False

    async def _increment_usage(self, user_id: str, field: str) -> None:
        """Increment a usage field for the current period.

        Args:
            user_id: The user's ID.
            field: The field to increment (ideas_used or packs_used).
        """
        subscription = await self.subscription_service.get_subscription(user_id)

        if subscription:
            period_start = subscription.current_period_start
        else:
            now = datetime.utcnow()
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        await self.db.usage.update_one(
            {"user_id": user_id, "period_start": period_start},
            {
                "$inc": {field: 1},
                "$setOnInsert": {
                    "user_id": user_id,
                    "period_start": period_start,
                    "created_at": datetime.utcnow(),
                },
                "$set": {"updated_at": datetime.utcnow()},
            },
            upsert=True,
        )
