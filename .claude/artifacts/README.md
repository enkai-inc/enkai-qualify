# Artifact Index

Persistent store of session artifacts for compound learning across agent sessions. The context-query-agent reads from this index to inject relevant precedent into new sessions.

## Directory Structure

```
artifacts/
  handoffs/     # Session handoff summaries from completed workflows
  plans/        # Execution plans and design decisions
  ledgers/      # Session ledgers tracking token usage, outcomes, durations
  queries/      # Cached query results for repeated lookups
```

## Artifact Schema

### Handoffs (`handoffs/<issue>-<timestamp>.md`)

Written by stop hooks when a workflow (scrum, build, eval) completes.

```yaml
---
issue: 42
workflow: build
branch: issue-42
status: success | failure
pr: https://github.com/owner/repo/pull/99
timestamp: 2025-06-01T12:00:00Z
tags: [frontend, auth, refactor]
---

## Summary
One-paragraph description of what was done.

## Key Decisions
- Chose X over Y because Z

## Gotchas
- File A requires special handling due to B

## Files Changed
- src/components/Auth.tsx
- src/services/api.ts
```

### Plans (`plans/<issue>-<timestamp>.md`)

Captured from /plan or /design output before execution begins.

```yaml
---
issue: 42
skill: design
depth: full
timestamp: 2025-06-01T11:00:00Z
tags: [frontend, auth]
---

## Objective
What the plan aims to achieve.

## Steps
1. Step one
2. Step two

## Dependencies
- Depends on issue #40 being merged

## Risks
- Risk A: mitigation strategy
```

### Ledgers (`ledgers/<session>-<timestamp>.md`)

Session-level metrics for tracking agent efficiency over time.

```yaml
---
session: scrum-worker-1
issues_processed: [42, 43]
timestamp: 2025-06-01T13:00:00Z
duration_minutes: 25
tokens_used: 45000
outcome: success
---

## Issues
| Issue | Status | Duration | Tokens |
|-------|--------|----------|--------|
| #42   | success | 12m     | 22000  |
| #43   | success | 13m     | 23000  |
```

### Queries (`queries/<query-hash>.md`)

Cached query results from the context-query-agent. Automatically expired after 7 days.

```yaml
---
query: "auth pattern frontend"
matched_artifacts: 3
timestamp: 2025-06-01T14:00:00Z
expires: 2025-06-08T14:00:00Z
---

## Results
- handoffs/42-20250601.md (score: 0.9) - Auth refactor with JWT
- plans/38-20250530.md (score: 0.7) - Frontend auth design
- handoffs/35-20250528.md (score: 0.5) - API auth middleware
```

## Indexing Strategy

Artifacts are matched by:
1. **Tags** -- semantic tags assigned to each artifact (e.g., `frontend`, `auth`, `refactor`)
2. **Issue references** -- cross-referencing by issue number or epic
3. **Recency** -- more recent artifacts score higher
4. **File overlap** -- artifacts touching similar files are ranked higher for file-related queries

## Size Constraints

- Individual artifact files should not exceed 2KB
- The context-query-agent output is capped at 500 tokens
- Query cache entries expire after 7 days
- Prune artifacts older than 90 days via `maint` skill
