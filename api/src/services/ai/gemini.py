"""Google Gemini provider."""
import os
import google.generativeai as genai
from .base import AIProvider, GeneratedIdea, GenerationInput


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self):
        genai.configure(api_key=os.environ.get("GOOGLE_AI_API_KEY"))
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
        ideas_data = json.loads(text[start:end])
        return [GeneratedIdea(**idea) for idea in ideas_data]
