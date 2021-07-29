#!/bin/bash

source vars.sh

CF_EXPORTS=$(aws cloudformation list-exports --query 'Exports[]')
RDS_VPC_ENDPOINT=$(jq --arg DNS_NAME "$VPCE_STACK_NAME-VPCE-DNSName" -r '.[] | select(.Name==$DNS_NAME).Value' <<< $CF_EXPORTS)
RDSHOSTNAME=$(jq --arg RDS_NAME "$RDS_STACK_NAME-rds-endpoint" -r '.[] | select(.Name==$RDS_NAME).Value' <<< $CF_EXPORTS)
RDS_INSTANCE_ID=$(jq --arg RDS_NAME "$RDS_STACK_NAME-rds-instance-id" -r '.[] | select(.Name==$RDS_NAME).Value' <<< $CF_EXPORTS)
PORT=$(jq --arg RDS_PORT_NAME "$RDS_STACK_NAME-rds-port" -r '.[] | select(.Name==$RDS_PORT_NAME).Value' <<< $CF_EXPORTS)
DBENGINE=$(aws rds describe-db-instances --db-instance-identifier $RDS_INSTANCE_ID --query "DBInstances[].Engine" --output text)
USERNAME='rdsatappleadmin'
REGION='us-west-2'
DBNAME='RDSAtApple'

# FIXME: Actually use IAM Authentication with an appropriate policy
# See: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.IAMDBAuth.html
# Get Auth Token from AWS
# TOKEN=$(aws rds generate-db-auth-token \
#    --hostname $HOSTNAME \
#    --port $PORT \
#    --region $REGION \
#    --username $USERNAME)
#
# For now use the password from the secrets manager
SQL_PASSWORD=$(aws secretsmanager get-secret-value --secret-id "$RDS_STACK_NAME-rds-secrets" --query SecretString --output text | jq -r '.password')

# Pull down RDS CA Bundle
curl -s https://s3.amazonaws.com/rds-downloads/rds-combined-ca-bundle.pem > rds-combined-ca-bundle.pem

# Connect!
if [ "$DBENGINE" == "mysql" ]; then
  mysql --host=$RDS_VPC_ENDPOINT --port=$PORT --ssl-ca=rds-combined-ca-bundle.pem --enable-cleartext-plugin --user=$USERNAME --password=$SQL_PASSWORD
fi
if [ "$DBENGINE" == "postgres" ]; then
  PGPASSWORD=$SQL_PASSWORD psql "host=$RDS_VPC_ENDPOINT port=$PORT sslmode=prefer sslrootcert=rds-combined-ca-bundle.pem user=$USERNAME dbname=$DBNAME"
fi
