"""DataForSEO API client for keyword research."""
import os
from typing import Any

import httpx
from pydantic import BaseModel


class KeywordData(BaseModel):
    """Keyword data from DataForSEO API."""

    keyword: str
    search_volume: int
    competition: float
    cpc: float
    trend: str  # rising, stable, declining


MAX_KEYWORDS_PER_REQUEST = 100


class DataForSEOClient:
    """Client for DataForSEO keyword research API."""

    def __init__(self) -> None:
        """Initialize the DataForSEO client."""
        self.login = os.environ.get("DATAFORSEO_LOGIN")
        self.password = os.environ.get("DATAFORSEO_PASSWORD")
        self.base_url = "https://api.dataforseo.com/v3"

    async def get_keyword_data(self, keywords: list[str]) -> list[KeywordData]:
        """Get search volume and competition data for keywords.

        Args:
            keywords: List of keywords to analyze.

        Returns:
            List of KeywordData objects with metrics.
        """
        keywords = keywords[:MAX_KEYWORDS_PER_REQUEST]

        if not self.login or not self.password:
            # Return mock data if no credentials
            return [
                KeywordData(
                    keyword=kw,
                    search_volume=1000,
                    competition=0.5,
                    cpc=2.50,
                    trend="stable",
                )
                for kw in keywords
            ]

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/keywords_data/google_ads/search_volume/live",
                auth=(self.login, self.password),
                json=[
                    {
                        "keywords": keywords,
                        "location_code": 2840,  # USA
                        "language_code": "en",
                    }
                ],
            )
            data = response.json()

        results = []
        for task in data.get("tasks", []):
            for result in task.get("result", []):
                results.append(
                    KeywordData(
                        keyword=result["keyword"],
                        search_volume=result.get("search_volume", 0),
                        competition=result.get("competition", 0),
                        cpc=result.get("cpc", 0),
                        trend=self._detect_trend(result.get("monthly_searches", [])),
                    )
                )
        return results

    def _detect_trend(self, monthly: list[dict[str, Any]]) -> str:
        """Detect keyword trend from monthly search data.

        Args:
            monthly: List of monthly search volume dictionaries.

        Returns:
            Trend classification: 'rising', 'stable', or 'declining'.
        """
        if not monthly or len(monthly) < 3:
            return "stable"

        recent = sum(m.get("search_volume", 0) for m in monthly[:3])
        older = sum(m.get("search_volume", 0) for m in monthly[-3:])

        if older == 0:
            return "stable"

        if recent > older * 1.2:
            return "rising"
        elif recent < older * 0.8:
            return "declining"
        return "stable"

    async def get_related_keywords(self, seed: str, limit: int = 20) -> list[str]:
        """Get related keywords for a seed keyword.

        Args:
            seed: The seed keyword to expand.
            limit: Maximum number of related keywords to return.

        Returns:
            List of related keyword strings.
        """
        if not self.login:
            return [
                f"{seed} software",
                f"best {seed}",
                f"{seed} alternative",
            ]

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/keywords_data/google_ads/keywords_for_keywords/live",
                auth=(self.login, self.password),
                json=[{"keywords": [seed], "limit": limit}],
            )
            data = response.json()

        keywords = []
        for task in data.get("tasks", []):
            for result in task.get("result", []):
                keywords.append(result["keyword"])
        return keywords
