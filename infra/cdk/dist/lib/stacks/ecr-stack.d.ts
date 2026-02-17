import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';
export interface EcrStackProps extends cdk.StackProps {
    projectName: string;
    environment: string;
}
/**
 * ECR Stack - Container repositories for Metis services
 *
 * Creates:
 * - Dashboard repository
 * - API repository
 *
 * Both repositories have lifecycle rules to limit stored images
 */
export declare class EcrStack extends cdk.Stack {
    readonly dashboardRepository: ecr.Repository;
    readonly apiRepository: ecr.Repository;
    constructor(scope: Construct, id: string, props: EcrStackProps);
}
