"""AI idea generation using Anthropic Claude.

Replicates the exact prompt from dashboard/lib/services/ai-service.ts.
"""

import json
from dataclasses import dataclass, field

import anthropic
import structlog

from .issue_parser import IdeaParams

logger = structlog.get_logger()


@dataclass
class GeneratedIdea:
    title: str
    description: str
    features: list[dict]
    technologies: list[str]
    market_analysis: str


SYSTEM_PROMPT = """You are an expert SaaS product strategist. Given a problem description and context, you generate detailed, actionable SaaS product ideas.

Your response must be valid JSON with the following structure:
{
  "title": "Product Name - short tagline",
  "description": "2-3 paragraph description of the product, its value proposition, and how it solves the problem",
  "features": [
    {
      "id": "uuid",
      "name": "Feature Name",
      "description": "What this feature does",
      "priority": "high" | "medium" | "low"
    }
  ],
  "technologies": ["Technology 1", "Technology 2"],
  "marketAnalysis": "Brief analysis of market opportunity"
}

Include 5-8 features prioritized by importance. Suggest modern, practical technologies."""


class IdeaGenerator:
    """Generate SaaS product ideas using Claude."""

    def __init__(self, api_key: str) -> None:
        self._client = anthropic.Anthropic(api_key=api_key)

    def generate(self, params: IdeaParams) -> GeneratedIdea:
        """Generate an idea from parsed issue parameters."""
        user_prompt = f"""Generate a SaaS product idea for:
- Industry: {params.industry}
- Target Market: {params.target_market}
- Problem/Opportunity: {params.problem_description}
{f"- Complexity Level: {params.complexity}" if params.complexity else ""}
{f"- Timeline: {params.timeline}" if params.timeline else ""}

Generate a detailed, buildable product idea."""

        logger.info("generating_idea", industry=params.industry)

        message = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        content = message.content[0]
        if content.type != "text":
            raise ValueError("Unexpected response type from Claude")

        parsed = json.loads(content.text)
        idea = GeneratedIdea(
            title=parsed["title"],
            description=parsed["description"],
            features=parsed["features"],
            technologies=parsed["technologies"],
            market_analysis=parsed["marketAnalysis"],
        )
        logger.info("idea_generated", title=idea.title)
        return idea
