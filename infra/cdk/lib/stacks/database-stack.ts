import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
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
      transitEncryptionEnabled: true,
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

    // Database alarms (production only)
    if (isProd) {
      const dbAlarmTopic = new sns.Topic(this, 'DbAlarmTopic', {
        topicName: `${projectName}-${environment}-db-alarms`,
        displayName: `${projectName} ${environment} Database Alarms`,
      });
      const dbAlarmAction = new cloudwatch_actions.SnsAction(dbAlarmTopic);

      // RDS CPU utilization alarm
      const dbCpuAlarm = new cloudwatch.Alarm(this, 'DbCpuAlarm', {
        alarmName: `${projectName}-${environment}-db-cpu-high`,
        alarmDescription: 'RDS CPU utilization exceeds 75%',
        metric: this.databaseInstance.metricCPUUtilization({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 75,
        evaluationPeriods: 3,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      dbCpuAlarm.addAlarmAction(dbAlarmAction);
      dbCpuAlarm.addOkAction(dbAlarmAction);

      // RDS database connections alarm
      const dbConnectionAlarm = new cloudwatch.Alarm(this, 'DbConnectionAlarm', {
        alarmName: `${projectName}-${environment}-db-connections-high`,
        alarmDescription: 'RDS database connections exceeds 80',
        metric: this.databaseInstance.metricDatabaseConnections({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 80,
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      dbConnectionAlarm.addAlarmAction(dbAlarmAction);
      dbConnectionAlarm.addOkAction(dbAlarmAction);

      // RDS free storage space alarm (< 5GB)
      const dbStorageAlarm = new cloudwatch.Alarm(this, 'DbStorageAlarm', {
        alarmName: `${projectName}-${environment}-db-storage-low`,
        alarmDescription: 'RDS free storage space below 5GB',
        metric: this.databaseInstance.metricFreeStorageSpace({
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5 * 1024 * 1024 * 1024,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
      dbStorageAlarm.addAlarmAction(dbAlarmAction);
      dbStorageAlarm.addOkAction(dbAlarmAction);
    }
  }
}
