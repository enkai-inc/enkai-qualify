---
name: mcp-builder
description: "Build MCP servers following Anthropic's official 4-phase guide: research, implement, review, evaluate."
---

# MCP Builder Skill

Build Model Context Protocol (MCP) servers following Anthropic's official methodology.

## When to Use

- "Build an MCP server for [service]"
- "Create an MCP integration"
- When `/build` detects MCP server work (tool definitions, `McpServer`, `mcp` imports)

## 4-Phase Workflow

```
Phase 1: Research & Plan → Phase 2: Implement → Phase 3: Review & Test → Phase 4: Evaluate
```

### Phase 1: Research & Plan

1. **Study the target API** — Read official docs for the service you're wrapping
2. **Inventory endpoints** — List all operations; prioritize by agent usefulness
3. **Design tool surface** — Balance API coverage vs. workflow convenience

**Tool Design Principles:**

| Principle | Good | Bad |
|-----------|------|-----|
| Clear naming | `github_create_issue` | `create` |
| Focused scope | One operation per tool | Multi-step wizard |
| Concise descriptions | "List open PRs for a repo" | "This tool allows you to..." |
| Filtered output | Return relevant fields | Dump entire API response |
| Actionable errors | "Repo not found. Check owner/name." | "404" |

**Plan output:**
- Tool inventory with names, descriptions, required params
- Authentication strategy
- Error handling approach
- Which SDK (TypeScript recommended, Python acceptable)

### Phase 2: Implement

**Input validation** — Use Zod (TS) or Pydantic (Python):
```typescript
const CreateIssueInput = z.object({
  owner: z.string().describe("Repository owner"),
  repo: z.string().describe("Repository name"),
  title: z.string().describe("Issue title"),
  body: z.string().optional().describe("Issue body in markdown"),
});
```

**Tool annotations** — Add behavioral hints:
```typescript
{
  readOnlyHint: true,      // doesn't modify state
  destructiveHint: false,  // doesn't delete data
  idempotentHint: true,    // safe to retry
  openWorldHint: false,    // complete results
}
```

**Output format** — Use `structuredContent` for typed responses:
```typescript
return {
  structuredContent: {
    type: "resource",
    resource: { uri, mimeType: "application/json", text: JSON.stringify(result) }
  }
};
```

**Error handling** — Always return helpful messages:
```typescript
catch (error) {
  if (error.status === 404) {
    throw new McpError(ErrorCode.InvalidRequest, `Repo ${owner}/${repo} not found`);
  }
  throw new McpError(ErrorCode.InternalError, `GitHub API error: ${error.message}`);
}
```

### Phase 3: Review & Test

**Quality checklist:**
- [ ] No duplicated code between tools
- [ ] Consistent error handling across all tools
- [ ] Full type coverage (no `any`)
- [ ] Every tool has a clear, concise description
- [ ] Input schemas have `.describe()` on every field
- [ ] Annotations set correctly (read-only, destructive, idempotent)
- [ ] Output filtered to relevant fields (no response dumps)
- [ ] Build succeeds: `npm run build`

**Test with MCP Inspector:**
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Phase 4: Create Evaluations

Write 10 evaluation questions that test the server in realistic scenarios:

**Requirements per question:**
- Independent (no ordering dependency)
- Read-only (don't mutate external state)
- Complex (requires multiple tool calls)
- Realistic (mirrors actual agent usage)
- Verifiable (has a concrete expected answer)

**Format:**
```xml
<evaluation>
  <qa_pair>
    <question>How many open issues does owner/repo have with the "bug" label?</question>
    <answer>The repository has X open issues labeled "bug".</answer>
  </qa_pair>
</evaluation>
```

## Integration with /build

When `/build` scaffolder detects MCP server work:
1. Reference this skill for implementation patterns
2. Ensure tool annotations are set
3. Verify input schemas use validation library
4. Check that error messages are actionable

## Pedro-Specific Rules

- No AWS Amplify integrations
- ECS Fargate for any long-running MCP server hosting
- AWS CodePipeline for CI/CD, not GitHub Actions
- Follow existing MCP patterns in `.claude/settings.json`
