#!/bin/bash
set -ex

# Init terraform modules
terraform init

# Apply terraform template
terraform apply -auto-approve
