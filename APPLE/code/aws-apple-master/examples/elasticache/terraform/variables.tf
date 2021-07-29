variable "aws_profile" {
  type        = string
  description = "AWS profile"
}

variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-west-2"
}

variable "stack_name" {
  type        = string
  description = "Stack name"
}

variable "cluster_engine" {
  type        = string
  description = "Cluster engine"
  default     = "redis"
}

variable "engine_version" {
  type        = string
  description = "Version of cluster engine"
  default     = "5.0.6"
}

variable "port" {
  type        = number
  description = "Port on which the cluster is listening"
  default     = 6397
}

variable "cache_node_type" {
  type        = string
  description = "Type of cache node"
  default     = "cache.m3.medium"
}
