import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface PipelineStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  dashboardRepository: ecr.Repository;
  apiRepository: ecr.Repository;
  workerRepository: ecr.Repository;
  dashboardService: ecs.FargateService;
  apiService: ecs.FargateService;
  workerService: ecs.FargateService;
  cluster: ecs.Cluster;
}

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
export class PipelineStack extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: PipelineStackProps) {
    super(scope, id, props);

    const {
      projectName,
      environment,
      dashboardRepository,
      apiRepository,
      workerRepository,
      dashboardService,
      apiService,
      workerService,
      cluster,
    } = props;

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
    const dashboardBuild = new codebuild.PipelineProject(
      this,
      'DashboardBuild',
      {
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
      }
    );

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
