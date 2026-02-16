---
name: feature-dev
description: "Guided feature development with codebase understanding and architecture focus."
---

# /feature-dev

## Mode Detection

Parse `$ARGUMENTS` to determine mode:
- **Issue mode**: Argument matches `#\d+` or `\d+` (e.g., `#34`, `34`) -> Full automated workflow
- **Description mode**: Free-form text -> Standard development workflow (create worktree, plan, implement, PR)

---

## Ralph Wiggum Framework

This skill uses the **Ralph technique** for iterative completion:

### How It Works
1. **Work on the task** following the phases below
2. **Check progress** after each logical unit of work
3. **Output completion promise** when ALL phases are truly complete
4. **Continue iterating** if there's more work to do

### Completion Promise
When you have completed ALL phases of the workflow (setup, spec, implementation, tests passing, PR created, and merged), output:

```
<promise>FEATURE_COMPLETE</promise>
```

### Guidelines
- **DO NOT** output the promise until everything is done
- **DO** continue working if tests fail, linting errors occur, or PR creation fails
- **DO** fix any issues that arise during implementation
- **DO** ensure all acceptance criteria in the spec are met
- The promise signals that the feature is ready and merged

---

## Common Mistakes

Avoid these patterns when developing features:

### WRONG: Over-engineering beyond the spec

```
The spec says: "Add a button to toggle dark mode"

WRONG approach:
- Creating a full theming system with 10+ color schemes
- Adding theme persistence across sessions when not requested
- Building a theme customization UI
- Adding animation transitions between themes

RIGHT approach:
- Add a single toggle button
- Implement light/dark mode only
- Store preference if the spec mentions it
- Keep it simple and focused
```

### WRONG: Modifying tooling configs instead of fixing code

```
Lint error: 'useEffect has missing dependency'

WRONG approach:
- Adding // eslint-disable-next-line to the file
- Modifying .eslintrc to disable the rule globally
- Changing eslint config to warn instead of error
- Removing the lint script from package.json

RIGHT approach:
- Add the missing dependency to the useEffect array
- Refactor the code to not need that dependency
- Use useCallback/useMemo if the dependency causes re-renders
- Understand WHY the linter is complaining and fix the root cause
```

### WRONG: Skipping quality gates

```
CI is failing on lint/type-check/tests

WRONG approach:
- Committing with --no-verify to skip pre-commit hooks
- Removing tests that are failing
- Commenting out type checks
- Pushing to see if CI magically passes
- Using 'any' type to silence TypeScript errors

RIGHT approach:
- Run `npm run lint` locally and fix all errors
- Run `npm run type-check` and resolve type issues
- Run `npm test` and fix failing tests
- Ensure ALL quality gates pass BEFORE committing
- If a test is truly obsolete, discuss with the team first
```

### WRONG: Making unrelated changes

```
Task: "Fix the login button alignment"

WRONG approach:
- Refactoring the entire auth module while you're there
- Updating unrelated dependencies
- Renaming variables in files you happen to open
- Adding features you think would be nice
- Fixing other bugs you notice (create issues for them instead)

RIGHT approach:
- Change ONLY what's needed for the login button alignment
- If you find other issues, create separate issues for them
- Keep the PR focused and reviewable
- One PR = one logical change
```

### WRONG: Hardcoding values that should be configurable

```
Task: "Add API timeout handling"

WRONG approach:
- timeout: 5000 // hardcoded everywhere
- if (response.time > 5000) // magic numbers
- Creating test data that only works for specific inputs

RIGHT approach:
- const API_TIMEOUT_MS = 5000 // single source of truth
- import { API_TIMEOUT_MS } from '@/config'
- Make tests work with any valid input, not just test data
```

### WRONG: Ignoring existing patterns

```
Codebase uses React Query for data fetching

WRONG approach:
- Using raw fetch() for a new API call
- Creating a custom caching solution
- Using different state management for this one feature
- Inventing new file naming conventions

RIGHT approach:
- Use React Query like the rest of the codebase
- Follow existing folder structure and naming
- Match the code style of surrounding files
- If a pattern is wrong, discuss changing it globally
```

---

## Feature Specification Template

**Configuration**: Read `.claude/project.config.json` for:
- Feature spec template: `paths.feature_spec_template`
- Atlas features path: `paths.atlas_features_dir`
- Atlas tier paths: `paths.atlas_tiers.*`
- Worktree patterns: `worktree.base_dir_pattern`

All features use the Feature Specification (FS) template. The completed spec is published to the atlas features directory.

### Template Reference

Read the feature spec template from config path. Key sections:
- `document_metadata`: Feature ID, version, owner, status
- `feature_overview`: Summary, business value, success metrics
- `requirements`: Functional (with Given/When/Then acceptance criteria), non-functional
- `technical_design`: Data model changes, API changes, service interactions
- `edge_cases`: Edge case handling
- `testing_requirements`: Unit, integration, e2e test requirements
- `rollout_plan`: Phases, feature flags, rollback triggers

