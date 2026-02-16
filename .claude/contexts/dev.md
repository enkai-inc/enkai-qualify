# Development Mode

Task-specific behavioral rules for implementation sessions.

## Core Principles

- Write code first, iterate after — working software over perfect plans
- Prefer small, tested changes over large refactors
- Run tests after every meaningful change
- Follow existing patterns in the codebase before inventing new ones

## Workflow

1. Read the relevant source files before modifying
2. Implement the minimal change that satisfies the requirement
3. Run tests and lint checks immediately
4. Fix failures before moving on to the next change
5. Commit logically grouped changes together

## Task Atomicity (2-5 Minutes Per Step)

Break work into atomic steps that each take 2-5 minutes:

| Action | Is Atomic? |
|--------|------------|
| "Write the failing test" | Yes - single step |
| "Run it to make sure it fails" | Yes - single step |
| "Implement the minimal code" | Yes - single step |
| "Run tests to pass" | Yes - single step |
| "Commit" | Yes - single step |
| "Add validation and tests" | NO - split into steps |
| "Implement feature with error handling" | NO - split into steps |

### TDD Micro-Cycle

For each change, follow this cycle:

```
1. Write failing test → 2. Verify failure → 3. Write minimal code → 4. Verify pass → 5. Commit
```

Each numbered step is ONE action. Never combine steps.

## Anti-Patterns

- Do NOT plan extensively before writing any code
- Do NOT load documentation unless blocked
- Do NOT refactor unrelated code in the same change
- Do NOT add features beyond what was requested

## Common Mistakes to Avoid

### Over-engineering beyond the spec

```
The spec says: "Add a button to toggle dark mode"

WRONG:
- Creating a full theming system with 10+ color schemes
- Adding theme persistence across sessions when not requested
- Building a theme customization UI
- Adding animation transitions between themes

RIGHT:
- Add a single toggle button
- Implement light/dark mode only
- Store preference if the spec mentions it
- Keep it simple and focused
```

### Modifying tooling configs instead of fixing code

```
Lint error: 'useEffect has missing dependency'

WRONG:
- Adding // eslint-disable-next-line to the file
- Modifying .eslintrc to disable the rule globally
- Changing eslint config to warn instead of error
- Removing the lint script from package.json

RIGHT:
- Add the missing dependency to the useEffect array
- Refactor the code to not need that dependency
- Use useCallback/useMemo if the dependency causes re-renders
- Understand WHY the linter is complaining and fix the root cause
```

### Skipping quality gates

```
CI is failing on lint/type-check/tests

WRONG:
- Committing with --no-verify to skip pre-commit hooks
- Removing tests that are failing
- Commenting out type checks
- Pushing to see if CI magically passes
- Using 'any' type to silence TypeScript errors

RIGHT:
- Run `npm run lint` locally and fix all errors
- Run `npm run type-check` and resolve type issues
- Run `npm test` and fix failing tests
- Ensure ALL quality gates pass BEFORE committing
- If a test is truly obsolete, discuss with the team first
```

### Making unrelated changes

```
Task: "Fix the login button alignment"

WRONG:
- Refactoring the entire auth module while you're there
- Updating unrelated dependencies
- Renaming variables in files you happen to open
- Adding features you think would be nice
- Fixing other bugs you notice (create issues for them instead)

RIGHT:
- Change ONLY what's needed for the login button alignment
- If you find other issues, create separate issues for them
- Keep the PR focused and reviewable
- One PR = one logical change
```

### Hardcoding values that should be configurable

```
Task: "Add API timeout handling"

WRONG:
- timeout: 5000 // hardcoded everywhere
- if (response.time > 5000) // magic numbers
- Creating test data that only works for specific inputs

RIGHT:
- const API_TIMEOUT_MS = 5000 // single source of truth
- import { API_TIMEOUT_MS } from '@/config'
- Make tests work with any valid input, not just test data
```

### Ignoring existing patterns

```
Codebase uses React Query for data fetching

WRONG:
- Using raw fetch() for a new API call
- Creating a custom caching solution
- Using different state management for this one feature
- Inventing new file naming conventions

RIGHT:
- Use React Query like the rest of the codebase
- Follow existing folder structure and naming
- Match the code style of surrounding files
- If a pattern is wrong, discuss changing it globally
```
