variable "aws_region" {
  type        = string
  description = "The AWS Region to deploy EKS"
  default     = "us-west-2"
}

variable "aws_profile" {
  type        = string
  description = "AWS Profile"
}

variable "rds_db_engine" {
  type        = string
  description = "DB Engine. Choose one of mysql or postgres"
  default     = "mysql"
}

variable "rds_db_name" {
  type        = string
  description = "RDS database name"
}

variable "rds_db_master_username" {
  type    = string
  default = "rdsatappleadmin"
}

variable "rds_db_instance_class" {
  type        = string
  description = "RDS Instance Class"
  default     = "db.t3.small"
}

variable "rds_db_allocated_storage" {
  type        = number
  description = "Allocated size for database in GB"
  default     = 100
}

variable "rds_db_backup_retention_period" {
  type        = number
  description = "Backup retention period (in days). Must be between 1 - 35"
  default     = 31
}

variable "rds_db_backup_window" {
  type        = string
  description = "The daily time range (in UTC) during which automated backups are created"
  default     = "02:00-03:00"
}

variable "rds_db_maintenance_window" {
  type        = string
  description = "The window to perform maintenance in."
  default     = "mon:03:00-mon:04:00"
}

variable "rds_db_engines" {
  type = map(object({
    version                = string
    port                   = string
    parameter_group        = string
    parameter_group_family = string
    logs_exports           = list(string)
  }))
  default = {
    mysql = {
      version                = "8.0.16"
      port                   = "3306"
      parameter_group        = "mysql"
      parameter_group_family = "mysql8.0"
      logs_exports           = ["error", "general", "slowquery"]
    }
    postgres = {
      version                = "11.4"
      port                   = "5432"
      parameter_group        = "postgres"
      parameter_group_family = "postgres11"
      logs_exports           = ["postgresql", "upgrade"]
    }
  }
}
