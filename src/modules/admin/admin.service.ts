import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        suspendedAt: true,
        platformRole: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  getUser(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        suspendedAt: true,
        platformRole: true,
        memberships: {
          include: {
            role: true,
            organization: true
          }
        }
      }
    });
  }

  async suspendUser(userId: string, actorUserId: string, request: Request) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: new Date() }
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() }
    });
    await this.auditLogs.record({
      actorUserId,
      action: 'admin.user_suspended',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return { id: user.id, suspendedAt: user.suspendedAt };
  }

  async unsuspendUser(userId: string, actorUserId: string, request: Request) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: null }
    });
    await this.auditLogs.record({
      actorUserId,
      action: 'admin.user_unsuspended',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return { id: user.id, suspendedAt: user.suspendedAt };
  }

  listOrganizations() {
    return this.prisma.organization.findMany({
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true }
        },
        _count: { select: { memberships: true, apiKeys: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  async metrics() {
    const [users, activeUsers, organizations, activeSubscriptions, apiKeys, usageEvents] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { suspendedAt: null } }),
        this.prisma.organization.count({ where: { deletedAt: null } }),
        this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
        this.prisma.apiKey.count({ where: { revokedAt: null } }),
        this.prisma.usageEvent.count()
      ]);

    return {
      users,
      activeUsers,
      organizations,
      activeSubscriptions,
      apiKeys,
      usageEvents
    };
  }
}

