# Set Stack Names
source vars.sh
set -ex

if [[ $CREATE_KMS = "true" ]]; then
  echo "Creating KMS"
  aws cloudformation deploy \
    --no-fail-on-empty-changeset \
    --template-file kms.yaml \
    --stack-name $KMS_STACK_NAME
  KEY_ARN=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${KMS_STACK_NAME}-KeyArn\`].Value")
fi

# S3 Bucket
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file s3.yaml \
  --stack-name $S3_STACK_NAME \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    BucketName=$BUCKET_NAME \
    KeyId=$KEY_ARN \
    WhitelistPrincipals=$WHITELIST_PRINCIPALS \
    EnableCrr=$CROSS_REGION_REPLICATION \
    CrrBucketName=$CRR_BUCKET \
    CrrKeyId=$CRR_KMS_KEY_ARN


if [[ $CREATE_EC2 = "true" ]]; then
  echo "Creating EC2"
  aws cloudformation deploy \
    --no-fail-on-empty-changeset \
    --template-file ec2.yaml \
    --stack-name $EC2_STACK_NAME \
    --parameter-overrides \
      BucketName=$BUCKET_NAME
fi