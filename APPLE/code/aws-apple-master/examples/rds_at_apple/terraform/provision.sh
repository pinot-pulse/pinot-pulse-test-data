#!/bin/bash
set -ex

# Init terraform modules
terraform init

# Apply terraform template targeted to the RDS instance
terraform apply -auto-approve -target aws_db_instance.rds_db_instance

# Apply it again to create a PrivateLink VPC endpoint for the RDS instance and provision all the rest
terraform apply -auto-approve
