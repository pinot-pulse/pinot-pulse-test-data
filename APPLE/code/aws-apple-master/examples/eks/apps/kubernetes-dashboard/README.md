# Kubernetes Dashboard

## How to deploy?

[AWS documentation](https://docs.aws.amazon.com/eks/latest/userguide/dashboard-tutorial.html) has good documentation to deploy kubernetes dashboard. however, the documentation allows you to deploy dashboard with self-signed certs which unfortunately most of the browsers don't recognize. This example will walk you through how you can deploy kubernetes dashboard inside AWS@Apple EKS cluster and expose it to Apple network.

* Run `bootstrap.sh`
  - This script will download necessary deployment specs for dashboard, heapster, influxdb etc
  - Generate self signed certs
  - Run `kubectl apply -k overlays/dev` to apply these configurations to EKS cluster. Applied overlays make following changes to dashboard deployment
    - Change `kubernetes-dashboard` service type to `LoadBalancer`.
    - Use script generated self-signed certs instead of autogenerating certs
* Create a PrivateLink by following process described [here](../../README.md#exporting-a-kubernetes-service-to-apple-network).
* Request Apple internal DNS to create a subdomain `*.ucp.apple.com` (e.g https://aws-apple.ucp.apple.com/) to resolves to the PrivateLink endpoint. It is recommended to do `nslookup` to get the IP and use that instead for DNS CNAME instead of alias to the provided name. The VPC endpoint DNS is too long and some tools (e.g. curl) does not support that.
* Request "Corporate SSL Server" certificates for your `*.ucp.apple.com` subdomain from [certificate manager](https://certificatemanager.apple.com/#submit).
* Copy `dashboard.key` and `dashboard.crt` files to `certs` directory under `overlays/dev`. Note that, these files should be named `dashboard.key` and `dashboard.crt` for kustomization to work.
* Run kustomization as -
  ```
  $ kubectl apply -k overlays/dev
  ```
* You should be able to access Kubernetes dashboard on DNS entry created above.
* Run `aws eks get-token --cluster-name <EKS_CLUSTER_NAME>` to retrieve token to login to dashboard.

## Questions?

* To ask technical questions, post it on [StackOverflow](https://stackoverflow.apple.com) using the `#aws-apple` tag.
* Reach out to us on [#aws-apple](https://a1345092.slack.com/messages/CJ9JXENBA) Slack channel during business hours.
