"""OpenAI GPT-4 provider."""
import os
from openai import AsyncOpenAI
from .base import AIProvider, GeneratedIdea, GenerationInput


class OpenAIProvider(AIProvider):
    name = "gpt4"

    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    async def generate_ideas(
        self, input: GenerationInput, count: int = 3
    ) -> list[GeneratedIdea]:
        prompt = f"""Generate {count} SaaS product ideas for:
Industry: {input.industry}
Target Market: {input.target_market}
Technologies: {', '.join(input.technologies)}
{f'Context: {input.description}' if input.description else ''}

Return JSON array only, no other text."""

        response = await self.client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        import json
        data = json.loads(response.choices[0].message.content)
        ideas = data.get("ideas", data) if isinstance(data, dict) else data
        return [GeneratedIdea(**idea) for idea in ideas]
