# Auto Scaling Group Example

This example shows how to deploy an [Auto Scaling Group](https://docs.aws.amazon.com/autoscaling/ec2/userguide/AutoScalingGroup.html) which launches instances of a simple web page and put them behind a loadbalancer.

## Prerequisites

Understand how to deploy a [SingleEC2Instance](../SingleEc2Instance)

## Deploying the Stack

To provision a sample ASG run the `provision.sh` script.

```text
Usage: ./provision.sh [options]
 -v, --vpc-endpoint <true|false>  Create a vpc endpoint for the database (default: false)
 --desired-num-worker-nodes       Number of worker nodes to start (default: 1)
 --min-num-worker-nodes           Minimum number of worker nodes (default: 1)
 --max-num-worker-nodes           Max number of worker nodes (default: 3)
 --worker-instance-type           AWS instance type (default: t3.small)
```

## Deleting the Stack

To delete the example stack, run `destroy.sh`

## Next Steps

Follow [codepipeline](../codepipeline_asg_nlb) example for a more complete solution including initialization of instances with ansible playbooks

# Additional Resources
 * [Getting Started Guide](https://docs.aws.amazon.com/autoscaling/ec2/userguide/AutoScalingGroup.html)
 * [Automating Instance Updates](https://aws.apple.com/guides-and-resources/guides/ec2/automating-instance-updates/)