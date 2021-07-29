# AWS@Apple CLI Setup

This set of scripts is designed to do the minimum amount of setup to get you using AWS CLI via MASOCT (Federated Authentication) with as little trouble as possible. The target for this work is Developers/Power Users who will be spending the majority of their time using the AWS CLI.

NOTE: if you are a `Bash` power user, or use alternative shells (`csh`, `ksh`, `zsh`, etc.), this might not be the tool for you. This is an attempt to automate the setup of a few utilities that we think are useful, but modifying a developer's environment is a scary proposition. If you have a highly customized environment, or otherwise know what you are doing, you might just want to install the [awsappleconnect plugin](https://github.pie.apple.com/CloudTech/awsappleconnect#manual-setup) using the manual setup process. We have tested and provided experimental support for `zsh`, but are aware of some issues for users of `OhMyZsh`.

## Setup

For fully interactive use:

```bash
bash setup.sh && source ~/.profile
```

For non-interactive use, specify optional parameters:

```text
Usage: ./setup.sh [options]
 -u, --user             user's AppleID
 -m, --mascot-role      AWS mascot role
 -d, --dev-account-id   AWS developer account id
 -t, --test-account-id  AWS test account id
 -p, --prod-account-id  AWS production account id
 -f, --file             Response file for prompts in this script; used for non-interactive use as an alternative to command-line args
                        Values in the file take precedence over command-line arguments.
 --profile-prefix       Prefix to use when defining AWS profiles
```

## Using a response file

The response file is simply a shell script that sets variables used by the
setup script. Edit or copy the responses.template file and set values as
desired. Then run setup.sh with the `-f` option.

```text
== AWS@Apple Setup ==

In order to configure your AWS CLI access, we'll need to gather some information
from you. If you have any questions, go to:
https://github.pie.apple.com/CloudTech/aws-apple/blob/master/setup

Enter your AppleConnect username (ex. john_smith): jane_smith
Enter the MASCOT role name (ex. developer):  developer

Now you'll need to enter the AWS Account IDs for your accounts. Typically customers
have Dev, Test, and Prod accounts. If you don't, just press enter.
Enter your Dev AWS Account ID (ex. 123456789012): 123456789012
Enter your Test AWS Account ID (ex. 234567890123): 234567890123
Enter your Prod AWS Account ID (ex. 345678901234): 345678901234

If you would like to name your profiles, you can set an optional prefix. If not, just
press enter, and we'll label your accounts 'dev', 'test', and 'prod'.
(Optional) Enter your preferred profile name prefix (ex. masoct-):

== AWS@Apple Brew Configuration ==
...
...
✅  prerequisite installations are complete!

== Python3 Configuration ==
...
...
✅  awscli installation is complete!

== AWS@Apple AppleConnect Plugin Install ==
...
...
✅  awsappleconnect installation is complete!

== AWS@Apple AWS Login Install ==
✅  aws-login installation is complete!

== AWS@Apple AWS Profile Install ==
✅  ~/.aws_profile installation is complete!
✅  aws-profile bash completion installation is complete!

== AWS@Apple AWS Configuration Install ==
✅  ~/.aws/config installation is complete!

== AWS@Apple AWS SSM Session Manager CLI Plugin Install ==
...
...
✅  SSM Session Manager CLI Plugin installation is complete!

== AWS@Apple Setup Complete! ==
You are ready to use AWS the AIS way!

To test your access simply enter the following commands:
   $ source ~/.profile
   $ aws-profile dev
   [dev]$ aws sts get-caller-identity
   [dev]$ aws-login

If you have any questions please refer to:
https://github.pie.apple.com/CloudTech/aws-apple/blob/master/setup
```

## AWS Profile Usage

```bash
$ aws-profile dev
[dev]$ aws sts get-caller-identity
{
    "UserId": "AAOAIFR4Z7TRQGOOK7LWU:MASCOT-012345-01-01234567-0123-0123-0123-0123456789ab-0123456789abcdef0",
    "Account": "123456789012",
    "Arn": "arn:aws:sts::123456789012:assumed-role/MASCOT-012345-01-01234567-0123-0123-0123-0123456789ab-0123456789abcdef0"
}
```

## AWS Login

```bash
[dev]$ aws-login
```

## Testing

After making updates to this script you'll want to run both of these sets of tests.

### Automated Tests

We're using the [BATS](https://github.com/bats-core/bats-core) testing framework to test this script. The framework can be installed via brew: `brew install bats-core`. You can run the tests like this:

```bash
$ aws-profile clear
pc-mbp:setup patrick_clancy$ ./test_setup.bats
 ✓ test help
 ✓ test use of response file
 ✓ test use of CLI args
 ✓ test interactive mode

4 tests, 0 failures
```

### Manual Tests

Here we actually want to confirm that everything works end-to-end. The other prerequisite is setting up a `responses` file to simplify running this many times.

```bash
cp ~/.aws/config /tmp/setup_script_test_config
rm ~/.aws/config
rm ~/.aws_profile
aws-profile clear
aws sts get-caller-identity
./setup.sh -f responses
source ~/.profile
aws-profile dev
aws sts get-caller-identity
aws-profile clear
cp /tmp/setup_script_test_config ~/.aws/config
```
