# AWS EKS Container Insights
## Pre-requisites
* aws@apple EKS cluster
* switch to account using awscli `aws-profile <aws profile name>`
* aws policy named `CloudWatchAgentServerPolicy` to be tagged to EKS worker node role

## About Container Insights

 Container Insights collect, aggregate, and summarize metrics and logs from your containerized applications and microservices.
* Metrics include utilization for resources such as CPU, memory, disk, and network
* Container Insights provides diagnostic information like container restart failures, futher helps to isolate issues and resolve them quickly
* We can set CloudWatch alarms on metrics that Container Insights collects
* Metrics collected by Container Insights can be populated to CloudWatch dashboards
   
  **Note:** Metrics collected by Container Insights are charged as custom metrics
* Operational data is collected as performance log events. These are entries that use a structured JSON schema that enables high-cardinality data to be ingested and stored at scale. From this data, CloudWatch creates aggregated metrics at the cluster, node, pod, task, and service level as CloudWatch metrics
* Container Insights uses a containerized version of the CloudWatch agent to discover all of the running containers in a cluster. It then collects performance data at every layer of the performance stack
* Container Insights supports encryption with the customer master key (CMK) for the logs and metrics that it collects

  **Note:** Do not use asymmetric CMKs to encrypt your container insights log groups
* CloudWatch agent setup script enable StatsD listener protocol in each worker node of your EKS cluster has been enabled to retrive additional custom metrics from applications or services.StatsD is especially useful for instrumenting your own metrics.
Refer [Retrieve Custom Metrics with StatsD](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Agent-custom-metrics-statsd.html)
* CloudWatch Agent creates a log group name /aws/containerinsights/``Cluster_Name``/performance and sends the performance log events to this log group.Considering CloudWatch Agent setup as a StatsD listener, the agent also listens for StatsD metrics on port 8125 with the IP address of the node where the application pod is scheduled.
* FluentD creates the following log groups

    `` /aws/containerinsights/Cluster_Name/application`` collects all log files in /var/log/containers

    ``/aws/containerinsights/Cluster_Name/host`` collects logs from /var/log/dmesg, /var/log/secure, and /var/log/messages

    ``/aws/containerinsights/Cluster_Name/dataplane`` collects logs from /var/log/journal for kubelet.service, kubeproxy.service, and docker.service.

## Setup instructions

  Run `deploy.sh` script to setup container insights.
   ```bash
   ./deploy.sh
   ```
   ```bash
   ***********************************************************************************
   container insights is setting in ``cluster name`` under region ``region``
   namespace/amazon-cloudwatch created
   serviceaccount/cloudwatch-agent created
   serviceaccount/fluentd created
   clusterrole.rbac.authorization.k8s.io/cloudwatch-agent-role created
   clusterrole.rbac.authorization.k8s.io/fluentd-role created
   clusterrolebinding.rbac.authorization.k8s.io/cloudwatch-agent-role-binding created
   clusterrolebinding.rbac.authorization.k8s.io/fluentd-role-binding created
   configmap/cluster-info created
   configmap/cwagentconfig created
   configmap/fluentd-config created
   daemonset.apps/cloudwatch-agent created
   daemonset.apps/fluentd-cloudwatch created
   ```
  ### Container Insights CloudWatch log group
  
 **CloudWatch --> Logs --> Log groups**
 
  ### Container Insights metrics dashboard & logs
   
 Navigate to view metrics
 **CloudWatch --> Container Insights --> Performance Monitoring**
 
 Navigate to view logs for specific resources through CloudWatch logs Insights
 
 **CloudWatch --> Container Insights --> Resources**
 
 Resources helps to view logs, navigate to dashboard for metrics
 
 #### Reference links
 https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html
 
#### Next Steps

* Enabled service role for FluentD service account using OIDC

#### Reference links
1. https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/ContainerInsights.html
2. https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/encrypt-log-data-kms.html
