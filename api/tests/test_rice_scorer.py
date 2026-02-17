"""Tests for RiceScorer service."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from src.services.scoring.rice import RiceScorer
from src.models.rice import RiceFactors


@pytest.fixture
def mock_effort_estimator():
    """Create a mock effort estimator."""
    with patch("src.services.scoring.rice.EffortEstimator") as mock_class:
        instance = mock_class.return_value
        instance.estimate = AsyncMock(return_value=(3.0, "Moderate complexity", "ai"))
        yield instance


class TestRiceScorer:
    """Tests for RiceScorer class."""

    @pytest.mark.asyncio
    async def test_calculate_full_score(self, mock_effort_estimator):
        """Test full RICE score calculation."""
        scorer = RiceScorer()
        scorer.effort_estimator = mock_effort_estimator

        factors = RiceFactors(
            search_volume=5000,
            cpc=8.0,
            trend="rising",
            pattern_confidence=0.9,
            opportunity_type="alternative",
            geo="global",
        )

        score = await scorer.calculate("salesforce alternative", factors)

        # Verify all components are present
        assert score.reach > 0
        assert score.reach_raw == 5000
        assert "5,000" in score.reach_reasoning

        assert score.impact > 0
        assert "CPC" in score.impact_reasoning

        assert score.confidence > 0
        assert "rising" in score.confidence_reasoning

        assert score.effort == 3.0
        assert score.effort_source == "ai"

        # Final score should be computed
        assert score.score > 0

    @pytest.mark.asyncio
    async def test_calculate_with_minimal_factors(self, mock_effort_estimator):
        """Test calculation with only required factors."""
        scorer = RiceScorer()
        scorer.effort_estimator = mock_effort_estimator

        factors = RiceFactors(
            search_volume=1000,
            cpc=2.0,
            trend="stable",
            pattern_confidence=0.5,
        )

        score = await scorer.calculate("test keyword", factors)

        assert score.reach > 0
        assert score.impact > 0
        assert score.confidence > 0
        assert score.effort > 0

    @pytest.mark.asyncio
    async def test_calculate_batch(self, mock_effort_estimator):
        """Test batch calculation."""
        scorer = RiceScorer()
        scorer.effort_estimator = mock_effort_estimator

        opportunities = [
            ("keyword1", RiceFactors(
                search_volume=1000,
                cpc=5.0,
                trend="rising",
                pattern_confidence=0.8,
            )),
            ("keyword2", RiceFactors(
                search_volume=2000,
                cpc=3.0,
                trend="stable",
                pattern_confidence=0.7,
            )),
            ("keyword3", RiceFactors(
                search_volume=500,
                cpc=10.0,
                trend="declining",
                pattern_confidence=0.9,
            )),
        ]

        scores = await scorer.calculate_batch(opportunities)

        assert len(scores) == 3
        assert all(s.score > 0 for s in scores)
        assert all(s.reach_raw == opp[1].search_volume for s, opp in zip(scores, opportunities))

    @pytest.mark.asyncio
    async def test_calculate_with_unknown_opportunity_type(self, mock_effort_estimator):
        """Test handling of unknown opportunity type."""
        scorer = RiceScorer()
        scorer.effort_estimator = mock_effort_estimator

        factors = RiceFactors(
            search_volume=1000,
            cpc=5.0,
            trend="rising",
            pattern_confidence=0.8,
            opportunity_type="unknown_type",
        )

        # Should not raise, just use None for opportunity type
        score = await scorer.calculate("test", factors)
        assert score.score > 0

    @pytest.mark.asyncio
    async def test_calculate_zero_volume(self, mock_effort_estimator):
        """Test handling of zero search volume."""
        scorer = RiceScorer()
        scorer.effort_estimator = mock_effort_estimator

        factors = RiceFactors(
            search_volume=0,
            cpc=5.0,
            trend="rising",
            pattern_confidence=0.8,
        )

        score = await scorer.calculate("test", factors)
        assert score.reach == 0.0
        assert score.score == 0.0  # (0 * I * C) / E = 0
