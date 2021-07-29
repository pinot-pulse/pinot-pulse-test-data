#!/bin/bash

set -eux

source vars.sh

# Launch the prerequisite stack
aws cloudformation deploy \
  --template-file prereqs.yaml \
  --stack-name $PREREQ_STACK_NAME \
  --no-fail-on-empty-changeset \
  --parameter-overrides BucketName=$ARTIFACT_BUCKET

# Create a zip
zip -r $ARTIFACT_ZIP_NAME *.yaml playbooks/ app/

# Copy artifact into S3 buckets
aws s3 cp $ARTIFACT_ZIP_NAME s3://$ARTIFACT_BUCKET/

# Launch the Actual Stack
aws cloudformation deploy \
  --template-file two_instances_nlb.yaml \
  --stack-name $STACK_NAME \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
      S3ArtifactBucket=$ARTIFACT_BUCKET \
      S3ArtifactKey=$ARTIFACT_ZIP_NAME \
  --capabilities CAPABILITY_IAM
