---
name: mon-fix
description: Fix workflow for pipeline failures - implement, PR, merge, verify
---

# Pipeline Fix Workflow

> This file is loaded on-demand by the mon skill when a fix is needed. See `SKILL.md` for diagnosis.

**Configuration**: Same config values as `SKILL.md` from `.claude/project.config.json`.

## Step 5: Implement the Fix

Based on the root cause identified in diagnosis:

### Fix: TypeScript/Build Errors

```bash
cd dashboard && npm install && npm run build
# Fix the errors in the code, then verify
npm run build
```

### Fix: Test Failures

```bash
npm run test
# Fix failing tests, then verify
npm run test
```

### Fix: Docker Build Issues

```bash
docker build -t test-build -f dashboard/Dockerfile dashboard/
# Check Dockerfile syntax, verify COPY paths exist
```

### Fix: CDK/Infrastructure Issues

```bash
cd infra/cdk && npm run build && npx cdk synth
# Fix infrastructure code, then verify synth passes
npx cdk synth
```

### Fix: ECS Health Check Failures

Common fixes: increase health check grace period, fix health check endpoint, fix container startup issues.

## Step 6: Run Quality Gates

```bash
npm run lint
npm run test
npm run build
cd infra/cdk && npm run build && npx cdk synth  # if infra changed
```

## Step 7: Commit Changes

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: resolve pipeline failure - SHORT_DESCRIPTION

Fixes the deployment pipeline failure caused by CAUSE.

Changes:
- Change 1
- Change 2

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

## Step 8: Push and Create PR

**Before creating a PR, check for existing fix PRs:**

```bash
if [ -n "$EXECUTION_ID" ]; then
  EXISTING_PRS=$(aws dynamodb query \
    --table-name {FIX_ATTEMPTS_TABLE} \
    --key-condition-expression "pipelineExecutionId = :execId" \
    --filter-expression "attribute_exists(prNumber)" \
    --expression-attribute-values '{":execId": {"S": "'"$EXECUTION_ID"'"}}' \
    --output json 2>/dev/null | jq -r '.Items[].prNumber.N // empty')

  if [ -n "$EXISTING_PRS" ]; then
    echo "WARNING: Existing fix PR(s) found:"
    for PR_NUM in $EXISTING_PRS; do
      echo "  - PR #$PR_NUM: $(gh pr view $PR_NUM --json url -q '.url') ($(gh pr view $PR_NUM --json state -q '.state'))"
    done
    echo "Options: 1. Use existing PR  2. Close existing and create new  3. Create anyway  4. Cancel"
  fi
fi
```

**If closing existing PR:**
```bash
for PR_NUM in $EXISTING_PRS; do
  PR_STATE=$(gh pr view $PR_NUM --json state -q '.state')
  if [ "$PR_STATE" = "OPEN" ]; then
    gh pr close $PR_NUM --comment "Superseded by manual fix via /mon skill"
  fi
done
```

**Create the PR:**
```bash
git push -u origin "fix/pipeline-${WORKTREE_NAME}"
gh pr create \
  --title "fix: resolve pipeline failure - SHORT_DESCRIPTION" \
  --body "$(cat <<'EOF'
## Summary
Fixes the deployment pipeline failure.

## Root Cause
[Description of what caused the failure]

## Changes
- [List of changes made]

## Verification
- [x] Build passes locally
- [x] Tests pass
- [x] CDK synth succeeds (if applicable)

## Test Plan
- [ ] Merge this PR
- [ ] Verify pipeline completes successfully
- [ ] Verify ECS services are healthy
EOF
)"
```

## Step 9: Merge and Monitor

```bash
gh pr merge --squash --delete-branch
sleep 30
aws codepipeline get-pipeline-state --name {PIPELINE_NAME} \
  --query "stageStates[*].{stage:stageName,status:latestExecution.status}" --output table
```

## Step 10: Verify Deployment Success

```bash
aws ecs describe-services --cluster {ECS_CLUSTER} \
  --services {DASHBOARD_SERVICE} {ISSUE_MANAGER_SERVICE} \
  --query "services[*].{name:serviceName,running:runningCount,desired:desiredCount}"
curl -I {DASHBOARD_URL}
aws logs tail {DASHBOARD_LOG_GROUP} --since 5m --format short | grep -i error || echo "No errors found"
```

## Step 11: Prompt for Next Action

Use AskUserQuestion: "Pipeline fix deployed! Continue monitoring or quit?"

## Step 12: Cleanup

```bash
cd $CLAUDE_PROJECT_DIR
git worktree remove "$WORKTREE_PATH" --force
git worktree prune
git fetch --prune origin
git branch -vv | grep ': gone]' | awk '{print $1}' | xargs -r git branch -D
```
