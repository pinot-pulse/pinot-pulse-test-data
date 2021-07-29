#!/bin/bash

set -u

echo "Starting deletion..."

source ./scripts/vars.sh

echo "Emptying $ARTIFACT_BUCKET..."
python ../utilities/delete_bucket.py $ARTIFACT_BUCKET

echo "Deleting log groups..."
aws logs delete-log-group --log-group-name /aws/lambda/$FLASK_LAMBDA_FUNCTION_NAME
aws logs delete-log-group --log-group-name /aws/apigateway/$APIGW_NAME

echo "Deleting stacks: $APIGW_STACK_NAME, $PREREQ_STACK_NAME..."
python ../utilities/delete_stack.py $APIGW_STACK_NAME $PREREQ_STACK_NAME

echo "Cleaning up..."
rm -rf $FLASK_ARTIFACT_ZIP_NAME ./app/example/v-env ./app/alb_nlb_sync/v-env

echo "Delete complete."
