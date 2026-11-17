resource "random_id" "suffix" {
  byte_length = 4
}

data "aws_region" "current" {}

data "aws_caller_identity" "current" {}

data "aws_ec2_managed_prefix_list" "cloudfront_origin" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

data "aws_rds_engine_version" "postgres16" {
  engine  = "postgres"
  version = "16"
  latest  = true
}

locals {
  bucket_names = {
    pilot   = "${var.project_name}-web-${random_id.suffix.hex}"
    ops     = "${var.project_name}-ops-${random_id.suffix.hex}"
    media   = "${var.project_name}-media-${random_id.suffix.hex}"
    exports = "${var.project_name}-exports-${random_id.suffix.hex}"
    erasure = "${var.project_name}-erasure-${random_id.suffix.hex}"
  }
  static_sites = {
    pilot = {
      domain        = var.app_domain
      bucket_name   = aws_s3_bucket.static["pilot"].bucket
      bucket_domain = aws_s3_bucket.static["pilot"].bucket_regional_domain_name
      bucket_arn    = aws_s3_bucket.static["pilot"].arn
    }
    ops = {
      domain        = var.ops_domain
      bucket_name   = aws_s3_bucket.static["ops"].bucket
      bucket_domain = aws_s3_bucket.static["ops"].bucket_regional_domain_name
      bucket_arn    = aws_s3_bucket.static["ops"].arn
    }
  }
  csp = join(" ", [
    "default-src 'self';",
    "base-uri 'self';",
    "object-src 'none';",
    "frame-ancestors 'none';",
    "form-action 'self';",
    "script-src 'self' ${join(" ", var.csp_script_hashes)};",
    "style-src 'self' 'unsafe-inline';",
    "img-src 'self' blob: https://${aws_s3_bucket.data["media"].bucket}.s3.${var.aws_region}.amazonaws.com;",
    "font-src 'self';",
    "connect-src 'self' https://${aws_s3_bucket.data["media"].bucket}.s3.${var.aws_region}.amazonaws.com;",
    "upgrade-insecure-requests"
  ])
}

resource "aws_kms_key" "storage" {
  description             = "Sports Grow pilot media, exports, erasure manifests, and RDS encryption"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  tags                    = { Name = "${var.project_name}-storage" }
}

resource "aws_kms_alias" "storage" {
  name          = "alias/${var.project_name}-storage-${random_id.suffix.hex}"
  target_key_id = aws_kms_key.storage.key_id
}

resource "aws_s3_bucket" "static" {
  for_each = toset(["pilot", "ops"])
  bucket   = local.bucket_names[each.key]
  tags     = { Name = local.bucket_names[each.key], DataClass = "public-static" }
}

resource "aws_s3_bucket" "data" {
  for_each = toset(["media", "exports", "erasure"])
  bucket   = local.bucket_names[each.key]
  tags     = { Name = local.bucket_names[each.key], DataClass = "private-${each.key}" }
}

resource "aws_s3_bucket_public_access_block" "static" {
  for_each                = aws_s3_bucket.static
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "data" {
  for_each                = aws_s3_bucket.data
  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  for_each = aws_s3_bucket.data
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.storage.arn
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media_incoming" {
  bucket = aws_s3_bucket.data["media"].id
  rule {
    id     = "expire-incomplete-uploads"
    status = "Enabled"
    filter { prefix = "incoming/" }
    expiration { days = 1 }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "exports" {
  bucket = aws_s3_bucket.data["exports"].id
  rule {
    id     = "expire-export-archives"
    status = "Enabled"
    filter { prefix = "exports/" }
    expiration { days = 1 }
  }
}

resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.data["media"].id
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT"]
    allowed_origins = ["https://${var.app_domain}", "https://${var.ops_domain}"]
    expose_headers  = ["ETag"]
    max_age_seconds = 300
  }
}

resource "aws_cloudfront_origin_access_control" "static" {
  name                              = "${var.project_name}-${random_id.suffix.hex}"
  description                       = "Read-only access to the pilot and operations static buckets"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_cache_policy" "static" {
  name        = "${var.project_name}-static-${random_id.suffix.hex}"
  comment     = "Short static TTL; deployment invalidates changed HTML"
  min_ttl     = 0
  default_ttl = 300
  max_ttl     = 86400
  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip = true
    headers_config { header_behavior = "none" }
    cookies_config { cookie_behavior = "none" }
    query_strings_config { query_string_behavior = "none" }
  }
}

