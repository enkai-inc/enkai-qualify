---
name: eval
description: "Resolve GitHub issues: worktree, implement, PR, merge. Use to process the issue queue."
---

# Issue Evaluator Skill

An interactive issue-processing agent that evaluates GitHub issues, checks their status, implements fixes if needed, and handles the full PR workflow.

## Configuration

**IMPORTANT**: Read `.claude/project.config.json` for project-specific settings:
- GitHub labels: `github.labels.build`, `github.labels.in_progress`, `github.labels.needs_human`
- Worktree pattern: `worktree.base_dir_pattern`

All code examples use placeholders like `{BUILD_LABEL}`, `{IN_PROGRESS_LABEL}`, etc. Replace these with actual values from the config file.

## When to Use This Skill

- "Evaluate issue #123"
- "Process issue queue"
- "Work on GitHub issues"
- "Resolve pending issues"
- When you want to work through issues labeled with the build label

## Workflow Steps

### Step 0: Parse Arguments or List Issues

If an issue number is provided as an argument (e.g., `/eval 123`), use that issue directly.

If no issue number is provided, list available issues and let the user choose:

```bash
# List issues eligible for work
gh issue list --label "{BUILD_LABEL}" --state open --json number,title,labels --limit 20
```

Use AskUserQuestion to present the issues and let user select one.

### Step 1: Setup Worktree

> Standard worktree lifecycle: see `.claude/skills/shared/WORKTREE_LIFECYCLE.md` for the common pattern. Below describes only what differs for this skill.

Create an isolated git worktree for the issue work:

```bash
# Get issue details
ISSUE_NUMBER=<selected issue number>
ISSUE_TITLE=$(gh issue view $ISSUE_NUMBER --json title -q .title)

# Generate worktree name from issue
# Read worktree pattern from .claude/project.config.json: worktree.base_dir_pattern
WORKTREE_NAME="issue-${ISSUE_NUMBER}"
WORKTREE_PATH="$CLAUDE_PROJECT_DIR/../worktree-issue-${ISSUE_NUMBER}"

# Create worktree from main
git worktree add "$WORKTREE_PATH" -b "issue/${ISSUE_NUMBER}" origin/main

# Navigate to worktree
cd "$WORKTREE_PATH"
```

### Step 2: Claim the Issue

Claim the issue to prevent duplicate work:

```bash
# Add in-progress label
gh issue edit $ISSUE_NUMBER --add-label "{IN_PROGRESS_LABEL}"

# Add claiming comment
gh issue comment $ISSUE_NUMBER --body "Claimed by eval agent for resolution."
```

### Step 3: Investigate Issue Status

Check if the issue has already been resolved:

```bash
# Check for linked PRs
gh pr list --search "closes #$ISSUE_NUMBER OR fixes #$ISSUE_NUMBER" --state all --json number,state,mergedAt

# Check issue comments for resolution notes
gh issue view $ISSUE_NUMBER --comments

# Check if there's already a branch with work
git branch -a | grep -i "issue.*$ISSUE_NUMBER\|$ISSUE_NUMBER"
```

If the issue is already resolved (merged PR exists):
1. Remove `{IN_PROGRESS_LABEL}` label
2. Add `{DONE_LABEL}` label
3. Skip to Step 9 (prompt for next action)

### Step 4: Read Issue Details

Fetch the full issue content to understand requirements:

```bash
# Get issue body and comments
gh issue view $ISSUE_NUMBER

# Save to temp file for reference
gh issue view $ISSUE_NUMBER --json body,title,comments > /tmp/issue-$ISSUE_NUMBER.json
```

Analyze:
- Acceptance criteria
- How to test
- Any linked PRs or issues
- Comments with additional context

### Step 5: Implement the Fix

Based on the issue type and requirements:

1. **Read and understand the codebase** - Use grep/glob to find relevant files
2. **Implement changes** - Make the necessary code changes
3. **Run tests** - Verify changes don't break anything:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```
4. **Fix any issues** - Iterate until quality gates pass

### Step 6: Commit Changes

Stage and commit all fixes:

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: resolve issue #ISSUE_NUMBER - SHORT_DESCRIPTION

Implements the fix for the issue requirements.

Closes #ISSUE_NUMBER

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Step 7: Push and Create PR

