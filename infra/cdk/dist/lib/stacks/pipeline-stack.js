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
        const { projectName, environment, dashboardRepository, apiRepository, dashboardService, apiService, cluster, } = props;
        // Source artifact
        const sourceOutput = new codepipeline.Artifact('SourceOutput');
        const dashboardBuildOutput = new codepipeline.Artifact('DashboardBuildOutput');
        const apiBuildOutput = new codepipeline.Artifact('ApiBuildOutput');
        // CodeBuild role with ECR permissions
        const buildRole = new iam.Role(this, 'BuildRole', {
            assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
            roleName: `${projectName}-${environment}-codebuild-role`,
        });
        dashboardRepository.grantPullPush(buildRole);
        apiRepository.grantPullPush(buildRole);
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
                            'docker build -t $REPOSITORY_URI:latest -t $REPOSITORY_URI:$IMAGE_TAG .',
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
                            'docker build -t $REPOSITORY_URI:latest -t $REPOSITORY_URI:$IMAGE_TAG .',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGlwZWxpbmUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvc3RhY2tzL3BpcGVsaW5lLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQywyRUFBNkQ7QUFDN0QsMkZBQTZFO0FBQzdFLHFFQUF1RDtBQUd2RCx5REFBMkM7QUFhM0M7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBYSxhQUFjLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDMUIsUUFBUSxDQUF3QjtJQUVoRCxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXlCO1FBQ2pFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRXhCLE1BQU0sRUFDSixXQUFXLEVBQ1gsV0FBVyxFQUNYLG1CQUFtQixFQUNuQixhQUFhLEVBQ2IsZ0JBQWdCLEVBQ2hCLFVBQVUsRUFDVixPQUFPLEdBQ1IsR0FBRyxLQUFLLENBQUM7UUFFVixrQkFBa0I7UUFDbEIsTUFBTSxZQUFZLEdBQUcsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQy9ELE1BQU0sb0JBQW9CLEdBQUcsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDL0UsTUFBTSxjQUFjLEdBQUcsSUFBSSxZQUFZLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFbkUsc0NBQXNDO1FBQ3RDLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsV0FBVyxFQUFFO1lBQ2hELFNBQVMsRUFBRSxJQUFJLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyx5QkFBeUIsQ0FBQztZQUM5RCxRQUFRLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxpQkFBaUI7U0FDekQsQ0FBQyxDQUFDO1FBRUgsbUJB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QyxRQUFRLEVBQUUsQ0FBQyxFQUFFLHdDQUF3QztpQkFDdEQsQ0FBQzthQUNIO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxFQUFFO1lBQ3JDLEtBQUssRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVc7WUFDaEMsV0FBVyxFQUFFLGNBQWM7WUFDM0IsVUFBVSxFQUFFLEdBQUcsV0FBVyxJQUFJLFdBQVcsZUFBZTtTQUN6RCxDQUFDLENBQUM7UUFFSCxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUNyQyxLQUFLLEVBQUUsV0FBVyxJQUFJLENBQUMsTUFBTSw0REFBNEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLE9BQU87WUFDMUgsV0FBVyxFQUFFLHNCQUFzQjtTQUNwQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0Y7QUFsT0Qsc0NBa09DIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZSBmcm9tICdhd3MtY2RrLWxpYi9hd3MtY29kZXBpcGVsaW5lJztcbmltcG9ydCAqIGFzIGNvZGVwaXBlbGluZV9hY3Rpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2RlcGlwZWxpbmUtYWN0aW9ucyc7XG5pbXBvcnQgKiBhcyBjb2RlYnVpbGQgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNvZGVidWlsZCc7XG5pbXBvcnQgKiBhcyBlY3IgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcic7XG5pbXBvcnQgKiBhcyBlY3MgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjcyc7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBQaXBlbGluZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIGRhc2hib2FyZFJlcG9zaXRvcnk6IGVjci5SZXBvc2l0b3J5O1xuICBhcGlSZXBvc2l0b3J5OiBlY3IuUmVwb3NpdG9yeTtcbiAgZGFzaGJvYXJkU2VydmljZTogZWNzLkZhcmdhdGVTZXJ2aWNlO1xuICBhcGlTZXJ2aWNlOiBlY3MuRmFyZ2F0ZVNlcnZpY2U7XG4gIGNsdXN0ZXI6IGVjcy5DbHVzdGVyO1xufVxuXG4vKipcbiAqIFBpcGVsaW5lIFN0YWNrIC0gQ29kZVBpcGVsaW5lICsgQ29kZUJ1aWxkIGZvciBDSS9DRFxuICpcbiAqIENyZWF0ZXM6XG4gKiAtIENvZGVQaXBlbGluZSB3aXRoIFNvdXJjZSwgQnVpbGQsIGFuZCBEZXBsb3kgc3RhZ2VzXG4gKiAtIFBhcmFsbGVsIENvZGVCdWlsZCBwcm9qZWN0cyBmb3IgZGFzaGJvYXJkIGFuZCBBUElcbiAqIC0gRUNTIHJvbGxpbmcgZGVwbG95bWVudCB3aXRoIGNpcmN1aXQgYnJlYWtlclxuICpcbiAqIE5vdGU6IFJlcXVpcmVzIEdpdEh1YiBDb2RlU3RhciBjb25uZWN0aW9uIHRvIGJlIGNvbmZpZ3VyZWRcbiAqL1xuZXhwb3J0IGNsYXNzIFBpcGVsaW5lU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgcGlwZWxpbmU6IGNvZGVwaXBlbGluZS5QaXBlbGluZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUGlwZWxpbmVTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBjb25zdCB7XG4gICAgICBwcm9qZWN0TmFtZSxcbiAgICAgIGVudmlyb25tZW50LFxuICAgICAgZGFzaGJvYXJkUmVwb3NpdG9yeSxcbiAgICAgIGFwaVJlcG9zaXRvcnksXG4gICAgICBkYXNoYm9hcmRTZXJ2aWNlLFxuICAgICAgYXBpU2VydmljZSxcbiAgICAgIGNsdXN0ZXIsXG4gICAgfSA9IHByb3BzO1xuXG4gICAgLy8gU291cmNlIGFydGlmYWN0XG4gICAgY29uc3Qgc291cmNlT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgnU291cmNlT3V0cHV0Jyk7XG4gICAgY29uc3QgZGFzaGJvYXJkQnVpbGRPdXRwdXQgPSBuZXcgY29kZXBpcGVsaW5lLkFydGlmYWN0KCdEYXNoYm9hcmRCdWlsZE91dHB1dCcpO1xuICAgIGNvbnN0IGFwaUJ1aWxkT3V0cHV0ID0gbmV3IGNvZGVwaXBlbGluZS5BcnRpZmFjdCgnQXBpQnVpbGRPdXRwdXQnKTtcblxuICAgIC8vIENvZGVCdWlsZCByb2xlIHdpdGggRUNSIHBlcm1pc3Npb25zXG4gICAgY29uc3QgYnVpbGRSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdCdWlsZFJvbGUnLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnY29kZWJ1aWxkLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIHJvbGVOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tY29kZWJ1aWxkLXJvbGVgLFxuICAgIH0pO1xuXG4gICAgZGFzaGJvYXJkUmVwb3NpdG9yeS5ncmFudFB1bGxQdXNoKGJ1aWxkUm9sZSk7XG4gICAgYXBpUmVwb3NpdG9yeS5ncmFudFB1bGxQdXNoKGJ1aWxkUm9sZSk7XG5cbiAgICAvLyBEYXNoYm9hcmQgYnVpbGQgcHJvamVjdFxuICAgIGNvbnN0IGRhc2hib2FyZEJ1aWxkID0gbmV3IGNvZGVidWlsZC5QaXBlbGluZVByb2plY3QoXG4gICAgICB0aGlzLFxuICAgICAgJ0Rhc2hib2FyZEJ1aWxkJyxcbiAgICAgIHtcbiAgICAgICAgcHJvamVjdE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1kYXNoYm9hcmQtYnVpbGRgLFxuICAgICAgICByb2xlOiBidWlsZFJvbGUsXG4gICAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgICAgYnVpbGRJbWFnZTogY29kZWJ1aWxkLkxpbnV4QnVpbGRJbWFnZS5TVEFOREFSRF83XzAsXG4gICAgICAgICAgcHJpdmlsZWdlZDogdHJ1ZSwgLy8gUmVxdWlyZWQgZm9yIERvY2tlclxuICAgICAgICAgIGNvbXB1dGVUeXBlOiBjb2RlYnVpbGQuQ29tcHV0ZVR5cGUuTUVESVVNLFxuICAgICAgICAgIGVudmlyb25tZW50VmFyaWFibGVzOiB7XG4gICAgICAgICAgICBSRVBPU0lUT1JZX1VSSToge1xuICAgICAgICAgICAgICB2YWx1ZTogZGFzaGJvYXJkUmVwb3NpdG9yeS5yZXBvc2l0b3J5VXJpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIENPTlRBSU5FUl9OQU1FOiB7XG4gICAgICAgICAgICAgIHZhbHVlOiAnZGFzaGJvYXJkJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBBV1NfUkVHSU9OOiB7XG4gICAgICAgICAgICAgIHZhbHVlOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3Qoe1xuICAgICAgICAgIHZlcnNpb246ICcwLjInLFxuICAgICAgICAgIHBoYXNlczoge1xuICAgICAgICAgICAgcHJlX2J1aWxkOiB7XG4gICAgICAgICAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICAgICAgICAgJ2VjaG8gTG9nZ2luZyBpbiB0byBBbWF6b24gRUNSLi4uJyxcbiAgICAgICAgICAgICAgICAnYXdzIGVjciBnZXQtbG9naW4tcGFzc3dvcmQgLS1yZWdpb24gJEFXU19SRUdJT04gfCBkb2NrZXIgbG9naW4gLS11c2VybmFtZSBBV1MgLS1wYXNzd29yZC1zdGRpbiAkUkVQT1NJVE9SWV9VUkknLFxuICAgICAgICAgICAgICAgICdleHBvcnQgQ09NTUlUX0hBU0g9JChlY2hvICRDT0RFQlVJTERfUkVTT0xWRURfU09VUkNFX1ZFUlNJT04gfCBjdXQgLWMgMS03KScsXG4gICAgICAgICAgICAgICAgJ2V4cG9ydCBJTUFHRV9UQUc9JHtDT01NSVRfSEFTSDo9bGF0ZXN0fScsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgYnVpbGQ6IHtcbiAgICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgICAnZWNobyBCdWlsZGluZyB0aGUgRG9ja2VyIGltYWdlLi4uJyxcbiAgICAgICAgICAgICAgICAnY2QgZGFzaGJvYXJkJyxcbiAgICAgICAgICAgICAgICAnZG9ja2VyIGJ1aWxkIC10ICRSRVBPU0lUT1JZX1VSSTpsYXRlc3QgLXQgJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcgLicsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcG9zdF9idWlsZDoge1xuICAgICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAgICdlY2hvIFB1c2hpbmcgdGhlIERvY2tlciBpbWFnZS4uLicsXG4gICAgICAgICAgICAgICAgJ2RvY2tlciBwdXNoICRSRVBPU0lUT1JZX1VSSTpsYXRlc3QnLFxuICAgICAgICAgICAgICAgICdkb2NrZXIgcHVzaCAkUkVQT1NJVE9SWV9VUkk6JElNQUdFX1RBRycsXG4gICAgICAgICAgICAgICAgJ2VjaG8gV3JpdGluZyBpbWFnZSBkZWZpbml0aW9ucyBmaWxlLi4uJyxcbiAgICAgICAgICAgICAgICAncHJpbnRmIFxcJ1t7XCJuYW1lXCI6XCIlc1wiLFwiaW1hZ2VVcmlcIjpcIiVzXCJ9XVxcJyAkQ09OVEFJTkVSX05BTUUgJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcgPiBpbWFnZWRlZmluaXRpb25zLmpzb24nLFxuICAgICAgICAgICAgICAgICdjYXQgaW1hZ2VkZWZpbml0aW9ucy5qc29uJyxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBhcnRpZmFjdHM6IHtcbiAgICAgICAgICAgIGZpbGVzOiBbJ2Rhc2hib2FyZC9pbWFnZWRlZmluaXRpb25zLmpzb24nXSxcbiAgICAgICAgICAgICdkaXNjYXJkLXBhdGhzJzogJ3llcycsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICAgIGNhY2hlOiBjb2RlYnVpbGQuQ2FjaGUubG9jYWwoY29kZWJ1aWxkLkxvY2FsQ2FjaGVNb2RlLkRPQ0tFUl9MQVlFUiksXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEFQSSBidWlsZCBwcm9qZWN0XG4gICAgY29uc3QgYXBpQnVpbGQgPSBuZXcgY29kZWJ1aWxkLlBpcGVsaW5lUHJvamVjdCh0aGlzLCAnQXBpQnVpbGQnLCB7XG4gICAgICBwcm9qZWN0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFwaS1idWlsZGAsXG4gICAgICByb2xlOiBidWlsZFJvbGUsXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBidWlsZEltYWdlOiBjb2RlYnVpbGQuTGludXhCdWlsZEltYWdlLlNUQU5EQVJEXzdfMCxcbiAgICAgICAgcHJpdmlsZWdlZDogdHJ1ZSxcbiAgICAgICAgY29tcHV0ZVR5cGU6IGNvZGVidWlsZC5Db21wdXRlVHlwZS5NRURJVU0sXG4gICAgICAgIGVudmlyb25tZW50VmFyaWFibGVzOiB7XG4gICAgICAgICAgUkVQT1NJVE9SWV9VUkk6IHtcbiAgICAgICAgICAgIHZhbHVlOiBhcGlSZXBvc2l0b3J5LnJlcG9zaXRvcnlVcmksXG4gICAgICAgICAgfSxcbiAgICAgICAgICBDT05UQUlORVJfTkFNRToge1xuICAgICAgICAgICAgdmFsdWU6ICdhcGknLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgQVdTX1JFR0lPTjoge1xuICAgICAgICAgICAgdmFsdWU6IHRoaXMucmVnaW9uLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgYnVpbGRTcGVjOiBjb2RlYnVpbGQuQnVpbGRTcGVjLmZyb21PYmplY3Qoe1xuICAgICAgICB2ZXJzaW9uOiAnMC4yJyxcbiAgICAgICAgcGhhc2VzOiB7XG4gICAgICAgICAgcHJlX2J1aWxkOiB7XG4gICAgICAgICAgICBjb21tYW5kczogW1xuICAgICAgICAgICAgICAnZWNobyBMb2dnaW5nIGluIHRvIEFtYXpvbiBFQ1IuLi4nLFxuICAgICAgICAgICAgICAnYXdzIGVjciBnZXQtbG9naW4tcGFzc3dvcmQgLS1yZWdpb24gJEFXU19SRUdJT04gfCBkb2NrZXIgbG9naW4gLS11c2VybmFtZSBBV1MgLS1wYXNzd29yZC1zdGRpbiAkUkVQT1NJVE9SWV9VUkknLFxuICAgICAgICAgICAgICAnZXhwb3J0IENPTU1JVF9IQVNIPSQoZWNobyAkQ09ERUJVSUxEX1JFU09MVkVEX1NPVVJDRV9WRVJTSU9OIHwgY3V0IC1jIDEtNyknLFxuICAgICAgICAgICAgICAnZXhwb3J0IElNQUdFX1RBRz0ke0NPTU1JVF9IQVNIOj1sYXRlc3R9JyxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBidWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gQnVpbGRpbmcgdGhlIERvY2tlciBpbWFnZS4uLicsXG4gICAgICAgICAgICAgICdjZCBhcGknLFxuICAgICAgICAgICAgICAnZG9ja2VyIGJ1aWxkIC10ICRSRVBPU0lUT1JZX1VSSTpsYXRlc3QgLXQgJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcgLicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcG9zdF9idWlsZDoge1xuICAgICAgICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgICAgICAgJ2VjaG8gUHVzaGluZyB0aGUgRG9ja2VyIGltYWdlLi4uJyxcbiAgICAgICAgICAgICAgJ2RvY2tlciBwdXNoICRSRVBPU0lUT1JZX1VSSTpsYXRlc3QnLFxuICAgICAgICAgICAgICAnZG9ja2VyIHB1c2ggJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcnLFxuICAgICAgICAgICAgICAnZWNobyBXcml0aW5nIGltYWdlIGRlZmluaXRpb25zIGZpbGUuLi4nLFxuICAgICAgICAgICAgICAncHJpbnRmIFxcJ1t7XCJuYW1lXCI6XCIlc1wiLFwiaW1hZ2VVcmlcIjpcIiVzXCJ9XVxcJyAkQ09OVEFJTkVSX05BTUUgJFJFUE9TSVRPUllfVVJJOiRJTUFHRV9UQUcgPiBpbWFnZWRlZmluaXRpb25zLmpzb24nLFxuICAgICAgICAgICAgICAnY2F0IGltYWdlZGVmaW5pdGlvbnMuanNvbicsXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGFydGlmYWN0czoge1xuICAgICAgICAgIGZpbGVzOiBbJ2FwaS9pbWFnZWRlZmluaXRpb25zLmpzb24nXSxcbiAgICAgICAgICAnZGlzY2FyZC1wYXRocyc6ICd5ZXMnLFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgICBjYWNoZTogY29kZWJ1aWxkLkNhY2hlLmxvY2FsKGNvZGVidWlsZC5Mb2NhbENhY2hlTW9kZS5ET0NLRVJfTEFZRVIpLFxuICAgIH0pO1xuXG4gICAgLy8gUGlwZWxpbmVcbiAgICB0aGlzLnBpcGVsaW5lID0gbmV3IGNvZGVwaXBlbGluZS5QaXBlbGluZSh0aGlzLCAnUGlwZWxpbmUnLCB7XG4gICAgICBwaXBlbGluZU5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1waXBlbGluZWAsXG4gICAgICBwaXBlbGluZVR5cGU6IGNvZGVwaXBlbGluZS5QaXBlbGluZVR5cGUuVjIsXG4gICAgICByZXN0YXJ0RXhlY3V0aW9uT25VcGRhdGU6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBTb3VyY2Ugc3RhZ2UgLSBHaXRIdWIgdmlhIENvZGVTdGFyIENvbm5lY3Rpb25zXG4gICAgLy8gTm90ZTogWW91IG5lZWQgdG8gY3JlYXRlIGEgQ29kZVN0YXIgY29ubmVjdGlvbiBtYW51YWxseSBhbmQgdXBkYXRlIHRoZSBBUk5cbiAgICBjb25zdCBzb3VyY2VBY3Rpb24gPSBuZXcgY29kZXBpcGVsaW5lX2FjdGlvbnMuQ29kZVN0YXJDb25uZWN0aW9uc1NvdXJjZUFjdGlvbih7XG4gICAgICBhY3Rpb25OYW1lOiAnR2l0SHViX1NvdXJjZScsXG4gICAgICBvd25lcjogJ3RlZ3J5YW4tZGRvJywgLy8gVXBkYXRlIHdpdGggYWN0dWFsIG93bmVyXG4gICAgICByZXBvOiAnbWV0aXMnLCAvLyBVcGRhdGUgd2l0aCBhY3R1YWwgcmVwb1xuICAgICAgYnJhbmNoOiAnbWFpbicsXG4gICAgICBvdXRwdXQ6IHNvdXJjZU91dHB1dCxcbiAgICAgIGNvbm5lY3Rpb25Bcm46ICdhcm46YXdzOmNvZGVjb25uZWN0aW9uczp1cy1lYXN0LTE6ODgyMzg0ODc5MjM1OmNvbm5lY3Rpb24vMzZiMTdkMjUtYTRjYy00NjdkLTk0ZmItNGNlYTVlNmJjOTg2JyxcbiAgICAgIHRyaWdnZXJPblB1c2g6IHRydWUsXG4gICAgfSk7XG5cbiAgICB0aGlzLnBpcGVsaW5lLmFkZFN0YWdlKHtcbiAgICAgIHN0YWdlTmFtZTogJ1NvdXJjZScsXG4gICAgICBhY3Rpb25zOiBbc291cmNlQWN0aW9uXSxcbiAgICB9KTtcblxuICAgIC8vIEJ1aWxkIHN0YWdlIC0gcGFyYWxsZWwgYnVpbGRzXG4gICAgdGhpcy5waXBlbGluZS5hZGRTdGFnZSh7XG4gICAgICBzdGFnZU5hbWU6ICdCdWlsZCcsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQnVpbGRBY3Rpb24oe1xuICAgICAgICAgIGFjdGlvbk5hbWU6ICdCdWlsZF9EYXNoYm9hcmQnLFxuICAgICAgICAgIHByb2plY3Q6IGRhc2hib2FyZEJ1aWxkLFxuICAgICAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICAgICAgb3V0cHV0czogW2Rhc2hib2FyZEJ1aWxkT3V0cHV0XSxcbiAgICAgICAgICBydW5PcmRlcjogMSxcbiAgICAgICAgfSksXG4gICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5Db2RlQnVpbGRBY3Rpb24oe1xuICAgICAgICAgIGFjdGlvbk5hbWU6ICdCdWlsZF9BUEknLFxuICAgICAgICAgIHByb2plY3Q6IGFwaUJ1aWxkLFxuICAgICAgICAgIGlucHV0OiBzb3VyY2VPdXRwdXQsXG4gICAgICAgICAgb3V0cHV0czogW2FwaUJ1aWxkT3V0cHV0XSxcbiAgICAgICAgICBydW5PcmRlcjogMSwgLy8gU2FtZSBydW5PcmRlciBmb3IgcGFyYWxsZWwgZXhlY3V0aW9uXG4gICAgICAgIH0pLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIERlcGxveSBzdGFnZSAtIEVDUyByb2xsaW5nIGRlcGxveW1lbnRcbiAgICB0aGlzLnBpcGVsaW5lLmFkZFN0YWdlKHtcbiAgICAgIHN0YWdlTmFtZTogJ0RlcGxveScsXG4gICAgICBhY3Rpb25zOiBbXG4gICAgICAgIG5ldyBjb2RlcGlwZWxpbmVfYWN0aW9ucy5FY3NEZXBsb3lBY3Rpb24oe1xuICAgICAgICAgIGFjdGlvbk5hbWU6ICdEZXBsb3lfRGFzaGJvYXJkJyxcbiAgICAgICAgICBzZXJ2aWNlOiBkYXNoYm9hcmRTZXJ2aWNlLFxuICAgICAgICAgIGlucHV0OiBkYXNoYm9hcmRCdWlsZE91dHB1dCxcbiAgICAgICAgICBkZXBsb3ltZW50VGltZW91dDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMTUpLFxuICAgICAgICAgIHJ1bk9yZGVyOiAxLFxuICAgICAgICB9KSxcbiAgICAgICAgbmV3IGNvZGVwaXBlbGluZV9hY3Rpb25zLkVjc0RlcGxveUFjdGlvbih7XG4gICAgICAgICAgYWN0aW9uTmFtZTogJ0RlcGxveV9BUEknLFxuICAgICAgICAgIHNlcnZpY2U6IGFwaVNlcnZpY2UsXG4gICAgICAgICAgaW5wdXQ6IGFwaUJ1aWxkT3V0cHV0LFxuICAgICAgICAgIGRlcGxveW1lbnRUaW1lb3V0OiBjZGsuRHVyYXRpb24ubWludXRlcygxNSksXG4gICAgICAgICAgcnVuT3JkZXI6IDEsIC8vIFNhbWUgcnVuT3JkZXIgZm9yIHBhcmFsbGVsIGRlcGxveW1lbnRcbiAgICAgICAgfSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdQaXBlbGluZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnBpcGVsaW5lLnBpcGVsaW5lQXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdQaXBlbGluZSBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXBpcGVsaW5lLWFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUGlwZWxpbmVVcmwnLCB7XG4gICAgICB2YWx1ZTogYGh0dHBzOi8vJHt0aGlzLnJlZ2lvbn0uY29uc29sZS5hd3MuYW1hem9uLmNvbS9jb2Rlc3VpdGUvY29kZXBpcGVsaW5lL3BpcGVsaW5lcy8ke3RoaXMucGlwZWxpbmUucGlwZWxpbmVOYW1lfS92aWV3YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUGlwZWxpbmUgY29uc29sZSBVUkwnLFxuICAgIH0pO1xuICB9XG59XG4iXX0=