---

## Issue Mode Workflow (when argument is `#N` or `N`)

> Standard worktree lifecycle: see `.claude/skills/shared/WORKTREE_LIFECYCLE.md` for the common pattern. Below describes only what differs for this skill.

### Phase 1: Setup
1. **Fetch issue details**: `gh issue view {N} --json number,title,body,labels`
2. **Extract short name**: Generate kebab-case name from issue title (e.g., "Add dark mode" -> `add-dark-mode`)
3. **Mark issue as in-progress**: `gh issue edit {N} --add-label "{IN_PROGRESS_LABEL}"` (read from config `github.labels.in_progress`)
4. **Check for existing worktree**: `git worktree list | grep issue-{N}`
   - If exists, `cd` to it and continue from where we left off
   - If not, create new using worktree pattern from config: `git worktree add {WORKTREE_PATH} -b issue-{N}-{short-name} main`
5. **Install dependencies** (if new worktree): `cd {WORKTREE_PATH}/{DASHBOARD_DIR} && npm install` (use paths from config)

### Phase 2: Feature Specification
6. **Read context**:
   - Issue body (the spec)
   - Project context files from config: `context_files` array
   - System map from: `{paths.atlas_dir}/tier5-reference/02-system-map.md` or similar
   - Feature spec template from: `paths.feature_spec_template`
   - Relevant existing feature specs in features directory (from config)
7. **Search codebase**: Find files related to the feature
8. **Create Feature Specification** at `{FEATURES_DIR}/{short-name}.md` (use path from config):
   - Use the FS template structure (YAML frontmatter + markdown)
   - Assign feature ID: `FS-{YYYY}-{NNN}` (increment from existing)
   - Set status: `implementing`
   - Fill in all sections from the issue + codebase analysis:
     - `feature_overview`: Summary, business value, success metrics
     - `requirements`: Functional requirements with Given/When/Then acceptance criteria
     - `technical_design`: Data model changes, API changes, files to modify
     - `edge_cases`: Identified edge cases
     - `testing_requirements`: What tests are needed
9. **Commit the spec**: `git add docs/atlas/features/{short-name}.md && git commit -m "docs: add feature spec for {short-name}"`

### Phase 3: Implementation
10. **Implement incrementally** (following the spec):
    - Work through each functional requirement in the spec
    - Write tests matching `testing_requirements`
    - Handle all listed `edge_cases`
    - Run `npm run type-check` and `npm run lint` frequently
    - Commit after each logical unit
11. **Run full test suite**: `npm test` in relevant directories
12. **Update spec status**: Change `status: "implementing"` -> `status: "complete"` in the spec

### Phase 4: Pull Request
13. **Commit all changes**: Use conventional commit format
14. **Push branch**: `git push -u origin issue-{N}-{short-name}`
15. **Create PR**:
    ```bash
    gh pr create --title "feat: {issue title}" --body "$(cat <<'EOF2'
    ## Summary
    Implements #{N}

    {brief description}

    ## Feature Spec
    See `docs/atlas/features/{short-name}.md`

    ## Changes
    - {list of changes}

    ## Test Plan
    - {how to verify}

    Closes #{N}

    Generated with [Claude Code](https://claude.com/claude-code)
    EOF2
    )"
    ```

### Phase 5: Merge
16. **Merge PR**: `gh pr merge --squash --delete-branch`
17. **Ask about next feature**: Ask the user if they want to work on another feature
18. **If yes, pull main and continue**:
    - Return to main repo: `cd` back to main repository
    - Pull latest changes: `git pull origin main`
    - Run `/feature-dev {next-issue-number}` or `/feature-dev {next-description}`
    - SKIP Phase 6 cleanup (it will run after the next feature)
19. **If no, proceed to Phase 6 cleanup**

### Phase 6: Cleanup (ALWAYS run this phase unless continuing to next feature)
20. **Return to main repo**: `cd` back to the main repository directory
21. **Remove worktree**: `git worktree remove ../enkai-issue-{N} --force` (force in case of uncommitted files)
22. **Prune stale worktrees**: `git worktree prune`
23. **Delete local branch** (if still exists): `git branch -D issue-{N}-{short-name} 2>/dev/null || true`
24. **Delete remote branch** (if --delete-branch failed): `git push origin --delete issue-{N}-{short-name} 2>/dev/null || true`
25. **Verify cleanup**: `git worktree list` and `git branch -a | grep issue-{N}` should show no matches

---

## Description Mode Workflow (standard development)

When argument is free-form text (not an issue number):

### Phase 1: Setup
1. **Create worktree**: Generate feature name from description (kebab-case)
   - `git worktree add ../enkai-{feature-name} -b feat/{feature-name} main`
2. **Install dependencies**: `cd ../enkai-{feature-name}/dashboard && npm install`

