#!/bin/bash
# Update ECS task definitions to use proper IAM roles and Secrets Manager references.
# Run after deploying iam-roles.yaml CloudFormation stack.
#
# Usage: ./update-task-defs.sh
#
# Prerequisites:
#   aws cloudformation deploy --template-file ../cdk/iam-roles.yaml \
#     --stack-name enkai-qualify-dev-iam --capabilities CAPABILITY_NAMED_IAM

set -euo pipefail

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=${AWS_DEFAULT_REGION:-us-east-1}
PROJECT=enkai-qualify
ENV=dev
CLUSTER=enkai-dev

EXEC_ROLE="arn:aws:iam::${ACCOUNT_ID}:role/${PROJECT}-${ENV}-execution"
TASK_ROLE="arn:aws:iam::${ACCOUNT_ID}:role/${PROJECT}-${ENV}-task"

DB_SECRET="arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:${PROJECT}/${ENV}/db-credentials"
API_KEYS_SECRET="arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:${PROJECT}/${ENV}/api-keys"

echo "Using execution role: ${EXEC_ROLE}"
echo "Using task role: ${TASK_ROLE}"

# --- API Task Definition ---
echo ""
echo "=== Registering API task definition ==="
aws ecs register-task-definition \
  --family "${PROJECT}-${ENV}-api" \
  --task-role-arn "${TASK_ROLE}" \
  --execution-role-arn "${EXEC_ROLE}" \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 256 \
  --memory 512 \
  --container-definitions "[
    {
      \"name\": \"api\",
      \"image\": \"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT}-${ENV}-api:latest\",
      \"essential\": true,
      \"portMappings\": [{\"containerPort\": 8000, \"protocol\": \"tcp\"}],
      \"environment\": [
        {\"name\": \"ENVIRONMENT\", \"value\": \"${ENV}\"},
        {\"name\": \"DEBUG\", \"value\": \"true\"}
      ],
      \"secrets\": [
        {\"name\": \"DATABASE_URL\", \"valueFrom\": \"${DB_SECRET}:connectionString::\"}
      ],
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/${PROJECT}/${ENV}/api\",
          \"awslogs-region\": \"${REGION}\",
          \"awslogs-stream-prefix\": \"api\"
        }
      },
      \"healthCheck\": {
        \"command\": [\"CMD-SHELL\", \"curl -f http://127.0.0.1:8000/health || exit 1\"],
        \"interval\": 30,
        \"timeout\": 30,
        \"retries\": 5,
        \"startPeriod\": 180
      },
      \"linuxParameters\": {\"initProcessEnabled\": true}
    }
  ]" \
  --query "taskDefinition.{family:family,revision:revision}" --output json

# --- Worker Task Definition ---
echo ""
echo "=== Registering Worker task definition ==="
aws ecs register-task-definition \
  --family "${PROJECT}-${ENV}-worker" \
  --task-role-arn "${TASK_ROLE}" \
  --execution-role-arn "${EXEC_ROLE}" \
  --network-mode awsvpc \
  --requires-compatibilities FARGATE \
  --cpu 256 \
  --memory 512 \
  --container-definitions "[
    {
      \"name\": \"worker\",
      \"image\": \"${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT}-${ENV}-worker:latest\",
      \"essential\": true,
      \"environment\": [
        {\"name\": \"ENVIRONMENT\", \"value\": \"development\"},
        {\"name\": \"POLL_INTERVAL_SECONDS\", \"value\": \"60\"}
      ],
      \"secrets\": [
        {\"name\": \"DATABASE_URL\", \"valueFrom\": \"${DB_SECRET}:connectionString::\"},
        {\"name\": \"ANTHROPIC_API_KEY\", \"valueFrom\": \"${API_KEYS_SECRET}:ANTHROPIC_API_KEY::\"},
        {\"name\": \"GITHUB_APP_ID\", \"valueFrom\": \"${API_KEYS_SECRET}:GITHUB_APP_ID::\"},
        {\"name\": \"GITHUB_APP_INSTALLATION_ID\", \"valueFrom\": \"${API_KEYS_SECRET}:GITHUB_APP_INSTALLATION_ID::\"},
        {\"name\": \"GITHUB_APP_PRIVATE_KEY\", \"valueFrom\": \"${API_KEYS_SECRET}:GITHUB_APP_PRIVATE_KEY::\"}
      ],
      \"logConfiguration\": {
        \"logDriver\": \"awslogs\",
        \"options\": {
          \"awslogs-group\": \"/ecs/${PROJECT}/${ENV}/worker\",
          \"awslogs-region\": \"${REGION}\",
          \"awslogs-stream-prefix\": \"worker\"
        }
      },
      \"linuxParameters\": {\"initProcessEnabled\": true}
    }
  ]" \
  --query "taskDefinition.{family:family,revision:revision}" --output json

# --- Update Services ---
echo ""
echo "=== Updating API service ==="
aws ecs update-service --cluster "${CLUSTER}" --service "${PROJECT}-api-v2" \
  --task-definition "${PROJECT}-${ENV}-api" \
  --force-new-deployment \
  --query "service.{name:serviceName,taskDef:taskDefinition}" --output json

echo ""
echo "=== Updating Worker service ==="
aws ecs update-service --cluster "${CLUSTER}" --service "${PROJECT}-worker-v2" \
  --task-definition "${PROJECT}-${ENV}-worker" \
  --force-new-deployment \
  --query "service.{name:serviceName,taskDef:taskDefinition}" --output json

echo ""
echo "Done! Monitor with:"
echo "  aws ecs describe-services --cluster ${CLUSTER} --services ${PROJECT}-api-v2 ${PROJECT}-worker-v2 --query 'services[*].{name:serviceName,desired:desiredCount,running:runningCount,rollout:deployments[0].rolloutState}' --output table"
