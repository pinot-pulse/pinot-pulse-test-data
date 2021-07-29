# Amazon Elastic Container Service

[Amazon ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html) is a highly scalable, high-performance container orchestration service that supports Docker containers and allows you to easily run and scale containerized applications on AWS.

ECS support two Launch Types:

* [EC2](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ECS_GetStarted_EC2.html) runs containers in customer managed EC2 Instances. This launchtype provides more flexibility and control to the user who is also responsible for provisioning an instance or cluster of instances.
* [FARGATE](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ECS_GetStarted_Fargate.html) runs containers in amazon managed instances. With this launchtype the customer no longer needs to worry about provisioning, configuration or scaling cluster of instances where containers needs to run.

## Differences between ECS and EKS

|                         | ECS                      | FARGATE          | EKS                       |
|:------------------------|:-------------------------|:-----------------|:--------------------------|
| Pricing                 | Per Running EC2 Instance | Per Running Task | Per Running EC2 Instance  |
| Backplane               | Free                     | Free             | $0.10 per hour            |
| Spot Instances          | Yes                      | No               | Yes                       |
| Persistent Storage      | Yes                      | No               | Yes                       |
| Portability             | AWS Only                 | AWS Only         | Multicloud and Bare Metal |
| Networking              | ENI Per Task             | ENI Per Task     | Multiple Pods per ENI     |
| Containers per Instance | 14 (120 with trunking)   | N/A              | 750                       |
| Proxy Support           | Yes                      | No               | Yes                       |

## Limitations

ECS Fargate instances are not managed by Apple so please be aware of the following limitations when leveraging it in an AWS@Apple account:

* A lack of proxy support prevents Fargate from pulling images from public registries such as quay.io, hub.docker.com or gcr.io.
* An inability to trust Apple Root CA certificates in the AMIs that are used prevents ECS from pulling images from docker.apple.com

Due to these reasons, the only currently supported registry is [ECR](../ecr).

__NOTE__: Rio does not currently support building and publishing images to ECR (pending rdar://52050228).

## Further reading

* [Number of IP Addreses Per ENI](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-eni.html#AvailableIpPerENI)
* [ENI Trunking](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/container-instance-eni.html)

## Provisioning an example

### Prerequisites

_NOTE_: The following prerequisites needs to be done only once per account.

* Make sure that your account has been opted-in for the new [ECS ARN format](https://docs.aws.amazon.com/AmazonECS/latest/userguide/ecs-account-settings.html). Accounts created after April 1, 2019 are opted-in by default.

    ```bash
    aws ecs put-account-setting-default --name serviceLongArnFormat --value enabled
    aws ecs put-account-setting-default --name containerInstanceLongArnFormat --value enabled
    aws ecs put-account-setting-default --name taskLongArnFormat --value enabled
    ```

* Make sure [AWSServiceRoleForECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using-service-linked-roles.html#create-service-linked-role) Service-Linked Role exists in your account. This role is automatically created when you launch a cluster from the web console for the first time. Alternatively you can create it from the CLI as follows:

    ```bash
    aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com
    ```

### Provision

To provision a sample cluster with a sample task on ECS run the `provision.sh` script

```bash
$ ./provision.sh
Usage: ./provision.sh [options]
 -c, --cluster-name               ECS cluster name
 -l, --launch-type <EC2|FARGATE>  LaunchType (default: EC2)

The following options only apply with --launch-type=EC2
 --desired-num-worker-nodes       Number of worker nodes to start (default: 1)
 --min-num-worker-nodes           Minimum number of worker nodes (default: 1)
 --max-num-worker-nodes           Max number of worker nodes (default: 3)
 --worker-instance-type           AWS instance type (default: t3.medium)
```

This will deploy an ECS Cluster, An Auto Scaling Group for ECS Container Instances, A Network Load Balancer, A Task Definition, A Service which will launch a container based on the Task Definition and associate its ENI into the LoadBalancer and finally a vpc endpoint to the LoadBalancer.

### Clean Up

To delete the example run `destroy.sh`

```bash
$ ./destroy.sh
+ python3 ../utilities/delete_stack.py ecs-vpce-4042-albertom ecs-app-4042-albertom ecs-lb-4042-albertom ecs-cluster-4042-albertom
Initiating delete_stack for: ecs-vpce-4042-albertom
DELETE_COMPLETE: ecs-vpce-4042-albertom

Initiating delete_stack for: ecs-app-4042-albertom
DELETE_COMPLETE: ecs-app-4042-albertom

Initiating delete_stack for: ecs-lb-4042-albertom
DELETE_COMPLETE: ecs-lb-4042-albertom

Initiating delete_stack for: ecs-cluster-4042-albertom
DELETE_COMPLETE: ecs-cluster-4042-albertom
```

## TODO

* Configure ENI Trunking
* Configure logging with cloudwatch
