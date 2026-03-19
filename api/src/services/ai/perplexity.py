"""Perplexity AI provider."""
import os
import httpx
from .base import AIProvider, GeneratedIdea, GenerationInput


class PerplexityProvider(AIProvider):
    name = "perplexity"

    def __init__(self):
        self.api_key = os.environ.get("PERPLEXITY_API_KEY")
        if not self.api_key:
            raise ValueError("PERPLEXITY_API_KEY environment variable is not set")
        self.base_url = "https://api.perplexity.ai"

    async def generate_ideas(
        self, input: GenerationInput, count: int = 3
    ) -> list[GeneratedIdea]:
        prompt = f"""Generate {count} unique SaaS ideas for {input.industry} targeting {input.target_market}.
Technologies: {', '.join(input.technologies)}. Return as JSON array."""

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": "llama-3.1-sonar-large-128k-online",
                    "messages": [{"role": "user", "content": prompt}]
                }
            )
            response.raise_for_status()
            data = response.json()

        import json
        content = data["choices"][0]["message"]["content"]
        start = content.find('[')
        end = content.rfind(']') + 1
        if start == -1 or end == 0:
            raise ValueError(f"No JSON array found in Perplexity response: {content[:200]}")
        try:
            ideas_data = json.loads(content[start:end])
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Perplexity response as JSON: {e}. Content: {content[:200]}")
        return [GeneratedIdea(**idea) for idea in ideas_data]
