import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { ROLE_PERMISSION_MATRIX } from '../../src/modules/common/constants/permissions';
import { PLAN_LIMITS, PlanSlug } from '../../src/modules/common/constants/plans';

export async function resetDatabase(prisma: PrismaClient) {
  await prisma.$transaction([
    prisma.usageEvent.deleteMany(),
    prisma.usageSummary.deleteMany(),
    prisma.apiKey.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.notificationEvent.deleteMany(),
    prisma.webhookEvent.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.oneTimeToken.deleteMany(),
    prisma.invitation.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.user.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
    prisma.plan.deleteMany()
  ]);
}

export async function seedReferenceData(prisma: PrismaClient) {
  const permissions = Array.from(new Set(Object.values(ROLE_PERMISSION_MATRIX).flat()));

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission },
      update: {},
      create: { name: permission }
    });
  }

  for (const [slug, grantedPermissions] of Object.entries(ROLE_PERMISSION_MATRIX)) {
    const role = await prisma.role.upsert({
      where: { slug },
      update: { name: titleCase(slug) },
      create: { slug, name: titleCase(slug) }
    });

    for (const permissionName of grantedPermissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { name: permissionName }
      });
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id
        }
      });
    }
  }

  for (const slug of Object.keys(PLAN_LIMITS) as PlanSlug[]) {
    const limits = PLAN_LIMITS[slug];
    await prisma.plan.upsert({
      where: { slug },
      update: {
        name: limits.name,
        memberLimit: limits.memberLimit,
        apiRequestLimit: limits.apiRequestLimit,
        apiKeyLimit: limits.apiKeyLimit,
        auditRetentionDays: limits.auditRetentionDays,
        stripePriceId: process.env[`STRIPE_PRICE_${slug.toUpperCase()}`] || null
      },
      create: {
        slug,
        name: limits.name,
        memberLimit: limits.memberLimit,
        apiRequestLimit: limits.apiRequestLimit,
        apiKeyLimit: limits.apiKeyLimit,
        auditRetentionDays: limits.auditRetentionDays,
        stripePriceId: process.env[`STRIPE_PRICE_${slug.toUpperCase()}`] || null
      }
    });
  }

  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase();
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { platformRole: 'admin' },
      create: {
        email: adminEmail,
        name: 'Platform Admin',
        passwordHash: await argon2.hash(adminPassword),
        platformRole: 'admin',
        emailVerifiedAt: new Date()
      }
    });
  }
}

export async function resetAndSeedDatabase(prisma: PrismaClient) {
  await resetDatabase(prisma);
  await seedReferenceData(prisma);
}

function titleCase(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}
