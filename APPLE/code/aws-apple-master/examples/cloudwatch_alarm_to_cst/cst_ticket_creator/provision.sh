#!/bin/bash
set -e
source vars.sh

# Declare some variables
REGION_CFG=$(aws configure get region||true)
REGION=${AWS_DEFAULT_REGION:-$REGION_CFG}
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)

echo "ENV is: ${ENV}"

# Save the current working directory
DIR="$(pwd)"
echo "Downloading certificates"
curl "https://certificatemanager.apple.com/certs/apple_corporate_root_ca.pem" >> ./function/apple_corporate_root_ca.pem
curl "https://certificatemanager.apple.com/certs/apple_corporate_root_ca_2.pem" >> ./function/apple_corporate_root_ca_2.pem 

LAMBDA_FUNCTION_NAME="cst-ticket-creator"
ARTIFACT_BUCKET="lambda-artifacts-$REGION-$ACCOUNT_ID"
LAMBDA_ARTIFACT_ZIP_NAME="$LAMBDA_FUNCTION_NAME.zip"
LAMBDA_STACK_NAME="$LAMBDA_FUNCTION_NAME-stack"

### Launch the prerequisite stack
aws cloudformation deploy \
  --template-file ././../lambda_prereq/prereq.yml \
  --stack-name 'lambda-prereq-stack' \
  --no-fail-on-empty-changeset \
  --parameter-overrides BucketName=$ARTIFACT_BUCKET

# Create a zip for the lambda example
cd $DIR/function
zip -q -r9 ${DIR}/$LAMBDA_ARTIFACT_ZIP_NAME .

## Copy artifacts into S3 buckets
cd $DIR
aws s3 cp $LAMBDA_ARTIFACT_ZIP_NAME s3://$ARTIFACT_BUCKET/

## Deploy the Lambda Stack
aws cloudformation deploy \
  --template-file ./template/lambda.yml \
  --stack-name $LAMBDA_STACK_NAME \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides DeploymentS3Bucket=$ARTIFACT_BUCKET DeploymentS3Key=$LAMBDA_ARTIFACT_ZIP_NAME LambdaFunctionName=$LAMBDA_FUNCTION_NAME ENV=$ENV \
  AppId=$APP_ID CallerId=$CALLER_ID AssignedGroupId=$ASSIGNED_GROUP_ID AppPass=$APP_PASS AssignedPersonId=$ASSIGNED_PERSON_ID Configuration=$CONFIGURATION


# Re-upload Lambda Code
aws lambda update-function-code \
  --function-name $LAMBDA_FUNCTION_NAME \
  --s3-bucket $ARTIFACT_BUCKET \
  --s3-key $LAMBDA_ARTIFACT_ZIP_NAME