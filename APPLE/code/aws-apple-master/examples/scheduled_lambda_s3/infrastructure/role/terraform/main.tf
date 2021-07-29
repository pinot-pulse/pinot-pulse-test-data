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

resource "aws_iam_role" "iam_role" {
  name = var.ROLE_NAME != "" ? var.ROLE_NAME :format("LAMBDA-EXECUTION-%s", var.FUNCTION_NAME)
  permissions_boundary = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/ais-permissions-boundaries"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF

}

resource "aws_iam_role_policy" "iam_policy" {
  name = "${var.ROLE_NAME}-policy"
  role = aws_iam_role.iam_role.id
  policy = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudwatchLogStream",
            "Effect": "Allow",
            "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
            "Resource": "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.FUNCTION_NAME}:log-stream:*"
        },
        {
            "Sid": "AllowCloudwatchLogGroupCreation",
            "Effect": "Allow",
            "Action": ["logs:CreateLogGroup"],
            "Resource": "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.FUNCTION_NAME}:log-stream:*"
        },
        {
            "Sid": "RunLambdaInVPC",
            "Effect": "Allow",
            "Action": ["ec2:CreateNetworkInterface", "ec2:DescribeNetworkInterfaces", "ec2:DeleteNetworkInterface" ],
            "Resource": "*"
        },
          {
            "Sid": "AllowS3BucketAccess",
            "Effect": "Allow",
            "Action": ["*"],
            "Resource": ["arn:aws:s3:::${var.BUCKET_NAME}","arn:aws:s3:::${var.BUCKET_NAME}/*"]
        }
    ]
}
EOF
}