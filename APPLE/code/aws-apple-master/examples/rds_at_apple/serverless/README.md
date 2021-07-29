# Amazon Aurora Serverless

[Amazon Aurora Serverless](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless.html) is an on-demand, auto-scaling configuration for [Amazon Aurora](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html) (MySQL-compatible and PostgreSQL-compatible editions), where the database will automatically start up, shut down, and scale capacity up or down based on your application's needs. It enables you to run your database in the cloud without managing any database instances.

## Deploying Aurora Serverless

To provision a sample cluster run the `provision.sh` script

```text
Usage: ./provision.sh [options]
 -d, --db-name                    Database Name (default: RDSAtApple)
 -e, --db-engine <mysql|postgres> Database Engine (default: mysql)
 -v, --vpc-endpoint <true|false>  Create a vpc endpoint for the database (default: false)
 ```

## Clean Up

To delete the example run destroy.sh

```bash
$ ./destroy.sh
+ python3 ../../utilities/delete_stack.py aurora-serverlesss-vpce-1171-jane-smith aurora-serverlesss-rds-1171-jane-smith
Initiating delete_stack for: aurora-serverlesss-vpce-1171-jane-smith
DELETE_COMPLETE: aurora-serverlesss-vpce-1171-jane-smith

Initiating delete_stack for: aurora-serverlesss-rds-1171-jane-smith
DELETE_COMPLETE: aurora-serverlesss-rds-1171-jane-smith
```

## Next Steps

Refer to [RDS@Apple](../) Examples
