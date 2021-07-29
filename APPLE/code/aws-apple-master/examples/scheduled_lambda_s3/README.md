# Scheduled Lambda - S3

This example is for a scheduled lambda function that runs on a configurable schedule, and connects to s3. 

Architecture:

![Architecture](architecture.png)

## Instructions to get started:

1. Copy Dependencies to [infrastructure](./infrastructure) folder 
    * The dependencies for this are :
        * [Events example](../event) 
        
        * [S3 example](../s3)
2. update [envs.yaml](./envs.yaml) as per your requirements. 
3. Build the Orchestrator cli image and upload to docker.apple.com:
    * Follow instructions [here](../../orchestrator-cli/README.md)        
4. Update [rio.yaml](./rio.yaml) and configure your image

### Configuration parameters:
- **account:**  The AWS Account ID 
- **role:** The IAM role you want to use to execute the deployment
- **region:**  The AWS Region you want to deploy. Default: us-west-2
- **bucket_name:** The S3 bucket you want to use. 
- **function_name:** The name of the lambda function. 
- **role_name** (Optional): The name of the Lambda Execution IAM role. Defaults to `LAMBDA-EXECUTION-<function_name>`
- **lambda_handler:** The handler for your lambda function. For more details, see [this](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-features.html)
- **lambda_runtime:** The lambda runtime. See [Available runtimes](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html)
- **lambda_zip:** The absolute path to the lambda runtime code archive (zipped) 
- **schedule:** The schedule expression. [Instructions](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html) 
- **create_bucket** (Optional): Whether to create the s3 bucket or use an existing one. If yes, we'll try to create `<bucket_name>`.
- **STATEFILE_BUCKET** (Optional): The s3 bucket to store the statefiles. Defaults to <bucket_name>
- **STATEFILE_LOCATION** (Optional): The Directory within <STATEFILE_BUCKET> to store the files. Defaults to `<function_name>-sched-lambda`

These are the resources that will be created:
1. Lambda function
2. S3 bucket (only if create_bucket==true )
3. IAM role for lambda
4. Cloudwatch event rule (name = `<function_name>-scheduler`)
