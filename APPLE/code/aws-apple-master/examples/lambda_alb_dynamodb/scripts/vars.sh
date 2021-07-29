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
NAME_1="example-lambda"
NAME_2="syncer-lambda"
NAME_3="dynamodb"
FLASK_LAMBDA_FUNCTION_NAME="$NAME_1-function-$S3_COMPLIANT_USERNAME"
SYNCER_LAMBDA_FUNCTION_NAME="$NAME_2-function-$S3_COMPLIANT_USERNAME"

REGION_CFG=$(aws configure get region||true)
REGION=${AWS_DEFAULT_REGION:-$REGION_CFG}

ARTIFACT_BUCKET="$NAME_1-artifacts-$REGION-$S3_COMPLIANT_USERNAME"
CONTENT_BUCKET="$NAME_1-content-$REGION-$S3_COMPLIANT_USERNAME"
FLASK_ARTIFACT_ZIP_NAME="$NAME_1.zip"
SYNCER_ARTIFACT_ZIP_NAME="populate_NLB_TG_with_ALB.zip"

PREREQ_STACK_NAME="$NAME_1-prereqs-$S3_COMPLIANT_USERNAME"
FLASK_STACK_NAME="$NAME_1-stack-$S3_COMPLIANT_USERNAME"
SYNCER_STACK_NAME="$NAME_2-stack-$S3_COMPLIANT_USERNAME"
DYNAMODB_STACK_NAME="$NAME_3-stack-$S3_COMPLIANT_USERNAME"

SNS_EMAIL=""
SECRET_NAME=""