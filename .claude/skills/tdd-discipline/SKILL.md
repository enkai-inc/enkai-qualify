---
name: tdd-discipline
description: "TDD workflow enforcement: red-green-refactor cycle, pre-commit checklist, behavioral testing. Use before /build or standalone."
---

# TDD Discipline Skill

Enforce test-driven development workflow with red-green-refactor cycle and pre-commit quality gates.

## When to Use

- Before starting implementation in `/build` or `/eval`
- When the task involves new logic (not config/docs/typos)
- Standalone: `/tdd [task description]`

## Skip TDD When

- Documentation-only changes
- Typo or config file fixes
- Single-line adjustments
- Markdown/README updates

## Red-Green-Refactor Cycle

```
1. RED    — Write a failing test for the next behavior
2. GREEN  — Write the minimum code to pass
3. REFACTOR — Clean up while tests stay green
4. REPEAT — Next behavior
```

### Rules

- **One test at a time** — Never write multiple test cases before implementing
- **Minimal code** — Only enough to pass the current test
- **Commit atomically** — Test + implementation + docs together per behavior
- **All tests must pass** — Never commit with failing tests

### Commit Strategy

Each commit should be one behavior:

```
✅ "Add input validation for empty strings with test"
✅ "Handle database connection timeout with test"
❌ "Add all validation tests and implementation" (too broad)
❌ "WIP: tests failing" (never commit failures)
```

## Pre-Commit Checklist

Run in this order — each step must pass before the next:

| Step | Command | Purpose |
|------|---------|---------|
| 1. Format | `npx prettier --write .` | Consistent style |
| 2. Lint | `npm run lint` | Static analysis |
| 3. Type-check | `npx tsc --noEmit` | Type safety |
| 4. Test | `npm run test` | Correctness |
| 5. Coverage | Check coverage report | No untested code |
| 6. Diff review | `git diff --staged` | Final sanity check |
| 7. Security | Scan for keys/tokens | No secret leaks |

**If any step fails**: Fix immediately, re-run from step 1.

## Behavioral Testing

Write tests that describe behavior, not implementation:

```
✅ Good: "exits with error when database is unreachable"
✅ Good: "returns 404 when user ID does not exist"
❌ Bad:  "calls connectDB function"
❌ Bad:  "validateUser is defined in utils.ts"
```

**Why**: Behavioral tests survive refactoring. Implementation tests break when you rename functions.

### Test Name Pattern

```
[action] when [condition]
```

Examples:
- "returns empty array when no items match filter"
- "throws validation error when email is malformed"
- "retries 3 times when API returns 503"

## Post-Implementation Refactoring

After all tests pass:

1. Look for duplication in code you just wrote
2. Extract helpers only if used 3+ times
3. Simplify conditionals
4. Rename for clarity
5. Run tests again — must still pass

**Two phases**: "Make it work" (TDD) → "Make it right" (refactor)

## Integration with /build

When `/build` implementer-agent receives work:
1. Check if task qualifies for TDD (new logic = yes)
2. Follow red-green-refactor for each acceptance criterion
3. Run pre-commit checklist before creating PR
4. Include test count in PR description

## Integration with /scrum

Workers should:
1. Default to TDD for implementation tasks
2. Skip for config/docs issues
3. Report test count in WORKER_COMPLETE message
