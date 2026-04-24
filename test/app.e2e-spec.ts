import request = require('supertest');
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestApp, closeTestApp } from './helpers/test-app';
import { resetAndSeedDatabase } from './helpers/database';

describe('SaaS Starter API e2e', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let httpServer: Parameters<typeof request>[0];
  let consoleLogSpy: jest.SpyInstance;

  beforeAll(async () => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;
    httpServer = app.getHttpServer();
  });

  beforeEach(async () => {
    await resetAndSeedDatabase(prisma);
  });

  afterAll(async () => {
    consoleLogSpy.mockRestore();
    await closeTestApp(app);
  });

  it('rotates refresh tokens and revokes the family when an old token is reused', async () => {
    const email = uniqueEmail('refresh');
    const password = 'Password123!';
    const registered = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ email, password, name: 'Refresh User' })
      .expect(201);

    const firstRefreshToken = registered.body.refreshToken;
    const rotated = await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(201);

    expect(rotated.body.refreshToken).toBeTruthy();
    expect(rotated.body.refreshToken).not.toEqual(firstRefreshToken);

    const reused = await request(httpServer)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(401);

    expect(reused.body.error.code).toBe('TOKEN_REUSE_DETECTED');
  });

  it('runs the portfolio golden path through auth, tenancy, RBAC, billing, usage, audit, and admin APIs', async () => {
    const ownerEmail = uniqueEmail('owner');
    const memberEmail = uniqueEmail('member');
    const password = 'Password123!';

    const registered = await request(httpServer)
      .post('/api/v1/auth/register')
      .send({
        email: ownerEmail,
        password,
        name: 'Owner User',
        organizationName: 'Default Demo Org'
      })
      .expect(201);

    expect(registered.body.defaultOrganization.id).toBeTruthy();
    expect(registered.body.accessToken).toBeTruthy();

    const loggedIn = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: ownerEmail, password })
      .expect(201);
    const ownerToken = loggedIn.body.accessToken as string;

    const secondOrganization = await request(httpServer)
      .post('/api/v1/organizations')
      .set(authHeader(ownerToken))
      .send({ name: 'Golden Path Org' })
      .expect(201);
    const organizationId = secondOrganization.body.id as string;

    const ownerMembers = await request(httpServer)
      .get(`/api/v1/organizations/${organizationId}/members`)
      .set(authHeader(ownerToken))
      .expect(200);
    const ownerMembership = ownerMembers.body.find((membership: any) => membership.user.email === ownerEmail);
    expect(ownerMembership.role.slug).toBe('owner');

    const lastOwnerDemotion = await request(httpServer)
      .patch(`/api/v1/organizations/${organizationId}/members/${ownerMembership.id}/role`)
      .set(authHeader(ownerToken))
      .send({ role: 'member' })
      .expect(403);
    expect(lastOwnerDemotion.body.error.message).toContain('at least one owner');

    const firstApiKey = await request(httpServer)
      .post(`/api/v1/organizations/${organizationId}/api-keys`)
      .set(authHeader(ownerToken))
      .send({ name: 'Local e2e key', scopes: ['usage:read', 'usage:write', 'organization:read'] })
      .expect(201);
    expect(firstApiKey.body.secret).toBeTruthy();
    expect(firstApiKey.body.prefix).toBeTruthy();

    const secondApiKeyBlocked = await request(httpServer)
      .post(`/api/v1/organizations/${organizationId}/api-keys`)
      .set(authHeader(ownerToken))
      .send({ name: 'Blocked key' })
      .expect(403);
    expect(secondApiKeyBlocked.body.error.code).toBe('PLAN_LIMIT_EXCEEDED');

    await request(httpServer)
      .post(`/api/v1/organizations/${organizationId}/usage/events`)
      .set('x-api-key', firstApiKey.body.secret)
      .send({ feature: 'api_request' })
      .expect(201);

    const freeUsage = await request(httpServer)
      .get(`/api/v1/organizations/${organizationId}/usage`)
      .set(authHeader(ownerToken))
      .expect(200);
    expect(freeUsage.body.plan).toBe('free');
    expect(freeUsage.body.usage.apiRequests).toBe(1);

    const freeInviteBlocked = await request(httpServer)
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(authHeader(ownerToken))
      .send({ email: memberEmail, role: 'member' })
      .expect(403);
    expect(freeInviteBlocked.body.error.code).toBe('PLAN_LIMIT_EXCEEDED');

    const checkout = await request(httpServer)
      .post(`/api/v1/organizations/${organizationId}/billing/checkout`)
      .set(authHeader(ownerToken))
      .send({ plan: 'pro' });
    if (checkout.status !== 201) {
      throw new Error(
        JSON.stringify({
          status: checkout.status,
          body: checkout.body,
          text: checkout.text
        })
      );
    }
    expect(checkout.body.url).toContain('checkout.stripe.com');

    const stripeEventPayload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: `sub_${Date.now()}`,
          object: 'subscription',
          status: 'active',
          cancel_at_period_end: false,
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
          metadata: {
            organizationId,
            plan: 'pro'
          }
        }
      }
    });

    await request(httpServer)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'test-signature')
      .set('content-type', 'application/json')
      .send(stripeEventPayload)
      .expect(201);

    const duplicateWebhook = await request(httpServer)
      .post('/api/v1/webhooks/stripe')
      .set('stripe-signature', 'test-signature')
      .set('content-type', 'application/json')
      .send(stripeEventPayload)
      .expect(409);
    expect(duplicateWebhook.body.error.code).toBe('WEBHOOK_ALREADY_PROCESSED');

    const proUsage = await request(httpServer)
      .get(`/api/v1/organizations/${organizationId}/usage`)
      .set(authHeader(ownerToken))
      .expect(200);
    expect(proUsage.body.plan).toBe('pro');
    expect(proUsage.body.limits.members).toBe(3);

    const invitation = await request(httpServer)
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(authHeader(ownerToken))
      .send({ email: memberEmail, role: 'member' })
      .expect(201);
    expect(invitation.body.token).toBeTruthy();

    await request(httpServer)
      .post('/api/v1/auth/register')
      .send({ email: memberEmail, password, name: 'Invited Member' })
      .expect(201);
    const memberLogin = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({ email: memberEmail, password })
      .expect(201);

    await request(httpServer)
      .post('/api/v1/invitations/accept')
      .set(authHeader(memberLogin.body.accessToken))
      .send({ token: invitation.body.token })
      .expect(201);

    const members = await request(httpServer)
      .get(`/api/v1/organizations/${organizationId}/members`)
      .set(authHeader(ownerToken))
      .expect(200);
    const invitedMembership = members.body.find((membership: any) => membership.user.email === memberEmail);
    expect(invitedMembership.role.slug).toBe('member');

    const roleChanged = await request(httpServer)
      .patch(`/api/v1/organizations/${organizationId}/members/${invitedMembership.id}/role`)
      .set(authHeader(ownerToken))
      .send({ role: 'viewer' })
      .expect(200);
    expect(roleChanged.body.role.slug).toBe('viewer');

    const auditLogs = await request(httpServer)
      .get(`/api/v1/organizations/${organizationId}/audit-logs`)
      .set(authHeader(ownerToken))
      .expect(200);
    const actions = auditLogs.body.map((log: any) => log.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'organization.created',
        'api_key.created',
        'billing.checkout_created',
        'billing.subscription_updated',
        'member.invited',
        'member.joined',
        'member.role_updated'
      ])
    );

    const adminLogin = await request(httpServer)
      .post('/api/v1/auth/login')
      .send({
        email: process.env.PLATFORM_ADMIN_EMAIL,
        password: process.env.PLATFORM_ADMIN_PASSWORD
      })
      .expect(201);

    const metrics = await request(httpServer)
      .get('/api/v1/admin/metrics')
      .set(authHeader(adminLogin.body.accessToken))
      .expect(200);
    expect(metrics.body.users).toBeGreaterThanOrEqual(3);
    expect(metrics.body.organizations).toBeGreaterThanOrEqual(2);
    expect(metrics.body.usageEvents).toBeGreaterThanOrEqual(1);
  });
});

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
}
