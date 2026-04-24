import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS } from '../../src/modules/common/constants/permissions';
import { RbacService } from '../../src/modules/common/services/rbac.service';
import { resetAndSeedDatabase } from '../helpers/database';

describe('RbacService integration', () => {
  const prisma = new PrismaClient();
  const rbac = new RbacService(prisma as any);

  beforeAll(async () => {
    await resetAndSeedDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('evaluates seeded role permissions against real memberships', async () => {
    const [ownerRole, memberRole, freePlan] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { slug: 'owner' } }),
      prisma.role.findUniqueOrThrow({ where: { slug: 'member' } }),
      prisma.plan.findUniqueOrThrow({ where: { slug: 'free' } })
    ]);

    const owner = await createUser(prisma, 'owner.integration@example.test');
    const member = await createUser(prisma, 'member.integration@example.test');
    const outsider = await createUser(prisma, 'outsider.integration@example.test');
    const organization = await prisma.organization.create({
      data: {
        name: 'RBAC Integration Org',
        slug: 'rbac-integration-org',
        memberships: {
          create: [
            { userId: owner.id, roleId: ownerRole.id },
            { userId: member.id, roleId: memberRole.id }
          ]
        },
        subscriptions: {
          create: {
            planId: freePlan.id,
            status: 'ACTIVE'
          }
        }
      }
    });

    await expect(rbac.can(owner.id, PERMISSIONS.BILLING_MANAGE, organization.id)).resolves.toBe(true);
    await expect(rbac.can(member.id, PERMISSIONS.BILLING_MANAGE, organization.id)).resolves.toBe(false);
    await expect(rbac.can(member.id, PERMISSIONS.USAGE_READ, organization.id)).resolves.toBe(true);
    await expect(rbac.can(outsider.id, PERMISSIONS.ORGANIZATION_READ, organization.id)).resolves.toBe(false);
  });
});

async function createUser(prisma: PrismaClient, email: string) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash('Password123!')
    }
  });
}
