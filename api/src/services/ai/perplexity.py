"""Perplexity AI provider."""
import os
import httpx
from .base import AIProvider, GeneratedIdea, GenerationInput


class PerplexityProvider(AIProvider):
    name = "perplexity"

    def __init__(self):
        self.api_key = os.environ.get("PERPLEXITY_API_KEY")
        self.base_url = "https://api.perplexity.ai"

    async def generate_ideas(
        self, input: GenerationInput, count: int = 3
    ) -> list[GeneratedIdea]:
        prompt = f"""Generate {count} unique SaaS ideas for {input.industry} targeting {input.target_market}.
Technologies: {', '.join(input.technologies)}. Return as JSON array."""

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": "llama-3.1-sonar-large-128k-online",
                    "messages": [{"role": "user", "content": prompt}]
                }
            )
            data = response.json()

        import json
        content = data["choices"][0]["message"]["content"]
        start = content.find('[')
        end = content.rfind(']') + 1
        ideas_data = json.loads(content[start:end])
        return [GeneratedIdea(**idea) for idea in ideas_data]
