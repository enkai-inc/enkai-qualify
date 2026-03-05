"""Tests for RICE scoring API endpoints."""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import AsyncClient, ASGITransport

from src.main import app
from src.models.rice import RiceScore


@pytest.fixture
def mock_scorer():
    """Mock the RiceScorer singleton."""
    mock_score = RiceScore(
        reach=300.0,
        reach_raw=5000,
        reach_reasoning="5,000 monthly searches",
        impact=2.0,
        impact_reasoning="CPC $8.00, alternative pattern",
        confidence=0.9,
        confidence_reasoning="rising trend",
        effort=3.0,
        effort_reasoning="Moderate complexity",
        effort_source="ai",
    )

    with patch("src.routes.scoring.get_scorer") as mock_get:
        mock_instance = AsyncMock()
        mock_instance.calculate = AsyncMock(return_value=mock_score)
        mock_instance.calculate_batch = AsyncMock(return_value=[mock_score, mock_score])
        mock_get.return_value = mock_instance
        yield mock_instance


class TestScoringEndpoints:
    """Tests for scoring API endpoints."""

    DEV_HEADERS = {"x-dev-user-id": "test-user"}

    @pytest.mark.asyncio
    async def test_score_endpoint(self, mock_scorer):
        """Test POST /api/scoring/score endpoint."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test",
            headers=self.DEV_HEADERS,
        ) as client:
            response = await client.post(
                "/api/scoring/score",
                json={
                    "keyword": "crm alternative",
                    "factors": {
                        "search_volume": 5000,
                        "cpc": 8.0,
                        "trend": "rising",
                        "pattern_confidence": 0.9,
                        "opportunity_type": "alternative",
                        "geo": "global",
                    },
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert "reach" in data
        assert "impact" in data
        assert "confidence" in data
        assert "effort" in data
        assert "score" in data
        assert data["reach_raw"] == 5000

    @pytest.mark.asyncio
    async def test_score_batch_endpoint(self, mock_scorer):
        """Test POST /api/scoring/score/batch endpoint."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test",
            headers=self.DEV_HEADERS,
        ) as client:
            response = await client.post(
                "/api/scoring/score/batch",
                json={
                    "opportunities": [
                        {
                            "keyword": "test1",
                            "factors": {
                                "search_volume": 1000,
                                "cpc": 5.0,
                                "trend": "rising",
                                "pattern_confidence": 0.8,
                            },
                        },
                        {
                            "keyword": "test2",
                            "factors": {
                                "search_volume": 2000,
                                "cpc": 3.0,
                                "trend": "stable",
                                "pattern_confidence": 0.7,
                            },
                        },
                    ]
                },
            )

        assert response.status_code == 200
        data = response.json()
        assert "scores" in data
        assert len(data["scores"]) == 2

    @pytest.mark.asyncio
    async def test_prioritized_endpoint(self, mock_scorer):
        """Test GET /api/scoring/prioritized endpoint."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test",
            headers=self.DEV_HEADERS,
        ) as client:
            response = await client.get("/api/scoring/prioritized")

        assert response.status_code == 200
        data = response.json()
        assert "opportunities" in data
        assert "message" in data  # Should have pending message

    @pytest.mark.asyncio
    async def test_prioritized_with_params(self, mock_scorer):
        """Test prioritized endpoint with query parameters."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test",
            headers=self.DEV_HEADERS,
        ) as client:
            response = await client.get(
                "/api/scoring/prioritized",
                params={"limit": 10, "min_score": 50},
            )

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_score_invalid_request(self):
        """Test score endpoint with invalid request."""
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test",
            headers=self.DEV_HEADERS,
        ) as client:
            response = await client.post(
                "/api/scoring/score",
                json={"keyword": "test"},  # Missing factors
            )

        assert response.status_code == 422  # Validation error
