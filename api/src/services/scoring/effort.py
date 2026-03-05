"""AI-powered effort estimator for RICE scoring."""
import json
import hashlib

from anthropic import AsyncAnthropic

EFFORT_PROMPT = '''Estimate development effort in person-months for a SaaS product:

Keyword: {keyword}
Opportunity Type: {opportunity_type}
Competition Level: {competition}

Respond with ONLY valid JSON:
{{"effort_months": <0.5-24>, "complexity": "simple|moderate|complex|enterprise", "reasoning": "Brief explanation"}}'''

FALLBACK_EFFORT = {
    "alternative": 6.0,
    "comparison": 4.0,
    "best_for": 3.0,
    "category": 4.0,
    "how_to": 2.0,
    None: 4.0,
}


class EffortEstimator:
    """Estimates development effort using AI with caching."""

    def __init__(self, client: AsyncAnthropic | None = None):
        self.client = client or AsyncAnthropic()
        self._cache: dict[str, tuple[float, str]] = {}

    def _cache_key(self, keyword: str, opp_type: str | None) -> str:
        raw = f"{keyword}:{opp_type or 'none'}"
        return hashlib.md5(raw.encode()).hexdigest()

    async def estimate(
        self,
        keyword: str,
        opportunity_type: str | None = None,
        competition: float = 0.5,
        use_cache: bool = True,
    ) -> tuple[float, str, str]:
        """Estimate development effort.

        Returns:
            Tuple of (effort_months, reasoning, source) where source is
            'cached', 'ai', or 'fallback'.
        """
        cache_key = self._cache_key(keyword, opportunity_type)

        if use_cache and cache_key in self._cache:
            effort, reasoning = self._cache[cache_key]
            return effort, reasoning, "cached"

        try:
            prompt = EFFORT_PROMPT.format(
                keyword=keyword,
                opportunity_type=opportunity_type or "general",
                competition=competition,
            )
            response = await self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            content = response.content[0].text
            result = json.loads(content)

            effort = float(result["effort_months"])
            effort = max(0.5, min(effort, 24.0))
            reasoning = result.get("reasoning", f"{result['complexity']} complexity")

            self._cache[cache_key] = (effort, reasoning)
            return effort, reasoning, "ai"
        except Exception:
            effort = FALLBACK_EFFORT.get(opportunity_type, 4.0)
            reasoning = f"Heuristic estimate for {opportunity_type or 'general'} opportunity"
            return effort, reasoning, "fallback"
