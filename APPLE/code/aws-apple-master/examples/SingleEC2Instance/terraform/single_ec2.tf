data "aws_ssm_parameter" "image_id" {
  name = var.image_id
}

data "aws_cloudformation_export" "subnet_id" {
  name = "ais-provided-vpc-PrivSubnet${var.az_number}"
}

data "aws_cloudformation_export" "ais-provided-sg" {
  name = "ais-shared-services-sg-SS-SG"
}

data "aws_cloudformation_export" "ais-provided-vpc" {
  name = "ais-provided-vpc-VPCID"
}

data "aws_cloudformation_export" "ais-provided-vpc-cidr" {
  name = "ais-provided-vpc-VPCCIDR"
}

data "aws_caller_identity" "current" {}

locals {
  instance_role_managed_policies = [
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/AISSystemLogsPolicy",
    "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  ]
}

data "template_file" "proxy" {
  template = file("${path.module}/userdata/proxy.sh")
}

data "template_cloudinit_config" "config" {
  gzip          = false
  base64_encode = true
  part {
    content_type = "text/x-shellscript"
    content      = data.template_file.proxy.rendered
  }
}

resource "aws_instance" "ec2_instance" {
  ami           = data.aws_ssm_parameter.image_id.value
  instance_type = var.instance_type
  subnet_id     = data.aws_cloudformation_export.subnet_id.value
  vpc_security_group_ids = [
    data.aws_cloudformation_export.ais-provided-sg.value,
    aws_security_group.security_group.id
  ]
  iam_instance_profile = aws_iam_instance_profile.instance_profile.name
  user_data_base64     = data.template_cloudinit_config.config.rendered
  tags = {
    Name        = var.ec2_name
  }
}

resource "aws_security_group" "security_group" {
  name   = "${var.ec2_name}_SG"
  vpc_id = data.aws_cloudformation_export.ais-provided-vpc.value
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [data.aws_cloudformation_export.ais-provided-vpc-cidr.value]
  }
}

data "aws_iam_policy_document" "ec2_access_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance_role" {
  name                 = "${var.ec2_name}_instance_role"
  path                 = "/"
  permissions_boundary = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/ais-permissions-boundaries"
  assume_role_policy   = data.aws_iam_policy_document.ec2_access_policy.json
}

resource "aws_iam_role_policy_attachment" "node_instance_role_iam_policy_attachment" {
  role       = aws_iam_role.instance_role.name
  count      = length(local.instance_role_managed_policies)
  policy_arn = local.instance_role_managed_policies[count.index]
}

resource "aws_iam_instance_profile" "instance_profile" {
  name = "${var.ec2_name}-instance_profile"
  path = "/"
  role = aws_iam_role.instance_role.name
}
