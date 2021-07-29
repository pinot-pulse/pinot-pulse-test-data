#!/bin/bash

set -eux

# Load our shared variables
source vars.sh

# Empty the S3 buckets
python ../utilities/delete_bucket.py $ARTIFACT_BUCKET

# Delete individuals CF stacks
python ../utilities/delete_stack.py $STACK_NAME $PREREQ_STACK_NAME

# Delete the artifact
rm -f $ARTIFACT_ZIP_NAME
