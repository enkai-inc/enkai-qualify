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
exports.NetworkStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
/**
 * Network Stack - VPC foundation for Metis infrastructure
 *
 * Creates:
 * - VPC with 2 AZs
 * - Public subnets (for ALB)
 * - Private subnets with egress (for ECS Fargate)
 * - NAT Gateway (single for dev, multi for prod)
 */
class NetworkStack extends cdk.Stack {
    vpc;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { projectName, environment } = props;
        const isProd = environment === 'prod';
        // Create VPC with 2 availability zones
        this.vpc = new ec2.Vpc(this, 'Vpc', {
            vpcName: `${projectName}-${environment}-vpc`,
            maxAzs: 2,
            natGateways: isProd ? 2 : 1, // Single NAT for dev to save costs
            subnetConfiguration: [
                {
                    name: 'Public',
                    subnetType: ec2.SubnetType.PUBLIC,
                    cidrMask: 24,
                    mapPublicIpOnLaunch: false,
                },
                {
                    name: 'Private',
                    subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidrMask: 24,
                },
                {
                    name: 'Isolated',
                    subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
                    cidrMask: 24,
                },
            ],
        });
        // VPC Flow Logs for production
        if (isProd) {
            this.vpc.addFlowLog('FlowLog', {
                destination: ec2.FlowLogDestination.toCloudWatchLogs(),
                trafficType: ec2.FlowLogTrafficType.REJECT,
            });
        }
        // Outputs
        new cdk.CfnOutput(this, 'VpcId', {
            value: this.vpc.vpcId,
            description: 'VPC ID',
            exportName: `${projectName}-${environment}-vpc-id`,
        });
        new cdk.CfnOutput(this, 'PrivateSubnets', {
            value: this.vpc.privateSubnets.map((s) => s.subnetId).join(','),
            description: 'Private subnet IDs',
            exportName: `${projectName}-${environment}-private-subnets`,
        });
    }
}
exports.NetworkStack = NetworkStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibmV0d29yay1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi9zdGFja3MvbmV0d29yay1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMseURBQTJDO0FBUTNDOzs7Ozs7OztHQVFHO0FBQ0gsTUFBYSxZQUFhLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFDekIsR0FBRyxDQUFVO0lBRTdCLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFDM0MsTUFBTSxNQUFNLEdBQUcsV0FBVyxLQUFLLE1BQU0sQ0FBQztRQUV0Qyx1Q0FBdUM7UUFDdkMsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRTtZQUNsQyxPQUFPLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxNQUFNO1lBQzVDLE1BQU0sRUFBRSxDQUFDO1lBQ1QsV0FBVyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsbUNBQW1DO1lBQ2hFLG1CQUFtQixFQUFFO2dCQUNuQjtvQkFDRSxJQUFJLEVBQUUsUUFBUTtvQkFDZCxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNO29CQUNqQyxRQUFRLEVBQUUsRUFBRTtvQkFDWixtQkFBbUIsRUFBRSxLQUFLO2lCQUMzQjtnQkFDRDtvQkFDRSxJQUFJLEVBQUUsU0FBUztvQkFDZixVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxtQkFBbUI7b0JBQzlDLFFBQVEsRUFBRSxFQUFFO2lCQUNiO2dCQUNEO29CQUNFLElBQUksRUFBRSxVQUFVO29CQUNoQixVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0I7b0JBQzNDLFFBQVEsRUFBRSxFQUFFO2lCQUNiO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCwrQkFBK0I7UUFDL0IsSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUNYLElBQUksQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLFNBQVMsRUFBRTtnQkFDN0IsV0FBVyxFQUFFLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDdEQsV0FBVyxFQUFFLEdBQUcsQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNO2FBQzNDLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCxVQUFVO1FBQ1YsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxPQUFPLEVBQUU7WUFDL0IsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSztZQUNyQixXQUFXLEVBQUUsUUFBUTtZQUNyQixVQUFVLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxTQUFTO1NBQ25ELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZ0JBQWdCLEVBQUU7WUFDeEMsS0FBSyxFQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7WUFDL0QsV0FBVyxFQUFFLG9CQUFvQjtZQUNqQyxVQUFVLEVBQUUsR0FBRyxXQUFXLElBQUksV0FBVyxrQkFBa0I7U0FDNUQsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBdkRELG9DQXVEQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBOZXR3b3JrU3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgcHJvamVjdE5hbWU6IHN0cmluZztcbiAgZW52aXJvbm1lbnQ6IHN0cmluZztcbn1cblxuLyoqXG4gKiBOZXR3b3JrIFN0YWNrIC0gVlBDIGZvdW5kYXRpb24gZm9yIE1ldGlzIGluZnJhc3RydWN0dXJlXG4gKlxuICogQ3JlYXRlczpcbiAqIC0gVlBDIHdpdGggMiBBWnNcbiAqIC0gUHVibGljIHN1Ym5ldHMgKGZvciBBTEIpXG4gKiAtIFByaXZhdGUgc3VibmV0cyB3aXRoIGVncmVzcyAoZm9yIEVDUyBGYXJnYXRlKVxuICogLSBOQVQgR2F0ZXdheSAoc2luZ2xlIGZvciBkZXYsIG11bHRpIGZvciBwcm9kKVxuICovXG5leHBvcnQgY2xhc3MgTmV0d29ya1N0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHZwYzogZWMyLlZwYztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTmV0d29ya1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IHsgcHJvamVjdE5hbWUsIGVudmlyb25tZW50IH0gPSBwcm9wcztcbiAgICBjb25zdCBpc1Byb2QgPSBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnO1xuXG4gICAgLy8gQ3JlYXRlIFZQQyB3aXRoIDIgYXZhaWxhYmlsaXR5IHpvbmVzXG4gICAgdGhpcy52cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCAnVnBjJywge1xuICAgICAgdnBjTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXZwY2AsXG4gICAgICBtYXhBenM6IDIsXG4gICAgICBuYXRHYXRld2F5czogaXNQcm9kID8gMiA6IDEsIC8vIFNpbmdsZSBOQVQgZm9yIGRldiB0byBzYXZlIGNvc3RzXG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiAnUHVibGljJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICAgIG1hcFB1YmxpY0lwT25MYXVuY2g6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ1ByaXZhdGUnLFxuICAgICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICAgICAgY2lkck1hc2s6IDI0LFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgbmFtZTogJ0lzb2xhdGVkJyxcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgICAgIGNpZHJNYXNrOiAyNCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBWUEMgRmxvdyBMb2dzIGZvciBwcm9kdWN0aW9uXG4gICAgaWYgKGlzUHJvZCkge1xuICAgICAgdGhpcy52cGMuYWRkRmxvd0xvZygnRmxvd0xvZycsIHtcbiAgICAgICAgZGVzdGluYXRpb246IGVjMi5GbG93TG9nRGVzdGluYXRpb24udG9DbG91ZFdhdGNoTG9ncygpLFxuICAgICAgICB0cmFmZmljVHlwZTogZWMyLkZsb3dMb2dUcmFmZmljVHlwZS5SRUpFQ1QsXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1ZwY0lkJywge1xuICAgICAgdmFsdWU6IHRoaXMudnBjLnZwY0lkLFxuICAgICAgZGVzY3JpcHRpb246ICdWUEMgSUQnLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXZwYy1pZGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnUHJpdmF0ZVN1Ym5ldHMnLCB7XG4gICAgICB2YWx1ZTogdGhpcy52cGMucHJpdmF0ZVN1Ym5ldHMubWFwKChzKSA9PiBzLnN1Ym5ldElkKS5qb2luKCcsJyksXG4gICAgICBkZXNjcmlwdGlvbjogJ1ByaXZhdGUgc3VibmV0IElEcycsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tcHJpdmF0ZS1zdWJuZXRzYCxcbiAgICB9KTtcbiAgfVxufVxuIl19