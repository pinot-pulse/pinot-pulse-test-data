#!/bin/bash

set -e

source vars.sh
source vars.defaults
source lib/eks.sh

# Verify the required tools are installed
eks_verify_tools_installed

# Create IAM
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file EKSIam.yaml \
  --stack-name $IAM_STACK \
  --capabilities CAPABILITY_IAM

# Create Cluster
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file EKSCluster.yaml \
  --stack-name $CLUSTER_STACK \
  --parameter-overrides \
    EKSClusterName=$CLUSTER_NAME \
    KubernetesVersion=$KUBERNETES_VERSION \
    DenaliEnabled=$EKS_DENALI_ENABLED

aws eks update-cluster-config --name=$CLUSTER_NAME --resources-vpc-config endpointPrivateAccess=true && sleep 20 || true
aws eks wait cluster-active --name=$CLUSTER_NAME
aws eks update-cluster-config --name=$CLUSTER_NAME \
  --logging '{"clusterLogging":[{"types":["api","audit","authenticator","controllerManager","scheduler"],"enabled":true}]}' && sleep 20 || true
aws eks wait cluster-active --name=$CLUSTER_NAME

# Create worker node group
aws cloudformation deploy \
  --no-fail-on-empty-changeset \
  --template-file EKSWorkerNode.yaml \
  --stack-name $WORKERNODE_STACK \
  --parameter-overrides \
    EKSClusterName=$CLUSTER_NAME \
    IsDenaliEnabled=$EKS_DENALI_ENABLED \
    IsManagedNodeGroup=$EKS_MANAGED_NODE_GROUP \
    NodeGroupName=$WORKER_NODE_GROUP_NAME \
    NodeImageId=$WORKER_NODE_AMI \
    NodeInstanceType=$WORKER_INSTANCE_TYPE \
    NodeAutoScalingGroupMinSize=$MIN_NUM_NODES \
    NodeAutoScalingGroupMaxSize=$MAX_NUM_NODES \
    NodeAutoScalingGroupDesiredCapacity=$NUM_NODES

# Gather information about the deployed stack
export NODE_INSTANCE_ROLE_ARN=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${CLUSTER_NAME}-iam-stack-NodeInstanceRoleARN\`].Value")
export VPC_CIDR=$(aws ec2 describe-vpcs --filter Name=tag:Name,Values=ais-provided-vpc --query 'Vpcs[*].CidrBlockAssociationSet[*].{CidrBlockAssociationSet:CidrBlock}' --output text | tr '\n' ',' | sed 's/,$//')
export EKS_ENCRYPTION_KEY=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${CLUSTER_NAME}-cluster-stack-EKSEncryptionKey\`].Value")

# Update kubeconfig
eks_configure_kubeconfig

# Update aws-auth settings
eks_configure_auth

# Update proxy settings
eks_configure_proxy

# Encrypt PV by default
eks_encrypt_storage_class

# # wait for worker nodes to be ready and running
# ./lib/validate_cluster.sh

# Enable cluster-autoscaler
pushd apps/cluster-autoscaler
./deploy.sh -c $CLUSTER_NAME -v $KUBERNETES_VERSION
popd
