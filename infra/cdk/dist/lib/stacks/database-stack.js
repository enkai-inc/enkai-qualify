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
exports.DatabaseStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const elasticache = __importStar(require("aws-cdk-lib/aws-elasticache"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
/**
 * Database Stack - RDS PostgreSQL and ElastiCache Redis
 *
 * Creates:
 * - RDS PostgreSQL 16 instance (db.t3.micro for dev, db.t3.small for prod)
 * - ElastiCache Redis 7 cluster
 * - Security groups for database access
 * - Secrets Manager secret for database credentials
 */
class DatabaseStack extends cdk.Stack {
    databaseSecret;
    databaseInstance;
    redisCluster;
    databaseSecurityGroup;
    redisSecurityGroup;
    constructor(scope, id, props) {
        super(scope, id, props);
        const { projectName, environment, vpc } = props;
        const isProd = environment === 'prod';
        // Database credentials secret
        this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
            secretName: `${projectName}/${environment}/db-credentials`,
            generateSecretString: {
                secretStringTemplate: JSON.stringify({ username: 'metis_admin' }),
                generateStringKey: 'password',
                excludePunctuation: true,
                passwordLength: 32,
            },
        });
        // Database security group
        this.databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSG', {
            vpc,
            securityGroupName: `${projectName}-${environment}-database-sg`,
            description: 'Security group for RDS PostgreSQL',
            allowAllOutbound: false,
        });
        // Redis security group
        this.redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSG', {
            vpc,
            securityGroupName: `${projectName}-${environment}-redis-sg`,
            description: 'Security group for ElastiCache Redis',
            allowAllOutbound: false,
        });
        // RDS PostgreSQL instance
        this.databaseInstance = new rds.DatabaseInstance(this, 'Database', {
            engine: rds.DatabaseInstanceEngine.postgres({
                version: rds.PostgresEngineVersion.VER_16,
            }),
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, isProd ? ec2.InstanceSize.SMALL : ec2.InstanceSize.MICRO),
            vpc,
            vpcSubnets: {
                subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
            securityGroups: [this.databaseSecurityGroup],
            credentials: rds.Credentials.fromSecret(this.databaseSecret),
            databaseName: 'metis',
            multiAz: isProd,
            allocatedStorage: isProd ? 100 : 20,
            maxAllocatedStorage: isProd ? 500 : 50,
            storageEncrypted: true,
            backupRetention: cdk.Duration.days(isProd ? 30 : 7),
            deletionProtection: isProd,
            removalPolicy: isProd
                ? cdk.RemovalPolicy.RETAIN
                : cdk.RemovalPolicy.DESTROY,
            enablePerformanceInsights: isProd,
            cloudwatchLogsRetention: cdk.aws_logs.RetentionDays.ONE_MONTH,
        });
        // ElastiCache subnet group
        const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
            subnetIds: vpc.isolatedSubnets.map((s) => s.subnetId),
            description: `Redis subnet group for ${projectName} ${environment}`,
            cacheSubnetGroupName: `${projectName}-${environment}-redis-subnet`,
        });
        // ElastiCache Redis cluster
        this.redisCluster = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
            clusterName: `${projectName}-${environment}-redis`,
            engine: 'redis',
            engineVersion: '7.1',
            cacheNodeType: isProd ? 'cache.t3.small' : 'cache.t3.micro',
            numCacheNodes: 1,
            cacheSubnetGroupName: redisSubnetGroup.ref,
            vpcSecurityGroupIds: [this.redisSecurityGroup.securityGroupId],
            snapshotRetentionLimit: isProd ? 7 : 0,
        });
        this.redisCluster.addDependency(redisSubnetGroup);
        // Outputs
        new cdk.CfnOutput(this, 'DatabaseEndpoint', {
            value: this.databaseInstance.dbInstanceEndpointAddress,
            description: 'RDS PostgreSQL endpoint',
            exportName: `${projectName}-${environment}-db-endpoint`,
        });
        new cdk.CfnOutput(this, 'DatabaseSecretArn', {
            value: this.databaseSecret.secretArn,
            description: 'Database credentials secret ARN',
            exportName: `${projectName}-${environment}-db-secret-arn`,
        });
        new cdk.CfnOutput(this, 'RedisEndpoint', {
            value: this.redisCluster.attrRedisEndpointAddress,
            description: 'ElastiCache Redis endpoint',
            exportName: `${projectName}-${environment}-redis-endpoint`,
        });
    }
}
exports.DatabaseStack = DatabaseStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YWJhc2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvc3RhY2tzL2RhdGFiYXNlLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MseURBQTJDO0FBQzNDLHlFQUEyRDtBQUMzRCwrRUFBaUU7QUFTakU7Ozs7Ozs7O0dBUUc7QUFDSCxNQUFhLGFBQWMsU0FBUSxHQUFHLENBQUMsS0FBSztJQUMxQixjQUFjLENBQXdCO0lBQ3RDLGdCQUFnQixDQUF1QjtJQUN2QyxZQUFZLENBQThCO0lBQzFDLHFCQUFxQixDQUFvQjtJQUN6QyxrQkFBa0IsQ0FBb0I7SUFFdEQsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUF5QjtRQUNqRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUUsR0FBRyxLQUFLLENBQUM7UUFDaEQsTUFBTSxNQUFNLEdBQUcsV0FBVyxLQUFLLE1BQU0sQ0FBQztRQUV0Qyw4QkFBOEI7UUFDOUIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLGNBQWMsQ0FBQyxNQUFNLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQ3RFLFVBQVUsRUFBRSxHQUFHLFdBQVcsSUFBSSxXQUFXLGlCQUFpQjtZQUMxRCxvQkFBb0IsRUFBRTtnQkFDcEIsb0JBQW9CLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLFFBQVEsRUFBRSxhQUFhLEVBQUUsQ0FBQztnQkFDakUsaUJBQWlCLEVBQUUsVUFBVTtnQkFDN0Isa0JBQWtCLEVBQUUsSUFBSTtnQkFDeEIsY0FBYyxFQUFFLEVBQUU7YUFDbkI7U0FDRixDQUFDLENBQUM7UUFFSCwwQkFBMEI7UUFDMUIsSUFBSSxDQUFD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Q0FBQztJQUNMLENBQUM7Q0FDRjtBQWhIRCxzQ0FnSEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xuaW1wb3J0ICogYXMgZWxhc3RpY2FjaGUgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVsYXN0aWNhY2hlJztcbmltcG9ydCAqIGFzIHNlY3JldHNtYW5hZ2VyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zZWNyZXRzbWFuYWdlcic7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBEYXRhYmFzZVN0YWNrUHJvcHMgZXh0ZW5kcyBjZGsuU3RhY2tQcm9wcyB7XG4gIHByb2plY3ROYW1lOiBzdHJpbmc7XG4gIGVudmlyb25tZW50OiBzdHJpbmc7XG4gIHZwYzogZWMyLlZwYztcbn1cblxuLyoqXG4gKiBEYXRhYmFzZSBTdGFjayAtIFJEUyBQb3N0Z3JlU1FMIGFuZCBFbGFzdGlDYWNoZSBSZWRpc1xuICpcbiAqIENyZWF0ZXM6XG4gKiAtIFJEUyBQb3N0Z3JlU1FMIDE2IGluc3RhbmNlIChkYi50My5taWNybyBmb3IgZGV2LCBkYi50My5zbWFsbCBmb3IgcHJvZClcbiAqIC0gRWxhc3RpQ2FjaGUgUmVkaXMgNyBjbHVzdGVyXG4gKiAtIFNlY3VyaXR5IGdyb3VwcyBmb3IgZGF0YWJhc2UgYWNjZXNzXG4gKiAtIFNlY3JldHMgTWFuYWdlciBzZWNyZXQgZm9yIGRhdGFiYXNlIGNyZWRlbnRpYWxzXG4gKi9cbmV4cG9ydCBjbGFzcyBEYXRhYmFzZVN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGRhdGFiYXNlU2VjcmV0OiBzZWNyZXRzbWFuYWdlci5TZWNyZXQ7XG4gIHB1YmxpYyByZWFkb25seSBkYXRhYmFzZUluc3RhbmNlOiByZHMuRGF0YWJhc2VJbnN0YW5jZTtcbiAgcHVibGljIHJlYWRvbmx5IHJlZGlzQ2x1c3RlcjogZWxhc3RpY2FjaGUuQ2ZuQ2FjaGVDbHVzdGVyO1xuICBwdWJsaWMgcmVhZG9ubHkgZGF0YWJhc2VTZWN1cml0eUdyb3VwOiBlYzIuU2VjdXJpdHlHcm91cDtcbiAgcHVibGljIHJlYWRvbmx5IHJlZGlzU2VjdXJpdHlHcm91cDogZWMyLlNlY3VyaXR5R3JvdXA7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IERhdGFiYXNlU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgeyBwcm9qZWN0TmFtZSwgZW52aXJvbm1lbnQsIHZwYyB9ID0gcHJvcHM7XG4gICAgY29uc3QgaXNQcm9kID0gZW52aXJvbm1lbnQgPT09ICdwcm9kJztcblxuICAgIC8vIERhdGFiYXNlIGNyZWRlbnRpYWxzIHNlY3JldFxuICAgIHRoaXMuZGF0YWJhc2VTZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsICdEYXRhYmFzZVNlY3JldCcsIHtcbiAgICAgIHNlY3JldE5hbWU6IGAke3Byb2plY3ROYW1lfS8ke2Vudmlyb25tZW50fS9kYi1jcmVkZW50aWFsc2AsXG4gICAgICBnZW5lcmF0ZVNlY3JldFN0cmluZzoge1xuICAgICAgICBzZWNyZXRTdHJpbmdUZW1wbGF0ZTogSlNPTi5zdHJpbmdpZnkoeyB1c2VybmFtZTogJ21ldGlzX2FkbWluJyB9KSxcbiAgICAgICAgZ2VuZXJhdGVTdHJpbmdLZXk6ICdwYXNzd29yZCcsXG4gICAgICAgIGV4Y2x1ZGVQdW5jdHVhdGlvbjogdHJ1ZSxcbiAgICAgICAgcGFzc3dvcmRMZW5ndGg6IDMyLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIERhdGFiYXNlIHNlY3VyaXR5IGdyb3VwXG4gICAgdGhpcy5kYXRhYmFzZVNlY3VyaXR5R3JvdXAgPSBuZXcgZWMyLlNlY3VyaXR5R3JvdXAodGhpcywgJ0RhdGFiYXNlU0cnLCB7XG4gICAgICB2cGMsXG4gICAgICBzZWN1cml0eUdyb3VwTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWRhdGFiYXNlLXNnYCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnU2VjdXJpdHkgZ3JvdXAgZm9yIFJEUyBQb3N0Z3JlU1FMJyxcbiAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IGZhbHNlLFxuICAgIH0pO1xuXG4gICAgLy8gUmVkaXMgc2VjdXJpdHkgZ3JvdXBcbiAgICB0aGlzLnJlZGlzU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cCh0aGlzLCAnUmVkaXNTRycsIHtcbiAgICAgIHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tcmVkaXMtc2dgLFxuICAgICAgZGVzY3JpcHRpb246ICdTZWN1cml0eSBncm91cCBmb3IgRWxhc3RpQ2FjaGUgUmVkaXMnLFxuICAgICAgYWxsb3dBbGxPdXRib3VuZDogZmFsc2UsXG4gICAgfSk7XG5cbiAgICAvLyBSRFMgUG9zdGdyZVNRTCBpbnN0YW5jZVxuICAgIHRoaXMuZGF0YWJhc2VJbnN0YW5jZSA9IG5ldyByZHMuRGF0YWJhc2VJbnN0YW5jZSh0aGlzLCAnRGF0YWJhc2UnLCB7XG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUluc3RhbmNlRW5naW5lLnBvc3RncmVzKHtcbiAgICAgICAgdmVyc2lvbjogcmRzLlBvc3RncmVzRW5naW5lVmVyc2lvbi5WRVJfMTYsXG4gICAgICB9KSxcbiAgICAgIGluc3RhbmNlVHlwZTogZWMyLkluc3RhbmNlVHlwZS5vZihcbiAgICAgICAgZWMyLkluc3RhbmNlQ2xhc3MuVDMsXG4gICAgICAgIGlzUHJvZCA/IGVjMi5JbnN0YW5jZVNpemUuU01BTEwgOiBlYzIuSW5zdGFuY2VTaXplLk1JQ1JPXG4gICAgICApLFxuICAgICAgdnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX0lTT0xBVEVELFxuICAgICAgfSxcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbdGhpcy5kYXRhYmFzZVNlY3VyaXR5R3JvdXBdLFxuICAgICAgY3JlZGVudGlhbHM6IHJkcy5DcmVkZW50aWFscy5mcm9tU2VjcmV0KHRoaXMuZGF0YWJhc2VTZWNyZXQpLFxuICAgICAgZGF0YWJhc2VOYW1lOiAnbWV0aXMnLFxuICAgICAgbXVsdGlBejogaXNQcm9kLFxuICAgICAgYWxsb2NhdGVkU3RvcmFnZTogaXNQcm9kID8gMTAwIDogMjAsXG4gICAgICBtYXhBbGxvY2F0ZWRTdG9yYWdlOiBpc1Byb2QgPyA1MDAgOiA1MCxcbiAgICAgIHN0b3JhZ2VFbmNyeXB0ZWQ6IHRydWUsXG4gICAgICBiYWNrdXBSZXRlbnRpb246IGNkay5EdXJhdGlvbi5kYXlzKGlzUHJvZCA/IDMwIDogNyksXG4gICAgICBkZWxldGlvblByb3RlY3Rpb246IGlzUHJvZCxcbiAgICAgIHJlbW92YWxQb2xpY3k6IGlzUHJvZFxuICAgICAgICA/IGNkay5SZW1vdmFsUG9saWN5LlJFVEFJTlxuICAgICAgICA6IGNkay5SZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBlbmFibGVQZXJmb3JtYW5jZUluc2lnaHRzOiBpc1Byb2QsXG4gICAgICBjbG91ZHdhdGNoTG9nc1JldGVudGlvbjogY2RrLmF3c19sb2dzLlJldGVudGlvbkRheXMuT05FX01PTlRILFxuICAgIH0pO1xuXG4gICAgLy8gRWxhc3RpQ2FjaGUgc3VibmV0IGdyb3VwXG4gICAgY29uc3QgcmVkaXNTdWJuZXRHcm91cCA9IG5ldyBlbGFzdGljYWNoZS5DZm5TdWJuZXRHcm91cChcbiAgICAgIHRoaXMsXG4gICAgICAnUmVkaXNTdWJuZXRHcm91cCcsXG4gICAgICB7XG4gICAgICAgIHN1Ym5ldElkczogdnBjLmlzb2xhdGVkU3VibmV0cy5tYXAoKHMpID0+IHMuc3VibmV0SWQpLFxuICAgICAgICBkZXNjcmlwdGlvbjogYFJlZGlzIHN1Ym5ldCBncm91cCBmb3IgJHtwcm9qZWN0TmFtZX0gJHtlbnZpcm9ubWVudH1gLFxuICAgICAgICBjYWNoZVN1Ym5ldEdyb3VwTmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LXJlZGlzLXN1Ym5ldGAsXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIEVsYXN0aUNhY2hlIFJlZGlzIGNsdXN0ZXJcbiAgICB0aGlzLnJlZGlzQ2x1c3RlciA9IG5ldyBlbGFzdGljYWNoZS5DZm5DYWNoZUNsdXN0ZXIodGhpcywgJ1JlZGlzQ2x1c3RlcicsIHtcbiAgICAgIGNsdXN0ZXJOYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tcmVkaXNgLFxuICAgICAgZW5naW5lOiAncmVkaXMnLFxuICAgICAgZW5naW5lVmVyc2lvbjogJzcuMScsXG4gICAgICBjYWNoZU5vZGVUeXBlOiBpc1Byb2QgPyAnY2FjaGUudDMuc21hbGwnIDogJ2NhY2hlLnQzLm1pY3JvJyxcbiAgICAgIG51bUNhY2hlTm9kZXM6IDEsXG4gICAgICBjYWNoZVN1Ym5ldEdyb3VwTmFtZTogcmVkaXNTdWJuZXRHcm91cC5yZWYsXG4gICAgICB2cGNTZWN1cml0eUdyb3VwSWRzOiBbdGhpcy5yZWRpc1NlY3VyaXR5R3JvdXAuc2VjdXJpdHlHcm91cElkXSxcbiAgICAgIHNuYXBzaG90UmV0ZW50aW9uTGltaXQ6IGlzUHJvZCA/IDcgOiAwLFxuICAgIH0pO1xuICAgIHRoaXMucmVkaXNDbHVzdGVyLmFkZERlcGVuZGVuY3kocmVkaXNTdWJuZXRHcm91cCk7XG5cbiAgICAvLyBPdXRwdXRzXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0RhdGFiYXNlRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kYXRhYmFzZUluc3RhbmNlLmRiSW5zdGFuY2VFbmRwb2ludEFkZHJlc3MsXG4gICAgICBkZXNjcmlwdGlvbjogJ1JEUyBQb3N0Z3JlU1FMIGVuZHBvaW50JyxcbiAgICAgIGV4cG9ydE5hbWU6IGAke3Byb2plY3ROYW1lfS0ke2Vudmlyb25tZW50fS1kYi1lbmRwb2ludGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRGF0YWJhc2VTZWNyZXRBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5kYXRhYmFzZVNlY3JldC5zZWNyZXRBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0RhdGFiYXNlIGNyZWRlbnRpYWxzIHNlY3JldCBBUk4nLFxuICAgICAgZXhwb3J0TmFtZTogYCR7cHJvamVjdE5hbWV9LSR7ZW52aXJvbm1lbnR9LWRiLXNlY3JldC1hcm5gLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1JlZGlzRW5kcG9pbnQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yZWRpc0NsdXN0ZXIuYXR0clJlZGlzRW5kcG9pbnRBZGRyZXNzLFxuICAgICAgZGVzY3JpcHRpb246ICdFbGFzdGlDYWNoZSBSZWRpcyBlbmRwb2ludCcsXG4gICAgICBleHBvcnROYW1lOiBgJHtwcm9qZWN0TmFtZX0tJHtlbnZpcm9ubWVudH0tcmVkaXMtZW5kcG9pbnRgLFxuICAgIH0pO1xuICB9XG59XG4iXX0=