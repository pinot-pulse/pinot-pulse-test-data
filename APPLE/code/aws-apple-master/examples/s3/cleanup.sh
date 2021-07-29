# Set Stack Names
source vars.sh
set -ex

if [[ $CREATE_EC2 = "true" ]]; then
  aws cloudformation delete-stack \
    --stack-name $EC2_STACK_NAME
fi

# S3 Bucket
aws cloudformation delete-stack \
  --stack-name $S3_STACK_NAME

if [[ $CREATE_KMS = "true" ]]; then
  aws cloudformation delete-stack \
    --stack-name $KMS_STACK_NAME
fi
