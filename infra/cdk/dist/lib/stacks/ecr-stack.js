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
exports.EcrStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ecr = __importStar(require("aws-cdk-lib/aws-ecr"));
/**
 * ECR Stack - Container repositories for Metis services
 *
 * Creates:
 * - Dashboard repository
 * - API repository
 *
 * Both repositories have lifecycle rules to limit stored images
 */
class EcrStack extends cdk.Stack {
    dashboardRepository;
    apiRepository;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { projectName, environment } = props;
        // Dashboard repository
        this.dashboardRepository = new ecr.Repository(this, 'DashboardRepo', {
            repositoryName: `${projectName}-${environment}-dashboard`,
            imageScanOnPush: true,
            imageTagMutability: ecr.TagMutability.MUTABLE,
            removalPolicy: environment === 'prod'
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
            removalPolicy: environment === 'prod'
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
    }
}
exports.EcrStack = EcrStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWNyLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3N0YWNrcy9lY3Itc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQVEzQzs7Ozs7Ozs7R0FRRztBQUNILE1BQWEsUUFBUyxTQUFRLEdBQUcsQ0FBQyxLQUFLO0lBQ3JCLG1CQUFtQixDQUFpQjtJQUNwQyxhQUFhLENBQWlCO0lBRTlDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBb0I7UUFDNUQsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFFM0MsdUJBQXVCO1FBQ3ZCLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRTtZQUNuRSxjQUFjLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxZQUFZO1lBQ3pELGVBQWUsRUFBRSxJQUFJO1lBQ3JCLGtCQUFrQixFQUFFLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUM3QyxhQUFhLEVBQ1gsV0FBVyxLQUFLLE1BQU07Z0JBQ3BCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07Z0JBQzFCLENBQUMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLE9BQU87WUFDL0IsYUFBYSxFQUFFLFdBQVcsS0FBSyxNQUFNO1lBQ3JDLGNBQWMsRUFBRTtnQkFDZDtvQkFDRSxXQUFXLEVBQUUscUJBQXFCO29CQUNsQyxhQUFhLEVBQUUsRUFBRTtvQkFDakIsWUFBWSxFQUFFLENBQUM7b0JBQ2YsU0FBUyxFQUFFLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRztpQkFDN0I7YUFDRjtTQUNGLENBQUMsQ0FBQztRQUVILGlCQUFpQjtRQUNqQixJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFO1lBQ3ZELGNBQWMsRUFBRSxHQUFHLFdBQVcsSUFBSSxXQUFXLE1BQU07WUFDbkQsZUFBZSxFQUFFLElBQUk7WUFDckIsa0JBQWtCLEVBQUUsR0FBRyxDQUFDLGFBQWEsQ0FBQyxPQUFPO1lBQzdDLGFBQWEsRUFDWCxXQUFXLEtBQUssTUFBTTtnQkFDcEIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsTUFBTTtnQkFDMUIsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsT0FBTztZQUMvQixhQUFhLEVBQUUsV0FBVyxLQUFLLE1BQU07WUFDckMsY0FBYyxFQUFFO2dCQUNkO29CQUNFLFdBQVcsRUFBRSxxQkFBcUI7b0JBQ2xDLGFBQWEsRUFBRSxFQUFFO29CQUNqQixZQUFZLEVBQUUsQ0FBQztvQkFDZixTQUFTLEVBQUUsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHO2lCQUM3QjthQUNGO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsVUFBVTtRQUNWLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDMUMsS0FBSyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxhQUFhO1lBQzdDLFdBQVcsRUFBRSw4QkFBOEI7WUFDM0MsVUFBVSxFQUFFLEdBQUcsV0FBVyxJQUFJLFdBQVcscUJBQXFCO1NBQy9ELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ3BDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWE7WUFDdkMsV0FBVyxFQUFFLHdCQUF3QjtZQUNyQyxVQUFVLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxlQUFlO1NBQ3pELENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQTlERCw0QkE4REMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWNyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lY3InO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRWNyU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbn1cblxuLyoqXG4gKiBFQ1IgU3RhY2sgLSBDb250YWluZXIgcmVwb3NpdG9yaWVzIGZvciBNZXRpcyBzZXJ2aWNlc1xuICpcbiAqIENyZWF0ZXM6XG4gKiAtIERhc2hib2FyZCByZXBvc2l0b3J5XG4gKiAtIEFQSSByZXBvc2l0b3J5XG4gKlxuICogQm90aCByZXBvc2l0b3JpZXMgaGF2ZSBsaWZlY3ljbGUgcnVsZXMgdG8gbGltaXQgc3RvcmVkIGltYWdlc1xuICovXG5leHBvcnQgY2xhc3MgRWNyU3RhY2sgZXh0ZW5kcyBjZGsuU3RhY2sge1xuICBwdWJsaWMgcmVhZG9ubHkgZGFzaGJvYXJkUmVwb3NpdG9yeTogZWNyLlJlcG9zaXRvcnk7XG4gIHB1YmxpYyByZWFkb25seSBhcGlSZXBvc2l0b3J5OiBlY3IuUmVwb3NpdG9yeTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRWNyU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQgfSA9IHByb3BzO1xuXG4gICAgLy8gRGFzaGJvYXJkIHJlcG9zaXRvcnlcbiAgICB0aGlzLmRhc2hib2FyZFJlcG9zaXRvcnkgPSBuZXcgZWNyLlJlcG9zaXRvcnkodGhpcywgJ0Rhc2hib2FyZFJlcG8nLCB7XG4gICAgICByZXBvc2l0b3J5TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWRhc2hib2FyZGAsXG4gICAgICBpbWFnZVNjYW5PblB1c2g6IHRydWUsXG4gICAgICBpbWFnZVRhZ011dGFiaWxpdHk6IGVjci5UYWdNdXRhYmlsaXR5Lk1VVEFCTEUsXG4gICAgICByZW1vdmFsUG9saWN5OlxuICAgICAgICBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnXG4gICAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU5cbiAgICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBlbXB0eU9uRGVsZXRlOiBlbnZpcm9ubWVudCAhPT0gJ3Byb2QnLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnS2VlcCBsYXN0IDEwIGltYWdlcycsXG4gICAgICAgICAgbWF4SW1hZ2VDb3VudDogMTAsXG4gICAgICAgICAgcnVsZVByaW9yaXR5OiAxLFxuICAgICAgICAgIHRhZ1N0YXR1czogZWNyLlRhZ1N0YXR1cy5BTlksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIHJlcG9zaXRvcnlcbiAgICB0aGlzLmFwaVJlcG9zaXRvcnkgPSBuZXcgZWNyLlJlcG9zaXRvcnkodGhpcywgJ0FwaVJlcG8nLCB7XG4gICAgICByZXBvc2l0b3J5TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFwaWAsXG4gICAgICBpbWFnZVNjYW5PblB1c2g6IHRydWUsXG4gICAgICBpbWFnZVRhZ011dGFiaWxpdHk6IGVjci5UYWdNdXRhYmlsaXR5Lk1VVEFCTEUsXG4gICAgICByZW1vdmFsUG9saWN5OlxuICAgICAgICBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnXG4gICAgICAgICAgPyBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU5cbiAgICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBlbXB0eU9uRGVsZXRlOiBlbnZpcm9ubWVudCAhPT0gJ3Byb2QnLFxuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnS2VlcCBsYXN0IDEwIGltYWdlcycsXG4gICAgICAgICAgbWF4SW1hZ2VDb3VudDogMTAsXG4gICAgICAgICAgcnVsZVByaW9yaXR5OiAxLFxuICAgICAgICAgIHRhZ1N0YXR1czogZWNyLlRhZ1N0YXR1cy5BTlksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gT3V0cHV0c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdEYXNoYm9hcmRSZXBvVXJpJywge1xuICAgICAgdmFsdWU6IHRoaXMuZGFzaGJvYXJkUmVwb3NpdG9yeS5yZXBvc2l0b3J5VXJpLFxuICAgICAgZGVzY3JpcHRpb246ICdEYXNoYm9hcmQgRUNSIHJlcG9zaXRvcnkgVVJJJyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1kYXNoYm9hcmQtcmVwby11cmlgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaVJlcG9VcmknLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlSZXBvc2l0b3J5LnJlcG9zaXRvcnlVcmksXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBFQ1IgcmVwb3NpdG9yeSBVUkknLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWFwaS1yZXBvLXVyaWAsXG4gICAgfSk7XG4gIH1cbn1cbiJdfQ==