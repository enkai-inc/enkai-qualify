"""Base AI provider interface."""
from abc import ABC, abstractmethod
from pydantic import BaseModel


class GeneratedIdea(BaseModel):
    title: str
    description: str
    features: list[str]
    target_audience: str
    revenue_model: str
    difficulty: str
    estimated_mrr: int
    differentiators: list[str]
    risks: list[str]


class GenerationInput(BaseModel):
    industry: str
    target_market: str
    technologies: list[str]
    description: str | None = None


class AIProvider(ABC):
    name: str

    @abstractmethod
    async def generate_ideas(
        self, input: GenerationInput, count: int = 3
    ) -> list[GeneratedIdea]:
        pass
