#!/bin/bash

set -eux

# Load our shared variables
source vars.sh

# Create a zip
zip -r $ARTIFACT_ZIP_NAME *.yaml asg/ nlb/ rds/ playbooks/ app/ endpoint/

# Copy artifact into S3 buckets
aws s3 cp $ARTIFACT_ZIP_NAME s3://$ARTIFACT_BUCKET/

# Run Commands!
ASG_NAME=$(aws cloudformation list-exports | jq -r ".Exports[] | select(.Name==\"$ASG_STACK_NAME-ASGName\").Value")
ASG_INSTANCES=$(aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names $ASG_NAME --query "AutoScalingGroups[].Instances[].InstanceId" --output text |  tr '\t' ,)
COMMAND=$(aws ssm send-command \
  --document-name "AWS-RunShellScript" \
  --document-version "\$DEFAULT" \
  --targets "Key=instanceids,Values=$ASG_INSTANCES" \
  --parameters '{"workingDirectory":[""],"executionTimeout":["3600"],"commands":["curl -s http://169.254.169.254/latest/user-data | tail -n 8 | sudo bash -eux"]}' \
  --timeout-seconds 600 \
  --max-concurrency "50" \
  --max-errors "0" \
  --region us-west-2)
COMMAND_ID=$(echo $COMMAND | jq -r '.Command.CommandId')
sleep 15
for instance_id in $(echo $ASG_INSTANCES | sed "s/,/ /g"); do
    aws ssm get-command-invocation --command-id "$COMMAND_ID" --instance-id "$instance_id" --query 'StandardOutputContent' --output text
done
