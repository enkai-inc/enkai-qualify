---
name: mon
description: "Monitor AWS pipelines: diagnose failures, implement fixes, create PRs."
---

# Pipeline Monitor Skill

An interactive pipeline monitoring agent that watches AWS CodePipeline deployments, diagnoses failures, implements fixes, and handles the full PR workflow to resolve deployment issues.

## When to Use This Skill

- "Monitor the pipeline"
- "Check deployment status"
- "Fix the failed deployment"
- "Pipeline is broken"
- "Deployment failed"
- When you need to diagnose and fix AWS pipeline failures

## AWS Resources Reference

**IMPORTANT**: Read `.claude/project.config.json` to get project-specific AWS resource names.

Configuration location:
- AWS region: `aws.region`
- Stack prefix: `aws.stack_prefix`
- Stack names: `aws.stacks.*`
- Service URLs: `aws.services.*`
- Log groups: `monitoring.log_groups`
- CloudWatch dashboards: `monitoring.dashboards`
- CloudWatch alarms: `monitoring.alarms`
- GitHub repo: `project.repo_owner` and `project.repo_name`
- Worktree pattern: `worktree.base_dir_pattern`

Use these config values throughout the workflow instead of hardcoded resource names.

**Placeholders in code examples**: All code examples below use placeholders like `{PIPELINE_NAME}`, `{ECS_CLUSTER}`, etc. Before running commands, replace these placeholders with actual values read from `.claude/project.config.json`.

## Workflow Steps

### Step 1: Setup Worktree

> Standard worktree lifecycle: see `.claude/skills/shared/WORKTREE_LIFECYCLE.md` for the common pattern. Below describes only what differs for this skill.

Create an isolated git worktree for any fixes:

```bash
# Read worktree pattern from config
# Default: ../worktree-{purpose}-{id}
# Read from .claude/project.config.json: worktree.base_dir_pattern

# Generate unique worktree name
WORKTREE_NAME="pipeline-fix-$(date +%Y%m%d%H%M%S)"
WORKTREE_PATH="${CLAUDE_PROJECT_DIR}/../worktree-pipeline-${WORKTREE_NAME}"

# Create worktree from main
git worktree add "$WORKTREE_PATH" -b "fix/pipeline-${WORKTREE_NAME}" origin/main

# Navigate to worktree
cd "$WORKTREE_PATH"
```

### Step 2: Check Pipeline Status

Get the current pipeline state:

```bash
# Get pipeline execution status
aws codepipeline get-pipeline-state --name {PIPELINE_NAME} \
  --query "stageStates[*].{stage:stageName,status:latestExecution.status}" \
  --output table

# Get detailed stage info for failed stages
aws codepipeline get-pipeline-state --name {PIPELINE_NAME} \
  --query "stageStates[?latestExecution.status=='Failed']"
```

### Step 2.5: Check AWS DevOps Agent (NEW)

Before running manual diagnostics, check if AWS DevOps Agent has an active investigation:

```bash
# Check if DevOps Agent is configured
AGENT_SPACE_ID=$(aws cloudformation describe-stacks \
  --stack-name {PIPELINE_STACK} \
  --query "Stacks[0].Outputs[?OutputKey=='DevOpsAgentSpaceId'].OutputValue" \
  --output text 2>/dev/null)

if [ -n "$AGENT_SPACE_ID" ] && [ "$AGENT_SPACE_ID" != "None" ]; then
  echo "✓ DevOps Agent configured (Space ID: $AGENT_SPACE_ID)"

  # Check if pipeline failure alarm is in ALARM state (indicates active investigation)
  ALARM_STATE=$(aws cloudwatch describe-alarms \
    --alarm-names {PIPELINE_FAILURE_ALARM} \
    --query "MetricAlarms[0].StateValue" \
    --output text 2>/dev/null)

  if [ "$ALARM_STATE" = "ALARM" ]; then
    echo "⚠️  Pipeline failure alarm is ACTIVE - DevOps Agent investigation likely in progress"
    echo ""
    echo "📋 Check DevOps Agent investigation for AI-generated root cause analysis:"
    echo "   https://us-east-1.console.aws.amazon.com/devops-agent/home?region=us-east-1#/spaces/${AGENT_SPACE_ID}"
    echo ""
    echo "   The investigation may include:"
    echo "   - Root cause hypothesis"
    echo "   - Correlated code changes from GitHub"
    echo "   - Recommended remediation actions"
    echo ""
    echo "   TIP: Check the investigation first - it may have already identified the issue!"
  else
    echo "✓ Pipeline failure alarm is OK - no active investigation"
  fi
else
  echo "ℹ️  DevOps Agent not configured - using manual diagnostics"
fi
```

**Decision Logic:**
- If DevOps Agent has an active investigation, check the console first
- If the investigation provides clear root cause, skip to "Implement Fix"
- If investigation is incomplete or unclear, proceed with manual diagnostics
- If DevOps Agent is not configured, proceed with standard workflow

### Step 2.7: Check Auto-Fixer Status

Before proceeding with manual diagnostics, check if the auto-fixer is already working on this failure:

