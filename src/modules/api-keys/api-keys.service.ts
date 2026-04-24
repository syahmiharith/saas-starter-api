import { HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { API_KEY_SCOPES } from '../common/constants/api-key-scopes';
import { AppException } from '../common/errors/app.exception';
import { PlanLimitsService } from '../common/services/plan-limits.service';
import { createApiKeySecret } from '../common/utils/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/api-keys.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async create(organizationId: string, dto: CreateApiKeyDto, createdByUserId: string, request: Request) {
    await this.planLimits.enforceApiKeyLimit(organizationId);
    const generated = createApiKeySecret();
    const apiKey = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name: dto.name,
        prefix: generated.prefix,
        keyHash: generated.hash,
        scopes: dto.scopes?.length ? dto.scopes : [...API_KEY_SCOPES],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdByUserId
      }
    });

    await this.auditLogs.record({
      organizationId,
      actorUserId: createdByUserId,
      action: 'api_key.created',
      resourceType: 'api_key',
      resourceId: apiKey.id,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null,
      metadata: { prefix: generated.prefix }
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      secret: generated.secret
    };
  }

  list(organizationId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        revokedAt: true,
        expiresAt: true,
        createdAt: true,
        createdBy: { select: { id: true, email: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async revoke(organizationId: string, apiKeyId: string, actorUserId: string, request: Request) {
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, organizationId }
    });
    if (!apiKey) {
      throw new AppException('RESOURCE_NOT_FOUND', 'API key not found.', HttpStatus.NOT_FOUND);
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() }
    });
    await this.auditLogs.record({
      organizationId,
      actorUserId,
      action: 'api_key.revoked',
      resourceType: 'api_key',
      resourceId: apiKeyId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return { ok: true };
  }
}

