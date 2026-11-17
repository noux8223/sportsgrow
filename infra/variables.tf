variable "aws_region" {
  description = "Pilot region. The design uses Seoul."
  type        = string
  default     = "ap-northeast-2"
}

variable "project_name" {
  type    = string
  default = "sportsgrow-pilot"
}

variable "tags" {
  type = map(string)
  default = {
    Project     = "SportsGrow"
    Environment = "pilot"
    ManagedBy   = "Terraform"
  }
}

variable "vpc_id" {
  description = "Existing VPC containing the provided application and DB subnets."
  type        = string
}

variable "public_subnet_ids" {
  description = "At least two public subnets in different AZs for the ALB and locked-down Fargate tasks."
  type        = list(string)
  validation {
    condition     = length(var.public_subnet_ids) >= 2
    error_message = "Provide at least two public subnets in different availability zones."
  }
}

variable "db_subnet_ids" {
  description = "At least two private DB subnets in different AZs."
  type        = list(string)
  validation {
    condition     = length(var.db_subnet_ids) >= 2
    error_message = "Provide at least two private DB subnets in different availability zones."
  }
}

variable "route53_zone_id" {
  type = string
}

variable "app_domain" {
  description = "Public pilot hostname, for example pilot.example.kr."
  type        = string
}

variable "ops_domain" {
  description = "Separate operations console hostname."
  type        = string
}

variable "api_origin_domain" {
  description = "Private-use DNS name with an ACM certificate in the Seoul region, pointed at the ALB. CloudFront uses it as the HTTPS origin."
  type        = string
}

variable "viewer_certificate_arn" {
  description = "Issued ACM certificate in us-east-1 covering app_domain and ops_domain."
  type        = string
}

variable "alb_certificate_arn" {
  description = "Issued ACM certificate in aws_region covering api_origin_domain."
  type        = string
}

variable "api_image_tag" {
  description = "Immutable tag of the server image pushed to the Terraform-managed ECR repository."
  type        = string
  default     = "bootstrap"
}

variable "migrate_database_parameter_arn" {
  description = "SSM SecureString parameter ARN containing the RDS master/migration DATABASE_URL. Used only by the one-off bootstrap/migration task."
  type        = string
}

variable "app_database_password_parameter_arn" {
  description = "SSM SecureString parameter ARN for the sportsgrow_app DB role password. Used only by the one-off bootstrap task."
  type        = string
}

variable "report_database_password_parameter_arn" {
  description = "SSM SecureString parameter ARN for the sportsgrow_report DB role password. Used only by the one-off bootstrap task."
  type        = string
}

variable "api_desired_count" {
  description = "Start at zero while bootstrapping DB roles and running migrations, then set to 2."
  type        = number
  default     = 0
  validation {
    condition     = var.api_desired_count >= 0 && var.api_desired_count <= 2 && floor(var.api_desired_count) == var.api_desired_count
    error_message = "The pilot API task count must be 0, 1, or 2."
  }
}

variable "db_master_username" {
  description = "RDS master/migration user. Do not use this credential for the API runtime."
  type        = string
  default     = "sportsgrow_migrate"
}

variable "db_master_password" {
  description = "Strong RDS master password. Terraform state must use encrypted remote storage and tightly scoped access."
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.db_master_password) >= 20
    error_message = "Use a generated RDS password with at least 20 characters."
  }
}

variable "app_secret_parameter_arns" {
  description = "Existing SSM SecureString parameter ARNs indexed by container environment variable name. Values are read only when ECS starts tasks."
  type        = map(string)
  sensitive   = true
  validation {
    condition = alltrue([
      for name in ["DATABASE_URL", "LEGAL_ENTITY_NAME", "LEGAL_REPRESENTATIVE", "LEGAL_ADDRESS", "LEGAL_BUSINESS_NUMBER", "LEGAL_ECOMMERCE_REGISTRATION", "SUPPORT_EMAIL", "MAIL_FROM"] : contains(keys(var.app_secret_parameter_arns), name)
    ])
    error_message = "SSM SecureString ARNs must be supplied for DATABASE_URL and all pilot legal/mail settings."
  }
}

variable "secret_kms_key_arns" {
  description = "KMS keys used to encrypt the supplied SSM SecureString parameters."
  type        = list(string)
  default     = []
}

variable "mail_domain" {
  description = "Verified SES sending domain hosted in route53_zone_id."
  type        = string
}

variable "mail_from_domain" {
  description = "SES custom MAIL FROM subdomain, such as bounce.example.kr."
  type        = string
}

variable "csp_script_hashes" {
  description = "Inline script SHA-256 sources emitted by npm run build:pilot into dist/security-csp.auto.tfvars.json."
  type        = list(string)
  validation {
    condition     = length(var.csp_script_hashes) > 0 && alltrue([for hash in var.csp_script_hashes : can(regex("^'sha256-[A-Za-z0-9+/]+=*'$", hash))])
    error_message = "Build the pilot bundle first and pass its generated CSP hash list."
  }
}
