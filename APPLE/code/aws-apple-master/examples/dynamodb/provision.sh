#!/bin/bash
source vars.sh
set -eux

# Deply dynamodb
aws cloudformation deploy \
    --no-fail-on-empty-changeset \
    --template-file dynamodb.yaml \
    --stack-name $DYNAMODB_STACK_NAME \
    --parameter-overrides \
        MaxReadCapacity=15 \
        MaxWriteCapacity=15 \
        MinReadCapacity=5 \
        MinWriteCapacity=5 \
        PartitionKeyName=Artist \
        PartitionKeyType=S \
        ReadCapacityUnits=5 \
        ReadCapacityUnitsUtilizationTarget=80 \
        SnsEmailSubscription=xyz@apple.com \
        SortKeyName=Song \
        SortKeyType=S \
        TableName=Music \
        WriteCapacityUnits=5 \
        WriteCapacityUnitsUtilizationTarget=80 \
    --tags \
        Component=myDynamoDB \
        Name=DynamoDB \
    --capabilities CAPABILITY_NAMED_IAM

# Deploy ec2 instance to connect to dynamodb
aws cloudformation deploy \
    --no-fail-on-empty-changeset \
    --template-file ec2.yaml \
    --stack-name $EC2_STACK_NAME \
    --tags \
        Component=SampleEC2App \
        Name=SingleEC2Instance \
    --capabilities CAPABILITY_IAM