```bash
# Push the branch
git push -u origin "issue/${ISSUE_NUMBER}"

# Create PR
gh pr create \
  --title "fix: resolve issue #ISSUE_NUMBER - SHORT_DESCRIPTION" \
  --body "$(cat <<'EOF'
## Summary

Resolves the requirements specified in issue #ISSUE_NUMBER.

Closes #ISSUE_NUMBER

## Changes

[List of changes made]

## Test Plan

- [x] Lint passes
- [x] Tests pass
- [x] Build succeeds
- [ ] Manual verification of acceptance criteria

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Step 8: Merge PR

```bash
# Get PR number
PR_URL=$(gh pr view --json url -q .url)

# Wait for CI checks if needed
gh pr checks --watch

# Merge the PR
gh pr merge --squash --delete-branch
```

If there are merge conflicts:
1. Fetch latest main: `git fetch origin main`
2. Rebase: `git rebase origin/main`
3. Resolve conflicts manually
4. Force push: `git push --force-with-lease`
5. Try merge again

After successful merge:
```bash
# Update issue labels
gh issue edit $ISSUE_NUMBER --remove-label "{IN_PROGRESS_LABEL}" --remove-label "{BUILD_LABEL}"
gh issue edit $ISSUE_NUMBER --add-label "{DONE_LABEL}"
```

### Step 9: Auto-Continue with Sibling Subtasks (Epic Continuation)

After completing an issue, **automatically** check if it's part of an epic and continue with siblings:

```bash
# Check if this issue has a parent epic by looking at the issue body for "Tracked by #XXX", "Part of #XXX", etc.
PARENT_ISSUE=$(gh issue view $ISSUE_NUMBER --json body -q '.body' | grep -oP '(?:Tracked by|Part of|Parent:|Epic:)\s*#?\K\d+' | head -1)

# If no explicit parent, check if any open issues reference this one as a subtask
if [ -z "$PARENT_ISSUE" ]; then
  PARENT_ISSUE=$(gh issue list --state open --json number,body --limit 50 | jq -r ".[] | select(.body | contains(\"#$ISSUE_NUMBER\")) | .number" | head -1)
fi

if [ -n "$PARENT_ISSUE" ]; then
  echo "Found parent epic: #$PARENT_ISSUE"

  # Find ALL open sibling issues that reference this epic
  SIBLINGS=$(gh issue list --state open --json number,title,body,labels --limit 50 | jq -r ".[] | select(.body | contains(\"Tracked by #$PARENT_ISSUE\") or contains(\"Part of #$PARENT_ISSUE\")) | .number")

  # Process siblings in order, adding {BUILD_LABEL} label if needed
  for SIBLING in $SIBLINGS; do
    if [ "$SIBLING" != "$ISSUE_NUMBER" ]; then
      SIBLING_STATE=$(gh issue view $SIBLING --json state -q '.state')
      if [ "$SIBLING_STATE" = "OPEN" ]; then
        # Add {BUILD_LABEL} label if not present, then continue
        gh issue edit $SIBLING --add-label "{BUILD_LABEL}" 2>/dev/null || true
        NEXT_SIBLING=$SIBLING
        break
      fi
    fi
  done
fi
```

**IMPORTANT: Do NOT prompt the user when sibling subtasks exist.**

**If a sibling subtask is found:**
1. Inform the user: "Continuing with sibling subtask #$NEXT_SIBLING from epic #$PARENT_ISSUE"
2. **Automatically** continue to Step 1 with `ISSUE_NUMBER=$NEXT_SIBLING`
3. Repeat until ALL sibling subtasks are completed

**If no sibling subtasks remain:**
- Continue to Step 9b (prompt for next action)

### Step 9b: Prompt for Next Action (Only When Epic Complete)

**Only use this step when there are NO more sibling subtasks in the epic.**

Use AskUserQuestion to ask the user:

```
Question: All sibling issues from epic #PARENT_ISSUE completed! What would you like to do next?

Options:
1. Tackle another issue - Pick another issue from the queue
2. Quit - Clean up worktrees and exit
```

If user chooses to tackle another:
- Go back to Step 0 (list issues)
- Reuse the same worktree or create a new one as needed

### Step 10: Cleanup (on Quit)

If user chooses to quit, clean up:

```bash
# Go back to main repo
cd $CLAUDE_PROJECT_DIR

# Remove the worktree
git worktree remove "$WORKTREE_PATH" --force

# Prune any stale worktrees
git worktree prune

