---
name: resolve
description: "Resolve PR merge conflicts. Defaults to resolving all conflicting PRs."
---

# PR Conflict Resolver

An intelligent agent that resolves merge conflicts in pull requests by understanding both sides semantically, making smart resolution choices, and completing the merge workflow.

## When to Use This Skill

- `/resolve` - Resolve ALL open PRs with conflicts
- `/resolve 123` - Resolve conflicts on specific PR #123
- "My PR has merge conflicts"
- "Rebase failed with conflicts"
- When `gh pr merge` fails due to conflicts

## Default Behavior

**When invoked without arguments, this skill automatically finds and resolves ALL open PRs that have merge conflicts, then merges them.** This is the most useful default for keeping your PR queue clean.

After resolving conflicts, PRs are automatically merged using squash merge with branch deletion.

## Workflow

```
Discover conflicting PRs (or use provided number)
            |
    For each PR:
            |
     Fetch PR details
            |
      Check for conflicts
            |
    [No conflicts?] --> Skip, report clean
            |
      [Has conflicts]
            |
     Fetch latest main
            |
      Start rebase
            |
    For each conflicted file:
            |
   Analyze both versions
            |
   Determine resolution:
   - Take ours (feature)
   - Take theirs (main)
   - Merge both changes
   - Ask user (complex)
            |
     Apply resolution
            |
     git add <file>
            |
    git rebase --continue
            |
   git push --force-with-lease
            |
     Report resolved
            |
   gh pr merge --squash
            |
     Delete branch
            |
    Next PR...
            |
   Summary of all merged
```

## Step-by-Step Guide

### Step 1: Discover Conflicting PRs

```bash
# If argument provided, use it
if [ -n "$1" ]; then
  PR_NUMBERS="$1"
else
  # DEFAULT: Find ALL open PRs with conflicts
  PR_NUMBERS=$(gh pr list --state open --json number,mergeable \
    -q '.[] | select(.mergeable == "CONFLICTING") | .number')
fi

if [ -z "$PR_NUMBERS" ]; then
  echo "No conflicting PRs found. All PRs are clean!"
  exit 0
fi

echo "Found conflicting PRs: $PR_NUMBERS"
```

### Step 2: Process Each PR

> Standard worktree lifecycle: see `.claude/skills/shared/WORKTREE_LIFECYCLE.md` for the common pattern. Below describes only what differs for this skill.

For each PR number, execute the resolution workflow:

```bash
for PR_NUMBER in $PR_NUMBERS; do
  echo "=== Resolving PR #$PR_NUMBER ==="

  # Get PR details
  PR_INFO=$(gh pr view $PR_NUMBER --json number,title,headRefName,baseRefName)
  HEAD_BRANCH=$(echo "$PR_INFO" | jq -r '.headRefName')
  BASE_BRANCH=$(echo "$PR_INFO" | jq -r '.baseRefName')

  # Checkout and rebase
  git fetch origin $BASE_BRANCH $HEAD_BRANCH
  git checkout $HEAD_BRANCH
  git rebase origin/$BASE_BRANCH

  # Resolve conflicts (see Step 3)
  # ...

  # Push resolved branch
  git push --force-with-lease origin $HEAD_BRANCH

  # SAFETY: Check for active worktrees before merging
  ACTIVE_WORKTREE=$(git worktree list | grep -E "\[$HEAD_BRANCH\]" || true)
  if [ -n "$ACTIVE_WORKTREE" ]; then
    echo "⚠️  PR #$PR_NUMBER resolved but NOT merged - active worktree detected"
    echo "   Worktree: $ACTIVE_WORKTREE"
    continue
  fi

  # Merge the PR (safe - no active worktree)
  gh pr merge $PR_NUMBER --squash --delete-branch

  echo "PR #$PR_NUMBER resolved and merged!"
done
```

### Step 3: Resolve Conflicts

For each conflicted file during rebase:

```bash
CONFLICTED_FILES=$(git diff --name-only --diff-filter=U)

for FILE in $CONFLICTED_FILES; do
  # Analyze and resolve based on conflict type
  # (See Resolution Strategies below)
  git add "$FILE"
done

git rebase --continue
```

## Resolution Strategies

### Strategy A: Take Ours (Feature Branch)
When the feature branch has the correct/newer implementation:
```bash
git checkout --ours "$FILE"
git add "$FILE"
```

### Strategy B: Take Theirs (Main Branch)
When main has updates that should be preserved:
```bash
git checkout --theirs "$FILE"
git add "$FILE"
```

### Strategy C: Semantic Merge (Most Common)
When both sides have valid changes that need to be combined:

1. Read both versions to understand what each side changed
2. Identify the intent of each change
3. Combine intelligently:
   - If both added different things: include both
   - If both modified same line: determine which is correct
   - If one refactored and one added: apply addition to refactored version
4. Edit the file to remove conflict markers and write combined code
5. Stage: `git add "$FILE"`