```bash
# Get the current pipeline execution ID
EXECUTION_ID=$(aws codepipeline get-pipeline-state --name {PIPELINE_NAME} \
  --query "stageStates[0].latestExecution.pipelineExecutionId" \
  --output text)

echo "Pipeline Execution ID: $EXECUTION_ID"

# Query DynamoDB for active fix attempts
FIX_ATTEMPTS=$(aws dynamodb query \
  --table-name {FIX_ATTEMPTS_TABLE} \
  --key-condition-expression "pipelineExecutionId = :execId" \
  --filter-expression "#s IN (:pending, :inProgress)" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values '{
    ":execId": {"S": "'"$EXECUTION_ID"'"},
    ":pending": {"S": "pending"},
    ":inProgress": {"S": "in_progress"}
  }' \
  --output json 2>/dev/null)

# Check if any active fix attempts exist
ACTIVE_COUNT=$(echo "$FIX_ATTEMPTS" | jq '.Count // 0')

if [ "$ACTIVE_COUNT" -gt 0 ]; then
  echo ""
  echo "🤖 AUTO-FIXER STATUS"
  echo "===================="

  # Display each active fix attempt
  echo "$FIX_ATTEMPTS" | jq -r '.Items[] | "
Status: \(.status.S)
Type: \(.type.S // "unknown")
Started: \(.startedAt.S)
Stage: \(.stage.S // "unknown")
Issue: #\(.issueNumber.N // "N/A")
PR: #\(.prNumber.N // "N/A")
"'

  # Calculate elapsed time
  STARTED_AT=$(echo "$FIX_ATTEMPTS" | jq -r '.Items[0].startedAt.S')
  if [ -n "$STARTED_AT" ]; then
    STARTED_EPOCH=$(date -d "$STARTED_AT" +%s 2>/dev/null || echo "0")
    NOW_EPOCH=$(date +%s)
    ELAPSED=$((NOW_EPOCH - STARTED_EPOCH))
    ELAPSED_MIN=$((ELAPSED / 60))
    echo "⏱️  Elapsed time: ${ELAPSED_MIN} minutes"

    # Warn if stuck for too long
    if [ "$ELAPSED_MIN" -gt 30 ]; then
      echo "⚠️  WARNING: Fix attempt running for over 30 minutes - may be stuck"
    fi
  fi

  echo ""
  echo "📋 Integration Options:"
  echo "   1. Wait for auto-fix - Monitor progress until completion"
  echo "   2. Take over - Cancel auto-fix and proceed manually"
  echo "   3. Start fresh - Ignore auto-fix, create new attempt"
else
  echo "ℹ️  No active auto-fix attempts - proceeding with manual diagnostics"
fi
```

**Decision Logic:**
- **Wait for auto-fix**: Poll DynamoDB every 30 seconds until status changes to `succeeded` or `failed`
- **Take over**: Update DynamoDB record to `cancelled`, add issue comment, proceed with manual fix
- **Start fresh**: Create new fix attempt in DynamoDB, proceed with manual workflow

**If taking over an auto-fix attempt:**

```bash
# Get the attempt ID to cancel
ATTEMPT_ID=$(echo "$FIX_ATTEMPTS" | jq -r '.Items[0].attemptId.S')

# Update status to cancelled
aws dynamodb update-item \
  --table-name {FIX_ATTEMPTS_TABLE} \
  --key '{
    "pipelineExecutionId": {"S": "'"$EXECUTION_ID"'"},
    "attemptId": {"S": "'"$ATTEMPT_ID"'"}
  }' \
  --update-expression "SET #s = :cancelled, completedAt = :now" \
  --expression-attribute-names '{"#s": "status"}' \
  --expression-attribute-values '{
    ":cancelled": {"S": "cancelled"},
    ":now": {"S": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}
  }'

echo "✓ Auto-fix attempt cancelled"

# Add comment to GitHub issue
ISSUE_NUM=$(echo "$FIX_ATTEMPTS" | jq -r '.Items[0].issueNumber.N // empty')
if [ -n "$ISSUE_NUM" ]; then
  gh issue comment "$ISSUE_NUM" --body "🔧 Manual intervention by /mon skill. Auto-fix attempt cancelled and manual fix in progress."
  echo "✓ Issue #$ISSUE_NUM updated with takeover comment"
fi
```

**If using auto-fixer diagnostics:**

When taking over, check if the auto-fixer has already collected useful diagnostics:

```bash
# Get fix description (may contain diagnostics)
FIX_DESC=$(echo "$FIX_ATTEMPTS" | jq -r '.Items[0].fixDescription.S // empty')
if [ -n "$FIX_DESC" ]; then
  echo ""
  echo "📝 Auto-fixer diagnostics available:"
  echo "$FIX_DESC"
  echo ""
  echo "Consider using these findings to skip redundant diagnostic steps."
fi
```

### Step 3: Diagnose the Failure

Based on which stage failed, run appropriate diagnostics:

#### 3a: Source Stage Failed

```bash
# Check GitHub connection
aws codepipeline list-action-executions --pipeline-name {PIPELINE_NAME} \
  --filter pipelineExecutionId=$(aws codepipeline get-pipeline-state --name {PIPELINE_NAME} --query "stageStates[0].latestExecution.pipelineExecutionId" --output text) \
  --query "actionExecutionDetails[?stageName=='Source']"
```

