import { HttpStatus, Injectable } from '@nestjs/common';
import { PLAN_LIMITS, PlanLimitKey, PlanSlug } from '../constants/plans';
import { AppException } from '../errors/app.exception';
import { currentMonthlyPeriod } from '../utils/period';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlanLimitsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivePlan(organizationId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true }
    });

    if (subscription) {
      return subscription.plan;
    }

    return this.prisma.plan.findUniqueOrThrow({ where: { slug: 'free' } });
  }

  async enforceMemberLimit(organizationId: string) {
    await this.enforceCountLimit({
      organizationId,
      limitKey: 'memberLimit',
      current: await this.prisma.membership.count({ where: { organizationId } }),
      message: 'Your current plan does not allow more members.'
    });
  }

  async enforceApiKeyLimit(organizationId: string) {
    await this.enforceCountLimit({
      organizationId,
      limitKey: 'apiKeyLimit',
      current: await this.prisma.apiKey.count({
        where: { organizationId, revokedAt: null }
      }),
      message: 'Your current plan does not allow more API keys.'
    });
  }

  async enforceApiRequestLimit(organizationId: string, quantity = 1) {
    const { periodStart } = currentMonthlyPeriod();
    const summary = await this.prisma.usageSummary.findUnique({
      where: {
        organizationId_feature_periodStart: {
          organizationId,
          feature: 'api_request',
          periodStart
        }
      }
    });

    await this.enforceCountLimit({
      organizationId,
      limitKey: 'apiRequestLimit',
      current: (summary?.quantity ?? 0) + quantity - 1,
      increment: quantity,
      message: 'Your current plan does not allow more API requests.'
    });
  }

  private async enforceCountLimit({
    organizationId,
    limitKey,
    current,
    increment = 1,
    message
  }: {
    organizationId: string;
    limitKey: PlanLimitKey;
    current: number;
    increment?: number;
    message: string;
  }) {
    const plan = await this.getActivePlan(organizationId);
    const slug = plan.slug as PlanSlug;
    const limit = PLAN_LIMITS[slug]?.[limitKey] ?? plan[limitKey];

    if (limit !== null && current + increment > limit) {
      throw new AppException('PLAN_LIMIT_EXCEEDED', message, HttpStatus.FORBIDDEN, {
        plan: plan.slug,
        limit,
        current
      });
    }
  }
}

