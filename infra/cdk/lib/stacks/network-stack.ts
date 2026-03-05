import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface NetworkStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
}

/**
 * Network Stack - VPC foundation for Enkai Qualify infrastructure
 *
 * Creates:
 * - VPC with 2 AZs
 * - Public subnets (for ALB)
 * - Private subnets with egress (for ECS Fargate)
 * - NAT Gateway (single for dev, multi for prod)
 */
export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const { projectName, environment } = props;
    const isProd = environment === 'prod';

    // Create VPC with 2 availability zones
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${projectName}-${environment}-vpc`,
      maxAzs: 2,
      natGateways: isProd ? 2 : 1, // Single NAT for dev to save costs
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          mapPublicIpOnLaunch: false,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    // VPC Flow Logs for production
    if (isProd) {
      this.vpc.addFlowLog('FlowLog', {
        destination: ec2.FlowLogDestination.toCloudWatchLogs(),
        trafficType: ec2.FlowLogTrafficType.REJECT,
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${projectName}-${environment}-vpc-id`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnets', {
      value: this.vpc.privateSubnets.map((s) => s.subnetId).join(','),
      description: 'Private subnet IDs',
      exportName: `${projectName}-${environment}-private-subnets`,
    });
  }
}
