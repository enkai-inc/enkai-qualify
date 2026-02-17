#!/usr/bin/env node
"use strict";
/**
 * Metis CDK Application Entry Point
 *
 * Deployment order:
 * 1. NetworkStack - VPC foundation
 * 2. EcrStack - Container repositories
 * 3. DatabaseStack - RDS + Redis (depends on Network)
 * 4. EcsStack - Fargate services (depends on Database, ECR)
 * 5. PipelineStack - CI/CD (depends on ECS)
 */
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
require("source-map-support/register");
const cdk = __importStar(require("aws-cdk-lib"));
const network_stack_1 = require("../lib/stacks/network-stack");
const ecr_stack_1 = require("../lib/stacks/ecr-stack");
const database_stack_1 = require("../lib/stacks/database-stack");
const ecs_stack_1 = require("../lib/stacks/ecs-stack");
const pipeline_stack_1 = require("../lib/stacks/pipeline-stack");
const app = new cdk.App();
// Get context values
const environment = app.node.tryGetContext('environment') || 'dev';
const projectName = app.node.tryGetContext('projectName') || 'metis';
// Common stack props
const env = {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};
const stackPrefix = `${projectName}-${environment}`;
// Tags applied to all resources
const commonTags = {
    Project: projectName,
    Environment: environment,
    ManagedBy: 'CDK',
};
// 1. Network Stack - VPC, subnets, NAT gateway
const networkStack = new network_stack_1.NetworkStack(app, `${stackPrefix}-network`, {
    env,
    projectName,
    environment,
    tags: commonTags,
});
// 2. ECR Stack - Container repositories
const ecrStack = new ecr_stack_1.EcrStack(app, `${stackPrefix}-ecr`, {
    env,
    projectName,
    environment,
    tags: commonTags,
});
// 3. Database Stack - RDS PostgreSQL + ElastiCache Redis
const databaseStack = new database_stack_1.DatabaseStack(app, `${stackPrefix}-database`, {
    env,
    projectName,
    environment,
    vpc: networkStack.vpc,
    tags: commonTags,
});
databaseStack.addDependency(networkStack);
// 4. ECS Stack - Fargate cluster, services, ALB
const ecsStack = new ecs_stack_1.EcsStack(app, `${stackPrefix}-ecs`, {
    env,
    projectName,
    environment,
    vpc: networkStack.vpc,
    dashboardRepository: ecrStack.dashboardRepository,
    apiRepository: ecrStack.apiRepository,
    databaseSecret: databaseStack.databaseSecret,
    redisCluster: databaseStack.redisCluster,
    tags: commonTags,
});
ecsStack.addDependency(databaseStack);
ecsStack.addDependency(ecrStack);
// 5. Pipeline Stack - CodePipeline + CodeBuild
const pipelineStack = new pipeline_stack_1.PipelineStack(app, `${stackPrefix}-pipeline`, {
    env,
    projectName,
    environment,
    dashboardRepository: ecrStack.dashboardRepository,
    apiRepository: ecrStack.apiRepository,
    dashboardService: ecsStack.dashboardService,
    apiService: ecsStack.apiService,
    cluster: ecsStack.cluster,
    tags: commonTags,
});
pipelineStack.addDependency(ecsStack);
app.synth();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL2FwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUNBOzs7Ozs7Ozs7R0FTRzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCx1Q0FBcUM7QUFDckMsaURBQW1DO0FBRW5DLCtEQUEyRDtBQUMzRCx1REFBbUQ7QUFDbkQsaUVBQTZEO0FBQzdELHVEQUFtRDtBQUNuRCxpRUFBNkQ7QUFFN0QsTUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7QUFFMUIscUJBQXFCO0FBQ3JCLE1BQU0sV0FBVyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEtBQUssQ0FBQztBQUNuRSxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUMsSUFBSSxPQUFPLENBQUM7QUFFckUscUJBQXFCO0FBQ3JCLE1BQU0sR0FBRyxHQUFvQjtJQUMzQixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUcsQ0FBQyxtQkFBbUI7SUFDeEMsTUFBTSxFQUFFLE9BQU8sQ0FBQyxHQUFHLENBQUMsa0JBQWtCLElBQUksV0FBVztDQUN0RCxDQUFDO0FBRUYsTUFBTSxXQUFXLEdBQUcsR0FBRyxXQUFXLElBQUksV0FBVyxFQUFFLENBQUM7QUFFcEQsZ0NBQWdDO0FBQ2hDLE1BQU0sVUFBVSxHQUFHO0lBQ2pCLE9BQU8sRUFBRSxXQUFXO0lBQ3BCLFdBQVcsRUFBRSxXQUFXO0lBQ3hCLFNBQVMsRUFBRSxLQUFLO0NBQ2pCLENBQUM7QUFFRiwrQ0FBK0M7QUFDL0MsTUFBTSxZQUFZLEdBQUcsSUFBSSw0QkFBWSxDQUFDLEdBQUcsRUFBRSxHQUFHLFdBQVcsVUFBVSxFQUFFO0lBQ25FLEdBQUc7SUFDSCxXQUFXO0lBQ1gsV0FBVztJQUNYLElBQUksRUFBRSxVQUFVO0NBQ2pCLENBQUMsQ0FBQztBQUVILHdDQUF3QztBQUN4QyxNQUFNLFFBQVEsR0FBRyxJQUFJLG9CQUFRLENBQUMsR0FBRyxFQUFFLEdBQUcsV0FBVyxNQUFNLEVBQUU7SUFDdkQsR0FBRztJQUNILFdBQVc7SUFDWCxXQUFXO0lBQ1gsSUFBSSxFQUFFLFVBQVU7Q0FDakIsQ0FBQyxDQUFDO0FBRUgseURBQXlEO0FBQ3pELE1BQU0sYUFBYSxHQUFHLElBQUksOEJBQWEsQ0FBQyxHQUFHLEVBQUUsR0FBRyxXQUFXLFdBQVcsRUFBRTtJQUN0RSxHQUFHO0lBQ0gsV0FBVztJQUNYLFdBQVc7SUFDWCxHQUFHLEVBQUUsWUFBWSxDQUFDLEdBQUc7SUFDckIsSUFBSSxFQUFFLFVBQVU7Q0FDakIsQ0FBQyxDQUFDO0FBQ0gsYUFBYSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUUxQyxnREFBZ0Q7QUFDaEQsTUFBTSxRQUFRLEdBQUcsSUFBSSxvQkFBUSxDQUFDLEdBQUcsRUFBRSxHQUFHLFdBQVcsTUFBTSxFQUFFO0lBQ3ZELEdBQUc7SUFDSCxXQUFXO0lBQ1gsV0FBVztJQUNYLEdBQUcsRUFBRSxZQUFZLENBQUMsR0FBRztJQUNyQixtQkFBbUIsRUFBRSxRQUFRLENBQUMsbUJBQW1CO0lBQ2pELGFBQWEsRUFBRSxRQUFRLENBQUMsYUFBYTtJQUNyQyxjQUFjLEVBQUUsYUFBYSxDQUFDLGNBQWM7SUFDNUMsWUFBWSxFQUFFLGFBQWEsQ0FBQyxZQUFZO0lBQ3hDLElBQUksRUFBRSxVQUFVO0NBQ2pCLENBQUMsQ0FBQztBQUNILFFBQVEsQ0FBQyxhQUFhLENBQUMsYUFBYSxDQUFDLENBQUM7QUFDdEMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUVqQywrQ0FBK0M7QUFDL0MsTUFBTSxhQUFhLEdBQUcsSUFBSSw4QkFBYSxDQUFDLEdBQUcsRUFBRSxHQUFHLFdBQVcsV0FBVyxFQUFFO0lBQ3RFLEdBQUc7SUFDSCxXQUFXO0lBQ1gsV0FBVztJQUNYLG1CQUFtQixFQUFFLFFBQVEsQ0FBQyxtQkFBbUI7SUFDakQsYUFBYSxFQUFFLFFBQVEsQ0FBQyxhQUFhO0lBQ3JDLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxnQkFBZ0I7SUFDM0MsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVO0lBQy9CLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTztJQUN6QixJQUFJLEVBQUUsVUFBVTtDQUNqQixDQUFDLENBQUM7QUFDSCxhQUFhLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBRXRDLEdBQUcsQ0FBQyxLQUFLLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIiMhL3Vzci9iaW4vZW52IG5vZGVcbi8qKlxuICogTWV0aXMgQ0RLIEFwcGxpY2F0aW9uIEVudHJ5IFBvaW50XG4gKlxuICogRGVwbG95bWVudCBvcmRlcjpcbiAqIDEuIE5ldHdvcmtTdGFjayAtIFZQQyBmb3VuZGF0aW9uXG4gKiAyLiBFY3JTdGFjayAtIENvbnRhaW5lciByZXBvc2l0b3JpZXNcbiAqIDMuIERhdGFiYXNlU3RhY2sgLSBSRFMgKyBSZWRpcyAoZGVwZW5kcyBvbiBOZXR3b3JrKVxuICogNC4gRWNzU3RhY2sgLSBGYXJnYXRlIHNlcnZpY2VzIChkZXBlbmRzIG9uIERhdGFiYXNlLCBFQ1IpXG4gKiA1LiBQaXBlbGluZVN0YWNrIC0gQ0kvQ0QgKGRlcGVuZHMgb24gRUNTKVxuICovXG5cbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJztcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5cbmltcG9ydCB7IE5ldHdvcmtTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvbmV0d29yay1zdGFjayc7XG5pbXBvcnQgeyBFY3JTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvZWNyLXN0YWNrJztcbmltcG9ydCB7IERhdGFiYXNlU3RhY2sgfSBmcm9tICcuLi9saWIvc3RhY2tzL2RhdGFiYXNlLXN0YWNrJztcbmltcG9ydCB7IEVjc1N0YWNrIH0gZnJvbSAnLi4vbGliL3N0YWNrcy9lY3Mtc3RhY2snO1xuaW1wb3J0IHsgUGlwZWxpbmVTdGFjayB9IGZyb20gJy4uL2xpYi9zdGFja3MvcGlwZWxpbmUtc3RhY2snO1xuXG5jb25zdCBhcHAgPSBuZXcgY2RrLkFwcCgpO1xuXG4vLyBHZXQgY29udGV4dCB2YWx1ZXNcbmNvbnN0IGVudmlyb25tZW50ID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgnZW52aXJvbm1lbnQnKSB8fCAnZGV2JztcbmNvbnN0IHByb2plY3ROYW1lID0gYXBwLm5vZGUudHJ5R2V0Q29udGV4dCgncHJvamVjdE5hbWUnKSB8fCAnbWV0aXMnO1xuXG4vLyBDb21tb24gc3RhY2sgcHJvcHNcbmNvbnN0IGVudjogY2RrLkVudmlyb25tZW50ID0ge1xuICBhY2NvdW50OiBwcm9jZXNzLmVudi5DREtfREVGQVVMVF9BQ0NPVU5ULFxuICByZWdpb246IHByb2Nlc3MuZW52LkNES19ERUZBVUxUX1JFR0lPTiB8fCAndXMtZWFzdC0xJyxcbn07XG5cbmNvbnN0IHN0YWNrUHJlZml4ID0gYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9YDtcblxuLy8gVGFncyBhcHBsaWVkIHRvIGFsbCByZXNvdXJjZXNcbmNvbnN0IGNvbW1vblRhZ3MgPSB7XG4gIFByb2plY3Q6IHByb2plY3ROYW1lLFxuICBFbnZpcm9ubWVudDogZW52aXJvbm1lbnQsXG4gIE1hbmFnZWRCeTogJ0NESycsXG59O1xuXG4vLyAxLiBOZXR3b3JrIFN0YWNrIC0gVlBDLCBzdWJuZXRzLCBOQVQgZ2F0ZXdheVxuY29uc3QgbmV0d29ya1N0YWNrID0gbmV3IE5ldHdvcmtTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1uZXR3b3JrYCwge1xuICBlbnYsXG4gIHByb2plY3ROYW1lLFxuICBlbnZpcm9ubWVudCxcbiAgdGFnczogY29tbW9uVGFncyxcbn0pO1xuXG4vLyAyLiBFQ1IgU3RhY2sgLSBDb250YWluZXIgcmVwb3NpdG9yaWVzXG5jb25zdCBlY3JTdGFjayA9IG5ldyBFY3JTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1lY3JgLCB7XG4gIGVudixcbiAgcHJvamVjdE5hbWUsXG4gIGVudmlyb25tZW50LFxuICB0YWdzOiBjb21tb25UYWdzLFxufSk7XG5cbi8vIDMuIERhdGFiYXNlIFN0YWNrIC0gUkRTIFBvc3RncmVTUUwgKyBFbGFzdGlDYWNoZSBSZWRpc1xuY29uc3QgZGF0YWJhc2VTdGFjayA9IG5ldyBEYXRhYmFzZVN0YWNrKGFwcCwgYCR7c3RhY2tQcmVmaXh9LWRhdGFiYXNlYCwge1xuICBlbnYsXG4gIHByb2plY3ROYW1lLFxuICBlbnZpcm9ubWVudCxcbiAgdnBjOiBuZXR3b3JrU3RhY2sudnBjLFxuICB0YWdzOiBjb21tb25UYWdzLFxufSk7XG5kYXRhYmFzZVN0YWNrLmFkZERlcGVuZGVuY3kobmV0d29ya1N0YWNrKTtcblxuLy8gNC4gRUNTIFN0YWNrIC0gRmFyZ2F0ZSBjbHVzdGVyLCBzZXJ2aWNlcywgQUxCXG5jb25zdCBlY3NTdGFjayA9IG5ldyBFY3NTdGFjayhhcHAsIGAke3N0YWNrUHJlZml4fS1lY3NgLCB7XG4gIGVudixcbiAgcHJvamVjdE5hbWUsXG4gIGVudmlyb25tZW50LFxuICB2cGM6IG5ldHdvcmtTdGFjay52cGMsXG4gIGRhc2hib2FyZFJlcG9zaXRvcnk6IGVjclN0YWNrLmRhc2hib2FyZFJlcG9zaXRvcnksXG4gIGFwaVJlcG9zaXRvcnk6IGVjclN0YWNrLmFwaVJlcG9zaXRvcnksXG4gIGRhdGFiYXNlU2VjcmV0OiBkYXRhYmFzZVN0YWNrLmRhdGFiYXNlU2VjcmV0LFxuICByZWRpc0NsdXN0ZXI6IGRhdGFiYXNlU3RhY2sucmVkaXNDbHVzdGVyLFxuICB0YWdzOiBjb21tb25UYWdzLFxufSk7XG5lY3NTdGFjay5hZGREZXBlbmRlbmN5KGRhdGFiYXNlU3RhY2spO1xuZWNzU3RhY2suYWRkRGVwZW5kZW5jeShlY3JTdGFjayk7XG5cbi8vIDUuIFBpcGVsaW5lIFN0YWNrIC0gQ29kZVBpcGVsaW5lICsgQ29kZUJ1aWxkXG5jb25zdCBwaXBlbGluZVN0YWNrID0gbmV3IFBpcGVsaW5lU3RhY2soYXBwLCBgJHtzdGFja1ByZWZpeH0tcGlwZWxpbmVgLCB7XG4gIGVudixcbiAgcHJvamVjdE5hbWUsXG4gIGVudmlyb25tZW50LFxuICBkYXNoYm9hcmRSZXBvc2l0b3J5OiBlY3JTdGFjay5kYXNoYm9hcmRSZXBvc2l0b3J5LFxuICBhcGlSZXBvc2l0b3J5OiBlY3JTdGFjay5hcGlSZXBvc2l0b3J5LFxuICBkYXNoYm9hcmRTZXJ2aWNlOiBlY3NTdGFjay5kYXNoYm9hcmRTZXJ2aWNlLFxuICBhcGlTZXJ2aWNlOiBlY3NTdGFjay5hcGlTZXJ2aWNlLFxuICBjbHVzdGVyOiBlY3NTdGFjay5jbHVzdGVyLFxuICB0YWdzOiBjb21tb25UYWdzLFxufSk7XG5waXBlbGluZVN0YWNrLmFkZERlcGVuZGVuY3koZWNzU3RhY2spO1xuXG5hcHAuc3ludGgoKTtcbiJdfQ==