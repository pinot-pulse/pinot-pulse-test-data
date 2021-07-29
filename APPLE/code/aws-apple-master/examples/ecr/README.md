Elastic Container Registry (ECR) is a fully-managed Docker container registry that makes it easy for developers to store, manage, and deploy Docker container images.

ECR Repository policies can be used to control access to repositories and the images within them:

  [Amazon ECR Managed Policies](https://docs.aws.amazon.com/AmazonECR/latest/userguide/ecr_managed_policies.html)

  [Amazon ECR Repository Policy Examples](https://docs.aws.amazon.com/AmazonECR/latest/userguide/RepositoryPolicyExamples.html)

**You will need to specify the ARN for a PowerUser and ReadOnly role in order to use this example.**

Container images are transferred using HTTPS and encrypted at rest using S3 server side encryption.

# Instruction to create a sample ECR Repository

1- Create the ECR Repository using the sample [ECR template](ecr.yaml).

```bash
aws cloudformation deploy --template-file ecr.yaml --stack-name TestECR \
--parameter-overrides RepositoryName=myecr \
PowerUserRoleARN=arn:aws:iam::xxxx:role/<power-user-role-name> \
ReadOnlyRoleARN=arn:aws:iam::xxxx:role/<read-only-user-role-name> \
--tags Component=myecr Name=ECR \
--capabilities CAPABILITY_IAM --profile dev


Waiting for changeset to be created..
Waiting for stack create/update to complete
Successfully created/updated stack - testecr
```

2- Please note the repositoryUri by running following command:

```bash
aws ecr describe-repositories --repository-names myecr
```

# Push the image to repository
[Docker Basics for Amazon ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-basics.html)


1- Retrieve the login command to use to authenticate your Docker client to your registry. Use the [AWS CLI](https://docs.aws.amazon.com/AmazonECR/latest/userguide/Registries.html#registry_auth):

```bash
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin aws_account_id.dkr.ecr.us-west-2.amazonaws.com
```

2- Build your Docker image using the following command. You can skip this step if your image is already built: 

```bash
docker build -t myecr .
```

3-  After the build completes, Tag the docker image with the repositoryURI value from the previous step:

```bash
docker tag myecr:latest xxxx.dkr.ecr.us-west-2.amazonaws.com/myecr:latest
```

4- Run the following command to push this image to your newly created AWS repository: 
```bash
docker push xxxx.dkr.ecr.us-west-2.amazonaws.com/myecr:latest
```

# Additional Resources

* [Getting Started Guide](https://docs.aws.amazon.com/AmazonECR/latest/userguide/ECR_GetStarted.html)
* [ECR CLI Guide](https://docs.aws.amazon.com/AmazonECR/latest/userguide/ECR_AWSCLI.html)
* [Automating Instance Updates](https://aws.apple.com/guides-and-resources/guides/ec2/automating-instance-updates/)