### Strategy D: Ask User (Complex/Risky)
When resolution is ambiguous or high-risk, use `AskUserQuestion`.

## Resolution Decision Matrix

| Conflict Type | Resolution | Rationale |
|--------------|------------|-----------|
| Import additions | Merge both | Both branches need their imports |
| Lock file (package-lock, yarn.lock) | Regenerate | Run `npm install` after merge |
| Type definitions | Merge both | Usually additive |
| Same function, different changes | Semantic merge | Understand intent |
| Config file | Ask user | Config changes are often intentional |
| Generated files (.tsbuildinfo) | Take theirs + regenerate | Don't manually edit |
| Test files | Merge both | Tests are usually additive |
| Same line, different values | Ask user | Needs human judgment |

## Safety Guardrails

### Worktree Safety Check (CRITICAL)

Before merging any PR, check if the branch has an active worktree:

```bash
# Check if branch has active worktree
ACTIVE_WORKTREE=$(git worktree list | grep -E "\[$HEAD_BRANCH\]" || true)

if [ -n "$ACTIVE_WORKTREE" ]; then
  echo "⚠️  SKIPPING PR #$PR_NUMBER - branch has active worktree:"
  echo "   $ACTIVE_WORKTREE"
  echo "   Resolve manually or remove worktree first."
  SKIPPED_PRS+=("$PR_NUMBER (active worktree)")
  continue
fi
```

**Why this matters:** Deleting a branch that has an active worktree will crash any Claude Code sessions working in that worktree. Always check before merge.

### Never Auto-Resolve
- Security-sensitive files (auth, crypto, permissions)
- Configuration with secrets/keys
- Database migrations
- CI/CD pipeline configs

### Always Verify After
- Run `npm run lint` after code changes
- Run `npm run type-check` after TypeScript changes
- Run `npm run build` to verify no breaks

### Use Safe Force Push
```bash
# ALWAYS use --force-with-lease, never --force
git push --force-with-lease origin $HEAD_BRANCH
```

### Rollback Plan
```bash
# If something goes wrong
git rebase --abort

# Or reset to remote state
git fetch origin $HEAD_BRANCH
git checkout $HEAD_BRANCH
git reset --hard origin/$HEAD_BRANCH
```

## Example Session

```
User: /resolve

AI: Checking for PRs with conflicts...

Found 4 PRs with conflicts:
- #1928: refactor: replace hardcoded gray colors
- #1921: feat: agentcore-1863-20260124080548
- #1920: feat: agentcore-1863-20260124080853
- #1918: feat: agentcore-1862-20260124080355

=== Resolving PR #1928 ===
Fetching and rebasing onto main...
9 files with conflicts detected.

Resolving dashboard/src/app/help/HelpPageClient.tsx...
- Conflict: fg.subtle vs fg.default
- Resolution: Taking PR's version (fg.default for better visibility)

[... resolves remaining files ...]

All conflicts resolved!
Pushing resolved branch...
Merging PR #1928 with squash...
✓ PR #1928 merged and branch deleted!

=== Resolving PR #1921 ===
[... continues with next PR ...]

=== Resolving PR #1918 ===
Fetching and rebasing onto main...
All conflicts resolved!
Pushing resolved branch...
⚠️  Active worktree detected on branch ai-builder/agentcore-1862
Skipping merge to avoid crashing active session.
PR #1918 resolved but NOT merged.

=== Summary ===
Resolved and merged 3 PRs:
- #1928: ✓ MERGED
- #1921: ✓ MERGED
- #1920: ✓ MERGED

Skipped (active worktree):
- #1918: ⚠️ RESOLVED but not merged (worktree active)

Note: Skipped PRs are conflict-free and ready to merge manually.
```

## Instructions for AI

When executing this skill:

1. **Check for argument** - If PR number provided, use it; otherwise find ALL conflicting PRs
2. **Report discovery** - Tell user how many conflicting PRs were found
3. **Process sequentially** - Resolve one PR at a time to avoid conflicts between PRs
4. **Use semantic resolution** - Understand what both sides changed, don't blindly pick sides
5. **Handle lock files specially** - Regenerate, don't manually merge
6. **Ask when uncertain** - Complex conflicts need human input
7. **Verify after resolution** - Run lint/type-check if applicable
8. **Check for active worktrees** - Run `git worktree list | grep branch-name` before merging
9. **Push and merge** - After resolving, push with `--force-with-lease` then merge with `gh pr merge --squash --delete-branch` (only if no active worktree)
10. **Report progress** - Keep user informed of each PR's status (resolved → merged or skipped)
11. **Summarize at end** - Show final status of all merged PRs AND any skipped due to worktrees

**CRITICAL**: Use `--force-with-lease`, never `--force`.

**CRITICAL**: Always check `git worktree list` before merging. Never merge a branch that has an active worktree - this will crash other Claude sessions.

**CRITICAL**: If a PR's rebase becomes too complex (>10 conflicts or nested conflicts), report the issue and move to the next PR rather than getting stuck.
