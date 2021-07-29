# Deploying an Elasticache Stack with Terraform

## Create terraform.tfvars and update

```shell
cp terraform.tfvars.example terraform.tfvars
```

## Deploying the stack

```shell
terraform init
terraform apply -auto-approve
```

When the deployment has completed, the cache port and primary endpoint are displayed. These are used by other services to access the cluster.

## Deleting the stack

```shell
terraform destroy -auto-approve
```
