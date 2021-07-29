data "aws_caller_identity" "current" {}

locals {
  eks_service_role_managed_policies = [
    "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy",
    aws_iam_policy.eks-service-nlb-access-policy.arn
  ]

  node_instance_role_managed_policies = [
    "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/AISSystemLogsPolicy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
    aws_iam_policy.eks-cluster-autoscaler.arn
  ]
}

data "aws_iam_policy_document" "eks-service-nlb-access-policy" {
  statement {
    actions = [
      "ec2:DescribeAccountAttributes",
      "ec2:DescribeInternetGateways*"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "eks-service-nlb-access-policy" {
  name   = "${var.eks_cluster_name}-tf-eks-service-nlb-access-policy"
  path   = "/"
  policy = data.aws_iam_policy_document.eks-service-nlb-access-policy.json
}

data "aws_iam_policy_document" "eks-cluster-autoscaler" {
  statement {
    actions = [
      "autoscaling:DescribeAutoScalingGroups",
      "autoscaling:DescribeAutoScalingInstances",
      "autoscaling:DescribeLaunchConfigurations",
      "autoscaling:DescribeTags",
      "autoscaling:SetDesiredCapacity",
      "autoscaling:TerminateInstanceInAutoScalingGroup",
      "ec2:DescribeLaunchTemplateVersions"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "eks-cluster-autoscaler" {
  name   = "${var.eks_cluster_name}-tf-eks-cluster-autoscaler"
  path   = "/"
  policy = data.aws_iam_policy_document.eks-cluster-autoscaler.json
}

data "aws_iam_policy_document" "eks-service-assume-role-policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eks_service_role" {
  name                 = "${var.eks_cluster_name}-tf-eks_service_role"
  path                 = "/"
  permissions_boundary = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/ais-permissions-boundaries"
  assume_role_policy   = data.aws_iam_policy_document.eks-service-assume-role-policy.json
}

resource "aws_iam_role_policy_attachment" "eks_service_role_iam_policy_attachment" {
  role       = aws_iam_role.eks_service_role.name
  count      = length(local.eks_service_role_managed_policies)
  policy_arn = local.eks_service_role_managed_policies[count.index]
}

data "aws_iam_policy_document" "node-instance-assume-role-policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "node_instance_role" {
  name                 = "${var.eks_cluster_name}-tf-node_instance_role"
  path                 = "/"
  permissions_boundary = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:policy/ais-permissions-boundaries"
  assume_role_policy   = data.aws_iam_policy_document.node-instance-assume-role-policy.json
}

resource "aws_iam_role_policy_attachment" "node_instance_role_iam_policy_attachment" {
  role       = aws_iam_role.node_instance_role.name
  count      = length(local.node_instance_role_managed_policies)
  policy_arn = local.node_instance_role_managed_policies[count.index]
}

resource "aws_iam_instance_profile" "node_instance_profile" {
  name = "${var.eks_cluster_name}-tf-node_instance_profile"
  path = "/"
  role = aws_iam_role.node_instance_role.name
}
