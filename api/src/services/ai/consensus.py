"""Consensus engine for multi-model idea generation."""
import asyncio
from collections import defaultdict
from .base import AIProvider, GeneratedIdea, GenerationInput
from .claude import ClaudeProvider
from .openai import OpenAIProvider
from .gemini import GeminiProvider
from .perplexity import PerplexityProvider


class ConsensusResult:
    def __init__(self, ideas: list[GeneratedIdea], agreement: float,
                 model_responses: dict, cost: float):
        self.ideas = ideas
        self.model_agreement = agreement
        self.model_responses = model_responses
        self.total_cost = cost


class ConsensusEngine:
    def __init__(self):
        self.providers: list[AIProvider] = [
            ClaudeProvider(),
            OpenAIProvider(),
            GeminiProvider(),
            PerplexityProvider(),
        ]

    async def generate_with_consensus(
        self, input: GenerationInput, ideas_per_model: int = 3
    ) -> ConsensusResult:
        # Run all providers in parallel
        tasks = [
            self._safe_generate(provider, input, ideas_per_model)
            for provider in self.providers
        ]
        results = await asyncio.gather(*tasks)

        # Collect successful results
        all_ideas: list[GeneratedIdea] = []
        model_responses = {}
        for provider, ideas in zip(self.providers, results):
            if ideas:
                model_responses[provider.name] = ideas
                all_ideas.extend(ideas)

        # Score and rank ideas by similarity
        ranked = self._rank_by_consensus(all_ideas)
        agreement = len(model_responses) / len(self.providers)

        return ConsensusResult(
            ideas=ranked[:10],
            agreement=agreement,
            model_responses=model_responses,
            cost=self._estimate_cost(model_responses)
        )

    async def _safe_generate(
        self, provider: AIProvider, input: GenerationInput, count: int
    ) -> list[GeneratedIdea] | None:
        try:
            return await asyncio.wait_for(
                provider.generate_ideas(input, count),
                timeout=30.0
            )
        except Exception as e:
            print(f"Provider {provider.name} failed: {e}")
            return None

    def _rank_by_consensus(self, ideas: list[GeneratedIdea]) -> list[GeneratedIdea]:
        # Group similar ideas and score by frequency
        scored = []
        for idea in ideas:
            score = sum(
                1 for other in ideas
                if self._similar(idea, other)
            )
            scored.append((idea, score))

        scored.sort(key=lambda x: (-x[1], -x[0].estimated_mrr))
        return [idea for idea, _ in scored]

    def _similar(self, a: GeneratedIdea, b: GeneratedIdea) -> bool:
        # Simple similarity: same industry keywords
        a_words = set(a.title.lower().split())
        b_words = set(b.title.lower().split())
        return len(a_words & b_words) >= 2

    def _estimate_cost(self, responses: dict) -> float:
        costs = {"claude": 0.15, "gpt4": 0.20, "gemini": 0.05, "perplexity": 0.10}
        return sum(costs.get(name, 0) for name in responses.keys())
