---
name: scrum
description: Process GitHub issue queue with 6 parallel Codex builders executing Work Units
---

# /scrum - Parallel Issue Queue Processor with Work Unit Decomposition

You are the Scrum Master. Your job is to process all eligible GitHub issues by decomposing them into Codex-simple Work Units and dispatching 6 parallel builders to execute them.

**Key changes from v1**:
- Absorbs `/eval` functionality (issue fetching, epic continuation)
- Decomposes issues into Work Units (≤2 files, ≤50 lines, 0 decisions)
- Scales from 2 to 6 parallel Codex builders
- Aggregates Work Unit commits into per-issue PRs

**Configuration**: Read `.claude/project.config.json` for:
- GitHub labels: `github.labels.ready`, `github.labels.in_progress`, `github.labels.pr_open`, `github.labels.done`, `github.labels.needs_human`
- Worktree patterns: `worktree.base_dir_pattern`

**Label Convention**: All repos use `enkai:*` labels (see CLAUDE.md for full list). When decomposing an already-labeled issue, create missing labels in the repo.

## Quick Start

When invoked with `/scrum`, execute this workflow:

1. Fetch eligible issues
2. Setup 6 worktrees
3. For each issue: decompose into Work Units
4. Queue Work Units (respecting dependencies)
5. Run 6 builders until queue is empty
6. Aggregate commits into PRs
7. Post-merge verification
8. Report results

---

## Step 0: Ensure Labels Exist

Before processing, ensure all `enkai:*` labels exist in the repo:

```bash
# Check and create missing labels
for label in "enkai:build" "enkai:in-progress" "enkai:pr-open" "enkai:done" "enkai:needs-human"; do
  gh label create "$label" --description "Automated build label" --color "0E8A16" 2>/dev/null || true
done
```

Only run this when decomposing an issue that already has an `enkai:*` label (indicating intent to use automated builds).

---

## Step 1: Fetch Eligible Issues

Get all open issues ready for build:

```bash
# Fetch issues with enkai:build label, excluding those needing human attention
gh issue list --state open --label "enkai:build" --json number,title,body,labels --limit 50 | \
  jq '[.[] | select(.labels | map(.name) | index("enkai:needs-human") | not)]'
```

If no eligible issues found, check for epic continuations:

```bash
# Look for epics with remaining sub-issues
gh issue list --state open --label "epic" --json number,title --limit 10
```

If still no issues, report and exit:
```
## No Issues to Process

No open issues found with `enkai:build` label (excluding `enkai:needs-human`).
```

---

## Step 2: Setup Git Worktrees

Create 6 isolated worktrees for parallel work:

```bash
cd $(git rev-parse --show-toplevel)

for i in 1 2 3 4 5 6; do
  WORKTREE="../worktree-scrum-${i}"
  if [ -d "$WORKTREE" ]; then
    git -C "$WORKTREE" checkout main
    git -C "$WORKTREE" pull origin main
  else
    git worktree add "$WORKTREE" main
  fi
done
```

---

## Step 3: Read Issue Context

For each eligible issue, extract:

```
- Issue number
- Title
- Body (requirements, acceptance criteria)
- Labels
- Linked PRs (if any partial work exists)
- Parent epic (if part of an epic)
```

```bash
gh issue view <NUMBER> --json number,title,body,labels,linkedPullRequests
```

---

## Step 4: Decompose Issues into Work Units

For each issue, first mark it as in-progress:

```bash
# Update label: ready → in-progress
gh issue edit <NUMBER> --remove-label "enkai:build" --add-label "enkai:in-progress"
```

Then decompose into Codex-simple Work Units.

### Work Unit Constraints

A Work Unit must be:
- **≤2 files** modified
- **≤50 lines** of code
- **0 decisions** required (everything pre-specified)
- **<5 minutes** to implement

### Decomposition Process

1. **Read Issue Requirements**
   - Parse acceptance criteria
   - Identify files to create/modify
   - Extract test requirements

2. **Identify Components**
   - Break into smallest atomic changes
   - Each component becomes a Work Unit

3. **Establish Dependencies**
   - Order Work Units by implementation order
   - E.g., utility functions before components that use them

4. **Generate Work Unit Specs**

For each Work Unit, generate a YAML spec per `.claude/schemas/work-unit-spec.yaml`:

```yaml
work_unit:
  id: "issue-{number}-wu-{sequence}"
  parent_issue: {number}
  sequence: {n}
  summary: "{brief description}"
  depends_on: []  # List of work unit IDs

  context:
    files:
      - path: "{file}"
        relevant_lines: "{range}"
    patterns:
      - "{pattern to follow}"
    constraints:
      - "{hard constraint}"

  implementation:
    - file: "{target file}"
      action: "create | append | prepend | replace"
      code: |
        # Pre-written code exactly as it should appear

  tests:
    file: "{test file}"
    action: "create | append"
    code: |
      # Pre-written test code

  verification:
    commands:
      - "npx tsc --noEmit"
      - "npm test -- {test file}"
    success_criteria:
      - "Exit code 0"

  commit:
    message: "feat({scope}): {description}"
```

