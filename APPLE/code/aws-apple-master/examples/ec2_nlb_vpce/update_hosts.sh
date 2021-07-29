#!/bin/bash

set -eux

# Load our shared variables
source vars.sh

# Create a zip
zip -r $ARTIFACT_ZIP_NAME *.yaml playbooks/ app/

# Copy artifact into S3 buckets
aws s3 cp $ARTIFACT_ZIP_NAME s3://$ARTIFACT_BUCKET/

# Run the Ansible playbook that is used to conifgure the Application instance.
#
# NOTE: In our CFT for the App Instance we configured the UserData to to run
#       an ansible playbook that handles all of the instance configuration
#       and setup. We can issue an SSM Run Command on the instance that triggers
#       the playbook to run:
#
#           curl -s http://169.254.169.254/latest/user-data | tail -n 8 | sudo bash -eux
#
#       That command will pull the last 8 lines of User-Data from the instance
#       metadata service, and run the playook.
APP_ID_EXPORT_NAME="$STACK_NAME-App-Instance-ID"
APP_ID=$(aws cloudformation list-exports | jq --arg export $APP_ID_EXPORT_NAME -r '.Exports[] | select(.Name==$export).Value')
COMMAND=$(aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --document-version "\$DEFAULT" \
  --targets "Key=instanceids,Values=$APP_ID" \
  --parameters '{"workingDirectory":[""],"executionTimeout":["3600"],"commands":["curl -s http://169.254.169.254/latest/user-data | tail -n 8 | sudo bash -eux"]}' \
  --timeout-seconds 600 \
  --max-concurrency "50" \
  --max-errors "0" \
  --region us-west-2)
COMMAND_ID=$(echo $COMMAND | jq -r '.Command.CommandId')
sleep 10
aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$APP_ID" --query 'StandardOutputContent' --output text
