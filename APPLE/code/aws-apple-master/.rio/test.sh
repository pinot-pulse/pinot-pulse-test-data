#!/usr/bin/env bats

@test "Check cfn_nag" {
    # Find cloudformation files
    cloud_formation_files=$(find . | grep -i ".*\.\(yaml\|yml\|json\)" | xargs grep -l AWSTemplateFormatVersion)

    for file in $cloud_formation_files; do
        cfn_nag --output-format txt --blacklist-path .rio/cfn_nag_blacklist.yaml $file
    done
}

@test "Check cloudformation lint" {
    # Find cloudformation files
    cloud_formation_files=$(find . | grep -i ".*\.\(yaml\|yml\|json\)" | xargs grep -l AWSTemplateFormatVersion)

    for file in $cloud_formation_files; do
        # aws cloudformation validate-template --template-body file://$file
        cfn-lint $file --ignore-checks \
        W1020 \
        W3011 \
        ""
        # W1020 Fn::Sub isn't needed because there are no variables at Resources/TestEC2Instance/Properties/UserData/Fn::Base64/Fn::Sub
        # W3011 Both UpdateReplacePolicy and DeletionPolicy are needed to protect Resources/MyBucket from deletion
    done
}

@test "Check terraform lint" {
    # Find terraform files
    terraform_files=$(find . -iname "*.tf")

    for file in $terraform_files; do
        tflint $file
    done
}
