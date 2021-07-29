#!/usr/bin/env bats

#
# This is an automated test suite for the AWS@Apple setup script.
#
# For more info on this testing fraemwork, go to:
#  https://github.com/bats-core/bats-core#bats-core-bash-automated-testing-system-2018
#

setup() {
  # These are variables we will use later
  AWS_CONFIG_FILE=~/.aws/config
  BACKUP_AWS_CONFIG=/tmp/aws_confg_bats_backup
  RESPONSE_FILE=/tmp/responses_file
  EXPECTED_OUTPUT_FILE=/tmp/bats_expected_config

  if [ -f $AWS_CONFIG_FILE ]; then
    cp $AWS_CONFIG_FILE $BACKUP_AWS_CONFIG
    rm -f $AWS_CONFIG_FILE
  fi

  cat << EOF > $RESPONSE_FILE
appleconnect_username=jane_smith
mascot_role=admin
aws_dev_account_id=123456789012
aws_test_account_id=234567890123
aws_prod_account_id=345678901234
profile_prefix=bats_setup_test
use_aws_ps1=true
EOF

  cat << EOF > $EXPECTED_OUTPUT_FILE

[profile bats_setup_testdev]
credential_process = awsappleconnect -u jane_smith -a 123456789012 -r admin
region = us-west-2

[profile bats_setup_testtest]
credential_process = awsappleconnect -u jane_smith -a 234567890123 -r admin
region = us-west-2

[profile bats_setup_testprod]
credential_process = awsappleconnect -u jane_smith -a 345678901234 -r admin
region = us-west-2
EOF
}

teardown() {
  rm -f /tmp/responses_file
  if [ -f $BACKUP_AWS_CONFIG ]; then
    cp $BACKUP_AWS_CONFIG $AWS_CONFIG_FILE
  fi
  rm -f $RESPONSE_FILE
  rm -f $EXPECTED_OUTPUT_FILE
}

# Smoke test that just ensures there aren't errors in the help
@test "test help" {
  ./setup.sh -h
  [ $? -eq 0 ]
}

# Non-interactive test
@test "test use of response file" {
  ./setup.sh -f $RESPONSE_FILE
  [ $? -eq 0 ]
  diff $EXPECTED_OUTPUT_FILE $AWS_CONFIG_FILE
  [ $? -eq 0 ]
}

# Non-interactive CLI test
@test "test use of CLI args" {
  ./setup.sh -u jane_smith -m admin -d 123456789012 -t 234567890123 -p 345678901234 --profile-prefix bats_setup_test --use-aws-ps1 true
  [ $? -eq 0 ]
  diff $EXPECTED_OUTPUT_FILE $AWS_CONFIG_FILE
  [ $? -eq 0 ]
}

# Test interactive mode
@test "test interactive mode" {
  echo -e "jane_smith\nadmin\n123456789012\n234567890123\n345678901234\ntrue\nbats_setup_test\n" | ./setup.sh
  [ $? -eq 0 ]
  diff $EXPECTED_OUTPUT_FILE $AWS_CONFIG_FILE
  [ $? -eq 0 ]
}
