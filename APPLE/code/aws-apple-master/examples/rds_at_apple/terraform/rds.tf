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

locals {
  db_engine = lookup(var.rds_db_engines, var.rds_db_engine)
  db_parameter_group = {
    mysql    = var.rds_db_engine == "mysql" ? aws_db_parameter_group.mysql[0].name : null
    postgres = var.rds_db_engine == "postgres" ? aws_db_parameter_group.postgres[0].name : null
  }
}

resource "aws_security_group" "rds_security_group" {
  name        = "rds-sg-${var.rds_db_name}"
  description = "rds-sg-${var.rds_db_name}"
  vpc_id      = data.aws_cloudformation_export.vpc_id.value
  ingress {
    from_port   = local.db_engine.port
    to_port     = local.db_engine.port
    protocol    = "tcp"
    cidr_blocks = [data.aws_cloudformation_export.vpc_cidr.value]
  }
}

resource "aws_db_subnet_group" "rds_db_subnet_group" {
  subnet_ids = [
    data.aws_cloudformation_export.privatesubnet1_id.value,
    data.aws_cloudformation_export.privatesubnet2_id.value,
    data.aws_cloudformation_export.privatesubnet3_id.value
  ]

  tags = {
    Name        = "rds-db-subnet-group-${var.rds_db_name}"
  }
}

resource "aws_db_parameter_group" "mysql" {
  count  = var.rds_db_engine == "mysql" ? 1 : 0
  family = local.db_engine.parameter_group_family
  parameter {
    name  = "max_connect_errors"
    value = "8388608"
  }
  parameter {
    name  = "max_connections"
    value = "100"
  }
}

resource "aws_db_parameter_group" "postgres" {
  count  = var.rds_db_engine == "postgres" ? 1 : 0
  family = local.db_engine.parameter_group_family
}

resource "aws_db_instance" "rds_db_instance" {
  name                                = var.rds_db_name
  identifier                          = var.rds_db_name
  engine                              = var.rds_db_engine
  engine_version                      = local.db_engine.version
  instance_class                      = var.rds_db_instance_class
  username                            = var.rds_db_master_username
  password                            = random_password.rds_db_password.result
  parameter_group_name                = local.db_parameter_group[var.rds_db_engine]
  allocated_storage                   = var.rds_db_allocated_storage
  backup_retention_period             = var.rds_db_backup_retention_period
  backup_window                       = var.rds_db_backup_window
  maintenance_window                  = var.rds_db_maintenance_window
  db_subnet_group_name                = aws_db_subnet_group.rds_db_subnet_group.name
  vpc_security_group_ids              = [aws_security_group.rds_security_group.id]
  enabled_cloudwatch_logs_exports     = local.db_engine.logs_exports
  multi_az                            = true
  iam_database_authentication_enabled = true
  auto_minor_version_upgrade          = true
  publicly_accessible                 = false
  storage_encrypted                   = true
  copy_tags_to_snapshot               = true
  skip_final_snapshot                 = true
}

resource "aws_secretsmanager_secret" "rds_db_secret" {
  name_prefix = "rds-secret-${var.rds_db_name}"
}

resource "aws_secretsmanager_secret_version" "rds_db_secret" {
  secret_id     = aws_secretsmanager_secret.rds_db_secret.id
  secret_string = random_password.rds_db_password.result
}

resource "random_password" "rds_db_password" {
  length           = 41
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

data "aws_network_interfaces" "network_interface_ids" {
  # refer to https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-network-interfaces.html
  filter {
    name = "group-id"
    values = ["${ aws_security_group.rds_security_group.id }"]
  }
}

data "aws_network_interface" "network_interfaces" {
  # refer to https://docs.aws.amazon.com/cli/latest/reference/ec2/describe-network-interfaces.html
  count = "${length(data.aws_network_interfaces.network_interface_ids.ids)}"
  id = "${tolist(data.aws_network_interfaces.network_interface_ids.ids)[count.index]}"
}

resource "aws_cloudformation_stack" "update_s3_vpc_endpoint" {
  name          = "${var.rds_db_name}-vpc-endpoint-updater"
  template_body = file("${path.module}/vpce.yaml")

  parameters = {
    RDSEndpointIps = "${join(",", flatten(data.aws_network_interface.network_interfaces.*.private_ips))}"
    Port = local.db_engine.port
  }
}
