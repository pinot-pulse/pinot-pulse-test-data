variable "REGION" {
  type = string
  default = "us-west-2"
}

variable "ROLE_NAME" {
  type = string
  default = ""
}


variable "BUCKET_NAME" {
  type = string
}


variable "FUNCTION_NAME" {
  type = string
}

variable "LAMBDA_ZIP" {
  type = string
}

variable "LAMBDA_HANDLER" {
  type = string
}
variable "LAMBDA_RUNTIME" {
  type = string
}

variable "SUBNETS" {
  type = list(string)
  default = []
}

variable "SecurityGroups" {
  type = list(string)
    default = []
}