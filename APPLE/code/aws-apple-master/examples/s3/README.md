# Amazon Simple Storage Service

[Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/dev/Welcome.html) is an object storage service with a simple web services interface that you can use to store and retrieve any amount of data.

In this page we discuss how to use S3 in AWS@Apple with examples and explain the current limitations of the service.

## Security Measurements

Information Security has provided the following rules in order to ensure a secure usage of S3:

1. S3 buckets must not allow anonymous reads/writes.
1. All S3 objects must be encrypted at rest.
1. All S3 requests must be encrypted in-transit using SSL/TLS.
1. S3 bucket must have versioning enabled.
1. Recommended S3 access must be lock down to IP CIDR specific.

## Provisioning

### Provisioning the bucket

To provision an S3 Bucket run the `provision.sh` script.
You can also set additional env variables that alter the behavior:
Additonal Parameters:
-   (Optional) KEY_ARN: If you want to encrypt objects using your KMS key instead of default S3 master key. You can also set CREATE_KMS if you want to create the KMS key
-   (Optional) WHITELIST_PRINCIPALS: A comma separated list of arns or principals to be whitelisted.  
-   (Optional) CROSS_REGION_REPLICATION: Whether to enable cross region replication 
-   (Optional) CRR_BUCKET=The cross region replication target bucket
-   (Optional) CRR_KMS_KEY_ARN=The Cross region replication target KMS Key
-   (Optional) CREATE_KMS=Create the KMS key if you want. 
-   (Optional) CREATE_EC2=Create an EC2 instance if you want. 

```bash
export BUCKET_NAME=MyBucket
./provision.sh 
```


## Network access to S3

Information Security has created a VPC that is completely locked down without internet access. AWS S3 is a public service and its API can only be accessed over the internet. So, instead of creating internet access through proxy/NAT to S3, EC2 instances running in private subnets of a VPC can have controlled access to S3 buckets, objects, and API functions that are in the same region as the VPC through [VPC endpoints](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-endpoints.html). You can use an S3 bucket policy to indicate which VPCs and VPC endpoints have access to your S3 buckets.

VPC endpoints are managed services that are easy to configure, highly reliable, and provide a secure connection to S3 that does not require a gateway or NAT instances.

Information Security had previously created the S3 VPC endpoint and attached it to your VPC. By default, this VPC endpoint policy does not allow communication to any S3 bucket. So when you have created a new S3 bucket, you want to update the policy to be able to communicate to the new bucket. This is accomplished by adding a `Custom::VpcEndpointUpdater` resource in your cloud formation templates as follows:

```yaml
  UpdateS3VPCEndpoint:
  Type: Custom::VpcEndpointUpdater
  Properties:
    ServiceToken: !ImportValue VpcEndpointUpdaterARN
    VpcEndpointId: !ImportValue ais-provided-vpc-VPCS3Endpoint
    Principal: "*"
    Action: "s3:*"
    Effect: "Allow"
    Resource:
      - "arn:aws:s3:::MyBucket"
      - "arn:aws:s3:::MyBucket/*"
```

Alternatively you could use the `VpcEndpointUpdater.yaml` template as follows:

```bash
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file VpcEndpointUpdater.yaml \
  --stack-name ${BUCKET_NAME}-VPCE-Updater \
  --parameter-overrides \
      BucketName=$BUCKET_NAME
```

## Cross Account Access

In order to make an S3 Bucket from the Account Owner (Account A) accesible from a different AWS@Apple account (Account B) you need to follow this steps:

1. Create an S3 Bucket in Account A.
1. Create an IAM Role in Account B.
1. Give the IAM role in Account B _at a minimum_ permission to download (`s3:GetObject`) and upload (`s3:PutObject`) objects to and from a specific S3 bucket by attaching the following IAM policy.

    ```yaml
        Version: "2012-10-17"
        Statement:
          - Sid: AllowRWAccessToMyBucket
            Effect: Allow
            Action:
              - s3:GetObject
              - s3:PutObject
              - s3:ListBucket
            Resource:
              - "arn:aws:s3:::MyBucket"
              - "arn:aws:s3:::MyBucket/*"
    ```

1. Give the IAM role in Account B permission to use the KMS Key by attaching the following IAM policy.

    ```yaml
        Version: "2012-10-17"
        Statement:
          - Sid: AllowBucketKeyAccess
            Effect: Allow
            Action:
              - kms:Encrypt
              - kms:Decrypt
              - kms:ReEncrypt*
              - kms:GenerateDataKey*
              - kms:DescribeKey
            Resource:
              - arn:aws:kms:<AWS_REGION>:<AWS_ACCOUNT_A_ID>:key/<KMS_KEY_ID>
    ```

1. Give the KMS Key Policy in Account A an statement to grant IAM Role from Account B usage of the key.

    ```yaml
          - Sid: Allow access from IAM Role in Account B
            Effect: Allow
            Principal:
              AWS: arn:aws:iam::<AWS_ACCOUNT_B_ID>:role/<IAM_ROLE>
              Service: s3.amazonaws.com
            Action:
              - kms:Encrypt
              - kms:Decrypt
              - kms:ReEncrypt*
              - kms:GenerateDataKey*
              - kms:DescribeKey
            Resource: "*"
    ```

1. Give the S3 Bucket Policy in Account A an statement to grant the IAM role from Account B access to the bucket.

    ```yaml
          - Sid: Allow R/W access from IAM Role in Account B
            Effect: Allow
            Action:
              - s3:GetObject
              - s3:PutObject
              - s3:ListBucket
            Principal:
              AWS:
                - "arn:aws:iam::<AWS_ACCOUNT_B_ID>:role/<IAM_ROLE>"
            Resource:
              - "arn:aws:s3:::MyBucket"
              - "arn:aws:s3:::MyBucket/*"
    ```

1. Update the S3 VPC Endpoint policy in Account B to allow access to the s3 bucket by creating a `Custom::VpcEndpointUpdater` resource.

```bash
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file VpcEndpointUpdater.yaml \
  --stack-name ${BUCKET_NAME}-VPCE-Updater \
  --parameter-overrides \
      BucketName=$BUCKET_NAME
```

## Cross Region Replication

Cross region replication within same account can be enabled by passing additional parameters to provision script -

```bash
./provision.sh --name <Source_Bucket_Name> --crr true --crr-bucket <Destination_Bucket_Name> --crr-kms-key-arn <KMS_Key_ARN_For_Destination_Bucket>
```

## Limitations

There are some limitations with the S3 Service when AIS Security rules are applied for example:

- S3 buckets can not be used for Static Website Hosting because that would need anonymous reads.

## Resources

- https://aws.apple.com/guides-and-resources/guides/storage/creating-an-s3-bucket/
- https://github.pie.apple.com/CloudTech/AWS-Arch-Labs/blob/master/Lab2/Lab2-1-Solution.yaml
