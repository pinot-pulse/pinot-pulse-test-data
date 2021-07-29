# Two EC2 Instances

In this folder we have a self contained example with two EC2 instances. One which you use for access/testing, and the other which runs an application. It looks like this:

![two instance architecture](img/two_instances.png)

For the application instance, we're going to use ansible to configure a simple Flask app on it.

# Prerequisites

Before running this stack, you should setup your [CLI environment](../../setup/). Besides that, there will be nothing else expected in your local environment.

# Deploying the Stack

To deploy the stack, simply run: `./provision.sh`.

# Updating the Stack

If you need to update any of the resources CloudFormation template, simply make the change, and then run: `./provision.sh`. That will trigger update the stack and resources. If you need to update the configuration on the applicaiton instance, see below to re-run Ansible.

# Updating the Running Instances

If you changed the Ansible playbook, and want to run that on the instances without changing the auto scaling group, you can just trigger a playbook run by doing the following: `./update_hosts.sh`.

# Deleting the Stack

To delete the stack, simply run: `./destroy.sh`.
