import { Injectable } from '@nestjs/common';
import { PlanLimitsService } from '../common/services/plan-limits.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService
  ) {}

  async getUsage(organizationId: string) {
    const plan = await this.planLimits.getActivePlan(organizationId);
    const summaries = await this.prisma.usageSummary.findMany({
      where: { organizationId },
      orderBy: { periodStart: 'desc' }
    });
    const memberCount = await this.prisma.membership.count({ where: { organizationId } });
    const apiKeyCount = await this.prisma.apiKey.count({ where: { organizationId, revokedAt: null } });

    return {
      plan: plan.slug,
      limits: {
        members: plan.memberLimit,
        apiRequests: plan.apiRequestLimit,
        apiKeys: plan.apiKeyLimit,
        auditRetentionDays: plan.auditRetentionDays
      },
      usage: {
        members: memberCount,
        apiKeys: apiKeyCount,
        apiRequests:
          summaries.find((summary) => summary.feature === 'api_request')?.quantity ?? 0
      },
      summaries
    };
  }

  trackApiKeyDemoEvent(organizationId: string, feature: string) {
    return {
      ok: true,
      organizationId,
      feature,
      note: 'API-key-authenticated request was counted by the API key guard.'
    };
  }
}

