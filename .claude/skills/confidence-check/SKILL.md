---
name: confidence-check
description: "Pre-implementation confidence assessment. Run before /design or /build to verify readiness — prevents wrong-direction work with 25-250x token ROI."
---

# Confidence Check

Prevents wrong-direction execution by assessing confidence **before** starting implementation.

**ROI**: Spend 100-200 tokens on confidence check to save 5,000-50,000 tokens on wrong-direction work.

## When to Use

- Before `/build` — verify requirements are clear and approach is sound
- Before `/design` — verify the topic is well-scoped
- Before any significant implementation — catch gaps early
- When unsure if enough context exists to proceed

## Confidence Thresholds

| Score | Action |
|-------|--------|
| >= 90% | Proceed with implementation |
| 70-89% | Present alternatives, ask clarifying questions |
| < 70% | **STOP** — request more context before proceeding |

## 5-Dimension Assessment

Calculate confidence (0-100) across 5 checks:

### 1. No Duplicate Implementations? (25%)

Search the codebase for existing functionality that already does what's being asked.

```
- Grep for similar function/class names
- Glob for related files
- Check if a skill, agent, or hook already covers this
```

- **Pass (25)**: No duplicates found
- **Partial (15)**: Similar but not identical exists — note overlap
- **Fail (0)**: Duplicate exists — stop and reference it

### 2. Architecture Compliance? (25%)

Verify the proposed approach fits existing patterns.

```
- Read CLAUDE.md constraints (no GitHub Actions, ECS Fargate preference, etc.)
- Check existing patterns in the codebase
- Confirm no unnecessary new dependencies
```

- **Pass (25)**: Uses existing stack and patterns
- **Partial (15)**: Mostly fits, minor deviations justified
- **Fail (0)**: Conflicts with architectural constraints

### 3. Requirements Clear? (20%)

Verify the task has enough detail to implement correctly.

```
- Are acceptance criteria defined?
- Is the scope bounded (in-scope and out-of-scope)?
- Are success criteria measurable?
```

- **Pass (20)**: Clear requirements with acceptance criteria
- **Partial (10)**: Some ambiguity but core intent is clear
- **Fail (0)**: Too vague to implement — need clarification

### 4. Prior Art / References Available? (15%)

Check if there are working examples to guide implementation.

```
- Search for similar implementations in the codebase
- Check observatory proposals or external references
- Look for documentation or patterns to follow
```

- **Pass (15)**: Working reference found
- **Partial (8)**: Partial references available
- **Fail (0)**: No references — higher risk of wrong approach

### 5. Root Cause / Problem Identified? (15%)

For bug fixes: is the actual problem understood?
For features: is the "why" clear?

```
- Can you explain the problem in one sentence?
- Is the underlying cause identified (not just symptoms)?
- Is the desired outcome specific?
```

- **Pass (15)**: Root cause clear, desired outcome specific
- **Partial (8)**: General understanding, some gaps
- **Fail (0)**: Symptoms only — need investigation first

## Scoring

```
Total = Check1 + Check2 + Check3 + Check4 + Check5

If Total >= 90:  Proceed
If Total >= 70:  Present alternatives, ask questions
If Total < 70:   STOP — request more context
```

## Output Format

```
## Confidence Assessment

| Check | Score | Status |
|-------|-------|--------|
| No duplicates | 25/25 | Pass |
| Architecture fit | 25/25 | Pass |
| Requirements clear | 20/20 | Pass |
| References available | 15/15 | Pass |
| Root cause identified | 15/15 | Pass |

**Total: 100/100**
**Decision: PROCEED**
```

Or if below threshold:

```
## Confidence Assessment

| Check | Score | Status |
|-------|-------|--------|
| No duplicates | 25/25 | Pass |
| Architecture fit | 15/25 | Partial — introduces Redis dependency |
| Requirements clear | 10/20 | Partial — scope undefined |
| References available | 0/15 | Fail — no examples found |
| Root cause identified | 15/15 | Pass |

**Total: 65/100**
**Decision: STOP — below 70% threshold**

### Gaps to Address
1. Scope needs definition — what's in and out?
2. No working references — research needed before implementation
3. Redis dependency needs justification vs. existing DynamoDB
```

## Integration Points

This skill is designed to be called inline by other skills:

- `/build` should run confidence check before Step 2 (Scaffold)
- `/design` should run confidence check before Phase 1 (Framing)
- `/eval` can optionally run confidence check before Step 5 (Implement)

The check is lightweight (100-200 tokens) and prevents expensive wrong-direction work.

## Instructions for AI

When running `/confidence-check`:

1. Parse the task/issue/description provided
2. Run all 5 checks against the codebase
3. Score each dimension
4. If >= 90: report and indicate ready to proceed
5. If 70-89: report gaps, suggest how to fill them, ask user
6. If < 70: report gaps, recommend investigation steps, do NOT proceed
