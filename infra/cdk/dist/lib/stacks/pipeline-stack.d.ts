import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';
export interface PipelineStackProps extends cdk.StackProps {
    projectName: string;
    environment: string;
    dashboardRepository: ecr.Repository;
    apiRepository: ecr.Repository;
    workerRepository: ecr.Repository;
    /** Service ARN or IBaseService for dashboard deployment. Use ARN string for external clusters. */
    dashboardService: ecs.IBaseService | string;
    /** Service ARN or IBaseService for API deployment. */
    apiService: ecs.IBaseService | string;
    /** Service ARN or IBaseService for worker deployment. */
    workerService: ecs.IBaseService | string;
}
/**
 * Pipeline Stack - CodePipeline + CodeBuild for CI/CD
 *
 * Creates:
 * - CodePipeline with Source, Build, and Deploy stages
 * - Parallel CodeBuild projects for dashboard and API
 * - ECS rolling deployment with circuit breaker
 *
 * Note: Requires GitHub CodeStar connection to be configured
 */
export declare class PipelineStack extends cdk.Stack {
    readonly pipeline: codepipeline.Pipeline;
    constructor(scope: Construct, id: string, props: PipelineStackProps);
}
