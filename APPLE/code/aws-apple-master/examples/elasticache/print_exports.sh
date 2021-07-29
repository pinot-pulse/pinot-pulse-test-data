#!/bin/bash
source vars.sh

# Print endpoint and port
PRIMARY_ENDPOINT=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${RG_STACK_NAME}-Cache-PrimaryEndpoint\`].Value")
PORT=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${RG_STACK_NAME}-Cache-Port\`].Value")
SECRET=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${RG_STACK_NAME}-cache-auth-token\`].Value")
echo "Primary Endpoint: ${PRIMARY_ENDPOINT}"
echo "Port:             ${PORT}"
echo "Secret:           ${SECRET}"
