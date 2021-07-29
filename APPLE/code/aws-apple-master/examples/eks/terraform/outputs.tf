output "eks_node_instance_role" {
  value = aws_iam_role.node_instance_role.arn
}

output "eks_cluster_name" {
  value = var.eks_cluster_name
}

output "eks_version" {
  value = var.eks_version
}

output "aws_region" {
  value = var.aws_region
}

output "vpc_cidr" {
  value = data.aws_cloudformation_export.vpc_cidr.value
}

output "eks_encryption_key" {
  value = aws_kms_key.eks_kms_key.arn
}
