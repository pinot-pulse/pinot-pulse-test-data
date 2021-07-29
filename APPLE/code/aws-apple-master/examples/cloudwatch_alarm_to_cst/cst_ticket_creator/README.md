# Lambda Function for Cloudwatch integration with cst tickets.

## Steps

### Prerequisites
1. Make to use an AWS account with denali network subnet. 
1. Make sure you already have the ADC Resolver template deployed. Template can be found [here](https://github.pie.apple.com/CloudTech/aws-apple-docs/blob/draft/content/guides/networking/onboarding-to-denali-at-aws-apple.md)   
    ```
       aws cloudformation deploy \
       --template-file adc-resolver.yml \
       --stack-name 'denali-dns-resolution-for-adc' \
       --no-fail-on-empty-changeset
    ``` 
1. Make sure you have proper ACLs open for the API(refer to https://cstdocs.apple.com/kentaurus.html for API prerequisites).
### Deploying the template
1. Set the variable values in vars.sh
1. Run the provision.sh script (sh ./provision.sh)

### What will happen  
The script will provision 2 stacks a prerequisite stack, and a lambda stack, this prerequisite stack can be used for any other lambda function, 
that way you won't have too many buckets lingering around. Modify the code if needed to properly set up parameters of your cst tickets.
Behavior of current function is to use alarm Subject as title and alarm message as description. Feel free to add watchers and any other CST parameter.
  
