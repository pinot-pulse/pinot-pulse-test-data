#!/bin/bash
source vars.sh
set -ex

python3 ../utilities/delete_stack.py $VPCE_STACK_NAME $REDSHIFT_STACK_NAME
