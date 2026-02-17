"""Tests for impact calculator."""
import pytest

from src.services.discovery.patterns import OpportunityType
from src.services.scoring.impact import (
    CPC_THRESHOLDS,
    TYPE_BOOSTS,
    calculate_impact,
)


class TestCalculateImpact:
    """Tests for calculate_impact function."""

    def test_high_cpc_returns_max_base_impact(self):
        """High CPC ($10+) should return base impact of 3.0."""
        impact, reasoning = calculate_impact(15.0)
        assert impact == 3.0
        assert "CPC $15.00" in reasoning

    def test_medium_cpc_returns_medium_impact(self):
        """Medium CPC ($5-10) should return base impact of 2.0."""
        impact, reasoning = calculate_impact(7.5)
        assert impact == 2.0
        assert "CPC $7.50" in reasoning

    def test_low_cpc_returns_low_impact(self):
        """Low CPC ($2-5) should return base impact of 1.0."""
        impact, reasoning = calculate_impact(3.0)
        assert impact == 1.0
        assert "CPC $3.00" in reasoning

    def test_very_low_cpc_returns_minimal_impact(self):
        """Very low CPC ($1-2) should return base impact of 0.5."""
        impact, reasoning = calculate_impact(1.5)
        assert impact == 0.5
        assert "CPC $1.50" in reasoning

    def test_minimal_cpc_returns_floor_impact(self):
        """Minimal CPC (<$1) should return floor impact of 0.25."""
        impact, reasoning = calculate_impact(0.5)
        assert impact == 0.25
        assert "CPC $0.50" in reasoning

    def test_alternative_type_gets_boost(self):
        """Alternative opportunity type should get 1.5x boost."""
        impact, reasoning = calculate_impact(5.0, OpportunityType.ALTERNATIVE)
        assert impact == 3.0  # 2.0 * 1.5 = 3.0
        assert "alternative" in reasoning
        assert "1.5x boost" in reasoning

    def test_comparison_type_gets_boost(self):
        """Comparison opportunity type should get 1.2x boost."""
        impact, reasoning = calculate_impact(5.0, OpportunityType.COMPARISON)
        assert impact == 2.4  # 2.0 * 1.2 = 2.4
        assert "comparison" in reasoning
        assert "1.2x boost" in reasoning

    def test_best_for_type_no_boost(self):
        """Best for opportunity type should get no boost (1.0x)."""
        impact, reasoning = calculate_impact(5.0, OpportunityType.BEST_FOR)
        assert impact == 2.0  # 2.0 * 1.0 = 2.0
        assert "best_for" in reasoning
        assert "boost" not in reasoning

    def test_category_type_gets_reduction(self):
        """Category opportunity type should get 0.8x reduction."""
        impact, reasoning = calculate_impact(5.0, OpportunityType.CATEGORY)
        assert impact == 1.6  # 2.0 * 0.8 = 1.6
        assert "category" in reasoning
        assert "0.8x boost" in reasoning

    def test_how_to_type_gets_reduction(self):
        """How to opportunity type should get 0.6x reduction."""
        impact, reasoning = calculate_impact(5.0, OpportunityType.HOW_TO)
        assert impact == 1.2  # 2.0 * 0.6 = 1.2
        assert "how_to" in reasoning
        assert "0.6x boost" in reasoning

    def test_impact_capped_at_3(self):
        """Impact should be capped at 3.0 even with high CPC and boost."""
        impact, reasoning = calculate_impact(15.0, OpportunityType.ALTERNATIVE)
        assert impact == 3.0  # Would be 4.5, but capped at 3.0
        assert "alternative" in reasoning

    def test_none_type_uses_general(self):
        """None opportunity type should use general (no boost)."""
        impact, reasoning = calculate_impact(5.0, None)
        assert impact == 2.0
        assert "general" in reasoning
        assert "boost" not in reasoning

    def test_zero_cpc(self):
        """Zero CPC should return floor impact."""
        impact, reasoning = calculate_impact(0.0)
        assert impact == 0.25
        assert "CPC $0.00" in reasoning

    def test_exact_threshold_values(self):
        """Exact threshold values should match their impact."""
        assert calculate_impact(10.0)[0] == 3.0
        assert calculate_impact(5.0)[0] == 2.0
        assert calculate_impact(2.0)[0] == 1.0
        assert calculate_impact(1.0)[0] == 0.5

    def test_type_boosts_coverage(self):
        """All opportunity types should have defined boosts."""
        for opp_type in OpportunityType:
            assert opp_type in TYPE_BOOSTS

    def test_cpc_thresholds_sorted_descending(self):
        """CPC thresholds should be sorted in descending order."""
        thresholds = [t[0] for t in CPC_THRESHOLDS]
        assert thresholds == sorted(thresholds, reverse=True)
