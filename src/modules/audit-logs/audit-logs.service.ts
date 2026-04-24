import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditLogInput = {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditLogInput) {
    return this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: input.metadata as Prisma.InputJsonValue | undefined
      }
    });
  }

  async listForOrganization(organizationId: string) {
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }
}
