---
name: verify
description: Run quality gates (lint, type-check, test) and return structured JSON results with error counts and prioritized issues with file:line references
---

# Verification Subagent Skill

A dedicated verification skill that runs quality gates in isolation and returns structured feedback for automated processing.

**Configuration**: Read `.claude/project.config.json` for:
- Dashboard path: `paths.dashboard_dir`
- Builder path: `paths.builder_dir`
- Infrastructure path: `paths.infra_dir`

## When to Use This Skill

- Before committing code changes
- After making multiple file edits
- When you need structured quality feedback
- When debugging CI failures
- When another agent needs to verify work before proceeding

## Invocation

```
/verify              # Dashboard only, JSON output
/verify dashboard    # Dashboard only, JSON output
/verify all          # All components, JSON output
/verify --human      # Dashboard only, human-readable output
/verify all --human  # All components, human-readable output
```

### Output Formats

- **JSON (default)**: Structured output for agent-to-agent integration, CI pipelines, and automated fixing
- **Human (`--human`)**: Readable summary with pass/fail indicators, error counts, and top issues listed in plain text. Use this when reporting directly to the user rather than feeding into another agent.

## Workflow

### Step 1: Determine Scope

Based on invocation:
- `/verify` or `/verify dashboard` - Dashboard only (most common)
- `/verify all` - All components (dashboard, builder, issue-manager, infra)

### Step 2: Run Quality Gates

For **Dashboard** (always run unless scope explicitly excludes, use path from config):

```bash
cd {paths.dashboard_dir} && npm run lint 2>&1 | head -200
```

Then:
```bash
cd {paths.dashboard_dir} && npm run type-check 2>&1 | head -200
```

Then check for tests:
```bash
cd {paths.dashboard_dir} && npm test 2>&1 | head -100
```

For **Python components** (only if scope is `all` or files changed in those areas, use path from config):

```bash
cd {paths.builder_dir} && python -m pytest tests/ -v 2>&1 | head -100
```

For **Infrastructure** (only if scope is `all` or CDK files changed, use path from config):

```bash
cd {paths.infra_dir} && npm run build 2>&1 | head -100
```

### Step 3: Parse Output and Generate Structured Results

Parse the raw output from each command and extract:

1. **Exit code** - 0 = pass, non-zero = fail
2. **Error count** - Total errors found
3. **Warning count** - Total warnings found
4. **Issue list** - Individual issues with file:line references

### Step 4: Return Structured JSON

Output the results in this exact JSON format:

```json
{
  "status": "pass" | "fail",
  "summary": "Brief description of results",
  "lint": {
    "status": "pass" | "fail",
    "errors": 0,
    "warnings": 0,
    "issues": [
      {
        "severity": "error" | "warning",
        "file": "src/components/Example.tsx",
        "line": 42,
        "column": 10,
        "rule": "no-unused-vars",
        "message": "'foo' is defined but never used"
      }
    ]
  },
  "typeCheck": {
    "status": "pass" | "fail",
    "errors": 0,
    "issues": [
      {
        "severity": "error",
        "file": "src/components/Example.tsx",
        "line": 15,
        "column": 5,
        "code": "TS2322",
        "message": "Type 'string' is not assignable to type 'number'"
      }
    ]
  },
  "tests": {
    "status": "pass" | "fail" | "skipped",
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "issues": [
      {
        "severity": "error",
        "file": "src/tests/Example.test.ts",
        "testName": "should render correctly",
        "message": "Expected 5 but received 3"
      }
    ]
  },
  "topIssues": [
    {
      "severity": "error",
      "category": "typeCheck",
      "file": "src/components/Example.tsx",
      "line": 15,
      "message": "Type 'string' is not assignable to type 'number'"
    }
  ]
}
```

## Parsing Rules

### ESLint Output Parsing

ESLint outputs in the format:
```
/path/to/file.tsx
  42:10  error  'foo' is defined but never used  no-unused-vars
  45:5   warning  Missing return type  @typescript-eslint/explicit-module-boundary-types
```

Extract:
- `file`: Path after the repo root
- `line`: First number before colon
- `column`: Second number before colon
- `severity`: "error" or "warning"
- `message`: Text after severity
- `rule`: Last word (rule name)

Count summary line format: `X problems (Y errors, Z warnings)`

### TypeScript Output Parsing

