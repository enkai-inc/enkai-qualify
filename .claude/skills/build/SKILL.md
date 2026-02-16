---
name: build
description: Build a feature from an issue or description - orchestrates scaffolder, implementer, reviewer, CI, and PR creation agents
---

# /build - Automated Feature Builder

You are the Build Orchestrator. Your job is to take an issue or feature description and deliver a complete, tested pull request.

## Input Formats

The user can invoke this skill with:
- `/build #123` - Build from GitHub issue number
- `/build Add user authentication` - Build from description

## Workflow Overview

```
Input → Scaffold → Implement → Spec Review → Quality Review → CI → PR
```

Each step uses a specialized agent via the Task tool.

## Step-by-Step Process

### Step 1: Parse Input and Gather Context

**If issue number provided:**
```bash
gh issue view <number> --json title,body,labels
```

Extract:
- Title
- Description/body
- Acceptance criteria (look for checkboxes or "Acceptance Criteria" section)
- Labels (to determine type: feature/bug/etc.)

**If description provided:**
- Use the description directly
- Ask user for acceptance criteria if not clear

**Create a work context summary:**
```
## Work Item Context
**Type:** feature|bug|refactor
**Title:** <title>
**Description:** <description>

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

### Step 2: Scaffold (Task: scaffolder-agent)

Invoke the scaffolder agent to prepare the repository:

```
Task scaffolder-agent:
"Create a scaffold for implementing this work item:

<work context from step 1>

Create the feature branch, find relevant patterns, and identify files to create/modify."
```

**Expected output:**
- Branch name created
- Patterns found
- Files to create/modify

**On failure:** Stop and report the error.

### Step 3: Implement (Task: implementer-agent)

Invoke the implementer agent with the scaffold plan:

```
Task implementer-agent:
"Implement this feature using TDD:

<work context from step 1>

## Scaffold Plan
<output from scaffolder>

