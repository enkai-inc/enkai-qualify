import { Octokit } from '@octokit/rest';

const REPO_OWNER = 'tegryan-ddo';
const REPO_NAME = 'metis';
const IDEA_GENERATION_LABEL = 'metis:idea-generation';

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN environment variable is not set');
  }
  return new Octokit({ auth: token });
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
      description: 'Idea generation request from Metis dashboard',
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
UPDATE "Idea" SET
  title = '<generated_title>',
  description = '<generated_description>',
  technologies = '<json_array>',
  features = '<json_array>',
  status = 'DRAFT',
  "generatedAt" = NOW()
WHERE id = '${request.ideaId}';
\`\`\`
`;

  const issue = await octokit.issues.create({
    owner: REPO_OWNER,
    repo: REPO_NAME,
    title: `[Idea Generation] ${request.industry} - ${request.targetMarket}`,
    body: issueBody,
    labels: [IDEA_GENERATION_LABEL],
  });

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
