#!/bin/bash

set -e

usage () {
  echo "Usage: $0 <os-user> <instance-id> [$COMMAND_NAME Parameters]"
  exit 1
}

# Check the parameters
if [[ $# < 2 ]]; then
  echo "ERROR: invalid command line arguments"
  usage
fi

# Set better names for the parameters
EC2_USER=$1
shift
EC2_ID=$1
shift
COMMAND_OPTIONS=$@

# Check if the ssm ssh proxy command is set

if ! grep -q "# SSH over Session Manager" ~/.ssh/config; then
  echo "ERROR: Please Set your local SSH config to include the ProxyCommand."
  echo "       See: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-enable-ssh-connections.html"
  usage
fi

# Validate that the instance is up...
EC2_DESCRIBE=$(aws ec2 describe-instances --instance-ids $EC2_ID --output json)
EC2_STATE=$(jq -r '.Reservations[].Instances[].State.Name' <<< $EC2_DESCRIBE)
EC2_AZ=$(jq -r '.Reservations[].Instances[].Placement.AvailabilityZone' <<< $EC2_DESCRIBE)

if [[ $EC2_STATE != "running" ]]; then
  echo "ERROR: The instance is not running."
  echo $EC2_DESCRIBE
  usage
fi

# Define a local function to check the version
function version { echo "$@" | awk -F. '{ printf("%d%03d%03d%03d\n", $1,$2,$3,$4); }'; }

# Make sure the SSM CLI Plugin is intalled and updated to the latest
SSM_CLI_VERSION=$(session-manager-plugin --version)
if [[ $(version $SSM_CLI_VERSION) -lt $(version "1.1.23.0") ]]; then
  echo "ERROR: The SSM CLI Plugin needs to be upgraded to at least 1.1.23.0."
  echo "       See: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html#install-plugin-macos"
  usage
fi

# Make sure the SSM vesrion on the instance is updated to the latest
function get_ssm_version {
  aws ssm describe-instance-information --instance-information-filter-list key=InstanceIds,valueSet=[$EC2_ID] --query InstanceInformationList[].AgentVersion --output text
}

SSM_VERSION=$(get_ssm_version)
if [[ $(version $SSM_VERSION) -lt $(version "2.3.672.0") ]]; then
  echo "The SSM Agent needs to be upgraded to at least 2.3.672.0."
  echo "Attempting upgrade now..."
  SSM_UPDATE_ID=$(aws ssm send-command --document-name "AWS-UpdateSSMAgent" --document-version "1" --instance-ids $EC2_ID --parameters '{"version":[""],"allowDowngrade":["false"]}' --timeout-seconds 600 --max-concurrency "50" --max-errors "0" --region us-west-2 --query "Command.CommandId" --output text)
  for attempt in $(seq 5); do
      sleep 5
      CHECK_UPDATE=$(aws ssm get-command-invocation --command-id $SSM_UPDATE_ID --instance-id $EC2_ID --query Status --output text)
      if [[ $CHECK_UPDATE == "Success" ]]; then
        break
      fi
  done

  SSM_VERSION=$(get_ssm_version)
  if [[ $(version $SSM_VERSION) -lt $(version "2.3.672.0") ]]; then
    echo "ERROR: SSM Agent update failed, please reach out to the AWS@Apple team."
    usage
  else
    echo "SSM Agent Update complete!"
  fi
fi

# FIXME: When AWS Support Case ID 6239651751 is resolved, we should update this
#        to use $(memento show -ssh) instead of ssh-keygen.
#
# Make sure you have a ssh key to use
TMP_KEY_DIR=$(mktemp -d)
EC2_SSH_KEY=$TMP_KEY_DIR/$USER-ec2-tmp-connect-key
function cleanup {
  rm -rf $TMP_KEY_DIR
}
trap cleanup EXIT INT
ssh-keygen -t rsa -f $EC2_SSH_KEY -q -N ""

# Make the EC2-Instance-Connect call
SEND_KEY=$(aws ec2-instance-connect send-ssh-public-key --instance-id $EC2_ID --instance-os-user $EC2_USER --availability-zone $EC2_AZ --ssh-public-key file://$EC2_SSH_KEY.pub)
SEND_KEY_SUCCESS=$(jq -r '.Success' <<< $SEND_KEY)
SEND_KEY_REQUEST=$(jq -r '.RequestId' <<< $SEND_KEY)

if [[ $SEND_KEY_SUCCESS != "true" ]]; then
  echo "Request Id: $SEND_KEY_REQUEST has failed."
  usage
fi