### Phase 2: Feature Specification
3. **Read context**:
   - `PROJECT_SPEC.md`
   - `docs/atlas/tier4-implementation/01-feature-specification-template.md`
   - Relevant existing feature specs
4. **Search codebase** for relevant files
5. **Create Feature Specification** at `docs/atlas/features/{feature-name}.md`:
   - Use the FS template structure
   - Assign feature ID: `FS-{YYYY}-{NNN}`
   - Set status: `implementing`
   - Fill in all sections based on the description + codebase analysis
6. **Commit the spec**: `git add docs/atlas/features/{feature-name}.md && git commit -m "docs: add feature spec for {feature-name}"`

### Phase 3: Implementation
7. **Implement in small pieces** following the spec
8. **Write tests** matching `testing_requirements`
9. **Handle edge cases** from the spec
10. **Update spec status** to `complete`

### Phase 4: Pull Request
11. **Commit, push, open PR** with review instructions:
    ```bash
    gh pr create --title "feat: {feature description}" --body "$(cat <<'EOF2'
    ## Summary
    {brief description}

    ## Feature Spec
    See `docs/atlas/features/{feature-name}.md`

    ## Changes
    - {list of changes}

    ## Test Plan
    - {how to verify}

    Generated with [Claude Code](https://claude.com/claude-code)
    EOF2
    )"
    ```

### Phase 5: Merge (after user approval)
12. **Merge PR**: `gh pr merge --squash --delete-branch`
13. **Ask about next feature**: Ask the user if they want to work on another feature
14. **If yes, pull main and continue**:
    - Return to main repo: `cd` back to main repository
    - Pull latest changes: `git pull origin main`
    - Run `/feature-dev {next-issue-number}` or `/feature-dev {next-description}`
    - SKIP Phase 6 cleanup (it will run after the next feature)
15. **If no, proceed to Phase 6 cleanup**

### Phase 6: Cleanup (ALWAYS run this phase unless continuing to next feature)
16. **Return to main repo**: `cd` back to the main repository directory
17. **Remove worktree**: `git worktree remove ../enkai-{feature-name} --force`
18. **Prune stale worktrees**: `git worktree prune`
19. **Delete local branch** (if still exists): `git branch -D feat/{feature-name} 2>/dev/null || true`
20. **Delete remote branch** (if --delete-branch failed): `git push origin --delete feat/{feature-name} 2>/dev/null || true`
21. **Verify cleanup**: `git worktree list` and `git branch -a | grep {feature-name}` should show no matches

---

## Feature Spec File Structure

Use features directory path from config (`paths.atlas_features_dir`):

```
{FEATURES_DIR}/
├── {feature-name}.md          # New feature specs go here
├── existing-feature-1.md      # Existing feature
├── existing-feature-2.md      # Existing feature
└── ...
```

Each spec follows this structure:
```markdown
# Feature: {Feature Name}

```yaml
document_metadata:
  type: feature_specification
  feature_id: "FS-2026-001"
  version: "1.0.0"
  status: "implementing"  # draft -> implementing -> complete
  ...

feature_overview:
  name: "..."
  summary: |
    ...
  ...

requirements:
  functional:
    - id: "FR-001"
      acceptance_criteria:
        - given: "..."
          when: "..."
          then: "..."
  ...

technical_design:
  ...
```
```

---

## Worktree Management

| Action | Command |
|--------|---------|
| List worktrees | `git worktree list` |
| Create worktree | Use pattern from config `worktree.base_dir_pattern` |
| Remove worktree | `git worktree remove {WORKTREE_PATH}` |
| Prune stale | `git worktree prune` |

**Path convention**: Read from config `worktree.base_dir_pattern` (supports placeholders like `{purpose}`, `{id}`)
**Branch naming**: `issue-{N}-{short-kebab-case-name}` or `feat/{feature-name}`

---

## Quick Reference

```bash
# Example: Full automated issue workflow
/feature-dev #34

# Example: Standard feature development
/feature-dev Add dark mode toggle to settings page
```

---

## Cleanup Commands

Use these commands if cleanup was interrupted or needs to be done manually:

```bash
# List all worktrees to find stale ones
git worktree list

# Remove a specific worktree (from main repo)
git worktree remove ../enkai-issue-{N} --force

# Prune worktrees that point to missing directories
git worktree prune

# Delete local branch
git branch -D issue-{N}-{short-name}
git branch -D feat/{feature-name}

# Delete remote branch
git push origin --delete issue-{N}-{short-name}
git push origin --delete feat/{feature-name}

# Find and list all feature branches
git branch -a | grep -E "(issue-|feat/)"

# Nuclear option: Remove all enkai worktrees and feature branches
git worktree list | grep enkai | awk '{print $1}' | xargs -I {} git worktree remove {} --force
git worktree prune
git branch | grep -E "^  (issue-|feat/)" | xargs git branch -D
```

**Important**: Always return to the main repo directory before running cleanup commands.

$ARGUMENTS
