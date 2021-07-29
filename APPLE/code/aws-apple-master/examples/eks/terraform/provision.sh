#!/bin/bash

set -e

source lib/eks.sh

# Verify the required tools are installed
eks_verify_tools_installed

# Init terraform modules
terraform init

# Apply terraform template
terraform apply -auto-approve

# Gather information about the deployed stack
export AWS_REGION=`terraform output aws_region`
export CLUSTER_NAME=`terraform output eks_cluster_name`
export EKS_VERSION=`terraform output eks_version`
export NODE_INSTANCE_ROLE_ARN=`terraform output eks_node_instance_role`
export EKS_ENCRYPTION_KEY=`terraform output eks_encryption_key`
export VPC_CIDR=$(aws ec2 describe-vpcs --filter Name=tag:Name,Values=ais-provided-vpc --query 'Vpcs[*].CidrBlockAssociationSet[*].{CidrBlockAssociationSet:CidrBlock}' --output text | tr '\n' ',' | sed 's/,$//')

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
pushd ../apps/cluster-autoscaler
./deploy.sh -c $CLUSTER_NAME -v $EKS_VERSION
popd