# Delete any orphaned local branches
git fetch --prune origin
git branch -vv | grep ': gone]' | awk '{print $1}' | xargs -r git branch -D
```

## Issue Labels Reference

| Label | Meaning |
|-------|---------|
| `{BUILD_LABEL}` | Issue is ready to be worked on |
| `{IN_PROGRESS_LABEL}` | Currently being worked on |
| `{NEEDS_HUMAN_LABEL}` | Blocked on human decision |
| `{FAILED_LABEL}` | Worker stopped; needs follow-up (from config) |
| `{DONE_LABEL}` | Completed and merged |

## Important Notes

### Issue Selection
- By default, filter for `{BUILD_LABEL}` label
- Skip issues with `{IN_PROGRESS_LABEL}` (already claimed)
- Skip issues with `{NEEDS_HUMAN_LABEL}` (blocked)

### Conflict Resolution
- Always check if issue is already resolved before starting work
- If a PR already exists, check if it can be merged or needs updates

### Quality Gates
- Never merge without passing lint, test, and build
- If gates fail, fix the issues before proceeding

### Error Handling
- If implementation fails, remove `{IN_PROGRESS_LABEL}` label
- Add `{FAILED_LABEL}` label (from config) and comment explaining the failure
- Offer to try another issue

## Instructions for AI

When executing this skill:

1. **Parse arguments first** - Check if issue number provided, otherwise list issues
2. **Create worktree** - Always work in an isolated worktree
3. **Claim the issue** - Add in-progress label and comment
4. **Check if resolved** - Don't duplicate work on already-merged issues
5. **Read full issue** - Understand requirements before implementing
6. **Implement carefully** - Follow existing code patterns
7. **Run quality gates** - Lint, test, build must pass
8. **Create descriptive PR** - Include summary and link to issue
9. **Handle merge conflicts** - Attempt automatic resolution
10. **AUTO-CONTINUE with epic siblings** - After completing an issue, check if it's part of an epic. If sibling subtasks exist, **automatically continue without prompting**. Add `{BUILD_LABEL}` label to siblings if needed.
11. **Only prompt when epic complete** - Only ask user what to do next when ALL sibling subtasks in the epic are done
12. **Clean up thoroughly** - Remove worktrees and prune branches on exit

**CRITICAL**: When sibling subtasks exist, do NOT use AskUserQuestion. Just continue working.

## Example Session

```
User: /eval

AI: Let me check for available issues...

Found 3 issues with {BUILD_LABEL} label:
1. #142 - Add dark mode toggle
2. #145 - Fix navigation breadcrumb
3. #148 - Update API error messages

Which issue would you like to tackle?

User: 1 (or #142)

AI: Starting work on issue #142 - Add dark mode toggle.
Creating worktree at $CLAUDE_PROJECT_DIR-issue-142...
Claiming issue...

AI: Reading issue details...
[Analyzes issue requirements]

AI: Issue is not yet resolved. Implementing the fix...
[Makes code changes]
[Runs quality gates]

AI: All quality gates passed. Creating PR...
[Creates and merges PR]

AI: Issue #142 resolved and merged!

What would you like to do next?
1. Tackle another issue
2. Quit

User: 2

AI: Cleaning up worktree...
[Removes worktree, prunes branches]

AI: Session complete! Cleaned up all temporary resources.
```

## Example with Argument

```
User: /eval 142

AI: Starting work on issue #142 directly.
Creating worktree at $CLAUDE_PROJECT_DIR-issue-142...
[Continues with workflow from Step 1]
```

## Example with Epic Continuation (Auto-Continue)

```
User: /eval 1566

AI: Starting work on issue #1566 - Enkai CDK Stack.
Creating worktree...
[Implements changes, creates PR, merges]

AI: Issue #1566 resolved and merged!
Found parent epic: #1558 (Infrastructure Foundation)
Found 3 sibling subtasks: #1567, #1569, #1572

Continuing with sibling subtask #1567 - Step Functions Orchestrator...
[Implements changes, creates PR, merges]

AI: Issue #1567 resolved and merged!
Continuing with sibling subtask #1569 - ValidatorGate Service...
[Implements changes, creates PR, merges]

AI: Issue #1569 resolved and merged!
Continuing with sibling subtask #1572 - Cedar Policies...
[Implements changes, creates PR, merges]

AI: Issue #1572 resolved and merged!
All sibling issues from epic #1558 completed!

What would you like to do next?
1. Tackle another issue
2. Quit
```

Note: The AI does NOT prompt between sibling issues - it automatically continues until the entire epic is complete.