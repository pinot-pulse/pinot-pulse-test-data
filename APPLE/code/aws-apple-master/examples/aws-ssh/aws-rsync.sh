#!/bin/bash

# Load the common ssh setup
COMMAND_NAME="rsync"
source aws-ssh-common.sh

# And, now rsync!
rsync -e "ssh -i $EC2_SSH_KEY" $COMMAND_OPTIONS
