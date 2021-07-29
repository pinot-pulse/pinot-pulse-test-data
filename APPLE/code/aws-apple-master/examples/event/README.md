# AWS-Event Rules

This module creates a cloudwatch event rule that can execute a lambda on a schedule. 

The schedule expression can be created as per instructions [here](https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html) 

## Provisioning:
You can set the following terraform variables: (For environment variables, append TF_VAR to the variable name)
 
-   RULE_NAME:  The name of the rule
-   FUNCTION_NAME: The name of the lambda function to invoke
-   SCHEDULE: The schedule expression to be set

