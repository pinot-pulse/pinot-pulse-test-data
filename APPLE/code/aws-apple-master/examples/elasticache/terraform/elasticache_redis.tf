data "aws_cloudformation_export" "ais-provided-sg" {
  name = "ais-shared-services-sg-SS-SG"
}

data "aws_cloudformation_export" "ais-provided-vpc" {
  name = "ais-provided-vpc-VPCID"
}

data "aws_cloudformation_export" "ais-provided-vpc-cidr" {
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

data "aws_cloudformation_export" "AZ1" {
  name = "ais-provided-vpc-AZ1"
}

data "aws_cloudformation_export" "AZ2" {
  name = "ais-provided-vpc-AZ2"
}

data "aws_cloudformation_export" "AZ3" {
  name = "ais-provided-vpc-AZ3"
}

locals {
  availability_zones = [
    data.aws_cloudformation_export.AZ1.value,
    data.aws_cloudformation_export.AZ2.value,
    data.aws_cloudformation_export.AZ3.value
  ]
}

resource "aws_security_group" "security_group" {
  name   = "${var.stack_name}_EC_SG"
  vpc_id = data.aws_cloudformation_export.ais-provided-vpc.value
  egress {
    from_port   = var.port
    to_port     = var.port
    protocol    = "tcp"
    cidr_blocks = [data.aws_cloudformation_export.ais-provided-vpc-cidr.value]
  }
}

resource "aws_elasticache_subnet_group" "example" {
  name = "${var.stack_name}-subnet-group"
  subnet_ids = [
    data.aws_cloudformation_export.privatesubnet1_id.value,
    data.aws_cloudformation_export.privatesubnet2_id.value,
    data.aws_cloudformation_export.privatesubnet3_id.value
  ]
}

resource "aws_elasticache_replication_group" "example" {
  replication_group_id          = "${var.stack_name}-rep-group-1"
  replication_group_description = "Example"
  number_cache_clusters         = length(local.availability_zones)
  node_type                     = var.cache_node_type
  automatic_failover_enabled    = true
  auto_minor_version_upgrade    = true
  availability_zones            = local.availability_zones
  engine                        = var.cluster_engine
  at_rest_encryption_enabled    = true
  engine_version                = var.engine_version
  port                          = var.port
  subnet_group_name             = aws_elasticache_subnet_group.example.name
  transit_encryption_enabled    = true
  auth_token                    = random_password.auth_token.result
  security_group_ids = [
    data.aws_cloudformation_export.ais-provided-sg.value,
    aws_security_group.security_group.id
  ]
}

resource "aws_secretsmanager_secret" "auth_token_secret" {
  name_prefix = "${var.stack_name}_auth_token"
}

resource "aws_secretsmanager_secret_version" "auth_token_secret" {
  secret_id     = aws_secretsmanager_secret.auth_token_secret.id
  secret_string = random_password.auth_token.result
}

resource "random_password" "auth_token" {
  length           = 41
  special          = true
  override_special = "!&#$^<>"
}
