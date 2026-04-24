import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { HttpStatus } from '@nestjs/common';
import { PlanLimitsService } from '../../src/modules/common/services/plan-limits.service';
import { createApiKeySecret } from '../../src/modules/common/utils/crypto';
import { resetAndSeedDatabase } from '../helpers/database';

describe('PlanLimitsService integration', () => {
  const prisma = new PrismaClient();
  const planLimits = new PlanLimitsService(prisma as any);

  beforeEach(async () => {
    await resetAndSeedDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('blocks a second API key on the free plan before committing', async () => {
    const { organization, user } = await createOrganizationWithOwner(prisma, 'free-limit');
    const generated = createApiKeySecret();
    await prisma.apiKey.create({
      data: {
        organizationId: organization.id,
        name: 'Existing key',
        prefix: generated.prefix,
        keyHash: generated.hash,
        scopes: ['usage:read'],
        createdByUserId: user.id
      }
    });

    await expect(planLimits.enforceApiKeyLimit(organization.id)).rejects.toMatchObject({
      code: 'PLAN_LIMIT_EXCEEDED',
      status: HttpStatus.FORBIDDEN
    });
  });

  it('allows enterprise organizations to exceed finite default limits', async () => {
    const { organization } = await createOrganizationWithOwner(prisma, 'enterprise-limit');
    const enterprisePlan = await prisma.plan.findUniqueOrThrow({ where: { slug: 'enterprise' } });
    await prisma.subscription.create({
      data: {
        organizationId: organization.id,
        planId: enterprisePlan.id,
        status: 'ACTIVE'
      }
    });

    await prisma.usageSummary.create({
      data: {
        organizationId: organization.id,
        feature: 'api_request',
        periodStart: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
        periodEnd: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)),
        quantity: 1_000_000
      }
    });

    await expect(planLimits.enforceApiRequestLimit(organization.id)).resolves.toBeUndefined();
  });
});

async function createOrganizationWithOwner(prisma: PrismaClient, slugSuffix: string) {
  const [ownerRole, freePlan] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { slug: 'owner' } }),
    prisma.plan.findUniqueOrThrow({ where: { slug: 'free' } })
  ]);
  const user = await prisma.user.create({
    data: {
      email: `${slugSuffix}@example.test`,
      passwordHash: await argon2.hash('Password123!')
    }
  });
  const organization = await prisma.organization.create({
    data: {
      name: `Plan Limit ${slugSuffix}`,
      slug: `plan-limit-${slugSuffix}`,
      memberships: {
        create: {
          userId: user.id,
          roleId: ownerRole.id
        }
      },
      subscriptions: {
        create: {
          planId: freePlan.id,
          status: 'ACTIVE'
        }
      }
    }
  });

  return { organization, user };
}
