#!/bin/bash

source vars.sh

function usage() {
    echo "Usage: $0 [options]"
    echo " -d, --domain-name                Domain Name (default: ElasticSearchDomainAtApple)"
    echo " -s, --storage-size               The amount in GB of storage on the ElasticSearch data node (default: 10)"
    echo " -v, --vpc-endpoint <true|false>  Create a vpc endpoint for the database (default: false)"
}

function die() {
  usage
  echo "$0: error: $1" 1>&2
  exit 1
}

function createIAMRole () {
  echo
  echo "-----------------------------------"
  echo "Creating the IAM Service Role for the ElasticSearchService..."
  aws iam create-service-linked-role --aws-service-name es.amazonaws.com
  if [ $? -eq 0 ]
  then
    echo "Successfully created role"
  else
    echo "Could not create role, however it might exist already."
  fi
  echo "-----------------------------------"
  echo
}


while [ $# -gt 0 ]; do
  case "$1" in
    --help|-h )
      usage
      exit 0
      ;;
    --domain-name|-d )
      ESS_DOMAIN_NAME="$2"
      ;;
    --storage-size|-s )
      STORAGE_SIZE="$2"
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

#create service linked role
createIAMRole

set -e

# Launch the ElasticSearchService stack
echo "NOTE: ElasticSearch is going to take FOREVER (ok, maybe 15 minutes) to spin up..."
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file ess.yaml \
  --stack-name $ESS_STACK_NAME \
  --parameter-overrides \
        ElasticsearchDomainName=$ESS_DOMAIN_NAME \
        EBSVolumeSize=$STORAGE_SIZE \
 


# Advanced access policy cloud formation template
#AdminARN=$(aws iam get-role --role-name admin --query "Role.Arn" | tr -d \")
#echo "Admin Role ARN $AdminARN"
#DeveloperARN=$(aws iam get-role --role-name developer_role --query "Role.Arn" | tr -d \")
#echo "Developer Role ARN $DeveloperARN"
#aws cloudformation deploy \
#  --no-fail-on-empty-changeset \
#  --template-file ess.yaml \
#  --stack-name $ESS_STACK_NAME \
#  --parameter-overrides \
#        ElasticsearchDomainName=$ESS_DOMAIN_NAME \
#        EBSVolumeSize=$STORAGE_SIZE \
#        AdminRoleARN=$AdminARN \
#        DeveloperRoleARN=$DeveloperARN \
#  --tags AIS-REQ-1=ISDB-Service-ID=${ISDB_ID}:Env=1
        
# Deploy VPC Endpoint
if [[ $VPC_ENDPOINT == "true" ]]; then
  ESS_EP=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${ESS_STACK_NAME}-ElasticsearchEndpoint\`].Value")
  ESS_ENI_IPs=$(dig +short $ESS_EP)
  echo "$ESS_ENI_IPs"
  SG=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${ESS_STACK_NAME}-SG\`].Value")
  ESS_ENI_IPs=$(aws --output text ec2 describe-network-interfaces --query "NetworkInterfaces[?Groups[?GroupId == \`$SG\`]].[Status,PrivateIpAddress]" | grep -i "in-use" | cut -f2 -d$'\t' | head -1 )
  echo "$ESS_ENI_IPs"
  aws cloudformation deploy \
   --no-fail-on-empty-changeset \
    --template-file vpce.yaml \
    --stack-name $VPCE_STACK_NAME \
    --parameter-overrides \
      ESSEndpointIps=$ESS_ENI_IPs \
      Port=$Port \
    
fi