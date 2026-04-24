variable "project_id" {
  description = "GCP project ID that will host the staging demo."
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run, Cloud SQL, Redis, and Artifact Registry."
  type        = string
  default     = "us-central1"
}

variable "name" {
  description = "Base name used for GCP resources."
  type        = string
  default     = "saas-starter-api"
}

variable "environment" {
  description = "Environment suffix used for resource names and labels."
  type        = string
  default     = "staging"
}

variable "container_image" {
  description = "Full Artifact Registry image URI to deploy to Cloud Run."
  type        = string
}

variable "allow_unauthenticated" {
  description = "Set true only when the staging demo is ready to be public."
  type        = bool
  default     = false
}

variable "invoker_members" {
  description = "IAM members allowed to invoke private staging Cloud Run, for example user:you@example.com."
  type        = list(string)
  default     = []
}

variable "app_base_url" {
  description = "Public app/API base URL used by checkout and docs links. Update to the Cloud Run URL after first apply if no custom domain is used."
  type        = string
  default     = "http://localhost:3000"
}

variable "platform_admin_email" {
  description = "Email seeded as the platform admin by prisma/seed.ts."
  type        = string
}

variable "platform_admin_password" {
  description = "Password for the seeded platform admin. If null, Terraform generates one and stores it in Secret Manager."
  type        = string
  sensitive   = true
  default     = null
}

variable "jwt_access_secret" {
  description = "JWT access-token signing secret. If null, Terraform generates one and stores it in Secret Manager."
  type        = string
  sensitive   = true
  default     = null
}

variable "stripe_secret_key" {
  description = "Stripe test secret key for staging. Use a test key, never a live key."
  type        = string
  sensitive   = true
  default     = "sk_test_replace_me"
}

variable "stripe_webhook_secret" {
  description = "Stripe test webhook signing secret for staging."
  type        = string
  sensitive   = true
  default     = "whsec_replace_me"
}

variable "stripe_price_free" {
  description = "Optional Stripe test price ID for the free plan."
  type        = string
  default     = ""
}

variable "stripe_price_pro" {
  description = "Stripe test price ID for the pro plan."
  type        = string
  default     = "price_replace_me"
}

variable "stripe_price_team" {
  description = "Stripe test price ID for the team plan."
  type        = string
  default     = "price_replace_me"
}

variable "stripe_price_enterprise" {
  description = "Optional Stripe test price ID for enterprise."
  type        = string
  default     = ""
}

variable "database_name" {
  description = "PostgreSQL database name."
  type        = string
  default     = "saas_starter"
}

variable "database_user" {
  description = "PostgreSQL application user."
  type        = string
  default     = "saas_starter"
}

variable "cloud_sql_tier" {
  description = "Cloud SQL machine tier. db-f1-micro keeps staging costs low."
  type        = string
  default     = "db-f1-micro"
}

variable "cloud_sql_disk_size_gb" {
  description = "Cloud SQL disk size in GB."
  type        = number
  default     = 10
}

variable "deletion_protection" {
  description = "Protect Cloud SQL from accidental deletion. Keep true after staging data matters."
  type        = bool
  default     = false
}

variable "cloud_run_cpu" {
  description = "Cloud Run CPU limit."
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Cloud Run memory limit."
  type        = string
  default     = "512Mi"
}

variable "min_instances" {
  description = "Minimum Cloud Run instances."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum Cloud Run instances."
  type        = number
  default     = 3
}

