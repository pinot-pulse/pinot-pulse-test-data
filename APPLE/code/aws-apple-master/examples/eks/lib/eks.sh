#!/bin/bash

function version() {
  echo "$@" | awk -F. '{ printf("%d%03d%03d%03d\n", $1,$2,$3,$4); }';
}

function eks_verify_tools_installed() {
  AWSCLI_VERSION=`aws --version | cut -d" " -f1 | cut -d"/" -f2`
  if [ $(version $AWSCLI_VERSION) -lt $(version "1.16.156") ]; then
      echo "awscli installed version $AWSCLI_VERSION is older than required version 1.16.156"
      echo "Please run AWS@Apple setup again to ugrade."
      echo "Link: https://github.pie.apple.com/CloudTech/aws-apple/tree/master/setup"
      exit 1
  fi

  if ! [ -x "$(command -v kubectl)" ]; then
    echo "kubectl is not installed"
    echo "Please install kubectl and try again."
    echo "Link: https://kubernetes.io/docs/tasks/tools/install-kubectl/"
    exit 1
  fi

  if ! [ -x "$(command -v yq)" ]; then
    echo "yq is not installed"
    echo "Please install yq and try again."
    echo "Link: https://github.com/mikefarah/yq"
    exit 1
  fi

  if ! [ -x "$(command -v envsubst)" ]; then
    echo "envsubst is not installed"
    echo "Please install the gettext package and try again."
    echo "On macOS: brew install gettext"
    exit 1
  fi
}

function eks_configure_kubeconfig() {
  aws eks --region ${AWS_REGION} update-kubeconfig --name ${CLUSTER_NAME}
}

function eks_configure_auth() {
  cat lib/cm-auth.yaml | envsubst | kubectl apply -f -
}

function eks_configure_proxy() {
  cat lib/cm-proxy.yaml | envsubst | kubectl apply -f -
  kubectl patch -n kube-system -p '{ "spec": {"template": { "spec": { "containers": [ { "name": "aws-node", "envFrom": [ { "configMapRef": {"name": "proxy-environment-variables"} } ] } ] } } } }' daemonset aws-node
  kubectl patch -n kube-system -p '{ "spec": {"template": { "spec": { "containers": [ { "name": "kube-proxy", "envFrom": [ { "configMapRef": {"name": "proxy-environment-variables"} } ] } ] } } } }' daemonset kube-proxy
  kubectl patch -n kube-system -p '{ "spec": {"template": { "spec": { "containers": [ { "name": "coredns", "envFrom": [ { "configMapRef": {"name": "proxy-environment-variables"} } ] } ] } } } }' deployment coredns
}

function eks_encrypt_storage_class() {
  is_encrypted=$(kubectl get storageclass gp2 -o jsonpath='{.parameters.encrypted}')
  if [ "$is_encrypted" == "true" ]; then
    kubectl get storageclass gp2 -o json | \
    jq ".parameters.encrypted = \"true\" | \
        .parameters.kmsKeyId=\"${EKS_ENCRYPTION_KEY}\"" | \
    kubectl replace --force -f -
  fi
}

function eks_cleanup_vpces() {
  vpces=$(aws cloudformation list-stacks --output text --query "StackSummaries[?(StackStatus != \`DELETE_COMPLETE\`) && starts_with(StackName, \`$CLUSTER_NAME\`) && ends_with(StackName, \`VpcEndpoint-Stack\`)].StackName")
  for i in $vpces
  do
    aws cloudformation delete-stack --stack-name $i
    aws cloudformation wait stack-delete-complete --stack-name $i
  done
}

function eks_cleanup_stacks() {
  aws cloudformation delete-stack --stack-name ${WORKERNODE_STACK}
  aws cloudformation wait stack-delete-complete --stack-name ${WORKERNODE_STACK}
  aws cloudformation delete-stack --stack-name ${CLUSTER_STACK}
  aws cloudformation wait stack-delete-complete --stack-name ${CLUSTER_STACK}
  aws cloudformation delete-stack --stack-name ${IAM_STACK}
  aws cloudformation wait stack-delete-complete --stack-name ${IAM_STACK}
}

function eks_cleanup_nlbs() {
  # BUFFER_SIZE is used to paginate calls to describe-tags which can take only 20 arns per request
  BUFFER_SIZE=20

  # Query to find resources with tag: kubernetes.io/cluster/$CLUSTER_NAME
  CLUSTER_QUERY="TagDescriptions[?Tags[?Key==\`kubernetes.io/cluster/$CLUSTER_NAME\`]].ResourceArn"

  lbs=$(aws elbv2 describe-load-balancers --output text --query 'LoadBalancers[].LoadBalancerArn')
  arns=$(echo $lbs | xargs -n $BUFFER_SIZE aws elbv2 describe-tags --output text --query $CLUSTER_QUERY --resource-arns)
  echo $arns | xargs -t -n 1 aws elbv2 delete-load-balancer --load-balancer-arn

  tgs=$(aws elbv2 describe-target-groups --output text --query 'TargetGroups[].TargetGroupArn')
  arns=$(echo $tgs | xargs -n $BUFFER_SIZE aws elbv2 describe-tags --output text --query $CLUSTER_QUERY --resource-arns)
  echo $arns | xargs -t -n 1 aws elbv2 delete-target-group --target-group-arn
}

function eks_cleanup_ebs() {
  vols=$(aws ec2 describe-volumes --output text --filters Name=tag:kubernetes.io/cluster/$CLUSTER_NAME,Values=owned --query 'Volumes[].VolumeId')
  echo $vols | xargs -t -n 1 aws ec2 delete-volume --volume-id
}
