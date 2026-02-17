"""RICE scoring data models for opportunity prioritization."""
from pydantic import BaseModel, computed_field


class RiceScore(BaseModel):
    """RICE scoring breakdown for opportunity prioritization.

    RICE = (Reach × Impact × Confidence) / Effort

    Attributes:
        reach: Normalized reach score (0-1000+, log-scaled from search volume)
        reach_raw: Original search volume
        reach_reasoning: Human-readable explanation of reach calculation
        impact: Impact score (0.25, 0.5, 1, 2, or 3)
        impact_reasoning: Human-readable explanation of impact
        confidence: Confidence as decimal (0-1)
        confidence_reasoning: Human-readable explanation of confidence
        effort: Estimated person-months (0.5-24)
        effort_reasoning: Human-readable explanation of effort estimate
        effort_source: Source of estimate ("ai", "user", "cached", "fallback")
    """

    reach: float
    reach_raw: int
    reach_reasoning: str

    impact: float
    impact_reasoning: str

    confidence: float
    confidence_reasoning: str

    effort: float
    effort_reasoning: str
    effort_source: str

    @computed_field
    @property
    def score(self) -> float:
        """Calculate final RICE score.

        Returns:
            RICE score = (Reach × Impact × Confidence) / Effort
            Effort is floored at 0.5 to prevent division issues.
        """
        return round(
            (self.reach * self.impact * self.confidence) / max(self.effort, 0.5), 2
        )


class RiceFactors(BaseModel):
    """Input factors for RICE calculation.

    Attributes:
        search_volume: Monthly search volume
        cpc: Cost per click in dollars
        trend: Trend direction ("rising", "stable", "mixed", "declining")
        pattern_confidence: Confidence from pattern detection (0-1)
        opportunity_type: Type of opportunity pattern (optional)
        geo: Geographic focus ("global", "us", "uk", "eu", "regional")
    """

    search_volume: int
    cpc: float
    trend: str
    pattern_confidence: float
    opportunity_type: str | None = None
    geo: str = "global"
