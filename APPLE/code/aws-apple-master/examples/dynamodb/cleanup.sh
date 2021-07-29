#!/bin/bash

function delete_stack() {
    aws cloudformation delete-stack --stack-name $1
    aws cloudformation wait stack-delete-complete --stack-name $1
}

source vars.sh
set -eux

# Delete individuals CF stacks
delete_stack $EC2_STACK_NAME
delete_stack $DYNAMODB_STACK_NAME
