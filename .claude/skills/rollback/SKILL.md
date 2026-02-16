---
name: rollback
description: Production rollback procedures for failed deployments - git revert, ECS task rollback, CloudFront invalidation
---

# Rollback Skill

Emergency production rollback when a deployment causes issues.

**Configuration**: Read `.claude/project.config.json` for:
- AWS region: `aws.region`
- Stack prefix: `aws.stack_prefix`
- Service URLs: `aws.services.*`
- Monitoring: `monitoring.log_groups`, `monitoring.alarms`

## Invocation

```
/rollback              # Interactive - diagnose and choose strategy
/rollback ecs          # Rollback ECS to previous task definition
/rollback git          # Revert last commit and push (triggers pipeline)
/rollback cloudfront   # Invalidate CloudFront cache
```

## Workflow: Interactive Rollback

### Step 1: Assess the Situation

```bash
# Check ECS service health
aws ecs describe-services --cluster {ECS_CLUSTER} \
  --services {DASHBOARD_SERVICE} \
  --query "services[*].{name:serviceName,running:runningCount,desired:desiredCount,deployments:deployments}"

# Check for recent errors
aws logs tail {DASHBOARD_LOG_GROUP} --since 5m --format short | grep -i error | head -20

# Check alarms
aws cloudwatch describe-alarms --state-value ALARM \
  --query "MetricAlarms[*].{name:AlarmName,reason:StateReason}" --output table
```

### Step 2: Choose Rollback Strategy

| Scenario | Strategy | Speed |
|----------|----------|-------|
| Bad code deployed | Git revert → pipeline redeploy | ~10 min |
| ECS tasks crashing | ECS task definition rollback | ~2 min |
| Stale CDN content | CloudFront invalidation | ~5 min |
| Infrastructure broken | CDK rollback via CloudFormation | ~10 min |

### Step 3: Execute

Present options via AskUserQuestion, then execute chosen strategy.

## Strategy: Git Revert

```bash
# Identify the bad commit
git log --oneline -5

# Revert it
git revert HEAD --no-edit
git push

# This triggers the pipeline to redeploy with the reverted state
# Monitor pipeline
aws codepipeline get-pipeline-state --name {PIPELINE_NAME} \
  --query "stageStates[*].{stage:stageName,status:latestExecution.status}" --output table
```

## Strategy: ECS Task Definition Rollback

```bash
# List recent task definition revisions
aws ecs list-task-definitions --family-prefix {DASHBOARD_SERVICE} --sort DESC --max-items 5

# Get the previous revision number
CURRENT=$(aws ecs describe-services --cluster {ECS_CLUSTER} --services {DASHBOARD_SERVICE} \
  --query "services[0].taskDefinition" --output text)
echo "Current: $CURRENT"

# Update service to use previous revision
PREVIOUS_REV=$(($(echo $CURRENT | grep -o '[0-9]*$') - 1))
aws ecs update-service --cluster {ECS_CLUSTER} --service {DASHBOARD_SERVICE} \
  --task-definition {DASHBOARD_SERVICE}:${PREVIOUS_REV}

# Monitor rollback
aws ecs describe-services --cluster {ECS_CLUSTER} --services {DASHBOARD_SERVICE} \
  --query "services[0].{running:runningCount,desired:desiredCount,deployments:deployments}"
```

## Strategy: CloudFront Invalidation

```bash
# Invalidate all paths
aws cloudfront create-invalidation --distribution-id {DISTRIBUTION_ID} \
  --paths "/*"

# Check invalidation status
aws cloudfront list-invalidations --distribution-id {DISTRIBUTION_ID} --max-items 1
```

## Post-Rollback Verification

After any rollback strategy:

```bash
# 1. Verify ECS health
aws ecs describe-services --cluster {ECS_CLUSTER} --services {DASHBOARD_SERVICE} \
  --query "services[*].{name:serviceName,running:runningCount,desired:desiredCount}"

# 2. Test endpoint
curl -I {DASHBOARD_URL}

# 3. Check for errors in logs
aws logs tail {DASHBOARD_LOG_GROUP} --since 2m --format short | grep -i error || echo "No errors"

# 4. Check alarms cleared
aws cloudwatch describe-alarms --state-value ALARM --query "MetricAlarms[*].AlarmName"
```

## Instructions for AI

1. **Assess first** — understand what's broken before choosing a strategy
2. **ECS rollback is fastest** — use for container crashes, health check failures
3. **Git revert is safest** — use for bad code, ensures pipeline state matches git
4. **Confirm with user** — rollback affects production, always confirm strategy
5. **Verify after** — always run post-rollback checks
6. **Don't stack rollbacks** — one strategy at a time, verify before trying another
