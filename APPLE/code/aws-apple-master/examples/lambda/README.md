A Lambda function consists of code you provide, associated dependencies, and configuration. The configuration information you provide includes the compute resources you want to allocate (for example, memory), execution timeout, and an IAM role that AWS Lambda can assume to execute your Lambda function on your behalf.

# Instruction to Create Lambda Function

1- Create Lambda Function using the sample [Lambda Template](lambda.yaml).

```bash
aws cloudformation deploy --template-file lambda.yaml --stack-name lambda-test \
--parameter-overrides FunctionName=my-lambda-function \
VPCStackName=ais-provided-vpc \
--tags Component=mylambdafunction Name=LambdaFunction \
--capabilities CAPABILITY_NAMED_IAM --profile dev


Waiting for changeset to be created..
Waiting for stack create/update to complete
Successfully created/updated stack - lambda-test
```  

2- Get the ARN of the Lambda Function
```bash
aws lambda get-function --function-name my-lambda-function-1 --query Configuration.FunctionArn --output text
```

3- Invoke your Lambda function using the invoke command.
```bash
aws lambda invoke --function-name <LambdaFunctionARN> --log-type Tail \
--payload '{"key1":"Hello World", "key2":"value2", "key3":"value3"}' \
outputfile.txt
{
    "LogResult": "base64-encoded-log",
    "ExecutedVersion": "$LATEST",
    "StatusCode": 200
}
```
7- The log data in the response is base64-encoded. Use the base64 program to decode the log.
```bash
echo base64-encoded-log | base64 --decode

START RequestId: 02d9a6c8-53b8-4ccc-90f1-34c3990df142 Version: $LATEST
[INFO]	2019-02-19T05:21:52.56Z	02d9a6c8-53b8-4ccc-90f1-34c3990df142	Event: {'key1': 'Hello World', 'key2': 'value2', 'key3': 'value3'}
[INFO]	2019-02-19T05:21:52.319Z	02d9a6c8-53b8-4ccc-90f1-34c3990df142	Starting new HTTPS connection (1): jsonplaceholder.typicode.com
{
  "userId": 1,
  "id": 1,
  "title": "delectus aut autem",
  "completed": false
}
END RequestId: 02d9a6c8-53b8-4ccc-90f1-34c3990df142
REPORT RequestId: 02d9a6c8-53b8-4ccc-90f1-34c3990df142	Duration: 785.90 ms	Billed Duration: 800 ms 	Memory Size: 128 MB	Max Memory Used: 29 MB
```
8- Lambda writes the response to the outputfile.txt

# AWS Lambda Permissions

A Lambda function also has a policy, called an [Execution Role](https://docs.aws.amazon.com/lambda/latest/dg/lambda-intro-execution-role.html), that grants it permission to access AWS services and resources.

Use [Resource-Based Policies](https://docs.aws.amazon.com/lambda/latest/dg/access-control-resource-based.html) to give other accounts and AWS services permission to use your Lambda resources.

To manage permissions for roles in your accounts, use the [Managed Policies](https://docs.aws.amazon.com/lambda/latest/dg/access-control-identity-based.html) that Lambda provides, or write your own
