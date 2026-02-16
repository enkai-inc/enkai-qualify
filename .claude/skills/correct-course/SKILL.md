---
name: correct-course
description: "Mid-sprint course correction: trigger detection, impact analysis, structured proposals."
---

# Course Correction Skill

Handle mid-sprint direction changes when existing plans need adjustment. Fills the gap between `/plan` (creating new plans) and `/execute` (running approved plans) -- this skill is for when the plan itself needs to change.

## When to Use This Skill

- Requirements changed after planning started
- Failing tests reveal a flawed approach
- Design review surfaced better alternatives
- External dependency changed (API, library, service)
- User requests a pivot mid-implementation
- Sprint retrospective identified a course correction

Do NOT use this skill for:
- Creating new plans from scratch (use `/plan`)
- Executing an already-approved plan (use `/execute`)
- Bug fixes that don't affect the plan (use `/bug`)

## Invocation

```
/correct-course                         # Interactive — will ask what changed
/correct-course <description>           # Describe the change needed
/correct-course #<issue_number>         # Correct course for a specific plan issue
```

## Workflow Overview

```
Trigger (what changed?)
         |
         v
+--------------------------+
| 1. Trigger Detection     |
|    Classify scope & type |
+--------------------------+
         |
         v
+--------------------------+
| 2. Load Project Context  |
|    Constraints, plan,    |
|    git history, PRs      |
+--------------------------+
         |
         v
+--------------------------+
| 3. Impact Analysis       |
|    Files, PRs, issues,   |
|    breaking changes,     |
|    cost assessment       |
+--------------------------+
         |
         v
+--------------------------+
| 4. Draft Proposals       |
|    Old -> New format     |
|    with rationale        |
+--------------------------+
         |
         v
+--------------------------+
| 5. Execute Corrections   |
|    Incremental or batch  |
|    with validation       |
+--------------------------+
         |
         v
   Summary & next steps
```

---

## Phase 1: Trigger Detection

Identify what triggered the course correction and classify the change.

### Trigger Types

| Trigger | Signal | Example |
|---------|--------|---------|
| **User request** | Explicit direction change | "We need to use DynamoDB instead of PostgreSQL" |
| **Failing tests** | Tests reveal flawed approach | Integration tests fail on the planned API shape |
| **Design change** | Better approach discovered | Review revealed a simpler architecture |
| **New requirements** | Scope added or changed | "We also need to support bulk operations" |
| **External dependency** | Upstream change | Third-party API deprecated an endpoint |

### Change Scope Classification

| Scope | Criteria | Typical Impact |
|-------|----------|----------------|
| **Minor tweak** | 1-3 files, no API changes, no new dependencies | Single PR adjustment |
| **Moderate pivot** | 4-10 files, some API changes, approach shift | Multiple PRs need updating |
| **Major direction change** | 11+ files, new architecture, data model changes | Plan needs significant rework |

### Detection Steps

1. Ask or infer: **What changed?** (the trigger)
2. Ask or infer: **What was the original plan?** (reference issue or description)
3. Classify the scope: minor / moderate / major
4. Record the trigger type and scope for downstream phases

```markdown
## Trigger Assessment

**Trigger type**: [user_request | failing_tests | design_change | new_requirements | external_dependency]
**Description**: [what changed]
**Original plan**: #[issue] or [description]
**Scope**: [minor_tweak | moderate_pivot | major_direction_change]
```

---

## Phase 2: Load Project Context

Gather the full picture before analyzing impact.

### 2.1 Read Project Constraints

```bash
# Read CLAUDE.md for hard constraints
cat .claude/CLAUDE.md

# Read project config for labels, paths, AWS settings
cat .claude/project.config.json
```

### 2.2 Read Current Plan / Spec

If a plan issue exists:
```bash
# Fetch the plan issue and its comments
gh issue view <issue_number> --json title,body,comments,labels,state

# Fetch related feature spec issues
gh issue list --label "feature-spec" --json number,title,state
```

If a design document exists, read the relevant feature docs from the atlas.

### 2.3 Read Recent Git History

```bash
# Recent commits on current branch
git log --oneline -20

# What's changed since branching from main
git diff main...HEAD --stat

# Current work-in-progress
git status
```

### 2.4 Read In-Flight Work

```bash
# Open PRs from this project
gh pr list --state open --json number,title,headRefName,labels

# Open issues in the current epic/plan
gh issue list --label "in-progress" --json number,title,assignees
```

---

## Phase 3: Impact Analysis

Run through a structured checklist to understand the full impact of the correction.

### Impact Checklist

| # | Question | Assessment |
|---|----------|------------|
| 1 | **Which files/modules are affected?** | List specific paths |
| 2 | **Which in-flight PRs will be impacted?** | List PR numbers and required changes |
| 3 | **Which planned issues become obsolete?** | List issues to close or update |
| 4 | **Which planned issues need updating?** | List issues with required edits |
| 5 | **Are there breaking changes?** | API, schema, config, or contract changes |
| 6 | **Are there dependency changes?** | New, removed, or version-changed packages |
| 7 | **What tests need updating?** | Existing tests that will break or need new coverage |

