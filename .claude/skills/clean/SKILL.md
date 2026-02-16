---
name: clean
description: "Clean up git worktrees and merged branches. Safely removes without losing work."
---

# Clean Skill - Git Worktree & Branch Cleanup

This skill safely cleans up git worktrees and merged branches, both local and remote. It verifies PRs are merged before deleting branches to prevent losing any work.

## When to Use This Skill

- "Clean up branches"
- "Remove old worktrees"
- "Prune merged branches"
- "Clean up git"
- After completing a batch of issues/PRs
- Before starting fresh work
- When the repository feels cluttered

## What Gets Cleaned

| Item | Action | Safety Check |
|------|--------|--------------|
| Git worktrees | Removed and pruned | None needed (git tracks) |
| Local merged branches | Deleted | Merged into main |
| Remote branches | Deleted | PR is MERGED or CLOSED |
| Orphaned ai-builder branches | Deleted | No open PR |
| Stale remote refs | Pruned | `git fetch --prune` |

## What Is NOT Cleaned

- `main` branch (protected)
- Branches with OPEN PRs
- Uncommitted changes (will warn)

## Step-by-Step Process

### Step 1: Check for uncommitted work

```bash
# Check all worktrees for uncommitted changes
git worktree list
for worktree in $(git worktree list --porcelain | grep "^worktree" | cut -d' ' -f2); do
  echo "=== $worktree ==="
  cd "$worktree" && git status --short
done
```

If there are uncommitted changes, warn the user before proceeding.

### Step 2: Remove worktrees

```bash
# List all worktrees
git worktree list

# Remove each worktree (except main)
git worktree remove /path/to/worktree --force

# Prune any stale worktree references
git worktree prune
```

### Step 3: Fetch and prune remote references

```bash
git fetch --prune origin
```

### Step 4: Delete local merged branches

```bash
# Delete branches that are merged into main
git branch --merged main | grep -v "^\*" | grep -v "main" | xargs -r git branch -d
```

### Step 5: Delete squash-merged branches

For branches that were squash-merged (won't show in `--merged`):

```bash
# List remaining local branches
git branch | grep -v "^\*" | grep -v "main"

# For each branch, check if its PR was merged
for branch in $(git branch | grep -v "^\*" | grep -v "main"); do
  pr_state=$(gh pr list --head "$branch" --state all --json state -q '.[0].state // "NO_PR"')
  echo "$branch: $pr_state"
done

# Delete branches with MERGED or CLOSED PRs
git branch -D $branch
```

### Step 6: Clean up remote branches

```bash
# List remote branches (excluding main and HEAD)
git branch -r | grep -v HEAD | grep -v "origin/main"

# For each remote branch, check PR status and delete if merged/closed
for branch in $(git branch -r | grep -v HEAD | grep -v "origin/main" | sed 's|origin/||'); do
  pr_state=$(gh pr list --head "$branch" --state all --json state -q '.[0].state // "NO_PR"')
  if [ "$pr_state" = "MERGED" ] || [ "$pr_state" = "CLOSED" ]; then
    git push origin --delete "$branch"
  fi
done
```

### Step 7: Clean orphaned ai-builder branches

These are branches created by the AI builder that never got a PR:

```bash
# List ai-builder branches with no PR
git branch -r | grep "ai-builder" | sed 's|origin/||' | while read branch; do
  pr_state=$(gh pr list --head "$branch" --state all --json state -q '.[0].state // "NO_PR"')
  if [ "$pr_state" = "NO_PR" ]; then
    echo "Orphan: $branch"
    git push origin --delete "$branch"
  fi
done
```

### Step 8: Verify final state

```bash
echo "=== Local branches ==="
git branch

echo "=== Remote branches ==="
git branch -r | grep -v HEAD

echo "=== Worktrees ==="
git worktree list
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `git worktree list` | List all worktrees |
| `git worktree remove <path> --force` | Remove a worktree |
| `git worktree prune` | Clean up stale worktree refs |
| `git fetch --prune origin` | Prune deleted remote refs |
| `git branch --merged main` | List merged local branches |
| `git branch -d <branch>` | Delete merged local branch |
| `git branch -D <branch>` | Force delete local branch |
| `git push origin --delete <branch>` | Delete remote branch |
| `gh pr list --head <branch> --state all` | Check PR status for branch |

## Safety Measures

1. **Never delete main** - Always excluded from cleanup
2. **Check PR status** - Only delete branches with MERGED/CLOSED PRs
3. **Warn about uncommitted changes** - Alert user before removing worktrees
4. **Keep OPEN PR branches** - Never delete branches with open PRs
5. **Dry-run first** - List what will be deleted before deleting

## Troubleshooting

### Worktree directory not removed

If `git worktree remove` succeeds but the directory remains:
```bash
# The directory contains empty subdirectories
find /path/to/worktree -type f -delete
find /path/to/worktree -type d -empty -delete
rmdir /path/to/worktree
```

### Branch shows as not merged but PR is merged

This happens with squash merges. Check PR status:
```bash
gh pr list --head "branch-name" --state all --json state,mergedAt
```

If merged, use `git branch -D` (force delete).

### Permission denied deleting remote branch

You may not have push access. Check your permissions:
```bash
gh repo view --json viewerPermission
```

## Instructions for AI

When executing this skill:

1. **Always check for uncommitted changes first** - Warn user if any worktree has uncommitted work
2. **Verify PR status before deleting** - Never delete a branch without checking its PR status
3. **Use --force for worktrees** - Safe because git tracks the actual work, not the directory
4. **Use -D for squash-merged branches** - These won't show in `--merged`
5. **Skip branches with OPEN PRs** - These are active work
6. **Delete orphan ai-builder branches** - If NO_PR status, they're abandoned
7. **Report what was cleaned** - Give a summary of deleted branches and worktrees
8. **Verify final state** - Show remaining branches after cleanup

**Expected output:**
- Number of worktrees removed
- Number of local branches deleted
- Number of remote branches deleted
- List of any branches kept (with open PRs)
- Final state showing only main branch locally
