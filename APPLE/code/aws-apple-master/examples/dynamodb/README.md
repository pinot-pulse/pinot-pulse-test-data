# Amazon DynamoDB

Amazon DynamoDB is a fully managed proprietary NoSQL database service that supports key-value and document data structures.

Amazon DynamoDB offers fully managed encryption at rest. DynamoDB encryption at rest provides enhanced security by encrypting all your data at rest using encryption keys stored in AWS Key Management Service (AWS KMS). By default, communications to and from DynamoDB use the HTTPS protocol, which protects network traffic by using SSL/TLS encryption. A VPC endpoint for DynamoDB enables Amazon EC2 instances in your VPC to use their private IP addresses to access DynamoDB with no exposure to the public Internet.

[DynamoDB Managed Policies](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/using-identity-based-policies.html#access-policy-examples-aws-managed)

[Customer Managed Policy Examples](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/using-identity-based-policies.html#access-policy-examples-for-sdk-cli)

[Using IAM Policy Conditions for Fine-Grained Access Control](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/specifying-conditions.html)

[Requirements and Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/globaltables_reqs_bestpractices.html)

# Instruction to create DynamoDB

1. Run `provision.sh` script which provisions the following resources
    * A DynamoDB table with Auto Scaling, Encryption at Rest, Point-in-Time Recovery, CloudWatch Alarms using the sample [DynamoDB template](dynamodb.yaml)
    * An EC2 instance with Put/Update/Query Operation on Specific DynamoDB Table using the sample [EC2 template](ec2.yaml)

    ```bash
    ./provision.sh
    + aws cloudformation deploy --no-fail-on-empty-changeset --template-file dynamodb.yaml --stack-name DynamoDB-db-4042-albertom --parameter-overrides MaxReadCapacity=15 MaxWriteCapacity=15 MinReadCapacity=5 MinWriteCapacity=5 PartitionKeyName=Artist PartitionKeyType=S ReadCapacityUnits=5 ReadCapacityUnitsUtilizationTarget=80 SnsEmailSubscription=xyz@apple.com SortKeyName=Song SortKeyType=S TableName=Music WriteCapacityUnits=5 WriteCapacityUnitsUtilizationTarget=80 --tags Component=myDynamoDB Name=DynamoDB --capabilities CAPABILITY_NAMED_IAM

    Waiting for changeset to be created..
    Waiting for stack create/update to complete
    Successfully created/updated stack - DynamoDB-db-4042-albertom
    + aws cloudformation deploy --no-fail-on-empty-changeset --template-file ec2.yaml --stack-name DynamoDB-ec2-4042-albertom --tags Component=SampleEC2App Name=SingleEC2Instance --capabilities CAPABILITY_IAM

    Waiting for changeset to be created..
    Waiting for stack create/update to complete
    Successfully created/updated stack - DynamoDB-ec2-4042-albertom
    ```

2. Connect to your EC2 instance
    ```bash
    aws ssm start-session \
    --target $(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=TestDynamoDBWithEC2" "Name=instance-state-name,Values=running" \
    --query "Reservations[].Instances[].InstanceId" \
    --output text)

    Starting session with SessionId:
    MASCOT-000003-04-880f6e27-dd71-4609-9e70-87dfff97158b-069d511671ac16f66

    sh-4.2$
    ```

3. Configure your region
    ```bash
    aws configure
    ```

4. Add an item to a table
    ```bash
    aws dynamodb put-item \
    --table-name Music  \
    --item \
        '{"Artist": {"S": "No One You Know"}, "Song": {"S": "Call Me Today"}, "AlbumTitle": {"S": "Somewhat Famous"}}' \
    --return-consumed-capacity TOTAL
    ```
    Output
    ```bash

    {
        "ConsumedCapacity": {
            "CapacityUnits": 1.0,
            "TableName": "Music"
        }
    }
    ```

5. Query an item. AWS CLI can read JSON files. For example, consider the following JSON snippet, which is stored in a file named key-conditions.json:
    ```bash
    {
        "Artist": {
            "AttributeValueList": [
                {
                    "S": "No One You Know"
                }
            ],
            "ComparisonOperator": "EQ"
        },
        "Song": {
            "AttributeValueList": [
                {
                    "S": "Call Me Today"
                }
            ],
            "ComparisonOperator": "EQ"
        }
    }
    ```

    You can now issue a Query request using the AWS CLI. In this example, the contents of the key-conditions.json file are used for the --key-conditions parameter:
    ```bash
    aws dynamodb query --table-name Music \
    --key-conditions file://key-conditions.json
    ```

    Output
    ```bash
    {
        "Count": 1,
        "Items": [
            {
                "AlbumTitle": {
                    "S": "Somewhat Famous"
                },
                "Song": {
                    "S": "Call Me Today"
                },
                "Artist": {
                    "S": "No One You Know"
                }
            }
        ],
        "ScannedCount": 1,
        "ConsumedCapacity": null
    }
    ```
6. Destroy the stacks
    ```
    ./destroy.sh
    + delete_stack DynamoDB-ec2-4042-albertom
    + aws cloudformation delete-stack --stack-name DynamoDB-ec2-4042-albertom
    + aws cloudformation wait stack-delete-complete --stack-name DynamoDB-ec2-4042-albertom
    + delete_stack DynamoDB-db-4042-albertom
    + aws cloudformation delete-stack --stack-name DynamoDB-db-4042-albertom
    + aws cloudformation wait stack-delete-complete --stack-name DynamoDB-db-4042-albertom
    ```
