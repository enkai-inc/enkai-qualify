"""AI idea generation using Anthropic Claude.

Replicates the exact prompt from dashboard/lib/services/ai-service.ts.
"""

import json
from dataclasses import dataclass, field

import anthropic
import structlog

from .issue_parser import IdeaParams, RefinementParams, ValidationParams

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

    def validate(self, params: ValidationParams) -> "ValidationResult":
        """Validate an idea and return market scores."""
        features_text = "\n".join(
            f"- {f['name']}: {f['description']}" for f in params.features
        )
        user_prompt = f"""Evaluate this SaaS idea:
Title: {params.title}
Description: {params.description}
Industry: {params.industry}
Target Market: {params.target_market}
Features:
{features_text}

Provide a detailed validation with realistic scores."""

        logger.info("validating_idea", idea_id=params.idea_id)

        message = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1000,
            system=VALIDATION_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        content = message.content[0]
        if content.type != "text":
            raise ValueError("Unexpected response type from Claude")

        parsed = json.loads(content.text)
        result = ValidationResult(
            keyword_score=parsed["keywordScore"],
            pain_point_score=parsed["painPointScore"],
            competition_score=parsed["competitionScore"],
            revenue_estimate=parsed["revenueEstimate"],
            overall_score=parsed["overallScore"],
            details=parsed["details"],
        )
        logger.info("idea_validated", overall_score=result.overall_score)
        return result

    def refine(self, params: RefinementParams) -> "RefinedIdea":
        """Refine an idea based on user feedback."""
        features_text = "\n".join(
            f"- {f['name']}: {f['description']}" for f in params.features
        )
        user_prompt = f"""Current idea:
Title: {params.title}
Description: {params.description}
Industry: {params.industry}
Target Market: {params.target_market}
Technologies: {", ".join(params.technologies)}
Features:
{features_text}

User feedback: {params.prompt}

Refine the idea based on this feedback."""

        logger.info("refining_idea", idea_id=params.idea_id)

        message = self._client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=REFINEMENT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )

        content = message.content[0]
        if content.type != "text":
            raise ValueError("Unexpected response type from Claude")

        parsed = json.loads(content.text)
        refined = RefinedIdea(
            title=parsed["title"],
            description=parsed["description"],
            features=parsed["features"],
            technologies=parsed["technologies"],
            summary=parsed["summary"],
        )
        logger.info("idea_refined", title=refined.title)
        return refined


@dataclass
class ValidationResult:
    keyword_score: int
    pain_point_score: int
    competition_score: int
    revenue_estimate: int
    overall_score: int
    details: dict


VALIDATION_SYSTEM_PROMPT = """You are a market research expert evaluating SaaS product ideas. Analyze the idea and provide realistic scores.

Your response must be valid JSON with the following structure:
{
  "keywordScore": 0-100,
  "painPointScore": 0-100,
  "competitionScore": 0-100,
  "revenueEstimate": number,
  "overallScore": 0-100,
  "details": {
    "marketSize": "Brief description of market size (e.g., '$5B TAM')",
    "competitorCount": number,
    "feasibilityNotes": "Key feasibility considerations"
  }
}

Be realistic and critical. Most ideas should score between 40-75."""


@dataclass
class RefinedIdea:
    title: str
    description: str
    features: list[dict]
    technologies: list[str]
    summary: str


REFINEMENT_SYSTEM_PROMPT = """You are an expert SaaS product strategist helping refine a product idea. Based on the user's feedback, update the idea accordingly.

Your response must be valid JSON with the following structure:
{
  "title": "Updated Product Name",
  "description": "Updated description",
  "features": [
    {
      "id": "uuid",
      "name": "Feature Name",
      "description": "What this feature does",
      "priority": "high" | "medium" | "low"
    }
  ],
  "technologies": ["Technology 1", "Technology 2"],
  "summary": "Brief summary of what was changed and why"
}"""
