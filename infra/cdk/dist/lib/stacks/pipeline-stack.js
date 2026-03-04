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
        const { projectName, environment, dashboardRepository, apiRepository, workerRepository, dashboardService, apiService, workerService, cluster, } = props;
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
                            'echo Building the Docker image...',
                            'cd dashboard',
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
                    files: ['dashboard/imagedefinitions.json'],
                    'discard-paths': 'yes',
                },
            }),
            cache: codebuild.Cache.local(codebuild.LocalCacheMode.DOCKER_LAYER),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZWxpbmUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvc3RhY2tzL3BpcGVsaW5lLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywyRUFBNkQ7QUFDN0QsMkZBQTZFO0FBQzdFLHFFQUF1RDtBQUd2RCx5REFBMkM7QUFlM0M7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSxhQUFjLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDMUIsUUFBUSxDQUF3QjtJQUVoRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFDSixXQUFXLEVBQ1gsV0FBVyxFQUNYLG1CQUFtQixFQUNuQixhQUFhLEVBQ2IsZ0JBQWdCLEVBQ2hCLGdCQUFnQixFQUNoQixVQUFVLEVBQ1YsYUFBYSxFQUNiLE9BQU8sR0FDUixHQUFHLEtBQUssQ0FBQztRQUVWLGtCQUFrQjtRQUNsQixNQUFNLFlBQVksR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDL0QsTUFBTSxvQkFBb0IsR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUMvRSxNQUFNLGNBQWMsR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUNuRSxNQUFNLGlCQUFpQixHQUFHLElBQUksWUFBWSxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1FBRXpFLHNDQUFzQztRQUN0QyxNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUNoRCxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JB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TyxDQUFDLEVBQUUsQ0FBQztvQkFDM0MsUUFBUSxFQUFFLENBQUMsRUFBRSx3Q0FBd0M7aUJBQ3RELENBQUM7YUFDSDtTQUNGLENBQUMsQ0FBQztRQUVILHlDQUF5QztRQUN6QyxNQUFNLGFBQWEsR0FBRyxJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDakUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUM7WUFDckIsU0FBUyxFQUFFLFVBQVU7WUFDckIsT0FBTyxFQUFFO2dCQUNQLElBQUksb0JBQW9CLENBQUMsZUFBZSxDQUFDO29CQUN2QyxVQUFVLEVBQUUsZUFBZTtvQkFDM0IsT0FBTyxFQUFFLFFBQVE7b0JBQ2pCLEtBQUssRUFBRSxZQUFZO29CQUNuQixPQUFPLEVBQUUsQ0FBQyxhQUFhLENBQUM7b0JBQ3hCLFFBQVEsRUFBRSxDQUFDO2lCQUNaLENBQUM7YUFDSDtTQUNGLENBQUMsQ0FBQztRQUVILFVBQVU7UUFDVixJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNyQyxLQUFLLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXO1lBQ2hDLFdBQVcsRUFBRSxjQUFjO1lBQzNCLFVBQVUsRUFBRSxHQUFHLFdBQVcsSUFBSSxXQUFXLGVBQWU7U0FDekQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7WUFDckMsS0FBSyxFQUFFLFdBQVcsSUFBSSxDQUFDLE1BQU0sNERBQTRELElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxPQUFPO1lBQzFILFdBQVcsRUFBRSxzQkFBc0I7U0FDcEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBallELHNDQWlZQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBjb2RlcGlwZWxpbmUgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZGVwaXBlbGluZSc7XG5pbXBvcnQgKiBhcyBjb2RlcGlwZWxpbmVfYWN0aW9ucyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29kZXBpcGVsaW5lLWFjdGlvbnMnO1xuaW1wb3J0ICogYXMgY29kZWJ1aWxkIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2RlYnVpbGQnO1xuaW1wb3J0ICogYXMgZWNyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3InO1xuaW1wb3J0ICogYXMgZWNzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3MnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGlwZWxpbmVTdGFja1Byb3BzIGV4dGVuZHMgY2RrLlN0YWNrUHJvcHMge1xuICBwcm9qZWN0TmFtZTogc3RyaW5nO1xuICBlbnZpcm9ubWVudDogc3RyaW5nO1xuICBkYXNoYm9hcmRSZXBvc2l0b3J5OiBlY3IuUmVwb3NpdG9yeTtcbiAgYXBpUmVwb3NpdG9yeTogZWNyLlJlcG9zaXRvcnk7XG4gIHdvcmtlclJlcG9zaXRvcnk6IGVjci5SZXBvc2l0b3J5O1xuICBkYXNoYm9hcmRTZXJ2aWNlOiBlY3MuRmFyZ2F0ZVNlcnZpY2U7XG4gIGFwaVNlcnZpY2U6IGVjcy5GYXJnYXRlU2VydmljZTtcbiAgd29ya2VyU2VydmljZTogZWNzLkZhcmdhdGVTZXJ2aWNlO1xuICBjbHVzdGVyOiBlY3MuQ2x1c3Rlcjtcbn1cblxuLyoqXG4gKiBQaXBlbGluZSBTdGFjayAtIENvZGVQaXBlbGluZSArIENvZGVCdWlsZCBmb3IgQ0kvQ0RcbiAqXG4gKiBDcmVhdGVzOlxuICogLSBDb2RlUGlwZWxpbmUgd2l0aCBTb3VyY2UsIEJ1aWxkLCBhbmQgRGVwbG95IHN0YWdlc1xuICogLSBQYXJhbGxlbCBDb2RlQnVpbGQgcHJvamVjdHMgZm9yIGRhc2hib2FyZCBhbmQgQVBJXG4gKiAtIEVDUyByb2xsaW5nIGRlcGxveW1lbnQgd2l0aCBjaXJjdWl0IGJyZWFrZXJcbiAqXG4gKiBOb3RlOiBSZXF1aXJlcyBHaXRIdWIgQ29kZVN0YXIgY29ubmVjdGlvbiB0byBiZSBjb25maWd1cmVkXG4gKi9cbmV4cG9ydCBjbGFzcyBQaXBlbGluZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHBpcGVsaW5lOiBjb2RlcGlwZWxpbmUuUGlwZWxpbmU7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFBpcGVsaW5lU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3Qge1xuICAgICAgcHJvamVjdE5hbWUsXG4gICAgICBlbnZpcm9ubWVudCxcbiAgICAgIGRhc2hib2FyZFJlcG9zaXRvcnksXG4gICAgICBhcGlSZXBvc2l0b3J5LFxuICAgICAgd29ya2VyUmVwb3NpdG9yeSxcbiAgICAgIGRhc2hib2FyZFNlcnZpY2UsXG4gICAgICBhcGlTZXJ2aWNlLFxuICAgICAgd29ya2VyU2VydmljZSxcbiAgICAgIGNsdXN0ZXIsXG4gICAgfSA9IHByb3BzO1xuXG4gICAgLy8gU291cmNlIGFydGlmYWN0XG4gICAgY29uc3Qgc291cmNlT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgnU291cmNlT3V0cHV0Jyk7XG4gICAgY29uc3QgZGFzaGJvYXJkQnVpbGRPdXRwdXQgPSBuZXcgY29kZXBpcGVsaW5lLkFydGlmYWN0KCdEYXNoYm9hcmRCdWlsZE91dHB1dCcpO1xuICAgIGNvbnN0IGFwaUJ1aWxkT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgnQXBpQnVpbGRPdXRwdXQnKTtcbiAgICBjb25zdCB3b3JrZXJCdWlsZE91dHB1dCA9IG5ldyBjb2RlcGlwZWxpbmUuQXJ0aWZhY3QoJ1dvcmtlckJ1aWxkT3V0cHV0Jyk7XG5cbiAgICAvLyBDb2RlQnVpbGQgcm9sZSB3aXRoIEVDUiBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IGJ1aWxkUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCAnQnVpbGRSb2xlJywge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoJ2NvZGVidWlsZC5hbWF6b25hd3MuY29tJyksXG4gICAgICByb2xlTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWNvZGVidWlsZC1yb2xlYCxcbiAgICB9KTtcblxuICAgIGRhc2hib2FyZFJlcG9zaXRvcnkuZ3JhbnRQdWxsUHVzaChidWlsZFJvbGUpO1xuICAgIGFwaVJlcG9zaXRvcnkuZ3JhbnRQdWxsUHVzaChidWlsZFJvbGUpO1xuICAgIHdvcmtlclJlcG9zaXRvcnkuZ3JhbnRQdWxsUHVzaChidWlsZFJvbGUpO1xuXG4gICAgLy8gRGFzaGJvYXJkIGJ1aWxkIHByb2plY3RcbiAgICBjb25zdCBkYXNoYm9hcmRCdWlsZCA9IG5ldyBjb2RlYnVpbGQuUGlwZWxpbmVQcm9qZWN0KFxuICAgICAgdGhpcyxcbiAgICAgICdEYXNoYm9hcmRCdWlsZCcsXG4gICAgICB7XG4gICAgICAgIHByb2plY3ROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZGFzaGJvYXJkLWJ1aWxkYCxcbiAgICAgICAgcm9sZTogYnVpbGRSb2xlLFxuICAgICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICAgIGJ1aWxkSW1hZ2U6IGNvZGVidWlsZC5MaW51eEJ1aWxkSW1hZ2UuU1RBTkRBUkRfN18wLFxuICAgICAgICAgIHByaXZpbGVnZWQ6IHRydWUsIC8vIFJlcXVpcmVkIGZvciBEb2NrZXJcbiAgICAgICAgICBjb21wdXRlVHlwZTogY29kZWJ1aWxkLkNvbXB1dGVUeXBlLk1FRElVTSxcbiAgICAgICAgICBlbnZpcm9ubWVudFZhcmlhYmxlczoge1xuICAgICAgICAgICAgUkVQT1NJVE9SWV9VUkk6IHtcbiAgICAgICAgICAgICAgdmFsdWU6IGRhc2hib2FyZFJlcG9zaXRvcnkucmVwb3NpdG9yeVVyaSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBDT05UQUlORVJfTkFNRToge1xuICAgICAgICAgICAgICB2YWx1ZTogJ2Rhc2hib2FyZCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgQVdTX1JFR0lPTjoge1xuICAgICAgICAgICAgICB2YWx1ZTogdGhpcy5yZWdpb24sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGJ1aWxkU3BlYzogY29kZWJ1aWxkLkJ1aWxkU3BlYy5mcm9tT2JqZWN0KHtcbiAgICAgICAgICB2ZXJzaW9uOiAnMC4yJyxcbiAgICAgICAgICBwaGFzZXM6IHtcbiAgICAgICAgICAgIHByZV9idWlsZDoge1xuICAgICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAgICdlY2hvIExvZ2dpbmcgaW4gdG8gQW1hem9uIEVDUi4uLicsXG4gICAgICAgICAgICAgICAgJ2F3cyBlY3IgZ2V0LWxvZ2luLXBhc3N3b3JkIC0tcmVnaW9uICRBV1NfUkVHSU9OIHwgZG9ja2VyIGxvZ2luIC0tdXNlcm5hbWUgQVdTIC0tcGFzc3dvcmQtc3RkaW4gJFJFUE9TSVRPUllfVVJJJyxcbiAgICAgICAgICAgICAgICAnZXhwb3J0IENPTU1JVF9IQVNIPSQoZWNobyAkQ09ERUJVSUxEX1JFU09MVkVEX1NPVVJDRV9WRVJTSU9OIHwgY3V0IC1jIDEtNyknLFxuICAgICAgICAgICAgICAgICdleHBvcnQgSU1BR0VfVEFHPSR7Q09NTUlUX0hBU0g6PWxhdGVzdH0nLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICAgJ2VjaG8gQnVpbGRpbmcgdGhlIERvY2tlciBpbWFnZS4uLicsXG4gICAgICAgICAgICAgICAgJ2NkIGRhc2hib2FyZCcsXG4gICAgICAgICAgICAgICAgJ2RvY2tlciBidWlsZCAtLW5vLWNhY2hlIC10ICRSRVBPU0lUT1JZX1VSSTpsYXRlc3QgLXQgJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcgLicsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcG9zdF9idWlsZDoge1xuICAgICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAgICdlY2hvIFB1c2hpbmcgdGhlIERvY2tlciBpbWFnZS4uLicsXG4gICAgICAgICAgICAgICAgJ2RvY2tlciBwdXNoICRSRVBPU0lUT1JZX1VSSTpsYXRlc3QnLFxuICAgICAgICAgICAgICAgICdkb2NrZXIgcHVzaCAkUkVQT1NJVE9SWV9VUkk6JElNQUdFX1RBRycsXG4gICAgICAgICAgICAgICAgJ2VjaG8gV3JpdGluZyBpbWFnZSBkZWZpbml0aW9ucyBmaWxlLi4uJyxcbiAgICAgICAgICAgICAgICAncHJpbnRmIFxcJ1t7XCJuYW1lXCI6XCIlc1wiLFwiaW1hZ2VVcmlcIjpcIiVzXCJ9XVxcJyAkQ09OVEFJTkVSX05BTUUgJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcgPiBpbWFnZWRlZmluaXRpb25zLmpzb24nLFxuICAgICAgICAgICAgICAgICdjYXQgaW1hZ2VkZWZpbml0aW9ucy5qc29uJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBhcnRpZmFjdHM6IHtcbiAgICAgICAgICAgIGZpbGVzOiBbJ2Rhc2hib2FyZC9pbWFnZWRlZmluaXRpb25zLmpzb24nXSxcbiAgICAgICAgICAgICdkaXNjYXJkLXBhdGhzJzogJ3llcycsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIGNhY2hlOiBjb2RlYnVpbGQuQ2FjaGUubG9jYWwoY29kZWJ1aWxkLkxvY2FsQ2FjaGVNb2RlLkRPQ0tFUl9MQVlFUiksXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEUyRSB0ZXN0IHByb2plY3RcbiAgICBjb25zdCBlMmVCdWlsZCA9IG5ldyBjb2RlYnVpbGQuUGlwZWxpbmVQcm9qZWN0KHRoaXMsICdFMkVCdWlsZCcsIHtcbiAgICAgIHByb2plY3ROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tZTJlLXRlc3RgLFxuICAgICAgcm9sZTogYnVpbGRSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgYnVpbGRJbWFnZTogY29kZWJ1aWxkLkxpbnV4QnVpbGRJbWFnZS5TVEFOREFSRF83XzAsXG4gICAgICAgIHByaXZpbGVnZWQ6IGZhbHNlLFxuICAgICAgICBjb21wdXRlVHlwZTogY29kZWJ1aWxkLkNvbXB1dGVUeXBlLk1FRElVTSxcbiAgICAgICAgZW52aXJvbm1lbnRWYXJpYWJsZXM6IHtcbiAgICAgICAgICBDSTogeyB2YWx1ZTogJ3RydWUnIH0sXG4gICAgICAgICAgUExBWVdSSUdIVF9CQVNFX1VSTDogeyB2YWx1ZTogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBidWlsZFNwZWM6IGNvZGVidWlsZC5CdWlsZFNwZWMuZnJvbU9iamVjdCh7XG4gICAgICAgIHZlcnNpb246ICcwLjInLFxuICAgICAgICBwaGFzZXM6IHtcbiAgICAgICAgICBpbnN0YWxsOiB7XG4gICAgICAgICAgICAncnVudGltZS12ZXJzaW9ucyc6IHtcbiAgICAgICAgICAgICAgbm9kZWpzOiAyMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnZWNobyBJbnN0YWxsaW5nIGRlcGVuZGVuY2llcy4uLicsXG4gICAgICAgICAgICAgICdjZCBkYXNoYm9hcmQnLFxuICAgICAgICAgICAgICAnbnBtIGNpJyxcbiAgICAgICAgICAgICAgJ2VjaG8gSW5zdGFsbGluZyBQbGF5d3JpZ2h0IGJyb3dzZXJzLi4uJyxcbiAgICAgICAgICAgICAgJ25weCBwbGF5d3JpZ2h0IGluc3RhbGwgY2hyb21pdW0gLS13aXRoLWRlcHMnLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHByZV9idWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gQnVpbGRpbmcgYXBwbGljYXRpb24uLi4nLFxuICAgICAgICAgICAgICAnbnBtIHJ1biBidWlsZCcsXG4gICAgICAgICAgICAgICdlY2hvIFN0YXJ0aW5nIGFwcGxpY2F0aW9uIHNlcnZlci4uLicsXG4gICAgICAgICAgICAgICducG0gcnVuIHN0YXJ0ICYnLFxuICAgICAgICAgICAgICAnc2xlZXAgMTAnLFxuICAgICAgICAgICAgICAnZWNobyBWZXJpZnlpbmcgc2VydmVyIGlzIHVwLi4uJyxcbiAgICAgICAgICAgICAgJ2N1cmwgLXMgaHR0cDovL2xvY2FsaG9zdDozMDAwL2FwaS9oZWFsdGggfHwgZXhpdCAxJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gUnVubmluZyBFMkUgdGVzdHMuLi4nLFxuICAgICAgICAgICAgICAnbnBtIHJ1biB0ZXN0OmUyZSAtLSAtLXJlcG9ydGVyPWp1bml0LGh0bWwnLFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHBvc3RfYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdlY2hvIEUyRSB0ZXN0cyBjb21wbGV0ZWQnLFxuICAgICAgICAgICAgICAncGtpbGwgLWYgXCJuZXh0IHN0YXJ0XCIgfHwgdHJ1ZScsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIHJlcG9ydHM6IHtcbiAgICAgICAgICAnZTJlLXRlc3QtcmVwb3J0cyc6IHtcbiAgICAgICAgICAgIGZpbGVzOiBbJ3Rlc3QtcmVzdWx0cy9lMmUtcmVzdWx0cy54bWwnXSxcbiAgICAgICAgICAgICdmaWxlLWZvcm1hdCc6ICdKVU5JVFhNTCcsXG4gICAgICAgICAgICAnYmFzZS1kaXJlY3RvcnknOiAnZGFzaGJvYXJkJyxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBhcnRpZmFjdHM6IHtcbiAgICAgICAgICBmaWxlczogW1xuICAgICAgICAgICAgJ2Rhc2hib2FyZC9wbGF5d3JpZ2h0LXJlcG9ydC8qKi8qJyxcbiAgICAgICAgICAgICdkYXNoYm9hcmQvdGVzdC1yZXN1bHRzLyoqLyonLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIHRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDMwKSxcbiAgICB9KTtcblxuICAgIC8vIEFQSSBidWlsZCBwcm9qZWN0XG4gICAgY29uc3QgYXBpQnVpbGQgPSBuZXcgY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdCh0aGlzLCAnQXBpQnVpbGQnLCB7XG4gICAgICBwcm9qZWN0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFwaS1idWlsZGAsXG4gICAgICByb2xlOiBidWlsZFJvbGUsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBidWlsZEltYWdlOiBjb2RlYnVpbGQuTGludXhCdWlsZEltYWdlLlNUQU5EQVJEXzdfMCxcbiAgICAgICAgcHJpdmlsZWdlZDogdHJ1ZSxcbiAgICAgICAgY29tcHV0ZVR5cGU6IGNvZGVidWlsZC5Db21wdXRlVHlwZS5NRURJVU0sXG4gICAgICAgIGVudmlyb25tZW50VmFyaWFibGVzOiB7XG4gICAgICAgICAgUkVQT1NJVE9SWV9VUkk6IHtcbiAgICAgICAgICAgIHZhbHVlOiBhcGlSZXBvc2l0b3J5LnJlcG9zaXRvcnlVcmksXG4gICAgICAgICAgfSxcbiAgICAgICAgICBDT05UQUlORVJfTkFNRToge1xuICAgICAgICAgICAgdmFsdWU6ICdhcGknLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgQVdTX1JFR0lPTjoge1xuICAgICAgICAgICAgdmFsdWU6IHRoaXMucmVnaW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3Qoe1xuICAgICAgICB2ZXJzaW9uOiAnMC4yJyxcbiAgICAgICAgcGhhc2VzOiB7XG4gICAgICAgICAgcHJlX2J1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnZWNobyBMb2dnaW5nIGluIHRvIEFtYXpvbiBFQ1IuLi4nLFxuICAgICAgICAgICAgICAnYXdzIGVjciBnZXQtbG9naW4tcGFzc3dvcmQgLS1yZWdpb24gJEFXU19SRUdJT04gfCBkb2NrZXIgbG9naW4gLS11c2VybmFtZSBBV1MgLS1wYXNzd29yZC1zdGRpbiAkUkVQT1NJVE9SWV9VUkknLFxuICAgICAgICAgICAgICAnZXhwb3J0IENPTU1JVF9IQVNIPSQoZWNobyAkQ09ERUJVSUxEX1JFU09MVkVEX1NPVVJDRV9WRVJTSU9OIHwgY3V0IC1jIDEtNyknLFxuICAgICAgICAgICAgICAnZXhwb3J0IElNQUdFX1RBRz0ke0NPTU1JVF9IQVNIOj1sYXRlc3R9JyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gQnVpbGRpbmcgdGhlIERvY2tlciBpbWFnZS4uLicsXG4gICAgICAgICAgICAgICdjZCBhcGknLFxuICAgICAgICAgICAgICAnZG9ja2VyIGJ1aWxkIC0tbm8tY2FjaGUgLXQgJFJFUE9TSVRPUllfVVJJOmxhdGVzdCAtdCAkUkVQT1NJVE9SWV9VUkk6JElNQUdFX1RBRyAuJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwb3N0X2J1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnZWNobyBQdXNoaW5nIHRoZSBEb2NrZXIgaW1hZ2UuLi4nLFxuICAgICAgICAgICAgICAnZG9ja2VyIHB1c2ggJFJFUE9TSVRPUllfVVJJOmxhdGVzdCcsXG4gICAgICAgICAgICAgICdkb2NrZXIgcHVzaCAkUkVQT1NJVE9SWV9VUkk6JElNQUdFX1RBRycsXG4gICAgICAgICAgICAgICdlY2hvIFdyaXRpbmcgaW1hZ2UgZGVmaW5pdGlvbnMgZmlsZS4uLicsXG4gICAgICAgICAgICAgICdwcmludGYgXFwnW3tcIm5hbWVcIjpcIiVzXCIsXCJpbWFnZVVyaVwiOlwiJXNcIn1dXFwnICRDT05UQUlORVJfTkFNRSAkUkVQT1NJVE9SWV9VUkk6JElNQUdFX1RBRyA+IGltYWdlZGVmaW5pdGlvbnMuanNvbicsXG4gICAgICAgICAgICAgICdjYXQgaW1hZ2VkZWZpbml0aW9ucy5qc29uJyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgYXJ0aWZhY3RzOiB7XG4gICAgICAgICAgZmlsZXM6IFsnYXBpL2ltYWdlZGVmaW5pdGlvbnMuanNvbiddLFxuICAgICAgICAgICdkaXNjYXJkLXBhdGhzJzogJ3llcycsXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICAgIGNhY2hlOiBjb2RlYnVpbGQuQ2FjaGUubG9jYWwoY29kZWJ1aWxkLkxvY2FsQ2FjaGVNb2RlLkRPQ0tFUl9MQVlFUiksXG4gICAgfSk7XG5cbiAgICAvLyBXb3JrZXIgYnVpbGQgcHJvamVjdFxuICAgIGNvbnN0IHdvcmtlckJ1aWxkID0gbmV3IGNvZGVidWlsZC5QaXBlbGluZVByb2plY3QodGhpcywgJ1dvcmtlckJ1aWxkJywge1xuICAgICAgcHJvamVjdE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS13b3JrZXItYnVpbGRgLFxuICAgICAgcm9sZTogYnVpbGRSb2xlLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgYnVpbGRJbWFnZTogY29kZWJ1aWxkLkxpbnV4QnVpbGRJbWFnZS5TVEFOREFSRF83XzAsXG4gICAgICAgIHByaXZpbGVnZWQ6IHRydWUsXG4gICAgICAgIGNvbXB1dGVUeXBlOiBjb2RlYnVpbGQuQ29tcHV0ZVR5cGUuTUVESVVNLFxuICAgICAgICBlbnZpcm9ubWVudFZhcmlhYmxlczoge1xuICAgICAgICAgIFJFUE9TSVRPUllfVVJJOiB7XG4gICAgICAgICAgICB2YWx1ZTogd29ya2VyUmVwb3NpdG9yeS5yZXBvc2l0b3J5VXJpLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgQ09OVEFJTkVSX05BTUU6IHtcbiAgICAgICAgICAgIHZhbHVlOiAnd29ya2VyJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEFXU19SRUdJT046IHtcbiAgICAgICAgICAgIHZhbHVlOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGJ1aWxkU3BlYzogY29kZWJ1aWxkLkJ1aWxkU3BlYy5mcm9tT2JqZWN0KHtcbiAgICAgICAgdmVyc2lvbjogJzAuMicsXG4gICAgICAgIHBoYXNlczoge1xuICAgICAgICAgIHByZV9idWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gTG9nZ2luZyBpbiB0byBBbWF6b24gRUNSLi4uJyxcbiAgICAgICAgICAgICAgJ2F3cyBlY3IgZ2V0LWxvZ2luLXBhc3N3b3JkIC0tcmVnaW9uICRBV1NfUkVHSU9OIHwgZG9ja2VyIGxvZ2luIC0tdXNlcm5hbWUgQVdTIC0tcGFzc3dvcmQtc3RkaW4gJFJFUE9TSVRPUllfVVJJJyxcbiAgICAgICAgICAgICAgJ2V4cG9ydCBDT01NSVRfSEFTSD0kKGVjaG8gJENPREVCVUlMRF9SRVNPTFZFRF9TT1VSQ0VfVkVSU0lPTiB8IGN1dCAtYyAxLTcpJyxcbiAgICAgICAgICAgICAgJ2V4cG9ydCBJTUFHRV9UQUc9JHtDT01NSVRfSEFTSDo9bGF0ZXN0fScsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYnVpbGQ6IHtcbiAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICdlY2hvIEJ1aWxkaW5nIHRoZSBEb2NrZXIgaW1hZ2UuLi4nLFxuICAgICAgICAgICAgICAnY2Qgd29ya2VyJyxcbiAgICAgICAgICAgICAgJ2RvY2tlciBidWlsZCAtLW5vLWNhY2hlIC10ICRSRVBPU0lUT1JZX1VSSTpsYXRlc3QgLXQgJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcgLicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcG9zdF9idWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gUHVzaGluZyB0aGUgRG9ja2VyIGltYWdlLi4uJyxcbiAgICAgICAgICAgICAgJ2RvY2tlciBwdXNoICRSRVBPU0lUT1JZX1VSSTpsYXRlc3QnLFxuICAgICAgICAgICAgICAnZG9ja2VyIHB1c2ggJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcnLFxuICAgICAgICAgICAgICAnZWNobyBXcml0aW5nIGltYWdlIGRlZmluaXRpb25zIGZpbGUuLi4nLFxuICAgICAgICAgICAgICAncHJpbnRmIFxcJ1t7XCJuYW1lXCI6XCIlc1wiLFwiaW1hZ2VVcmlcIjpcIiVzXCJ9XVxcJyAkQ09OVEFJTkVSX05BTUUgJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcgPiBpbWFnZWRlZmluaXRpb25zLmpzb24nLFxuICAgICAgICAgICAgICAnY2F0IGltYWdlZGVmaW5pdGlvbnMuanNvbicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGFydGlmYWN0czoge1xuICAgICAgICAgIGZpbGVzOiBbJ3dvcmtlci9pbWFnZWRlZmluaXRpb25zLmpzb24nXSxcbiAgICAgICAgICAnZGlzY2FyZC1wYXRocyc6ICd5ZXMnLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBjYWNoZTogY29kZWJ1aWxkLkNhY2hlLmxvY2FsKGNvZGVidWlsZC5Mb2NhbENhY2hlTW9kZS5ET0NLRVJfTEFZRVIpLFxuICAgIH0pO1xuXG4gICAgLy8gUGlwZWxpbmVcbiAgICB0aGlzLnBpcGVsaW5lID0gbmV3IGNvZGVwaXBlbGluZS5QaXBlbGluZSh0aGlzLCAnUGlwZWxpbmUnLCB7XG4gICAgICBwaXBlbGluZU5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1waXBlbGluZWAsXG4gICAgICBwaXBlbGluZVR5cGU6IGNvZGVwaXBlbGluZS5QaXBlbGluZVR5cGUuVjIsXG4gICAgICByZXN0YXJ0RXhlY3V0aW9uT25VcGRhdGU6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBTb3VyY2Ugc3RhZ2UgLSBHaXRIdWIgdmlhIENvZGVTdGFyIENvbm5lY3Rpb25zXG4gICAgLy8gTm90ZTogWW91IG5lZWQgdG8gY3JlYXRlIGEgQ29kZVN0YXIgY29ubmVjdGlvbiBtYW51YWxseSBhbmQgdXBkYXRlIHRoZSBBUk5cbiAgICBjb25zdCBzb3VyY2VBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZVN0YXJDb25uZWN0aW9uc1NvdXJjZUFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnR2l0SHViX1NvdXJjZScsXG4gICAgICBvd25lcjogJ3RlZ3J5YW4tZGRvJywgLy8gVXBkYXRlIHdpdGggYWN0dWFsIG93bmVyXG4gICAgICByZXBvOiAnbWV0aXMnLCAvLyBVcGRhdGUgd2l0aCBhY3R1YWwgcmVwb1xuICAgICAgYnJhbmNoOiAnbWFpbicsXG4gICAgICBvdXRwdXQ6IHNvdXJjZU91dHB1dCxcbiAgICAgIGNvbm5lY3Rpb25Bcm46ICdhcm46YXdzOmNvZGVjb25uZWN0aW9uczp1cy1lYXN0LTE6ODgyMzg0ODc5MjM1OmNvbm5lY3Rpb24vMzZiMTdkMjUtYTRjYy00NjdkLTk0ZmItNGNlYTVlNmJjOTg2JyxcbiAgICAgIHRyaWdnZXJPblB1c2g6IHRydWUsXG4gICAgfSk7XG5cbiAgICB0aGlzLnBpcGVsaW5lLmFkZFN0YWdlKHtcbiAgICAgIHN0YWdlTmFtZTogJ1NvdXJjZScsXG4gICAgICBhY3Rpb25zOiBbc291cmNlQWN0aW9uXSxcbiAgICB9KTtcblxuICAgIC8vIEJ1aWxkIHN0YWdlIC0gcGFyYWxsZWwgYnVpbGRzXG4gICAgdGhpcy5waXBlbGluZS5hZGRTdGFnZSh7XG4gICAgICBzdGFnZU5hbWU6ICdCdWlsZCcsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQnVpbGRBY3Rpb24oe1xuICAgICAgICAgIGFjdGlvbk5hbWU6ICdCdWlsZF9EYXNoYm9hcmQnLFxuICAgICAgICAgIHByb2plY3Q6IGRhc2hib2FyZEJ1aWxkLFxuICAgICAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICAgICAgb3V0cHV0czogW2Rhc2hib2FyZEJ1aWxkT3V0cHV0XSxcbiAgICAgICAgICBydW5PcmRlcjogMSxcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQnVpbGRBY3Rpb24oe1xuICAgICAgICAgIGFjdGlvbk5hbWU6ICdCdWlsZF9BUEknLFxuICAgICAgICAgIHByb2plY3Q6IGFwaUJ1aWxkLFxuICAgICAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICAgICAgb3V0cHV0czogW2FwaUJ1aWxkT3V0cHV0XSxcbiAgICAgICAgICBydW5PcmRlcjogMSwgLy8gU2FtZSBydW5PcmRlciBmb3IgcGFyYWxsZWwgZXhlY3V0aW9uXG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZUJ1aWxkQWN0aW9uKHtcbiAgICAgICAgICBhY3Rpb25OYW1lOiAnQnVpbGRfV29ya2VyJyxcbiAgICAgICAgICBwcm9qZWN0OiB3b3JrZXJCdWlsZCxcbiAgICAgICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgICAgIG91dHB1dHM6IFt3b3JrZXJCdWlsZE91dHB1dF0sXG4gICAgICAgICAgcnVuT3JkZXI6IDEsIC8vIFNhbWUgcnVuT3JkZXIgZm9yIHBhcmFsbGVsIGV4ZWN1dGlvblxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBEZXBsb3kgc3RhZ2UgLSBFQ1Mgcm9sbGluZyBkZXBsb3ltZW50XG4gICAgdGhpcy5waXBlbGluZS5hZGRTdGFnZSh7XG4gICAgICBzdGFnZU5hbWU6ICdEZXBsb3knLFxuICAgICAgYWN0aW9uczogW1xuICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuRWNzRGVwbG95QWN0aW9uKHtcbiAgICAgICAgICBhY3Rpb25OYW1lOiAnRGVwbG95X0Rhc2hib2FyZCcsXG4gICAgICAgICAgc2VydmljZTogZGFzaGJvYXJkU2VydmljZSxcbiAgICAgICAgICBpbnB1dDogZGFzaGJvYXJkQnVpbGRPdXRwdXQsXG4gICAgICAgICAgZGVwbG95bWVudFRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgICAgICBydW5PcmRlcjogMSxcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5FY3NEZXBsb3lBY3Rpb24oe1xuICAgICAgICAgIGFjdGlvbk5hbWU6ICdEZXBsb3lfQVBJJyxcbiAgICAgICAgICBzZXJ2aWNlOiBhcGlTZXJ2aWNlLFxuICAgICAgICAgIGlucHV0OiBhcGlCdWlsZE91dHB1dCxcbiAgICAgICAgICBkZXBsb3ltZW50VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgICAgIHJ1bk9yZGVyOiAxLCAvLyBTYW1lIHJ1bk9yZGVyIGZvciBwYXJhbGxlbCBkZXBsb3ltZW50XG4gICAgICAgIH0pLFxuICAgICAgICBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuRWNzRGVwbG95QWN0aW9uKHtcbiAgICAgICAgICBhY3Rpb25OYW1lOiAnRGVwbG95X1dvcmtlcicsXG4gICAgICAgICAgc2VydmljZTogd29ya2VyU2VydmljZSxcbiAgICAgICAgICBpbnB1dDogd29ya2VyQnVpbGRPdXRwdXQsXG4gICAgICAgICAgZGVwbG95bWVudFRpbWVvdXQ6IGNkay5EdXJhdGlvbi5taW51dGVzKDE1KSxcbiAgICAgICAgICBydW5PcmRlcjogMSwgLy8gU2FtZSBydW5PcmRlciBmb3IgcGFyYWxsZWwgZGVwbG95bWVudFxuICAgICAgICB9KSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBFMkUgVGVzdCBzdGFnZSAtIHJ1bnMgYWZ0ZXIgZGVwbG95bWVudFxuICAgIGNvbnN0IGUyZVRlc3RPdXRwdXQgPSBuZXcgY29kZXBpcGVsaW5lLkFydGlmYWN0KCdFMkVUZXN0T3V0cHV0Jyk7XG4gICAgdGhpcy5waXBlbGluZS5hZGRTdGFnZSh7XG4gICAgICBzdGFnZU5hbWU6ICdFMkVfVGVzdCcsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQnVpbGRBY3Rpb24oe1xuICAgICAgICAgIGFjdGlvbk5hbWU6ICdSdW5fRTJFX1Rlc3RzJyxcbiAgICAgICAgICBwcm9qZWN0OiBlMmVCdWlsZCxcbiAgICAgICAgICBpbnB1dDogc291cmNlT3V0cHV0LFxuICAgICAgICAgIG91dHB1dHM6IFtlMmVUZXN0T3V0cHV0XSxcbiAgICAgICAgICBydW5PcmRlcjogMSxcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQaXBlbGluZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnBpcGVsaW5lLnBpcGVsaW5lQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdQaXBlbGluZSBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXBpcGVsaW5lLWFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGlwZWxpbmVVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jb2Rlc3VpdGUvY29kZXBpcGVsaW5lL3BpcGVsaW5lcy8ke3RoaXMucGlwZWxpbmUucGlwZWxpbmVOYW1lfS92aWV3YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGlwZWxpbmUgY29uc29sZSBVUkwnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=