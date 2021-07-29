# Orchestrator CLI

This is a thin orchestrator cli that helps with infrastructure creation.

This is particularly helpful for use in CI/CD systems like rio.

## Features:
- YAML based configuration
- Automatic AWS CLI setup for system accounts (See setup)
- Extensible to any infrastructure scripts/tooling 

## Usage

`orch <command> <environment> [Additonal Options]`

**Available commands:**
- **provision** : Provision the infrastructure
- **update**    : Update the infrastructure/code
- **cleanup**   : Cleanup/destroy the infrastructure

**Environment**: 
   The environment identifier as configured in the yaml file
   
**Additional Options**:
- **--secrets-file**        :  The properties file that contains the system id secrets. Default: `./secrets.properties` 
- **--infrastructure-dir**  :  The directory that contains the infrastructure scripts. Default: `./infrastructure`
- **--file**                :  The loction of the yaml file that contains all the configurations

## Infrastructure/tooling setup

The cli executes <action>.sh script in <infrasutructure-dir> directory.

For example, 

`orch provision dev` will execute `provision.sh` in `./infrastructure` directory

`orch cleanup dev --infrastructure-dir=/aws` will execute `cleanup.sh` in `/aws` directory

The script should be able to access the configuration properties as environment variables. 
Also, if the configuration requires nested objects, they are converted into a json string. 

For example,

For parameter `region` configured in the yaml file, the env variables set are : `region`, `REGION`, `TF_VAR_REGION`
    
### Configuration file:

This is an example configuration file. 

The parameters to set are defined by the scripts that are being invoked.

```
dev:
  account: 404268134887
  role: admin
  region: us-west-2
  function_name: test_example_function
  lambda_zip: '/workspace/here.zip'
  schedule: rate(5 days)
qa:
  account: 404268134887
  role: admin
  region: us-west-2
  function_name: test_example_function
  lambda_zip: '/workspace/here.zip'
  schedule: rate(5 days)

```
   
### Application.properties
To access AWS account, you need to supply the system id credentials using a secrets.properties file

### The format of the file : 

```
username=<system_id>
password=<password>
deviceid=<OTP Device ID>
totpsecret=<OTP Secret>
```

For more info, please refer [AWSAppleConnect](https://github.pie.apple.com/CloudTech/awsappleconnect)

### Building the base docker image:

You can use this as a base docker image to be used in Rio or any other CI/CD tooling:

`docker build -t orchestrator .`

### Building for local use:

`pip3 install .`