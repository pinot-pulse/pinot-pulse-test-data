# Amazon ElastiCache Service

[Amazon ElastiCache](https://docs.aws.amazon.com/elasticache/index.html) is a web service that makes it easy to deploy and run Memcached or Redis protocol-compliant server nodes in the cloud. Amazon ElastiCache improves the performance of web applications by allowing you to retrieve information from a fast, managed, in-memory system, instead of relying entirely on slower disk-based databases.

This folder contains a self-contained example to deploy an ElastiCache Replication Group consisting of 2 cache nodes (Redis by default).

## Prerequisites

Before running this stack, you should setup your [CLI environment](../../setup/). Besides that, there will be nothing else expected in your local environment.

## Deploying the Stack

To deploy the stack, simply run: `./provision.sh`.

You may also run `./provision.sh` for more the usage details.

## Updating the Stack

If you need to update the CloudFormation template, simply make the change, and then run: `./provision.sh`. This will trigger an update of the stack and its resources.

## Deleting the Stack

To delete the stack, simply run: `./destroy.sh`.

## Validating Cluster Status

After resource creation has completed, you can run `aws elasticache describe-cache-clusters` to display details about the cluster, including its current status.

## Connecting to the Cluster

Run the following commands to list the cluster's primary endpoint and port. Other services within your account will be able to access the cluster with these values.

```shell
$ ./print_exports.sh
Primary Endpoint: master.elr1nd775hv212tr.pjorio.usw2.cache.amazonaws.com
Port:             6379
Secret:           arn:aws:secretsmanager:us-west-2:404268134887:secret:elasticache-rg-4042-jane-smith-cache-auth-token-ha07gG
```

__NOTE__: The secret from secrets manager is printed. In order to obtain the actual auth_token run the following:

```shell
aws secretsmanager get-secret-value --secret-id <SECRET> --query SecretString --output text | jq -r '.authToken'
```
