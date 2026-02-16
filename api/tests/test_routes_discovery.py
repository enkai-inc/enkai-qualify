"""Tests for discovery API routes."""
import pytest
from api.src.main import app
from fastapi.testclient import TestClient


class TestDiscoveryRoutes:
    """Tests for discovery API endpoints."""

    @pytest.fixture
    def client(self) -> TestClient:
        """Create test client."""
        return TestClient(app)

    def test_discovery_keywords_endpoint(self, client: TestClient) -> None:
        """Test POST /api/discovery/keywords endpoint."""
        response = client.post(
            "/api/discovery/keywords",
            json={
                "seed_keywords": ["alternative to slack"],
                "min_volume": 100,
                "max_competition": 0.8,
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "total" in data
        assert isinstance(data["results"], list)
        assert data["total"] == len(data["results"])

    def test_discovery_keywords_with_filters(self, client: TestClient) -> None:
        """Test discovery endpoint with opportunity type filters."""
        response = client.post(
            "/api/discovery/keywords",
            json={
                "seed_keywords": ["test keyword"],
                "min_volume": 0,
                "max_competition": 1.0,
                "opportunity_types": ["alternative"],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "results" in data

    def test_discovery_keywords_default_values(self, client: TestClient) -> None:
        """Test discovery endpoint with default values."""
        response = client.post(
            "/api/discovery/keywords",
            json={
                "seed_keywords": ["crm software"],
            },
        )

        assert response.status_code == 200

    def test_discovery_keywords_empty_seeds(self, client: TestClient) -> None:
        """Test discovery endpoint with empty seed keywords."""
        response = client.post(
            "/api/discovery/keywords",
            json={
                "seed_keywords": [],
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0

    def test_discovery_keywords_invalid_opportunity_type(
        self, client: TestClient
    ) -> None:
        """Test discovery endpoint with invalid opportunity type."""
        response = client.post(
            "/api/discovery/keywords",
            json={
                "seed_keywords": ["test"],
                "opportunity_types": ["invalid_type"],
            },
        )

        # Should fail validation
        assert response.status_code == 422
