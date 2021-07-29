#!/bin/bash

source vars.sh

function usage() {
    echo "Usage: $0 [options]"
    echo " -d, --db-name                    Database Name (default: RDSAtApple)"
    echo " -e, --db-engine <mysql|postgres> Database Engine (default: mysql)"
    echo " -v, --vpc-endpoint <true|false>  Create a vpc endpoint for the database (default: false)"
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
    --db-name|-d )
      DB_NAME="$2"
      ;;
    --db-engine|-e )
      DB_ENGINE="$2"
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

# Deploy Aurora Serverless
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file aurora.yaml \
  --stack-name=$RDS_STACK_NAME \
  --parameter-overrides \
    DBEngine=$DB_ENGINE \
    DBName=$DB_NAME

# Deploy VPC Endpoint
if [[ $VPC_ENDPOINT == "true" ]]; then
  SG=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${RDS_STACK_NAME}-SG\`].Value")
  Port=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${RDS_STACK_NAME}-Port\`].Value")
  RDS_ENI_IPs=$(aws ec2 describe-network-interfaces --query "NetworkInterfaces[?Groups[?GroupId == \`$SG\`]].PrivateIpAddress" | jq -r @csv | tr -d \")
  aws cloudformation deploy \
    --no-fail-on-empty-changeset \
    --template-file ../vpce.yaml \
    --stack-name $VPCE_STACK_NAME \
    --parameter-overrides \
      RDSEndpointIps=$RDS_ENI_IPs \
      Port=$Port
fi
