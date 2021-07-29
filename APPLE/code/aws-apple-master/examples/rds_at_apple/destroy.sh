#!/bin/bash
source vars.sh
set -eux

# Delete individuals CF stacks
python ../utilities/delete_stack.py $VPCE_STACK_NAME $RDS_STACK_NAME
