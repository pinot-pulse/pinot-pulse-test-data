# Cluster Autoscaler

The [Kubernetes Cluster Autoscaler](https://github.com/kubernetes/autoscaler/tree/master/cluster-autoscaler) automatically adjusts the number of nodes in your cluster when pods fail to launch due to lack of resources or when nodes in the cluster are underutilized and their pods can be rescheduled onto other nodes in the cluster.

This example is based on the [Amazon EKS Cluster Autoscaler](https://docs.aws.amazon.com/eks/latest/userguide/cluster-autoscaler.html) documentation.

## Deployment

To deploy cluster autoscaler in EKS run the deploy script

```bash
./deploy.sh -c $CLUSTER_NAME -v $KUBERNETES_VERSION
```

## Update

This deployment uses [kustomize](https://kustomize.io) to separate the upstream deployment yaml from the `kustomizations` required by AWS and AWS@Apple.

To sync the base yaml with the latest version run the following command:

```bash
curl -o base/cluster-autoscaler-autodiscover.yaml https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml
```