#### 3b: Build Stage Failed

```bash
# List recent builds
aws codebuild list-builds-for-project --project-name {BUILD_PROJECT} --max-items 5

# Get the most recent build ID
BUILD_ID=$(aws codebuild list-builds-for-project --project-name {BUILD_PROJECT} --max-items 1 --query "ids[0]" --output text)

# Get build details and phase status
aws codebuild batch-get-builds --ids $BUILD_ID \
  --query "builds[0].{status:buildStatus,phases:phases[*].{name:phaseType,status:phaseStatus,message:contexts[0].message}}"

# View build logs (last 30 minutes)
aws logs tail {BUILD_LOG_GROUP} --since 30m --format short
```

#### 3c: Infrastructure (CDK Deploy) Stage Failed

```bash
# Check all stack statuses
for stack in {DNS_STACK} {BUILDER_STACK} {DASHBOARD_STACK} {PIPELINE_STACK}; do
  echo "=== $stack ==="
  aws cloudformation describe-stacks --stack-name $stack \
    --query "Stacks[0].{Status:StackStatus,Reason:StackStatusReason}" 2>/dev/null || echo "Stack not found"
done

# Get failed stack events
aws cloudformation describe-stack-events --stack-name {BUILDER_STACK} \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED'][:10]"
```

#### 3d: ECS Deployment Stage Failed

```bash
# Check service health
aws ecs describe-services --cluster {ECS_CLUSTER} \
  --services {DASHBOARD_SERVICE} {ISSUE_MANAGER_SERVICE} {BUILDER_SERVICE} \
  --query "services[*].{name:serviceName,running:runningCount,desired:desiredCount,status:status}"

# Check deployment status
aws ecs describe-services --cluster {ECS_CLUSTER} --services {DASHBOARD_SERVICE} \
  --query "services[0].deployments"

# Get stopped tasks for errors
STOPPED_TASKS=$(aws ecs list-tasks --cluster {ECS_CLUSTER} --desired-status STOPPED --query "taskArns[:3]" --output text)
if [ -n "$STOPPED_TASKS" ]; then
  aws ecs describe-tasks --cluster {ECS_CLUSTER} --tasks $STOPPED_TASKS \
    --query "tasks[*].{task:taskArn,stoppedReason:stoppedReason,containers:containers[*].{name:name,exitCode:exitCode,reason:reason}}"
fi

# Check container logs
aws logs tail {DASHBOARD_LOG_GROUP} --since 10m --format short
```

### Step 4: Identify the Root Cause

Analyze the diagnostic output to identify the issue:

| Symptom | Likely Cause |
|---------|--------------|
| Build DOWNLOAD_SOURCE failed | GitHub connection issue |
| Build INSTALL failed | npm install error, dependency issue |
| Build BUILD failed | TypeScript error, test failure, Docker build error |
| CDK UPDATE_FAILED | CloudFormation resource error, IAM permissions |
| ECS tasks stopping | Container crash, health check failure, OOM |
| ECS stuck in deployment | New tasks can't start, old tasks won't drain |

## When a Fix is Needed

If diagnosis reveals an issue that needs code changes, read `.claude/skills/mon/FIX_WORKFLOW.md` for the full fix, PR, merge, and verification workflow.

## Common Failure Quick Reference

| Symptom | Likely Cause | Quick Fix |
|---------|-------------|-----------|
| INSTALL failed | Dependency conflict | Update package-lock.json |
| BUILD failed (tsc) | TypeScript errors | Run `npm run build` locally, fix errors |
| Docker build failed | Dockerfile issue | Check COPY paths, build deps |
| CDK UPDATE_FAILED | CloudFormation error | Run `cdk synth`, check CF events |
| ECS tasks stopping | Container crash/OOM | Check logs, increase memory |
| ECS stuck deploying | Health check failure | Force new deployment |

## Emergency Rollback

```bash
# Option 1: Revert the commit (triggers pipeline with reverted state)
git revert HEAD && git push

# Option 2: Rollback ECS to previous task definition
aws ecs list-task-definitions --family-prefix {DASHBOARD_SERVICE} --sort DESC --max-items 5
aws ecs update-service --cluster {ECS_CLUSTER} --service {DASHBOARD_SERVICE} \
  --task-definition {DASHBOARD_SERVICE}:<PREVIOUS_REVISION>
```

## Instructions for AI

When executing this skill:

1. **Create worktree first** - Always work in an isolated worktree
2. **Check pipeline status** - Understand what stage failed
3. **Check DevOps Agent** - Look for active investigations before manual diagnostics
4. **Check Auto-Fixer Status** - Query DynamoDB for active fix attempts; present integration options if found
5. **Diagnose thoroughly** - Use appropriate diagnostic commands for the failed stage
6. **Identify root cause** - Don't just fix symptoms
7. **If fix needed** - Read `FIX_WORKFLOW.md` for the implementation, PR, and verification steps
8. **Clean up** - Remove worktree when done

