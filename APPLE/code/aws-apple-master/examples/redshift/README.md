# Amazon Redshift

[Amazon Redshift](https://docs.aws.amazon.com/redshift/latest/gsg/getting-started.html) is a fully managed, petabyte-scale data warehouse service in the cloud. An Amazon Redshift data warehouse is a collection of computing resources called nodes, which are organized into a group called a cluster. Each cluster runs an Amazon Redshift engine and contains one or more databases.

## Deploying RedShift

To provision a sample cluster run the `provision.sh` script.

```text
Usage: ./provision.sh [options]
 -d, --db-name                                Database Name (default: redshiftatapple)
 -t, --cluster-type <single-node|multi-node>  Cluster Type (default: single-node)
 -n, --number-of-nodes <2-100>                Number of nodes for multi-node cluster (default: 2)
 -v, --vpc-endpoint <true|false>              Create a vpc endpoint for the database (default: false)
```

## Accessing RDS Instances from Apple Network

Accessing RedShift from Apple Network is similar to the [RDS@Apple](../rds_at_apple/README.md#accessing-rds-instances-from-apple-network) model

To deploy NLB and VPC Endpoint pass the `--vpc-endpoint true` parameter to `provision.sh`

### Limitations

The following limitation applies when accessing RedShift from the Apple Network. Note, they do not affect EC2 instances connecting to the database endpoints:

* After an instance failover the IP addresses of the RedShift node may change and the target group would need to be manually updated with the new ip address.

### Connecting to the DB from Apple Network

1. Export `RDS_STACK_NAME` and `VPCE_STACK_NAME`

    ```bash
    export REDSHIFT_STACK_NAME=redshift-cluster-1171-jane-smith
    export VPCE_STACK_NAME=redshift-vpce-1171-jane-smith
    ```

    Alternatively:

    ```bash
    source vars.sh
    ```

2. Obtain Username and Password

    2a) Obtain SQL password from Secrets Manager

    ```bash
    SQL_USER=redshiftadmin
    SECRET=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${REDSHIFT_STACK_NAME}-Secret\`].Value")
    SQL_PASSWORD=$(aws secretsmanager get-secret-value --secret-id $SECRET --query SecretString --output text | jq -r '.password')
    ```

    2b) Obtain SQL user and password from IAM

    ```bash
    CLUSTER=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${REDSHIFT_STACK_NAME}-Cluster\`].Value")
    read -r SQL_PASSWORD SQL_USER EXPIRATION <<<$(aws redshift get-cluster-credentials --cluster-identifier $CLUSTER --db-user redshiftadmin --db-name redshiftatapple --output=text)
    ```

3. Obtain the VPC Endpoint:

    ```bash
    ENDPOINT=$(aws cloudformation --output=text list-exports --query "Exports[?Name==\`${VPCE_STACK_NAME}-VPCE-DNSName\`].Value")
    ```

4. Connect:

    _NOTE_: This example show how to connect using `psql`. For JDBC see [RedShift Documentation](https://docs.aws.amazon.com/redshift/latest/mgmt/connecting-to-cluster.html)

    ```bash
    PGPASSWORD=$SQL_PASSWORD psql "host=$ENDPOINT port=5439 user=$SQL_USER dbname=redshiftatapple sslmode=require"
    psql (11.5, server 8.0.2)
    SSL connection (protocol: TLSv1.2, cipher: ECDHE-RSA-AES256-GCM-SHA384, bits: 256, compression: off)
    Type "help" for help.

    redshiftatapple=# \conninfo
    You are connected to database "redshiftatapple" as user "redshiftadmin" on host "vpce-0d16374c8e237dd1e-959mdbya.vpce-svc-0a675e1c7409bd42b.us-west-2.vpce.amazonaws.com" at port "5439".
    SSL connection (protocol: TLSv1.2, cipher: ECDHE-RSA-AES256-GCM-SHA384, bits: 256, compression: off)
    redshiftatapple=# \l
                        List of databases
        name       |     owner     | encoding | access privileges
    -----------------+---------------+----------+-------------------
    dev             | rdsdb         | UNICODE  |
    padb_harvest    | rdsdb         | UNICODE  |
    redshiftatapple | redshiftadmin | UNICODE  |
    template0       | rdsdb         | UNICODE  | rdsdb=CT/rdsdb
    template1       | rdsdb         | UNICODE  | rdsdb=CT/rdsdb
    (5 rows)

    redshiftatapple=# exit
    ```

## Clean Up

To delete the example stack, run `destroy.sh`

```text
./destroy.sh
+ python3 ../utilities/delete_stack.py redshift-vpce-1171-jane-smith redshift-cluster-1171-jane-smith
Initiating delete_stack for: redshift-vpce-1171-jane-smith
DELETE_COMPLETE: redshift-vpce-1171-jane-smith

Initiating delete_stack for: redshift-cluster-1171-jane-smith
DELETE_COMPLETE: redshift-cluster-1171-jane-smith
```

## TODO

* [Enable logging](https://github.pie.apple.com/CloudTech/aws-apple/issues/480)
