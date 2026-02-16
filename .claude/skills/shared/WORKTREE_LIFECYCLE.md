---
name: shared-worktree-lifecycle
description: Standard worktree lifecycle pattern referenced by multiple skills
---

# Standard Worktree Lifecycle

Shared pattern for skills that use isolated git worktrees for implementation work.

**Configuration**: Read `.claude/project.config.json` for:
- Worktree base pattern: `worktree.base_dir_pattern`
- Project info: `project.name`, `project.repo_owner`, `project.repo_name`
- GitHub labels: `github.labels.*`

## Phase 1: Setup

1. Create worktree from main branch:
   ```bash
   git fetch origin main
   git worktree add {worktree_path} -b {branch_name} origin/main
   ```
2. Install dependencies in worktree
3. Verify clean state

## Phase 2: Branch Naming

| Work Type | Pattern | Example |
|-----------|---------|---------|
| Feature | `feature/{issue}-{description}` | `feature/123-add-auth` |
| Bug fix | `fix/{issue}-{description}` | `fix/456-null-check` |
| Maintenance | `maint/{scanner}-{timestamp}` | `maint/security-20260207` |
| Monitor fix | `fix/pipeline-{stage}-{timestamp}` | `fix/pipeline-build-20260207` |

## Phase 3: Implementation

1. Make code changes
2. Run quality gates: `npm run lint && npm run type-check && npm test`
3. Fix any failures before proceeding

## Phase 4: Commit & PR

1. Stage changes: `git add <specific files>`
2. Commit with conventional format:
   ```bash
   git commit -m "$(cat <<'EOF'
   <type>(<scope>): <description>

   <body>

   Co-Authored-By: Claude <noreply@anthropic.com>
   EOF
   )"
   ```
3. Push branch: `git push -u origin {branch_name}`
4. Create PR: `gh pr create --title "<title>" --body "<body>"`
5. Merge PR: `gh pr merge <number> --squash --delete-branch`

## Phase 5: Cleanup

1. Return to main worktree
2. Remove worktree: `git worktree remove {worktree_path}`
3. Prune: `git worktree prune`
4. Update main: `git pull origin main`

## Error Handling

- If quality gates fail: fix in place, do NOT skip
- If PR has conflicts: rebase onto main, resolve, force-push branch
- If merge fails: check for required reviews or CI status
- If worktree removal fails: force with `git worktree remove --force {path}`
