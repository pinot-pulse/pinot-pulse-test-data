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
#
# Note that there are character limits on the names for certain resources.
# We've set these up so that you should not have any problems, however
# be aware that if you change the COMMON_NAME to something longer, your NLB
# stack will often fail at the TargetGroup creation because of the 32 character
# limit.
COMMON_NAME=essatapple
ESS_STACK_NAME="$COMMON_NAME-ess-$S3_COMPLIANT_NAME"
VPCE_STACK_NAME="$COMMON_NAME-vpce-$S3_COMPLIANT_NAME"

# Define default values
ESS_DOMAIN_NAME=elasticsearchatapple
STORAGE_SIZE=10
VPC_ENDPOINT=false
Port=443
