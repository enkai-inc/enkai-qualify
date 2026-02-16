---
name: bug
description: "Fix bugs in isolated worktree: diagnose, fix, commit, PR, merge, cleanup."
---

# Bug Fix Skill

An interactive agent that manages a bugfix session with isolated worktree, creating PRs for each fix and cleaning up when done.

**Configuration**: Read `.claude/project.config.json` for:
- Worktree patterns: `worktree.bugfix_pattern` or `worktree.base_dir_pattern`

## When to Use This Skill

- "Fix this bug: [description]"
- "Start a bug fixing session"
- "Run /bug"
- When the user wants to fix multiple small bugs in sequence

## Workflow Overview

```
Start Session
       |
Create worktree + branch
       |
   +---v---+
   |  Loop |<------------------+
   +---+---+                   |
       |                       |
  User describes bug           |
       |                       |
  Fix the bug                  |
       |                       |
  Commit + Push                |
       |                       |
  Create PR + Merge            |
       |                       |
  Ask: Another bug? --[Yes]----+
       |
      [No]
       |
  Cleanup worktree + branch
       |
     Done
```

## Session Lifecycle

### 1. Start Session

> Standard worktree lifecycle: see `.claude/skills/shared/WORKTREE_LIFECYCLE.md` for the common pattern. Below describes only what differs for this skill.

When the skill is invoked:

1. **Create worktree and branch**:
   ```bash
   # Generate unique session name
   SESSION_ID=$(date +%Y%m%d%H%M%S)
   BRANCH_NAME="bugfix/session-$SESSION_ID"
   # Read worktree pattern from config: worktree.bugfix_pattern
   WORKTREE_PATH="$CLAUDE_PROJECT_DIR/../bugfix-$SESSION_ID"

   # Create worktree with new branch from main
   git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME" origin/main
   ```

2. **Store session state** (remember for cleanup):
   - `SESSION_ID`
   - `BRANCH_NAME`
   - `WORKTREE_PATH`

3. **Confirm ready**:
   ```
   Bug fix session started!

   Worktree: $WORKTREE_PATH[SESSION_ID]
   Branch: bugfix/session-[SESSION_ID]

   Describe the first bug to fix, or say "done" to end the session.
   ```

### 2. Bug Fix Loop

For each bug the user describes:

#### 2.1 Understand the Bug
- Read relevant files to understand the issue
- Identify the root cause
- Plan the fix

#### 2.2 Implement the Fix
- Make minimal, focused changes
- Work in the worktree directory
- Follow existing code patterns

#### 2.3 Verify the Fix
```bash
# Run type check
cd "$WORKTREE_PATH/dashboard" && npx tsc --noEmit

# Run linter (if applicable)
npm run lint

# Run tests (if applicable)
npm test
```

#### 2.4 Commit and Push
```bash
cd "$WORKTREE_PATH"

# Stage changes
git add -A

# Commit with descriptive message
git commit -m "$(cat <<'EOF'
fix: [short description]

[Detailed explanation of what was fixed and why]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# Push to remote
git push -u origin "$BRANCH_NAME"
```

#### 2.5 Create PR and Merge

```bash
# Create PR
gh pr create \
  --title "fix: [short description]" \
  --body "$(cat <<'EOF'
## Summary
[1-2 sentence description]

## Changes
- [bullet points of changes]

## Testing
- [x] TypeScript compiles
- [x] Linter passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"

# Wait for checks (brief)
sleep 5

# Merge the PR
gh pr merge --squash --delete-branch=false
```

#### 2.6 Handle Merge Conflicts

If merge fails due to conflicts:

```bash
# Fetch latest main
git fetch origin main

# Rebase onto main
git rebase origin/main

# If conflicts occur, resolve them:
# - Read both versions
# - Choose correct resolution
# - git add <resolved-files>
# - git rebase --continue

# Force push the rebased branch
git push --force-with-lease

# Retry merge
gh pr merge --squash --delete-branch=false
```

#### 2.7 Sync for Next Bug

After successful merge:

```bash
# Update local branch with merged changes
git fetch origin main
git reset --hard origin/main
```

#### 2.8 Ask for Next Bug

```
Bug fixed and merged!

PR: [URL]

Describe the next bug to fix, or say "done" to end the session.
```

### 3. End Session

When user says "done" or wants to stop:

```bash
# Return to main repo
cd "$CLAUDE_PROJECT_DIR"

# Remove the worktree
git worktree remove "$WORKTREE_PATH" --force

# Delete the local branch
git branch -D "$BRANCH_NAME"

# Delete remote branch if it still exists
git push origin --delete "$BRANCH_NAME" 2>/dev/null || true
```

Confirm cleanup:
```
Bug fix session complete!

Cleaned up:
- Worktree: [path] (removed)
- Branch: [name] (deleted)

[X] bugs fixed and merged.
```

## Important Guidelines

### Working Directory
- Always work in the WORKTREE directory, not the main repo
- Use absolute paths: `{WORKTREE_PATH}/[SESSION_ID]/`

### Minimal Changes
- Only fix the specific bug described
- Don't refactor surrounding code
- Don't add features

### Quality Gates
- Run `tsc --noEmit` before committing
- Fix any type errors introduced
- Keep existing tests passing

### Conflict Resolution
- Always prefer accepting incoming changes for generated files (*.tsbuildinfo, lock files)
- For code conflicts, understand both versions before resolving
- Test after resolving conflicts

### Branch Management
- Use unique session IDs to avoid branch conflicts
- Clean up branches after merging
- Don't leave orphaned worktrees

## Error Handling

### Worktree Already Exists
```bash
# Remove stale worktree
git worktree remove "$WORKTREE_PATH" --force
# Retry creation
```

### Branch Already Exists
```bash
# Delete old branch
git branch -D "$BRANCH_NAME"
git push origin --delete "$BRANCH_NAME" 2>/dev/null || true
# Retry creation
```

### PR Checks Failing
- Read the failure output
- Fix the issue
- Amend the commit
- Force push
- Retry merge

### Network Issues
- Retry push/merge operations
- Check GitHub status if persistent

## Example Session

```
User: /bug

AI: Bug fix session started!

Worktree: $WORKTREE_PATH20260101190000
Branch: bugfix/session-20260101190000

Describe the first bug to fix, or say "done" to end the session.

User: The header shows "undefined" when there's no user name

AI: Let me find and fix that issue.

[Reads relevant files]
[Makes the fix]
[Runs type check]
[Commits and pushes]
[Creates PR and merges]

Bug fixed and merged!

PR: https://github.com/{REPO_OWNER}/{REPO_NAME}/pull/XXX

Describe the next bug to fix, or say "done" to end the session.

User: done

AI: Bug fix session complete!

Cleaned up:
- Worktree: $WORKTREE_PATH20260101190000 (removed)
- Branch: bugfix/session-20260101190000 (deleted)

1 bug fixed and merged.
```

## State to Track

Throughout the session, maintain:
- `SESSION_ID`: Unique identifier for this session
- `BRANCH_NAME`: The git branch name
- `WORKTREE_PATH`: Path to the worktree
- `BUG_COUNT`: Number of bugs fixed (for final summary)
- `PR_URLS`: List of merged PR URLs
