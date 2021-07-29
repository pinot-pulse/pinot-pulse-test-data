#!/bin/bash

set -ux

# Load our shared variables
source ./scripts/vars.sh

# Empty the S3 buckets
python ../utilities/delete_bucket.py $ARTIFACT_BUCKET
python ../utilities/delete_bucket.py $CONTENT_BUCKET

# Delete the log groups
aws logs delete-log-group --log-group-name /aws/lambda/$FLASK_LAMBDA_FUNCTION_NAME
aws logs delete-log-group --log-group-name /aws/lambda/$SYNCER_LAMBDA_FUNCTION_NAME

# Delete individuals CF stacks
python ../utilities/delete_stack.py $SYNCER_STACK_NAME $FLASK_STACK_NAME $DYNAMODB_STACK_NAME $PREREQ_STACK_NAME

# Delete the artifact
rm -rf $FLASK_ARTIFACT_ZIP_NAME $SYNCER_LAMBDA_FUNCTION_NAME ./app/example/v-env ./app/alb_nlb_sync/v-env
