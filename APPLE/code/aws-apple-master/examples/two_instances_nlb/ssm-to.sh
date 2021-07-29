#!/bin/bash

set -eux

# Load our shared variables
source vars.sh

usage() {
  echo "Usage: $0 instance_type"
  echo "       The valid instance types are Test or App."
  exit 1
}

if (( $# != 1 )); then
  usage
else
  instance_type=$1
  if [ "$instance_type" == "Test" ] || [ "$instance_type" == "App" ]; then
    INSTANCE_ID_EXPORT_NAME="$STACK_NAME-$instance_type-Instance-ID"
    INSTANCE_ID=$(aws cloudformation list-exports | jq --arg export $INSTANCE_ID_EXPORT_NAME -r '.Exports[] | select(.Name==$export).Value')
    aws ssm start-session --target $INSTANCE_ID
  else
    usage
  fi
fi
