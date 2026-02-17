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
