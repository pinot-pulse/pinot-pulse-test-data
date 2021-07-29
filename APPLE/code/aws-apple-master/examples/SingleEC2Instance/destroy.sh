#!/bin/bash

set -eux

# Load our shared variables
source vars.sh

# Delete individuals CF stacks
python ../utilities/delete_stack.py $EC2_STACK_NAME