resource "aws_cloudfront_cache_policy" "api_no_store" {
  name        = "${var.project_name}-api-no-store-${random_id.suffix.hex}"
  comment     = "Zero-TTL policy for cookie-authenticated API responses"
  min_ttl     = 0
  default_ttl = 0
  max_ttl     = 0
  parameters_in_cache_key_and_forwarded_to_origin {
    headers_config { header_behavior = "none" }
    cookies_config { cookie_behavior = "none" }
    query_strings_config { query_string_behavior = "none" }
  }
}

resource "aws_cloudfront_origin_request_policy" "api" {
  name    = "${var.project_name}-api-origin-${random_id.suffix.hex}"
  comment = "Forward session cookies, CSRF headers, signatures, and query strings to Fastify"
  headers_config {
    header_behavior = "allExcept"
    headers { items = ["Host"] }
  }
  cookies_config { cookie_behavior = "all" }
  query_strings_config { query_string_behavior = "all" }
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name = "${var.project_name}-security-${random_id.suffix.hex}"
  security_headers_config {
    content_security_policy {
      content_security_policy = local.csp
      override                = true
    }
    content_type_options { override = true }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
  }
}

resource "aws_cloudfront_distribution" "site" {
  for_each            = local.static_sites
  enabled             = true
  comment             = "${var.project_name} ${each.key} site"
  default_root_object = "index.html"
  aliases             = [each.value.domain]
  price_class         = "PriceClass_200"
  http_version        = "http2and3"

  origin {
    domain_name              = each.value.bucket_domain
    origin_id                = "${each.key}-static-s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.static.id
  }

  origin {
    domain_name = var.api_origin_domain
    origin_id   = "api-alb"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id           = "${each.key}-static-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.static.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
    compress                   = true
  }

  ordered_cache_behavior {
    path_pattern               = "/api/*"
    target_origin_id           = "api-alb"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = aws_cloudfront_cache_policy.api_no_store.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.api.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
    compress                   = true
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    acm_certificate_arn      = var.viewer_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

data "aws_iam_policy_document" "static_read" {
  for_each = local.static_sites
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${each.value.bucket_arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.site[each.key].arn]
    }
  }
}

resource "aws_s3_bucket_policy" "static_read" {
  for_each = local.static_sites
  bucket   = each.value.bucket_name
  policy   = data.aws_iam_policy_document.static_read[each.key].json
  depends_on = [
    aws_s3_bucket_public_access_block.static
  ]
}

