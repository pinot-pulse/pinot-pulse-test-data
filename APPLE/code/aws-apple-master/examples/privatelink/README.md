# Private Link

The purpose of this repo is to share a sample cloudformation stack containing the aws objects required to make a connection from Apple to AWS

* See more information about the requirements here [Apple to AWS Private Connection](https://aws.apple.com/guides/networking/apple-to-aws-private-connection/)

## How to run

```text
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file nlb.yaml \
  --stack-name <stack_name> \
  --parameter-overrides \
    FrontendPort=<port> \
    BackendPort=<port>  \
    AppInstanceID=<ec2_instance_id>
```

Notes:

* The FrontendPort represents the Port that is reachable inside your VPC where the Network Load Balancer listens for requests.
* The BackendPort represents the Port your EC2 Instances listen for incoming requests from the Network Load Balancer.
* The AppInstanceID represents the EC2 Instance you'd like to associate with the Network Load Balancer.
* Here are a few examples using PrivateLinks:
  * [ec2_nlb_vpce](../ec2_nlb_vpce)
  * [asg_nlb_vpce](../asg_nlb_vpce)
  * [rds_at_apple](../rds_at_apple)
  * [codepipeline_asg_nlb](../codepipeline_asg_nlb)
* Under the `Custom::VpcEndpointRequestor` there is a section where you can define a range of ports that will be converted into a Security Group:

```yaml
  AISVpcEndpoint:
    Type: Custom::VpcEndpointRequestor
    Properties:
      ServiceToken: !ImportValue ais-vpc-endpoint-requestor-arn
      EndpointServiceID: !Ref EndpointService
      ip_permissions:
        - from_port: !Ref FrontendPort # this will be converted to a Security Group, add a range of ports or a single one
          to_port: !Ref FrontendPort # this will be converted to a Security Group, add a range of ports or a single one
          ip_ranges:
            - cidr_ip: 17.0.0.0/8
              description: AppleDesktop
            - cidr_ip: 10.0.0.0/8
              description: ApplePrivateCIDR
```

If you need a range of ports use this syntax:

```yaml
      ip_permissions:
        - from_port: !Ref FrontendPort # this will be converted to a Security Group, add a range of ports or a single one
          to_port: !Ref FrontendPort # this will be converted to a Security Group, add a range of ports or a single one
          ip_ranges:
            - cidr_ip: 17.0.0.0/8
              description: AppleDesktop
            - cidr_ip: 10.0.0.0/8
              description: ApplePrivateCIDR
```

If you'd like to use different sets of ports use this syntax:

```yaml
      ip_permissions:
        - from_port: 443
          to_port: 443
          ip_ranges:
            - cidr_ip: 17.0.0.0/8
              description: AppleDesktop
            - cidr_ip: 10.0.0.0/8
              description: ApplePrivateCIDR
        - from_port: 5000
          to_port: 5000
          ip_ranges:
            - cidr_ip: 17.0.0.0/8
              description: AppleDesktop
            - cidr_ip: 10.0.0.0/8
              description: ApplePrivateCIDR
```
