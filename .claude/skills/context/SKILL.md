---
name: context
description: "Just-in-time context loading for token-efficient agent operations."
---

# JIT Context Loading Skill

Implements just-in-time context loading to reduce token usage while maintaining task success rates.

## Motivation

Traditional approach loads comprehensive context upfront, leading to:
- High token usage even for simple tasks
- Context window pollution with irrelevant information
- Increased costs and latency

JIT loading loads only what is needed, when it is needed.

## When to Use This Skill

- When starting any implementation task
- When context seems insufficient for the current step
- When you need to understand a specific part of the codebase
- When referenced files or symbols are not in context

## Context Tiers

### Tier 0: Essential (Always Loaded)
- CLAUDE.md (project instructions)
- Current issue/task description
- File manifest (paths and brief descriptions)
- Artifact precedent summary (from context-query-agent, capped at 500 tokens)

### Tier 1: On-Demand (Load When Needed)
- Specific file contents
- Symbol definitions (functions, classes)
- Related test files
- Import dependencies

### Tier 2: Reference (Load Only If Required)
- Full documentation
- Historical patterns
- Architectural diagrams
- Extended examples

## Loading Strategies

### 1. Manifest-First Approach

Start with file manifest instead of full contents:

```
## Files in src/components/
- Button.tsx (42 lines) - Reusable button component
- Modal.tsx (156 lines) - Modal dialog component
- Form.tsx (234 lines) - Form wrapper with validation
```

Then load specific files as needed:
```
Load: src/components/Modal.tsx
Reason: Need to understand modal API for this feature
```

### 2. Symbol-Level Loading

Load function/class signatures without full implementations:

```typescript
// src/services/api.ts - Signatures Only
export async function fetchUser(id: string): Promise<User>
export async function updateUser(id: string, data: Partial<User>): Promise<User>
export async function deleteUser(id: string): Promise<void>
```

Then load full implementation when needed:
```
Expand: fetchUser implementation
Reason: Need to understand error handling pattern
```

### 3. Dependency Chain Loading

Load only direct dependencies, not transitive:

```
File: src/hooks/useAuth.ts
Direct imports:
- @/services/api (fetchUser, updateUser)
- @/context/AuthContext (useAuthContext)
- react (useState, useEffect)

Load direct imports only, not their dependencies.
```

### 4. Summary-Based Context

Use summaries for large files:

```
## File Summary: src/utils/validation.ts (450 lines)

Purpose: Form validation utilities

Key exports:
- validateEmail(email: string): boolean
- validatePassword(pwd: string): ValidationResult
- validateForm(data: object, schema: Schema): ValidationErrors

Common patterns:
- Returns boolean or error objects
- Uses regex for string validation
- Supports custom validators via schema
```

## Workflow

### Step 1: Assess Task Requirements

Before loading context, analyze what you need:

```
Task: Add email verification to signup flow

Likely needed:
- [ ] Signup component (where to add)
- [ ] API service (how to call backend)
- [ ] Email service (if exists)
- [ ] Validation patterns (existing patterns)

NOT needed:
- [ ] Dashboard components
- [ ] Billing service
- [ ] Admin features
```

### Step 2: Load Minimal Context

Start with the smallest context that might work:

```bash
# Load file manifest
ls -la src/components/auth/

# Load relevant file
Read: src/components/auth/SignupForm.tsx

# Load related test (for patterns)
Read: src/components/auth/SignupForm.test.tsx
```

### Step 3: Expand As Needed

When you hit a knowledge gap, load more:

```
Gap: Unknown how API calls are structured

Action: Load src/services/api.ts
Result: Found fetchUser pattern, will follow same structure
```

### Step 4: Prune Unused Context

After each major step, note what was not used:

```
Loaded but unused:
- src/utils/validation.ts (did not need custom validation)
- src/context/AuthContext.ts (already in scope via imports)

For similar tasks, skip these files.
```

## Context Loading Commands

### Load File Section
```
Load lines 50-100 of src/services/api.ts
```

### Load Symbol
```
Load function createUser from src/services/api.ts
```

### Load Related Files
```
Load imports and test file for src/components/Button.tsx
```

