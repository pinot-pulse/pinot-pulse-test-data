variable "aws_region" {
  default     = "us-west-2"
  type        = string
  description = "The AWS Region to deploy into"
}

variable "aws_profile" {
  type        = string
  description = "AWS Profile"
}

variable "az_number" {
  default     = "1"
  type        = string
  description = "What Az to use. Possible values are 1 - 3"
}

variable "ec2_name" {
  type        = string
  description = "EC2 Name"
  default     = "EC2-Demo"
}

variable "instance_type" {
  default     = "t3.micro"
  type        = string
  description = "Instance type to launch"
}

variable "image_id" {
  default     = "/AIS/AMI/AmazonLinux2/Id"
  type        = string
  description = "AMI to launch"
}
