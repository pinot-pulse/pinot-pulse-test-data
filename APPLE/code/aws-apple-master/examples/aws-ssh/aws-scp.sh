#!/bin/bash

# Load the common ssh setup
COMMAND_NAME="scp"
source aws-ssh-common.sh

# And, now scp!
scp -i $EC2_SSH_KEY $COMMAND_OPTIONS
