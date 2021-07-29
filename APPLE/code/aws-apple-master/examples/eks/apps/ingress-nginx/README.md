# ingress-nginx

This directory deploys an [ingress-nginx](https://github.com/kubernetes/ingress-nginx) controller behind an internal loadbalancer.

To expose the ingress controller to apple network you can run

```bash
make eks-privatelink NAMESPACE=ingress-nginx SVC=ingress-nginx
```

## Deploy

```bash
kubectl apply -k overlays/dev
```
