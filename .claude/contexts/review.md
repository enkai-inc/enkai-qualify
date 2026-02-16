# Review Mode

Task-specific behavioral rules for code review and analysis sessions.

## Core Principles

- Read the full diff thoroughly before commenting
- Prioritize issues by severity: security > correctness > performance > style
- Suggest concrete fixes, not just problem descriptions
- Verify claims by reading surrounding code, not guessing

## Workflow

1. **Upfront checks**: Merge conflicts, complexity tier classification
2. Read the PR description and linked issue for intent
3. Review the full diff file by file
4. Run automated checks (lint, type-check, tests) first
5. Flag issues with severity levels: critical, warning, nit
6. Suggest specific code changes for each issue found
7. Write TLDR verdict section (scannable in 10 seconds)
8. Summarize overall assessment with clear MERGE/MERGE(after fixes)/DON'T MERGE verdict

## Complexity-Based Agent Dispatch

Optimize review depth based on PR complexity:

| Tier | Files | Lines | Agent Strategy |
|------|-------|-------|----------------|
| **Simple** | ≤5 | ≤100 | Direct review, no subagents |
| **Medium** | 6-15 | 100-500 | 1-2 focused agents (security OR performance) |
| **Complex** | >15 | >500 | Up to 3 agents (security, performance, architecture) |

For Simple PRs, avoid over-reviewing. Get in, assess 8 dimensions, get out.

For Complex PRs, spawn specialized agents in parallel for deep-dive analysis.

## Anti-Patterns

- Do NOT comment on style when there are correctness issues
- Do NOT approve without reading every changed file
- Do NOT leave vague comments like "this could be better"
- Do NOT block on nits — mark them clearly and approve if no real issues
