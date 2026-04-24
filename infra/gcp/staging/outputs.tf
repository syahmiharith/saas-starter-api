output "artifact_registry_repository" {
  description = "Artifact Registry Docker repository name."
  value       = google_artifact_registry_repository.api.repository_id
}

output "artifact_registry_location" {
  description = "Artifact Registry location."
  value       = google_artifact_registry_repository.api.location
}

output "image_latest" {
  description = "Recommended latest image URI for terraform.tfvars."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.api.repository_id}/api:latest"
}

output "service_url" {
  description = "Cloud Run service URL."
  value       = google_cloud_run_v2_service.api.uri
}

output "migration_job_name" {
  description = "Cloud Run job to run Prisma migrations and seed data."
  value       = google_cloud_run_v2_job.migrate.name
}

output "runtime_service_account" {
  description = "Cloud Run runtime service account."
  value       = google_service_account.runtime.email
}

output "secret_names" {
  description = "Secret Manager secret names used as Cloud Run env vars."
  value = {
    for key, secret in google_secret_manager_secret.app : key => secret.secret_id
  }
}

output "public_access_enabled" {
  description = "Whether allUsers has Cloud Run invoker access."
  value       = var.allow_unauthenticated
}

