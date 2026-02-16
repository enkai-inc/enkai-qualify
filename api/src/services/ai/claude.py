"""Claude AI provider."""
import os
from anthropic import AsyncAnthropic
from .base import AIProvider, GeneratedIdea, GenerationInput


class ClaudeProvider(AIProvider):
    name = "claude"

    def __init__(self):
        self.client = AsyncAnthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

    async def generate_ideas(
        self, input: GenerationInput, count: int = 3
    ) -> list[GeneratedIdea]:
        prompt = f"""Generate {count} SaaS product ideas for:
Industry: {input.industry}
Target Market: {input.target_market}
Technologies: {', '.join(input.technologies)}
{f'Context: {input.description}' if input.description else ''}

Return JSON array with objects containing: title, description, features (array),
target_audience, revenue_model, difficulty (low/medium/high), estimated_mrr (number),
differentiators (array), risks (array)."""

        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}]
        )

        import json
        content = response.content[0].text
        # Extract JSON from response
        start = content.find('[')
        end = content.rfind(']') + 1
        ideas_data = json.loads(content[start:end])

        return [GeneratedIdea(**idea) for idea in ideas_data]
