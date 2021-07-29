# Private Link

The purpose of this repo is to share a sample cloudformation stack containing the aws objects required to make a connection from AWS@Apple to AWS@Apple account. The intended use is for:

* Apple Shield
* AWS@Apple Cross Account requests

## How to run

```text
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file vpce-service.yaml \
  --stack-name <stack-name> \
  --parameter-overrides \
    FrontendPort=<port> \
    BackendPort=<port>  \
    AppInstanceID=<ec2_instance_id_> \
    AllowedPrincipal=<aws_apple_account_id>
```

Notes:

* The FrontendPort represents the Port that is reachable inside your VPC where the Network Load Balancer listens for requests.
* The BackendPort represents the Port your EC2 Instances listen for incoming requests from the Network Load Balancer.
* The AppInstanceID represents the EC2 Instance you'd like to associate with the Network Load Balancer.
* AppInstanceID2 and AppInstanceID3 are commented out and can be used when adding multiple instances to the Target Group
