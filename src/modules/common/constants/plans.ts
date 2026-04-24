export type PlanSlug = 'free' | 'pro' | 'team' | 'enterprise';

export type PlanLimitKey = 'memberLimit' | 'apiRequestLimit' | 'apiKeyLimit' | 'auditRetentionDays';

export const PLAN_LIMITS: Record<
  PlanSlug,
  {
    name: string;
    memberLimit: number | null;
    apiRequestLimit: number | null;
    apiKeyLimit: number | null;
    auditRetentionDays: number | null;
  }
> = {
  free: {
    name: 'Free',
    memberLimit: 1,
    apiRequestLimit: 1000,
    apiKeyLimit: 1,
    auditRetentionDays: 7
  },
  pro: {
    name: 'Pro',
    memberLimit: 3,
    apiRequestLimit: 10000,
    apiKeyLimit: 3,
    auditRetentionDays: 30
  },
  team: {
    name: 'Team',
    memberLimit: 10,
    apiRequestLimit: 100000,
    apiKeyLimit: 10,
    auditRetentionDays: 90
  },
  enterprise: {
    name: 'Enterprise',
    memberLimit: null,
    apiRequestLimit: null,
    apiKeyLimit: null,
    auditRetentionDays: null
  }
};

