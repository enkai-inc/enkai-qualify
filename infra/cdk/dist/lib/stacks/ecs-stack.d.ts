import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';
export interface EcsStackProps extends cdk.StackProps {
    projectName: string;
    environment: string;
    vpc: ec2.Vpc;
    dashboardRepository: ecr.Repository;
    apiRepository: ecr.Repository;
    databaseSecret: secretsmanager.Secret;
    redisCluster: elasticache.CfnCacheCluster;
}
/**
 * ECS Stack - Fargate cluster, services, and ALB
 *
 * Creates:
 * - ECS Fargate cluster
 * - Application Load Balancer
 * - Dashboard service (Next.js on port 3000)
 * - API service (FastAPI on port 8000)
 * - Task definitions with proper IAM roles
 */
export declare class EcsStack extends cdk.Stack {
    readonly cluster: ecs.Cluster;
    readonly dashboardService: ecs.FargateService;
    readonly apiService: ecs.FargateService;
    readonly alb: elbv2.ApplicationLoadBalancer;
    constructor(scope: Construct, id: string, props: EcsStackProps);
}
