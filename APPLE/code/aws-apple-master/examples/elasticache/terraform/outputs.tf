output "cache_primary_endpoint" {
  value = aws_elasticache_replication_group.example.primary_endpoint_address
}

output "cache_port" {
  value = aws_elasticache_replication_group.example.port
}

output "auth_token_secret" {
  value = aws_secretsmanager_secret.auth_token_secret.id
}