### Cost Assessment

Estimate the cost of correction vs. starting over:

```markdown
## Cost Assessment

### Correction Path
- Files to modify: [N]
- PRs to update: [N]
- Issues to revise: [N]
- Estimated effort: [low | medium | high]

### Start-Over Path
- Files to rewrite: [N]
- PRs to close: [N]
- Issues to recreate: [N]
- Estimated effort: [low | medium | high]

### Recommendation: [correct | start_over]
**Rationale**: [why this path is better]
```

**Rule of thumb**: If correction touches more than 70% of the original plan, starting over is usually cheaper.

---

## Phase 4: Draft Proposals

For each change needed, produce a structured proposal in old-to-new format.

### Proposal Format

For each change, create a proposal block:

```markdown
### Change: [descriptive title]

**Old:** [what was planned or currently exists]
**New:** [what should happen instead]
**Rationale:** [why this change is needed]
**Affected:** [files, issues, PRs]
**Risk:** low | medium | high
```

### Example Proposals

```markdown
### Change: Switch data store from PostgreSQL to DynamoDB

**Old:** User records stored in PostgreSQL with Prisma ORM
**New:** User records stored in DynamoDB with single-table design
**Rationale:** Team decided to go fully serverless; PostgreSQL requires a managed instance
**Affected:** src/models/user.ts, src/db/prisma.ts, #145, #147, PR #12
**Risk:** high

---

### Change: Add bulk operation support to API

**Old:** API only supports single-record CRUD operations
**New:** API adds /bulk endpoint for batch create/update/delete
**Rationale:** Customer feedback requires processing 1000+ records at once
**Affected:** src/api/routes.ts, src/services/user.ts, #150
**Risk:** medium

---

### Change: Update test fixtures for new schema

**Old:** Test fixtures use PostgreSQL schema with auto-increment IDs
**New:** Test fixtures use DynamoDB schema with UUID partition keys
**Rationale:** Cascading change from data store switch
**Affected:** tests/fixtures/*.ts, tests/integration/*.test.ts
**Risk:** low
```

### Proposal Summary Table

After drafting all proposals, summarize:

```markdown
## Correction Summary

| # | Change | Risk | Affected Files | Affected Issues |
|---|--------|------|----------------|-----------------|
| 1 | [title] | high | 5 files | #145, #147 |
| 2 | [title] | medium | 2 files | #150 |
| 3 | [title] | low | 8 files | — |

**Total affected files**: [N]
**Total affected issues**: [N]
**Total affected PRs**: [N]
**Overall risk**: [low | medium | high]
```

---

## Phase 5: Execution Mode

Apply the corrections either incrementally or all at once.

### Mode Selection

Present the user with execution options:

```markdown
## Execution Mode

How should corrections be applied?

1. **Incremental** (recommended) — Apply one change at a time with validation between each
2. **Batch** — Apply all changes at once (faster, higher risk)

Default: Incremental
```

### Incremental Execution

For each proposal, in order from lowest to highest risk:

1. **Announce** the change being applied
2. **Apply** the code/config/issue changes
3. **Validate** — run tests, lint, type-check as appropriate
4. **Report** the result before moving to the next change
5. **Pause on failure** — if validation fails, stop and report

```markdown
## Applying Change 1/3: [title]

**Status**: in_progress
**Applying to**: [file list]

... [make changes] ...

**Validation**:
- Lint: PASS
- Type check: PASS
- Tests: PASS

**Status**: complete
```

### Batch Execution

Apply all changes at once, then validate:

1. **Announce** all changes being applied
2. **Apply** all code/config/issue changes
3. **Validate** everything together
4. **Report** results

### Post-Execution: Update Tracking

After applying corrections:

```bash
# Update the plan issue with correction notes
gh issue comment <plan_issue> --body "## Course Correction Applied

[correction summary with all proposals and results]"

# Close obsolete issues
gh issue close <obsolete_issue> --comment "Closed: superseded by course correction in #<plan_issue>"

# Update affected issues with new scope
gh issue edit <affected_issue> --body "[updated body]"

# Update affected PR descriptions
gh pr edit <affected_pr> --body "[updated body with correction notes]"
```

---

## Output Format

After completing all phases, provide a final summary:

```markdown
## Course Correction Complete

### Trigger
**Type**: [trigger type]
**Scope**: [minor_tweak | moderate_pivot | major_direction_change]
**Description**: [what changed and why]

### Changes Applied

| # | Change | Risk | Status |
|---|--------|------|--------|
| 1 | [title] | high | applied |
| 2 | [title] | medium | applied |
| 3 | [title] | low | applied |

### Impact Summary
- **Files modified**: [N]
- **Issues updated**: [list]
- **Issues closed**: [list]
- **PRs updated**: [list]

### Validation Results
- Lint: PASS/FAIL
- Type check: PASS/FAIL
- Tests: PASS/FAIL

### Next Steps
1. [Review updated issues]
2. [Continue execution with /execute if plan was updated]
3. [Re-run /confidence-check if scope changed significantly]
```

