"""Tests for confidence calculator."""

import pytest

from src.services.scoring.confidence import calculate_confidence, TREND_CONFIDENCE


class TestTrendConfidence:
    """Test trend-based confidence calculation."""

    def test_rising_trend_full_confidence(self):
        """Rising trend should give 1.0 confidence."""
        confidence, reasoning = calculate_confidence("rising")
        assert confidence == 1.0
        assert "rising trend" in reasoning

    def test_stable_trend_confidence(self):
        """Stable trend should give 0.8 confidence."""
        confidence, reasoning = calculate_confidence("stable")
        assert confidence == 0.8
        assert "stable trend" in reasoning

    def test_mixed_trend_confidence(self):
        """Mixed trend should give 0.5 confidence."""
        confidence, reasoning = calculate_confidence("mixed")
        assert confidence == 0.5
        assert "mixed trend" in reasoning

    def test_declining_trend_confidence(self):
        """Declining trend should give 0.25 confidence."""
        confidence, reasoning = calculate_confidence("declining")
        assert confidence == 0.25
        assert "declining trend" in reasoning

    def test_unknown_trend_defaults_to_mixed(self):
        """Unknown trend should default to 0.5 confidence."""
        confidence, _ = calculate_confidence("unknown")
        assert confidence == 0.5

    def test_case_insensitive_trend(self):
        """Trend matching should be case insensitive."""
        confidence, _ = calculate_confidence("RISING")
        assert confidence == 1.0


class TestPatternConfidence:
    """Test pattern confidence weighting."""

    def test_pattern_confidence_reduces_score(self):
        """Lower pattern confidence should reduce overall score."""
        confidence, reasoning = calculate_confidence("rising", pattern_confidence=0.7)
        assert confidence == 0.7
        assert "70% pattern match" in reasoning

    def test_pattern_confidence_floor(self):
        """Pattern confidence should have a floor of 0.5."""
        confidence, _ = calculate_confidence("rising", pattern_confidence=0.3)
        # 1.0 * 0.5 (floor) = 0.5
        assert confidence == 0.5


class TestDataAge:
    """Test data age adjustments."""

    def test_fresh_data_no_penalty(self):
        """Data under 30 days should have no penalty."""
        confidence, reasoning = calculate_confidence("rising", data_age_days=15)
        assert confidence == 1.0
        assert "data" not in reasoning

    def test_recent_data_penalty(self):
        """Data 30-90 days old should have 10% penalty."""
        confidence, reasoning = calculate_confidence("rising", data_age_days=45)
        assert confidence == 0.9
        assert "recent data (45d)" in reasoning

    def test_stale_data_penalty(self):
        """Data over 90 days old should have 30% penalty."""
        confidence, reasoning = calculate_confidence("rising", data_age_days=120)
        assert confidence == 0.7
        assert "stale data (120d)" in reasoning


class TestCombinedFactors:
    """Test combined factor scenarios."""

    def test_multiple_factors_combined(self):
        """Multiple factors should combine correctly."""
        confidence, reasoning = calculate_confidence(
            trend="stable",
            pattern_confidence=0.8,
            data_age_days=60,
        )
        # 0.8 (stable) * 0.8 (pattern) * 0.9 (recent) = 0.576
        assert confidence == 0.58
        assert "stable trend" in reasoning
        assert "80% pattern match" in reasoning
        assert "recent data (60d)" in reasoning

    def test_confidence_capped_at_1(self):
        """Confidence should never exceed 1.0."""
        confidence, _ = calculate_confidence("rising", pattern_confidence=1.5)
        assert confidence <= 1.0
