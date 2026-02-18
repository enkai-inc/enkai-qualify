#!/usr/bin/env node
/**
 * Metis CDK Application Entry Point
 *
 * Deployment order:
 * 1. NetworkStack - VPC foundation
 * 2. EcrStack - Container repositories
 * 3. DatabaseStack - RDS + Redis (depends on Network)
 * 4. EcsStack - Fargate services (depends on Database, ECR)
 * 5. PipelineStack - CI/CD (depends on ECS)
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';

import { NetworkStack } from '../lib/stacks/network-stack';
import { EcrStack } from '../lib/stacks/ecr-stack';
import { DatabaseStack } from '../lib/stacks/database-stack';
import { EcsStack } from '../lib/stacks/ecs-stack';
import { PipelineStack } from '../lib/stacks/pipeline-stack';

const app = new cdk.App();

// Get context values
const environment = app.node.tryGetContext('environment') || 'dev';
const projectName = app.node.tryGetContext('projectName') || 'metis';

// Common stack props
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const stackPrefix = `${projectName}-${environment}`;

// Tags applied to all resources
const commonTags = {
  Project: projectName,
  Environment: environment,
  ManagedBy: 'CDK',
};

// 1. Network Stack - VPC, subnets, NAT gateway
const networkStack = new NetworkStack(app, `${stackPrefix}-network`, {
  env,
  projectName,
  environment,
  tags: commonTags,
});

// 2. ECR Stack - Container repositories
const ecrStack = new EcrStack(app, `${stackPrefix}-ecr`, {
  env,
  projectName,
  environment,
  tags: commonTags,
});

// 3. Database Stack - RDS PostgreSQL + ElastiCache Redis
const databaseStack = new DatabaseStack(app, `${stackPrefix}-database`, {
  env,
  projectName,
  environment,
  vpc: networkStack.vpc,
  tags: commonTags,
});
databaseStack.addDependency(networkStack);

// 4. ECS Stack - Fargate cluster, services, ALB
const ecsStack = new EcsStack(app, `${stackPrefix}-ecs`, {
  env,
  projectName,
  environment,
  vpc: networkStack.vpc,
  dashboardRepository: ecrStack.dashboardRepository,
  apiRepository: ecrStack.apiRepository,
  workerRepository: ecrStack.workerRepository,
  databaseSecret: databaseStack.databaseSecret,
  redisCluster: databaseStack.redisCluster,
  tags: commonTags,
});
ecsStack.addDependency(databaseStack);
ecsStack.addDependency(ecrStack);

// 5. Pipeline Stack - CodePipeline + CodeBuild
const pipelineStack = new PipelineStack(app, `${stackPrefix}-pipeline`, {
  env,
  projectName,
  environment,
  dashboardRepository: ecrStack.dashboardRepository,
  apiRepository: ecrStack.apiRepository,
  workerRepository: ecrStack.workerRepository,
  dashboardService: ecsStack.dashboardService,
  apiService: ecsStack.apiService,
  workerService: ecsStack.workerService,
  cluster: ecsStack.cluster,
  tags: commonTags,
});
pipelineStack.addDependency(ecsStack);

app.synth();
