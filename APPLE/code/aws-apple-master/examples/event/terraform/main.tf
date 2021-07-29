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

resource "aws_cloudwatch_event_rule" "event" {
  name = var.RULE_NAME
  description = var.RULE_DESCRIPTION
  schedule_expression = var.SCHEDULE
}

resource "aws_cloudwatch_event_target" "target" {
  rule = aws_cloudwatch_event_rule.event.name
  arn = "arn:aws:lambda:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:function:${var.FUNCTION_NAME}"
}
