"""Pytest configuration and fixtures."""
import os
import pytest

# Enable development auth fallback for route tests
os.environ.setdefault("APP_ENV", "development")


@pytest.fixture
def sample_keywords() -> list[str]:
    """Sample keywords for testing."""
    return [
        "alternative to slack",
        "best crm for startups",
        "how to manage projects",
        "notion vs asana",
        "project management software",
    ]


@pytest.fixture
def auth_headers() -> dict[str, str]:
    """Auth headers for route tests using dev auth fallback."""
    return {"x-dev-user-id": "test-user"}
