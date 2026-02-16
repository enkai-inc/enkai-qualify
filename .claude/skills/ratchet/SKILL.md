---
name: ratchet
description: "Quality ratchet — progressive quality thresholds that never decrease. Captures baselines, checks for regressions, updates after merges."
argument-hint: "[capture|check|update|show]"
---

# Quality Ratchet

Progressive quality thresholds that can never decrease. After each successful CI run, the current metrics become the new floor.

**Script**: `.claude/scripts/quality-ratchet.py`
**Baseline**: `.quality-baseline.json` (committed to repo)

## Commands

| Command | What it does |
|---------|-------------|
| `/ratchet capture` | Run `/verify`, save results as the initial baseline |
| `/ratchet check` | Run `/verify`, compare against baseline, fail if regressed |
| `/ratchet update` | Run `/verify`, update baseline if metrics improved or held |
| `/ratchet show` | Display current baseline metrics |

## Workflow

### First time setup

```
/ratchet capture
```

This runs `/verify` to get current quality metrics, then saves them as the baseline in `.quality-baseline.json`. Commit this file to the repo.

### On every PR / before merge

```
/ratchet check
```

Runs `/verify` and compares against baseline:
- **PASS** — No metric got worse. Safe to merge.
- **FAIL** — One or more metrics regressed. Fix before merging.

### After merge to main

```
/ratchet update
```

Runs `/verify` on main and updates the baseline if metrics held or improved. This ratchets the floor upward — the next PR must meet or beat these numbers.

## What Gets Tracked

| Metric | Direction | Meaning |
|--------|-----------|---------|
| Lint Errors | Must not increase | ESLint errors |
| Lint Warnings | Must not increase | ESLint warnings |
| Type Errors | Must not increase | TypeScript errors |
| Test Failed | Must not increase | Failing tests |
| Test Passed | Must not decrease | Passing tests (coverage proxy) |

## Integration

### With `/verify`

The ratchet reads `/verify` JSON output. Run verify first, pipe or save the output:

```bash
# Save verify output, then check ratchet
python3 .claude/scripts/quality-ratchet.py check /tmp/verify-results.json
```

### With `/scrum` post-merge verification

After scrum merges all PRs, run `/ratchet update` to capture the new baseline.

### With CI Runner Agent

The CI runner agent can call the ratchet script after running quality gates:

```bash
python3 .claude/scripts/quality-ratchet.py check /tmp/verify-results.json
# Exit code 0 = pass, 1 = regression detected
```

## Example Baseline File

```json
{
  "version": 1,
  "updated_at": "2026-02-08T02:30:00+00:00",
  "metrics": {
    "lint_errors": 0,
    "lint_warnings": 12,
    "type_errors": 0,
    "test_failed": 0,
    "test_passed": 42,
    "test_skipped": 3
  },
  "verify_status": "pass"
}
```

## How to Execute

When the user runs `/ratchet [command]`:

1. Parse the command from $ARGUMENTS (capture, check, update, show)
2. For `show`: run `python3 .claude/scripts/quality-ratchet.py show`
3. For `capture`, `check`, `update`:
   a. First run `/verify` and save the JSON output to `/tmp/verify-results.json`
   b. Then run `python3 .claude/scripts/quality-ratchet.py [command] /tmp/verify-results.json`
4. Report the result to the user
5. If `capture` or `update` succeeded, remind the user to commit `.quality-baseline.json`
