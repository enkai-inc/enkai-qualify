import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import { logger } from '@/lib/logger';

const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'enkai-inc';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'enkai-qualify';
const IDEA_GENERATION_LABEL = 'enkai:agent-task';

// GitHub Apps may silently drop labels during issue creation due to permission
// scope. This fallback explicitly adds labels when they're missing.
// Non-fatal: label failure should never block issue creation.
async function ensureLabelsApplied(
  octokit: Octokit,
  issue: { number: number; labels: Array<string | { name?: string }> }
): Promise<void> {
  try {
    const hasLabel = issue.labels.some(
      (l) => (typeof l === 'string' ? l : l.name) === IDEA_GENERATION_LABEL
    );
    if (!hasLabel) {
      await octokit.issues.addLabels({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        issue_number: issue.number,
        labels: [IDEA_GENERATION_LABEL],
      });
    }
  } catch (error) {
    // Log but don't throw — missing label is recoverable, failing the
    // entire issue creation flow is not.
    logger.warn(`Failed to apply label to issue #${issue.number}`, { error: error instanceof Error ? error.message : String(error) });
  }
}

function getOctokit(): Octokit {
  // Prefer GitHub App auth (generates short-lived tokens automatically)
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (appId && installationId && privateKey) {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId,
      },
      request: { timeout: 30000 },
    });
  }

  // Fallback to static token
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN or GITHUB_APP_* environment variables are not set');
  }
  return new Octokit({ auth: token, request: { timeout: 30000 } });
}

export interface IdeaGenerationRequest {
  ideaId: string;
  userId: string;
  industry: string;
  targetMarket: string;
  problemDescription: string;
  preferences?: {
    complexity?: 'simple' | 'moderate' | 'complex';
    timeline?: 'quick' | 'medium' | 'long';
  };
}

export async function createIdeaGenerationIssue(
  request: IdeaGenerationRequest
): Promise<{ issueNumber: number; issueUrl: string }> {
  const octokit = getOctokit();

  // Ensure the label exists
  try {
    await octokit.issues.getLabel({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      name: IDEA_GENERATION_LABEL,
    });
  } catch {
    // Create label if it doesn't exist
    await octokit.issues.createLabel({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      name: IDEA_GENERATION_LABEL,
      color: '7057ff',
      description: 'Idea generation request from Enkai Qualify dashboard',
    });
  }

  const issueBody = `## Idea Generation Request

**Idea ID:** \`${request.ideaId}\`
**User ID:** \`${request.userId}\`

### Parameters

| Field | Value |
|-------|-------|
| Industry | ${request.industry} |
| Target Market | ${request.targetMarket} |
| Complexity | ${request.preferences?.complexity || 'moderate'} |
| Timeline | ${request.preferences?.timeline || 'medium'} |

### Problem Description

${request.problemDescription}

---

## Instructions for Processing Agent

1. Generate a SaaS idea based on the parameters above
2. Include: title, description, key features, technologies, market analysis
3. Update the idea record in the database using the Idea ID
4. Close this issue when complete

**Database update command:**
\`\`\`sql
-- Parameters: [ideaId]
UPDATE "Idea" SET
  title = '<generated_title>',
  description = '<generated_description>',
  technologies = '<json_array>',
  features = '<json_array>',
  status = 'DRAFT',
  "generatedAt" = NOW()
WHERE id = $1;
\`\`\`
`;

  const issue = await octokit.issues.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title: `[Idea Generation] ${request.industry} - ${request.targetMarket}`,
    body: issueBody,
    labels: [IDEA_GENERATION_LABEL],
  });

  await ensureLabelsApplied(octokit, issue.data);

  return {
    issueNumber: issue.data.number,
    issueUrl: issue.data.html_url,
  };
}

export interface ValidationIssueRequest {
  ideaId: string;
  userId: string;
  title: string;
  description: string;
  industry: string;
  targetMarket: string;
  features: Array<{ name: string; description: string }>;
}

export async function createValidationIssue(
  request: ValidationIssueRequest
): Promise<{ issueNumber: number; issueUrl: string }> {
  const octokit = getOctokit();

  const featuresText = request.features
    .map((f) => `- ${f.name}: ${f.description}`)
    .join('\n');

  const issueBody = `## Validation Request

**Idea ID:** \`${request.ideaId}\`
**User ID:** \`${request.userId}\`

### Parameters

| Field | Value |
|-------|-------|
| Title | ${request.title} |
| Industry | ${request.industry} |
| Target Market | ${request.targetMarket} |

### Description

${request.description}

### Features

${featuresText}

---

## Instructions for Processing Agent

1. Evaluate the SaaS idea using market analysis
2. Provide scores for keyword strength, pain point match, competition, revenue
3. Store the validation result in the database
4. Close this issue when complete
`;

  const issue = await octokit.issues.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title: `[Validation] ${request.title}`,
    body: issueBody,
    labels: [IDEA_GENERATION_LABEL],
  });

  await ensureLabelsApplied(octokit, issue.data);

  return {
    issueNumber: issue.data.number,
    issueUrl: issue.data.html_url,
  };
}

