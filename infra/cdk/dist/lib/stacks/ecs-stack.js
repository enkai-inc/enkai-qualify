"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EcsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const elbv2 = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2"));
const elbv2Actions = __importStar(require("aws-cdk-lib/aws-elasticloadbalancingv2-actions"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
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
class EcsStack extends cdk.Stack {
    cluster;
    dashboardService;
    apiService;
    alb;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { projectName, environment, vpc, dashboardRepository, apiRepository, databaseSecret, redisCluster, } = props;
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
        serviceSG.addIngressRule(ec2.Peer.securityGroupId(this.alb.connections.securityGroups[0].securityGroupId), ec2.Port.tcp(3000), 'Allow ALB to dashboard');
        serviceSG.addIngressRule(ec2.Peer.securityGroupId(this.alb.connections.securityGroups[0].securityGroupId), ec2.Port.tcp(8000), 'Allow ALB to API');
        // Dashboard Task Definition
        const dashboardTaskDef = new ecs.FargateTaskDefinition(this, 'DashboardTaskDef', {
            memoryLimitMiB: isProd ? 1024 : 512,
            cpu: isProd ? 512 : 256,
            family: `${projectName}-${environment}-dashboard`,
        });
        // Grant ECR pull permissions (needed even when using placeholder images
        // because pipeline will update to use ECR images)
        dashboardRepository.grantPull(dashboardTaskDef.obtainExecutionRole());
        // Grant ECR authorization (required for pulling from any ECR, must be resource: *)
        dashboardTaskDef.obtainExecutionRole().addToPrincipalPolicy(new iam.PolicyStatement({
            actions: ['ecr:GetAuthorizationToken'],
            resources: ['*'],
        }));
        // Grant dashboard access to database secret for Prisma migrations
        databaseSecret.grantRead(dashboardTaskDef.taskRole);
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
        apiTaskDef.obtainExecutionRole().addToPrincipalPolicy(new iam.PolicyStatement({
            actions: ['ecr:GetAuthorizationToken'],
            resources: ['*'],
        }));
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
                REDIS_URL: `redis://${redisCluster.attrRedisEndpointAddress}:6379/0`,
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
            enableExecuteCommand: true,
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
            enableExecuteCommand: true,
            circuitBreaker: { rollback: true },
            minHealthyPercent: 100,
            maxHealthyPercent: 200,
            deploymentController: {
                type: ecs.DeploymentControllerType.ECS,
            },
        });
        // Dashboard target group (do not use targets here - use attachToApplicationTargetGroup instead)
        const dashboardTargetGroup = new elbv2.ApplicationTargetGroup(this, 'DashboardTG', {
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
        });
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
        // Import existing Cognito user pool (enkai-dev) for authentication
        const cognitoUserPool = cognito.UserPool.fromUserPoolId(this, 'CognitoUserPool', 'us-east-1_zlw7qsJMJ');
        // Import existing user pool client
        const cognitoClient = cognito.UserPoolClient.fromUserPoolClientId(this, 'CognitoClient', '2qcaf479drm0tg372mnm8upjfr');
        // Import ACM certificate for metis.digitaldevops.io
        const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', 'arn:aws:acm:us-east-1:882384879235:certificate/b846e9b3-2a34-4599-90c8-2ebf5e1bb2c2');
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
                sessionTimeout: cdk.Duration.days(7),
                next: elbv2.ListenerAction.forward([dashboardTargetGroup]),
            }),
        });
        // Add API route rule (before Cognito auth, priority 10)
        httpsListener.addAction('ApiRoute', {
            priority: 10,
            conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*', '/health', '/docs', '/redoc'])],
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
    }
}
exports.EcsStack = EcsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3N0YWNrcy9lY3Mtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFFM0MsOEVBQWdFO0FBQ2hFLDZGQUErRTtBQUMvRSx5REFBMkM7QUFDM0MsMkRBQTZDO0FBRzdDLGlFQUFtRDtBQUNuRCx3RUFBMEQ7QUFhMUQ7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSxRQUFTLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDckIsT0FBTyxDQUFjO0lBQ3JCLGdCQUFnQixDQUFxQjtJQUNyQyxVQUFVLENBQXFCO0lBQy9CLEdBQUcsQ0FBZ0M7SUFFbkQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFvQjtRQUM1RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQ0osV0FBVyxFQUNYLFdBQVcsRUFDWCxHQUFHLEVBQ0gsbUJBQW1CLEVBQ25CLGFBQWEsRUFDYixjQUFjLEVBQ2QsWUFBWSxHQUNiLEdBQUcsS0FBSyxDQUFDO1FBQ1YsTUFBTSxNQUFNLEdBQUcsV0FBVyxLQUFLLE1BQU0sQ0FBQztRQUV0QyxjQUFjO1FBQ2QsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUM5QyxXQUFXLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxVQUFVO1lBQ3BELEdBQUc7WUFDSCxtQkFBbUIsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRO1NBQzdGLENBQUMsQ0FBQztRQUVILDRCQUE0QjtRQUM1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LENBQUMsR0FBRyxDQUFDLG1CQUFtQjtZQUNuQyxXQUFXLEVBQUUsY0FBYztZQUMzQixVQUFVLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxVQUFVO1NBQ3BELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVU7WUFDOUIsV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixVQUFVLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxjQUFjO1NBQ3hELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDN0MsS0FBSyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO1lBQ3ZDLFdBQVcsRUFBRSx1QkFBdUI7WUFDcEMsVUFBVSxFQUFFLEdBQUcsV0FBVyxJQUFJLFdBQVcsd0JBQXdCO1NBQ2xFLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVU7WUFDakMsV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixVQUFVLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxrQkFBa0I7U0FDNUQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBL1dELDRCQStXQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBlY3IgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcic7XG5pbXBvcnQgKiBhcyBlbGJ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2xvYWRiYWxhbmNpbmd2Mic7XG5pbXBvcnQgKiBhcyBlbGJ2MkFjdGlvbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNsb2FkYmFsYW5jaW5ndjItYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBlbGFzdGljYWNoZSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2FjaGUnO1xuaW1wb3J0ICogYXMgY29nbml0byBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29nbml0byc7XG5pbXBvcnQgKiBhcyBhY20gZnJvbSAnYXdzLWNkay1saWIvYXdzLWNlcnRpZmljYXRlbWFuYWdlcic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBFY3NTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICB2cGM6IGVjMi5WcGM7XG4gIGRhc2hib2FyZFJlcG9zaXRvcnk6IGVjci5SZXBvc2l0b3J5O1xuICBhcGlSZXBvc2l0b3J5OiBlY3IuUmVwb3NpdG9yeTtcbiAgZGF0YWJhc2VTZWNyZXQ6IHNlY3JldHNtYW5hZ2VyLlNlY3JldDtcbiAgcmVkaXNDbHVzdGVyOiBlbGFzdGljYWNoZS5DZm5DYWNoZUNsdXN0ZXI7XG59XG5cbi8qKlxuICogRUNTIFN0YWNrIC0gRmFyZ2F0ZSBjbHVzdGVyLCBzZXJ2aWNlcywgYW5kIEFMQlxuICpcbiAqIENyZWF0ZXM6XG4gKiAtIEVDUyBGYXJnYXRlIGNsdXN0ZXJcbiAqIC0gQXBwbGljYXRpb24gTG9hZCBCYWxhbmNlclxuICogLSBEYXNoYm9hcmQgc2VydmljZSAoTmV4dC5qcyBvbiBwb3J0IDMwMDApXG4gKiAtIEFQSSBzZXJ2aWNlIChGYXN0QVBJIG9uIHBvcnQgODAwMClcbiAqIC0gVGFzayBkZWZpbml0aW9ucyB3aXRoIHByb3BlciBJQU0gcm9sZXNcbiAqL1xuZXhwb3J0IGNsYXNzIEVjc1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGNsdXN0ZXI6IGVjcy5DbHVzdGVyO1xuICBwdWJsaWMgcmVhZG9ubHkgZGFzaGJvYXJkU2VydmljZTogZWNzLkZhcmdhdGVTZXJ2aWNlO1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpU2VydmljZTogZWNzLkZhcmdhdGVTZXJ2aWNlO1xuICBwdWJsaWMgcmVhZG9ubHkgYWxiOiBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRWNzU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3Qge1xuICAgICAgcHJvamVjdE5hbWUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIHZwYyxcbiAgICAgIGRhc2hib2FyZFJlcG9zaXRvcnksXG4gICAgICBhcGlSZXBvc2l0b3J5LFxuICAgICAgZGF0YWJhc2VTZWNyZXQsXG4gICAgICByZWRpc0NsdXN0ZXIsXG4gICAgfSA9IHByb3BzO1xuICAgIGNvbnN0IGlzUHJvZCA9IGVudmlyb25tZW50ID09PSAncHJvZCc7XG5cbiAgICAvLyBFQ1MgQ2x1c3RlclxuICAgIHRoaXMuY2x1c3RlciA9IG5ldyBlY3MuQ2x1c3Rlcih0aGlzLCAnQ2x1c3RlcicsIHtcbiAgICAgIGNsdXN0ZXJOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tY2x1c3RlcmAsXG4gICAgICB2cGMsXG4gICAgICBjb250YWluZXJJbnNpZ2h0c1YyOiBpc1Byb2QgPyBlY3MuQ29udGFpbmVySW5zaWdodHMuRU5BQkxFRCA6IGVjcy5Db250YWluZXJJbnNpZ2h0cy5ESVNBQkxFRCxcbiAgICB9KTtcblxuICAgIC8vIEFwcGxpY2F0aW9uIExvYWQgQmFsYW5jZXJcbiAgICB0aGlzLmFsYiA9IG5ldyBlbGJ2Mi5BcHBsaWNhdGlvbkxvYWRCYWxhbmNlcih0aGlzLCAnQUxCJywge1xuICAgICAgdnBjLFxuICAgICAgaW50ZXJuZXRGYWNpbmc6IHRydWUsXG4gICAgICBsb2FkQmFsYW5jZXJOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tYWxiYCxcbiAgICAgIHNlY3VyaXR5R3JvdXA6IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnQWxiU0cnLCB7XG4gICAgICAgIHZwYyxcbiAgICAgICAgc2VjdXJpdHlHcm91cE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1hbGItc2dgLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBBTEInLFxuICAgICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgICAgfSksXG4gICAgfSk7XG5cbiAgICAvLyBBbGxvdyBIVFRQL0hUVFBTIHRyYWZmaWMgdG8gQUxCXG4gICAgdGhpcy5hbGIuY29ubmVjdGlvbnMuYWxsb3dGcm9tQW55SXB2NChlYzIuUG9ydC50Y3AoODApKTtcbiAgICB0aGlzLmFsYi5jb25uZWN0aW9ucy5hbGxvd0Zyb21BbnlJcHY0KGVjMi5Qb3J0LnRjcCg0NDMpKTtcblxuICAgIC8vIEhUVFAgTGlzdGVuZXIgLSBkZWZhdWx0IGFjdGlvbiBzZXQgbGF0ZXIgYmFzZWQgb24gZW52aXJvbm1lbnRcbiAgICBjb25zdCBodHRwTGlzdGVuZXIgPSB0aGlzLmFsYi5hZGRMaXN0ZW5lcignSHR0cExpc3RlbmVyJywge1xuICAgICAgcG9ydDogODAsXG4gICAgICBvcGVuOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gU2VydmljZSBzZWN1cml0eSBncm91cFxuICAgIGNvbnN0IHNlcnZpY2VTRyA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnU2VydmljZVNHJywge1xuICAgICAgdnBjLFxuICAgICAgc2VjdXJpdHlHcm91cE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1zZXJ2aWNlLXNnYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIEVDUyBzZXJ2aWNlcycsXG4gICAgICBhbGxvd0FsbE91dGJvdW5kOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gQWxsb3cgQUxCIHRvIHJlYWNoIHNlcnZpY2VzXG4gICAgc2VydmljZVNHLmFkZEluZ3Jlc3NSdWxlKFxuICAgICAgZWMyLlBlZXIuc2VjdXJpdHlHcm91cElkKHRoaXMuYWxiLmNvbm5lY3Rpb25zLnNlY3VyaXR5R3JvdXBzWzBdLnNlY3VyaXR5R3JvdXBJZCksXG4gICAgICBlYzIuUG9ydC50Y3AoMzAwMCksXG4gICAgICAnQWxsb3cgQUxCIHRvIGRhc2hib2FyZCdcbiAgICApO1xuICAgIHNlcnZpY2VTRy5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLnNlY3VyaXR5R3JvdXBJZCh0aGlzLmFsYi5jb25uZWN0aW9ucy5zZWN1cml0eUdyb3Vwc1swXS5zZWN1cml0eUdyb3VwSWQpLFxuICAgICAgZWMyLlBvcnQudGNwKDgwMDApLFxuICAgICAgJ0FsbG93IEFMQiB0byBBUEknXG4gICAgKTtcblxuICAgIC8vIERhc2hib2FyZCBUYXNrIERlZmluaXRpb25cbiAgICBjb25zdCBkYXNoYm9hcmRUYXNrRGVmID0gbmV3IGVjcy5GYXJnYXRlVGFza0RlZmluaXRpb24oXG4gICAgICB0aGlzLFxuICAgICAgJ0Rhc2hib2FyZFRhc2tEZWYnLFxuICAgICAge1xuICAgICAgICBtZW1vcnlMaW1pdE1pQjogaXNQcm9kID8gMTAyNCA6IDUxMixcbiAgICAgICAgY3B1OiBpc1Byb2QgPyA1MTIgOiAyNTYsXG4gICAgICAgIGZhbWlseTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWRhc2hib2FyZGAsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEdyYW50IEVDUiBwdWxsIHBlcm1pc3Npb25zIChuZWVkZWQgZXZlbiB3aGVuIHVzaW5nIHBsYWNlaG9sZGVyIGltYWdlc1xuICAgIC8vIGJlY2F1c2UgcGlwZWxpbmUgd2lsbCB1cGRhdGUgdG8gdXNlIEVDUiBpbWFnZXMpXG4gICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5ncmFudFB1bGwoZGFzaGJvYXJkVGFza0RlZi5vYnRhaW5FeGVjdXRpb25Sb2xlKCkpO1xuXG4gICAgLy8gR3JhbnQgRUNSIGF1dGhvcml6YXRpb24gKHJlcXVpcmVkIGZvciBwdWxsaW5nIGZyb20gYW55IEVDUiwgbXVzdCBiZSByZXNvdXJjZTogKilcbiAgICBkYXNoYm9hcmRUYXNrRGVmLm9idGFpbkV4ZWN1dGlvblJvbGUoKS5hZGRUb1ByaW5jaXBhbFBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgYWN0aW9uczogWydlY3I6R2V0QXV0aG9yaXphdGlvblRva2VuJ10sXG4gICAgICAgIHJlc291cmNlczogWycqJ10sXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBkYXNoYm9hcmQgYWNjZXNzIHRvIGRhdGFiYXNlIHNlY3JldCBmb3IgUHJpc21hIG1pZ3JhdGlvbnNcbiAgICBkYXRhYmFzZVNlY3JldC5ncmFudFJlYWQoZGFzaGJvYXJkVGFza0RlZi50YXNrUm9sZSk7XG5cbiAgICBjb25zdCBkYXNoYm9hcmRMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdEYXNoYm9hcmRMb2dzJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2Vjcy8ke3Byb2plY3ROYW1lfS8ke2Vudmlyb25tZW50fS9kYXNoYm9hcmRgLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgcmVtb3ZhbFBvbGljeTogaXNQcm9kXG4gICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIFVzZSBwbGFjZWhvbGRlciBpbWFnZSBmb3IgaW5pdGlhbCBkZXBsb3ltZW50LCBwaXBlbGluZSB3aWxsIHVwZGF0ZVxuICAgIGNvbnN0IHVzZVBsYWNlaG9sZGVyID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoJ3VzZVBsYWNlaG9sZGVySW1hZ2VzJykgPT09ICd0cnVlJztcblxuICAgIGRhc2hib2FyZFRhc2tEZWYuYWRkQ29udGFpbmVyKCdkYXNoYm9hcmQnLCB7XG4gICAgICBjb250YWluZXJOYW1lOiAnZGFzaGJvYXJkJyxcbiAgICAgIGltYWdlOiB1c2VQbGFjZWhvbGRlclxuICAgICAgICA/IGVjcy5Db250YWluZXJJbWFnZS5mcm9tUmVnaXN0cnkoJ3B1YmxpYy5lY3IuYXdzL25naW54L25naW54OmFscGluZScpXG4gICAgICAgIDogZWNzLkNvbnRhaW5lckltYWdlLmZyb21FY3JSZXBvc2l0b3J5KGRhc2hib2FyZFJlcG9zaXRvcnksICdsYXRlc3QnKSxcbiAgICAgIHBvcnRNYXBwaW5nczogW3sgY29udGFpbmVyUG9ydDogdXNlUGxhY2Vob2xkZXIgPyA4MCA6IDMwMDAgfV0sXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHtcbiAgICAgICAgbG9nR3JvdXA6IGRhc2hib2FyZExvZ0dyb3VwLFxuICAgICAgICBzdHJlYW1QcmVmaXg6ICdkYXNoYm9hcmQnLFxuICAgICAgfSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBOT0RFX0VOVjogJ3Byb2R1Y3Rpb24nLFxuICAgICAgICBORVhUX1BVQkxJQ19BUElfVVJMOiBgaHR0cDovL2FwaS4ke3Byb2plY3ROYW1lfS5pbnRlcm5hbDo4MDAwYCxcbiAgICAgIH0sXG4gICAgICBzZWNyZXRzOiB1c2VQbGFjZWhvbGRlciA/IHVuZGVmaW5lZCA6IHtcbiAgICAgICAgREFUQUJBU0VfVVJMOiBlY3MuU2VjcmV0LmZyb21TZWNyZXRzTWFuYWdlcihkYXRhYmFzZVNlY3JldCwgJ2Nvbm5lY3Rpb25TdHJpbmcnKSxcbiAgICAgIH0sXG4gICAgICAvLyBIZWFsdGggY2hlY2s6IHJlbHkgb24gQUxCIHRhcmdldCBncm91cCBoZWFsdGggY2hlY2sgaW5zdGVhZCBvZiBjb250YWluZXIgaGVhbHRoIGNoZWNrXG4gICAgICAvLyBDb250YWluZXIgaGVhbHRoIGNoZWNrcyB3ZXJlIGZhaWxpbmcgZGVzcGl0ZSBBTEIgaGVhbHRoIGNoZWNrcyBwYXNzaW5nXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgVGFzayBEZWZpbml0aW9uXG4gICAgY29uc3QgYXBpVGFza0RlZiA9IG5ldyBlY3MuRmFyZ2F0ZVRhc2tEZWZpbml0aW9uKHRoaXMsICdBcGlUYXNrRGVmJywge1xuICAgICAgbWVtb3J5TGltaXRNaUI6IGlzUHJvZCA/IDEwMjQgOiA1MTIsXG4gICAgICBjcHU6IGlzUHJvZCA/IDUxMiA6IDI1NixcbiAgICAgIGZhbWlseTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFwaWAsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBFQ1IgcHVsbCBwZXJtaXNzaW9uc1xuICAgIGFwaVJlcG9zaXRvcnkuZ3JhbnRQdWxsKGFwaVRhc2tEZWYub2J0YWluRXhlY3V0aW9uUm9sZSgpKTtcblxuICAgIC8vIEdyYW50IEVDUiBhdXRob3JpemF0aW9uIChyZXF1aXJlZCBmb3IgcHVsbGluZyBmcm9tIGFueSBFQ1IsIG11c3QgYmUgcmVzb3VyY2U6ICopXG4gICAgYXBpVGFza0RlZi5vYnRhaW5FeGVjdXRpb25Sb2xlKCkuYWRkVG9QcmluY2lwYWxQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGFjdGlvbnM6IFsnZWNyOkdldEF1dGhvcml6YXRpb25Ub2tlbiddLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gR3JhbnQgQVBJIGFjY2VzcyB0byBkYXRhYmFzZSBzZWNyZXRcbiAgICBkYXRhYmFzZVNlY3JldC5ncmFudFJlYWQoYXBpVGFza0RlZi50YXNrUm9sZSk7XG5cbiAgICBjb25zdCBhcGlMb2dHcm91cCA9IG5ldyBsb2dzLkxvZ0dyb3VwKHRoaXMsICdBcGlMb2dzJywge1xuICAgICAgbG9nR3JvdXBOYW1lOiBgL2Vjcy8ke3Byb2plY3ROYW1lfS8ke2Vudmlyb25tZW50fS9hcGlgLFxuICAgICAgcmV0ZW50aW9uOiBsb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgICAgcmVtb3ZhbFBvbGljeTogaXNQcm9kXG4gICAgICAgID8gY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOXG4gICAgICAgIDogY2RrLlJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIGFwaVRhc2tEZWYuYWRkQ29udGFpbmVyKCdhcGknLCB7XG4gICAgICBjb250YWluZXJOYW1lOiAnYXBpJyxcbiAgICAgIGltYWdlOiB1c2VQbGFjZWhvbGRlclxuICAgICAgICA/IGVjcy5Db250YWluZXJJbWFnZS5mcm9tUmVnaXN0cnkoJ3B1YmxpYy5lY3IuYXdzL25naW54L25naW54OmFscGluZScpXG4gICAgICAgIDogZWNzLkNvbnRhaW5lckltYWdlLmZyb21FY3JSZXBvc2l0b3J5KGFwaVJlcG9zaXRvcnksICdsYXRlc3QnKSxcbiAgICAgIHBvcnRNYXBwaW5nczogW3sgY29udGFpbmVyUG9ydDogdXNlUGxhY2Vob2xkZXIgPyA4MCA6IDgwMDAgfV0sXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHtcbiAgICAgICAgbG9nR3JvdXA6IGFwaUxvZ0dyb3VwLFxuICAgICAgICBzdHJlYW1QcmVmaXg6ICdhcGknLFxuICAgICAgfSksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBFTlZJUk9OTUVOVDogZW52aXJvbm1lbnQsXG4gICAgICAgIERFQlVHOiBpc1Byb2QgPyAnZmFsc2UnIDogJ3RydWUnLFxuICAgICAgICBSRURJU19VUkw6IGByZWRpczovLyR7cmVkaXNDbHVzdGVyLmF0dHJSZWRpc0VuZHBvaW50QWRkcmVzc306NjM3OS8wYCxcbiAgICAgIH0sXG4gICAgICBzZWNyZXRzOiB1c2VQbGFjZWhvbGRlciA/IHVuZGVmaW5lZCA6IHtcbiAgICAgICAgREFUQUJBU0VfVVJMOiBlY3MuU2VjcmV0LmZyb21TZWNyZXRzTWFuYWdlcihkYXRhYmFzZVNlY3JldCwgJ2Nvbm5lY3Rpb25TdHJpbmcnKSxcbiAgICAgIH0sXG4gICAgICBoZWFsdGhDaGVjazogdXNlUGxhY2Vob2xkZXIgPyB1bmRlZmluZWQgOiB7XG4gICAgICAgIGNvbW1hbmQ6IFtcbiAgICAgICAgICAnQ01ELVNIRUxMJyxcbiAgICAgICAgICAnY3VybCAtZiBodHRwOi8vMTI3LjAuMC4xOjgwMDAvaGVhbHRoIHx8IGV4aXQgMScsXG4gICAgICAgIF0sXG4gICAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDMwKSxcbiAgICAgICAgcmV0cmllczogNSxcbiAgICAgICAgc3RhcnRQZXJpb2Q6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDE4MCksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gRGFzaGJvYXJkIFNlcnZpY2VcbiAgICB0aGlzLmRhc2hib2FyZFNlcnZpY2UgPSBuZXcgZWNzLkZhcmdhdGVTZXJ2aWNlKHRoaXMsICdEYXNoYm9hcmRTZXJ2aWNlJywge1xuICAgICAgY2x1c3RlcjogdGhpcy5jbHVzdGVyLFxuICAgICAgc2VydmljZU5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1kYXNoYm9hcmRgLFxuICAgICAgdGFza0RlZmluaXRpb246IGRhc2hib2FyZFRhc2tEZWYsXG4gICAgICBkZXNpcmVkQ291bnQ6IGlzUHJvZCA/IDIgOiAxLFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtzZXJ2aWNlU0ddLFxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXG4gICAgICBlbmFibGVFeGVjdXRlQ29tbWFuZDogdHJ1ZSxcbiAgICAgIGNpcmN1aXRCcmVha2VyOiB7IHJvbGxiYWNrOiB0cnVlIH0sXG4gICAgICBtaW5IZWFsdGh5UGVyY2VudDogMTAwLFxuICAgICAgbWF4SGVhbHRoeVBlcmNlbnQ6IDIwMCxcbiAgICAgIGRlcGxveW1lbnRDb250cm9sbGVyOiB7XG4gICAgICAgIHR5cGU6IGVjcy5EZXBsb3ltZW50Q29udHJvbGxlclR5cGUuRUNTLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBTZXJ2aWNlXG4gICAgdGhpcy5hcGlTZXJ2aWNlID0gbmV3IGVjcy5GYXJnYXRlU2VydmljZSh0aGlzLCAnQXBpU2VydmljZScsIHtcbiAgICAgIGNsdXN0ZXI6IHRoaXMuY2x1c3RlcixcbiAgICAgIHNlcnZpY2VOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tYXBpYCxcbiAgICAgIHRhc2tEZWZpbml0aW9uOiBhcGlUYXNrRGVmLFxuICAgICAgZGVzaXJlZENvdW50OiBpc1Byb2QgPyAyIDogMSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbc2VydmljZVNHXSxcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxuICAgICAgZW5hYmxlRXhlY3V0ZUNvbW1hbmQ6IHRydWUsXG4gICAgICBjaXJjdWl0QnJlYWtlcjogeyByb2xsYmFjazogdHJ1ZSB9LFxuICAgICAgbWluSGVhbHRoeVBlcmNlbnQ6IDEwMCxcbiAgICAgIG1heEhlYWx0aHlQZXJjZW50OiAyMDAsXG4gICAgICBkZXBsb3ltZW50Q29udHJvbGxlcjoge1xuICAgICAgICB0eXBlOiBlY3MuRGVwbG95bWVudENvbnRyb2xsZXJUeXBlLkVDUyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBEYXNoYm9hcmQgdGFyZ2V0IGdyb3VwIChkbyBub3QgdXNlIHRhcmdldHMgaGVyZSAtIHVzZSBhdHRhY2hUb0FwcGxpY2F0aW9uVGFyZ2V0R3JvdXAgaW5zdGVhZClcbiAgICBjb25zdCBkYXNoYm9hcmRUYXJnZXRHcm91cCA9IG5ldyBlbGJ2Mi5BcHBsaWNhdGlvblRhcmdldEdyb3VwKFxuICAgICAgdGhpcyxcbiAgICAgICdEYXNoYm9hcmRURycsXG4gICAgICB7XG4gICAgICAgIHZwYyxcbiAgICAgICAgcG9ydDogdXNlUGxhY2Vob2xkZXIgPyA4MCA6IDMwMDAsXG4gICAgICAgIHByb3RvY29sOiBlbGJ2Mi5BcHBsaWNhdGlvblByb3RvY29sLkhUVFAsXG4gICAgICAgIHRhcmdldFR5cGU6IGVsYnYyLlRhcmdldFR5cGUuSVAsXG4gICAgICAgIGhlYWx0aENoZWNrOiB7XG4gICAgICAgICAgcGF0aDogdXNlUGxhY2Vob2xkZXIgPyAnLycgOiAnL2FwaS9oZWFsdGgnLFxuICAgICAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMTApLFxuICAgICAgICAgIGhlYWx0aHlUaHJlc2hvbGRDb3VudDogMixcbiAgICAgICAgICB1bmhlYWx0aHlUaHJlc2hvbGRDb3VudDogMyxcbiAgICAgICAgfSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgLy8gQXR0YWNoIGRhc2hib2FyZCBzZXJ2aWNlIHRvIHRhcmdldCBncm91cCAoZW5zdXJlcyBFQ1Mgc2VydmljZSBoYXMgY29ycmVjdCBsb2FkIGJhbGFuY2VyIGJpbmRpbmcpXG4gICAgdGhpcy5kYXNoYm9hcmRTZXJ2aWNlLmF0dGFjaFRvQXBwbGljYXRpb25UYXJnZXRHcm91cChkYXNoYm9hcmRUYXJnZXRHcm91cCk7XG5cbiAgICAvLyBBUEkgdGFyZ2V0IGdyb3VwXG4gICAgY29uc3QgYXBpVGFyZ2V0R3JvdXAgPSBuZXcgZWxidjIuQXBwbGljYXRpb25UYXJnZXRHcm91cCh0aGlzLCAnQXBpVEcnLCB7XG4gICAgICB2cGMsXG4gICAgICBwb3J0OiB1c2VQbGFjZWhvbGRlciA/IDgwIDogODAwMCxcbiAgICAgIHByb3RvY29sOiBlbGJ2Mi5BcHBsaWNhdGlvblByb3RvY29sLkhUVFAsXG4gICAgICB0YXJnZXRUeXBlOiBlbGJ2Mi5UYXJnZXRUeXBlLklQLFxuICAgICAgaGVhbHRoQ2hlY2s6IHtcbiAgICAgICAgcGF0aDogdXNlUGxhY2Vob2xkZXIgPyAnLycgOiAnL2hlYWx0aCcsXG4gICAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgICAgaGVhbHRoeVRocmVzaG9sZENvdW50OiAyLFxuICAgICAgICB1bmhlYWx0aHlUaHJlc2hvbGRDb3VudDogMyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBBdHRhY2ggQVBJIHNlcnZpY2UgdG8gdGFyZ2V0IGdyb3VwXG4gICAgdGhpcy5hcGlTZXJ2aWNlLmF0dGFjaFRvQXBwbGljYXRpb25UYXJnZXRHcm91cChhcGlUYXJnZXRHcm91cCk7XG5cbiAgICAvLyBJbXBvcnQgZXhpc3RpbmcgQ29nbml0byB1c2VyIHBvb2wgKGVua2FpLWRldikgZm9yIGF1dGhlbnRpY2F0aW9uXG4gICAgY29uc3QgY29nbml0b1VzZXJQb29sID0gY29nbml0by5Vc2VyUG9vbC5mcm9tVXNlclBvb2xJZChcbiAgICAgIHRoaXMsXG4gICAgICAnQ29nbml0b1VzZXJQb29sJyxcbiAgICAgICd1cy1lYXN0LTFfemx3N3FzSk1KJ1xuICAgICk7XG5cbiAgICAvLyBJbXBvcnQgZXhpc3RpbmcgdXNlciBwb29sIGNsaWVudFxuICAgIGNvbnN0IGNvZ25pdG9DbGllbnQgPSBjb2duaXRvLlVzZXJQb29sQ2xpZW50LmZyb21Vc2VyUG9vbENsaWVudElkKFxuICAgICAgdGhpcyxcbiAgICAgICdDb2duaXRvQ2xpZW50JyxcbiAgICAgICcycWNhZjQ3OWRybTB0ZzM3Mm1ubTh1cGpmcidcbiAgICApO1xuXG4gICAgLy8gSW1wb3J0IEFDTSBjZXJ0aWZpY2F0ZSBmb3IgbWV0aXMuZGlnaXRhbGRldm9wcy5pb1xuICAgIGNvbnN0IGNlcnRpZmljYXRlID0gYWNtLkNlcnRpZmljYXRlLmZyb21DZXJ0aWZpY2F0ZUFybihcbiAgICAgIHRoaXMsXG4gICAgICAnQ2VydGlmaWNhdGUnLFxuICAgICAgJ2Fybjphd3M6YWNtOnVzLWVhc3QtMTo4ODIzODQ4NzkyMzU6Y2VydGlmaWNhdGUvYjg0NmU5YjMtMmEzNC00NTk5LTkwYzgtMmViZjVlMWJiMmMyJ1xuICAgICk7XG5cbiAgICAvLyBIVFRQUyBMaXN0ZW5lciB3aXRoIENvZ25pdG8gYXV0aGVudGljYXRpb25cbiAgICBjb25zdCBodHRwc0xpc3RlbmVyID0gdGhpcy5hbGIuYWRkTGlzdGVuZXIoJ0h0dHBzTGlzdGVuZXInLCB7XG4gICAgICBwb3J0OiA0NDMsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQUyxcbiAgICAgIGNlcnRpZmljYXRlczogW2NlcnRpZmljYXRlXSxcbiAgICAgIG9wZW46IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBBZGQgQ29nbml0byBhdXRoZW50aWNhdGlvbiArIGZvcndhcmQgdG8gZGFzaGJvYXJkXG4gICAgaHR0cHNMaXN0ZW5lci5hZGRBY3Rpb24oJ0NvZ25pdG9BdXRoJywge1xuICAgICAgYWN0aW9uOiBuZXcgZWxidjJBY3Rpb25zLkF1dGhlbnRpY2F0ZUNvZ25pdG9BY3Rpb24oe1xuICAgICAgICB1c2VyUG9vbDogY29nbml0b1VzZXJQb29sLFxuICAgICAgICB1c2VyUG9vbENsaWVudDogY29nbml0b0NsaWVudCxcbiAgICAgICAgdXNlclBvb2xEb21haW46IGNvZ25pdG8uVXNlclBvb2xEb21haW4uZnJvbURvbWFpbk5hbWUodGhpcywgJ0NvZ25pdG9Eb21haW4nLCAnZW5rYWktZGV2JyksXG4gICAgICAgIG9uVW5hdXRoZW50aWNhdGVkUmVxdWVzdDogZWxidjIuVW5hdXRoZW50aWNhdGVkQWN0aW9uLkFVVEhFTlRJQ0FURSxcbiAgICAgICAgc2NvcGU6ICdvcGVuaWQgZW1haWwgcHJvZmlsZScsXG4gICAgICAgIHNlc3Npb25UaW1lb3V0OiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcbiAgICAgICAgbmV4dDogZWxidjIuTGlzdGVuZXJBY3Rpb24uZm9yd2FyZChbZGFzaGJvYXJkVGFyZ2V0R3JvdXBdKSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gQWRkIEFQSSByb3V0ZSBydWxlIChiZWZvcmUgQ29nbml0byBhdXRoLCBwcmlvcml0eSAxMClcbiAgICBodHRwc0xpc3RlbmVyLmFkZEFjdGlvbignQXBpUm91dGUnLCB7XG4gICAgICBwcmlvcml0eTogMTAsXG4gICAgICBjb25kaXRpb25zOiBbZWxidjIuTGlzdGVuZXJDb25kaXRpb24ucGF0aFBhdHRlcm5zKFsnL2FwaS8qJywgJy9oZWFsdGgnLCAnL2RvY3MnLCAnL3JlZG9jJ10pXSxcbiAgICAgIGFjdGlvbjogZWxidjIuTGlzdGVuZXJBY3Rpb24uZm9yd2FyZChbYXBpVGFyZ2V0R3JvdXBdKSxcbiAgICB9KTtcblxuICAgIC8vIEhUVFAgTGlzdGVuZXIgLSBhbHdheXMgcmVkaXJlY3QgdG8gSFRUUFNcbiAgICBodHRwTGlzdGVuZXIuYWRkQWN0aW9uKCdSZWRpcmVjdFRvSHR0cHMnLCB7XG4gICAgICBhY3Rpb246IGVsYnYyLkxpc3RlbmVyQWN0aW9uLnJlZGlyZWN0KHtcbiAgICAgICAgcHJvdG9jb2w6ICdIVFRQUycsXG4gICAgICAgIHBvcnQ6ICc0NDMnLFxuICAgICAgICBwZXJtYW5lbnQ6IHRydWUsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIEF1dG8tc2NhbGluZyBmb3IgcHJvZHVjdGlvblxuICAgIGlmIChpc1Byb2QpIHtcbiAgICAgIGNvbnN0IGRhc2hib2FyZFNjYWxpbmcgPSB0aGlzLmRhc2hib2FyZFNlcnZpY2UuYXV0b1NjYWxlVGFza0NvdW50KHtcbiAgICAgICAgbWluQ2FwYWNpdHk6IDIsXG4gICAgICAgIG1heENhcGFjaXR5OiAxMCxcbiAgICAgIH0pO1xuICAgICAgZGFzaGJvYXJkU2NhbGluZy5zY2FsZU9uQ3B1VXRpbGl6YXRpb24oJ0NwdVNjYWxpbmcnLCB7XG4gICAgICAgIHRhcmdldFV0aWxpemF0aW9uUGVyY2VudDogNzAsXG4gICAgICAgIHNjYWxlSW5Db29sZG93bjogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgICBzY2FsZU91dENvb2xkb3duOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgYXBpU2NhbGluZyA9IHRoaXMuYXBpU2VydmljZS5hdXRvU2NhbGVUYXNrQ291bnQoe1xuICAgICAgICBtaW5DYXBhY2l0eTogMixcbiAgICAgICAgbWF4Q2FwYWNpdHk6IDEwLFxuICAgICAgfSk7XG4gICAgICBhcGlTY2FsaW5nLnNjYWxlT25DcHVVdGlsaXphdGlvbignQ3B1U2NhbGluZycsIHtcbiAgICAgICAgdGFyZ2V0VXRpbGl6YXRpb25QZXJjZW50OiA3MCxcbiAgICAgICAgc2NhbGVJbkNvb2xkb3duOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICAgIHNjYWxlT3V0Q29vbGRvd246IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxiRG5zTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFsYi5sb2FkQmFsYW5jZXJEbnNOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdBTEIgRE5TIG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFsYi1kbnNgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NsdXN0ZXJBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5jbHVzdGVyLmNsdXN0ZXJBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0VDUyBjbHVzdGVyIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tY2x1c3Rlci1hcm5gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZFNlcnZpY2VBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kYXNoYm9hcmRTZXJ2aWNlLnNlcnZpY2VBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0Rhc2hib2FyZCBzZXJ2aWNlIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZGFzaGJvYXJkLXNlcnZpY2UtYXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlTZXJ2aWNlQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpU2VydmljZS5zZXJ2aWNlQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgc2VydmljZSBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFwaS1zZXJ2aWNlLWFybmAsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==