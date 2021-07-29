# Deploying an EC2 Instance with Terraform

1. Create and edit `terraform.tfvars` file

    ```bash
    cp terraform.tfvars.example terraform.tfvars
    ```

    Most variables have default values but the bare minimum are
    - `aws_profile`
    - `ec2_name`

2. Run `provision.sh` script to bootstrap cluster.

    ```bash
    ./provision.sh
    ```

    The script will deploy an EC2 instance.

## Removing the stack

Run `destroy.sh` script to remove the cluster.

```bash
./destroy.sh
```