Follow the patterns identified. Write tests first, then implement.
Iterate until all acceptance criteria are met (max 7 iterations)."
```

**Expected output:**
- Files changed
- Tests added
- Acceptance criteria status

**On failure:** Report what's blocking.

### Step 4a: Spec Compliance Review (Task: general-purpose)

Before checking code quality, verify the implementation matches the spec. Dispatch a spec reviewer subagent:

```
Task general-purpose:
  description: "Review spec compliance"
  prompt: |
    You are reviewing whether an implementation matches its specification.

    ## What Was Requested

    <acceptance criteria and requirements from work context>

    ## What Implementer Claims They Built

    <summary from implementer output>

    ## CRITICAL: Do Not Trust the Report

    The implementer's report may be incomplete or optimistic. Verify independently.

    **DO NOT** take their word for completeness.
    **DO** read the actual code and compare to requirements line by line.

    ## Your Job

    Read the implementation code and verify:

    **Missing requirements:**
    - Did they implement everything requested?
    - Are there requirements they skipped or missed?

    **Extra/unneeded work:**
    - Did they build things that weren't requested?
    - Did they over-engineer or add unnecessary features?

    **Misunderstandings:**
    - Did they interpret requirements differently than intended?

    Report:
    - ✅ Spec compliant (all requirements met, nothing extra)
    - ❌ Issues: [list what's missing or extra, with file:line references]
```

**Expected output:**
- Spec compliant: Yes/No
- Missing requirements (if any)
- Extra/unneeded work (if any)

**If NOT spec compliant:**
- Send issues back to implementer-agent to fix gaps
- Re-run spec review (max 2 review cycles)
- **Do not proceed to quality review until spec passes**

**If spec compliant:** Continue to Step 4b.

### Step 4b: Code Quality Review (Task: reviewer-agent)

Only after spec compliance passes, check code quality. Use the code-reviewer agent checklist (see `.claude/agents/code-reviewer.md`) and dispatch the reviewer agent:

```
Task reviewer-agent:
"Review the code quality for this work item:

<work context>

## Files Changed
<list from implementer>

## Spec Review Status
Spec compliance confirmed — implementation matches requirements.

## Review Checklist
Follow the priority-ordered checklist from .claude/agents/code-reviewer.md:
1. CRITICAL: Security vulnerabilities (secrets, injection, auth bypass)
2. HIGH: Large functions, missing error handling, missing tests
3. MEDIUM: Performance, naming, duplication
4. LOW: TODOs, docs, style

Check for quality, security, and pattern consistency."
```

**Expected output:**
- Approved: Yes/No
- Findings list (with severity: critical/high/medium/low)
- Summary

**If NOT approved with critical or high findings:**
- Send feedback to implementer-agent to fix quality issues
- Re-run quality review (max 2 review cycles)

**If approved:** Continue to CI.

### Review Order Matters

```
Implementer → Spec Review → [fix if needed] → Quality Review → [fix if needed] → CI
```

**Never start quality review before spec compliance passes.** Spec review catches "built the wrong thing" — quality review catches "built the right thing poorly." Wrong order wastes time polishing code that doesn't meet requirements.

### Step 5: CI (Task: ci-runner-agent)

Invoke the CI runner agent to validate:

```
Task ci-runner-agent:
"Run quality gates for the implementation:

Repository: <current directory>
Branch: <branch from scaffolder>

Run lint, type-check, test, and build.
Fix any failures (max 5 iterations)."
```

**Expected output:**
- Status: PASS/FAIL
- Iterations used
- Fixes applied

**On failure after 5 iterations:** Escalate to build-error-resolver agent:

```
Task general-purpose:
  description: "Resolve build errors with minimal diffs"
  prompt: |
    You are a build error resolution specialist.
    See .claude/agents/build-error-resolver.md for your full instructions.

    The CI runner failed after 5 iterations. Fix the remaining errors
    with minimal diffs — no refactoring, no architecture changes.

    Error output:
    <paste CI runner error output>

    Fix errors in priority order: syntax → type → import → runtime → logic → lint.
    Report what you fixed and what remains.
```

If the build-error-resolver also fails, stop and report what needs human attention.

### Step 6: Create PR (Task: pr-creator-agent)

Invoke the PR creator agent:

```
Task pr-creator-agent:
"Create a pull request for this work item:

## Work Item
<work context>
Issue: #<number> (if applicable)

## Implementation Summary
<summary from implementer>

## Review Summary
<summary from reviewer>

Push the branch and create a well-structured PR."
```

**Expected output:**
- PR URL
- PR number

### Step 7: Report Success

Provide a summary to the user:

```
## Build Complete

**PR:** <url>
**Branch:** <branch>
**Issue:** #<number> (if applicable)

### Summary
- Files changed: X
- Tests added: Y
- CI iterations: Z
- Review: Approved

### Acceptance Criteria
- [x] Criterion 1
- [x] Criterion 2
```

## Error Handling

| Step | Error | Action |
|------|-------|--------|
| Scaffold | Branch creation fails | Stop, report error |
| Implement | Can't meet criteria after 7 iterations | Stop, report blockers |
| Spec Review | Spec gaps after 2 fix cycles | Stop, report what's missing vs. spec |
| Quality Review | Quality issues after 2 fix cycles | Stop, report findings |
| CI | Fails after 5 iterations | Stop, report what needs human |
| PR | Push/create fails | Stop, report error |

## Red Flags

**Never:**
- Skip spec review — quality review without spec compliance wastes cycles polishing wrong code
- Start quality review before spec compliance passes
- Proceed with unfixed issues from either review stage
- Skip review re-checking — if reviewer found issues, implementer fixes, reviewer reviews again
- Accept "close enough" on spec compliance — missing requirements = not done
- Let implementer self-review replace actual review (both are needed)

**If reviewer finds issues:**
- Implementer fixes them (same subagent if possible)
- Reviewer reviews again (same stage)
- Repeat until approved
- Don't skip the re-review

## User Interaction Points

Use `AskUserQuestion` when:
- Acceptance criteria are unclear
- Multiple valid approaches exist
- Need clarification on requirements

## Per-Agent Context Profiles — Fresh Context Per Agent

Each build sub-agent starts with **clean, focused context** containing only what it needs. The orchestrator does NOT pass the full CLAUDE.md or all skill files to sub-agents.

### Scaffolder Agent

**Purpose**: Create branch, identify patterns, plan file structure.

**Context loaded**:
- Work item context (issue title, body, acceptance criteria)
- Repository file tree (top-level structure)
- Existing patterns in the target directory (read relevant source files)
- `.claude/contexts/dev.md` — core development principles

**Not loaded**: Review rules, quality checklists, CI configuration, other skills.

**Why**: The scaffolder needs architecture awareness to plan where code goes. It does not need review criteria or CI knowledge.

### Implementer Agent

**Purpose**: Write code and tests following TDD.

**Context loaded**:
- Work item context and scaffold plan (from scaffolder output)
- Existing source patterns in files being modified (read before writing)
- Test patterns from adjacent test files
- `.claude/contexts/dev.md` — core development principles

**Not loaded**: Review checklists, CI scripts, deployment configuration, other skills.

**Why**: The implementer needs to understand existing code patterns to write consistent code. Review criteria would cause premature self-editing instead of completing the implementation.

### Spec Reviewer Agent

**Purpose**: Verify implementation matches requirements.

**Context loaded**:
- Original acceptance criteria and requirements (from work item)
- Implementer's summary of what was built
- The actual changed files (reads code independently)

**Not loaded**: Code quality rules, CI configuration, development patterns, other skills.

**Why**: The spec reviewer's only job is requirements-vs-implementation comparison. Loading quality rules would blur the boundary between "built the wrong thing" and "built the right thing poorly."

### Quality Reviewer Agent

**Purpose**: Check code quality, security, and pattern consistency.

**Context loaded**:
- `.claude/agents/code-reviewer.md` — review checklist and severity taxonomy
- `.claude/contexts/review.md` — review behavioral rules
- Changed files list and spec review confirmation
- The actual changed files (reads code independently)

**Not loaded**: Development patterns, scaffolding rules, CI scripts, other skills.

**Why**: The quality reviewer needs the review framework and nothing else. Loading dev patterns would cause it to suggest rewrites instead of reviewing.

### CI Runner Agent

**Context loaded**:
- Branch name and repository path
- Quality gate commands (lint, type-check, test, build)
- Error output from failed commands (iterative)

**Not loaded**: Review rules, development patterns, architecture docs, other skills.

**Why**: The CI runner executes commands and fixes errors. It needs command output, not architectural context.

### Context Profile Summary

| Agent | Loaded context | ~Tokens | Focus |
|-------|---------------|---------|-------|
| Scaffolder | Dev principles + repo structure + issue | ~5KB | Where does code go? |
| Implementer | Dev principles + patterns + scaffold plan | ~8KB | How to write consistent code? |
| Spec Reviewer | Requirements + changed files | ~4KB | Does it match the spec? |
| Quality Reviewer | Review checklist + review rules + changed files | ~6KB | Is the code quality acceptable? |
| CI Runner | Commands + error output | ~3KB | Do quality gates pass? |

Each agent starts fresh — no accumulated context from previous agents pollutes its judgment. The orchestrator passes only the output summary (not full context) between stages.

## Example Invocation

```
User: /build #123
```