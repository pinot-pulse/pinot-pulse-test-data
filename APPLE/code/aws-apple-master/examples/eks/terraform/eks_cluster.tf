data "aws_cloudformation_export" "vpc_id" {
  name = "ais-provided-vpc-VPCID"
}

data "aws_cloudformation_export" "vpc_cidr" {
  name = "ais-provided-vpc-VPCCIDR"
}

data "aws_cloudformation_export" "privatesubnet1_id" {
  name = "ais-provided-vpc-PrivSubnet1"
}

data "aws_cloudformation_export" "privatesubnet2_id" {
  name = "ais-provided-vpc-PrivSubnet2"
}

data "aws_cloudformation_export" "privatesubnet3_id" {
  name = "ais-provided-vpc-PrivSubnet3"
}

resource "aws_security_group" "cluster_control_plane_sg" {
  name   = "${var.eks_cluster_name}-tf-cluster_control_plane_sg"
  vpc_id = data.aws_cloudformation_export.vpc_id.value
}

resource "aws_eks_cluster" "eks_cluster" {
  name                      = var.eks_cluster_name
  version                   = var.eks_version
  role_arn                  = aws_iam_role.eks_service_role.arn
  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]
  encryption_config {
    provider {
      key_arn = aws_kms_key.eks_kms_key.arn
    }
    resources = ["secrets"]
  }
  vpc_config {
    endpoint_private_access = true
    security_group_ids      = [aws_security_group.cluster_control_plane_sg.id]
    subnet_ids = [
      data.aws_cloudformation_export.privatesubnet1_id.value,
      data.aws_cloudformation_export.privatesubnet2_id.value,
      data.aws_cloudformation_export.privatesubnet3_id.value
    ]
  }

  depends_on = [aws_iam_role_policy_attachment.eks_service_role_iam_policy_attachment]
}

data "aws_iam_policy_document" "eks-kms-policy" {
  statement {
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }
  statement {
    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.eks_service_role.arn]
    }
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:DescribeKey"
    ]
    resources = ["*"]
  }
  statement {
    principals {
      type        = "AWS"
      identifiers = [aws_iam_role.eks_service_role.arn]
    }
    actions   = ["kms:CreateGrant"]
    resources = ["*"]
    condition {
      test     = "Bool"
      variable = "kms:GrantIsForAWSResource"
      values   = ["true"]
    }
  }
}

resource "aws_kms_key" "eks_kms_key" {
  policy              = data.aws_iam_policy_document.eks-kms-policy.json
  enable_key_rotation = true
  tags = {
    "kubernetes.io/cluster/${var.eks_cluster_name}" = "owned",
  }
}
