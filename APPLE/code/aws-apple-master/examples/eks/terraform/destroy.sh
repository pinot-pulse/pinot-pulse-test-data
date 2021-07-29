#!/bin/bash

set -e

source lib/eks.sh

set -x

CLUSTER_NAME=$(terraform output eks_cluster_name)
eks_cleanup_vpces
terraform destroy -auto-approve
eks_cleanup_nlbs
eks_cleanup_ebs
