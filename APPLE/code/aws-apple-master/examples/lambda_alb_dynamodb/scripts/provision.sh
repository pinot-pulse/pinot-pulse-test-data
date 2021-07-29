#!/bin/bash

set -eux

source ./scripts/vars.sh

# Save the current working directory
DIR="$(pwd)"

### Launch the prerequisite stack
aws cloudformation deploy \
  --template-file ./infrastructure/prereqs.yaml \
  --stack-name $PREREQ_STACK_NAME \
  --no-fail-on-empty-changeset \
  --parameter-overrides BucketName=$ARTIFACT_BUCKET

# Create a zip for the lambda example
cd $DIR/app/example
virtualenv v-env
source v-env/bin/activate
pip install -r requirements.txt --extra-index-url=https://pypi.apple.com/simple
cd $DIR/app/
python -m pytest -c pytest.ini ./tests
deactivate
cd example/v-env/lib/python3.7/site-packages
zip -q -r9 ${DIR}/$FLASK_ARTIFACT_ZIP_NAME .

# Create a zip for the IP syncer lambda
cd $DIR/app/alb_nlb_sync
virtualenv v-env
source v-env/bin/activate
pip install -r requirements.txt
deactivate
cd v-env/lib/python3.7/site-packages
zip -q -r9 ${DIR}/$SYNCER_ARTIFACT_ZIP_NAME .

# Zip remaining py files
cd $DIR/app/
zip -q ${DIR}/$FLASK_ARTIFACT_ZIP_NAME ./example/*.py ./example/models/*.py ./example/templates/*
zip -q ${DIR}/$SYNCER_ARTIFACT_ZIP_NAME ./alb_nlb_sync/*.py

## Copy artifacts into S3 buckets
cd $DIR
aws s3 cp $FLASK_ARTIFACT_ZIP_NAME s3://$ARTIFACT_BUCKET/
aws s3 cp $SYNCER_ARTIFACT_ZIP_NAME s3://$ARTIFACT_BUCKET/

## Deploy the DynamoDB Stack
aws cloudformation deploy \
  --template-file ./infrastructure/dynamodb.yaml \
  --stack-name $DYNAMODB_STACK_NAME \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    MaxReadCapacity=15 \
    MaxWriteCapacity=15 \
    MinReadCapacity=5 \
    MinWriteCapacity=5 \
    PartitionKeyName=user_id \
    PartitionKeyType=S \
    ReadCapacityUnits=5 \
    ReadCapacityUnitsUtilizationTarget=80 \
    TableName=users \
    WriteCapacityUnits=5 \
    WriteCapacityUnitsUtilizationTarget=80 \
    SnsEmailSubscription=$SNS_EMAIL

## Deploy the Flask Lambda Stack
aws cloudformation deploy \
  --template-file ./infrastructure/example_lambda_alb.yaml \
  --stack-name $FLASK_STACK_NAME \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    DynamoDBStackNameParameter=$DYNAMODB_STACK_NAME \
    FlaskLambdaFunctionName=$FLASK_LAMBDA_FUNCTION_NAME \
    FlaskLambdaS3Bucket=$ARTIFACT_BUCKET \
    FlaskLambdaS3Key=$FLASK_ARTIFACT_ZIP_NAME \
    ContentBucketName=$CONTENT_BUCKET

## Copy static content to S3 bucket
aws s3 cp --recursive ./app/example/static/ s3://$CONTENT_BUCKET

# Re-upload Flask Lambda
aws lambda update-function-code \
  --function-name $FLASK_LAMBDA_FUNCTION_NAME \
  --s3-bucket $ARTIFACT_BUCKET \
  --s3-key $FLASK_ARTIFACT_ZIP_NAME

# Make sure the ALB is always registered as the target of the NLB

# Deploy the Syncer Lambda Stack
aws cloudformation deploy \
  --template-file ./infrastructure/alb_nlb_sync_lambda.yaml \
  --stack-name $SYNCER_STACK_NAME \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    PrereqStackNameParameter=$PREREQ_STACK_NAME \
    FlaskStackNameParameter=$FLASK_STACK_NAME \
    SyncerLambdaFunctionName=$SYNCER_LAMBDA_FUNCTION_NAME \
    SyncerLambdaS3Bucket=$ARTIFACT_BUCKET \
    SyncerLambdaS3Key=$SYNCER_ARTIFACT_ZIP_NAME

# Re-upload Syncer Lambda
aws lambda update-function-code \
  --function-name $SYNCER_LAMBDA_FUNCTION_NAME \
  --s3-bucket $ARTIFACT_BUCKET \
  --s3-key $SYNCER_ARTIFACT_ZIP_NAME

# Invoke Syncer Lambda Function
aws lambda invoke \
  --function-name \
  $SYNCER_LAMBDA_FUNCTION_NAME \
  out \
  --log-type Tail \
  | jq -r '.LogResult' \
  | base64 -d

rm -rf ./*.zip*

# Grab the VPC Endpoint DNS Name
VPCE_DNS_EXPORT_NAME="$FLASK_STACK_NAME-VPCE-DNSName"
VPCE_DNS=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`$VPCE_DNS_EXPORT_NAME\`].Value")
set +x
echo "Try running:"
echo "    curl $VPCE_DNS"
echo
echo "Or by running ./scripts/curl.sh"