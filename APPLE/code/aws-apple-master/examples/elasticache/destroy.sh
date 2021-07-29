#!/bin/bash
source vars.sh
set -ex

python3 ../utilities/delete_stack.py $RG_STACK_NAME
