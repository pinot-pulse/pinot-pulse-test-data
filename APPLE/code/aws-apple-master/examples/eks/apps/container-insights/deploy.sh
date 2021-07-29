#!/bin/bash

set -e
source ../../vars.sh
# base file has been generated with - wget https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluentd-quickstart.yaml
echo "container insights is setting in $CLUSTER_NAME under region $AWS_REGION"

# Update Cluster and Region in cluster-info and cwagentconfig configmap
sed "s/{{cluster_name}}/$CLUSTER_NAME/;s/{{region_name}}/$AWS_REGION/" base/cwagent-fluentd-quickstart.yaml > overlays/dev/cwagent-fluentd-quickstart.yaml

# Deploy container insights
kubectl apply -k overlays/dev
