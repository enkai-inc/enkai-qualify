import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as elbv2Actions from 'aws-cdk-lib/aws-elasticloadbalancingv2-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';

export interface EcsStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.Vpc;
  dashboardRepository: ecr.Repository;
  apiRepository: ecr.Repository;
  workerRepository: ecr.Repository;
  databaseSecret: secretsmanager.Secret;
  redisCluster: elasticache.CfnCacheCluster;
  databaseSecurityGroup: ec2.SecurityGroup;
  redisSecurityGroup: ec2.SecurityGroup;
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
export class EcsStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly dashboardService: ecs.FargateService;
  public readonly apiService: ecs.FargateService;
  public readonly workerService: ecs.FargateService;
  public readonly alb: elbv2.ApplicationLoadBalancer;

  constructor(scope: Construct, id: string, props: EcsStackProps) {
    super(scope, id, props);

    const {
      projectName,
      environment,
      vpc,
      dashboardRepository,
      apiRepository,
      workerRepository,
      databaseSecret,
      redisCluster,
      databaseSecurityGroup,
      redisSecurityGroup,
    } = props;
    const isProd = environment === 'prod';

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: `${projectName}-${environment}-cluster`,
      vpc,
      containerInsightsV2: isProd ? ecs.ContainerInsights.ENABLED : ecs.ContainerInsights.DISABLED,
    });

    // Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: `${projectName}-${environment}-alb`,
      securityGroup: new ec2.SecurityGroup(this, 'AlbSG', {
        vpc,
        securityGroupName: `${projectName}-${environment}-alb-sg`,
        description: 'Security group for ALB',
        allowAllOutbound: true,
      }),
    });

    // Allow HTTP/HTTPS traffic to ALB
    this.alb.connections.allowFromAnyIpv4(ec2.Port.tcp(80));
    this.alb.connections.allowFromAnyIpv4(ec2.Port.tcp(443));

    // HTTP Listener - default action set later based on environment
    const httpListener = this.alb.addListener('HttpListener', {
      port: 80,
      open: true,
    });

    // Service security group
    const serviceSG = new ec2.SecurityGroup(this, 'ServiceSG', {
      vpc,
      securityGroupName: `${projectName}-${environment}-service-sg`,
      description: 'Security group for ECS services',
      allowAllOutbound: true,
    });

    // Allow ALB to reach services
    serviceSG.addIngressRule(
      ec2.Peer.securityGroupId(this.alb.connections.securityGroups[0].securityGroupId),
      ec2.Port.tcp(3000),
      'Allow ALB to dashboard'
    );
    serviceSG.addIngressRule(
      ec2.Peer.securityGroupId(this.alb.connections.securityGroups[0].securityGroupId),
      ec2.Port.tcp(8000),
      'Allow ALB to API'
    );

    // Allow ECS services to reach database (PostgreSQL 5432)
    // Using L1 construct to avoid cross-stack cyclic dependency
    new ec2.CfnSecurityGroupIngress(this, 'DbIngress', {
      groupId: databaseSecurityGroup.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: serviceSG.securityGroupId,
      description: 'Allow ECS services to access PostgreSQL',
    });

    // Allow ECS services to reach Redis (6379)
    new ec2.CfnSecurityGroupIngress(this, 'RedisIngress', {
      groupId: redisSecurityGroup.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 6379,
      toPort: 6379,
      sourceSecurityGroupId: serviceSG.securityGroupId,
      description: 'Allow ECS services to access Redis',
    });

    // Dashboard Task Definition
    const dashboardTaskDef = new ecs.FargateTaskDefinition(
      this,
      'DashboardTaskDef',
      {
        memoryLimitMiB: isProd ? 1024 : 512,
        cpu: isProd ? 512 : 256,
        family: `${projectName}-${environment}-dashboard`,
      }
    );

    // Grant ECR pull permissions (needed even when using placeholder images
    // because pipeline will update to use ECR images)
    dashboardRepository.grantPull(dashboardTaskDef.obtainExecutionRole());

    // Grant ECR authorization (required for pulling from any ECR, must be resource: *)
    dashboardTaskDef.obtainExecutionRole().addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    );

    // Grant dashboard access to database secret for Prisma migrations
    databaseSecret.grantRead(dashboardTaskDef.taskRole);

    // API Keys secret for external services (Anthropic, Stripe, etc.)
    const apiKeysSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'ApiKeysSecret',
      `${projectName}/${environment}/api-keys`
    );
    apiKeysSecret.grantRead(dashboardTaskDef.taskRole);

    const dashboardLogGroup = new logs.LogGroup(this, 'DashboardLogs', {
      logGroupName: `/ecs/${projectName}/${environment}/dashboard`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    // Use placeholder image for initial deployment, pipeline will update
    const usePlaceholder = this.node.tryGetContext('usePlaceholderImages') === 'true';

    dashboardTaskDef.addContainer('dashboard', {
      containerName: 'dashboard',
      image: usePlaceholder
        ? ecs.ContainerImage.fromRegistry('public.ecr.aws/nginx/nginx:alpine')
        : ecs.ContainerImage.fromEcrRepository(dashboardRepository, 'latest'),
      portMappings: [{ containerPort: usePlaceholder ? 80 : 3000 }],
      logging: ecs.LogDrivers.awsLogs({
        logGroup: dashboardLogGroup,
        streamPrefix: 'dashboard',
      }),
      environment: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_URL: `http://api.${projectName}.internal:8000`,
      },
      secrets: usePlaceholder ? undefined : {
        DATABASE_URL: ecs.Secret.fromSecretsManager(databaseSecret, 'connectionString'),
        GITHUB_APP_ID: ecs.Secret.fromSecretsManager(apiKeysSecret, 'GITHUB_APP_ID'),
        GITHUB_APP_INSTALLATION_ID: ecs.Secret.fromSecretsManager(apiKeysSecret, 'GITHUB_APP_INSTALLATION_ID'),
        GITHUB_APP_PRIVATE_KEY: ecs.Secret.fromSecretsManager(apiKeysSecret, 'GITHUB_APP_PRIVATE_KEY'),
        STRIPE_SECRET_KEY: ecs.Secret.fromSecretsManager(apiKeysSecret, 'STRIPE_SECRET_KEY'),
        STRIPE_WEBHOOK_SECRET: ecs.Secret.fromSecretsManager(apiKeysSecret, 'STRIPE_WEBHOOK_SECRET'),
        WORKER_API_KEY: ecs.Secret.fromSecretsManager(apiKeysSecret, 'WORKER_API_KEY'),
      },
      // Health check: rely on ALB target group health check instead of container health check
      // Container health checks were failing despite ALB health checks passing
    });

    // API Task Definition
    const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
      memoryLimitMiB: isProd ? 1024 : 512,
      cpu: isProd ? 512 : 256,
      family: `${projectName}-${environment}-api`,
    });

    // Grant ECR pull permissions
    apiRepository.grantPull(apiTaskDef.obtainExecutionRole());

    // Grant ECR authorization (required for pulling from any ECR, must be resource: *)
    apiTaskDef.obtainExecutionRole().addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    );

    // Grant API access to database secret
    databaseSecret.grantRead(apiTaskDef.taskRole);

    const apiLogGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: `/ecs/${projectName}/${environment}/api`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    apiTaskDef.addContainer('api', {
      containerName: 'api',
      image: usePlaceholder
        ? ecs.ContainerImage.fromRegistry('public.ecr.aws/nginx/nginx:alpine')
        : ecs.ContainerImage.fromEcrRepository(apiRepository, 'latest'),
      portMappings: [{ containerPort: usePlaceholder ? 80 : 8000 }],
      logging: ecs.LogDrivers.awsLogs({
        logGroup: apiLogGroup,
        streamPrefix: 'api',
      }),
      environment: {
        ENVIRONMENT: environment,
        DEBUG: isProd ? 'false' : 'true',
        REDIS_URL: `rediss://${redisCluster.attrRedisEndpointAddress}:6379/0`,
      },
      secrets: usePlaceholder ? undefined : {
        DATABASE_URL: ecs.Secret.fromSecretsManager(databaseSecret, 'connectionString'),
      },
      healthCheck: usePlaceholder ? undefined : {
        command: [
          'CMD-SHELL',
          'curl -f http://127.0.0.1:8000/health || exit 1',
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(30),
        retries: 5,
        startPeriod: cdk.Duration.seconds(180),
      },
    });

    // Dashboard Service
    this.dashboardService = new ecs.FargateService(this, 'DashboardService', {
      cluster: this.cluster,
      serviceName: `${projectName}-${environment}-dashboard`,
      taskDefinition: dashboardTaskDef,
      desiredCount: isProd ? 2 : 1,
      securityGroups: [serviceSG],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      enableExecuteCommand: !isProd,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS,
      },
    });

    // API Service
    this.apiService = new ecs.FargateService(this, 'ApiService', {
      cluster: this.cluster,
      serviceName: `${projectName}-${environment}-api`,
      taskDefinition: apiTaskDef,
      desiredCount: isProd ? 2 : 1,
      securityGroups: [serviceSG],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      enableExecuteCommand: !isProd,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS,
      },
    });

    // Dashboard target group (do not use targets here - use attachToApplicationTargetGroup instead)
    const dashboardTargetGroup = new elbv2.ApplicationTargetGroup(
      this,
      'DashboardTG',
      {
        vpc,
        port: usePlaceholder ? 80 : 3000,
        protocol: elbv2.ApplicationProtocol.HTTP,
        targetType: elbv2.TargetType.IP,
        healthCheck: {
          path: usePlaceholder ? '/' : '/api/health',
          interval: cdk.Duration.seconds(30),
          timeout: cdk.Duration.seconds(10),
          healthyThresholdCount: 2,
          unhealthyThresholdCount: 3,
        },
      }
    );

    // Attach dashboard service to target group (ensures ECS service has correct load balancer binding)
    this.dashboardService.attachToApplicationTargetGroup(dashboardTargetGroup);

    // API target group
    const apiTargetGroup = new elbv2.ApplicationTargetGroup(this, 'ApiTG', {
      vpc,
      port: usePlaceholder ? 80 : 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: usePlaceholder ? '/' : '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // Attach API service to target group
    this.apiService.attachToApplicationTargetGroup(apiTargetGroup);

    // Worker Task Definition (no HTTP server, no port mappings)
    const workerTaskDef = new ecs.FargateTaskDefinition(this, 'WorkerTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      family: `${projectName}-${environment}-worker`,
    });

    // Grant ECR pull permissions
    workerRepository.grantPull(workerTaskDef.obtainExecutionRole());
    workerTaskDef.obtainExecutionRole().addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      })
    );

    // Grant worker access to secrets
    databaseSecret.grantRead(workerTaskDef.taskRole);
    apiKeysSecret.grantRead(workerTaskDef.taskRole);

    const workerLogGroup = new logs.LogGroup(this, 'WorkerLogs', {
      logGroupName: `/ecs/${projectName}/${environment}/worker`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: isProd
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });

    workerTaskDef.addContainer('worker', {
      containerName: 'worker',
      image: usePlaceholder
        ? ecs.ContainerImage.fromRegistry('public.ecr.aws/docker/library/python:3.12-slim')
        : ecs.ContainerImage.fromEcrRepository(workerRepository, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        logGroup: workerLogGroup,
        streamPrefix: 'worker',
      }),
      environment: {
        ENVIRONMENT: environment,
        POLL_INTERVAL_SECONDS: '60',
      },
      secrets: usePlaceholder ? undefined : {
        DATABASE_URL: ecs.Secret.fromSecretsManager(databaseSecret, 'connectionString'),
        ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(apiKeysSecret, 'ANTHROPIC_API_KEY'),
        GITHUB_APP_ID: ecs.Secret.fromSecretsManager(apiKeysSecret, 'GITHUB_APP_ID'),
        GITHUB_APP_INSTALLATION_ID: ecs.Secret.fromSecretsManager(apiKeysSecret, 'GITHUB_APP_INSTALLATION_ID'),
        GITHUB_APP_PRIVATE_KEY: ecs.Secret.fromSecretsManager(apiKeysSecret, 'GITHUB_APP_PRIVATE_KEY'),
      },
      // No health check - worker has no HTTP server
      // No port mappings - worker is not a web service
      command: usePlaceholder ? ['sleep', 'infinity'] : undefined,
    });

    // Worker Service (single instance, no ALB)
    this.workerService = new ecs.FargateService(this, 'WorkerService', {
      cluster: this.cluster,
      serviceName: `${projectName}-${environment}-worker`,
      taskDefinition: workerTaskDef,
      desiredCount: 1,
      securityGroups: [serviceSG],
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      enableExecuteCommand: !isProd,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      deploymentController: {
        type: ecs.DeploymentControllerType.ECS,
      },
    });

    // Import existing Cognito user pool (enkai-dev) for authentication
    const cognitoUserPool = cognito.UserPool.fromUserPoolId(
      this,
      'CognitoUserPool',
      this.node.tryGetContext('cognitoUserPoolId')
    );

    // Import existing user pool client
    const cognitoClient = cognito.UserPoolClient.fromUserPoolClientId(
      this,
      'CognitoClient',
      this.node.tryGetContext('cognitoClientId')
    );

    // Import ACM certificate for enkai-qualify.digitaldevops.io
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'Certificate',
      this.node.tryGetContext('certificateArn')
    );

    // HTTPS Listener with Cognito authentication
    const httpsListener = this.alb.addListener('HttpsListener', {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [certificate],
      open: true,
    });

    // Add Cognito authentication + forward to dashboard
    httpsListener.addAction('CognitoAuth', {
      action: new elbv2Actions.AuthenticateCognitoAction({
        userPool: cognitoUserPool,
        userPoolClient: cognitoClient,
        userPoolDomain: cognito.UserPoolDomain.fromDomainName(this, 'CognitoDomain', 'enkai-dev'),
        onUnauthenticatedRequest: elbv2.UnauthenticatedAction.AUTHENTICATE,
        scope: 'openid email profile',
        sessionTimeout: cdk.Duration.hours(8),
        next: elbv2.ListenerAction.forward([dashboardTargetGroup]),
      }),
    });

    // Internal API routes bypass Cognito auth (worker callback endpoints)
    // Security: restrict to VPC CIDR so only internal services can reach these
    // endpoints via the ALB. Application-level auth (WORKER_API_KEY) provides
    // additional defense-in-depth — see dashboard/lib/internal-auth.ts
    httpsListener.addAction('InternalApiRoute', {
      priority: 5,
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/api/internal/*']),
        elbv2.ListenerCondition.sourceIps([vpc.vpcCidrBlock]),
      ],
      action: elbv2.ListenerAction.forward([dashboardTargetGroup]),
    });

    // Add API route rule (before Cognito auth, priority 10)
    httpsListener.addAction('ApiRoute', {
      priority: 10,
      conditions: [elbv2.ListenerCondition.pathPatterns(['/api/v1/*', '/health'])],
      action: elbv2.ListenerAction.forward([apiTargetGroup]),
    });

    // HTTP Listener - always redirect to HTTPS
    httpListener.addAction('RedirectToHttps', {
      action: elbv2.ListenerAction.redirect({
        protocol: 'HTTPS',
        port: '443',
        permanent: true,
      }),
    });

    // Auto-scaling for production
    if (isProd) {
      const dashboardScaling = this.dashboardService.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10,
      });
      dashboardScaling.scaleOnCpuUtilization('CpuScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });

      const apiScaling = this.apiService.autoScaleTaskCount({
        minCapacity: 2,
        maxCapacity: 10,
      });
      apiScaling.scaleOnCpuUtilization('CpuScaling', {
        targetUtilizationPercent: 70,
        scaleInCooldown: cdk.Duration.seconds(60),
        scaleOutCooldown: cdk.Duration.seconds(60),
      });
    }

    // Outputs
    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: this.alb.loadBalancerDnsName,
      description: 'ALB DNS name',
      exportName: `${projectName}-${environment}-alb-dns`,
    });

    new cdk.CfnOutput(this, 'ClusterArn', {
      value: this.cluster.clusterArn,
      description: 'ECS cluster ARN',
      exportName: `${projectName}-${environment}-cluster-arn`,
    });

    new cdk.CfnOutput(this, 'DashboardServiceArn', {
      value: this.dashboardService.serviceArn,
      description: 'Dashboard service ARN',
      exportName: `${projectName}-${environment}-dashboard-service-arn`,
    });

    new cdk.CfnOutput(this, 'ApiServiceArn', {
      value: this.apiService.serviceArn,
      description: 'API service ARN',
      exportName: `${projectName}-${environment}-api-service-arn`,
    });

    new cdk.CfnOutput(this, 'WorkerServiceArn', {
      value: this.workerService.serviceArn,
      description: 'Worker service ARN',
      exportName: `${projectName}-${environment}-worker-service-arn`,
    });

    // CloudWatch Alarms (production only)
    if (isProd) {
      // ALB 5xx error rate alarm
      new cloudwatch.Alarm(this, 'Alb5xxAlarm', {
        alarmName: `${projectName}-${environment}-alb-5xx-errors`,
        alarmDescription: 'ALB is returning elevated 5xx errors',
        metric: this.alb.metrics.httpCodeElb(
          elbv2.HttpCodeElb.ELB_5XX_COUNT,
          {
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
          },
        ),
        threshold: 10,
        evaluationPeriods: 3,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // ECS API service CPU utilization alarm
      new cloudwatch.Alarm(this, 'ApiCpuAlarm', {
        alarmName: `${projectName}-${environment}-api-cpu-high`,
        alarmDescription: 'API service CPU utilization exceeds 80%',
        metric: this.apiService.metricCpuUtilization({
          period: cdk.Duration.minutes(5),
          statistic: 'Average',
        }),
        threshold: 80,
        evaluationPeriods: 3,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    }
  }
}
