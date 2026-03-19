"""OpenAI GPT-4 provider."""
import os
from openai import AsyncOpenAI
from .base import AIProvider, GeneratedIdea, GenerationInput


class OpenAIProvider(AIProvider):
    name = "gpt4"

    def __init__(self):
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        self.client = AsyncOpenAI(api_key=api_key)

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
        raw_content = response.choices[0].message.content
        if not raw_content:
            raise ValueError("Empty response from OpenAI")
        try:
            data = json.loads(raw_content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse OpenAI response as JSON: {e}. Content: {raw_content[:200]}")
        ideas = data.get("ideas", data) if isinstance(data, dict) else data
        return [GeneratedIdea(**idea) for idea in ideas]
