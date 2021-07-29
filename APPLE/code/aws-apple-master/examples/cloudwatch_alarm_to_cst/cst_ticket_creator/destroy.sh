#!/bin/bash

function delete_stack() {
    aws cloudformation delete-stack --stack-name $1
    aws cloudformation wait stack-delete-complete --stack-name $1
}

set -eux

# Delete individuals CF stacks
delete_stack 'cst-ticket-creator-stack'
delete_stack 'lambda-prereq-stack'
