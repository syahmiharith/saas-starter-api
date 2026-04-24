import { HttpStatus, Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { Request } from 'express';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AppException } from '../common/errors/app.exception';
import { PlanLimitsService } from '../common/services/plan-limits.service';
import { createOpaqueToken, hashSecret } from '../common/utils/crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvitationDto } from './dto/invitations.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly planLimits: PlanLimitsService,
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async create(organizationId: string, dto: CreateInvitationDto, invitedByUserId: string, request: Request) {
    const email = dto.email.toLowerCase();
    const duplicate = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
    if (duplicate) {
      throw new AppException('CONFLICT', 'A pending invitation already exists.', HttpStatus.CONFLICT);
    }

    await this.planLimits.enforceMemberLimit(organizationId);
    const role = await this.prisma.role.findUniqueOrThrow({ where: { slug: dto.role } });
    const rawToken = createOpaqueToken(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email,
        roleId: role.id,
        tokenHash: hashSecret(rawToken),
        expiresAt,
        invitedByUserId
      },
      include: { role: true, organization: true }
    });

    await this.notifications.enqueue({
      type: NotificationType.MEMBER_INVITATION,
      to: email,
      organizationId,
      payload: {
        token: rawToken,
        organizationName: invitation.organization.name,
        role: dto.role,
        expiresAt
      }
    });
    await this.auditLogs.record({
      organizationId,
      actorUserId: invitedByUserId,
      action: 'member.invited',
      resourceType: 'invitation',
      resourceId: invitation.id,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null,
      metadata: { email, role: dto.role }
    });

    return {
      ...invitation,
      token: rawToken
    };
  }

  list(organizationId: string) {
    return this.prisma.invitation.findMany({
      where: { organizationId },
      include: { role: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async revoke(organizationId: string, invitationId: string, actorUserId: string, request: Request) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, organizationId }
    });
    if (!invitation) {
      throw new AppException('RESOURCE_NOT_FOUND', 'Invitation not found.', HttpStatus.NOT_FOUND);
    }
    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() }
    });
    await this.auditLogs.record({
      organizationId,
      actorUserId,
      action: 'member.invitation_revoked',
      resourceType: 'invitation',
      resourceId: invitationId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return { ok: true };
  }

  async accept(rawToken: string, userId: string, request: Request) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash: hashSecret(rawToken) },
      include: { role: true }
    });
    if (!invitation || invitation.revokedAt || invitation.acceptedAt) {
      throw new AppException('RESOURCE_NOT_FOUND', 'Invitation not found.', HttpStatus.NOT_FOUND);
    }
    if (invitation.expiresAt <= new Date()) {
      throw new AppException('INVITATION_EXPIRED', 'Invitation has expired.', HttpStatus.GONE);
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.email !== invitation.email) {
      throw new AppException('FORBIDDEN', 'Invitation email does not match this user.', HttpStatus.FORBIDDEN);
    }

    await this.planLimits.enforceMemberLimit(invitation.organizationId);
    const membership = await this.prisma.membership.create({
      data: {
        userId,
        organizationId: invitation.organizationId,
        roleId: invitation.roleId
      },
      include: { role: true, organization: true }
    });
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() }
    });
    await this.auditLogs.record({
      organizationId: invitation.organizationId,
      actorUserId: userId,
      action: 'member.joined',
      resourceType: 'membership',
      resourceId: membership.id,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return membership;
  }
}
