import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const permissions = [
  'organization.read',
  'organization.update',
  'organization.delete',
  'members.read',
  'members.invite',
  'members.remove',
  'members.role.update',
  'billing.read',
  'billing.manage',
  'api_keys.create',
  'api_keys.read',
  'api_keys.revoke',
  'usage.read',
  'audit_logs.read'
];

const rolePermissions: Record<string, string[]> = {
  owner: permissions,
  admin: [
    'organization.read',
    'organization.update',
    'members.read',
    'members.invite',
    'members.remove',
    'api_keys.create',
    'api_keys.read',
    'api_keys.revoke',
    'usage.read',
    'audit_logs.read'
  ],
  member: ['organization.read', 'members.read', 'usage.read'],
  viewer: ['organization.read', 'members.read']
};

const plans = [
  {
    slug: 'free',
    name: 'Free',
    memberLimit: 1,
    apiRequestLimit: 1000,
    apiKeyLimit: 1,
    auditRetentionDays: 7,
    stripePriceId: process.env.STRIPE_PRICE_FREE || null
  },
  {
    slug: 'pro',
    name: 'Pro',
    memberLimit: 3,
    apiRequestLimit: 10000,
    apiKeyLimit: 3,
    auditRetentionDays: 30,
    stripePriceId: process.env.STRIPE_PRICE_PRO || null
  },
  {
    slug: 'team',
    name: 'Team',
    memberLimit: 10,
    apiRequestLimit: 100000,
    apiKeyLimit: 10,
    auditRetentionDays: 90,
    stripePriceId: process.env.STRIPE_PRICE_TEAM || null
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    memberLimit: null,
    apiRequestLimit: null,
    apiKeyLimit: null,
    auditRetentionDays: null,
    stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE || null
  }
];

async function main() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission },
      update: {},
      create: { name: permission }
    });
  }

  for (const [slug, grantedPermissions] of Object.entries(rolePermissions)) {
    const role = await prisma.role.upsert({
      where: { slug },
      update: { name: slug[0].toUpperCase() + slug.slice(1) },
      create: { slug, name: slug[0].toUpperCase() + slug.slice(1) }
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

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan
    });
  }

  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL?.toLowerCase();
  if (adminEmail) {
    const password = process.env.PLATFORM_ADMIN_PASSWORD || 'ChangeMe123!';
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { platformRole: 'admin' },
      create: {
        email: adminEmail,
        name: 'Platform Admin',
        passwordHash: await argon2.hash(password),
        emailVerifiedAt: new Date(),
        platformRole: 'admin'
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

