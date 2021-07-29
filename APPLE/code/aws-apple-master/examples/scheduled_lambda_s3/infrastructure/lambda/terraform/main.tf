terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      version = "3.4.0"
    }
  }

  backend "s3" {
  }
}
data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

data "aws_cloudformation_export" "sg" {
  name = "ais-shared-services-sg-SS-SG"
}

data "aws_cloudformation_export" "subnet1" {
  name = "ais-provided-vpc-PrivSubnet1"
}
data "aws_cloudformation_export" "subnet2" {
  name = "ais-provided-vpc-PrivSubnet2"
}
data "aws_cloudformation_export" "subnet3" {
  name = "ais-provided-vpc-PrivSubnet3"
}
resource "aws_lambda_function" "test_lambda" {
  filename = var.LAMBDA_ZIP
  function_name = var.FUNCTION_NAME
  source_code_hash = filebase64sha256(var.LAMBDA_ZIP)
  role = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${var.ROLE_NAME}"
  handler = var.LAMBDA_HANDLER
  runtime = var.LAMBDA_RUNTIME
  vpc_config {
    security_group_ids = concat([
      data.aws_cloudformation_export.sg.value], var.SecurityGroups)
    subnet_ids = length(var.SUBNETS) == 0 ? [
      data.aws_cloudformation_export.subnet1.value,
      data.aws_cloudformation_export.subnet2.value,
      data.aws_cloudformation_export.subnet3.value
    ] : var.SUBNETS
  }
}

