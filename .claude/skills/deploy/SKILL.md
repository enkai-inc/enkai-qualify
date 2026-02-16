---
name: deploy
description: "Deploy changes: atlas update, version, tag, push, CDK deploy, Docker build, ECS update."
---

# Deploy Skill - Deployment Workflow

This skill orchestrates a complete production deployment including documentation updates, versioning, and git operations. Infrastructure deployment, Docker builds, and ECS updates are handled automatically by the AWS CodePipeline build pipeline.

**Configuration**: Read `.claude/project.config.json` for all deployment settings:
- AWS resources: `aws.region`, `aws.stack_prefix`, `aws.stacks.*`
- Service URLs: `aws.services.dashboard_url`, `aws.services.api_url`
- Project info: `project.name`, `project.display_name`
- Paths: `paths.atlas_dir`, `paths.infra_dir`, `paths.dashboard_dir`

All examples use placeholders like `{STACK_PREFIX}`, `{DASHBOARD_STACK}`, etc. Replace with values from config.

## When to Use This Skill

- "Deploy to production"
- "Release these changes"
- "Ship it"
- "Deploy"
- After completing a feature or fix that's ready for production

## Architecture Overview

Read stack names from `.claude/project.config.json` under `aws.stacks.*`:

The project uses AWS CDK for infrastructure-as-code with automated CI/CD.

Typical stack structure (customize from config):

| Stack | Purpose | Config Key |
|-------|---------|------------|
| `{STACK_PREFIX}DNSStack` | Route53, ACM certificates, auth | `aws.stacks.dns` |
| `{STACK_PREFIX}BuilderStack` | VPC, ECS cluster, backend services | `aws.stacks.builder` |
| `{STACK_PREFIX}DashboardStack` | Dashboard ECS service, ALB, logs | `aws.stacks.dashboard` |
| `{STACK_PREFIX}PipelineStack` | CodePipeline for CI/CD | `aws.stacks.pipeline` (if exists) |

**Pipeline Flow**: Push to `main` → CodePipeline triggers → Build Docker images → Deploy CDK → Update ECS services

## Deployment Checklist

Before deploying, verify:
- [ ] All tests pass
- [ ] TypeScript compiles (`npm run build` in relevant directories)
- [ ] CDK synth succeeds (`npx cdk synth` in `infra/cdk/`)
- [ ] No uncommitted changes that shouldn't be deployed

## Step-by-Step Deployment Process

### Step 1: Run Pre-deployment Checks

```bash
# Type check dashboard
cd dashboard && npm run type-check

# Build CDK
cd infra/cdk && npm run build

# Check git status
git status
```

If any checks fail, fix them before proceeding.

### Step 2: Update Feature Atlas

Read atlas path from config: `paths.atlas_dir`

#### 2.1 Update System Map

Path: `{paths.atlas_dir}/tier5-reference/02-system-map.md` or `{paths.atlas_dir}/system-map.md`

Scan and update:
1. **Version number** - Update to match new version
2. **Routes** - Scan for new/changed pages and API routes
3. **Components** - Check for new/modified components
4. **Server Actions** - Scan for new actions
5. **External Integrations** - Document any new service integrations
6. **Environment Variables** - Document any new env vars

#### 2.2 Update Feature Documentation

Path: `{paths.atlas_dir}/features/` or `{paths.atlas_features_dir}`

For each changed feature:
- Update file paths if renamed
- Add new components/routes
- Document new business rules
- Update "Version History" table

#### 2.3 Create ADRs (if applicable)

For significant architectural changes, create `{paths.atlas_dir}/decisions/NNNN-title.md`.

### Step 3: Update Version

Determine version bump type:
- **Patch** (0.0.X): Bug fixes, minor changes
- **Minor** (0.X.0): New features, non-breaking changes
- **Major** (X.0.0): Breaking changes

```bash
# Update package.json version
npm version patch|minor|major --no-git-tag-version
```

Or manually edit `package.json`.

### Step 4: Commit All Changes

```bash
# Stage all changes
git add .

# Commit with descriptive message
git commit -m "$(cat <<'EOF'
<type>: <description>

<body - what changed and why>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

Commit types:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

### Step 5: Tag and Push

```bash
# Create version tag
git tag v$(node -p "require('./package.json').version")

# Push code and tags
git push && git push --tags
```

This triggers the AWS CodePipeline which will:
1. Build Docker images for dashboard, builder, and issue-manager
2. Push images to ECR with git commit hash tags
3. Deploy CDK infrastructure changes
4. Update ECS services with new task definitions

### Step 6: Upload Secrets (if changed)

If any secrets have changed, upload them manually (not handled by pipeline):

```bash
# Check if .env.prod exists
ls -la .env.prod

# Dry run to preview what will be uploaded
python scripts/upload_secrets.py --env-file .env.prod --environment prod --dry-run

# Upload secrets to AWS Secrets Manager
python scripts/upload_secrets.py --env-file .env.prod --environment prod
```

For more details, see the **secrets** skill.

### Step 7: Monitor Pipeline & Verify Deployment

Read resource names from config before running these commands:

```bash
# Check pipeline status (use pipeline name from config)
aws codepipeline get-pipeline-state --name {PIPELINE_NAME} \
  --query "stageStates[*].{stage:stageName,status:latestExecution.status}"

# Check ECS service health (use cluster and service names from config)
aws ecs describe-services --cluster {ECS_CLUSTER} --services {DASHBOARD_SERVICE} {OTHER_SERVICES} \
  --query "services[*].{name:serviceName,running:runningCount,desired:desiredCount}"

