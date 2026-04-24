# GCP Staging Infrastructure

This Terraform stack provisions a staging demo for the SaaS Starter API:

- Cloud Run API service
- Cloud Run migration/seed job
- Artifact Registry Docker repository
- Cloud SQL for PostgreSQL
- Memorystore Redis
- Secret Manager app configuration
- VPC, private service access, and Serverless VPC Access
- Optional public Cloud Run access for recruiter demos

## Prerequisites

- A GCP project with billing enabled.
- `gcloud` installed and authenticated.
- Terraform `>= 1.6`.
- The API should pass locally with `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## 1. Configure GCP

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

## 2. Create Terraform Variables

```bash
cp infra/gcp/staging/terraform.tfvars.example infra/gcp/staging/terraform.tfvars
```

Edit `terraform.tfvars`.

Keep `allow_unauthenticated = false` while validating the staging demo. Add yourself to `invoker_members`:

```hcl
invoker_members = ["user:your-email@example.com"]
```

## 3. Bootstrap Artifact Registry

Cloud Run needs an image, but the image repository must exist first.

```bash
terraform -chdir=infra/gcp/staging init
terraform -chdir=infra/gcp/staging apply -target=google_artifact_registry_repository.api
```

## 4. Build And Push The API Image

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _REGION=us-central1,_REPOSITORY=saas-starter-api-staging,_IMAGE=api
```

Set `container_image` in `terraform.tfvars` to:

```txt
us-central1-docker.pkg.dev/YOUR_PROJECT_ID/saas-starter-api-staging/api:latest
```

## 5. Apply Full Staging Infrastructure

```bash
terraform -chdir=infra/gcp/staging apply
```

Copy the `service_url` output. If you are not using a custom domain, set `app_base_url` to that URL and apply once more:

```bash
terraform -chdir=infra/gcp/staging apply
```

## 6. Run Database Migrations And Seed Data

```bash
gcloud run jobs execute saas-starter-api-staging-migrate \
  --region us-central1 \
  --wait
```

This runs:

```bash
pnpm db:deploy && pnpm db:seed
```

## 7. Validate Private Staging

For private staging:

```bash
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "$(terraform -chdir=infra/gcp/staging output -raw service_url)/api/v1/health"
```

Then test Swagger:

```txt
SERVICE_URL/docs
```

If Cloud Run is private, the browser must be signed in with an account in `invoker_members`.

## 8. Make Public For Recruiter Demo

Only after the golden path is clean:

```hcl
allow_unauthenticated = true
```

Then:

```bash
terraform -chdir=infra/gcp/staging apply
```

## Secret Handling

Terraform creates Secret Manager values for:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `PLATFORM_ADMIN_PASSWORD`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

These values are also present in Terraform state. For a public portfolio project, keep the Terraform state local/private or move it to a locked-down GCS backend before sharing.

