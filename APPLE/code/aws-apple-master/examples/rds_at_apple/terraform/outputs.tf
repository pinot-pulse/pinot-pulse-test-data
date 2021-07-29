output "endpoint_address" {
  value = aws_db_instance.rds_db_instance.endpoint
}

output "instance" {
  value = aws_db_instance.rds_db_instance.arn
}

output "security_group" {
  value = aws_security_group.rds_security_group.id
}

output "secret" {
  value = aws_secretsmanager_secret.rds_db_secret.id
}
