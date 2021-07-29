#!/bin/bash

set -eux

# Change the working directory this example so that paths work
cd "$(dirname "$0")"

# Load our shared variables
source vars.sh

INSTANCE_ID_EXPORT_NAME="$EC2_STACK_NAME-Instance-ID"
INSTANCE_ID=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`$INSTANCE_ID_EXPORT_NAME\`].Value")
cd ../aws-ssh/
./aws-ssh.sh ec2-user $INSTANCE_ID $@
