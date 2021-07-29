# Start with an identifier that adheres to S3 naming restrictions
S3_COMPLIANT_USERNAME=$(echo "${USER//_/-}" | awk '{print tolower($0)}')
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
S3_COMPLIANT_NAME="${ACCOUNT_ID:0:4}-$S3_COMPLIANT_USERNAME"
length=${#S3_COMPLIANT_NAME}
if (( $length > 15 ))
then
   # "Username longer than 15 chars, truncating"
   S3_COMPLIANT_NAME="${S3_COMPLIANT_NAME:0:15}"
fi

# Define global names
COMMON_NAME=elasticache
RG_STACK_NAME="$COMMON_NAME-rg-$S3_COMPLIANT_NAME"

# Define default values
CLUSTER_ENGINE=redis
PORT=6379
ENGINE_VERSION=5.0.6
NUM_CACHE_CLUSTERS=2
CACHE_NODE_TYPE=cache.m3.medium
