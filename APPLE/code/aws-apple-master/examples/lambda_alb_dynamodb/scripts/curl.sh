#!/usr/bin/env bash

source ./scripts/vars.sh

VPCE_DNS_EXPORT_NAME="$FLASK_STACK_NAME-VPCE-DNSName"
VPCE_DNS=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`$VPCE_DNS_EXPORT_NAME\`].Value")

set -x
curl -i $VPCE_DNS/$1
