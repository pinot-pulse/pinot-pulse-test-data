#!/bin/bash

set -eux

# Load our shared variables
source vars.sh

# Empty the S3 buckets
python ../utilities/delete_bucket.py $ARTIFACT_BUCKET $CODEPIPELINE_BUCKET_NAME

# Delete individuals CF stacks
python ../utilities/delete_stack.py $VPCE_STACK_NAME $ASG_STACK_NAME $NLB_STACK_NAME $PREREQ_STACK_NAME $PIPELINE_STACK_NAME

# Delete the artifact
rm -f $ARTIFACT_ZIP_NAME
