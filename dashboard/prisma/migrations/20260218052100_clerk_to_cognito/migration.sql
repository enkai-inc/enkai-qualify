-- Rename clerkId column to cognitoId for AWS Cognito authentication
ALTER TABLE "User" RENAME COLUMN "clerkId" TO "cognitoId";
