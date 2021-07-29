#!/bin/bash

# Load the common ssh setup
COMMAND_NAME="ssh"
source aws-ssh-common.sh

# And, now ssh!
ssh -i $EC2_SSH_KEY $EC2_USER@$EC2_ID $COMMAND_OPTIONS
