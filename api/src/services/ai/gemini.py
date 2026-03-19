"""Google Gemini provider."""
import os
import google.generativeai as genai
from .base import AIProvider, GeneratedIdea, GenerationInput


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self):
        api_key = os.environ.get("GOOGLE_AI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_AI_API_KEY environment variable is not set")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel("gemini-pro")

    async def generate_ideas(
        self, input: GenerationInput, count: int = 3
    ) -> list[GeneratedIdea]:
        prompt = f"""Generate {count} SaaS product ideas as JSON array:
Industry: {input.industry}, Target: {input.target_market}
Tech: {', '.join(input.technologies)}
{input.description or ''}

JSON format: [{{title, description, features[], target_audience, revenue_model,
difficulty, estimated_mrr, differentiators[], risks[]}}]"""

        response = await self.model.generate_content_async(prompt)

        import json
        text = response.text
        start = text.find('[')
        end = text.rfind(']') + 1
        if start == -1 or end == 0:
            raise ValueError(f"No JSON array found in Gemini response: {text[:200]}")
        try:
            ideas_data = json.loads(text[start:end])
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse Gemini response as JSON: {e}. Content: {text[:200]}")
        return [GeneratedIdea(**idea) for idea in ideas_data]
