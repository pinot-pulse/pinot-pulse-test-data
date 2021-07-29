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
zip -r $ARTIFACT_ZIP_NAME *.yaml asg/ nlb/ rds/ playbooks/ app/ endpoint/

# Copy artifact into S3 buckets
aws s3 cp $ARTIFACT_ZIP_NAME s3://$ARTIFACT_BUCKET/

# Launch the CodePipelineAccess
aws cloudformation deploy \
  --template-file pipeline.yaml \
  --stack-name $PIPELINE_STACK_NAME \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
      S3Bucket=$ARTIFACT_BUCKET \
      SourceS3Key=$ARTIFACT_ZIP_NAME \
      CodePipelineS3Bucket=$CODEPIPELINE_BUCKET_NAME \
      PipelineName=$PIPELINE_STACK_NAME \
      ASGStackName=$ASG_STACK_NAME \
      NLBStackName=$NLB_STACK_NAME \
      EndpointStackName=$VPCE_STACK_NAME \
  --capabilities CAPABILITY_IAM
