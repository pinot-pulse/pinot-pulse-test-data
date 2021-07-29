# Launching a SageMaker Instance

This example shows how to launch a SageMaker [Notebook Instance](https://docs.aws.amazon.com/sagemaker/latest/dg/howitworks-create-ws.html) with a custom [Lifecycle Configuration Script](https://docs.aws.amazon.com/sagemaker/latest/dg/notebook-lifecycle-config.html) to prepare it for the [fast.ai](https://course.fast.ai) course.

To prepare the Notebook Instance for the fast.ai course the Life Cycle Configuration Script does the following.

When the instance is created:

1. Create configuration files in `/home/ec2-user/SageMaker`
1. Create symlinks for configuration files
1. Clone the fast.ai course repository into `/home/ec2-user/SageMaker/course-v3`

When a new session is created:

1. Create symlinks for configuration files
1. Install Jupyter Notebook Extensions
1. Pull the latest version of the fast.ai course repository

__NOTES__:

- Only files and data saved within the `/home/ec2-user/SageMaker` folder persist between notebook instance sessions. In order to have configuration to persist we need to replace config files in `$HOME` directory with symlinks to files in `/home/ec2-user/SageMaker` directory.
- When a lifecycle configuration script runs for longer than five minutes it causes the Amazon SageMaker notebook instance to time out. Please refer to [Resolve Amazon SageMaker Lifecycle Configuration Timeouts](https://aws.amazon.com/premiumsupport/knowledge-center/sagemaker-lifecycle-script-timeout/) to learn how to deal with this problem.

## Provision the Instance

```bash
$ aws-profile dev
[dev]$ $ ./provision.sh
+ source vars.sh
+++ echo jane-smith
+++ awk '{print tolower($0)}'
++ S3_COMPLIANT_USERNAME=jane-smith
+++ aws sts get-caller-identity --query Account --output text
++ ACCOUNT_ID=665356936107
++ S3_COMPLIANT_NAME=6653-jane-smith
++ length=15
++ ((  15 > 15  ))
++ SAGEMAKER_STACK_NAME=sagemaker-6653-jane-smith
+ aws cloudformation deploy --template-file sagemaker.yaml --stack-name sagemaker-6653-jane-smith --no-fail-on-empty-changeset --capabilities CAPABILITY_NAMED_IAM

Waiting for changeset to be created..
Waiting for stack create/update to complete
Successfully created/updated stack - sagemaker-6653-jane-smith
```

## Connect to the instance

Since SageMaker is an interactive WebUI (based on Jupyter), you're going to need to transition from the CLI to the Web Console. Use this command to open the console:

```bash
[dev]$ aws-login
```

Once your Web Console is open, you should transition into the [SageMaker Notebook console](https://us-west-2.console.aws.amazon.com/sagemaker/home?region=us-west-2#/notebook-instances). After you have an active console session, you can use this script to open the JupyterLab console directly:

```bash
[dev]$ ./open_juptyer_lab.sh
```

## Sample Notebooks
[Model Training, Deployment, and Batch Transform](./notebooks/train_deploy_transform.ipynb)
A sample notebook to do model training, deployment, and batch transform in AWS Sagemaker native way.

[Training Jobs with Isolated Network](./notebooks/mnist_tensor_plot/mnist-tensor-plot.ipynb)
A sample notebook to set up S3 data channels for training jobs to work with isolated network.


## Destroy the Instance

```bash
[dev]$ ./destroy.sh
+ source vars.sh
+++ echo jane-smith
+++ awk '{print tolower($0)}'
++ S3_COMPLIANT_USERNAME=jane-smith
+++ aws sts get-caller-identity --query Account --output text
++ ACCOUNT_ID=665356936107
++ S3_COMPLIANT_NAME=6653-jane-smith
++ length=15
++ ((  15 > 15  ))
++ SAGEMAKER_STACK_NAME=sagemaker-6653-jane-smith
+ python ../utilities/delete_stack.py sagemaker-6653-jane-smith
Initiating delete_stack for: sagemaker-6653-jane-smith
DELETE_COMPLETE: sagemaker-6653-jane-smith
```

## Additional Resources

- [AWS SageMaker](https://aws.amazon.com/sagemaker/)
- [What is SageMaker?](https://docs.aws.amazon.com/sagemaker/latest/dg/whatis.html)
- [SageMaker Notebook Instance Lifecycle Config Samples](https://github.com/aws-samples/amazon-sagemaker-notebook-instance-lifecycle-config-samples)
- [Resolve Amazon SageMaker Lifecycle Configuration Timeouts](https://aws.amazon.com/premiumsupport/knowledge-center/sagemaker-lifecycle-script-timeout/)
- [Practical Deep Learning for Coders, v3](https://course.fast.ai)