### Example Decomposition

Issue: "Add user authentication endpoint"

Work Units:
1. `issue-123-wu-001`: Add password hash utility
2. `issue-123-wu-002`: Add JWT token generation
3. `issue-123-wu-003`: Add auth middleware
4. `issue-123-wu-004`: Add login endpoint
5. `issue-123-wu-005`: Add login tests

Dependencies: 001 → 002 → 003 → 004, 001 → 005

---

## Step 5: Initialize Queue

```
WORK_QUEUE: [list of Work Unit specs, ordered by dependencies]
BUILDER_STATUS: {
  builder-1: { status: idle, work_unit: null, worktree: "../worktree-scrum-1" },
  builder-2: { status: idle, work_unit: null, worktree: "../worktree-scrum-2" },
  builder-3: { status: idle, work_unit: null, worktree: "../worktree-scrum-3" },
  builder-4: { status: idle, work_unit: null, worktree: "../worktree-scrum-4" },
  builder-5: { status: idle, work_unit: null, worktree: "../worktree-scrum-5" },
  builder-6: { status: idle, work_unit: null, worktree: "../worktree-scrum-6" }
}
RESULTS: []
COMMITS_BY_ISSUE: {}  # Maps issue number to list of commits
```

---

## Step 6: Main Processing Loop

```
WHILE queue not empty OR any builder busy:

  # Assign work to idle builders
  FOR each idle builder:
    IF queue has Work Unit with satisfied dependencies:
      work_unit = pop from queue
      Launch builder with work_unit (see below)
      Mark builder as busy

  # Check builder completion
  FOR each busy builder:
    Read builder output file
    IF output contains "BUILDER_RESULT":
      Parse result JSON
      IF success:
        Record commit SHA in COMMITS_BY_ISSUE[parent_issue]
        Mark dependencies as satisfied
      ELSE:
        Log failure
        Consider re-queueing or marking issue as needs-human
      Mark builder as idle
    ELSE IF builder running > 5 minutes:
      Mark as failed (timeout)
      Mark builder as idle

  # Wait before next iteration
  Sleep 15 seconds using native Sleep tool
```

---

## Step 7: Launch Codex Builder

Use Bash with `run_in_background: true`:

```bash
cd ../worktree-scrum-<N> && \
git checkout main && git pull origin main && \
git checkout -b feature/issue-<ISSUE>-wu-<SEQ> && \
nohup codex --dangerously-auto-approve "$(cat <<'PROMPT'
You are Codex Builder <N>. Read your agent definition at .claude/agents/codex-builder.md.

Execute this Work Unit:

```yaml
<WORK_UNIT_SPEC>
```

Work ONLY in this directory: ../worktree-scrum-<N>
Branch: feature/issue-<ISSUE>-wu-<SEQ>

When complete, output BUILDER_RESULT JSON.
PROMPT
)" > /tmp/scrum-builder-<N>.log 2>&1 &
```

---

## Step 8: Monitor Builders

Check builder log files periodically:

```bash
# Read recent output from builder
tail -100 /tmp/scrum-builder-<N>.log

# Look for completion signal
grep "BUILDER_RESULT" /tmp/scrum-builder-<N>.log
```

Parse the BUILDER_RESULT JSON per `.claude/schemas/builder-result.schema.json`.

---

## Step 9: Aggregation Phase

After all Work Units for an issue are complete, aggregate into a single PR:

### Cherry-pick Commits

```bash
# Switch to PR branch for this issue
git checkout main
git pull origin main
git checkout -b feature/issue-<NUMBER>

# Cherry-pick all Work Unit commits in order
for sha in ${COMMITS_BY_ISSUE[<NUMBER>]}; do
  git cherry-pick $sha
done

# Push branch
git push -u origin feature/issue-<NUMBER>
```

### Create PR

```bash
gh pr create \
  --title "feat: <issue title>" \
  --body "$(cat <<'EOF'
## Summary
Implements #<NUMBER>

## Work Units Completed
- [x] wu-001: <summary>
- [x] wu-002: <summary>
- [x] wu-003: <summary>

## Test Plan
- All Work Unit verifications passed
- Type checking: ✅
- Unit tests: ✅

## Commits
<list of commit SHAs>

---
🤖 Generated by Scrum Master with 6 Codex Builders
EOF
)"
```

### Link PR to Issue and Update Labels

```bash
# Comment on issue
gh issue comment <NUMBER> --body "PR created: #<PR_NUMBER>"

# Update labels: remove in-progress, add pr-open
gh issue edit <NUMBER> --remove-label "enkai:in-progress" --add-label "enkai:pr-open"
```

---

## Step 10: Post-Merge Verification

After PRs are merged, verify integrated main:

```bash
git checkout main
git pull origin main

# Run quality gates
npm run lint 2>&1 | tail -20
npm run type-check 2>&1 | tail -20
npm test 2>&1 | tail -50
```

