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
export declare class DatabaseStack extends cdk.Stack {
    readonly databaseSecret: secretsmanager.Secret;
    readonly databaseInstance: rds.DatabaseInstance;
    readonly redisCluster: elasticache.CfnCacheCluster;
    readonly databaseSecurityGroup: ec2.SecurityGroup;
    readonly redisSecurityGroup: ec2.SecurityGroup;
    constructor(scope: Construct, id: string, props: DatabaseStackProps);
}
