#!/bin/bash

set -eu

echo "Starting deployment..."

source ./scripts/vars.sh

if [ -z "$SNS_EMAIL" ]; then
  echo "Please set SNS_EMAIL in ./scripts/vars.sh"
  exit 1
fi

# Save the current working directory
DIR="$(pwd)"

echo "Deploying prerequisite stack..."
## Deploy the prerequisite stack
aws cloudformation deploy \
  --template-file ./infrastructure/prereqs.yaml \
  --stack-name $PREREQ_STACK_NAME \
  --no-fail-on-empty-changeset \
  --parameter-overrides BucketName=$ARTIFACT_BUCKET

echo "Preparing lambda zip file..."
# Create a zip for the lambda example
cd $DIR/app/example
virtualenv v-env
source v-env/bin/activate
pip install -r requirements.txt --extra-index-url=https://pypi.apple.com/simple
cd $DIR/app/
python -m pytest -c pytest.ini ./tests
deactivate
cd example/v-env/lib/python*/site-packages
zip -q -r9 ${DIR}/$FLASK_ARTIFACT_ZIP_NAME .

# Zip remaining py files
cd $DIR/app/
zip -q ${DIR}/$FLASK_ARTIFACT_ZIP_NAME ./example/*.py ./example/models/*.py ./example/templates/*

echo "Copying lambda zip file to S3..."
## Copy artifacts into S3 buckets
cd $DIR
aws s3 cp $FLASK_ARTIFACT_ZIP_NAME s3://$ARTIFACT_BUCKET/

echo "Deploying API Gateway stack..."
## Deploy the API Gateway Stack
aws cloudformation deploy \
  --template-file ./infrastructure/apigw_lambda_dynamodb.yaml \
  --stack-name $APIGW_STACK_NAME \
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
    SnsEmailSubscription=$SNS_EMAIL \
    FlaskLambdaFunctionName=$FLASK_LAMBDA_FUNCTION_NAME \
    FlaskLambdaS3Bucket=$ARTIFACT_BUCKET \
    FlaskLambdaS3Key=$FLASK_ARTIFACT_ZIP_NAME \
    ApiGatewayName=$APIGW_NAME \
    SourceVpce=$SOURCE_VPCE

echo "Uploading Lambda function..."
# Re-upload Flask Lambda
aws lambda update-function-code \
  --function-name $FLASK_LAMBDA_FUNCTION_NAME \
  --s3-bucket $ARTIFACT_BUCKET \
  --s3-key $FLASK_ARTIFACT_ZIP_NAME

echo "Cleaning up..."
rm -rf ./*.zip*

echo "Deployment complete."
