# Architecture

The API is organized around organization tenancy. A user may belong to many organizations through memberships, and organization-owned resources include subscriptions, API keys, usage summaries, invitations, and audit logs.

```mermaid
flowchart LR
  Client["Swagger / Postman / SaaS frontend"] --> CloudRun["Cloud Run NestJS API"]
  CloudRun --> Auth["JWT + refresh token auth"]
  CloudRun --> Rbac["RBAC permission checks"]
  CloudRun --> Prisma["Prisma ORM"]
  Prisma --> Postgres["Cloud SQL PostgreSQL"]
  CloudRun --> Redis["Memorystore Redis"]
  Redis --> BullMQ["BullMQ notification jobs"]
  CloudRun --> Stripe["Stripe test mode"]
  Stripe --> Webhooks["/api/v1/webhooks/stripe"]
  Webhooks --> Postgres
  CloudRun --> Secrets["Secret Manager"]
```

## Domain Model

```mermaid
erDiagram
  User ||--o{ Membership : has
  Organization ||--o{ Membership : owns
  Role ||--o{ Membership : grants
  Role ||--o{ RolePermission : maps
  Permission ||--o{ RolePermission : allows
  Organization ||--o{ Invitation : sends
  Organization ||--o{ Subscription : bills
  Plan ||--o{ Subscription : limits
  Organization ||--o{ ApiKey : issues
  ApiKey ||--o{ UsageEvent : tracks
  Organization ||--o{ UsageSummary : aggregates
  Organization ||--o{ AuditLog : records
  User ||--o{ RefreshToken : owns
  User ||--o{ OneTimeToken : owns
```

## Security Model

- Access tokens are short-lived JWTs.
- Refresh tokens are opaque random strings stored as hashes.
- Refresh token reuse revokes the full token family.
- Password reset revokes active refresh token families.
- API keys are shown once and stored as hashes.
- Stripe webhook signatures are verified before processing.

## Tenant Model

- Billing belongs to organizations, not individual users.
- Usage is tracked per organization and feature.
- Permission checks use `can(userId, permission, orgId)`.
- Platform admins can inspect platform state but do not become organization members automatically.

## Deployment

- Cloud Run hosts the NestJS API.
- Cloud SQL PostgreSQL stores tenant, auth, billing, usage, and audit data.
- Memorystore Redis backs BullMQ notification jobs.
- Secret Manager stores database, JWT, Stripe, and bootstrap admin secrets.
- Artifact Registry stores versioned API container images.
- Terraform provisions staging infrastructure and controls whether Cloud Run is private or public.
