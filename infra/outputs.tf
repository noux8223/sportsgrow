output "static_bucket_names" {
  value = { for name, bucket in aws_s3_bucket.static : name => bucket.bucket }
}

output "private_bucket_names" {
  value = { for name, bucket in aws_s3_bucket.data : name => bucket.bucket }
}

output "cloudfront_distribution_ids" {
  value = { for name, distribution in aws_cloudfront_distribution.site : name => distribution.id }
}

output "cloudfront_domains" {
  value = { for name, distribution in aws_cloudfront_distribution.site : name => distribution.domain_name }
}

output "api_image_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.pilot.name
}

output "ecs_api_service_name" {
  value = aws_ecs_service.api.name
}

output "ecs_api_task_definition_arn" {
  value = aws_ecs_task_definition.api.arn
}

output "ecs_migration_task_definition_arn" {
  value = aws_ecs_task_definition.bootstrap_migrate.arn
}

output "migration_security_group_id" {
  value = aws_security_group.migration.id
}

output "public_subnet_ids" {
  value = var.public_subnet_ids
}

output "database_endpoint" {
  value = aws_db_instance.pilot.address
}

output "database_identifier" {
  value = aws_db_instance.pilot.identifier
}

output "database_name" {
  value = aws_db_instance.pilot.db_name
}

output "api_origin_alb_dns_name" {
  value = aws_lb.api.dns_name
}
