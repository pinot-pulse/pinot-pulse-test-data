#!/bin/bash -xe

# In us-east-1, our nodes come up with a domain of "us-east-1.compute.internal",
# but EKS thinks their domain is "ec2.internal" and uses that for nodenames.
# We have to make the system hostname match the kube nodename or kube-proxy
# won't be able to correctly identify the node it's running on.
if [[ ${aws_region} == us-east-1 ]]; then
    hostnamectl set-hostname $(hostname | sed 's/\..*/.ec2.internal/')
fi

# Configure proxies
/opt/tools/bin/configure_proxy.sh
set -a && source /etc/environment

# See https://github.pie.apple.com/ais-cloud/aws-apple/issues/110#issuecomment-3463352
echo "net.ipv4.ip_forward = 1" > /etc/sysctl.d/99-eks.conf
sysctl --system

# Fix log permissions
cat << EOF > /etc/fix_log_permissions.sh
setfacl -R -m u:td-agent:rX /var/lib/docker/containers
EOF
chmod a+x /etc/fix_log_permissions.sh
crontab -l | { cat; echo "* * * * * /etc/fix_log_permissions.sh"; } | crontab -

# Bootstrap the cluster
/etc/eks/bootstrap.sh ${cluster_name}
