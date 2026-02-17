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
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
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
            healthCheck: usePlaceholder ? undefined : {
                command: [
                    'CMD-SHELL',
                    "node -e \"require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))\"",
                ],
                interval: cdk.Duration.seconds(30),
                timeout: cdk.Duration.seconds(10),
                retries: 3,
                startPeriod: cdk.Duration.seconds(60),
            },
        });
        // API Task Definition
        const apiTaskDef = new ecs.FargateTaskDefinition(this, 'ApiTaskDef', {
            memoryLimitMiB: isProd ? 1024 : 512,
            cpu: isProd ? 512 : 256,
            family: `${projectName}-${environment}-api`,
        });
        // Grant ECR pull permissions
        apiRepository.grantPull(apiTaskDef.obtainExecutionRole());
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
                    'python -c "import urllib.request; urllib.request.urlopen(\'http://localhost:8000/health\')" || exit 1',
                ],
                interval: cdk.Duration.seconds(30),
                timeout: cdk.Duration.seconds(10),
                retries: 3,
                startPeriod: cdk.Duration.seconds(60),
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
        // Dashboard target group
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
            targets: [this.dashboardService],
        });
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
            targets: [this.apiService],
        });
        // Configure listener rules based on environment
        if (isProd) {
            // Redirect HTTP to HTTPS in production
            httpListener.addAction('RedirectToHttps', {
                action: elbv2.ListenerAction.redirect({
                    protocol: 'HTTPS',
                    port: '443',
                    permanent: true,
                }),
            });
        }
        else {
            // Dev: route API paths to API service, everything else to dashboard
            httpListener.addAction('ApiRoute', {
                priority: 10,
                conditions: [elbv2.ListenerCondition.pathPatterns(['/api/*', '/health', '/docs', '/redoc'])],
                action: elbv2.ListenerAction.forward([apiTargetGroup]),
            });
            // Default: forward to dashboard
            httpListener.addTargetGroups('DefaultTargetGroup', {
                targetGroups: [dashboardTargetGroup],
            });
        }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNzLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3N0YWNrcy9lY3Mtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQyx5REFBMkM7QUFFM0MsOEVBQWdFO0FBQ2hFLDJEQUE2QztBQWU3Qzs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFhLFFBQVMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUNyQixPQUFPLENBQWM7SUFDckIsZ0JBQWdCLENBQXFCO0lBQ3JDLFVBQVUsQ0FBcUI7SUFDL0IsR0FBRyxDQUFnQztJQUVuRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQW9CO1FBQzVELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFDSixXQUFXLEVBQ1gsV0FBVyxFQUNYLEdBQUcsRUFDSCxtQkFBbUIsRUFDbkIsYUFBYSxFQUNiLGNBQWMsRUFDZCxZQUFZLEdBQ2IsR0FBRyxLQUFLLENBQUM7UUFDVixNQUFNLE1BQU0sR0FBRyxXQUFXLEtBQUssTUFBTSxDQUFDO1FBRXRDLGNBQWM7UUFDZCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQzlDLFdBQVcsRUFBRSxHQUFHLFdBQVcsSUFBSSxXQUFXLFVBQVU7WUFDcEQsR0FBRztZQUNILG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLFFBQVE7U0FDN0YsQ0FBQyxDQUFDO1FBRUgsNEJBQTRCO1FBQzVCLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsdUJBQXVCLENBQUMsSUFB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QUksV0FBVyxjQUFjO1NBQ3hELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDN0MsS0FBSyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO1lBQ3ZDLFdBQVcsRUFBRSx1QkFBdUI7WUFDcEMsVUFBVSxFQUFFLEdBQUcsV0FBVyxJQUFJLFdBQVcsd0JBQXdCO1NBQ2xFLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLFVBQVU7WUFDakMsV0FBVyxFQUFFLGlCQUFpQjtZQUM5QixVQUFVLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxrQkFBa0I7U0FDNUQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBM1RELDRCQTJUQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBlY3IgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcic7XG5pbXBvcnQgKiBhcyBlbGJ2MiBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2xvYWRiYWxhbmNpbmd2Mic7XG5pbXBvcnQgKiBhcyBsb2dzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sb2dzJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgKiBhcyBlbGFzdGljYWNoZSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZWxhc3RpY2FjaGUnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRWNzU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbiAgdnBjOiBlYzIuVnBjO1xuICBkYXNoYm9hcmRSZXBvc2l0b3J5OiBlY3IuUmVwb3NpdG9yeTtcbiAgYXBpUmVwb3NpdG9yeTogZWNyLlJlcG9zaXRvcnk7XG4gIGRhdGFiYXNlU2VjcmV0OiBzZWNyZXRzbWFuYWdlci5TZWNyZXQ7XG4gIHJlZGlzQ2x1c3RlcjogZWxhc3RpY2FjaGUuQ2ZuQ2FjaGVDbHVzdGVyO1xufVxuXG4vKipcbiAqIEVDUyBTdGFjayAtIEZhcmdhdGUgY2x1c3Rlciwgc2VydmljZXMsIGFuZCBBTEJcbiAqXG4gKiBDcmVhdGVzOlxuICogLSBFQ1MgRmFyZ2F0ZSBjbHVzdGVyXG4gKiAtIEFwcGxpY2F0aW9uIExvYWQgQmFsYW5jZXJcbiAqIC0gRGFzaGJvYXJkIHNlcnZpY2UgKE5leHQuanMgb24gcG9ydCAzMDAwKVxuICogLSBBUEkgc2VydmljZSAoRmFzdEFQSSBvbiBwb3J0IDgwMDApXG4gKiAtIFRhc2sgZGVmaW5pdGlvbnMgd2l0aCBwcm9wZXIgSUFNIHJvbGVzXG4gKi9cbmV4cG9ydCBjbGFzcyBFY3NTdGFjayBleHRlbmRzIGNkay5TdGFjayB7XG4gIHB1YmxpYyByZWFkb25seSBjbHVzdGVyOiBlY3MuQ2x1c3RlcjtcbiAgcHVibGljIHJlYWRvbmx5IGRhc2hib2FyZFNlcnZpY2U6IGVjcy5GYXJnYXRlU2VydmljZTtcbiAgcHVibGljIHJlYWRvbmx5IGFwaVNlcnZpY2U6IGVjcy5GYXJnYXRlU2VydmljZTtcbiAgcHVibGljIHJlYWRvbmx5IGFsYjogZWxidjIuQXBwbGljYXRpb25Mb2FkQmFsYW5jZXI7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEVjc1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHtcbiAgICAgIHByb2plY3ROYW1lLFxuICAgICAgZW52aXJvbm1lbnQsXG4gICAgICB2cGMsXG4gICAgICBkYXNoYm9hcmRSZXBvc2l0b3J5LFxuICAgICAgYXBpUmVwb3NpdG9yeSxcbiAgICAgIGRhdGFiYXNlU2VjcmV0LFxuICAgICAgcmVkaXNDbHVzdGVyLFxuICAgIH0gPSBwcm9wcztcbiAgICBjb25zdCBpc1Byb2QgPSBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnO1xuXG4gICAgLy8gRUNTIENsdXN0ZXJcbiAgICB0aGlzLmNsdXN0ZXIgPSBuZXcgZWNzLkNsdXN0ZXIodGhpcywgJ0NsdXN0ZXInLCB7XG4gICAgICBjbHVzdGVyTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWNsdXN0ZXJgLFxuICAgICAgdnBjLFxuICAgICAgY29udGFpbmVySW5zaWdodHNWMjogaXNQcm9kID8gZWNzLkNvbnRhaW5lckluc2lnaHRzLkVOQUJMRUQgOiBlY3MuQ29udGFpbmVySW5zaWdodHMuRElTQUJMRUQsXG4gICAgfSk7XG5cbiAgICAvLyBBcHBsaWNhdGlvbiBMb2FkIEJhbGFuY2VyXG4gICAgdGhpcy5hbGIgPSBuZXcgZWxidjIuQXBwbGljYXRpb25Mb2FkQmFsYW5jZXIodGhpcywgJ0FMQicsIHtcbiAgICAgIHZwYyxcbiAgICAgIGludGVybmV0RmFjaW5nOiB0cnVlLFxuICAgICAgbG9hZEJhbGFuY2VyTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFsYmAsXG4gICAgICBzZWN1cml0eUdyb3VwOiBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ0FsYlNHJywge1xuICAgICAgICB2cGMsXG4gICAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tYWxiLXNnYCxcbiAgICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgQUxCJyxcbiAgICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICAgIH0pLFxuICAgIH0pO1xuXG4gICAgLy8gQWxsb3cgSFRUUC9IVFRQUyB0cmFmZmljIHRvIEFMQlxuICAgIHRoaXMuYWxiLmNvbm5lY3Rpb25zLmFsbG93RnJvbUFueUlwdjQoZWMyLlBvcnQudGNwKDgwKSk7XG4gICAgdGhpcy5hbGIuY29ubmVjdGlvbnMuYWxsb3dGcm9tQW55SXB2NChlYzIuUG9ydC50Y3AoNDQzKSk7XG5cbiAgICAvLyBIVFRQIExpc3RlbmVyIC0gZGVmYXVsdCBhY3Rpb24gc2V0IGxhdGVyIGJhc2VkIG9uIGVudmlyb25tZW50XG4gICAgY29uc3QgaHR0cExpc3RlbmVyID0gdGhpcy5hbGIuYWRkTGlzdGVuZXIoJ0h0dHBMaXN0ZW5lcicsIHtcbiAgICAgIHBvcnQ6IDgwLFxuICAgICAgb3BlbjogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFNlcnZpY2Ugc2VjdXJpdHkgZ3JvdXBcbiAgICBjb25zdCBzZXJ2aWNlU0cgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ1NlcnZpY2VTRycsIHtcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tc2VydmljZS1zZ2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NlY3VyaXR5IGdyb3VwIGZvciBFQ1Mgc2VydmljZXMnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIEFsbG93IEFMQiB0byByZWFjaCBzZXJ2aWNlc1xuICAgIHNlcnZpY2VTRy5hZGRJbmdyZXNzUnVsZShcbiAgICAgIGVjMi5QZWVyLnNlY3VyaXR5R3JvdXBJZCh0aGlzLmFsYi5jb25uZWN0aW9ucy5zZWN1cml0eUdyb3Vwc1swXS5zZWN1cml0eUdyb3VwSWQpLFxuICAgICAgZWMyLlBvcnQudGNwKDMwMDApLFxuICAgICAgJ0FsbG93IEFMQiB0byBkYXNoYm9hcmQnXG4gICAgKTtcbiAgICBzZXJ2aWNlU0cuYWRkSW5ncmVzc1J1bGUoXG4gICAgICBlYzIuUGVlci5zZWN1cml0eUdyb3VwSWQodGhpcy5hbGIuY29ubmVjdGlvbnMuc2VjdXJpdHlHcm91cHNbMF0uc2VjdXJpdHlHcm91cElkKSxcbiAgICAgIGVjMi5Qb3J0LnRjcCg4MDAwKSxcbiAgICAgICdBbGxvdyBBTEIgdG8gQVBJJ1xuICAgICk7XG5cbiAgICAvLyBEYXNoYm9hcmQgVGFzayBEZWZpbml0aW9uXG4gICAgY29uc3QgZGFzaGJvYXJkVGFza0RlZiA9IG5ldyBlY3MuRmFyZ2F0ZVRhc2tEZWZpbml0aW9uKFxuICAgICAgdGhpcyxcbiAgICAgICdEYXNoYm9hcmRUYXNrRGVmJyxcbiAgICAgIHtcbiAgICAgICAgbWVtb3J5TGltaXRNaUI6IGlzUHJvZCA/IDEwMjQgOiA1MTIsXG4gICAgICAgIGNwdTogaXNQcm9kID8gNTEyIDogMjU2LFxuICAgICAgICBmYW1pbHk6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1kYXNoYm9hcmRgLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBHcmFudCBFQ1IgcHVsbCBwZXJtaXNzaW9ucyAobmVlZGVkIGV2ZW4gd2hlbiB1c2luZyBwbGFjZWhvbGRlciBpbWFnZXNcbiAgICAvLyBiZWNhdXNlIHBpcGVsaW5lIHdpbGwgdXBkYXRlIHRvIHVzZSBFQ1IgaW1hZ2VzKVxuICAgIGRhc2hib2FyZFJlcG9zaXRvcnkuZ3JhbnRQdWxsKGRhc2hib2FyZFRhc2tEZWYub2J0YWluRXhlY3V0aW9uUm9sZSgpKTtcblxuICAgIGNvbnN0IGRhc2hib2FyZExvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0Rhc2hib2FyZExvZ3MnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvZWNzLyR7cHJvamVjdE5hbWV9LyR7ZW52aXJvbm1lbnR9L2Rhc2hib2FyZGAsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICByZW1vdmFsUG9saWN5OiBpc1Byb2RcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU5cbiAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8gVXNlIHBsYWNlaG9sZGVyIGltYWdlIGZvciBpbml0aWFsIGRlcGxveW1lbnQsIHBpcGVsaW5lIHdpbGwgdXBkYXRlXG4gICAgY29uc3QgdXNlUGxhY2Vob2xkZXIgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgndXNlUGxhY2Vob2xkZXJJbWFnZXMnKSA9PT0gJ3RydWUnO1xuXG4gICAgZGFzaGJvYXJkVGFza0RlZi5hZGRDb250YWluZXIoJ2Rhc2hib2FyZCcsIHtcbiAgICAgIGNvbnRhaW5lck5hbWU6ICdkYXNoYm9hcmQnLFxuICAgICAgaW1hZ2U6IHVzZVBsYWNlaG9sZGVyXG4gICAgICAgID8gZWNzLkNvbnRhaW5lckltYWdlLmZyb21SZWdpc3RyeSgncHVibGljLmVjci5hd3Mvbmdpbngvbmdpbng6YWxwaW5lJylcbiAgICAgICAgOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkoZGFzaGJvYXJkUmVwb3NpdG9yeSwgJ2xhdGVzdCcpLFxuICAgICAgcG9ydE1hcHBpbmdzOiBbeyBjb250YWluZXJQb3J0OiB1c2VQbGFjZWhvbGRlciA/IDgwIDogMzAwMCB9XSxcbiAgICAgIGxvZ2dpbmc6IGVjcy5Mb2dEcml2ZXJzLmF3c0xvZ3Moe1xuICAgICAgICBsb2dHcm91cDogZGFzaGJvYXJkTG9nR3JvdXAsXG4gICAgICAgIHN0cmVhbVByZWZpeDogJ2Rhc2hib2FyZCcsXG4gICAgICB9KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE5PREVfRU5WOiAncHJvZHVjdGlvbicsXG4gICAgICAgIE5FWFRfUFVCTElDX0FQSV9VUkw6IGBodHRwOi8vYXBpLiR7cHJvamVjdE5hbWV9LmludGVybmFsOjgwMDBgLFxuICAgICAgfSxcbiAgICAgIGhlYWx0aENoZWNrOiB1c2VQbGFjZWhvbGRlciA/IHVuZGVmaW5lZCA6IHtcbiAgICAgICAgY29tbWFuZDogW1xuICAgICAgICAgICdDTUQtU0hFTEwnLFxuICAgICAgICAgIFwibm9kZSAtZSBcXFwicmVxdWlyZSgnaHR0cCcpLmdldCgnaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS9oZWFsdGgnLCAocikgPT4gcHJvY2Vzcy5leGl0KHIuc3RhdHVzQ29kZSA9PT0gMjAwID8gMCA6IDEpKS5vbignZXJyb3InLCAoKSA9PiBwcm9jZXNzLmV4aXQoMSkpXFxcIlwiLFxuICAgICAgICBdLFxuICAgICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICAgIHJldHJpZXM6IDMsXG4gICAgICAgIHN0YXJ0UGVyaW9kOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIFRhc2sgRGVmaW5pdGlvblxuICAgIGNvbnN0IGFwaVRhc2tEZWYgPSBuZXcgZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbih0aGlzLCAnQXBpVGFza0RlZicsIHtcbiAgICAgIG1lbW9yeUxpbWl0TWlCOiBpc1Byb2QgPyAxMDI0IDogNTEyLFxuICAgICAgY3B1OiBpc1Byb2QgPyA1MTIgOiAyNTYsXG4gICAgICBmYW1pbHk6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1hcGlgLFxuICAgIH0pO1xuXG4gICAgLy8gR3JhbnQgRUNSIHB1bGwgcGVybWlzc2lvbnNcbiAgICBhcGlSZXBvc2l0b3J5LmdyYW50UHVsbChhcGlUYXNrRGVmLm9idGFpbkV4ZWN1dGlvblJvbGUoKSk7XG5cbiAgICAvLyBHcmFudCBBUEkgYWNjZXNzIHRvIGRhdGFiYXNlIHNlY3JldFxuICAgIGRhdGFiYXNlU2VjcmV0LmdyYW50UmVhZChhcGlUYXNrRGVmLnRhc2tSb2xlKTtcblxuICAgIGNvbnN0IGFwaUxvZ0dyb3VwID0gbmV3IGxvZ3MuTG9nR3JvdXAodGhpcywgJ0FwaUxvZ3MnLCB7XG4gICAgICBsb2dHcm91cE5hbWU6IGAvZWNzLyR7cHJvamVjdE5hbWV9LyR7ZW52aXJvbm1lbnR9L2FwaWAsXG4gICAgICByZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICByZW1vdmFsUG9saWN5OiBpc1Byb2RcbiAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU5cbiAgICAgICAgOiBjZGsuUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgYXBpVGFza0RlZi5hZGRDb250YWluZXIoJ2FwaScsIHtcbiAgICAgIGNvbnRhaW5lck5hbWU6ICdhcGknLFxuICAgICAgaW1hZ2U6IHVzZVBsYWNlaG9sZGVyXG4gICAgICAgID8gZWNzLkNvbnRhaW5lckltYWdlLmZyb21SZWdpc3RyeSgncHVibGljLmVjci5hd3Mvbmdpbngvbmdpbng6YWxwaW5lJylcbiAgICAgICAgOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkoYXBpUmVwb3NpdG9yeSwgJ2xhdGVzdCcpLFxuICAgICAgcG9ydE1hcHBpbmdzOiBbeyBjb250YWluZXJQb3J0OiB1c2VQbGFjZWhvbGRlciA/IDgwIDogODAwMCB9XSxcbiAgICAgIGxvZ2dpbmc6IGVjcy5Mb2dEcml2ZXJzLmF3c0xvZ3Moe1xuICAgICAgICBsb2dHcm91cDogYXBpTG9nR3JvdXAsXG4gICAgICAgIHN0cmVhbVByZWZpeDogJ2FwaScsXG4gICAgICB9KSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIEVOVklST05NRU5UOiBlbnZpcm9ubWVudCxcbiAgICAgICAgREVCVUc6IGlzUHJvZCA/ICdmYWxzZScgOiAndHJ1ZScsXG4gICAgICAgIFJFRElTX1VSTDogYHJlZGlzOi8vJHtyZWRpc0NsdXN0ZXIuYXR0clJlZGlzRW5kcG9pbnRBZGRyZXNzfTo2Mzc5LzBgLFxuICAgICAgfSxcbiAgICAgIHNlY3JldHM6IHVzZVBsYWNlaG9sZGVyID8gdW5kZWZpbmVkIDoge1xuICAgICAgICBEQVRBQkFTRV9VUkw6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKGRhdGFiYXNlU2VjcmV0LCAnY29ubmVjdGlvblN0cmluZycpLFxuICAgICAgfSxcbiAgICAgIGhlYWx0aENoZWNrOiB1c2VQbGFjZWhvbGRlciA/IHVuZGVmaW5lZCA6IHtcbiAgICAgICAgY29tbWFuZDogW1xuICAgICAgICAgICdDTUQtU0hFTEwnLFxuICAgICAgICAgICdweXRob24gLWMgXCJpbXBvcnQgdXJsbGliLnJlcXVlc3Q7IHVybGxpYi5yZXF1ZXN0LnVybG9wZW4oXFwnaHR0cDovL2xvY2FsaG9zdDo4MDAwL2hlYWx0aFxcJylcIiB8fCBleGl0IDEnLFxuICAgICAgICBdLFxuICAgICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICAgIHJldHJpZXM6IDMsXG4gICAgICAgIHN0YXJ0UGVyaW9kOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gRGFzaGJvYXJkIFNlcnZpY2VcbiAgICB0aGlzLmRhc2hib2FyZFNlcnZpY2UgPSBuZXcgZWNzLkZhcmdhdGVTZXJ2aWNlKHRoaXMsICdEYXNoYm9hcmRTZXJ2aWNlJywge1xuICAgICAgY2x1c3RlcjogdGhpcy5jbHVzdGVyLFxuICAgICAgc2VydmljZU5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1kYXNoYm9hcmRgLFxuICAgICAgdGFza0RlZmluaXRpb246IGRhc2hib2FyZFRhc2tEZWYsXG4gICAgICBkZXNpcmVkQ291bnQ6IGlzUHJvZCA/IDIgOiAxLFxuICAgICAgc2VjdXJpdHlHcm91cHM6IFtzZXJ2aWNlU0ddLFxuICAgICAgdnBjU3VibmV0czogeyBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTIH0sXG4gICAgICBlbmFibGVFeGVjdXRlQ29tbWFuZDogdHJ1ZSxcbiAgICAgIGNpcmN1aXRCcmVha2VyOiB7IHJvbGxiYWNrOiB0cnVlIH0sXG4gICAgICBtaW5IZWFsdGh5UGVyY2VudDogMTAwLFxuICAgICAgbWF4SGVhbHRoeVBlcmNlbnQ6IDIwMCxcbiAgICAgIGRlcGxveW1lbnRDb250cm9sbGVyOiB7XG4gICAgICAgIHR5cGU6IGVjcy5EZXBsb3ltZW50Q29udHJvbGxlclR5cGUuRUNTLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBTZXJ2aWNlXG4gICAgdGhpcy5hcGlTZXJ2aWNlID0gbmV3IGVjcy5GYXJnYXRlU2VydmljZSh0aGlzLCAnQXBpU2VydmljZScsIHtcbiAgICAgIGNsdXN0ZXI6IHRoaXMuY2x1c3RlcixcbiAgICAgIHNlcnZpY2VOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tYXBpYCxcbiAgICAgIHRhc2tEZWZpbml0aW9uOiBhcGlUYXNrRGVmLFxuICAgICAgZGVzaXJlZENvdW50OiBpc1Byb2QgPyAyIDogMSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbc2VydmljZVNHXSxcbiAgICAgIHZwY1N1Ym5ldHM6IHsgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyB9LFxuICAgICAgZW5hYmxlRXhlY3V0ZUNvbW1hbmQ6IHRydWUsXG4gICAgICBjaXJjdWl0QnJlYWtlcjogeyByb2xsYmFjazogdHJ1ZSB9LFxuICAgICAgbWluSGVhbHRoeVBlcmNlbnQ6IDEwMCxcbiAgICAgIG1heEhlYWx0aHlQZXJjZW50OiAyMDAsXG4gICAgICBkZXBsb3ltZW50Q29udHJvbGxlcjoge1xuICAgICAgICB0eXBlOiBlY3MuRGVwbG95bWVudENvbnRyb2xsZXJUeXBlLkVDUyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBEYXNoYm9hcmQgdGFyZ2V0IGdyb3VwXG4gICAgY29uc3QgZGFzaGJvYXJkVGFyZ2V0R3JvdXAgPSBuZXcgZWxidjIuQXBwbGljYXRpb25UYXJnZXRHcm91cChcbiAgICAgIHRoaXMsXG4gICAgICAnRGFzaGJvYXJkVEcnLFxuICAgICAge1xuICAgICAgICB2cGMsXG4gICAgICAgIHBvcnQ6IHVzZVBsYWNlaG9sZGVyID8gODAgOiAzMDAwLFxuICAgICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgICB0YXJnZXRUeXBlOiBlbGJ2Mi5UYXJnZXRUeXBlLklQLFxuICAgICAgICBoZWFsdGhDaGVjazoge1xuICAgICAgICAgIHBhdGg6IHVzZVBsYWNlaG9sZGVyID8gJy8nIDogJy9hcGkvaGVhbHRoJyxcbiAgICAgICAgICBpbnRlcnZhbDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgICAgICBoZWFsdGh5VGhyZXNob2xkQ291bnQ6IDIsXG4gICAgICAgICAgdW5oZWFsdGh5VGhyZXNob2xkQ291bnQ6IDMsXG4gICAgICAgIH0sXG4gICAgICAgIHRhcmdldHM6IFt0aGlzLmRhc2hib2FyZFNlcnZpY2VdLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBBUEkgdGFyZ2V0IGdyb3VwXG4gICAgY29uc3QgYXBpVGFyZ2V0R3JvdXAgPSBuZXcgZWxidjIuQXBwbGljYXRpb25UYXJnZXRHcm91cCh0aGlzLCAnQXBpVEcnLCB7XG4gICAgICB2cGMsXG4gICAgICBwb3J0OiB1c2VQbGFjZWhvbGRlciA/IDgwIDogODAwMCxcbiAgICAgIHByb3RvY29sOiBlbGJ2Mi5BcHBsaWNhdGlvblByb3RvY29sLkhUVFAsXG4gICAgICB0YXJnZXRUeXBlOiBlbGJ2Mi5UYXJnZXRUeXBlLklQLFxuICAgICAgaGVhbHRoQ2hlY2s6IHtcbiAgICAgICAgcGF0aDogdXNlUGxhY2Vob2xkZXIgPyAnLycgOiAnL2hlYWx0aCcsXG4gICAgICAgIGludGVydmFsOiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5zZWNvbmRzKDEwKSxcbiAgICAgICAgaGVhbHRoeVRocmVzaG9sZENvdW50OiAyLFxuICAgICAgICB1bmhlYWx0aHlUaHJlc2hvbGRDb3VudDogMyxcbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbdGhpcy5hcGlTZXJ2aWNlXSxcbiAgICB9KTtcblxuICAgIC8vIENvbmZpZ3VyZSBsaXN0ZW5lciBydWxlcyBiYXNlZCBvbiBlbnZpcm9ubWVudFxuICAgIGlmIChpc1Byb2QpIHtcbiAgICAgIC8vIFJlZGlyZWN0IEhUVFAgdG8gSFRUUFMgaW4gcHJvZHVjdGlvblxuICAgICAgaHR0cExpc3RlbmVyLmFkZEFjdGlvbignUmVkaXJlY3RUb0h0dHBzJywge1xuICAgICAgICBhY3Rpb246IGVsYnYyLkxpc3RlbmVyQWN0aW9uLnJlZGlyZWN0KHtcbiAgICAgICAgICBwcm90b2NvbDogJ0hUVFBTJyxcbiAgICAgICAgICBwb3J0OiAnNDQzJyxcbiAgICAgICAgICBwZXJtYW5lbnQ6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIERldjogcm91dGUgQVBJIHBhdGhzIHRvIEFQSSBzZXJ2aWNlLCBldmVyeXRoaW5nIGVsc2UgdG8gZGFzaGJvYXJkXG4gICAgICBodHRwTGlzdGVuZXIuYWRkQWN0aW9uKCdBcGlSb3V0ZScsIHtcbiAgICAgICAgcHJpb3JpdHk6IDEwLFxuICAgICAgICBjb25kaXRpb25zOiBbZWxidjIuTGlzdGVuZXJDb25kaXRpb24ucGF0aFBhdHRlcm5zKFsnL2FwaS8qJywgJy9oZWFsdGgnLCAnL2RvY3MnLCAnL3JlZG9jJ10pXSxcbiAgICAgICAgYWN0aW9uOiBlbGJ2Mi5MaXN0ZW5lckFjdGlvbi5mb3J3YXJkKFthcGlUYXJnZXRHcm91cF0pLFxuICAgICAgfSk7XG5cbiAgICAgIC8vIERlZmF1bHQ6IGZvcndhcmQgdG8gZGFzaGJvYXJkXG4gICAgICBodHRwTGlzdGVuZXIuYWRkVGFyZ2V0R3JvdXBzKCdEZWZhdWx0VGFyZ2V0R3JvdXAnLCB7XG4gICAgICAgIHRhcmdldEdyb3VwczogW2Rhc2hib2FyZFRhcmdldEdyb3VwXSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEF1dG8tc2NhbGluZyBmb3IgcHJvZHVjdGlvblxuICAgIGlmIChpc1Byb2QpIHtcbiAgICAgIGNvbnN0IGRhc2hib2FyZFNjYWxpbmcgPSB0aGlzLmRhc2hib2FyZFNlcnZpY2UuYXV0b1NjYWxlVGFza0NvdW50KHtcbiAgICAgICAgbWluQ2FwYWNpdHk6IDIsXG4gICAgICAgIG1heENhcGFjaXR5OiAxMCxcbiAgICAgIH0pO1xuICAgICAgZGFzaGJvYXJkU2NhbGluZy5zY2FsZU9uQ3B1VXRpbGl6YXRpb24oJ0NwdVNjYWxpbmcnLCB7XG4gICAgICAgIHRhcmdldFV0aWxpemF0aW9uUGVyY2VudDogNzAsXG4gICAgICAgIHNjYWxlSW5Db29sZG93bjogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgICBzY2FsZU91dENvb2xkb3duOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICB9KTtcblxuICAgICAgY29uc3QgYXBpU2NhbGluZyA9IHRoaXMuYXBpU2VydmljZS5hdXRvU2NhbGVUYXNrQ291bnQoe1xuICAgICAgICBtaW5DYXBhY2l0eTogMixcbiAgICAgICAgbWF4Q2FwYWNpdHk6IDEwLFxuICAgICAgfSk7XG4gICAgICBhcGlTY2FsaW5nLnNjYWxlT25DcHVVdGlsaXphdGlvbignQ3B1U2NhbGluZycsIHtcbiAgICAgICAgdGFyZ2V0VXRpbGl6YXRpb25QZXJjZW50OiA3MCxcbiAgICAgICAgc2NhbGVJbkNvb2xkb3duOiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICAgIHNjYWxlT3V0Q29vbGRvd246IGNkay5EdXJhdGlvbi5zZWNvbmRzKDYwKSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQWxiRG5zTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmFsYi5sb2FkQmFsYW5jZXJEbnNOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdBTEIgRE5TIG5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFsYi1kbnNgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NsdXN0ZXJBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5jbHVzdGVyLmNsdXN0ZXJBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0VDUyBjbHVzdGVyIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tY2x1c3Rlci1hcm5gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Rhc2hib2FyZFNlcnZpY2VBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kYXNoYm9hcmRTZXJ2aWNlLnNlcnZpY2VBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0Rhc2hib2FyZCBzZXJ2aWNlIEFSTicsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZGFzaGJvYXJkLXNlcnZpY2UtYXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBcGlTZXJ2aWNlQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpU2VydmljZS5zZXJ2aWNlQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEkgc2VydmljZSBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFwaS1zZXJ2aWNlLWFybmAsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==