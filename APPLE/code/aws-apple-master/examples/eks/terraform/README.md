# Instruction to create a sample EKS cluster with Terraform

1. Create and edit `terraform.tfvars` file

    ```bash
    cp terraform.tfvars.example terraform.tfvars
    ```

    Most variables have default values but the bare minimum are
    - `eks_cluster_name`
    - `aws_profile`

2. Run `provision.sh` script to bootstrap cluster.

    ```bash
    ./provision.sh
    ```

    The script will deploy EKS cluster into your account and configure `kubectl` to access it.

# Removing the stack
Run `destroy.sh` script to remove the cluster.
```bash
./destroy.sh
```

# Pre-requisites

This example requires Terraform v0.12 to run.  To install the latest version of Terraform:
```shell
$ brew install terraform
```
To upgrade your installed version to the latest version:
```shell
$ brew upgrade terraform
```
