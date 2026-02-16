---
name: code-review
description: "8-dimension code review framework with severity taxonomy and complexity-based agent dispatch."
---

# Code Review Framework

Structured code review across 8 dimensions with consistent severity taxonomy and complexity-based agent allocation.

## When to Use

- During `/build` Step 4b (Quality Review)
- Standalone code reviews via `/critic`
- Pre-merge validation
- Security audits

## Phase 0: Upfront Checks

Before starting the review, run these quick checks:

### Merge Conflict Detection

```bash
# Check mergeable status upfront
gh pr view <number> --json mergeable,mergeStateStatus
```

If `mergeStateStatus` is `CONFLICTING`, stop and report:
```
⚠️ MERGE CONFLICT DETECTED

This PR has merge conflicts that must be resolved before review.
Conflicting files: [list from gh pr view]

Resolve conflicts first, then re-request review.
```

### Complexity Assessment

Classify the PR into complexity tiers to optimize agent allocation:

| Tier | Criteria | Agent Strategy |
|------|----------|----------------|
| **Simple** | ≤5 files AND ≤100 lines AND single author | Review directly, no subagents |
| **Medium** | 6-15 files, OR 100-500 lines, OR 2 contributors | Spawn 1-2 focused agents |
| **Complex** | >15 files, OR >500 lines, OR >2 contributors, OR touches core architecture | Spawn up to 3 agents (security, performance, architecture) |

```bash
# Get PR stats for classification
gh pr view <number> --json files,additions,deletions,commits,author
```

## Review Protocol

### Phase 1: Automated Checks

Run automated tools first — fix before manual review:

```bash
npm run lint        # Style/syntax
npx tsc --noEmit    # Type safety
npm run test        # Correctness
```

### Phase 2: Manual Review (8 Dimensions)

Review each changed file across all 8 dimensions:

#### 1. Code Quality
- Functions < 50 lines, files < 400 lines
- Clear naming (intent-revealing, not implementation-revealing)
- No duplicated logic
- Single responsibility per function/component
- No dead code or commented-out blocks

#### 2. Maintainability
- Could a new developer understand this in 5 minutes?
- Are complex sections documented?
- Is the abstraction level consistent?
- Are magic numbers/strings extracted to constants?

#### 3. Documentation
- Public APIs have JSDoc/docstrings
- Complex algorithms have explanatory comments
- No obvious documentation ("increment counter by 1")
- README updated if behavior changes

#### 4. Performance
- No N+1 query patterns
- No unnecessary re-renders (React)
- Expensive operations memoized or cached
- No synchronous I/O in hot paths
- Bundle size impact considered

#### 5. Security
- No hardcoded secrets or API keys
- User input validated and sanitized
- SQL/NoSQL injection prevented (parameterized queries)
- XSS prevented (output encoding)
- Authentication/authorization checks present
- Path traversal prevented
- CSRF protection in place

#### 6. Error Handling
- Errors caught and handled (not swallowed)
- User-facing error messages are helpful
- Async operations have error boundaries
- Failure modes are graceful (partial degradation)
- Logging present for debugging

#### 7. Testing
- New code has tests
- Edge cases covered
- Tests are meaningful (not just asserting true)
- Test names describe behavior, not implementation
- No flaky patterns (timeouts, race conditions)

#### 8. Scope Alignment (Merge Blocker)
- Compare PR title and description against actual diff content
- Is the PR focused on a single coherent change?
- Does the title accurately describe what the diff does?

**Scope Mismatch Detection:**
- If title says "fix X" but PR also adds feature Y → scope mismatch
- If description mentions single change but PR touches unrelated files → scope mismatch
- If >30% of changed lines are unrelated to stated purpose → scope mismatch

**IMPORTANT: Scope mismatch is a MERGE BLOCKER.** Suggest splitting the PR.

## Severity Taxonomy

| Level | Label | Merge? | Action |
|-------|-------|--------|--------|
| **CRITICAL** | Security vulnerability, data loss risk | BLOCK | Must fix before merge |
| **HIGH** | Logic error, major bug, missing validation | BLOCK | Must fix before merge |
| **MEDIUM** | Code smell, missing tests, performance issue | WARN | Should fix, can merge with justification |
| **LOW** | Style, minor improvement, documentation gap | PASS | Nice to have, don't block |

## TLDR Verdict Section

Every review MUST begin with a TLDR section that is scannable in under 10 seconds:

```markdown
## TLDR

- **What this PR does:** [One sentence describing the actual change]
- **Merge status:** Clean / Has conflicts (list files)
- **Complexity tier:** Simple / Medium / Complex
- **Scope alignment:** Aligned / Scope mismatch (blocker)
- **Key concerns:** [List main issues, or "No significant concerns"]
- **Verdict:** MERGE / MERGE (after fixes) / DON'T MERGE — [one-line reason]
```

### Verdict Definitions

| Verdict | Meaning | Criteria |
|---------|---------|----------|
| **MERGE** | Approved, no blockers | Zero CRITICAL + zero HIGH + no scope mismatch |
| **MERGE (after fixes)** | Approvable after addressing issues | MEDIUM issues only, or minor fixes needed |
| **DON'T MERGE** | Blocked | Any CRITICAL, HIGH, or scope mismatch |

## Review Output Format

```json
{
  "approved": false,
  "verdict": "DON'T MERGE",
  "verdict_reason": "Security vulnerability in SQL handling",
  "complexity_tier": "medium",
  "scope_aligned": true,
  "dimensions": {
    "quality": "pass",
    "maintainability": "pass",
    "documentation": "warn",
    "performance": "pass",
    "security": "fail",
    "error_handling": "pass",
    "testing": "warn",
    "scope_alignment": "pass"
  },
  "issues": [
    {
      "severity": "CRITICAL",
      "dimension": "security",
      "file": "src/api/handler.ts",
      "line": 42,
      "message": "User input passed directly to SQL query",
      "suggestion": "Use parameterized query: db.query($1, [userInput])"
    }
  ],
  "passed": [
    "Code quality: Clean, well-structured",
    "Performance: No bottlenecks detected"
  ],
  "stats": { "critical": 1, "high": 0, "medium": 2, "low": 1 }
}
```

## Approval Rules

- **Approve**: Zero CRITICAL + zero HIGH issues
- **Warn**: MEDIUM issues only (can merge with comment)
- **Block**: Any CRITICAL or HIGH issue present

## Bias Awareness

During manual review, guard against these common reviewer biases (see `/critic` for the full adversarial framework):

- **Sycophancy**: Do not soften findings. Lead with problems, not praise.
- **Completion Bias**: Finished code is not necessarily correct code. Judge quality, not completeness.
- **Familiarity Bias**: Unfamiliar patterns are not wrong patterns. Evaluate on merit.

For high-stakes reviews (security, auth, data handling), consider running `/critic` for a full bias-counteracted adversarial pass with Chain of Verification.

## Pedro-Specific Checks

In addition to the 7 dimensions, verify:
- No GitHub Actions workflows added
- No AWS Amplify usage
- Protected constants not modified
- ECS Fargate preferred over Lambda for long-running services
- Existing patterns followed (check similar files in codebase)
