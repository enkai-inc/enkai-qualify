"""Pytest configuration and fixtures."""
import pytest


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
