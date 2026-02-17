/**
 * AI Service for idea generation and refinement
 * Uses Anthropic Claude for intelligent idea processing
 */

import Anthropic from '@anthropic-ai/sdk';

// Lazy-initialized Anthropic client to avoid build-time errors
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export interface IdeaGenerationInput {
  industry: string;
  targetMarket: string;
  problemDescription: string;
  preferences?: {
    complexity?: 'simple' | 'moderate' | 'complex';
    timeline?: 'quick' | 'medium' | 'long';
  };
}

export interface GeneratedIdea {
  title: string;
  description: string;
  features: Array<{
    id: string;
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  technologies: string[];
  marketAnalysis: string;
}

export interface RefinementInput {
  idea: {
    title: string;
    description: string;
    industry: string;
    targetMarket: string;
    technologies: string[];
    features: Array<{
      name: string;
      description: string;
    }>;
  };
  prompt: string;
}

export interface RefinedIdea {
  title: string;
  description: string;
  features: Array<{
    id: string;
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  technologies: string[];
  summary: string;
}

export async function generateIdea(
  input: IdeaGenerationInput
): Promise<GeneratedIdea> {
  const systemPrompt = `You are an expert SaaS product strategist. Given a problem description and context, you generate detailed, actionable SaaS product ideas.

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

Include 5-8 features prioritized by importance. Suggest modern, practical technologies.`;

  const userPrompt = `Generate a SaaS product idea for:
- Industry: ${input.industry}
- Target Market: ${input.targetMarket}
- Problem/Opportunity: ${input.problemDescription}
${input.preferences?.complexity ? `- Complexity Level: ${input.preferences.complexity}` : ''}
${input.preferences?.timeline ? `- Timeline: ${input.preferences.timeline}` : ''}

Generate a detailed, buildable product idea.`;

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    const parsed = JSON.parse(content.text);
    return parsed as GeneratedIdea;
  } catch {
    throw new Error('Failed to parse AI response');
  }
}

export async function refineIdea(input: RefinementInput): Promise<RefinedIdea> {
  const systemPrompt = `You are an expert SaaS product strategist helping refine a product idea. Based on the user's feedback, update the idea accordingly.

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
}`;

  const userPrompt = `Current idea:
Title: ${input.idea.title}
Description: ${input.idea.description}
Industry: ${input.idea.industry}
Target Market: ${input.idea.targetMarket}
Technologies: ${input.idea.technologies.join(', ')}
Features:
${input.idea.features.map((f) => `- ${f.name}: ${f.description}`).join('\n')}

User feedback: ${input.prompt}

Refine the idea based on this feedback.`;

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    const parsed = JSON.parse(content.text);
    return parsed as RefinedIdea;
  } catch {
    throw new Error('Failed to parse AI response');
  }
}

export interface ValidationInput {
  idea: {
    title: string;
    description: string;
    industry: string;
    targetMarket: string;
    features: Array<{
      name: string;
      description: string;
    }>;
  };
}

export interface ValidationResult {
  keywordScore: number; // 0-100 - How well the idea aligns with trending keywords
  painPointScore: number; // 0-100 - How well it addresses real pain points
  competitionScore: number; // 0-100 - Market positioning (higher = less competition)
  revenueEstimate: number; // Estimated monthly revenue potential in USD
  overallScore: number; // 0-100 - Weighted average
  details: {
    marketSize: string;
    competitorCount: number;
    feasibilityNotes: string;
  };
}

export async function validateIdea(
  input: ValidationInput
): Promise<ValidationResult> {
  const systemPrompt = `You are a market research expert evaluating SaaS product ideas. Analyze the idea and provide realistic scores.

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

Be realistic and critical. Most ideas should score between 40-75.`;

  const userPrompt = `Evaluate this SaaS idea:
Title: ${input.idea.title}
Description: ${input.idea.description}
Industry: ${input.idea.industry}
Target Market: ${input.idea.targetMarket}
Features:
${input.idea.features.map((f) => `- ${f.name}: ${f.description}`).join('\n')}

Provide a detailed validation with realistic scores.`;

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    system: systemPrompt,
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type');
  }

  try {
    const parsed = JSON.parse(content.text);
    return parsed as ValidationResult;
  } catch {
    throw new Error('Failed to parse AI response');
  }
}
