#!/bin/bash

set -eux

source vars.sh

# Launch the Instance Stack
aws cloudformation deploy \
  --template-file SingleEC2Instance.yaml \
  --stack-name $EC2_STACK_NAME \
  --no-fail-on-empty-changeset \
  --capabilities CAPABILITY_IAM
