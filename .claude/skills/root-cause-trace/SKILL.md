---
name: root-cause-trace
description: "5-step backward trace debugging: never fix just the symptom, trace back to find the original trigger."
---

# Root Cause Trace Skill

Systematic 5-step backward trace debugging methodology. Never fix just where the error appears -- trace back to find the original trigger.

## When to Use

- Before fixing any bug (invoke before `/bug` applies a patch)
- When a test fails and the cause is not obvious
- When a fix in one place causes regressions elsewhere
- When the same bug keeps recurring after "fixes"
- Standalone: `/root-cause-trace [symptom description]`

## Core Rule

**Never fix just the symptom.** If you patch where the error appears without understanding why it appears, you are adding a band-aid that will peel off. Always trace back to the original trigger.

## The 5-Step Backward Trace

```
Step 1: Observe the Symptom
         |
Step 2: Find Immediate Cause
         |
Step 3: Ask "What Called This?"
         |
Step 4: Keep Tracing Up
         |
Step 5: Find Original Trigger
         |
     Fix at Source + Validate Each Layer
```

### Step 1: Observe the Symptom

Record exactly what went wrong without guessing the cause:

- **What** failed? (error message, wrong output, crash)
- **Where** did it fail? (file, line, function, component)
- **When** does it fail? (always, intermittently, after a specific change)
- **What changed** recently? (commits, config, dependencies)

```
Symptom: TypeError: Cannot read property 'name' of undefined
Where: UserProfile.tsx:42
When: After clicking "Edit Profile" for users without a bio
```

Do NOT jump to "the fix is to add a null check at line 42." That is the symptom location, not the cause.

### Step 2: Find Immediate Cause

Determine the direct technical reason for the failure:

- Read the full stack trace, not just the top line
- Check the variable/state that is unexpected
- Identify which assumption was violated

```
Immediate cause: `user.profile` is undefined when rendered
Expected: user.profile should always be an object
```

### Step 3: Ask "What Called This?"

Trace one level back. What code or data flow produced the bad state?

- Who sets `user.profile`?
- What API response or data transformation is upstream?
- Is the caller passing incorrect arguments?

```bash
# Find all callers/setters
grep -rn "user\.profile" --include="*.ts" --include="*.tsx"
grep -rn "setProfile\|setUser" --include="*.ts" --include="*.tsx"
```

```
One level up: fetchUser() API call returns { id, name } without profile
field when user has no bio. The API omits empty objects.
```

### Step 4: Keep Tracing Up

Repeat Step 3 until you find where the chain started. Ask at each level:

- Is this the **first** place the bad data/state was introduced?
- Or is this just **passing through** a problem from further upstream?

Common trace depths:

| Depth | Example |
|-------|---------|
| 1 level | Null check missing (symptom-level fix) |
| 2 levels | API response missing field (data contract issue) |
| 3 levels | Database migration left nullable column (schema issue) |
| 4+ levels | Feature spec never defined the empty state (requirements gap) |

```
Two levels up: The API serializer skips empty objects to save bandwidth.
Three levels up: The database allows NULL for profile_data column.
Original trigger: The user registration flow never creates a default
profile record. Users who registered before the profile feature
launched have no profile row at all.
```

### Step 5: Find Original Trigger

You have found the root cause when:

- Fixing it would prevent the symptom from ever occurring
- There is no further "why" to ask
- The fix does not require compensating logic downstream

```
Root cause: User registration does not create a default profile record.
Fix: Add profile creation to registration flow + backfill migration
for existing users.
```

## Stack Trace Instrumentation

When the trace is not obvious, add temporary instrumentation:

```typescript
// Add breadcrumbs at each layer
console.log('[TRACE] fetchUser called with:', userId);
console.log('[TRACE] API response:', JSON.stringify(response.data));
console.log('[TRACE] Mapped user object:', JSON.stringify(user));
```

```python
# Python: use logging with trace level
import logging
logger = logging.getLogger(__name__)
logger.debug("TRACE: get_user called with user_id=%s", user_id)
logger.debug("TRACE: db result: %r", row)
```

Remove all trace instrumentation before committing.

## Bisection Techniques

When you cannot trace the cause through code reading alone:

### Git Bisect

Find which commit introduced the bug:

```bash
git bisect start
git bisect bad           # Current commit has the bug
git bisect good <sha>    # Known good commit
# Git checks out middle commit; test and mark good/bad
git bisect good  # or  git bisect bad
# Repeat until the offending commit is found
git bisect reset
```

### Test Isolation Bisect

When tests pass individually but fail together (test pollution):

```bash
# Run just the failing test
pytest tests/test_user.py::test_profile -v

# Run with the suspected polluter
pytest tests/test_auth.py tests/test_user.py::test_profile -v

# Binary search: split the test suite in half, run each half
# with the failing test to find which group contains the polluter
```

### State Bisect

When the bug is intermittent, bisect the input/state space:

1. Identify all variable inputs (user data, config, timing)
2. Fix half the variables, vary the other half
3. Narrow to the specific input that triggers the failure

## Defense-in-Depth: Fix at Source + Validate Each Layer

After finding the root cause, apply fixes at multiple levels:

```
Layer 1 (Source):     Fix the root cause
Layer 2 (Boundary):   Add validation at API/data boundaries
Layer 3 (Consumer):    Add defensive checks at usage points
```

Example:

```
Layer 1: Add default profile creation to user registration
Layer 2: API serializer always returns profile object (empty default)
Layer 3: UserProfile component handles undefined profile gracefully
```

**Priority**: Layer 1 is mandatory. Layers 2-3 are defense-in-depth.
Never apply only Layer 3 (symptom fix) without Layer 1 (root cause fix).

## Integration with /bug

When `/bug` is invoked:

1. Record the symptom (Step 1)
2. Run the 5-step backward trace before writing any fix code
3. Document the root cause in the commit message
4. Apply defense-in-depth fixes
5. Verify the fix addresses the root cause, not just the symptom

### Commit Message Pattern

```
fix: [what was fixed at the root cause level]

Root cause: [description of the original trigger]
Trace: [symptom] <- [immediate cause] <- [root cause]

Defense-in-depth:
- [Layer 1 fix]
- [Layer 2 validation added]
- [Layer 3 defensive check added]
```

## Anti-Patterns

| Anti-Pattern | Why It Fails | Instead |
|---|---|---|
| Add null check at crash site | Masks the real bug, data is still wrong | Trace back to find why data is null |
| Catch and swallow exception | Hides the failure, corrupts state silently | Let it fail, fix the cause |
| Add retry logic for consistent failure | Retries never help deterministic bugs | Find why it fails every time |
| Revert to "working" version | Loses the feature, bug may resurface | Understand what the new code broke |
| Fix the test instead of the code | Tests exist to catch bugs, not the other way around | If the test caught a real bug, fix the code |

## Quick Reference

```
1. OBSERVE   - What exactly failed? Record without guessing.
2. IMMEDIATE - What is the direct technical cause?
3. TRACE     - What called/created the bad state?
4. CONTINUE  - Keep asking "why" until you hit the origin.
5. TRIGGER   - Fix at the source. Validate each layer.
```
