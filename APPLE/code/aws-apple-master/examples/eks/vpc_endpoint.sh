#!/bin/bash

CLUSTER_NAME=$1
NAMESPACE=$2
SVC=$3

# Find LoadBalancers
echo "Searching for LoadBalancer"
lbs=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[].LoadBalancerArn' --output=text)
if [[ -z $lbs ]]; then
    echo "ERROR: No LoadBalancers Found."
    exit 1
fi

# Find LoadBalancers matching tag
# kubernetes.io/service-name: $NAMESPACE/$SVC
# kubernetes.io/cluster/$CLUSTER_NAME: owned
for lb in $lbs; do
    lb_arn=$(aws elbv2 describe-tags --resource=$lb --query \
        "TagDescriptions[?
            (Tags[?(Key==\`kubernetes.io/service-name\` && Value==\`$NAMESPACE/$SVC\`)]) &&
            (Tags[?(Key==\`kubernetes.io/cluster/$CLUSTER_NAME\` && Value==\`owned\`)])
        ].ResourceArn" --output text)
    if [[ ! -z $lb_arn ]]; then
        break
    fi
done
if [[ -z $lb_arn ]]; then
    echo "ERROR: No LoadBalancer for $NAMESPACE/$SVC Found."
    exit 1
fi

# Tag LoadBalancer with Privatelinks
echo "Tagging $lb_arn"
aws elbv2 add-tags --resource-arns=$lb_arn --tags=Key=Privatelinks,Value="to be exposed via privatelinks"

# Wait for lb to be ready
echo "Waiting for $lb_arn to be active"
aws elbv2 wait load-balancer-available --load-balancer-arns $lb_arn

# Create a VpcEndpoint Stack
echo "Creating VPC Endpoint for $lb_arn"
aws cloudformation deploy \
    --template-file EKSVpcEndpoint.yaml \
    --stack-name ${CLUSTER_NAME}-svc-${NAMESPACE}-${SVC}-VpcEndpoint-Stack \
    --parameter-overrides LoadBalancer=${lb_arn} \
    --capabilities CAPABILITY_IAM

echo "Privatelink Endpoint is accesible at:"
aws cloudformation --output=text list-exports --query "Exports[?Name==\`$CLUSTER_NAME-svc-$NAMESPACE-$SVC-VpcEndpoint-Stack-VPCE-DNSName\`].Value"
