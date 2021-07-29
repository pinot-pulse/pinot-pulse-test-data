#!/usr/bin/env python

import sys
import boto3

for stack in sys.argv[1:]:
    print("Initiating delete_stack for: %s" % (stack))
    cloudformation = boto3.client('cloudformation')
    waiter = cloudformation.get_waiter('stack_delete_complete')
    cloudformation.delete_stack(StackName=stack)
    waiter.wait(StackName=stack)
    print("DELETE_COMPLETE: %s\n" % (stack))
