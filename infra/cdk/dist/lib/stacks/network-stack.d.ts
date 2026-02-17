import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
export interface NetworkStackProps extends cdk.StackProps {
    projectName: string;
    environment: string;
}
/**
 * Network Stack - VPC foundation for Metis infrastructure
 *
 * Creates:
 * - VPC with 2 AZs
 * - Public subnets (for ALB)
 * - Private subnets with egress (for ECS Fargate)
 * - NAT Gateway (single for dev, multi for prod)
 */
export declare class NetworkStack extends cdk.Stack {
    readonly vpc: ec2.Vpc;
    constructor(scope: Construct, id: string, props: NetworkStackProps);
}
