#!/bin/bash
source vars.sh

function usage() {
    echo "Usage: $0 [options]"
    echo " -c, --cluster-name               ECS cluster name"
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

python3 ../utilities/delete_stack.py \
    $VPCE_STACK_NAME \
    $APP_STACK_NAME \
    $NLB_STACK_NAME \
    ecs-cluster-$CLUSTER_NAME

images_to_delete=$(aws ecr list-images --repository-name httpd --query 'imageIds[*]' --output json)
aws ecr batch-delete-image --repository-name $ECR_REPO_NAME --image-ids "$images_to_delete" 2>/dev/null || true
python3 ../utilities/delete_stack.py $ECR_STACK_NAME
