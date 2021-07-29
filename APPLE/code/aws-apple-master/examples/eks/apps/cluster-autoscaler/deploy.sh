#!/bin/bash

function usage() {
    echo "Usage: $0 [options]"
    echo " -c, --cluster-name             EKS cluster name"
    echo " -v, --version                  EKS version"
}

# Read parameters
while [ $# -gt 0 ]; do
  case "$1" in
    --cluster-name|-c )
      CLUSTER_NAME="$2"
      ;;
    --k8s-version|-v )
      KUBERNETES_VERSION="$2"
      ;;
    *)
      echo "Invalid option: $1" 1>&2
      usage
      exit 1
  esac
  shift
  shift
done

# Validate parameters
if [[ -z $CLUSTER_NAME || -z $KUBERNETES_VERSION ]]; then
    usage
    exit 1
fi

# Find latest tag for current version
TAG=$(curl -s https://api.github.com/repos/kubernetes/autoscaler/releases | jq -r "map(select(.name | startswith(\"Cluster Autoscaler $KUBERNETES_VERSION\")).name) | first | split(\" \") | last")
yq write --inplace overlays/dev/kustomization.yaml 'images.(name==k8s.gcr.io/autoscaling/cluster-autoscaler).newTag' "v${TAG}"

# Update cluster_name
cat << EOF > overlays/dev/cluster_name.yaml
---
- op: replace
  path: /spec/template/spec/containers/0/command/6
  value: --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/$CLUSTER_NAME
EOF

# Deploy cluster-autoscaler
kubectl apply -k overlays/dev
