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
exports.PipelineStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const codepipeline = __importStar(require("aws-cdk-lib/aws-codepipeline"));
const codepipeline_actions = __importStar(require("aws-cdk-lib/aws-codepipeline-actions"));
const codebuild = __importStar(require("aws-cdk-lib/aws-codebuild"));
const ecs = __importStar(require("aws-cdk-lib/aws-ecs"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
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
class PipelineStack extends cdk.Stack {
    pipeline;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { projectName, environment, dashboardRepository, apiRepository, workerRepository, } = props;
        // Resolve services — accept either IBaseService or ARN string for external services
        const resolveService = (svc, id) => {
            if (typeof svc === 'string') {
                return ecs.BaseService.fromServiceArnWithCluster(this, id, svc);
            }
            return svc;
        };
        const dashboardService = resolveService(props.dashboardService, 'ImportedDashboardService');
        const apiService = resolveService(props.apiService, 'ImportedApiService');
        const workerService = resolveService(props.workerService, 'ImportedWorkerService');
        // Source artifact
        const sourceOutput = new codepipeline.Artifact('SourceOutput');
        const dashboardBuildOutput = new codepipeline.Artifact('DashboardBuildOutput');
        const apiBuildOutput = new codepipeline.Artifact('ApiBuildOutput');
        const workerBuildOutput = new codepipeline.Artifact('WorkerBuildOutput');
        // CodeBuild role with ECR permissions
        const buildRole = new iam.Role(this, 'BuildRole', {
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
            roleName: `${projectName}-${environment}-codebuild-role`,
        });
        dashboardRepository.grantPullPush(buildRole);
        apiRepository.grantPullPush(buildRole);
        workerRepository.grantPullPush(buildRole);
        // Dashboard build project
        const dashboardBuild = new codebuild.PipelineProject(this, 'DashboardBuild', {
            projectName: `${projectName}-${environment}-dashboard-build`,
            role: buildRole,
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
                privileged: true, // Required for Docker
                computeType: codebuild.ComputeType.MEDIUM,
                environmentVariables: {
                    REPOSITORY_URI: {
                        value: dashboardRepository.repositoryUri,
                    },
                    CONTAINER_NAME: {
                        value: 'dashboard',
                    },
                    AWS_REGION: {
                        value: this.region,
                    },
                },
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    pre_build: {
                        commands: [
                            'echo Logging in to Amazon ECR...',
                            'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI',
                            'export COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
                            'export IMAGE_TAG=${COMMIT_HASH:=latest}',
                        ],
                    },
                    build: {
                        commands: [
                            'echo Clearing Docker build cache...',
                            'docker builder prune -f || true',
                            'echo Building the Docker image...',
                            'cd dashboard',
                            'docker build --no-cache --pull -t $REPOSITORY_URI:latest -t $REPOSITORY_URI:$IMAGE_TAG .',
                        ],
                    },
                    post_build: {
                        commands: [
                            'echo Pushing the Docker image...',
                            'docker push $REPOSITORY_URI:latest',
                            'docker push $REPOSITORY_URI:$IMAGE_TAG',
                            'echo Writing image definitions file...',
                            'printf \'[{"name":"%s","imageUri":"%s"}]\' $CONTAINER_NAME $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
                            'cat imagedefinitions.json',
                        ],
                    },
                },
                artifacts: {
                    files: ['dashboard/imagedefinitions.json'],
                    'discard-paths': 'yes',
                },
            }),
        });
        // E2E test project
        const e2eBuild = new codebuild.PipelineProject(this, 'E2EBuild', {
            projectName: `${projectName}-${environment}-e2e-test`,
            role: buildRole,
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
                privileged: false,
                computeType: codebuild.ComputeType.MEDIUM,
                environmentVariables: {
                    CI: { value: 'true' },
                    PLAYWRIGHT_BASE_URL: { value: 'http://localhost:3000' },
                },
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    install: {
                        'runtime-versions': {
                            nodejs: 20,
                        },
                        commands: [
                            'echo Installing dependencies...',
                            'cd dashboard',
                            'npm ci',
                            'echo Installing Playwright browsers...',
                            'npx playwright install chromium --with-deps',
                        ],
                    },
                    pre_build: {
                        commands: [
                            'echo Building application...',
                            'npm run build',
                            'echo Starting application server...',
                            'npm run start &',
                            'sleep 10',
                            'echo Verifying server is up...',
                            'curl -s http://localhost:3000/api/health || exit 1',
                        ],
                    },
                    build: {
                        commands: [
                            'echo Running E2E tests...',
                            'npm run test:e2e -- --reporter=junit,html',
                        ],
                    },
                    post_build: {
                        commands: [
                            'echo E2E tests completed',
                            'pkill -f "next start" || true',
                        ],
                    },
                },
                reports: {
                    'e2e-test-reports': {
                        files: ['test-results/e2e-results.xml'],
                        'file-format': 'JUNITXML',
                        'base-directory': 'dashboard',
                    },
                },
                artifacts: {
                    files: [
                        'dashboard/playwright-report/**/*',
                        'dashboard/test-results/**/*',
                    ],
                },
            }),
            timeout: cdk.Duration.minutes(30),
        });
        // API build project
        const apiBuild = new codebuild.PipelineProject(this, 'ApiBuild', {
            projectName: `${projectName}-${environment}-api-build`,
            role: buildRole,
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
                privileged: true,
                computeType: codebuild.ComputeType.MEDIUM,
                environmentVariables: {
                    REPOSITORY_URI: {
                        value: apiRepository.repositoryUri,
                    },
                    CONTAINER_NAME: {
                        value: 'api',
                    },
                    AWS_REGION: {
                        value: this.region,
                    },
                },
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    pre_build: {
                        commands: [
                            'echo Logging in to Amazon ECR...',
                            'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI',
                            'export COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
                            'export IMAGE_TAG=${COMMIT_HASH:=latest}',
                        ],
                    },
                    build: {
                        commands: [
                            'echo Building the Docker image...',
                            'cd api',
                            'docker build --no-cache -t $REPOSITORY_URI:latest -t $REPOSITORY_URI:$IMAGE_TAG .',
                        ],
                    },
                    post_build: {
                        commands: [
                            'echo Pushing the Docker image...',
                            'docker push $REPOSITORY_URI:latest',
                            'docker push $REPOSITORY_URI:$IMAGE_TAG',
                            'echo Writing image definitions file...',
                            'printf \'[{"name":"%s","imageUri":"%s"}]\' $CONTAINER_NAME $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
                            'cat imagedefinitions.json',
                        ],
                    },
                },
                artifacts: {
                    files: ['api/imagedefinitions.json'],
                    'discard-paths': 'yes',
                },
            }),
            cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
        });
        // Worker build project
        const workerBuild = new codebuild.PipelineProject(this, 'WorkerBuild', {
            projectName: `${projectName}-${environment}-worker-build`,
            role: buildRole,
            environment: {
                buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
                privileged: true,
                computeType: codebuild.ComputeType.MEDIUM,
                environmentVariables: {
                    REPOSITORY_URI: {
                        value: workerRepository.repositoryUri,
                    },
                    CONTAINER_NAME: {
                        value: 'worker',
                    },
                    AWS_REGION: {
                        value: this.region,
                    },
                },
            },
            buildSpec: codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    pre_build: {
                        commands: [
                            'echo Logging in to Amazon ECR...',
                            'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REPOSITORY_URI',
                            'export COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
                            'export IMAGE_TAG=${COMMIT_HASH:=latest}',
                        ],
                    },
                    build: {
                        commands: [
                            'echo Building the Docker image...',
                            'cd worker',
                            'docker build --no-cache -t $REPOSITORY_URI:latest -t $REPOSITORY_URI:$IMAGE_TAG .',
                        ],
                    },
                    post_build: {
                        commands: [
                            'echo Pushing the Docker image...',
                            'docker push $REPOSITORY_URI:latest',
                            'docker push $REPOSITORY_URI:$IMAGE_TAG',
                            'echo Writing image definitions file...',
                            'printf \'[{"name":"%s","imageUri":"%s"}]\' $CONTAINER_NAME $REPOSITORY_URI:$IMAGE_TAG > imagedefinitions.json',
                            'cat imagedefinitions.json',
                        ],
                    },
                },
                artifacts: {
                    files: ['worker/imagedefinitions.json'],
                    'discard-paths': 'yes',
                },
            }),
            cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
        });
        // Pipeline
        this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
            pipelineName: `${projectName}-${environment}-pipeline`,
            pipelineType: codepipeline.PipelineType.V2,
            restartExecutionOnUpdate: true,
        });
        // Source stage - GitHub via CodeStar Connections
        // Note: You need to create a CodeStar connection manually and update the ARN
        const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
            actionName: 'GitHub_Source',
            owner: 'tegryan-ddo', // Update with actual owner
            repo: 'metis', // Update with actual repo
            branch: 'main',
            output: sourceOutput,
            connectionArn: 'arn:aws:codeconnections:us-east-1:882384879235:connection/36b17d25-a4cc-467d-94fb-4cea5e6bc986',
            triggerOnPush: true,
        });
        this.pipeline.addStage({
            stageName: 'Source',
            actions: [sourceAction],
        });
        // Build stage - parallel builds
        this.pipeline.addStage({
            stageName: 'Build',
            actions: [
                new codepipeline_actions.CodeBuildAction({
                    actionName: 'Build_Dashboard',
                    project: dashboardBuild,
                    input: sourceOutput,
                    outputs: [dashboardBuildOutput],
                    runOrder: 1,
                }),
                new codepipeline_actions.CodeBuildAction({
                    actionName: 'Build_API',
                    project: apiBuild,
                    input: sourceOutput,
                    outputs: [apiBuildOutput],
                    runOrder: 1, // Same runOrder for parallel execution
                }),
                new codepipeline_actions.CodeBuildAction({
                    actionName: 'Build_Worker',
                    project: workerBuild,
                    input: sourceOutput,
                    outputs: [workerBuildOutput],
                    runOrder: 1, // Same runOrder for parallel execution
                }),
            ],
        });
        // Deploy stage - ECS rolling deployment
        this.pipeline.addStage({
            stageName: 'Deploy',
            actions: [
                new codepipeline_actions.EcsDeployAction({
                    actionName: 'Deploy_Dashboard',
                    service: dashboardService,
                    input: dashboardBuildOutput,
                    deploymentTimeout: cdk.Duration.minutes(15),
                    runOrder: 1,
                }),
                new codepipeline_actions.EcsDeployAction({
                    actionName: 'Deploy_API',
                    service: apiService,
                    input: apiBuildOutput,
                    deploymentTimeout: cdk.Duration.minutes(15),
                    runOrder: 1, // Same runOrder for parallel deployment
                }),
                new codepipeline_actions.EcsDeployAction({
                    actionName: 'Deploy_Worker',
                    service: workerService,
                    input: workerBuildOutput,
                    deploymentTimeout: cdk.Duration.minutes(15),
                    runOrder: 1, // Same runOrder for parallel deployment
                }),
            ],
        });
        // E2E Test stage - runs after deployment
        const e2eTestOutput = new codepipeline.Artifact('E2ETestOutput');
        this.pipeline.addStage({
            stageName: 'E2E_Test',
            actions: [
                new codepipeline_actions.CodeBuildAction({
                    actionName: 'Run_E2E_Tests',
                    project: e2eBuild,
                    input: sourceOutput,
                    outputs: [e2eTestOutput],
                    runOrder: 1,
                }),
            ],
        });
        // Outputs
        new cdk.CfnOutput(this, 'PipelineArn', {
            value: this.pipeline.pipelineArn,
            description: 'Pipeline ARN',
            exportName: `${projectName}-${environment}-pipeline-arn`,
        });
        new cdk.CfnOutput(this, 'PipelineUrl', {
            value: `https://${this.region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${this.pipeline.pipelineName}/view`,
            description: 'Pipeline console URL',
        });
    }
}
exports.PipelineStack = PipelineStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZWxpbmUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvc3RhY2tzL3BpcGVsaW5lLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywyRUFBNkQ7QUFDN0QsMkZBQTZFO0FBQzdFLHFFQUF1RDtBQUV2RCx5REFBMkM7QUFDM0MseURBQTJDO0FBaUIzQzs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFhLGFBQWMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMxQixRQUFRLENBQXdCO0lBRWhELFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBeUI7UUFDakUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUNKLFdBQVcsRUFDWCxXQUFXLEVBQ1gsbUJBQW1CLEVBQ25CLGFBQWEsRUFDYixnQkFBZ0IsR0FDakIsR0FBRyxLQUFLLENBQUM7UUFFVixvRkFBb0Y7UUFDcEYsTUFBTSxjQUFjLEdBQUcsQ0FBQyxHQUE4QixFQUFFLEVBQVUsRUFBb0IsRUFBRTtZQUN0RixJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUM1QixPQUFPLEdBQUcsQ0FBQyxXQUFXLENBQUMseUJBQXlCLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUNsRSxDQUFDO1lBQ0QsT0FBTyxHQUFHLENBQUM7UUFDYixDQUFDLENBQUM7UUFFRixNQUFNLGdCQUFnQixHQUFHLGNBQWMsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsMEJBQTBCLENBQUMsQ0FBQztRQUM1RixNQUFNLFVBQVUsR0FBRyxjQUFjLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxvQkFBb0IsQ0FBQyxDQUFDO1FBQzFFLE1BQU0sYUFBYSxHQUFHLGNBQWMsQ0FBQyxLQUFLLENB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M0IsVUFBVSxFQUFFLEdBQUcsV0FBVyxJQUFJLFdBQVcsZUFBZTtTQUN6RCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNyQyxLQUFLLEVBQUUsV0FBVyxJQUFJLENBQUMsTUFBTSw0REFBNEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLE9BQU87WUFDMUgsV0FBVyxFQUFFLHNCQUFzQjtTQUNwQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUExWUQsc0NBMFlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29kZXBpcGVsaW5lJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZV9hY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2RlcGlwZWxpbmUtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBjb2RlYnVpbGQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZGVidWlsZCc7XG5pbXBvcnQgKiBhcyBlY3IgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcic7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBQaXBlbGluZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIGRhc2hib2FyZFJlcG9zaXRvcnk6IGVjci5SZXBvc2l0b3J5O1xuICBhcGlSZXBvc2l0b3J5OiBlY3IuUmVwb3NpdG9yeTtcbiAgd29ya2VyUmVwb3NpdG9yeTogZWNyLlJlcG9zaXRvcnk7XG4gIC8qKiBTZXJ2aWNlIEFSTiBvciBJQmFzZVNlcnZpY2UgZm9yIGRhc2hib2FyZCBkZXBsb3ltZW50LiBVc2UgQVJOIHN0cmluZyBmb3IgZXh0ZXJuYWwgY2x1c3RlcnMuICovXG4gIGRhc2hib2FyZFNlcnZpY2U6IGVjcy5JQmFzZVNlcnZpY2UgfCBzdHJpbmc7XG4gIC8qKiBTZXJ2aWNlIEFSTiBvciBJQmFzZVNlcnZpY2UgZm9yIEFQSSBkZXBsb3ltZW50LiAqL1xuICBhcGlTZXJ2aWNlOiBlY3MuSUJhc2VTZXJ2aWNlIHwgc3RyaW5nO1xuICAvKiogU2VydmljZSBBUk4gb3IgSUJhc2VTZXJ2aWNlIGZvciB3b3JrZXIgZGVwbG95bWVudC4gKi9cbiAgd29ya2VyU2VydmljZTogZWNzLklCYXNlU2VydmljZSB8IHN0cmluZztcbn1cblxuLyoqXG4gKiBQaXBlbGluZSBTdGFjayAtIENvZGVQaXBlbGluZSArIENvZGVCdWlsZCBmb3IgQ0kvQ0RcbiAqXG4gKiBDcmVhdGVzOlxuICogLSBDb2RlUGlwZWxpbmUgd2l0aCBTb3VyY2UsIEJ1aWxkLCBhbmQgRGVwbG95IHN0YWdlc1xuICogLSBQYXJhbGxlbCBDb2RlQnVpbGQgcHJvamVjdHMgZm9yIGRhc2hib2FyZCBhbmQgQVBJXG4gKiAtIEVDUyByb2xsaW5nIGRlcGxveW1lbnQgd2l0aCBjaXJjdWl0IGJyZWFrZXJcbiAqXG4gKiBOb3RlOiBSZXF1aXJlcyBHaXRIdWIgQ29kZVN0YXIgY29ubmVjdGlvbiB0byBiZSBjb25maWd1cmVkXG4gKi9cbmV4cG9ydCBjbGFzcyBQaXBlbGluZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHBpcGVsaW5lOiBjb2RlcGlwZWxpbmUuUGlwZWxpbmU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFBpcGVsaW5lU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3Qge1xuICAgICAgcHJvamVjdE5hbWUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIGRhc2hib2FyZFJlcG9zaXRvcnksXG4gICAgICBhcGlSZXBvc2l0b3J5LFxuICAgICAgd29ya2VyUmVwb3NpdG9yeSxcbiAgICB9ID0gcHJvcHM7XG5cbiAgICAvLyBSZXNvbHZlIHNlcnZpY2VzIOKAlCBhY2NlcHQgZWl0aGVyIElCYXNlU2VydmljZSBvciBBUk4gc3RyaW5nIGZvciBleHRlcm5hbCBzZXJ2aWNlc1xuICAgIGNvbnN0IHJlc29sdmVTZXJ2aWNlID0gKHN2YzogZWNzLklCYXNlU2VydmljZSB8IHN0cmluZywgaWQ6IHN0cmluZyk6IGVjcy5JQmFzZVNlcnZpY2UgPT4ge1xuICAgICAgaWYgKHR5cGVvZiBzdmMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHJldHVybiBlY3MuQmFzZVNlcnZpY2UuZnJvbVNlcnZpY2VBcm5XaXRoQ2x1c3Rlcih0aGlzLCBpZCwgc3ZjKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBzdmM7XG4gICAgfTtcblxuICAgIGNvbnN0IGRhc2hib2FyZFNlcnZpY2UgPSByZXNvbHZlU2VydmljZShwcm9wcy5kYXNoYm9hcmRTZXJ2aWNlLCAnSW1wb3J0ZWREYXNoYm9hcmRTZXJ2aWNlJyk7XG4gICAgY29uc3QgYXBpU2VydmljZSA9IHJlc29sdmVTZXJ2aWNlKHByb3BzLmFwaVNlcnZpY2UsICdJbXBvcnRlZEFwaVNlcnZpY2UnKTtcbiAgICBjb25zdCB3b3JrZXJTZXJ2aWNlID0gcmVzb2x2ZVNlcnZpY2UocHJvcHMud29ya2VyU2VydmljZSwgJ0ltcG9ydGVkV29ya2VyU2VydmljZScpO1xuXG4gICAgLy8gU291cmNlIGFydGlmYWN0XG4gICAgY29uc3Qgc291cmNlT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgnU291cmNlT3V0cHV0Jyk7XG4gICAgY29uc3QgZGFzaGJvYXJkQnVpbGRPdXRwdXQgPSBuZXcgY29kZXBpcGVsaW5lLkFydGlmYWN0KCdEYXNoYm9hcmRCdWlsZE91dHB1dCcpO1xuICAgIGNvbnN0IGFwaUJ1aWxkT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgnQXBpQnVpbGRPdXRwdXQnKTtcbiAgICBjb25zdCB3b3JrZXJCdWlsZE91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoJ1dvcmtlckJ1aWxkT3V0cHV0Jyk7XG5cbiAgICAvLyBDb2RlQnVpbGQgcm9sZSB3aXRoIEVDUiBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGJ1aWxkUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQnVpbGRSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2NvZGVidWlsZC5hbWF6b25hd3MuY29tJyksXG4gICAgICByb2xlTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWNvZGVidWlsZC1yb2xlYCxcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZFJlcG9zaXRvcnkuZ3JhbnRQdWxsUHVzaChidWlsZFJvbGUpO1xuICAgIGFwaVJlcG9zaXRvcnkuZ3JhbnRQdWxsUHVzaChidWlsZFJvbGUpO1xuICAgIHdvcmtlclJlcG9zaXRvcnkuZ3JhbnRQdWxsUHVzaChidWlsZFJvbGUpO1xuXG4gICAgLy8gRGFzaGJvYXJkIGJ1aWxkIHByb2plY3RcbiAgICBjb25zdCBkYXNoYm9hcmRCdWlsZCA9IG5ldyBjb2RlYnVpbGQuUGlwZWxpbmVQcm9qZWN0KFxuICAgICAgdGhpcyxcbiAgICAgICdEYXNoYm9hcmRCdWlsZCcsXG4gICAgICB7XG4gICAgICAgIHByb2plY3ROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZGFzaGJvYXJkLWJ1aWxkYCxcbiAgICAgICAgcm9sZTogYnVpbGRSb2xlLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuU1RBTkRBUkRfN18wLFxuICAgICAgICAgIHByaXZpbGVnZWQ6IHRydWUsIC8vIFJlcXVpcmVkIGZvciBEb2NrZXJcbiAgICAgICAgICBjb21wdXRlVHlwZTogY29kZWJ1aWxkLkNvbXB1dGVUeXBlLk1FRElVTSxcbiAgICAgICAgICBlbnZpcm9ubWVudFZhcmlhYmxlczoge1xuICAgICAgICAgICAgUkVQT1NJVE9SWV9VUkk6IHtcbiAgICAgICAgICAgICAgdmFsdWU6IGRhc2hib2FyZFJlcG9zaXRvcnkucmVwb3NpdG9yeVVyaSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBDT05UQUlORVJfTkFNRToge1xuICAgICAgICAgICAgICB2YWx1ZTogJ2Rhc2hib2FyZCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgQVdTX1JFR0lPTjoge1xuICAgICAgICAgICAgICB2YWx1ZTogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGJ1aWxkU3BlYzogY29kZWJ1aWxkLkJ1aWxkU3BlYy5mcm9tT2JqZWN0KHtcbiAgICAgICAgICB2ZXJzaW9uOiAnMC4yJyxcbiAgICAgICAgICBwaGFzZXM6IHtcbiAgICAgICAgICAgIHByZV9idWlsZDoge1xuICAgICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAgICdlY2hvIExvZ2dpbmcgaW4gdG8gQW1hem9uIEVDUi4uLicsXG4gICAgICAgICAgICAgICAgJ2F3cyBlY3IgZ2V0LWxvZ2luLXBhc3N3b3JkIC0tcmVnaW9uICRBV1NfUkVHSU9OIHwgZG9ja2VyIGxvZ2luIC0tdXNlcm5hbWUgQVdTIC0tcGFzc3dvcmQtc3RkaW4gJFJFUE9TSVRPUllfVVJJJyxcbiAgICAgICAgICAgICAgICAnZXhwb3J0IENPTU1JVF9IQVNIPSQoZWNobyAkQ09ERUJVSUxEX1JFU09MVkVEX1NPVVJDRV9WRVJTSU9OIHwgY3V0IC1jIDEtNyknLFxuICAgICAgICAgICAgICAgICdleHBvcnQgSU1BR0VfVEFHPSR7Q09NTUlUX0hBU0g6PWxhdGVzdH0nLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICAgJ2VjaG8gQ2xlYXJpbmcgRG9ja2VyIGJ1aWxkIGNhY2hlLi4uJyxcbiAgICAgICAgICAgICAgICAnZG9ja2VyIGJ1aWxkZXIgcHJ1bmUgLWYgfHwgdHJ1ZScsXG4gICAgICAgICAgICAgICAgJ2VjaG8gQnVpbGRpbmcgdGhlIERvY2tlciBpbWFnZS4uLicsXG4gICAgICAgICAgICAgICAgJ2NkIGRhc2hib2FyZCcsXG4gICAgICAgICAgICAgICAgJ2RvY2tlciBidWlsZCAtLW5vLWNhY2hlIC0tcHVsbCAtdCAkUkVQT1NJVE9SWV9VUkk6bGF0ZXN0IC10ICRSRVBPU0lUT1JZX1VSSTokSU1BR0VfVEFHIC4nLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHBvc3RfYnVpbGQ6IHtcbiAgICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgICAnZWNobyBQdXNoaW5nIHRoZSBEb2NrZXIgaW1hZ2UuLi4nLFxuICAgICAgICAgICAgICAgICdkb2NrZXIgcHVzaCAkUkVQT1NJVE9SWV9VUkk6bGF0ZXN0JyxcbiAgICAgICAgICAgICAgICAnZG9ja2VyIHB1c2ggJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcnLFxuICAgICAgICAgICAgICAgICdlY2hvIFdyaXRpbmcgaW1hZ2UgZGVmaW5pdGlvbnMgZmlsZS4uLicsXG4gICAgICAgICAgICAgICAgJ3ByaW50ZiBcXCdbe1wibmFtZVwiOlwiJXNcIixcImltYWdlVXJpXCI6XCIlc1wifV1cXCcgJENPTlRBSU5FUl9OQU1FICRSRVBPU0lUT1JZX1VSSTokSU1BR0VfVEFHID4gaW1hZ2VkZWZpbml0aW9ucy5qc29uJyxcbiAgICAgICAgICAgICAgICAnY2F0IGltYWdlZGVmaW5pdGlvbnMuanNvbicsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYXJ0aWZhY3RzOiB7XG4gICAgICAgICAgICBmaWxlczogWydkYXNoYm9hcmQvaW1hZ2VkZWZpbml0aW9ucy5qc29uJ10sXG4gICAgICAgICAgICAnZGlzY2FyZC1wYXRocyc6ICd5ZXMnLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0pLFxuICAgICAgfVxuICAgICk7XG5cbiAgICAvLyBFMkUgdGVzdCBwcm9qZWN0XG4gICAgY29uc3QgZTJlQnVpbGQgPSBuZXcgY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdCh0aGlzLCAnRTJFQnVpbGQnLCB7XG4gICAgICBwcm9qZWN0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWUyZS10ZXN0YCxcbiAgICAgIHJvbGU6IGJ1aWxkUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuU1RBTkRBUkRfN18wLFxuICAgICAgICBwcml2aWxlZ2VkOiBmYWxzZSxcbiAgICAgICAgY29tcHV0ZVR5cGU6IGNvZGVidWlsZC5Db21wdXRlVHlwZS5NRURJVU0sXG4gICAgICAgIGVudmlyb25tZW50VmFyaWFibGVzOiB7XG4gICAgICAgICAgQ0k6IHsgdmFsdWU6ICd0cnVlJyB9LFxuICAgICAgICAgIFBMQVlXUklHSFRfQkFTRV9VUkw6IHsgdmFsdWU6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3Qoe1xuICAgICAgICB2ZXJzaW9uOiAnMC4yJyxcbiAgICAgICAgcGhhc2VzOiB7XG4gICAgICAgICAgaW5zdGFsbDoge1xuICAgICAgICAgICAgJ3J1bnRpbWUtdmVyc2lvbnMnOiB7XG4gICAgICAgICAgICAgIG5vZGVqczogMjAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gSW5zdGFsbGluZyBkZXBlbmRlbmNpZXMuLi4nLFxuICAgICAgICAgICAgICAnY2QgZGFzaGJvYXJkJyxcbiAgICAgICAgICAgICAgJ25wbSBjaScsXG4gICAgICAgICAgICAgICdlY2hvIEluc3RhbGxpbmcgUGxheXdyaWdodCBicm93c2Vycy4uLicsXG4gICAgICAgICAgICAgICducHggcGxheXdyaWdodCBpbnN0YWxsIGNocm9taXVtIC0td2l0aC1kZXBzJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVfYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdlY2hvIEJ1aWxkaW5nIGFwcGxpY2F0aW9uLi4uJyxcbiAgICAgICAgICAgICAgJ25wbSBydW4gYnVpbGQnLFxuICAgICAgICAgICAgICAnZWNobyBTdGFydGluZyBhcHBsaWNhdGlvbiBzZXJ2ZXIuLi4nLFxuICAgICAgICAgICAgICAnbnBtIHJ1biBzdGFydCAmJyxcbiAgICAgICAgICAgICAgJ3NsZWVwIDEwJyxcbiAgICAgICAgICAgICAgJ2VjaG8gVmVyaWZ5aW5nIHNlcnZlciBpcyB1cC4uLicsXG4gICAgICAgICAgICAgICdjdXJsIC1zIGh0dHA6Ly9sb2NhbGhvc3Q6MzAwMC9hcGkvaGVhbHRoIHx8IGV4aXQgMScsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdlY2hvIFJ1bm5pbmcgRTJFIHRlc3RzLi4uJyxcbiAgICAgICAgICAgICAgJ25wbSBydW4gdGVzdDplMmUgLS0gLS1yZXBvcnRlcj1qdW5pdCxodG1sJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwb3N0X2J1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnZWNobyBFMkUgdGVzdHMgY29tcGxldGVkJyxcbiAgICAgICAgICAgICAgJ3BraWxsIC1mIFwibmV4dCBzdGFydFwiIHx8IHRydWUnLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICByZXBvcnRzOiB7XG4gICAgICAgICAgJ2UyZS10ZXN0LXJlcG9ydHMnOiB7XG4gICAgICAgICAgICBmaWxlczogWyd0ZXN0LXJlc3VsdHMvZTJlLXJlc3VsdHMueG1sJ10sXG4gICAgICAgICAgICAnZmlsZS1mb3JtYXQnOiAnSlVOSVRYTUwnLFxuICAgICAgICAgICAgJ2Jhc2UtZGlyZWN0b3J5JzogJ2Rhc2hib2FyZCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgYXJ0aWZhY3RzOiB7XG4gICAgICAgICAgZmlsZXM6IFtcbiAgICAgICAgICAgICdkYXNoYm9hcmQvcGxheXdyaWdodC1yZXBvcnQvKiovKicsXG4gICAgICAgICAgICAnZGFzaGJvYXJkL3Rlc3QtcmVzdWx0cy8qKi8qJyxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICB0aW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygzMCksXG4gICAgfSk7XG5cbiAgICAvLyBBUEkgYnVpbGQgcHJvamVjdFxuICAgIGNvbnN0IGFwaUJ1aWxkID0gbmV3IGNvZGVidWlsZC5QaXBlbGluZVByb2plY3QodGhpcywgJ0FwaUJ1aWxkJywge1xuICAgICAgcHJvamVjdE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1hcGktYnVpbGRgLFxuICAgICAgcm9sZTogYnVpbGRSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgYnVpbGRJbWFnZTogY29kZWJ1aWxkLkxpbnV4QnVpbGRJbWFnZS5TVEFOREFSRF83XzAsXG4gICAgICAgIHByaXZpbGVnZWQ6IHRydWUsXG4gICAgICAgIGNvbXB1dGVUeXBlOiBjb2RlYnVpbGQuQ29tcHV0ZVR5cGUuTUVESVVNLFxuICAgICAgICBlbnZpcm9ubWVudFZhcmlhYmxlczoge1xuICAgICAgICAgIFJFUE9TSVRPUllfVVJJOiB7XG4gICAgICAgICAgICB2YWx1ZTogYXBpUmVwb3NpdG9yeS5yZXBvc2l0b3J5VXJpLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgQ09OVEFJTkVSX05BTUU6IHtcbiAgICAgICAgICAgIHZhbHVlOiAnYXBpJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEFXU19SRUdJT046IHtcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGJ1aWxkU3BlYzogY29kZWJ1aWxkLkJ1aWxkU3BlYy5mcm9tT2JqZWN0KHtcbiAgICAgICAgdmVyc2lvbjogJzAuMicsXG4gICAgICAgIHBoYXNlczoge1xuICAgICAgICAgIHByZV9idWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gTG9nZ2luZyBpbiB0byBBbWF6b24gRUNSLi4uJyxcbiAgICAgICAgICAgICAgJ2F3cyBlY3IgZ2V0LWxvZ2luLXBhc3N3b3JkIC0tcmVnaW9uICRBV1NfUkVHSU9OIHwgZG9ja2VyIGxvZ2luIC0tdXNlcm5hbWUgQVdTIC0tcGFzc3dvcmQtc3RkaW4gJFJFUE9TSVRPUllfVVJJJyxcbiAgICAgICAgICAgICAgJ2V4cG9ydCBDT01NSVRfSEFTSD0kKGVjaG8gJENPREVCVUlMRF9SRVNPTFZFRF9TT1VSQ0VfVkVSU0lPTiB8IGN1dCAtYyAxLTcpJyxcbiAgICAgICAgICAgICAgJ2V4cG9ydCBJTUFHRV9UQUc9JHtDT01NSVRfSEFTSDo9bGF0ZXN0fScsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdlY2hvIEJ1aWxkaW5nIHRoZSBEb2NrZXIgaW1hZ2UuLi4nLFxuICAgICAgICAgICAgICAnY2QgYXBpJyxcbiAgICAgICAgICAgICAgJ2RvY2tlciBidWlsZCAtLW5vLWNhY2hlIC10ICRSRVBPU0lUT1JZX1VSSTpsYXRlc3QgLXQgJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcgLicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcG9zdF9idWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gUHVzaGluZyB0aGUgRG9ja2VyIGltYWdlLi4uJyxcbiAgICAgICAgICAgICAgJ2RvY2tlciBwdXNoICRSRVBPU0lUT1JZX1VSSTpsYXRlc3QnLFxuICAgICAgICAgICAgICAnZG9ja2VyIHB1c2ggJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcnLFxuICAgICAgICAgICAgICAnZWNobyBXcml0aW5nIGltYWdlIGRlZmluaXRpb25zIGZpbGUuLi4nLFxuICAgICAgICAgICAgICAncHJpbnRmIFxcJ1t7XCJuYW1lXCI6XCIlc1wiLFwiaW1hZ2VVcmlcIjpcIiVzXCJ9XVxcJyAkQ09OVEFJTkVSX05BTUUgJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcgPiBpbWFnZWRlZmluaXRpb25zLmpzb24nLFxuICAgICAgICAgICAgICAnY2F0IGltYWdlZGVmaW5pdGlvbnMuanNvbicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGFydGlmYWN0czoge1xuICAgICAgICAgIGZpbGVzOiBbJ2FwaS9pbWFnZWRlZmluaXRpb25zLmpzb24nXSxcbiAgICAgICAgICAnZGlzY2FyZC1wYXRocyc6ICd5ZXMnLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBjYWNoZTogY29kZWJ1aWxkLkNhY2hlLmxvY2FsKGNvZGVidWlsZC5Mb2NhbENhY2hlTW9kZS5ET0NLRVJfTEFZRVIpLFxuICAgIH0pO1xuXG4gICAgLy8gV29ya2VyIGJ1aWxkIHByb2plY3RcbiAgICBjb25zdCB3b3JrZXJCdWlsZCA9IG5ldyBjb2RlYnVpbGQuUGlwZWxpbmVQcm9qZWN0KHRoaXMsICdXb3JrZXJCdWlsZCcsIHtcbiAgICAgIHByb2plY3ROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0td29ya2VyLWJ1aWxkYCxcbiAgICAgIHJvbGU6IGJ1aWxkUm9sZSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuU1RBTkRBUkRfN18wLFxuICAgICAgICBwcml2aWxlZ2VkOiB0cnVlLFxuICAgICAgICBjb21wdXRlVHlwZTogY29kZWJ1aWxkLkNvbXB1dGVUeXBlLk1FRElVTSxcbiAgICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgICBSRVBPU0lUT1JZX1VSSToge1xuICAgICAgICAgICAgdmFsdWU6IHdvcmtlclJlcG9zaXRvcnkucmVwb3NpdG9yeVVyaSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIENPTlRBSU5FUl9OQU1FOiB7XG4gICAgICAgICAgICB2YWx1ZTogJ3dvcmtlcicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBBV1NfUkVHSU9OOiB7XG4gICAgICAgICAgICB2YWx1ZTogdGhpcy5yZWdpb24sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBidWlsZFNwZWM6IGNvZGVidWlsZC5CdWlsZFNwZWMuZnJvbU9iamVjdCh7XG4gICAgICAgIHZlcnNpb246ICcwLjInLFxuICAgICAgICBwaGFzZXM6IHtcbiAgICAgICAgICBwcmVfYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdlY2hvIExvZ2dpbmcgaW4gdG8gQW1hem9uIEVDUi4uLicsXG4gICAgICAgICAgICAgICdhd3MgZWNyIGdldC1sb2dpbi1wYXNzd29yZCAtLXJlZ2lvbiAkQVdTX1JFR0lPTiB8IGRvY2tlciBsb2dpbiAtLXVzZXJuYW1lIEFXUyAtLXBhc3N3b3JkLXN0ZGluICRSRVBPU0lUT1JZX1VSSScsXG4gICAgICAgICAgICAgICdleHBvcnQgQ09NTUlUX0hBU0g9JChlY2hvICRDT0RFQlVJTERfUkVTT0xWRURfU09VUkNFX1ZFUlNJT04gfCBjdXQgLWMgMS03KScsXG4gICAgICAgICAgICAgICdleHBvcnQgSU1BR0VfVEFHPSR7Q09NTUlUX0hBU0g6PWxhdGVzdH0nLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnZWNobyBCdWlsZGluZyB0aGUgRG9ja2VyIGltYWdlLi4uJyxcbiAgICAgICAgICAgICAgJ2NkIHdvcmtlcicsXG4gICAgICAgICAgICAgICdkb2NrZXIgYnVpbGQgLS1uby1jYWNoZSAtdCAkUkVQT1NJVE9SWV9VUkk6bGF0ZXN0IC10ICRSRVBPU0lUT1JZX1VSSTokSU1BR0VfVEFHIC4nLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHBvc3RfYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdlY2hvIFB1c2hpbmcgdGhlIERvY2tlciBpbWFnZS4uLicsXG4gICAgICAgICAgICAgICdkb2NrZXIgcHVzaCAkUkVQT1NJVE9SWV9VUkk6bGF0ZXN0JyxcbiAgICAgICAgICAgICAgJ2RvY2tlciBwdXNoICRSRVBPU0lUT1JZX1VSSTokSU1BR0VfVEFHJyxcbiAgICAgICAgICAgICAgJ2VjaG8gV3JpdGluZyBpbWFnZSBkZWZpbml0aW9ucyBmaWxlLi4uJyxcbiAgICAgICAgICAgICAgJ3ByaW50ZiBcXCdbe1wibmFtZVwiOlwiJXNcIixcImltYWdlVXJpXCI6XCIlc1wifV1cXCcgJENPTlRBSU5FUl9OQU1FICRSRVBPU0lUT1JZX1VSSTokSU1BR0VfVEFHID4gaW1hZ2VkZWZpbml0aW9ucy5qc29uJyxcbiAgICAgICAgICAgICAgJ2NhdCBpbWFnZWRlZmluaXRpb25zLmpzb24nLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBhcnRpZmFjdHM6IHtcbiAgICAgICAgICBmaWxlczogWyd3b3JrZXIvaW1hZ2VkZWZpbml0aW9ucy5qc29uJ10sXG4gICAgICAgICAgJ2Rpc2NhcmQtcGF0aHMnOiAneWVzJyxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgY2FjaGU6IGNvZGVidWlsZC5DYWNoZS5sb2NhbChjb2RlYnVpbGQuTG9jYWxDYWNoZU1vZGUuRE9DS0VSX0xBWUVSKSxcbiAgICB9KTtcblxuICAgIC8vIFBpcGVsaW5lXG4gICAgdGhpcy5waXBlbGluZSA9IG5ldyBjb2RlcGlwZWxpbmUuUGlwZWxpbmUodGhpcywgJ1BpcGVsaW5lJywge1xuICAgICAgcGlwZWxpbmVOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tcGlwZWxpbmVgLFxuICAgICAgcGlwZWxpbmVUeXBlOiBjb2RlcGlwZWxpbmUuUGlwZWxpbmVUeXBlLlYyLFxuICAgICAgcmVzdGFydEV4ZWN1dGlvbk9uVXBkYXRlOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8gU291cmNlIHN0YWdlIC0gR2l0SHViIHZpYSBDb2RlU3RhciBDb25uZWN0aW9uc1xuICAgIC8vIE5vdGU6IFlvdSBuZWVkIHRvIGNyZWF0ZSBhIENvZGVTdGFyIGNvbm5lY3Rpb24gbWFudWFsbHkgYW5kIHVwZGF0ZSB0aGUgQVJOXG4gICAgY29uc3Qgc291cmNlQWN0aW9uID0gbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNvZGVTdGFyQ29ubmVjdGlvbnNTb3VyY2VBY3Rpb24oe1xuICAgICAgYWN0aW9uTmFtZTogJ0dpdEh1Yl9Tb3VyY2UnLFxuICAgICAgb3duZXI6ICd0ZWdyeWFuLWRkbycsIC8vIFVwZGF0ZSB3aXRoIGFjdHVhbCBvd25lclxuICAgICAgcmVwbzogJ21ldGlzJywgLy8gVXBkYXRlIHdpdGggYWN0dWFsIHJlcG9cbiAgICAgIGJyYW5jaDogJ21haW4nLFxuICAgICAgb3V0cHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICBjb25uZWN0aW9uQXJuOiAnYXJuOmF3czpjb2RlY29ubmVjdGlvbnM6dXMtZWFzdC0xOjg4MjM4NDg3OTIzNTpjb25uZWN0aW9uLzM2YjE3ZDI1LWE0Y2MtNDY3ZC05NGZiLTRjZWE1ZTZiYzk4NicsXG4gICAgICB0cmlnZ2VyT25QdXNoOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgdGhpcy5waXBlbGluZS5hZGRTdGFnZSh7XG4gICAgICBzdGFnZU5hbWU6ICdTb3VyY2UnLFxuICAgICAgYWN0aW9uczogW3NvdXJjZUFjdGlvbl0sXG4gICAgfSk7XG5cbiAgICAvLyBCdWlsZCBzdGFnZSAtIHBhcmFsbGVsIGJ1aWxkc1xuICAgIHRoaXMucGlwZWxpbmUuYWRkU3RhZ2Uoe1xuICAgICAgc3RhZ2VOYW1lOiAnQnVpbGQnLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUJ1aWxkQWN0aW9uKHtcbiAgICAgICAgICBhY3Rpb25OYW1lOiAnQnVpbGRfRGFzaGJvYXJkJyxcbiAgICAgICAgICBwcm9qZWN0OiBkYXNoYm9hcmRCdWlsZCxcbiAgICAgICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgICAgIG91dHB1dHM6IFtkYXNoYm9hcmRCdWlsZE91dHB1dF0sXG4gICAgICAgICAgcnVuT3JkZXI6IDEsXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUJ1aWxkQWN0aW9uKHtcbiAgICAgICAgICBhY3Rpb25OYW1lOiAnQnVpbGRfQVBJJyxcbiAgICAgICAgICBwcm9qZWN0OiBhcGlCdWlsZCxcbiAgICAgICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgICAgIG91dHB1dHM6IFthcGlCdWlsZE91dHB1dF0sXG4gICAgICAgICAgcnVuT3JkZXI6IDEsIC8vIFNhbWUgcnVuT3JkZXIgZm9yIHBhcmFsbGVsIGV4ZWN1dGlvblxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkNvZGVCdWlsZEFjdGlvbih7XG4gICAgICAgICAgYWN0aW9uTmFtZTogJ0J1aWxkX1dvcmtlcicsXG4gICAgICAgICAgcHJvamVjdDogd29ya2VyQnVpbGQsXG4gICAgICAgICAgaW5wdXQ6IHNvdXJjZU91dHB1dCxcbiAgICAgICAgICBvdXRwdXRzOiBbd29ya2VyQnVpbGRPdXRwdXRdLFxuICAgICAgICAgIHJ1bk9yZGVyOiAxLCAvLyBTYW1lIHJ1bk9yZGVyIGZvciBwYXJhbGxlbCBleGVjdXRpb25cbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95IHN0YWdlIC0gRUNTIHJvbGxpbmcgZGVwbG95bWVudFxuICAgIHRoaXMucGlwZWxpbmUuYWRkU3RhZ2Uoe1xuICAgICAgc3RhZ2VOYW1lOiAnRGVwbG95JyxcbiAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkVjc0RlcGxveUFjdGlvbih7XG4gICAgICAgICAgYWN0aW9uTmFtZTogJ0RlcGxveV9EYXNoYm9hcmQnLFxuICAgICAgICAgIHNlcnZpY2U6IGRhc2hib2FyZFNlcnZpY2UsXG4gICAgICAgICAgaW5wdXQ6IGRhc2hib2FyZEJ1aWxkT3V0cHV0LFxuICAgICAgICAgIGRlcGxveW1lbnRUaW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICAgICAgcnVuT3JkZXI6IDEsXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuRWNzRGVwbG95QWN0aW9uKHtcbiAgICAgICAgICBhY3Rpb25OYW1lOiAnRGVwbG95X0FQSScsXG4gICAgICAgICAgc2VydmljZTogYXBpU2VydmljZSxcbiAgICAgICAgICBpbnB1dDogYXBpQnVpbGRPdXRwdXQsXG4gICAgICAgICAgZGVwbG95bWVudFRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgICAgICBydW5PcmRlcjogMSwgLy8gU2FtZSBydW5PcmRlciBmb3IgcGFyYWxsZWwgZGVwbG95bWVudFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkVjc0RlcGxveUFjdGlvbih7XG4gICAgICAgICAgYWN0aW9uTmFtZTogJ0RlcGxveV9Xb3JrZXInLFxuICAgICAgICAgIHNlcnZpY2U6IHdvcmtlclNlcnZpY2UsXG4gICAgICAgICAgaW5wdXQ6IHdvcmtlckJ1aWxkT3V0cHV0LFxuICAgICAgICAgIGRlcGxveW1lbnRUaW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICAgICAgcnVuT3JkZXI6IDEsIC8vIFNhbWUgcnVuT3JkZXIgZm9yIHBhcmFsbGVsIGRlcGxveW1lbnRcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gRTJFIFRlc3Qgc3RhZ2UgLSBydW5zIGFmdGVyIGRlcGxveW1lbnRcbiAgICBjb25zdCBlMmVUZXN0T3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgnRTJFVGVzdE91dHB1dCcpO1xuICAgIHRoaXMucGlwZWxpbmUuYWRkU3RhZ2Uoe1xuICAgICAgc3RhZ2VOYW1lOiAnRTJFX1Rlc3QnLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUJ1aWxkQWN0aW9uKHtcbiAgICAgICAgICBhY3Rpb25OYW1lOiAnUnVuX0UyRV9UZXN0cycsXG4gICAgICAgICAgcHJvamVjdDogZTJlQnVpbGQsXG4gICAgICAgICAgaW5wdXQ6IHNvdXJjZU91dHB1dCxcbiAgICAgICAgICBvdXRwdXRzOiBbZTJlVGVzdE91dHB1dF0sXG4gICAgICAgICAgcnVuT3JkZXI6IDEsXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIE91dHB1dHNcbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGlwZWxpbmVBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5waXBlbGluZS5waXBlbGluZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGlwZWxpbmUgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1waXBlbGluZS1hcm5gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1BpcGVsaW5lVXJsJywge1xuICAgICAgdmFsdWU6IGBodHRwczovLyR7dGhpcy5yZWdpb259LmNvbnNvbGUuYXdzLmFtYXpvbi5jb20vY29kZXN1aXRlL2NvZGVwaXBlbGluZS9waXBlbGluZXMvJHt0aGlzLnBpcGVsaW5lLnBpcGVsaW5lTmFtZX0vdmlld2AsXG4gICAgICBkZXNjcmlwdGlvbjogJ1BpcGVsaW5lIGNvbnNvbGUgVVJMJyxcbiAgICB9KTtcbiAgfVxufVxuIl19