# Launching an EC2 Instance (using the provided scripts)

This directory includes all of the information and scripts needed to launch, connect to, and tear down an instance.

## Provision the Instance

```bash
$ aws-profile dev
[dev]$ ./provision.sh
+ source vars.sh
+++ echo jane-smith
+++ awk '{print tolower($0)}'
++ S3_COMPLIANT_USERNAME=jane-smith
+++ aws sts get-caller-identity --query Account --output text
++ ACCOUNT_ID=117117185606
++ S3_COMPLIANT_NAME=1171-jane-smith
++ length=15
++ ((  15 > 15  ))
++ EC2_STACK_NAME=ec2-1171-jane-smith
+ aws cloudformation deploy --template-file SingleEC2Instance.yaml --stack-name ec2-1171-jane-smith --no-fail-on-empty-changeset --capabilities CAPABILITY_IAM

Waiting for changeset to be created..
Waiting for stack create/update to complete
Successfully created/updated stack - ec2-1171-jane-smith
```

## Connect to the instance (via `ssh`)

Before you can `ssh`, make sure you've run through our [setup script](../../setup/), as well configured your local ssh proxy using the [`aws-ssh` example](../aws-ssh/).

```bash
[dev]$ ./ssh-to.sh
+ source vars.sh
+++ echo jane-smith
+++ awk '{print tolower($0)}'
++ S3_COMPLIANT_USERNAME=jane-smith
+++ aws sts get-caller-identity --query Account --output text
++ ACCOUNT_ID=117117185606
++ S3_COMPLIANT_NAME=1171-jane-smith
++ length=15
++ ((  15 > 15  ))
++ EC2_STACK_NAME=ec2-1171-jane-smith
+ INSTANCE_ID_EXPORT_NAME=ec2-1171-jane-smith-Instance-ID
++ aws cloudformation --output=text list-exports --query 'Exports[?Name==`ec2-1171-jane-smith-Instance-ID`].Value'
+ INSTANCE_ID=i-07ff83749d12f5254
+ aws-ssh.sh ec2-user i-07ff83749d12f5254
Last login: Tue Feb 18 21:58:33 2020 from localhost

       __|  __|_  )
       _|  (     /   Amazon Linux 2 AMI
      ___|\___|___|

https://aws.amazon.com/amazon-linux-2/
[ec2-user@ip-100-64-49-85 ~]$ exit
logout
Connection to i-07ff83749d12f5254 closed.
```

## Destroy the Instance

```bash
[dev]$ ./destroy.sh
+ source vars.sh
+++ echo jane-smith
+++ awk '{print tolower($0)}'
++ S3_COMPLIANT_USERNAME=jane-smith
+++ aws sts get-caller-identity --query Account --output text
++ ACCOUNT_ID=117117185606
++ S3_COMPLIANT_NAME=1171-jane-smith
++ length=15
++ ((  15 > 15  ))
++ EC2_STACK_NAME=ec2-1171-jane-smith
+ python ../utilities/delete_stack.py ec2-1171-jane-smith
Initiating delete_stack for: ec2-1171-jane-smith
DELETE_COMPLETE: ec2-1171-jane-smith
```

# Launching an EC2 Instance (by calling `cloudformation` directly)

To launch the stack in an AWS@Apple customer account, you should not need to specify any additional parameters, and can launch the stack like this:

```bash
$ aws cloudformation deploy --template-file SingleEC2Instance.yaml \
--stack-name TestEC2WithSSM --capabilities CAPABILITY_IAM \
--tags Component=SampleEC2App Name=SingleEC2Instance

Waiting for changeset to be created..
Waiting for stack create/update to complete
Successfully created/updated stack - TestEC2WithSSM
```

After the stack is up, you can easily grab the Instance ID.

```bash
$ aws ec2 describe-instances --filters "Name=tag:Name,Values=TestEC2WithSSM" --query "Reservations[].Instances[].InstanceId" --output text
i-080250cb09dec6a05
```

# Connecting to your instance (via SSM)

You can use SSM Sessions to interactively connect to instances. This can be done through the web console, or directly from the CLI. If you would like to use the CLI as shown in the following example, you'll need to install the SSM Session CLI plugin. The plugin is automatically installed via the [CLI setup script](../../setup/), but the instructions for manual configuration are available here: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html.

To verify that the plugin is installed, you can run:

```bash
$ session-manager-plugin

Session-Manager-Plugin is installed successfully. Use AWSCLI to start a session.
```

Now you will be able to use `ssm start-session` from the CLI. Below we add one additional nested command to grab the instance ID, which simplifies the process of connecting.

```bash
$ aws ssm start-session --target $(aws ec2 describe-instances --filters "Name=tag:Name,Values=TestEC2WithSSM" "Name=instance-state-name,Values=running" --query "Reservations[].Instances[].InstanceId" --output text)

Starting session with SessionId: MASCOT-012345-01-01234567-0123-0123-0123-0123456789ab-0123456789abcdef0

sh-4.2$ lsb_release -a
LSB Version:	:base-4.0-amd64:base-4.0-noarch:core-4.0-amd64:core-4.0-noarch
Distributor ID:	AmazonAMI
Description:	Amazon Linux AMI release 2018.03
Release:	2018.03
Codename:	n/a
sh-4.2$ exit
exit

Exiting session with sessionId: MASCOT-012345-01-01234567-0123-0123-0123-0123456789ab-0123456789abcdef0.
```

# Additional Resources
* [What is Systems Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/what-is-systems-manager.html)
* [SSM Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)
* [SSM Session CLI Plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html)
* [Walkthrough: Use the AWS CLI with Run Command](https://docs.aws.amazon.com/systems-manager/latest/userguide/walkthrough-cli.html)
* [`aws ssm` command reference](https://docs.aws.amazon.com/cli/latest/reference/ssm/index.html#cli-aws-ssm)
