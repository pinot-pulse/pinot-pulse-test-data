#!/bin/bash

set -eux

source vars.sh

# Launch the Instance Stack
aws cloudformation deploy \
  --template-file sagemaker.yaml \
  --stack-name $SAGEMAKER_STACK_NAME \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_NAMED_IAM
