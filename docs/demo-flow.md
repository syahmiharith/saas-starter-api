# Demo Flow

Use this sequence when presenting the project.

## Public Staging

Open:

```txt
https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app/docs
```

Then run the flow below directly from Swagger or Postman.

## Local

1. Start Postgres and Redis with `docker compose up -d`.
2. Run `pnpm db:migrate` and `pnpm db:seed`.
3. Start the API with `pnpm start:dev`.
4. Open `http://localhost:3000/docs` and register a user.
5. Confirm the response includes a default organization.
6. Log in and copy the access token.
7. Create another organization.
8. Invite a second email address.
9. Register the invited user and accept the invitation token from the sandbox notification log.
10. Change the member role.
11. Create an API key and copy the one-time secret.
12. Call the usage event endpoint with `x-api-key`.
13. View usage summaries and audit logs.
14. Create a checkout session for the organization.
15. Send a Stripe test webhook event.
16. Confirm the subscription plan changed.
17. Use an admin token to view `/api/v1/admin/metrics`.

## Automated Checks

```bash
pnpm test:all
pnpm smoke:staging
```
