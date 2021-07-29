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
COMMON_NAME=ec2vpce
ARTIFACT_BUCKET="$COMMON_NAME-artifacts-$S3_COMPLIANT_NAME"
PREREQ_STACK_NAME="$COMMON_NAME-prereq-$S3_COMPLIANT_NAME"
STACK_NAME="$COMMON_NAME-stack-$S3_COMPLIANT_NAME"
ARTIFACT_ZIP_NAME=$COMMON_NAME.zip
