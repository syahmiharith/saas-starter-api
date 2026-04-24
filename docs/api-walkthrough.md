# API Walkthrough

Use this walkthrough for a recruiter demo. The public staging base URL is:

```txt
https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app
```

Swagger is available at:

```txt
https://saas-starter-api-staging-6xiqyp324q-uc.a.run.app/docs
```

## 1. Register

```http
POST /api/v1/auth/register
```

```json
{
  "email": "demo-owner@example.com",
  "password": "Password123!",
  "name": "Demo Owner",
  "organizationName": "Demo Workspace"
}
```

Expected checkpoint: response includes `accessToken`, `refreshToken`, and `defaultOrganization`.

## 2. Log In

```http
POST /api/v1/auth/login
```

```json
{
  "email": "demo-owner@example.com",
  "password": "Password123!"
}
```

Use the returned access token as:

```txt
Authorization: Bearer <accessToken>
```

## 3. Create An Organization

```http
POST /api/v1/organizations
```

```json
{
  "name": "Recruiter Demo Org"
}
```

Expected checkpoint: response includes an owner membership and an active free subscription.

## 4. Create An API Key

```http
POST /api/v1/organizations/:orgId/api-keys
```

```json
{
  "name": "Demo API Key",
  "scopes": ["usage:read", "usage:write", "organization:read"]
}
```

Expected checkpoint: response includes `secret`. This is intentionally shown once.

## 5. Track Usage With API Key Auth

```http
POST /api/v1/organizations/:orgId/usage/events
x-api-key: <secret>
```

```json
{
  "feature": "api_request"
}
```

Expected checkpoint: usage is counted through the API-key guard.

## 6. View Usage

```http
GET /api/v1/organizations/:orgId/usage
```

Expected checkpoint: response shows the current plan, limits, member count, API key count, and monthly API request usage.

## 7. Show Plan Limits

On the free plan, creating a second API key or accepting a second member should return:

```json
{
  "error": {
    "code": "PLAN_LIMIT_EXCEEDED",
    "message": "Your current plan does not allow this action.",
    "details": {}
  }
}
```

## 8. Create Stripe Checkout

```http
POST /api/v1/organizations/:orgId/billing/checkout
```

```json
{
  "plan": "pro"
}
```

Expected checkpoint: response includes a Stripe test checkout URL.

## 9. Invite A Member

After the organization is upgraded to Pro through webhook processing, invite another user:

```http
POST /api/v1/organizations/:orgId/invitations
```

```json
{
  "email": "demo-member@example.com",
  "role": "member"
}
```

Expected checkpoint: response includes an invitation token for sandbox demo purposes.

## 10. Accept Invitation

Register the invited user, log in as that user, then call:

```http
POST /api/v1/invitations/accept
```

```json
{
  "token": "<invitationToken>"
}
```

Expected checkpoint: membership is created for the invited user.

## 11. Change Member Role

```http
PATCH /api/v1/organizations/:orgId/members/:memberId/role
```

```json
{
  "role": "viewer"
}
```

Expected checkpoint: RBAC allows owners to update member roles and blocks non-owners from the same action.

## 12. Inspect Audit Logs

```http
GET /api/v1/organizations/:orgId/audit-logs
```

Expected checkpoint: logs include organization, billing, API key, usage, and member actions.

## 13. Admin Metrics

Log in with the seeded platform admin, then call:

```http
GET /api/v1/admin/metrics
```

Expected checkpoint: response includes platform-wide user, organization, subscription, API key, and usage counts.
