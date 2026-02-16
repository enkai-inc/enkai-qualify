"""Opportunity pattern detection from keywords."""
import re
from enum import Enum
from typing import Match

from pydantic import BaseModel


class OpportunityType(str, Enum):
    """Types of keyword opportunities."""

    ALTERNATIVE = "alternative"
    BEST_FOR = "best_for"
    HOW_TO = "how_to"
    COMPARISON = "comparison"
    CATEGORY = "category"


class DetectedOpportunity(BaseModel):
    """A detected opportunity from a keyword."""

    keyword: str
    opportunity_type: OpportunityType
    extracted_entities: dict[str, str | None]
    confidence: float


class OpportunityDetector:
    """Detects opportunity patterns in keywords."""

    PATTERNS: dict[OpportunityType, str] = {
        OpportunityType.ALTERNATIVE: r"alternative(?:s)?\s+to\s+(.+)",
        OpportunityType.BEST_FOR: r"best\s+(.+?)\s+for\s+(.+)",
        OpportunityType.HOW_TO: r"how\s+to\s+(.+)",
        OpportunityType.COMPARISON: r"(.+?)\s+vs\s+(.+)",
        OpportunityType.CATEGORY: r"(.+?)\s+(?:software|tool|app|platform|saas)",
    }

    def detect(self, keyword: str) -> DetectedOpportunity | None:
        """Detect opportunity pattern in a keyword.

        Args:
            keyword: The keyword to analyze.

        Returns:
            DetectedOpportunity if pattern found, None otherwise.
        """
        keyword_lower = keyword.lower().strip()

        for opp_type, pattern in self.PATTERNS.items():
            match = re.search(pattern, keyword_lower, re.IGNORECASE)
            if match:
                entities = self._extract_entities(opp_type, match)
                return DetectedOpportunity(
                    keyword=keyword,
                    opportunity_type=opp_type,
                    extracted_entities=entities,
                    confidence=0.9 if len(match.groups()) > 0 else 0.7,
                )
        return None

    def _extract_entities(
        self, opp_type: OpportunityType, match: Match[str]
    ) -> dict[str, str | None]:
        """Extract entities from regex match based on opportunity type.

        Args:
            opp_type: The type of opportunity detected.
            match: The regex match object.

        Returns:
            Dictionary of extracted entities.
        """
        groups = match.groups()

        if opp_type == OpportunityType.ALTERNATIVE:
            return {"competitor": groups[0] if groups else None}
        elif opp_type == OpportunityType.BEST_FOR:
            if len(groups) >= 2:
                return {"product": groups[0], "niche": groups[1]}
            return {}
        elif opp_type == OpportunityType.HOW_TO:
            return {"problem": groups[0] if groups else None}
        elif opp_type == OpportunityType.COMPARISON:
            if len(groups) >= 2:
                return {"product_a": groups[0], "product_b": groups[1]}
            return {}
        elif opp_type == OpportunityType.CATEGORY:
            return {"category": groups[0] if groups else None}
        return {}

    def detect_batch(self, keywords: list[str]) -> list[DetectedOpportunity]:
        """Detect opportunities in a batch of keywords.

        Args:
            keywords: List of keywords to analyze.

        Returns:
            List of detected opportunities (excludes non-matches).
        """
        results = []
        for kw in keywords:
            opp = self.detect(kw)
            if opp:
                results.append(opp)
        return results
