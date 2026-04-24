import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { API_KEY_SCOPES } from '../constants/api-key-scopes';
import { AppException } from '../errors/app.exception';
import { ApiKeyRequest } from '../types/request.types';
import { hashSecret } from '../utils/crypto';
import { currentMonthlyPeriod } from '../utils/period';
import { PlanLimitsService } from '../services/plan-limits.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();
    const rawKey = request.header('x-api-key');
    const organizationId = request.params.orgId ?? request.params.organizationId;

    if (!rawKey || !organizationId) {
      throw new AppException('UNAUTHENTICATED', 'Missing API key.', HttpStatus.UNAUTHORIZED);
    }

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash: hashSecret(rawKey) }
    });

    if (!apiKey || apiKey.organizationId !== organizationId) {
      throw new AppException('UNAUTHENTICATED', 'Invalid API key.', HttpStatus.UNAUTHORIZED);
    }

    if (apiKey.revokedAt) {
      throw new AppException('API_KEY_REVOKED', 'API key has been revoked.', HttpStatus.FORBIDDEN);
    }

    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
      throw new AppException('API_KEY_REVOKED', 'API key has expired.', HttpStatus.FORBIDDEN);
    }

    await this.planLimits.enforceApiRequestLimit(organizationId);

    const scopes = Array.isArray(apiKey.scopes) ? (apiKey.scopes as string[]) : [...API_KEY_SCOPES];
    request.apiKey = {
      id: apiKey.id,
      organizationId: apiKey.organizationId,
      scopes
    };

    const { periodStart, periodEnd } = currentMonthlyPeriod();
    await this.prisma.$transaction([
      this.prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() }
      }),
      this.prisma.usageEvent.create({
        data: {
          organizationId,
          apiKeyId: apiKey.id,
          feature: 'api_request',
          quantity: 1
        }
      }),
      this.prisma.usageSummary.upsert({
        where: {
          organizationId_feature_periodStart: {
            organizationId,
            feature: 'api_request',
            periodStart
          }
        },
        update: { quantity: { increment: 1 } },
        create: {
          organizationId,
          feature: 'api_request',
          periodStart,
          periodEnd,
          quantity: 1
        }
      })
    ]);

    return true;
  }
}

