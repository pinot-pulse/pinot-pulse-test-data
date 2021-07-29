#!/bin/bash

source vars.sh

function usage() {
    echo "Usage: $0 [options]"
    echo " -c, --cluster-name               ECS cluster name"
    echo " -l, --launch-type <EC2|FARGATE>  LaunchType (default: EC2)"
    echo ""
    echo "The following options only apply with --launch-type=EC2"
    echo " --desired-num-worker-nodes       Number of worker nodes to start (default: 1)"
    echo " --min-num-worker-nodes           Minimum number of worker nodes (default: 1)"
    echo " --max-num-worker-nodes           Max number of worker nodes (default: 3)"
    echo " --worker-instance-type           AWS instance type (default: t3.medium)"
}

function die() {
  usage
  echo "$0: error: $1" 1>&2
  exit 1
}

function validate_arguments() {
  if [[ -z $CLUSTER_NAME ]]; then
    die "the following arguments are required: --cluster-name"
  fi
  if [[ $LAUNCH_TYPE != "EC2" && $LAUNCH_TYPE != "FARGATE" ]]; then
    die "the following arguments are required: --launch-type <EC2|FARGATE>"
  fi
  if [[ $LAUNCH_TYPE == "EC2" ]]; then
    if [[ $NUM_NODES -lt 1 || $MIN_NUM_NODES -lt 1 || $MAX_NUM_NODES -lt 1 ]]; then
      die "There should be at least one worker node when --launch-type is EC2"
    fi
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h )
      usage
      exit 0
      ;;
    --cluster-name|-c )
      CLUSTER_NAME="$2"
      ;;
    --launch-type|-l )
      LAUNCH_TYPE="$2"
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
    *)
      echo "Invalid option: $1" 1>&2
      usage
      exit 1
  esac
  shift
  shift
done

validate_arguments
set -ex

# Create an ECS cluster
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file cluster.yaml \
  --stack-name ecs-cluster-$CLUSTER_NAME \
  --parameter-overrides \
    ClusterName=$CLUSTER_NAME \
    LaunchType=$LAUNCH_TYPE \
  --capabilities=CAPABILITY_IAM

if [ $LAUNCH_TYPE == "FARGATE" ]; then
  # Create an ECR Repository
  aws cloudformation deploy \
    --no-fail-on-empty-changeset \
    --template-file ecr.yaml \
    --stack-name $ECR_STACK_NAME \
    --parameter-overrides \
      RepositoryName=$ECR_REPO_NAME

  # Upload httpd image to ECR
  REPO=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${ECR_STACK_NAME}-URI\`].Value")
  ECR_IMAGE="${REPO}:latest"
  docker pull $CONTAINER_IMAGE
  docker tag $CONTAINER_IMAGE $ECR_IMAGE
  aws ecr get-login-password | docker login --username AWS --password-stdin $REPO
  docker push $ECR_IMAGE

  # Overwrite CONTAINER_IMAGE with ECR IMAGE for use by task.yaml
  CONTAINER_IMAGE=$ECR_IMAGE
fi

# Create a LoadBalancer for the app
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file nlb.yaml \
  --stack-name $NLB_STACK_NAME

# Create a task and service for the app
TargetGroupArn=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${NLB_STACK_NAME}-TG\`].Value")
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file task.yaml \
  --stack-name $APP_STACK_NAME \
  --parameter-overrides \
    ClusterName=$CLUSTER_NAME \
    TargetGroupArn=$TargetGroupArn \
    LaunchType=$LAUNCH_TYPE \
    ContainerImage=$CONTAINER_IMAGE \
  --capabilities=CAPABILITY_IAM

# Create a vpc endpoint for loadbalancer
LoadBalancer=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${NLB_STACK_NAME}-LB\`].Value")
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file vpce.yaml \
  --stack-name $VPCE_STACK_NAME \
  --parameter-overrides \
    LoadBalancer=$LoadBalancer

# Print vpce location
vpce=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${VPCE_STACK_NAME}-DNSName\`].Value")
echo "Privatelink Endpoint is accesible at: http://$vpce:443"
