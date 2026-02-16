"""Main discovery engine combining keyword data and patterns."""
from pydantic import BaseModel

from .dataforseo import DataForSEOClient, KeywordData
from .patterns import DetectedOpportunity, OpportunityDetector, OpportunityType


class DiscoveryResult(BaseModel):
    """Result from keyword discovery."""

    keyword: str
    search_volume: int
    competition: float
    cpc: float
    trend: str
    opportunity_type: OpportunityType | None
    entities: dict[str, str | None]
    score: float


class DiscoveryEngine:
    """Main discovery engine combining keyword data and pattern detection."""

    def __init__(self) -> None:
        """Initialize the discovery engine."""
        self.client = DataForSEOClient()
        self.detector = OpportunityDetector()

    async def discover(
        self,
        seed_keywords: list[str],
        min_volume: int = 100,
        max_competition: float = 0.8,
        opportunity_types: list[OpportunityType] | None = None,
    ) -> list[DiscoveryResult]:
        """Discover keyword opportunities.

        Args:
            seed_keywords: Starting keywords to expand from.
            min_volume: Minimum search volume filter.
            max_competition: Maximum competition score filter.
            opportunity_types: Optional list of opportunity types to filter by.

        Returns:
            List of DiscoveryResult sorted by score descending.
        """
        if not seed_keywords:
            return []

        # Get related keywords
        all_keywords = set(seed_keywords)
        for seed in seed_keywords[:3]:  # Limit expansion
            related = await self.client.get_related_keywords(seed)
            all_keywords.update(related)

        # Get keyword data
        keyword_data = await self.client.get_keyword_data(list(all_keywords))

        # Detect opportunities and score
        results = []
        for kw_data in keyword_data:
            if kw_data.search_volume < min_volume:
                continue
            if kw_data.competition > max_competition:
                continue

            opportunity = self.detector.detect(kw_data.keyword)

            if opportunity_types and opportunity:
                if opportunity.opportunity_type not in opportunity_types:
                    continue

            score = self._calculate_score(kw_data, opportunity)

            results.append(
                DiscoveryResult(
                    keyword=kw_data.keyword,
                    search_volume=kw_data.search_volume,
                    competition=kw_data.competition,
                    cpc=kw_data.cpc,
                    trend=kw_data.trend,
                    opportunity_type=(
                        opportunity.opportunity_type if opportunity else None
                    ),
                    entities=opportunity.extracted_entities if opportunity else {},
                    score=score,
                )
            )

        # Sort by score descending
        results.sort(key=lambda x: -x.score)
        return results[:50]

    def _calculate_score(
        self, kw: KeywordData, opp: DetectedOpportunity | None
    ) -> float:
        """Calculate opportunity score for a keyword.

        Args:
            kw: Keyword data with metrics.
            opp: Detected opportunity (if any).

        Returns:
            Score from 0-100.
        """
        score = 0.0

        # Volume score (0-30)
        if kw.search_volume >= 10000:
            score += 30
        elif kw.search_volume >= 1000:
            score += 20
        else:
            score += 10

        # Competition score (0-30)
        score += (1 - kw.competition) * 30

        # Trend score (0-20)
        if kw.trend == "rising":
            score += 20
        elif kw.trend == "stable":
            score += 10

        # Opportunity type score (0-20)
        if opp:
            score += 20 * opp.confidence

        return round(score, 1)
