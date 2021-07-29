# User configurable variables
SNS_EMAIL=""

# DO NOT EDIT BELOW THIS LINE
S3_COMPLIANT_USERNAME=$(echo "${USER//_/-}" | awk '{print tolower($0)}')
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
S3_COMPLIANT_NAME="${ACCOUNT_ID:0:4}-$S3_COMPLIANT_USERNAME"
length=${#S3_COMPLIANT_NAME}
if (( $length > 15 ))
then
   S3_COMPLIANT_NAME="${S3_COMPLIANT_NAME:0:15}"
fi

NAME="apigw"
APIGW_NAME="$NAME-rest-api"
FLASK_LAMBDA_FUNCTION_NAME="$NAME-function-$S3_COMPLIANT_USERNAME"

REGION_CFG=$(aws configure get region||true)
REGION=${AWS_DEFAULT_REGION:-$REGION_CFG}

ARTIFACT_BUCKET="$NAME-artifacts-$REGION-$S3_COMPLIANT_USERNAME"
FLASK_ARTIFACT_ZIP_NAME="$NAME.zip"

PREREQ_STACK_NAME="$NAME-prereqs-$S3_COMPLIANT_USERNAME"
APIGW_STACK_NAME="$NAME-stack-$S3_COMPLIANT_USERNAME"

SOURCE_VPCE=$(aws ec2 describe-vpc-endpoints | jq -r '.VpcEndpoints[] | select(.ServiceName | contains("execute-api")) | .VpcEndpointId' | head -n 1)
API_ID_EXPORT_NAME="$APIGW_STACK_NAME-Api-ID"
API_ID=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`$API_ID_EXPORT_NAME\`].Value")
RESOURCE_EXPORT_NAME="$APIGW_STACK_NAME-Resource-ID"
RESOURCE_ID=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`$RESOURCE_EXPORT_NAME\`].Value")
