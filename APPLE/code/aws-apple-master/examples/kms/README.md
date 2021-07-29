# EC2 Roles, Bash, and KMS-encrypted secrets

Use case: you have a secret value (such as a password or API key) and you want
to store it securely and make it usable to a bash script running on an EC2
instance.

Summary of Solution: Create a KMS key. Encrypt the secret under that key. Allow
the role of the machine the ability to decrypt the secret. Update the bash
script to use the awscli to decrypt the secret.

>Alternative Solution - AWS SSM Encrypted Parameters or Secret Manager are other good alternative for storing sensitive data. These services, automatically encrypt the stored data,rotate encryption key, keep log of who access the data, and you can limit grants via IAM.

## Create a KMS Key

You have two options for creating the KMS key. You can use the kms.yaml
CloudFormation template in this directory, or you can use the AWS Console.

To use the CloudFormation template:

```bash
aws cloudformation deploy --template-file kms.yaml --stack-name kms-key \
--parameter-overrides KeyAdministratorRoleArn=arn:aws:iam::account-id:role/XXX \
KeyUserRoleArn=arn:aws:iam::account-id:role/XXX \
KeySystemUserRoleArn=arn:aws:iam::account-id:role/XXX \
--tags Component=KMSKey Name=MyKey \
--capabilities CAPABILITY_IAM \
--profile my-profile
```

Once successfully, do the following to retrieve your Key ID:

```bash
export keyid=$(aws cloudformation describe-stack-resource --stack-name kms-key --logical-resource-id MyKey --profile my-profile | jq -r '.StackResourceDetail.PhysicalResourceId')
```

## Encrypt the Secret

The engineer responsible for the bash script should run:

```bash
export ciphertext=$(aws kms encrypt --key-id $keyid \
--encryption-context context=something \
--plaintext SSS \
--output text --query CiphertextBlob)
```

## Create an IAM Role and Instance Profile for the machine that will consume the secret

Now we grant the role that the instance or person will be using to run this
script the ability to decrypt the encrypted value.

If the instance will already has an Instance Profile and Role specific to the
task at hand, get the ARN of that role. If you need to create that now, do so,
and get the ARN.

As user KeyAdministrator or KeyUser role, you can create a grant for the role for services to use:

```bash
aws kms create-grant \
--key-id kmskeyid \
--grantee-principal KeySystemUserRoleArn \
--operations Decrypt \
--constraints EncryptionContextSubset={context=something} \
--name AllowRoleToDecryptPPPGrant
--profile my-profile
```

## Decrypt the Secret

Update your bash script to decrypt the value. Example:

```bash
PLAINTEXT=$(aws kms decrypt \
--ciphertext-blob fileb://<(echo "${ciphertext}" | base64 -D) \
--encryption-context context=something \
--output text \
--query Plaintext \
--profile my-profile | base64 -D \
)
```
