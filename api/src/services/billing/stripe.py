"""Stripe client for payment processing."""

import os
from typing import Optional

import stripe


class StripeClient:
    """Client for Stripe API interactions."""

    def __init__(self) -> None:
        """Initialize Stripe client with API key from environment."""
        api_key = os.environ.get("STRIPE_SECRET_KEY", "")
        environment = os.environ.get("ENVIRONMENT", "development")
        if not api_key and environment != "development":
            raise RuntimeError(
                "STRIPE_SECRET_KEY environment variable is required "
                "in non-development environments"
            )
        stripe.api_key = api_key
        self.webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    def create_checkout_session(
        self,
        user_id: str,
        price_id: str,
        success_url: Optional[str] = None,
        cancel_url: Optional[str] = None,
    ) -> str:
        """Create a Stripe checkout session for subscription.

        Args:
            user_id: The user's ID to associate with the checkout.
            price_id: The Stripe price ID for the subscription plan.
            success_url: URL to redirect to on successful checkout.
            cancel_url: URL to redirect to on cancelled checkout.

        Returns:
            The checkout session URL.
        """
        base_url = os.environ.get("APP_URL", "http://localhost:3000")
        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url or f"{base_url}/billing?success=true",
            cancel_url=cancel_url or f"{base_url}/billing?cancelled=true",
            client_reference_id=user_id,
            metadata={"user_id": user_id},
        )
        return session.url or ""

    def create_portal_session(self, customer_id: str) -> str:
        """Create a Stripe customer portal session.

        Args:
            customer_id: The Stripe customer ID.

        Returns:
            The portal session URL.
        """
        base_url = os.environ.get("APP_URL", "http://localhost:3000")
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{base_url}/billing",
        )
        return session.url

    def charge_overage(
        self,
        customer_id: str,
        amount: int,
        description: str,
    ) -> str:
        """Charge a customer for overage usage.

        Args:
            customer_id: The Stripe customer ID.
            amount: Amount in cents to charge.
            description: Description for the charge.

        Returns:
            The payment intent ID.
        """
        payment_intent = stripe.PaymentIntent.create(
            amount=amount,
            currency="usd",
            customer=customer_id,
            description=description,
            confirm=True,
            off_session=True,
            payment_method_types=["card"],
        )
        return payment_intent.id
