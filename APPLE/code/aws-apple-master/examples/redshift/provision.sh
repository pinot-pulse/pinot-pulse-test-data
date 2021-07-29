#!/bin/bash
source vars.sh

function usage() {
    echo "Usage: $0 [options]"
    echo " -d, --db-name                                Database Name (default: redshiftatapple)"
    echo " -t, --cluster-type <single-node|multi-node>  Cluster Type (default: single-node)"
    echo " -n, --number-of-nodes <2-100>                Number of nodes for multi-node cluster (default: 2)"
    echo " -v, --vpc-endpoint <true|false>              Create a vpc endpoint for the database (default: false)"
}

function die() {
  usage
  echo "$0: error: $1" 1>&2
  exit 1
}

function validate_arguments() {
  if [[ $CLUSTER_TYPE == "multi-node" ]]; then
    if [[ $NO_OF_NODES -lt 2 || $NO_OF_NODES -gt 100 ]]; then
      die "for multi-node clusters --number-of-nodes should be from 2 to 100"
    fi
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h )
      usage
      exit 0
      ;;
    --db-name|-d )
      DB_NAME="$2"
      ;;
    --cluster-type|-t )
      CLUSTER_TYPE="$2"
      ;;
    --number-of-nodes|-n )
      NO_OF_NODES="$2"
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

validate_arguments
set -ex

# Launch the RedShift stack
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file redshift.yaml \
  --stack-name $REDSHIFT_STACK_NAME \
  --parameter-overrides \
    ClusterType=$CLUSTER_TYPE \
    DBName=$DB_NAME \
    NumberOfNodes=$NO_OF_NODES \
  --capabilities CAPABILITY_IAM

# Deploy VPC Endpoint
if [[ $VPC_ENDPOINT == "true" ]]; then
  Cluster=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${REDSHIFT_STACK_NAME}-Cluster\`].Value")
  Port=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${REDSHIFT_STACK_NAME}-Port\`].Value")
  LeaderIp=$(aws redshift --output=text describe-clusters --query "Clusters[?ClusterIdentifier == \`${Cluster}\`].ClusterNodes[]|[?(NodeRole == \`SHARED\` || NodeRole == \`LEADER\`)].PrivateIPAddress")
  aws cloudformation deploy \
    --no-fail-on-empty-changeset \
    --template-file vpce.yaml \
    --stack-name $VPCE_STACK_NAME \
    --parameter-overrides \
      RDSEndpointIps=$LeaderIp \
      Port=$Port
fi
