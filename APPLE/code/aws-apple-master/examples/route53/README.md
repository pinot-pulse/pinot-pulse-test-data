# Amazon Route 53

Amazon Route 53 is highly available DNS web service. We'll be using it to add CNAME records for VPC-Endpoint DNS names. We will convert this:

```
vpce-024495f1bfc663133-jm0cxy4m.vpce-svc-060389c5d7af6da47.us-west-2.vpce.amazonaws.com
```

To this:

```
vpce.mytest.com
```

# Deploying a Hosted Zone and adding a CNAME Record

To provision a sample Hosted Zone run the `provision.sh` script:

```
Usage: ./provision.sh [options]
 -hz, --hosted-zone               create Hosted Zone? (default: false)
 -c, --cname                      create CNAME record? (default: false)

```

Set the `-hz` and `-c` flags to `true` then follow the prompts:

```
./provision.sh -hz true -c true

Please enter Hosted Zone name (i.e. test.com, apple.com): mytest.com

Creating hosted zone for "mytest.com"

Waiting for changeset to be created..
Waiting for stack create/update to complete
Successfully created/updated stack - r53-hz-for-mytest-com

Create CNAME entry for "mytest.com"? (y/n): y
mytest.com

Please enter CNAME record (i.e. apple.test.com, test.apple.com): vpce.mytest.com

Please enter VPC-E DNS name to map to CNAME record: vpce-024495f1bfc663133-jm0cxy4m.vpce-svc-060389c5d7af6da47.us-west-2.vpce.amazonaws.com

Mapping "vpce-024495f1bfc663133-jm0cxy4m.vpce-svc-060389c5d7af6da47.us-west-2.vpce.amazonaws.com" to CNAME entry for "vpce.mytest.com" for SLD "mytest.com"

Waiting for changeset to be created..
Waiting for stack create/update to complete
Successfully created/updated stack - r53-rs-for-vpce-mytest-com

```

You may also create a Hosted Zone or CNAME entry separately by setting the desired flag to `true` (i.e. `./provision.sh -hz true` or `./provision.sh -c true`).
