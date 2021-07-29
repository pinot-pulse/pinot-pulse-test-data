#!/bin/bash

source vars.sh

function usage() {
    echo "Usage: $0 [options]"
    echo " -v, --vpc-endpoint <true|false>  Create a vpc endpoint for the database (default: false)"
    echo " --desired-num-worker-nodes       Number of worker nodes to start (default: 1)"
    echo " --min-num-worker-nodes           Minimum number of worker nodes (default: 1)"
    echo " --max-num-worker-nodes           Max number of worker nodes (default: 3)"
    echo " --worker-instance-type           AWS instance type (default: t3.small)"
}

function die() {
  usage
  echo "$0: error: $1" 1>&2
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h )
      usage
      exit 0
      ;;
    --desired-num-worker-nodes )
      NUM_NODES="$2"
      ;;
    --min-num-worker-nodes )
      MIN_NUM_NODES="$2"
      ;;
    --max-num-worker-nodes )
      MAX_NUM_NODES="$2"
      ;;
    --worker-instance-type )
      WORKER_INSTANCE_TYPE="$2"
      ;;
    --vpc-endpoint|-v )
      VPC_ENDPOINT="$2"
      ;;
    *)
      echo "Invalid option: $1" 1>&2
      usage
      exit 1
  esac
  shift
  shift
done


set -ex

# Launch the nlb stack
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file nlb.yaml \
  --stack-name $NLB_STACK_NAME \

# Launch the asg stack
TargetGroupArn=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${NLB_STACK_NAME}-TG\`].Value")
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file asg.yaml \
  --stack-name $ASG_STACK_NAME \
  --parameter-overrides \
    TargetGroupArn=$TargetGroupArn \
    InstanceType=$WORKER_INSTANCE_TYPE \
    AutoScalingGroupMinSize=$MIN_NUM_NODES \
    AutoScalingGroupMaxSize=$MAX_NUM_NODES \
    AutoScalingGroupDesiredCapacity=$NUM_NODES \
  --capabilities=CAPABILITY_IAM \

# Create a vpc endpoint for loadbalancer
if [[ $VPC_ENDPOINT == "true" ]]; then
  LoadBalancer=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${NLB_STACK_NAME}-LB\`].Value")
  aws cloudformation deploy \
    --no-fail-on-empty-changeset \
    --template-file vpce.yaml \
    --stack-name $VPCE_STACK_NAME \
    --parameter-overrides \
      LoadBalancer=$LoadBalancer
fi
