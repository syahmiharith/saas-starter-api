# SaaS Starter API

[![CI](https://github.com/syahmiharith/saas-starter-api/actions/workflows/ci.yml/badge.svg)](https://github.com/syahmiharith/saas-starter-api/actions/workflows/ci.yml)

Production-style multi-tenant SaaS starter API built with NestJS, PostgreSQL, Prisma, Redis/BullMQ, Stripe sandbox webhooks, Swagger, Docker, and GitHub Actions.

## Live Demo

- Public API health check: [https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app/api/v1/health](https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app/api/v1/health)
- Swagger/OpenAPI docs: [https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app/docs](https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app/docs)
- Base URL: `https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app`

Use Swagger or the Postman collection in [collections/postman](collections/postman) to run the demo flow.

## Features

- Email/password auth with JWT access tokens and refresh token rotation
- Default organization creation on registration
- Organization-scoped billing, usage, API keys, members, and audit logs
- Invite-based teams with owner/admin/member/viewer RBAC
- Stripe checkout, billing portal, and webhook idempotency
- Plan limits for members, API keys, API requests, and audit retention
- API keys with one-time secret display, scopes, hashing, revocation, and usage tracking
- BullMQ-backed sandbox notification adapter
- Platform admin APIs bootstrapped from `PLATFORM_ADMIN_EMAIL`
- Swagger/OpenAPI docs at `/docs`

## Quick Start

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm start:dev
```

Open:

```txt
http://localhost:3000/docs
```

## Golden Path Demo

1. Register a user with `POST /api/v1/auth/register`.
2. Log in with `POST /api/v1/auth/login`.
3. Create a second organization.
4. Invite another user by email.
5. Register the invited user and accept the invitation.
6. Change the invited member role.
7. Create an API key.
8. Send the API key to `POST /api/v1/organizations/:orgId/usage/events`.
9. Observe usage summaries and audit logs.
10. Create a Stripe checkout session.
11. Trigger a Stripe test webhook.
12. Verify the organization subscription and higher plan limits.
13. Inspect platform metrics through admin APIs.

For request payloads and expected checkpoints, see [docs/api-walkthrough.md](docs/api-walkthrough.md).

## Useful Scripts

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:all
pnpm build
pnpm db:studio
```

## Automated Testing

Unit tests run without external services:

```bash
pnpm test:unit
```

Integration and e2e tests use PostgreSQL and Redis, so start local services and apply migrations first:

```bash
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm test:integration
pnpm test:e2e
```

Run the full local quality gate:

```bash
pnpm test:all
```

Run a Cloud Run staging smoke test:

```bash
$env:STAGING_BASE_URL="https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app"
pnpm smoke:staging
```

For admin metrics in staging smoke tests, also set `STAGING_ADMIN_EMAIL` and `STAGING_ADMIN_PASSWORD`.

## Architecture

See [docs/architecture.md](docs/architecture.md), [docs/demo-flow.md](docs/demo-flow.md), and [docs/api-walkthrough.md](docs/api-walkthrough.md).

## GCP Staging Demo

The repo includes Terraform for a private-first GCP staging demo using Cloud Run, Cloud SQL, Memorystore Redis, Secret Manager, Artifact Registry, and a Cloud Run migration job.

See [infra/gcp/staging/README.md](infra/gcp/staging/README.md).
