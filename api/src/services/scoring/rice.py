"""Unified RICE scorer combining all factors."""
from src.models.rice import RiceScore, RiceFactors
from src.services.discovery.patterns import OpportunityType
from .reach import calculate_reach
from .impact import calculate_impact
from .confidence import calculate_confidence
from .effort import EffortEstimator


class RiceScorer:
    """Calculate RICE scores for opportunities.

    RICE = (Reach × Impact × Confidence) / Effort

    This service combines all individual calculators to produce
    a complete RICE score with breakdowns and reasoning.
    """

    def __init__(self) -> None:
        """Initialize the RICE scorer."""
        self.effort_estimator = EffortEstimator()

    async def calculate(
        self,
        keyword: str,
        factors: RiceFactors,
    ) -> RiceScore:
        """Calculate full RICE score for an opportunity.

        Args:
            keyword: The target keyword.
            factors: Input factors for calculation.

        Returns:
            Complete RiceScore with all breakdowns.
        """
        # Calculate reach from search volume
        reach, reach_reasoning = calculate_reach(
            factors.search_volume, factors.geo
        )

        # Parse opportunity type if provided
        opp_type = None
        if factors.opportunity_type:
            try:
                opp_type = OpportunityType(factors.opportunity_type)
            except ValueError:
                pass  # Unknown type, use None

        # Calculate impact from CPC and opportunity type
        impact, impact_reasoning = calculate_impact(factors.cpc, opp_type)

        # Calculate confidence from trend and pattern match
        confidence, confidence_reasoning = calculate_confidence(
            factors.trend, factors.pattern_confidence
        )

        # Estimate effort using AI
        effort, effort_reasoning, effort_source = await self.effort_estimator.estimate(
            keyword=keyword,
            opportunity_type=factors.opportunity_type,
            competition=1 - confidence,  # Higher confidence = lower competition proxy
        )

        return RiceScore(
            reach=reach,
            reach_raw=factors.search_volume,
            reach_reasoning=reach_reasoning,
            impact=impact,
            impact_reasoning=impact_reasoning,
            confidence=confidence,
            confidence_reasoning=confidence_reasoning,
            effort=effort,
            effort_reasoning=effort_reasoning,
            effort_source=effort_source,
        )

    async def calculate_batch(
        self,
        opportunities: list[tuple[str, RiceFactors]],
    ) -> list[RiceScore]:
        """Calculate RICE scores for multiple opportunities.

        Args:
            opportunities: List of (keyword, factors) tuples.

        Returns:
            List of RiceScore in same order.
        """
        results = []
        for keyword, factors in opportunities:
            score = await self.calculate(keyword, factors)
            results.append(score)
        return results
