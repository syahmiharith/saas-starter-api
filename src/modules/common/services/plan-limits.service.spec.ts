import { HttpStatus } from '@nestjs/common';
import { PlanLimitsService } from './plan-limits.service';

describe('PlanLimitsService', () => {
  it('throws a plan limit error before exceeding API keys', async () => {
    const prisma = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          plan: {
            slug: 'free',
            apiKeyLimit: 1,
            memberLimit: 1,
            apiRequestLimit: 1000,
            auditRetentionDays: 7
          }
        })
      },
      plan: { findUniqueOrThrow: jest.fn() },
      apiKey: { count: jest.fn().mockResolvedValue(1) },
      membership: { count: jest.fn() },
      usageSummary: { findUnique: jest.fn() }
    };
    const service = new PlanLimitsService(prisma as any);

    await expect(service.enforceApiKeyLimit('org_1')).rejects.toMatchObject({
      code: 'PLAN_LIMIT_EXCEEDED',
      status: HttpStatus.FORBIDDEN
    });
  });

  it('allows unlimited enterprise limits', async () => {
    const prisma = {
      subscription: {
        findFirst: jest.fn().mockResolvedValue({
          plan: {
            slug: 'enterprise',
            apiKeyLimit: null,
            memberLimit: null,
            apiRequestLimit: null,
            auditRetentionDays: null
          }
        })
      },
      plan: { findUniqueOrThrow: jest.fn() },
      apiKey: { count: jest.fn().mockResolvedValue(999) },
      membership: { count: jest.fn() },
      usageSummary: { findUnique: jest.fn() }
    };
    const service = new PlanLimitsService(prisma as any);

    await expect(service.enforceApiKeyLimit('org_1')).resolves.toBeUndefined();
  });
});