resource "aws_route53_record" "site" {
  for_each = aws_cloudfront_distribution.site
  zone_id  = var.route53_zone_id
  name     = local.static_sites[each.key].domain
  type     = "A"
  alias {
    name                   = each.value.domain_name
    zone_id                = each.value.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_ipv6" {
  for_each = aws_cloudfront_distribution.site
  zone_id  = var.route53_zone_id
  name     = local.static_sites[each.key].domain
  type     = "AAAA"
  alias {
    name                   = each.value.domain_name
    zone_id                = each.value.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-${random_id.suffix.hex}"
  description = "HTTPS requests from CloudFront origin-facing addresses only"
  vpc_id      = var.vpc_id
  ingress {
    description     = "CloudFront origin fetches"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    prefix_list_ids = [data.aws_ec2_managed_prefix_list.cloudfront_origin.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "api" {
  name        = "${var.project_name}-api-${random_id.suffix.hex}"
  description = "Fastify tasks accept traffic only from the ALB"
  vpc_id      = var.vpc_id
  ingress {
    description     = "ALB to Fastify"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "migration" {
  name        = "${var.project_name}-migration-${random_id.suffix.hex}"
  description = "One-off migration tasks can reach the database and have no inbound ports"
  vpc_id      = var.vpc_id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "database" {
  name        = "${var.project_name}-db-${random_id.suffix.hex}"
  description = "PostgreSQL ingress from Fastify tasks only"
  vpc_id      = var.vpc_id
  ingress {
    description     = "Fastify to PostgreSQL"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.api.id, aws_security_group.migration.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "pilot" {
  name       = "${var.project_name}-${random_id.suffix.hex}"
  subnet_ids = var.db_subnet_ids
  tags       = { Name = "${var.project_name}-private-db" }
}

resource "aws_db_parameter_group" "postgres16" {
  name   = "${var.project_name}-postgres16-${random_id.suffix.hex}"
  family = "postgres16"

  parameter {
    name         = "random_page_cost"
    value        = "1.1"
    apply_method = "immediate"
  }
  parameter {
    name         = "effective_io_concurrency"
    value        = "200"
    apply_method = "immediate"
  }
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }
  parameter {
    name         = "log_min_duration_statement"
    value        = "200"
    apply_method = "immediate"
  }
  parameter {
    name         = "log_autovacuum_min_duration"
    value        = "250"
    apply_method = "immediate"
  }
  parameter {
    name         = "rds.force_ssl"
    value        = "1"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_instance" "pilot" {
  identifier                      = "${var.project_name}-${random_id.suffix.hex}"
  engine                          = "postgres"
  engine_version                  = data.aws_rds_engine_version.postgres16.version_actual
  instance_class                  = "db.t4g.small"
  allocated_storage               = 20
  storage_type                    = "gp3"
  storage_encrypted               = true
  kms_key_id                      = aws_kms_key.storage.arn
  db_name                         = "sportsgrow"
  username                        = var.db_master_username
  password                        = var.db_master_password
  port                            = 5432
  multi_az                        = true
  publicly_accessible             = false
  db_subnet_group_name            = aws_db_subnet_group.pilot.name
  vpc_security_group_ids          = [aws_security_group.database.id]
  parameter_group_name            = aws_db_parameter_group.postgres16.name
  backup_retention_period         = 35
  auto_minor_version_upgrade      = true
  apply_immediately               = false
  deletion_protection             = true
  copy_tags_to_snapshot           = true
  skip_final_snapshot             = false
  final_snapshot_identifier       = "${var.project_name}-${random_id.suffix.hex}-final"
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]
  tags                            = { Name = "${var.project_name}-postgres16" }
}

resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name          = "${var.project_name}-db-cpu-high"
  alarm_description   = "Pilot RDS CPU is above the design threshold for 15 minutes."
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  datapoints_to_alarm = 3
  threshold           = 70
  comparison_operator = "GreaterThanThreshold"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.pilot.identifier }
  treat_missing_data  = "notBreaching"
}

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.project_name}-execution-${random_id.suffix.hex}"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${var.project_name}-ssm-secrets"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat([
      {
        Effect = "Allow"
        Action = ["ssm:GetParameters"]
        Resource = concat(values(var.app_secret_parameter_arns), [
          var.migrate_database_parameter_arn,
          var.app_database_password_parameter_arn,
          var.report_database_password_parameter_arn
        ])
      }
      ], length(var.secret_kms_key_arns) == 0 ? [] : [{
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = var.secret_kms_key_arns
    }])
  })
}

resource "aws_iam_role" "ecs_task" {
  name               = "${var.project_name}-task-${random_id.suffix.hex}"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role" "ecs_migration_task" {
  name               = "${var.project_name}-migration-task-${random_id.suffix.hex}"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy" "ecs_task_data" {
  name = "${var.project_name}-private-data-access"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = [for bucket in values(aws_s3_bucket.data) : "${bucket.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
        Resource = [aws_kms_key.storage.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = [aws_ses_domain_identity.sender.arn]
      }
    ]
  })
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = 30
}

resource "aws_ecs_cluster" "pilot" {
  name = "${var.project_name}-${random_id.suffix.hex}"
}

resource "aws_ecr_repository" "api" {
  name                 = "${var.project_name}/api"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 30 most recent immutable pilot images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 30 }
      action       = { type = "expire" }
    }]
  })
}

resource "aws_lb" "api" {
  name                       = "${substr(var.project_name, 0, 23)}-${random_id.suffix.hex}"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = var.public_subnet_ids
  drop_invalid_header_fields = true
  enable_deletion_protection = true
}

resource "aws_lb_target_group" "api" {
  name        = "${substr(var.project_name, 0, 23)}-${random_id.suffix.hex}"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = var.vpc_id
  health_check {
    enabled             = true
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
  }
}