Record results:
- **PASS**: All quality gates green
- **FAIL**: List failures (don't auto-fix, report for human review)

---

## Step 11: Final Report

```markdown
## Scrum Complete

**Duration**: X minutes
**Issues Processed**: Y
**Work Units Executed**: Z
**PRs Created**: W

### Issues

| Issue | Title | Work Units | Status | PR |
|-------|-------|------------|--------|-----|
| #101 | Add login | 5 | ✅ success | #201 |
| #102 | Fix header | 2 | ✅ success | #202 |
| #103 | Add API | 4 | ❌ failed | - |

### Work Unit Summary

| Issue | WU | Summary | Status | Commit |
|-------|-----|---------|--------|--------|
| #101 | 001 | Password hash | ✅ | abc123 |
| #101 | 002 | JWT tokens | ✅ | def456 |

### Post-Merge Verification
- Lint: PASS
- Type-check: PASS
- Tests: PASS

### Failed Work Units
| Issue | WU | Phase | Error |
|-------|-----|-------|-------|
| #103 | 003 | verification | Type error TS2345 |

### Issues Needing Human Attention
- #103: Work Unit 003 failed verification

### Worktrees
Left in place for inspection:
- `../worktree-scrum-1` through `../worktree-scrum-6`

Cleanup command:
\`\`\`bash
for i in 1 2 3 4 5 6; do git worktree remove ../worktree-scrum-$i; done
\`\`\`
```

---

## Error Handling

| Error | Action |
|-------|--------|
| No issues found | Exit with message |
| Worktree creation fails | Try to recover, or exit |
| Work Unit decomposition fails | Mark issue as needs-human |
| Builder times out (>5 min) | Mark WU failed, continue |
| Builder crashes | Mark WU failed, continue |
| Verification fails | Don't retry, mark for human review |
| All builders stuck | Exit after 30 min total |

---

## Context Profiles — Fresh Context Per Agent

### Scrum Master Context (this session)

Loaded at startup:
- `.claude/CLAUDE.md` — critical constraints
- `.claude/skills/scrum/SKILL.md` — this file
- `.claude/schemas/work-unit-spec.yaml` — Work Unit format
- `.claude/schemas/builder-result.schema.json` — result format
- `.claude/project.config.json` — labels, worktree patterns

**Not loaded**: All other skills, agent definitions. Scrum Master handles orchestration only.

### Codex Builder Context (per builder)

Each dispatched builder receives:
- `.claude/agents/codex-builder.md` — mechanical execution rules
- Work Unit YAML spec — exactly what to implement
- Worktree path and branch name

**Not loaded**: Scrum SKILL.md, design agents, CLAUDE.md rules. Builders follow Work Unit specs mechanically.

---

## Constraints

- **Max 6 builders** — Don't spawn more to avoid resource issues
- **15 second poll interval** — Use native Sleep tool for interruptible waits
- **5 minute Work Unit timeout** — Codex-simple tasks should complete fast
- **No retry on verification failure** — Failed WUs need Scrum Master review
- **Keep worktrees** — For post-mortem debugging
- **One PR per issue** — Aggregate all Work Unit commits

---

## Absorbing /eval Functionality

This skill absorbs `/eval`:

1. **Issue fetching** — Handled in Step 1
2. **Context loading** — Handled in Step 3
3. **Epic continuation** — Check for sibling issues after completing one
4. **PR creation** — Handled in Aggregation Phase

When an issue belongs to an epic, after successful completion:

```bash
# Find sibling issues in the same epic
PARENT_EPIC=$(gh issue view <NUMBER> --json labels -q '.labels[] | select(.name | startswith("epic:")) | .name')
gh issue list --label "$PARENT_EPIC" --state open --json number,title
```

Add sibling issues to the queue if not already processed.

---

## Work Unit Best Practices

### Good Work Units

```yaml
# Good: Single focused change
work_unit:
  id: "issue-123-wu-001"
  summary: "Add hashPassword function"
  implementation:
    - file: "src/utils/crypto.ts"
      action: "create"
      code: |
        # 15 lines of focused code
```

### Bad Work Units

```yaml
# Bad: Too broad, requires decisions
work_unit:
  id: "issue-123-wu-001"
  summary: "Implement authentication system"
  # This is NOT Codex-simple!
```

### Decomposition Heuristics

| Pattern | Work Units |
|---------|------------|
| New API endpoint | 1: types, 2: handler, 3: route, 4: tests |
| New component | 1: component, 2: styles, 3: tests |
| Bug fix | 1: fix, 2: test |
| Utility function | 1: function, 2: tests |

---

## Guidelines

- **Decompose aggressively** — Small Work Units are better than large ones
- **Pre-write all code** — Builders should not make decisions
- **Test in isolation** — Each Work Unit should be verifiable standalone
- **Aggregate cleanly** — Cherry-pick order matters for clean history
- **Fail fast** — Don't retry indefinitely, escalate to human
