---
name: maint
description: "Automated maintenance: scan codebase, create issues, implement fixes, submit PRs."
---

# Maintenance Worker Skill

An interactive maintenance agent that automates the complete scan-fix-PR workflow for codebase maintenance.

**Configuration**: Read `.claude/project.config.json` for:
- Worktree pattern: `worktree.base_dir_pattern`
- Builder directory: `paths.builder_dir`
- Project repo: `project.repo_owner`, `project.repo_name`

## When to Use This Skill

- "Run maintenance scans"
- "Start maintenance worker"
- "Do a maintenance pass"
- "Run the maintenance agent"
- When you want to run maintenance scans and automatically fix issues

## Available Scanners

The following maintenance scanners are available:

| Scanner ID | Name | Description |
|------------|------|-------------|
| `security` | Security Scanner | Scans for security vulnerabilities |
| `code-modularity` | Code Modularity | Analyzes code organization and coupling |
| `feature-completeness` | Feature Completeness | Checks for TODOs, incomplete code |
| `architecture-review` | Architecture Review | Evaluates design patterns |
| `code-deduper` | Code De-duplicator | Finds duplicate code |
| `accessibility` | Accessibility Scanner | Audits for WCAG compliance |
| `performance` | Performance Analyzer | Identifies bottlenecks |
| `test-coverage` | Test Coverage | Analyzes test gaps |
| `code-quality` | Code Quality | Checks coding standards |
| `docs-updater` | Documentation Updater | Syncs docs with code |
| `chakra-audit` | Chakra UI Auditor | Audits Chakra UI usage |

## Workflow Steps

### Step 1: Setup Worktree

> Standard worktree lifecycle: see `.claude/skills/shared/WORKTREE_LIFECYCLE.md` for the common pattern. Below describes only what differs for this skill.

Create an isolated git worktree for the maintenance work:

```bash
# Generate unique worktree name based on timestamp
WORKTREE_NAME="maintenance-$(date +%Y%m%d%H%M%S)"
# Read worktree pattern from config: worktree.base_dir_pattern
WORKTREE_PATH="$CLAUDE_PROJECT_DIR/../worktree-${WORKTREE_NAME}"

# Create worktree from main
git worktree add "$WORKTREE_PATH" -b "maintenance/${WORKTREE_NAME}" origin/main

# Navigate to worktree
cd "$WORKTREE_PATH"
```

### Step 2: Present Scanner Options

Use AskUserQuestion to present the available scanners:

```
Question: Which maintenance scan would you like to run?

Options:
1. security - Security vulnerability scan
2. code-modularity - Code organization analysis
3. feature-completeness - TODO and incomplete code check
4. architecture-review - Design pattern evaluation
5. code-deduper - Duplicate code detection
6. accessibility - WCAG accessibility audit
7. performance - Performance bottleneck analysis
8. test-coverage - Test gap analysis
9. code-quality - Coding standards check
10. docs-updater - Documentation sync
11. chakra-audit - Chakra UI usage audit
```

### Step 3: Run the Selected Scanner

Execute the scanner (if your project has a scanner runner):

```bash
# If using a scanner module (read builder path from config: paths.builder_dir)
cd "$WORKTREE_PATH" && python -m {BUILDER_MODULE}.scanners.scanner_runner \
  --scanner SCANNER_ID \
  --repo . \
  --output summary

# To get full markdown output
python -m {BUILDER_MODULE}.scanners.scanner_runner \
  --scanner SCANNER_ID \
  --repo . \
  --output markdown > /tmp/scan-results.md

# To list all available scanners
python -m {BUILDER_MODULE}.scanners.scanner_runner --list
```

Alternative: Run your project-specific scanner commands here

### Step 4: Create GitHub Issue

Create an issue to track the scan findings:

```bash
gh issue create \
  --title "Maintenance Scan: SCANNER_NAME - X issues found" \
  --body "$(cat /tmp/scan-results.md)"
```

Store the issue number for later reference.

### Step 5: Implement Fixes

Based on the scanner type, implement appropriate fixes:

