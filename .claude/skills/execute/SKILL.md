---
name: execute
description: Execute a pre-approved plan step-by-step with progress tracking and deviation detection
---

**Configuration**: Read `.claude/project.config.json` for GitHub label configuration under `github.labels.plan_approved`.

# Execute Skill (Plan/Execute Mode Separation)

Executes a structured plan that was previously created and approved via `/plan`. Provides step-by-step progress tracking and detects deviations.

## When to Use This Skill

- After a plan has been approved via `/plan`
- When resuming a partially completed plan
- When re-executing after fixing issues
- When you have a structured plan JSON in an issue comment

## Task Granularity: 2-5 Minutes Per Step

**Each step should be one atomic action (2-5 minutes):**

| Step Type | Example | Duration |
|-----------|---------|----------|
| Write failing test | Create test function with assertion | 2-3 min |
| Run test to fail | Execute test, verify expected failure | 1 min |
| Write minimal code | Implement just enough to pass | 2-5 min |
| Run test to pass | Execute test, verify success | 1 min |
| Commit | Stage and commit with message | 1 min |

### TDD Step Breakdown Pattern

For each feature task, decompose into these atomic steps:

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.ts`
- Modify: `exact/path/to/existing.ts:123-145`
- Test: `tests/exact/path/to/test.ts`

**Step 1: Write the failing test**

```typescript
test('specific behavior', () => {
  const result = functionName(input);
  expect(result).toEqual(expected);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/path/test.ts`
Expected: FAIL with "functionName is not defined"

**Step 3: Write minimal implementation**

```typescript
export function functionName(input: InputType): OutputType {
  return expected;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/path/test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/path/test.ts src/path/file.ts
git commit -m "feat: add specific feature"
```
```

### Why This Granularity Matters

- **Predictability**: AI execution is more reliable with small, atomic steps
- **Verifiability**: Each step has clear success criteria
- **Recoverability**: Failures are isolated, easy to retry from specific point
- **TDD adherence**: Enforces test-first development naturally

## Invocation

```
/execute #<issue_number>
/execute --plan-id <plan_id>
/execute --resume #<issue_number>
```

## Prerequisites

The plan MUST:
1. Be in structured JSON format (see Plan Schema below)
2. Be approved (approval_status: "approved")
3. Be posted in a GitHub issue comment

## Plan Schema

```json
{
  "plan_id": "plan-2024-001",
  "summary": "Brief description of what will be done",
  "complexity": "low|medium|high",
  "approval_status": "pending|approved|rejected",
  "approved_by": "username or system",
  "approved_at": "ISO8601",
  "steps": [
    {
      "order": 1,
      "action": "What will be done",
      "files": ["affected files"],
      "verification": "How to verify this step",
      "status": "pending|in_progress|completed|failed|skipped",
      "completed_at": null
    }
  ],
  "risks": ["Potential issues"],
  "dependencies": ["External requirements"],
  "expected_outcome": "What success looks like",
  "rollback": "How to undo if needed"
}
```

## Workflow

### Step 1: Load Plan

```bash
# Fetch plan from issue comment
gh issue view <issue_number> --json comments --jq '.comments[-1].body'
```

Parse the JSON plan from the issue.

### Step 2: Validate Approval

Check that `approval_status` is "approved". If not:

```
ERROR: Plan not approved.
Status: <pending|rejected>
Approved by: <none>

To approve this plan:
- Add a comment: "APPROVE PLAN" or
- Add label: {PLAN_APPROVED_LABEL} (from config)

Cannot proceed without approval.
```

### Step 3: Execute Steps Sequentially

For each step in order:

1. **Announce step start**
   ```
   ## Executing Step <N>/<total>
   Action: <step.action>
   Files: <step.files>
   ```

2. **Execute the action**
   - Implement the code changes
   - Run verification command
   
3. **Verify completion**
   - Run the verification command from the step
   - Check for expected outcomes

4. **Update progress**
   - Post progress update to issue
   - Update step status in plan

### Step 4: Deviation Detection

After each step, check for deviations:

1. **Scope deviation**: Did we touch files not in the plan?
2. **Approach deviation**: Did we use a different method?
3. **Dependency deviation**: Did we introduce new dependencies?

If deviation detected:
```
## Deviation Detected

**Type**: scope|approach|dependency
**Expected**: <what the plan said>
**Actual**: <what happened>
**Severity**: minor|moderate|major

### Options:
1. Continue with deviation (minor deviations only)
2. Update plan and seek re-approval
3. Abort and rollback

Awaiting decision...
```

For minor deviations, continue with a note.
For moderate/major deviations, pause and seek approval.

### Step 5: Progress Tracking

Post progress updates to the issue:

```markdown
## Execution Progress

**Plan ID**: plan-2024-001
**Status**: in_progress
**Started**: 2024-01-15T10:30:00Z

### Steps

| # | Action | Status | Duration |
|---|--------|--------|----------|
| 1 | Create API endpoint | completed | 2m 15s |
| 2 | Add validation logic | in_progress | - |
| 3 | Write unit tests | pending | - |
| 4 | Update documentation | pending | - |

### Current Step
**Step 2/4**: Add validation logic
- Started: 2024-01-15T10:32:15Z
- Files: src/validators/input.ts
```

### Step 6: Completion or Failure

#### On Success
```markdown
## Execution Complete

**Plan ID**: plan-2024-001
**Status**: success
**Duration**: 12m 45s

### Summary
All 4 steps completed successfully.

### Changes Made
- Created: src/api/newEndpoint.ts
- Modified: src/validators/input.ts
- Created: tests/newEndpoint.test.ts
- Modified: docs/API.md

### Verification Results
- Lint: PASS
- Type check: PASS
- Tests: 15/15 passed

### Next Steps
- Ready for PR creation
- Run `/pr` to create pull request
```

#### On Failure
```markdown
## Execution Failed

**Plan ID**: plan-2024-001
**Status**: failed
**Failed at step**: 3 of 4
**Duration**: 8m 30s

### Error Details
**Step**: Write unit tests
**Action**: Create test file for new endpoint
**Error**: TypeError: Cannot read property 'data' of undefined

### Completed Steps
- Step 1: Create API endpoint - COMPLETED
- Step 2: Add validation logic - COMPLETED

### Rollback Options
1. Automatic rollback of completed steps
2. Manual fix and resume from step 3
3. Abort and keep partial changes

To resume: `/execute --resume #<issue>`
To rollback: `/rollback #<issue>`
```

## Approval Mechanisms

Plans can be approved via:

1. **Issue comment**: "APPROVE PLAN" (case insensitive)
2. **Label**: `{PLAN_APPROVED_LABEL}` (read from `.claude/project.config.json`)
3. **Slack reaction**: Approval emoji on plan notification
4. **Timeout**: Auto-approve after configurable timeout (for low-risk plans)

### Approval Timeout Rules

| Complexity | Risk | Auto-approve Timeout |
|------------|------|---------------------|
| low | low | 5 minutes |
| low | medium | 30 minutes |
| medium | low | 30 minutes |
| medium | medium | No auto-approve |
| high | any | No auto-approve |

## Commands During Execution

| Command | Action |
|---------|--------|
| `PAUSE` | Pause execution, can resume |
| `ABORT` | Stop execution, no rollback |
| `ROLLBACK` | Stop and undo completed steps |
| `SKIP <step>` | Skip the specified step |
| `RETRY` | Retry the current failed step |

## Error Handling

### Recoverable Errors
- Lint failures: Auto-fix and retry
- Type errors: Attempt fix and retry
- Test failures: Report and pause for decision

### Non-Recoverable Errors
- Security issues: Abort immediately
- Missing dependencies: Pause and report
- Permission errors: Abort and escalate

## Integration with Plan Skill

The `/plan` and `/execute` skills work together:

1. `/plan <description>` creates a structured plan
2. Plan is posted to issue for review
3. Human or system approves the plan
4. `/execute #<issue>` runs the approved plan
5. Progress tracked in issue comments
6. Deviations detected and handled

## Example Session

### Plan Created (by /plan)
```json
{
  "plan_id": "plan-2024-042",
  "summary": "Add user email verification feature",
  "complexity": "medium",
  "approval_status": "pending",
  "steps": [
    {
      "order": 1,
      "action": "Create email verification token model",
      "files": ["src/models/VerificationToken.ts"],
      "verification": "Type check passes"
    },
    {
      "order": 2,
      "action": "Add send verification email function",
      "files": ["src/services/email.ts"],
      "verification": "Function exists and types correct"
    },
    {
      "order": 3,
      "action": "Create verification API endpoint",
      "files": ["src/api/verify.ts"],
      "verification": "Endpoint responds to test request"
    },
    {
      "order": 4,
      "action": "Add tests",
      "files": ["tests/verify.test.ts"],
      "verification": "All tests pass"
    }
  ],
  "risks": ["Email service rate limits"],
  "rollback": "Delete new files, revert modifications"
}
```

### User Approves
```
APPROVE PLAN
```

### Execution
```
/execute #123

Loading plan from issue #123...
Plan ID: plan-2024-042
Approval: approved by @user at 2024-01-15T10:00:00Z

Starting execution...

## Step 1/4: Create email verification token model
Creating src/models/VerificationToken.ts...
Running verification: type-check...
PASS

## Step 2/4: Add send verification email function
Modifying src/services/email.ts...
Running verification: type-check...
PASS

## Step 3/4: Create verification API endpoint
Creating src/api/verify.ts...
Running verification: endpoint test...
PASS

## Step 4/4: Add tests
Creating tests/verify.test.ts...
Running verification: test run...
PASS

## Execution Complete
All 4 steps completed successfully.
Ready for PR creation.
```

## Guidelines

1. **Never skip approval** - Always verify plan is approved
2. **Atomic steps** - Each step should be 2-5 minutes and independently verifiable
3. **Progress visibility** - Keep issue updated with current status
4. **Deviation sensitivity** - Be conservative about deviations
5. **Rollback ready** - Always know how to undo changes
6. **Document everything** - All actions and decisions logged
7. **TDD enforcement** - Follow test→fail→implement→pass→commit cycle
8. **Exact commands** - Include specific commands with expected output