---

## Instructions for AI

When executing `/correct-course`:

### 1. Input Parsing
- If user provides a description: use it as the trigger description
- If user provides an issue number: fetch the plan issue as context
- If no input: ask what changed

### 2. Context Loading
- Always read CLAUDE.md for constraints
- Always check recent git history
- Always check open PRs and issues
- Read the original plan if one exists

### 3. Impact Analysis
- Be thorough — check every item on the checklist
- List specific file paths, not vague references
- Always assess whether correction or restart is cheaper

### 4. Proposal Drafting
- Every proposal MUST follow the Old/New/Rationale/Affected/Risk format
- Group related changes together
- Order proposals by dependency (prerequisites first)

### 5. Execution
- Default to incremental mode unless user explicitly requests batch
- Validate after every change in incremental mode
- Stop on first failure and report — do not continue blindly
- Update all tracking artifacts (issues, PRs) after execution

### 6. Error Handling
- **GitHub API errors**: Retry once, report if persistent
- **Validation failures**: Stop, report the failure, suggest fix
- **Scope creep**: If analysis reveals more changes than expected, pause and re-assess scope classification
- **Conflicts with constraints**: Flag CLAUDE.md violations immediately, do not proceed

---

## Example Session

```
User: /correct-course We need to switch from REST to GraphQL for the dashboard API

AI: I'll analyze this course correction.

## Phase 1: Trigger Detection

**Trigger type**: design_change
**Description**: Switch dashboard API from REST to GraphQL
**Scope**: major_direction_change (affects API layer, client code, tests)

## Phase 2: Loading Context

Reading CLAUDE.md... (no constraints against GraphQL)
Reading current plan... Found #200 [PLAN] Dashboard API
Reading git history... 3 commits on feature/dashboard-api branch
Reading open PRs... PR #45 (REST endpoint implementation)

## Phase 3: Impact Analysis

| # | Question | Assessment |
|---|----------|------------|
| 1 | Files affected | 12 files: src/api/*, src/client/*, tests/api/* |
| 2 | In-flight PRs | PR #45 (REST endpoints) — needs full rework |
| 3 | Obsolete issues | #201 [FS] REST endpoint design |
| 4 | Issues needing update | #202, #203 (consumer issues reference REST) |
| 5 | Breaking changes | Yes — all API consumers need updating |
| 6 | Dependency changes | Add graphql, @apollo/server; remove express-router |
| 7 | Test updates | All API tests need rewriting |

### Cost Assessment
- Correction: 12 files, 1 PR, 3 issues — HIGH effort
- Start over: 12 files, 1 PR, 3 issues — HIGH effort
- **Recommendation**: correct (same effort, preserves git history)

## Phase 4: Proposals

### Change: Replace REST router with GraphQL schema
**Old:** Express router with RESTful endpoints in src/api/routes.ts
**New:** Apollo Server with GraphQL schema in src/api/schema.graphql + src/api/resolvers.ts
**Rationale:** GraphQL provides better query flexibility for dashboard's varied data needs
**Affected:** src/api/routes.ts, src/api/resolvers.ts (new), src/api/schema.graphql (new)
**Risk:** high

### Change: Update client to use GraphQL queries
**Old:** fetch() calls to REST endpoints in src/client/api.ts
**New:** Apollo Client with typed queries in src/client/queries.ts
**Rationale:** Cascading change from API switch
**Affected:** src/client/api.ts, src/client/queries.ts (new)
**Risk:** medium

### Change: Rewrite API tests for GraphQL
**Old:** supertest-based REST endpoint tests
**New:** Apollo Server test client with query assertions
**Rationale:** Cascading change from API switch
**Affected:** tests/api/*.test.ts
**Risk:** low

## Execution Mode

Recommending **incremental** (3 changes, high overall risk).

Apply changes? [incremental / batch / abort]

User: incremental

AI: Applying Change 1/3: Replace REST router with GraphQL schema...
[implements changes]
Validation: Lint PASS, Types PASS, Tests SKIP (dependent changes pending)

Applying Change 2/3: Update client to use GraphQL queries...
[implements changes]
Validation: Lint PASS, Types PASS, Tests SKIP (test rewrite pending)

Applying Change 3/3: Rewrite API tests...
[implements changes]
Validation: Lint PASS, Types PASS, Tests 14/14 PASS

## Course Correction Complete

All 3 changes applied successfully.
- Files modified: 12
- Issues updated: #200, #202, #203
- Issues closed: #201
- PRs updated: PR #45
```
