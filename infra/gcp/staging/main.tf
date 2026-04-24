locals {
  prefix       = "${var.name}-${var.environment}"
  short_prefix = substr(replace(local.prefix, "-", ""), 0, 15)

  labels = {
    app         = var.name
    environment = var.environment
    managed_by  = "terraform"
  }

  required_services = toset([
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "sqladmin.googleapis.com",
    "vpcaccess.googleapis.com"
  ])

  database_url = "postgresql://${var.database_user}:${urlencode(random_password.database.result)}@${google_sql_database_instance.postgres.private_ip_address}:5432/${var.database_name}?schema=public"

  plain_env = {
    NODE_ENV                = "production"
    REDIS_HOST              = google_redis_instance.cache.host
    REDIS_PORT              = tostring(google_redis_instance.cache.port)
    JWT_ACCESS_TTL          = "15m"
    REFRESH_TOKEN_TTL_DAYS  = "30"
    APP_BASE_URL            = var.app_base_url
    PLATFORM_ADMIN_EMAIL    = var.platform_admin_email
    STRIPE_PRICE_FREE       = var.stripe_price_free
    STRIPE_PRICE_PRO        = var.stripe_price_pro
    STRIPE_PRICE_TEAM       = var.stripe_price_team
    STRIPE_PRICE_ENTERPRISE = var.stripe_price_enterprise
  }

  secret_env = {
    DATABASE_URL            = local.database_url
    JWT_ACCESS_SECRET       = coalesce(var.jwt_access_secret, random_password.jwt_access_secret.result)
    PLATFORM_ADMIN_PASSWORD = coalesce(var.platform_admin_password, random_password.platform_admin_password.result)
    STRIPE_SECRET_KEY       = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET   = var.stripe_webhook_secret
  }
}

resource "google_project_service" "required" {
  for_each = local.required_services

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "api" {
  location      = var.region
  repository_id = local.prefix
  description   = "Docker images for ${local.prefix}"
  format        = "DOCKER"
  labels        = local.labels

  depends_on = [google_project_service.required]
}

resource "google_compute_network" "main" {
  name                    = "${local.prefix}-vpc"
  auto_create_subnetworks = false

  depends_on = [google_project_service.required]
}

resource "google_compute_subnetwork" "serverless" {
  name          = "${local.prefix}-subnet"
  ip_cidr_range = "10.42.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id
}

resource "google_compute_global_address" "private_services" {
  name          = "${local.prefix}-private-services"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id
}

resource "google_service_networking_connection" "private_services" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_services.name]
}

resource "google_vpc_access_connector" "serverless" {
  name          = "${local.short_prefix}-conn"
  region        = var.region
  network       = google_compute_network.main.name
  ip_cidr_range = "10.43.0.0/28"
  min_instances = 2
  max_instances = 3

  depends_on = [google_project_service.required]
}

resource "random_password" "database" {
  length  = 32
  special = false
}

resource "random_password" "jwt_access_secret" {
  length  = 48
  special = false
}

resource "random_password" "platform_admin_password" {
  length  = 24
  special = false
}

resource "google_sql_database_instance" "postgres" {
  name             = "${local.prefix}-postgres"
  database_version = "POSTGRES_16"
  region           = var.region

  deletion_protection = var.deletion_protection

  settings {
    tier              = var.cloud_sql_tier
    edition           = "ENTERPRISE"
    disk_type         = "PD_SSD"
    disk_size         = var.cloud_sql_disk_size_gb
    availability_type = "ZONAL"

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "03:00"
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.main.id
    }

    insights_config {
      query_insights_enabled = true
    }
  }

  depends_on = [google_service_networking_connection.private_services]
}

resource "google_sql_database" "app" {
  name     = var.database_name
  instance = google_sql_database_instance.postgres.name
}

resource "google_sql_user" "app" {
  name     = var.database_user
  instance = google_sql_database_instance.postgres.name
  password = random_password.database.result
}

resource "google_redis_instance" "cache" {
  name               = "${local.prefix}-redis"
  tier               = "BASIC"
  memory_size_gb     = 1
  region             = var.region
  authorized_network = google_compute_network.main.id
  redis_version      = "REDIS_7_0"
  connect_mode       = "PRIVATE_SERVICE_ACCESS"
  labels             = local.labels

  depends_on = [google_service_networking_connection.private_services]
}

resource "google_secret_manager_secret" "app" {
  for_each = local.secret_env

  secret_id = "${local.prefix}-${lower(replace(each.key, "_", "-"))}"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

resource "google_secret_manager_secret_version" "app" {
  for_each = local.secret_env

  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = each.value
}

resource "google_service_account" "runtime" {
  account_id   = "${substr(replace(local.prefix, "-", ""), 0, 24)}-run"
  display_name = "Cloud Run runtime for ${local.prefix}"
}

resource "google_project_iam_member" "runtime_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_cloud_run_v2_service" "api" {
  name     = local.prefix
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = local.labels

  lifecycle {
    ignore_changes = [scaling]
  }

  template {
    service_account                  = google_service_account.runtime.email
    max_instance_request_concurrency = 80
    timeout                          = "300s"

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    vpc_access {
      connector = google_vpc_access_connector.serverless.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.container_image

      ports {
        container_port = 3000
      }

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
      }

      dynamic "env" {
        for_each = local.plain_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = google_secret_manager_secret.app
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  depends_on = [
    google_project_iam_member.runtime_secret_accessor,
    google_project_iam_member.runtime_cloudsql_client,
    google_secret_manager_secret_version.app
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "private_invokers" {
  for_each = toset(var.invoker_members)

  project  = var.project_id
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = each.value
}

resource "google_cloud_run_v2_job" "migrate" {
  name     = "${local.prefix}-migrate"
  location = var.region
  labels   = local.labels

  template {
    task_count = 1

    template {
      service_account = google_service_account.runtime.email
      timeout         = "900s"

      vpc_access {
        connector = google_vpc_access_connector.serverless.id
        egress    = "PRIVATE_RANGES_ONLY"
      }

      containers {
        image   = var.container_image
        command = ["/bin/sh", "-c"]
        args    = ["pnpm db:deploy && pnpm db:seed"]

        resources {
          limits = {
            cpu    = var.cloud_run_cpu
            memory = var.cloud_run_memory
          }
        }

        dynamic "env" {
          for_each = local.plain_env
          content {
            name  = env.key
            value = env.value
          }
        }

        dynamic "env" {
          for_each = google_secret_manager_secret.app
          content {
            name = env.key
            value_source {
              secret_key_ref {
                secret  = env.value.secret_id
                version = "latest"
              }
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_cloud_run_v2_service.api,
    google_sql_database.app,
    google_sql_user.app
  ]
}
