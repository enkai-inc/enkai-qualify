"""Tests for RICE scoring models."""
import pytest
from src.models.rice import RiceScore, RiceFactors


class TestRiceScore:
    """Tests for RiceScore model."""

    def test_rice_score_calculation(self):
        """Test basic RICE score calculation."""
        score = RiceScore(
            reach=100.0,
            reach_raw=1000,
            reach_reasoning="1K monthly searches",
            impact=2.0,
            impact_reasoning="High CPC",
            confidence=0.8,
            confidence_reasoning="Rising trend",
            effort=2.0,
            effort_reasoning="Moderate complexity",
            effort_source="ai",
        )
        # (100 * 2 * 0.8) / 2 = 80
        assert score.score == 80.0

    def test_rice_score_minimum_effort(self):
        """Test that effort is floored at 0.5."""
        score = RiceScore(
            reach=100.0,
            reach_raw=1000,
            reach_reasoning="test",
            impact=1.0,
            impact_reasoning="test",
            confidence=1.0,
            confidence_reasoning="test",
            effort=0.1,  # Below minimum
            effort_reasoning="test",
            effort_source="user",
        )
        # Should use 0.5 as minimum: (100 * 1 * 1) / 0.5 = 200
        assert score.score == 200.0

    def test_rice_score_zero_effort_protected(self):
        """Test that zero effort doesn't cause division by zero."""
        score = RiceScore(
            reach=100.0,
            reach_raw=1000,
            reach_reasoning="test",
            impact=1.0,
            impact_reasoning="test",
            confidence=1.0,
            confidence_reasoning="test",
            effort=0.0,  # Zero effort
            effort_reasoning="test",
            effort_source="user",
        )
        # Should use 0.5 as minimum: (100 * 1 * 1) / 0.5 = 200
        assert score.score == 200.0

    def test_rice_score_json_serialization(self):
        """Test JSON serialization includes computed score."""
        score = RiceScore(
            reach=50.0,
            reach_raw=500,
            reach_reasoning="500 searches",
            impact=1.0,
            impact_reasoning="Medium CPC",
            confidence=0.5,
            confidence_reasoning="Stable trend",
            effort=1.0,
            effort_reasoning="Simple",
            effort_source="ai",
        )
        data = score.model_dump()
        assert "score" in data
        assert data["score"] == 25.0  # (50 * 1 * 0.5) / 1

    def test_rice_score_all_fields_present(self):
        """Test all required fields are present."""
        score = RiceScore(
            reach=100.0,
            reach_raw=1000,
            reach_reasoning="test",
            impact=2.0,
            impact_reasoning="test",
            confidence=0.8,
            confidence_reasoning="test",
            effort=3.0,
            effort_reasoning="test",
            effort_source="ai",
        )
        assert score.reach == 100.0
        assert score.reach_raw == 1000
        assert score.impact == 2.0
        assert score.confidence == 0.8
        assert score.effort == 3.0
        assert score.effort_source == "ai"


class TestRiceFactors:
    """Tests for RiceFactors model."""

    def test_rice_factors_required_fields(self):
        """Test required fields are enforced."""
        factors = RiceFactors(
            search_volume=1000,
            cpc=5.0,
            trend="rising",
            pattern_confidence=0.9,
        )
        assert factors.search_volume == 1000
        assert factors.cpc == 5.0
        assert factors.trend == "rising"
        assert factors.pattern_confidence == 0.9

    def test_rice_factors_optional_defaults(self):
        """Test optional fields have correct defaults."""
        factors = RiceFactors(
            search_volume=1000,
            cpc=5.0,
            trend="rising",
            pattern_confidence=0.9,
        )
        assert factors.opportunity_type is None
        assert factors.geo == "global"

    def test_rice_factors_all_fields(self):
        """Test all fields can be set."""
        factors = RiceFactors(
            search_volume=5000,
            cpc=8.0,
            trend="stable",
            pattern_confidence=0.75,
            opportunity_type="alternative",
            geo="us",
        )
        assert factors.search_volume == 5000
        assert factors.cpc == 8.0
        assert factors.trend == "stable"
        assert factors.pattern_confidence == 0.75
        assert factors.opportunity_type == "alternative"
        assert factors.geo == "us"
