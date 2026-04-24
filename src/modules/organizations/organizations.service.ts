import { HttpStatus, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PLAN_LIMITS } from '../common/constants/plans';
import { AppException } from '../common/errors/app.exception';
import { uniqueSlug } from '../common/utils/slug';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organizations.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async create(userId: string, dto: CreateOrganizationDto, request: Request) {
    const ownerRole = await this.prisma.role.findUniqueOrThrow({ where: { slug: 'owner' } });
    const freePlan = await this.ensureFreePlan();
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: uniqueSlug(dto.name),
        memberships: {
          create: {
            userId,
            roleId: ownerRole.id
          }
        },
        subscriptions: {
          create: {
            planId: freePlan.id,
            status: 'ACTIVE'
          }
        }
      },
      include: { memberships: true, subscriptions: { include: { plan: true } } }
    });

    await this.auditLogs.record({
      organizationId: organization.id,
      actorUserId: userId,
      action: 'organization.created',
      resourceType: 'organization',
      resourceId: organization.id,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return organization;
  }

  listForUser(userId: string) {
    return this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        memberships: { some: { userId } }
      },
      include: {
        memberships: {
          where: { userId },
          include: { role: true }
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async get(organizationId: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true }
        }
      }
    });
    if (!organization) {
      throw new AppException('RESOURCE_NOT_FOUND', 'Organization not found.', HttpStatus.NOT_FOUND);
    }
    return organization;
  }

  async update(organizationId: string, actorUserId: string, dto: UpdateOrganizationDto, request: Request) {
    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: { name: dto.name },
    });
    await this.auditLogs.record({
      organizationId,
      actorUserId,
      action: 'organization.updated',
      resourceType: 'organization',
      resourceId: organizationId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return organization;
  }

  async softDelete(organizationId: string, actorUserId: string, request: Request) {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { deletedAt: new Date() }
    });
    await this.auditLogs.record({
      organizationId,
      actorUserId,
      action: 'organization.deleted',
      resourceType: 'organization',
      resourceId: organizationId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return { ok: true };
  }

  private ensureFreePlan() {
    const limits = PLAN_LIMITS.free;
    return this.prisma.plan.upsert({
      where: { slug: 'free' },
      update: {},
      create: {
        slug: 'free',
        name: limits.name,
        memberLimit: limits.memberLimit,
        apiRequestLimit: limits.apiRequestLimit,
        apiKeyLimit: limits.apiKeyLimit,
        auditRetentionDays: limits.auditRetentionDays
      }
    });
  }
}

