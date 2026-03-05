import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface EcrStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
}

/**
 * ECR Stack - Container repositories for Enkai Qualify services
 *
 * Creates:
 * - Dashboard repository
 * - API repository
 *
 * Both repositories have lifecycle rules to limit stored images
 */
export class EcrStack extends cdk.Stack {
  public readonly dashboardRepository: ecr.Repository;
  public readonly apiRepository: ecr.Repository;
  public readonly workerRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    const { projectName, environment } = props;

    // Dashboard repository
    this.dashboardRepository = new ecr.Repository(this, 'DashboardRepo', {
      repositoryName: `${projectName}-${environment}-dashboard`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy:
        environment === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: environment !== 'prod',
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
          rulePriority: 1,
          tagStatus: ecr.TagStatus.ANY,
        },
      ],
    });

    // API repository
    this.apiRepository = new ecr.Repository(this, 'ApiRepo', {
      repositoryName: `${projectName}-${environment}-api`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy:
        environment === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: environment !== 'prod',
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
          rulePriority: 1,
          tagStatus: ecr.TagStatus.ANY,
        },
      ],
    });

    // Worker repository
    this.workerRepository = new ecr.Repository(this, 'WorkerRepo', {
      repositoryName: `${projectName}-${environment}-worker`,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.MUTABLE,
      removalPolicy:
        environment === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: environment !== 'prod',
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
          rulePriority: 1,
          tagStatus: ecr.TagStatus.ANY,
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'DashboardRepoUri', {
      value: this.dashboardRepository.repositoryUri,
      description: 'Dashboard ECR repository URI',
      exportName: `${projectName}-${environment}-dashboard-repo-uri`,
    });

    new cdk.CfnOutput(this, 'ApiRepoUri', {
      value: this.apiRepository.repositoryUri,
      description: 'API ECR repository URI',
      exportName: `${projectName}-${environment}-api-repo-uri`,
    });

    new cdk.CfnOutput(this, 'WorkerRepoUri', {
      value: this.workerRepository.repositoryUri,
      description: 'Worker ECR repository URI',
      exportName: `${projectName}-${environment}-worker-repo-uri`,
    });
  }
}
