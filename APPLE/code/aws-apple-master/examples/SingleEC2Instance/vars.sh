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
EC2_STACK_NAME="ec2-$S3_COMPLIANT_NAME"
