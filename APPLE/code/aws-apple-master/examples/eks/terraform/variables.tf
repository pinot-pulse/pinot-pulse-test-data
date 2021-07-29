variable "aws_region" {
  type        = string
  description = "The AWS Region to deploy EKS"
  default     = "us-west-2"
}

variable "aws_profile" {
  type        = string
  description = "AWS Profile"
}

variable "eks_cluster_name" {
  type        = string
  description = "EKS Cluster Name"
}

variable "eks_version" {
  type        = string
  description = "Kubernetes version"
  default     = "1.18"
}

variable "eks_instance_type" {
  type        = string
  description = "Instance type for EKS worker nodes"
  default     = "t3.medium"
}

variable "eks_desired_capacity" {
  type        = number
  description = "Number of worker nodes to start"
  default     = 2
}

variable "eks_max_size" {
  type        = number
  description = "Max number of worker nodes"
  default     = 3
}

variable "eks_min_size" {
  type        = number
  description = "Minimum number of worker nodes"
  default     = 1
}
