import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface DatabaseStackProps extends cdk.StackProps {
  projectName: string;
  environment: string;
  vpc: ec2.Vpc;
}

/**
 * Database Stack - RDS PostgreSQL and ElastiCache Redis
 *
 * Creates:
 * - RDS PostgreSQL 16 instance (db.t3.micro for dev, db.t3.small for prod)
 * - ElastiCache Redis 7 cluster
 * - Security groups for database access
 * - Secrets Manager secret for database credentials
 */
export class DatabaseStack extends cdk.Stack {
  public readonly databaseSecret: secretsmanager.Secret;
  public readonly databaseInstance: rds.DatabaseInstance;
  public readonly redisCluster: elasticache.CfnCacheCluster;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;
  public readonly redisSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const { projectName, environment, vpc } = props;
    const isProd = environment === 'prod';

    // Database credentials secret
    this.databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: `${projectName}/${environment}/db-credentials`,
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'enkai_qualify_admin' }),
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
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        isProd ? ec2.InstanceSize.SMALL : ec2.InstanceSize.MICRO
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.databaseSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.databaseSecret),
      databaseName: 'enkai_qualify',
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
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(
      this,
      'RedisSubnetGroup',
      {
        subnetIds: vpc.isolatedSubnets.map((s) => s.subnetId),
        description: `Redis subnet group for ${projectName} ${environment}`,
        cacheSubnetGroupName: `${projectName}-${environment}-redis-subnet`,
      }
    );

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
