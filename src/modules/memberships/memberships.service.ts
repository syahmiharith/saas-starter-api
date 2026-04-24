import { HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  list(organizationId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        role: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async updateRole(
    organizationId: string,
    membershipId: string,
    roleSlug: string,
    actorUserId: string,
    request: Request
  ) {
    const membership = await this.getMembership(organizationId, membershipId);
    if (membership.role.slug === 'owner' && roleSlug !== 'owner') {
      await this.ensureNotLastOwner(organizationId, membership.userId);
    }

    const role = await this.prisma.role.findUniqueOrThrow({ where: { slug: roleSlug } });
    const updated = await this.prisma.membership.update({
      where: { id: membershipId },
      data: { roleId: role.id },
      include: { role: true, user: { select: { id: true, email: true, name: true } } }
    });

    await this.auditLogs.record({
      organizationId,
      actorUserId,
      action: 'member.role_updated',
      resourceType: 'membership',
      resourceId: membershipId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null,
      metadata: { role: roleSlug }
    });
    return updated;
  }

  async remove(organizationId: string, membershipId: string, actorUserId: string, request: Request) {
    const membership = await this.getMembership(organizationId, membershipId);
    if (membership.role.slug === 'owner') {
      await this.ensureNotLastOwner(organizationId, membership.userId);
    }

    await this.prisma.membership.delete({ where: { id: membershipId } });
    await this.auditLogs.record({
      organizationId,
      actorUserId,
      action: 'member.removed',
      resourceType: 'membership',
      resourceId: membershipId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return { ok: true };
  }

  private async getMembership(organizationId: string, membershipId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
      include: { role: true }
    });
    if (!membership) {
      throw new AppException('RESOURCE_NOT_FOUND', 'Membership not found.', HttpStatus.NOT_FOUND);
    }
    return membership;
  }

  private async ensureNotLastOwner(organizationId: string, targetUserId: string) {
    const ownerCount = await this.prisma.membership.count({
      where: { organizationId, role: { slug: 'owner' } }
    });
    const target = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: targetUserId,
          organizationId
        }
      },
      include: { role: true }
    });
    if (target?.role.slug === 'owner' && ownerCount <= 1) {
      throw new AppException(
        'FORBIDDEN',
        'An organization must always have at least one owner.',
        HttpStatus.FORBIDDEN
      );
    }
  }
}

