variable "REGION" {
  type = string
  default = "us-west-2"
}
variable "FUNCTION_NAME" {
  type = string
}

variable "RULE_NAME" {
  type = string
}
variable "RULE_DESCRIPTION" {
  type = string
  default = "Scheduled event"
}

variable "SCHEDULE" {
  type = string
}