#### For `chakra-audit`:
- Run bulk prop renames (isOpen->open, isLoading->loading, colorScheme->colorPalette)
- Convert onClose handlers to onOpenChange
- Replace hardcoded colors with semantic tokens
- Add aria-labels to icon buttons
- Convert inline styles to Chakra props

#### For `security`:
- Fix identified security vulnerabilities
- Update dependencies with known CVEs
- Remove hardcoded secrets

#### For `code-quality`:
- Remove console.log statements
- Fix unused imports/variables
- Apply linting fixes

#### For `accessibility`:
- Add missing aria-labels
- Add alt text to images
- Fix focus management issues

#### For other scanners:
- Review findings and implement appropriate fixes
- Use judgment on what can be automated vs what needs manual review

### Step 6: Commit Changes

Stage and commit all fixes:

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: remediate SCANNER_NAME findings

Fixes X issues identified by maintenance scan.

See issue #ISSUE_NUMBER for details.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### Step 7: Push and Create PR

```bash
# Push the branch
git push -u origin "maintenance/${WORKTREE_NAME}"

# Create PR
gh pr create \
  --title "fix: remediate SCANNER_NAME findings" \
  --body "$(cat <<'EOF'
## Summary

Remediates findings from maintenance scan.

Closes #ISSUE_NUMBER

## Changes

[List of changes made]

## Test Plan

- [x] Fixes applied correctly
- [x] No new issues introduced

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Step 8: Merge PR

```bash
# Get PR number
PR_URL=$(gh pr view --json url -q .url)

# Merge the PR
gh pr merge --squash --delete-branch
```

If there are merge conflicts:
1. Fetch latest main: `git fetch origin main`
2. Rebase: `git rebase origin/main`
3. Resolve conflicts manually
4. Force push: `git push --force-with-lease`
5. Try merge again

### Step 9: Prompt for Next Action

Use AskUserQuestion to ask the user:

```
Question: Scan complete! What would you like to do next?

Options:
1. Run another scan - Choose a different maintenance scanner
2. Quit - Clean up worktrees and exit
```

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

## Important Notes

### Worktree Management
- Always create a fresh worktree for each maintenance session
- Use timestamped names to avoid conflicts
- Clean up worktrees when done to avoid clutter

### Error Handling
- If scanner fails, report error and offer to try another scanner
- If PR creation fails, offer to retry or skip
- If merge conflicts occur, attempt automatic resolution first

### Scan Frequency Recommendations
| Scanner | Recommended Frequency |
|---------|----------------------|
| security | Weekly |
| code-quality | Weekly |
| chakra-audit | Weekly |
| test-coverage | Bi-weekly |
| accessibility | Monthly |
| architecture-review | Monthly |
| docs-updater | Weekly |

## Instructions for AI

When executing this skill:

1. **Create worktree first** - Always work in an isolated worktree
2. **Present options clearly** - Use AskUserQuestion for scanner selection
3. **Run scanner via Python** - Use the scanner registry to run scans
4. **Create issue before fixing** - Track findings in GitHub issue
5. **Implement fixes systematically** - Use bulk operations where possible
6. **Test fixes** - Verify changes don't break the build
7. **Create descriptive PRs** - Include summary of changes and issue reference
8. **Handle merge conflicts** - Attempt automatic resolution
9. **Loop until quit** - Continue offering scans until user chooses to quit
10. **Clean up thoroughly** - Remove worktrees and prune branches on exit

## Example Session

```
User: /maintenance-worker

AI: Starting maintenance worker. Let me create a worktree first.
[Creates worktree at $CLAUDE_PROJECT_DIR/../worktree-maintenance-20251231220000]

AI: Which maintenance scan would you like to run?
[Presents scanner options]

User: chakra-audit

AI: Running Chakra UI audit...
[Runs scanner, finds 150 issues]

AI: Found 150 issues. Creating GitHub issue to track...
[Creates issue #615]

AI: Implementing fixes...
[Fixes 140 issues automatically]

AI: Creating PR...
[Creates PR #616, merges it]

AI: Done! 140 of 150 issues fixed and merged.

AI: What would you like to do next?
1. Run another scan
2. Quit

User: Quit

AI: Cleaning up worktree...
[Removes worktree, prunes branches]

AI: Maintenance session complete! Cleaned up all temporary resources.
```
