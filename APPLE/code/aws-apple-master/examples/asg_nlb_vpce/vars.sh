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
COMMON_NAME=helloworld
NLB_STACK_NAME="$COMMON_NAME-lb-$S3_COMPLIANT_NAME"
ASG_STACK_NAME="$COMMON_NAME-asg-$S3_COMPLIANT_NAME"
VPCE_STACK_NAME="$COMMON_NAME-vpce-$S3_COMPLIANT_NAME"

# Define default values
WORKER_INSTANCE_TYPE=t3.small
NUM_NODES=1
MIN_NUM_NODES=1
MAX_NUM_NODES=3
VPC_ENDPOINT=false
