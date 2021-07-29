#!/bin/bash

metadata="http://169.254.169.254/latest/meta-data"
mac=$(curl -s $metadata/network/interfaces/macs/ | head -n1 | tr -d '/')
VPCCidr=$(curl -s $metadata/network/interfaces/macs/$mac/vpc-ipv4-cidr-block/)

# Set proxy settings
PROXY=http://proxy.config.pcp.local:3128
whitelists=(
    localhost
    127.0.0.1
    .internal
    169.254.169.254
    10.100.0.0/16
    .apple.com
    .execute-api.us-west-2.amazonaws.com
    .s3.us-west-2.amazonaws.com
    .us-west-2.vpce.amazonaws.com
    amazonlinux.us-west-2.amazonaws.com
    api.sagemaker.us-west-2.amazonaws.com
    cloudformation.us-west-2.amazonaws.com
    cloudtrail.us-west-2.amazonaws.com
    codebuild-fips.us-west-2.amazonaws.com
    codebuild.us-west-2.amazonaws.com
    config.us-west-2.amazonaws.com
    dynamodb.us-west-2.amazonaws.com
    ec2.us-west-2.amazonaws.com
    ec2messages.us-west-2.amazonaws.com
    elasticloadbalancing.us-west-2.amazonaws.com
    events.us-west-2.amazonaws.com
    kinesis.us-west-2.amazonaws.com
    kms.us-west-2.amazonaws.com
    logs.us-west-2.amazonaws.com
    monitoring.us-west-2.amazonaws.com
    runtime.sagemaker.us-west-2.amazonaws.com
    secretsmanager.us-west-2.amazonaws.com
    servicecatalog.us-west-2.amazonaws.com
    sns.us-west-2.amazonaws.com
    ssm.us-west-2.amazonaws.com
    ssmmessages.us-west-2.amazonaws.com
    sts.us-west-2.amazonaws.com
)
NO_PROXY="$${VPCCidr}"
for whitelist in "$${whitelists[@]}"
do
    NO_PROXY="$NO_PROXY,$${whitelist}"
done

# Set the proxy for future processes, and use as an include file
cat << EOF >> /etc/environment
HTTP_PROXY=$PROXY
HTTPS_PROXY=$PROXY
NO_PROXY=$NO_PROXY
http_proxy=$PROXY
https_proxy=$PROXY
no_proxy=$NO_PROXY
EOF

# Configure yum to use the proxy
cat << EOF >> /etc/yum.conf
proxy=$PROXY
EOF

systemctl daemon-reload
