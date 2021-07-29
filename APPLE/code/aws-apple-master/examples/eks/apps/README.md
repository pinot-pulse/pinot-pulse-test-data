# Apps

This directory contains exmaples of common apps that are useful to have in a Kubernetes cluster.

The structure is composed by a `base` directory which contains templates rendered by `helm template` or templates gathered from another source and an `overlays` directory which contains a directory for each environment. In these examples there is only `overlays/dev`.

## Deployment

Deployment is usually done with [kustomize](https://kustomize.io)
```
kubectl apply -k overlays/dev
```

## Why kustomize

Helm charts templates can be customized by passing a `values.yaml` file as parameter to helm but many times there are other resources that are needed but are not included in the helm chart.

Instead of forking the chart we can override or add missing resources with `kustomize` which will merge templates from `overlays` with templates from `base` making it easy to update the `base` directory from upstream.
