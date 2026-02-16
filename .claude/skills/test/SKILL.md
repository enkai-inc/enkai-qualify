---
name: test
description: Run tests with coverage analysis, identify untested code, generate test stubs
---

# Test Runner Skill

Run tests with coverage reporting, identify gaps, and generate missing test stubs.

**Configuration**: Read `.claude/project.config.json` for:
- Dashboard path: `paths.dashboard_dir`
- Builder path: `paths.builder_dir`
- Test directories: `paths.test_uat_dir`

## Invocation

```
/test                    # Run all tests
/test coverage           # Run with coverage report
/test stubs              # Generate test stubs for uncovered files
/test health             # Analyze test suite health (flaky, slow, skipped)
/test <file-pattern>     # Run tests matching pattern
```

## Workflow: Run Tests

### Step 1: Determine Scope

Based on arguments or changed files:
- No args: run full test suite
- File pattern: run matching tests
- `coverage`: run with `--coverage`
- `stubs`: identify untested files, generate stubs
- `health`: analyze test reliability

### Step 2: Run Tests

**Dashboard (Jest/Vitest)**:
```bash
cd {paths.dashboard_dir} && npm test -- --coverage --reporter=verbose 2>&1 | head -200
```

**Python components**:
```bash
cd {paths.builder_dir} && python -m pytest tests/ -v --cov --cov-report=term-missing 2>&1 | head -200
```

### Step 3: Parse Coverage

Extract from coverage output:
- Overall coverage percentage
- Files below threshold (< 50% coverage)
- Uncovered lines per file
- Branches not covered

### Step 4: Report Results

```json
{
  "status": "pass|fail",
  "summary": "42 tests passed, 2 failed, 3 skipped",
  "coverage": {
    "overall": 72.5,
    "threshold": 50,
    "belowThreshold": [
      {"file": "src/hooks/useAuth.ts", "coverage": 23, "uncoveredLines": [15, 22, 45]}
    ]
  },
  "failures": [
    {"file": "src/tests/auth.test.ts", "test": "should redirect on expired token", "error": "Expected redirect"}
  ],
  "health": {
    "totalTests": 42,
    "skipped": 3,
    "slowTests": [{"test": "integration test", "duration": "4.2s"}]
  }
}
```

## Workflow: Generate Test Stubs

### Step 1: Identify Untested Files

```bash
# Find source files without corresponding test files
cd {paths.dashboard_dir} && find src -name "*.ts" -o -name "*.tsx" | \
  grep -v ".test." | grep -v ".spec." | grep -v "node_modules" | sort
```

Cross-reference with test files:
```bash
find src -name "*.test.*" -o -name "*.spec.*" | sort
```

### Step 2: Generate Stubs

For each untested file, create a test file with:
- Import of the module under test
- `describe` block matching the module name
- `it.todo()` for each exported function/component
- Basic render test for React components
- Basic invocation test for utility functions

### Step 3: Report

List generated test files and their todo counts.

## Workflow: Test Health Analysis

Analyze the test suite for:
- **Flaky tests**: Tests that have failed intermittently (check CI history if available)
- **Slow tests**: Tests taking > 2 seconds
- **Skipped tests**: Tests marked as `.skip` or `xit`
- **Missing assertions**: Tests without `expect()` calls
- **Test isolation**: Tests that depend on execution order

## Instructions for AI

1. Always run tests before reporting results
2. Parse output carefully for coverage numbers
3. When generating stubs, follow existing test patterns in the codebase
4. Prioritize coverage gaps in critical paths (auth, payments, API handlers)
5. Don't generate tests for generated code, types-only files, or config files
