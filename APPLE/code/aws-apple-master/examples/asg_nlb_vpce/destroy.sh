#!/bin/bash
source vars.sh
set -ex

python3 ../utilities/delete_stack.py $VPCE_STACK_NAME $ASG_STACK_NAME $NLB_STACK_NAME