### Expand Reference
```
Expand summary for src/utils/validation.ts to full content
```

## Pruning Strategies

### Time-Based Pruning
- Mark context as "stale" after 10 tool calls without reference
- Summarize stale context instead of keeping verbatim

### Size-Based Pruning
- When context exceeds 50K tokens, summarize oldest entries
- Keep recent (last 5 files) at full fidelity

### Relevance-Based Pruning
- Track which context was actually referenced
- Remove context that was never used after 3 steps

## Metrics

Track these metrics to measure JIT effectiveness:

| Metric | Target |
|--------|--------|
| Initial context tokens | < 10K |
| Average tokens per task | < 30K |
| Context load requests | < 10 per task |
| Task success rate | >= 95% |

## Example Session

### Before JIT (Traditional)
```
[Initial Load: 80K tokens]
- CLAUDE.md
- Feature Atlas (full)
- All component files
- All service files
- All test files
```

### After JIT
```
[Initial Load: 5K tokens]
- CLAUDE.md
- Task description
- File manifest

[On-Demand Load: +8K tokens]
- SignupForm.tsx (needed for modification)
- api.ts (needed for API pattern)
- SignupForm.test.tsx (needed for test patterns)

[Total: 13K tokens - 84% reduction]
```

## Artifact-Based Precedent Loading

At session start, the context-query-agent (`.claude/agents/context-query-agent.md`) queries the artifact index for relevant precedent from past sessions. This enables compound learning across sessions.

### How It Works

```
New session starts
  -> Extract query from current task (issue number, tags, file paths)
  -> Context-query-agent scans .claude/artifacts/ (handoffs, plans, ledgers)
  -> Agent ranks matches by tag overlap, issue reference, file overlap, recency
  -> Returns a 500-token precedent summary
  -> Summary loaded as Tier 0 context alongside CLAUDE.md and task description
```

### Artifact Types

| Type | Directory | Contains |
|------|-----------|----------|
| Handoffs | `artifacts/handoffs/` | Session summaries: decisions, gotchas, files changed |
| Plans | `artifacts/plans/` | Execution plans and design decisions |
| Ledgers | `artifacts/ledgers/` | Session metrics: tokens, duration, outcomes |
| Queries | `artifacts/queries/` | Cached query results (7-day TTL) |

See `.claude/artifacts/README.md` for the full artifact schema.

### Writing Artifacts

Artifacts are written by stop hooks when workflows complete:

```
Workflow completes (scrum/build/eval)
  -> Stop hook captures handoff metadata
  -> Writes to artifacts/handoffs/<issue>-<timestamp>.md
  -> Includes: issue, branch, status, key decisions, gotchas, files changed
```

### Querying Artifacts

The context-query-agent is invoked at session start with the current task context. It searches by:
1. Issue number (exact match, highest weight)
2. Semantic tags (e.g., `frontend`, `auth`)
3. File path overlap (same files being modified)
4. Recency (last 7 days weighted higher)

If no artifacts match, the agent reports "no prior precedent" and the session proceeds normally.

## Integration Points

### With /plan skill
- Plan skill identifies required context
- Execute skill loads context just-in-time

### With /verify skill
- Verify loads only changed files
- Does not reload full codebase

### With /critic skill
- Critic loads fresh context
- Does not inherit generator context

### With context-query-agent
- Queries artifact index at session start for compound learning
- Injects 500-token precedent summary into Tier 0 context
- See `.claude/agents/context-query-agent.md`

## Guidelines

1. **Start small** - Always begin with minimal context
2. **Load incrementally** - Add context only when blocked
3. **Note unused context** - Track what was loaded but not used
4. **Summarize aggressively** - Full content only when modifying
5. **Measure continuously** - Track token usage per task type

## Error Recovery

If JIT loading causes a failure:

1. **Retry with expanded context**
   - Load related files
   - Load full dependencies
   
2. **Fall back to comprehensive load**
   - For complex, cross-cutting changes
   - Note as "JIT insufficient" for learning

3. **Update loading heuristics**
   - Record what additional context was needed
   - Improve future predictions
