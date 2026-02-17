"""Tests for reach calculator."""
import pytest
from src.services.scoring.reach import calculate_reach, GEO_MULTIPLIERS


class TestCalculateReach:
    """Test cases for calculate_reach function."""

    def test_zero_volume_returns_zero(self):
        """Zero volume should return 0 reach."""
        reach, reason = calculate_reach(0)
        assert reach == 0.0
        assert reason == "No search volume data"

    def test_negative_volume_returns_zero(self):
        """Negative volume should return 0 reach."""
        reach, reason = calculate_reach(-100)
        assert reach == 0.0
        assert reason == "No search volume data"

    def test_positive_volume_global(self):
        """Positive volume with global geo should calculate correctly."""
        reach, reason = calculate_reach(1000, "global")
        # log10(1001) * 100 * 1.0 = ~300.04
        assert reach > 0
        assert "1,000 monthly searches" in reason
        assert "multiplier" not in reason

    def test_us_geo_multiplier(self):
        """US geo should apply 0.85 multiplier."""
        global_reach, _ = calculate_reach(1000, "global")
        us_reach, reason = calculate_reach(1000, "us")
        assert us_reach == round(global_reach * 0.85, 2)
        assert "US focused" in reason
        assert "85% multiplier" in reason

    def test_uk_geo_multiplier(self):
        """UK geo should apply 0.6 multiplier."""
        global_reach, _ = calculate_reach(1000, "global")
        uk_reach, reason = calculate_reach(1000, "uk")
        assert uk_reach == round(global_reach * 0.6, 2)
        assert "UK focused" in reason
        assert "60% multiplier" in reason

    def test_eu_geo_multiplier(self):
        """EU geo should apply 0.7 multiplier."""
        global_reach, _ = calculate_reach(1000, "global")
        eu_reach, reason = calculate_reach(1000, "eu")
        assert eu_reach == round(global_reach * 0.7, 2)
        assert "EU focused" in reason
        assert "70% multiplier" in reason

    def test_regional_geo_multiplier(self):
        """Regional geo should apply 0.4 multiplier."""
        global_reach, _ = calculate_reach(1000, "global")
        regional_reach, reason = calculate_reach(1000, "regional")
        assert regional_reach == round(global_reach * 0.4, 2)
        assert "REGIONAL focused" in reason
        assert "40% multiplier" in reason

    def test_unknown_geo_defaults_to_global(self):
        """Unknown geo should default to 1.0 multiplier."""
        global_reach, _ = calculate_reach(1000, "global")
        unknown_reach, _ = calculate_reach(1000, "unknown")
        assert unknown_reach == global_reach

    def test_case_insensitive_geo(self):
        """Geo parameter should be case insensitive."""
        lower_reach, _ = calculate_reach(1000, "us")
        upper_reach, _ = calculate_reach(1000, "US")
        mixed_reach, _ = calculate_reach(1000, "Us")
        assert lower_reach == upper_reach == mixed_reach

    def test_large_volume(self):
        """Large volume should scale logarithmically."""
        small_reach, _ = calculate_reach(100)
        large_reach, _ = calculate_reach(1000000)
        # log10(1000001) is ~6, log10(101) is ~2
        # So large_reach should be roughly 3x small_reach, not 10000x
        assert large_reach < small_reach * 10

    def test_formatting_with_thousands(self):
        """Large numbers should be formatted with commas."""
        _, reason = calculate_reach(1000000)
        assert "1,000,000 monthly searches" in reason
