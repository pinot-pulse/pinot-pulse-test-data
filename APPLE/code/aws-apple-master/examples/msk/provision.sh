#!/bin/bash
set -e

# Read configuration
source vars.sh

# Enable tracing
set -x

# Deploy an MSK Cluster
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file msk.yaml \
  --stack-name $CLUSTER_STACK_NAME \
  --parameter-overrides \
    ClusterName=$CLUSTER_NAME \
    InstanceTypE=$INSTANCE_TYPE \
    VolumeSize=$VOLUME_SIZE \
    EnhancedMonitoring=$ENHANCED_MONITORING \
    KafkaVersion=$KAFKA_VERSION \
    NumberOfBrokerNodes=$BROKER_NODES

# Obtain MSK Cluster Values
KAFKA_CLUSTER_ARN=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${CLUSTER_STACK_NAME}-Cluster\`].Value")
TOPIC_CREATOR_SG=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${CLUSTER_STACK_NAME}-TC-SG\`].Value")
PRODUCER_CONSUMER_SG=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${CLUSTER_STACK_NAME}-PC-SG\`].Value")

# Deploy a "topic creator"
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file tc.yaml \
  --stack-name $TC_STACK_NAME \
  --parameter-overrides \
     KafkaClusterArn=$KAFKA_CLUSTER_ARN \
     KafkaSecurityGroup=$TOPIC_CREATOR_SG \
  --capabilities=CAPABILITY_IAM

# Deploy a "producer/consumer"
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file client.yaml \
  --stack-name $CLIENT_STACK_NAME \
  --parameter-overrides \
     KafkaClusterArn=$KAFKA_CLUSTER_ARN \
     KafkaSecurityGroup=$PRODUCER_CONSUMER_SG \
   --capabilities=CAPABILITY_IAM

# Obtain instance ids
TC_INSTANCE_ID=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${TC_STACK_NAME}-InstanceID\`].Value")
CLIENT_INSTANCE_ID=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${CLIENT_STACK_NAME}-InstanceID\`].Value")


# Disable tracing
{ set +x; } 2>/dev/null

echo ""
echo "Kafka Cluster ARN:          $KAFKA_CLUSTER_ARN"
echo "Topic Creator Instance:     $TC_INSTANCE_ID"
echo "Producer/Consumer Instance: $CLIENT_INSTANCE_ID"
