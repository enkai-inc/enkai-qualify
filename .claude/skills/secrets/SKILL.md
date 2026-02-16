---
name: secrets
description: "Upload secrets from .env files to AWS Secrets Manager."
---

# Secrets Skill - AWS Secrets Manager Upload

This skill uploads secrets from local `.env.{environment}` files to AWS Secrets Manager.

**Configuration**: Read `.claude/project.config.json` for:
- Secret prefix: `secrets.prefix`
- Secret pattern: `secrets.pattern` (e.g., `{prefix}/{environment}/*`)
- AWS region: `aws.region`

Secrets are stored with the naming convention from config (typically `{prefix}/{environment}/{secret-name}`).

## When to Use This Skill

- "Upload secrets to AWS"
- "Sync secrets to prod"
- "Update production secrets"
- "Deploy secrets"
- When deploying to a new environment
- When secrets have been rotated or changed

## File Naming Convention

Read secret prefix from config (`secrets.prefix`):

| Environment | File Name | AWS Prefix |
|-------------|-----------|------------|
| dev | `.env.dev` | `{secrets.prefix}/dev/*` |
| staging | `.env.staging` | `{secrets.prefix}/staging/*` |
| prod | `.env.prod` | `{secrets.prefix}/prod/*` |

## Supported Secrets

Environment variables are uploaded with the pattern from config. Example with `secrets.prefix` = "my-project":

| Environment Variable | AWS Secret Name |
|---------------------|-----------------|
| `GITHUB_TOKEN` | `{prefix}/{env}/github-token` |
| `SLACK_SIGNING_SECRET` | `{prefix}/{env}/slack-signing-secret` |
| `GITHUB_APP_PRIVATE_KEY` | `{prefix}/{env}/github-app-private-key` |
| `ANTHROPIC_API_KEY` | `{prefix}/{env}/anthropic-api-key` |
| `AUTH_SECRET` | `{prefix}/{env}/auth-secret` |
| Other env vars | `{prefix}/{env}/{lowercase-name}` |

Customize the list based on your project's actual secrets.

## .env File Format

Create your `.env.{environment}` file with secrets in standard format:

```bash
# Required secrets for your project
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-api03-xxxx

# Add other secrets your project needs
# AUTH_SECRET=xxxxx
# API_KEY=xxxxxxx
```

**Security Notes:**
- NEVER commit `.env.{environment}` files to git
- Add `.env.dev`, `.env.staging`, `.env.prod` to `.gitignore`
- Only include secrets you need for that environment

## Step-by-Step Process

### Step 1: Verify the .env file exists

```bash
# Check file exists and has content
ls -la .env.prod  # or .env.dev, .env.staging

# Preview what will be uploaded (dry run)
python scripts/upload_secrets.py --env-file .env.prod --environment prod --dry-run
```

### Step 2: Upload secrets to AWS

```bash
# For production
python scripts/upload_secrets.py --env-file .env.prod --environment prod

# For dev
python scripts/upload_secrets.py --env-file .env.dev --environment dev

# For staging
python scripts/upload_secrets.py --env-file .env.staging --environment staging
```

### Step 3: Verify secrets in AWS

Read secret prefix from config:
```bash
# List all project secrets (use secrets.prefix from config)
aws secretsmanager list-secrets --filter Key=name,Values={secrets.prefix}/ --query "SecretList[*].Name"

# Get a specific secret (to verify it exists, not its value)
aws secretsmanager describe-secret --secret-id {secrets.prefix}/prod/github-token
```

### Step 4: Restart services to pick up new secrets

After updating secrets, ECS services need to be restarted (use service names from config):

```bash
# Force new deployment of services that use secrets
# Read cluster and service names from aws.stacks.* or similar config
aws ecs update-service --cluster {ECS_CLUSTER} --service {SERVICE_NAME} --force-new-deployment
```

## Integration with Deployment

When deploying, add secrets upload before CDK deployment:

1. **Before CDK deploy**: Upload secrets if they've changed
2. **CDK deploy**: Infrastructure references secrets by ARN
3. **ECS update**: New tasks will read updated secrets

## Quick Reference

| Command | Description |
|---------|-------------|
| `python scripts/upload_secrets.py --env-file .env.prod -e prod` | Upload prod secrets |
| `python scripts/upload_secrets.py --env-file .env.prod -e prod --dry-run` | Preview only |
| `aws secretsmanager list-secrets --filter Key=name,Values={prefix}/` | List all secrets |
| `aws secretsmanager get-secret-value --secret-id {prefix}/prod/github-token` | Read a secret |

## Troubleshooting

### Secret not found after upload

Check the secret was created with the correct name (use prefix from config):
```bash
aws secretsmanager describe-secret --secret-id {secrets.prefix}/prod/github-token
```

### Permission denied

Ensure your AWS credentials have `secretsmanager:CreateSecret` and `secretsmanager:PutSecretValue` permissions.

### ECS service not picking up new secret

Force a new deployment (use cluster/service names from config):
```bash
aws ecs update-service --cluster {ECS_CLUSTER} --service {SERVICE_NAME} --force-new-deployment
```

## Security Considerations

1. **Never log secret values** - The script intentionally hides values
2. **Use IAM roles in production** - Don't store AWS credentials locally
3. **Rotate secrets regularly** - Update `.env` files and re-run the script
4. **Audit access** - Enable CloudTrail for Secrets Manager operations

## Security: AI Context Isolation

**CRITICAL**: This skill is designed so that secret values NEVER enter Claude's context.

The Python script (`scripts/upload_secrets.py`) reads the `.env` file locally and uploads directly to AWS Secrets Manager. Claude only executes the command - it does not read the file contents.

## Instructions for AI

When using this skill:

1. **NEVER read .env files** - Do NOT use the Read tool on `.env.*` files
2. **Only execute the script** - Let the Python script handle file reading
3. **Never echo or print secret values** - Only show secret names, never values
4. **Always do a dry run first** - Use `--dry-run` to preview changes
5. **Verify the environment** - Double-check you're uploading to the correct environment
6. **Restart services after** - Remind user to restart ECS services to pick up changes
7. **Check .gitignore** - Ensure .env files aren't committed

**Forbidden actions:**
- `Read .env.prod` or any `.env.*` file
- `cat .env.prod` or any command that outputs file contents
- `grep` on .env files that might match secret values
- Any action that would bring secret values into this conversation