# View recent service events
aws ecs describe-services --cluster {ECS_CLUSTER} --services {DASHBOARD_SERVICE} \
  --query "services[0].events[:5]"

# Test the dashboard URL (from config: aws.services.dashboard_url)
curl -I {DASHBOARD_URL}
```

## Quick Reference

Read all values from `.claude/project.config.json`:

| Resource | Config Path |
|----------|-------------|
| AWS Region | `aws.region` |
| AWS Profile | `aws.profile` |
| Stack Prefix | `aws.stack_prefix` |
| Dashboard URL | `aws.services.dashboard_url` |
| API URL | `aws.services.api_url` |
| Stack Names | `aws.stacks.*` |

## CDK Stack Files

Typical structure (paths from config `paths.infra_dir`):

| Stack Purpose | Typical File Path |
|---------------|-------------------|
| DNS & Auth | `{paths.infra_dir}/lib/dns-auth-stack.ts` |
| Core Services | `{paths.infra_dir}/lib/builder-stack.ts` |
| Dashboard | `{paths.infra_dir}/lib/dashboard-stack.ts` |
| Pipeline | `{paths.infra_dir}/lib/pipeline-stack.ts` |

## Feature Atlas Files to Update

Read atlas path from config: `paths.atlas_dir`

| File | When to Update |
|------|----------------|
| `{paths.atlas_dir}/tier5-reference/02-system-map.md` | Every deployment (version, routes, models) |
| `{paths.atlas_dir}/features/*.md` | When that feature changes |
| `{paths.atlas_dir}/decisions/*.md` | Significant architectural decisions |
| `{paths.atlas_dir}/tier5-reference/01-golden-commands.md` | New dev/test/deploy commands |

## Common Issues

### Pipeline Build Failed

Check CodeBuild logs (use project name from your pipeline config):
```bash
# List recent builds
aws codebuild list-builds-for-project --project-name {BUILD_PROJECT_NAME} --max-items 5

# Get build details
aws codebuild batch-get-builds --ids <BUILD_ID> \
  --query "builds[0].{status:buildStatus,phases:phases[*].{name:phaseType,status:phaseStatus}}"

# View build logs in CloudWatch (use log group from monitoring.log_groups)
aws logs tail {BUILD_LOG_GROUP} --since 30m
```

### Pipeline Infrastructure Stage Failed

Usually a CloudFormation issue (use stack names from config `aws.stacks.*`):
```bash
# Check stack status
aws cloudformation describe-stacks --stack-name {BUILDER_STACK} \
  --query "Stacks[0].{Status:StackStatus,Reason:StackStatusReason}"

# View stack events for errors
aws cloudformation describe-stack-events --stack-name {BUILDER_STACK} \
  --query "StackEvents[?ResourceStatus=='CREATE_FAILED' || ResourceStatus=='UPDATE_FAILED'][:5]"
```

### ECS Service Stuck in Deployment

Use cluster and service names from config:
```bash
# Check deployment status
aws ecs describe-services --cluster {ECS_CLUSTER} --services {DASHBOARD_SERVICE} \
  --query "services[0].deployments"

# View stopped tasks for errors
aws ecs list-tasks --cluster {ECS_CLUSTER} --service-name {DASHBOARD_SERVICE} --desired-status STOPPED
aws ecs describe-tasks --cluster {ECS_CLUSTER} --tasks <TASK_ARN> \
  --query "tasks[0].{stoppedReason:stoppedReason,containers:containers[*].{name:name,exitCode:exitCode,reason:reason}}"
```

### ECS Task Health Check Failures

Check container logs (use log group from config `monitoring.log_groups`):
```bash
aws logs tail {DASHBOARD_LOG_GROUP} --since 5m --format short
```

## Manual Deployment (Emergency Only)

If the pipeline is broken, you can deploy manually (use values from config):

```bash
# Build and push Docker images (if using ECR)
aws ecr get-login-password --region {aws.region} | docker login --username AWS --password-stdin {ECR_REGISTRY_URL}

# Deploy CDK (use infra path from config)
cd {paths.infra_dir} && npm run build && npx cdk deploy --all --require-approval never

# Force ECS service update
aws ecs update-service --cluster {ECS_CLUSTER} --service {DASHBOARD_SERVICE} --force-new-deployment
```

## Rollback

### Rollback via Git Revert

```bash
# Revert the problematic commit
git revert HEAD
git push

# Pipeline will automatically deploy the reverted state
```

### Rollback ECS to Previous Task Definition

Use service names from config:
```bash
# List task definition revisions
aws ecs list-task-definitions --family-prefix {DASHBOARD_SERVICE} --sort DESC

# Update service to use previous revision
aws ecs update-service --cluster {ECS_CLUSTER} --service {DASHBOARD_SERVICE} \
  --task-definition {DASHBOARD_SERVICE}:<PREVIOUS_REVISION>
```

## Instructions for AI

When executing this skill:

1. **Always run checks first** - Never deploy with failing tests or type errors
2. **Update documentation** - System map version at minimum
3. **Use semantic versioning** - Patch for fixes, minor for features, major for breaking
4. **Commit and tag** - Create proper git commits and version tags
5. **Push triggers pipeline** - The AWS CodePipeline handles builds and deploys automatically
6. **Monitor pipeline status** - Check that all stages pass
7. **Check logs on failures** - Use CodeBuild and CloudWatch logs to diagnose issues
8. **Report completion** - Tell user the new version and pipeline status
