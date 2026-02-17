"""Tests for AI effort estimator."""
import pytest
from unittest.mock import AsyncMock, MagicMock

from src.services.scoring.effort import EffortEstimator, FALLBACK_EFFORT


@pytest.fixture
def mock_client():
    """Create mock Anthropic client."""
    client = MagicMock()
    client.messages = MagicMock()
    client.messages.create = AsyncMock()
    return client


@pytest.fixture
def estimator(mock_client):
    """Create estimator with mock client."""
    return EffortEstimator(client=mock_client)


class TestEffortEstimator:
    """Tests for EffortEstimator class."""

    @pytest.mark.asyncio
    async def test_estimate_ai_success(self, estimator, mock_client):
        """Test successful AI estimation."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(text='{"effort_months": 3.5, "complexity": "moderate", "reasoning": "Standard SaaS features"}')
        ]
        mock_client.messages.create.return_value = mock_response

        effort, reasoning, source = await estimator.estimate("project management tool")

        assert effort == 3.5
        assert reasoning == "Standard SaaS features"
        assert source == "ai"
        mock_client.messages.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_estimate_clamps_min(self, estimator, mock_client):
        """Test that effort is clamped to minimum 0.5."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(text='{"effort_months": 0.1, "complexity": "simple", "reasoning": "Very simple"}')
        ]
        mock_client.messages.create.return_value = mock_response

        effort, _, _ = await estimator.estimate("simple widget")

        assert effort == 0.5

    @pytest.mark.asyncio
    async def test_estimate_clamps_max(self, estimator, mock_client):
        """Test that effort is clamped to maximum 24."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(text='{"effort_months": 50, "complexity": "enterprise", "reasoning": "Massive project"}')
        ]
        mock_client.messages.create.return_value = mock_response

        effort, _, _ = await estimator.estimate("enterprise platform")

        assert effort == 24.0

    @pytest.mark.asyncio
    async def test_estimate_cache(self, estimator, mock_client):
        """Test that results are cached."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(text='{"effort_months": 4.0, "complexity": "moderate", "reasoning": "Cached result"}')
        ]
        mock_client.messages.create.return_value = mock_response

        # First call
        effort1, _, source1 = await estimator.estimate("crm system")
        assert source1 == "ai"

        # Second call should use cache
        effort2, _, source2 = await estimator.estimate("crm system")
        assert source2 == "cached"
        assert effort1 == effort2

        # AI should only be called once
        assert mock_client.messages.create.call_count == 1

    @pytest.mark.asyncio
    async def test_estimate_skip_cache(self, estimator, mock_client):
        """Test that cache can be bypassed."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(text='{"effort_months": 5.0, "complexity": "complex", "reasoning": "Fresh estimate"}')
        ]
        mock_client.messages.create.return_value = mock_response

        # First call
        await estimator.estimate("analytics tool")

        # Second call with cache disabled
        _, _, source = await estimator.estimate("analytics tool", use_cache=False)
        assert source == "ai"
        assert mock_client.messages.create.call_count == 2

    @pytest.mark.asyncio
    async def test_estimate_fallback_on_error(self, estimator, mock_client):
        """Test fallback when AI fails."""
        mock_client.messages.create.side_effect = Exception("API error")

        effort, reasoning, source = await estimator.estimate(
            "some tool", opportunity_type="alternative"
        )

        assert effort == FALLBACK_EFFORT["alternative"]
        assert source == "fallback"
        assert "alternative" in reasoning

    @pytest.mark.asyncio
    async def test_estimate_fallback_on_invalid_json(self, estimator, mock_client):
        """Test fallback when AI returns invalid JSON."""
        mock_response = MagicMock()
        mock_response.content = [MagicMock(text="This is not valid JSON")]
        mock_client.messages.create.return_value = mock_response

        effort, reasoning, source = await estimator.estimate(
            "tool", opportunity_type="comparison"
        )

        assert effort == FALLBACK_EFFORT["comparison"]
        assert source == "fallback"

    @pytest.mark.asyncio
    async def test_fallback_default_effort(self, estimator, mock_client):
        """Test fallback with unknown opportunity type."""
        mock_client.messages.create.side_effect = Exception("API error")

        effort, _, _ = await estimator.estimate("tool", opportunity_type="unknown")

        assert effort == 4.0  # Default fallback

    def test_cache_key_consistency(self, estimator):
        """Test that cache keys are consistent."""
        key1 = estimator._cache_key("keyword", "type")
        key2 = estimator._cache_key("keyword", "type")
        key3 = estimator._cache_key("keyword", None)

        assert key1 == key2
        assert key1 != key3

    @pytest.mark.asyncio
    async def test_estimate_with_competition(self, estimator, mock_client):
        """Test that competition parameter is passed to prompt."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(text='{"effort_months": 6.0, "complexity": "complex", "reasoning": "High competition"}')
        ]
        mock_client.messages.create.return_value = mock_response

        await estimator.estimate("saas tool", competition=0.8)

        call_args = mock_client.messages.create.call_args
        prompt = call_args.kwargs["messages"][0]["content"]
        assert "0.8" in prompt
