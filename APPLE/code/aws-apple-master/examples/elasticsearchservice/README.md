# Amazon Elasticsearch Service

[Amazon Elasticsearch Service](https://aws.amazon.com/elasticsearch-service/) is a fully managed service that makes it easy to deploy, secure, and run Elasticsearch cost effectively at scale

This example will deploy single instance Elasticsearch domain. However the parameters are in place should you choose to deploy cluster with more instances(both master and data nodes)


## Prerequisites

Before running this stack, you should setup your [CLI environment](../../setup/). Besides that, there will be nothing else expected in your local environment.

## Deploying the Stack

To deploy the stack, simply run: `./provision.sh`.

To provision a sample domain run the `./provision.sh -v true` script

```text
Usage: ./provision.sh [options]
 -d, --domain-name                Domain Name (default: elasticsearchatapple)
 -s, --storage-size               The amount in GB of storage on the elastic instance(default: 10)
 -v, --vpc-endpoint               Create a vpc endpoint for the database (default: false)
 ```

## Validating Cluster Status

After resource creation has completed, you can run `aws es describe-elasticsearch-domain --domain-name <domain_name>  --region us-west-2` to display details about the domain. Replace the <domain_name> with the domain name given at the time of provisioning. Default domain name is elasticsearchatapple.

## Connecting to the Cluster

Run the following commands to list the cluster's primary endpoint and port. Other services within your account will be able to access the cluster with these values.
```
$ ess_endpoint=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${VPCE_STACK_NAME}-VPCE-DNSName\`].Value")
$ curl -k https://$ess_endpoint
```

## Deleting the Stack

To delete the stack, simply run: `./destroy.sh`.