export interface RefinementIssueRequest {
  ideaId: string;
  userId: string;
  title: string;
  description: string;
  industry: string;
  targetMarket: string;
  technologies: string[];
  features: Array<{ name: string; description: string }>;
  prompt: string;
}

export async function createRefinementIssue(
  request: RefinementIssueRequest
): Promise<{ issueNumber: number; issueUrl: string }> {
  const octokit = getOctokit();

  const featuresText = request.features
    .map((f) => `- ${f.name}: ${f.description}`)
    .join('\n');

  const issueBody = `## Refinement Request

**Idea ID:** \`${request.ideaId}\`
**User ID:** \`${request.userId}\`

### Parameters

| Field | Value |
|-------|-------|
| Title | ${request.title} |
| Industry | ${request.industry} |
| Target Market | ${request.targetMarket} |

### Description

${request.description}

### Technologies

${request.technologies.join(', ')}

### Features

${featuresText}

### Refinement Prompt

${request.prompt}

---

## Instructions for Processing Agent

1. Refine the idea based on the user's feedback
2. Update title, description, features, and technologies as needed
3. Store the refined version in the database
4. Close this issue when complete
`;

  const issue = await octokit.issues.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title: `[Refinement] ${request.title}`,
    body: issueBody,
    labels: [IDEA_GENERATION_LABEL],
  });

  await ensureLabelsApplied(octokit, issue.data);

  return {
    issueNumber: issue.data.number,
    issueUrl: issue.data.html_url,
  };
}

export interface MarketScanIssueRequest {
  scanId: string;
  userId: string;
  industry: string;
  niche?: string;
}

export async function createMarketScanIssue(
  request: MarketScanIssueRequest
): Promise<{ issueNumber: number; issueUrl: string }> {
  const octokit = getOctokit();

  // Ensure the label exists
  try {
    await octokit.issues.getLabel({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      name: IDEA_GENERATION_LABEL,
    });
  } catch {
    await octokit.issues.createLabel({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      name: IDEA_GENERATION_LABEL,
      color: '7057ff',
      description: 'Idea generation request from Enkai Qualify dashboard',
    });
  }

  const nicheSection = request.niche
    ? `| Niche/Focus | ${request.niche} |`
    : '';

  const issueBody = `## Market Scan Request

**Scan ID:** \`${request.scanId}\`
**User ID:** \`${request.userId}\`

### Parameters

| Field | Value |
|-------|-------|
| Industry | ${request.industry} |
${nicheSection}

---

## Instructions for Processing Agent

1. Use DataForSEO keyword API to find high-volume search terms in the **${request.industry}** industry${request.niche ? ` with focus on **${request.niche}**` : ''}
2. Use Perplexity real-time web search to identify emerging pain points and market gaps
3. Use Claude to synthesize findings into scored market opportunities
4. Each opportunity should include: title, description, problem statement, demand signals, score (0-100), keywords, monthly search volume, competition level, trend direction, estimated revenue, and sources
5. Return 5-10 ranked opportunities

**Callback URL:** \`POST /api/internal/market-scans/${request.scanId}/result\`

**Callback payload shape:**
\`\`\`json
{
  "opportunities": [
    {
      "rank": 1,
      "title": "string",
      "description": "string",
      "problemStatement": "string",
      "demandSignals": ["string"],
      "score": 85,
      "keywords": ["string"],
      "monthlySearchVolume": 12000,
      "competition": "low|medium|high",
      "trendDirection": "rising|stable|declining",
      "estimatedRevenue": "$50K-200K ARR",
      "sources": ["DataForSEO", "Perplexity"]
    }
  ],
  "metadata": {}
}
\`\`\`
`;

  const titleSuffix = request.niche
    ? `${request.industry} - ${request.niche}`
    : request.industry;

  const issue = await octokit.issues.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title: `[Market Scan] ${titleSuffix}`,
    body: issueBody,
    labels: [IDEA_GENERATION_LABEL],
  });

  await ensureLabelsApplied(octokit, issue.data);

  return {
    issueNumber: issue.data.number,
    issueUrl: issue.data.html_url,
  };
}

export async function closeIdeaGenerationIssue(
  issueNumber: number,
  comment?: string
): Promise<void> {
  const octokit = getOctokit();

  if (comment) {
    await octokit.issues.createComment({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      issue_number: issueNumber,
      body: comment,
    });
  }

  await octokit.issues.update({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    issue_number: issueNumber,
    state: 'closed',
  });
}

export async function listPendingIdeaGenerationIssues(): Promise<
  Array<{
    number: number;
    title: string;
    body: string;
    createdAt: string;
  }>
> {
  const octokit = getOctokit();

  const issues = await octokit.issues.listForRepo({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    labels: IDEA_GENERATION_LABEL,
    state: 'open',
    sort: 'created',
    direction: 'asc',
  });

  return issues.data.map((issue) => ({
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    createdAt: issue.created_at,
  }));
}