resource "aws_lb_listener" "api_https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.alb_certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_route53_record" "api_origin" {
  zone_id = var.route53_zone_id
  name    = var.api_origin_domain
  type    = "A"
  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn
  container_definitions = jsonencode([{
    name         = "api"
    image        = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
    essential    = true
    portMappings = [{ containerPort = 3000, protocol = "tcp" }]
    environment = [
      { name = "APP_ENV", value = "pilot" },
      { name = "APP_BASE_URL", value = "https://${var.app_domain}" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "DB_SSL", value = "true" },
      { name = "MAIL_TRANSPORT", value = "ses" },
      { name = "BILLING_ENFORCEMENT", value = "true" },
      { name = "MEDIA_UPLOAD", value = "true" },
      { name = "TRUST_PROXY", value = "true" },
      { name = "MEDIA_BUCKET", value = aws_s3_bucket.data["media"].bucket },
      { name = "EXPORT_BUCKET", value = aws_s3_bucket.data["exports"].bucket },
      { name = "ERASURE_MANIFEST_BUCKET", value = aws_s3_bucket.data["erasure"].bucket },
      { name = "MEDIA_KMS_KEY_ID", value = aws_kms_key.storage.key_id },
      { name = "EXPORT_KMS_KEY_ID", value = aws_kms_key.storage.key_id },
      { name = "ERASURE_KMS_KEY_ID", value = aws_kms_key.storage.key_id },
      { name = "PORT", value = "3000" }
    ]
    secrets = [for name, arn in var.app_secret_parameter_arns : { name = name, valueFrom = arn }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "api"
      }
    }
  }])
  depends_on = [aws_cloudwatch_log_group.api, aws_iam_role_policy_attachment.ecs_execution_managed, aws_iam_role_policy.ecs_execution_secrets]
}

resource "aws_ecs_task_definition" "bootstrap_migrate" {
  family                   = "${var.project_name}-bootstrap-migrate"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_migration_task.arn
  container_definitions = jsonencode([{
    name      = "bootstrap-migrate"
    image     = "${aws_ecr_repository.api.repository_url}:${var.api_image_tag}"
    essential = true
    command   = ["node", "scripts/bootstrap-rds.mjs"]
    environment = [
      { name = "DB_SSL", value = "true" },
      { name = "AWS_REGION", value = var.aws_region }
    ]
    secrets = [
      { name = "MIGRATE_DATABASE_URL", valueFrom = var.migrate_database_parameter_arn },
      { name = "APP_DATABASE_PASSWORD", valueFrom = var.app_database_password_parameter_arn },
      { name = "REPORT_DATABASE_PASSWORD", valueFrom = var.report_database_password_parameter_arn }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.api.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "migration"
      }
    }
  }])
  depends_on = [aws_cloudwatch_log_group.api, aws_iam_role_policy_attachment.ecs_execution_managed, aws_iam_role_policy.ecs_execution_secrets]
}

resource "aws_ecs_service" "api" {
  name                               = "${var.project_name}-api"
  cluster                            = aws_ecs_cluster.pilot.id
  task_definition                    = aws_ecs_task_definition.api.arn
  desired_count                      = var.api_desired_count
  launch_type                        = "FARGATE"
  platform_version                   = "LATEST"
  health_check_grace_period_seconds  = 90
  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.api_https, aws_iam_role_policy_attachment.ecs_execution_managed, aws_iam_role_policy.ecs_task_data]
}

resource "aws_ses_domain_identity" "sender" {
  domain = var.mail_domain
}

resource "aws_ses_domain_dkim" "sender" {
  domain = aws_ses_domain_identity.sender.domain
}

resource "aws_ses_domain_mail_from" "sender" {
  domain                 = aws_ses_domain_identity.sender.domain
  mail_from_domain       = var.mail_from_domain
  behavior_on_mx_failure = "RejectMessage"
}

resource "aws_route53_record" "ses_verification" {
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.mail_domain}"
  type    = "TXT"
  ttl     = 300
  records = ["\"${aws_ses_domain_identity.sender.verification_token}\""]
}

resource "aws_route53_record" "ses_dkim" {
  for_each = toset(aws_ses_domain_dkim.sender.dkim_tokens)
  zone_id  = var.route53_zone_id
  name     = "${each.value}._domainkey.${var.mail_domain}"
  type     = "CNAME"
  ttl      = 300
  records  = ["${each.value}.dkim.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_mx" {
  zone_id = var.route53_zone_id
  name    = var.mail_from_domain
  type    = "MX"
  ttl     = 300
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  zone_id = var.route53_zone_id
  name    = var.mail_from_domain
  type    = "TXT"
  ttl     = 300
  records = ["\"v=spf1 include:amazonses.com ~all\""]
}