TypeScript outputs in the format:
```
src/components/Example.tsx(15,5): error TS2322: Type 'string' is not assignable to type 'number'.
```

Extract:
- `file`: Path before parenthesis
- `line`: First number in parentheses
- `column`: Second number in parentheses
- `code`: TSXXXX code
- `message`: Text after code and colon

### Test Output Parsing

Jest/Vitest outputs failures like:
```
FAIL src/tests/Example.test.ts
  Example Component
    x should render correctly
      Expected: 5
      Received: 3
```

Extract:
- `file`: Path after FAIL
- `testName`: Indented test description
- `message`: Expected/Received or error message

## Top Issues Prioritization

The `topIssues` array should contain the top 5 most critical issues, prioritized by:

1. **TypeScript errors** - These block compilation
2. **ESLint errors** - These block CI
3. **Test failures** - These indicate broken functionality
4. **ESLint warnings** - Lower priority but should be fixed

## Example Output

### All Passing

```json
{
  "status": "pass",
  "summary": "All quality gates passed",
  "lint": {
    "status": "pass",
    "errors": 0,
    "warnings": 0,
    "issues": []
  },
  "typeCheck": {
    "status": "pass",
    "errors": 0,
    "issues": []
  },
  "tests": {
    "status": "pass",
    "passed": 42,
    "failed": 0,
    "skipped": 2,
    "issues": []
  },
  "topIssues": []
}
```

### With Failures

```json
{
  "status": "fail",
  "summary": "2 type errors, 1 lint error found",
  "lint": {
    "status": "fail",
    "errors": 1,
    "warnings": 3,
    "issues": [
      {
        "severity": "error",
        "file": "src/components/AddRepoModal.tsx",
        "line": 156,
        "column": 7,
        "rule": "no-unused-vars",
        "message": "'handleSubmit' is defined but never used"
      }
    ]
  },
  "typeCheck": {
    "status": "fail",
    "errors": 2,
    "issues": [
      {
        "severity": "error",
        "file": "src/hooks/useGitHubApp.ts",
        "line": 45,
        "column": 12,
        "code": "TS2345",
        "message": "Argument of type 'undefined' is not assignable to parameter of type 'string'"
      },
      {
        "severity": "error",
        "file": "src/hooks/useGitHubApp.ts",
        "line": 52,
        "column": 5,
        "code": "TS2322",
        "message": "Type 'null' is not assignable to type 'GitHubAppStatus'"
      }
    ]
  },
  "tests": {
    "status": "pass",
    "passed": 40,
    "failed": 0,
    "skipped": 2,
    "issues": []
  },
  "topIssues": [
    {
      "severity": "error",
      "category": "typeCheck",
      "file": "src/hooks/useGitHubApp.ts",
      "line": 45,
      "message": "Argument of type 'undefined' is not assignable to parameter of type 'string'"
    },
    {
      "severity": "error",
      "category": "typeCheck",
      "file": "src/hooks/useGitHubApp.ts",
      "line": 52,
      "message": "Type 'null' is not assignable to type 'GitHubAppStatus'"
    },
    {
      "severity": "error",
      "category": "lint",
      "file": "src/components/AddRepoModal.tsx",
      "line": 156,
      "message": "'handleSubmit' is defined but never used"
    }
  ]
}
```

## Instructions for AI

When executing this skill:

1. **Run commands sequentially** - Lint first, then type-check, then tests
2. **Capture all output** - Don't stop on first failure
3. **Parse carefully** - Use the parsing rules to extract structured data
4. **Limit output** - Use `head` to prevent overwhelming output
5. **Prioritize top issues** - TypeScript errors > ESLint errors > Test failures
6. **Return JSON only** - The final output should be valid JSON (wrapped in code block)
7. **Include file paths** - Always include relative paths from repo root
8. **Include line numbers** - Essential for automated fixing

## Integration with Other Agents

This skill is designed to be called by other agents via Task tool:

```
Task verify:
"Run quality gates and return structured results"
```

The calling agent can then:
- Parse the JSON output
- Automatically fix issues based on file:line references
- Report specific errors to the user
- Decide whether to proceed based on status

## Error Handling

If a command fails unexpectedly (not a quality gate failure):

```json
{
  "status": "error",
  "summary": "Failed to run quality gates",
  "error": "npm command not found or dashboard directory missing"
}
```
