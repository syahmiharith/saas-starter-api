import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NotificationType, OneTimeTokenType } from '@prisma/client';
import * as argon2 from 'argon2';
import { Request } from 'express';
import { PLAN_LIMITS } from '../common/constants/plans';
import { AppException } from '../common/errors/app.exception';
import { createJti, createOpaqueToken, hashSecret } from '../common/utils/crypto';
import { uniqueSlug } from '../common/utils/slug';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly auditLogs: AuditLogsService
  ) {}

  async register(dto: RegisterDto, request: Request) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppException('CONFLICT', 'A user with this email already exists.', HttpStatus.CONFLICT);
    }

    const ownerRole = await this.ensureRole('owner');
    const freePlan = await this.ensurePlan('free');
    const organizationName = dto.organizationName || `${dto.name || email}'s Workspace`;

    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        passwordHash: await argon2.hash(dto.password),
        memberships: {
          create: {
            role: { connect: { id: ownerRole.id } },
            organization: {
              create: {
                name: organizationName,
                slug: uniqueSlug(organizationName),
                subscriptions: {
                  create: {
                    plan: { connect: { id: freePlan.id } },
                    status: 'ACTIVE'
                  }
                }
              }
            }
          }
        }
      },
      include: {
        memberships: {
          include: { organization: true, role: true }
        }
      }
    });

    const defaultOrganization = user.memberships[0].organization;
    await this.createOneTimeToken(user.id, OneTimeTokenType.EMAIL_VERIFICATION, user.email, {
      type: NotificationType.EMAIL_VERIFICATION,
      organizationId: defaultOrganization.id
    });
    await this.auditLogs.record({
      organizationId: defaultOrganization.id,
      actorUserId: user.id,
      action: 'organization.created',
      resourceType: 'organization',
      resourceId: defaultOrganization.id,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });

    const tokens = this.publicTokenPair(await this.createTokenPair(user.id, user.email));
    return {
      user: this.publicUser(user),
      defaultOrganization,
      ...tokens
    };
  }

  async login(dto: LoginDto, request: Request) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() }
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new AppException('UNAUTHENTICATED', 'Invalid email or password.', HttpStatus.UNAUTHORIZED);
    }

    if (user.suspendedAt) {
      throw new AppException('FORBIDDEN', 'This account is suspended.', HttpStatus.FORBIDDEN);
    }

    await this.auditLogs.record({
      actorUserId: user.id,
      action: 'auth.login',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });

    return {
      user: this.publicUser(user),
      ...this.publicTokenPair(await this.createTokenPair(user.id, user.email))
    };
  }

  async refresh(refreshToken: string, request: Request) {
    const tokenHash = hashSecret(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!stored) {
      throw new AppException('UNAUTHENTICATED', 'Invalid refresh token.', HttpStatus.UNAUTHORIZED);
    }

    if (stored.revokedAt || stored.replacedByTokenId) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId },
        data: { revokedAt: new Date() }
      });
      await this.auditLogs.record({
        actorUserId: stored.userId,
        action: 'auth.refresh_reuse_detected',
        resourceType: 'refresh_token',
        resourceId: stored.id,
        ipAddress: request.ip,
        userAgent: request.header('user-agent') ?? null
      });
      throw new AppException(
        'TOKEN_REUSE_DETECTED',
        'Refresh token reuse detected. Token family revoked.',
        HttpStatus.UNAUTHORIZED
      );
    }

    if (stored.expiresAt <= new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() }
      });
      throw new AppException('UNAUTHENTICATED', 'Refresh token expired.', HttpStatus.UNAUTHORIZED);
    }

    if (stored.user.suspendedAt) {
      throw new AppException('FORBIDDEN', 'This account is suspended.', HttpStatus.FORBIDDEN);
    }

    const tokens = await this.createTokenPair(stored.userId, stored.user.email, stored.familyId);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: tokens.refreshTokenId
      }
    });

    return this.publicTokenPair(tokens);
  }

  async logout(userId: string, refreshToken: string | undefined, request: Request) {
    if (refreshToken) {
      const stored = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: hashSecret(refreshToken) }
      });
      if (stored && stored.userId === userId) {
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId },
          data: { revokedAt: new Date() }
        });
      }
    }

    await this.auditLogs.record({
      actorUserId: userId,
      action: 'auth.logout',
      resourceType: 'user',
      resourceId: userId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return { ok: true };
  }

  async requestEmailVerification(emailInput: string) {
    const email = emailInput.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerifiedAt) {
      await this.createOneTimeToken(user.id, OneTimeTokenType.EMAIL_VERIFICATION, email, {
        type: NotificationType.EMAIL_VERIFICATION
      });
    }
    return { ok: true };
  }

  async verifyEmail(rawToken: string) {
    const token = await this.findValidOneTimeToken(rawToken, OneTimeTokenType.EMAIL_VERIFICATION);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: new Date() }
      }),
      this.prisma.oneTimeToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() }
      })
    ]);
    return { ok: true };
  }

  async requestPasswordReset(emailInput: string) {
    const email = emailInput.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      await this.createOneTimeToken(user.id, OneTimeTokenType.PASSWORD_RESET, email, {
        type: NotificationType.PASSWORD_RESET
      });
    }
    return { ok: true };
  }

  async resetPassword(rawToken: string, password: string, request: Request) {
    const token = await this.findValidOneTimeToken(rawToken, OneTimeTokenType.PASSWORD_RESET);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash: await argon2.hash(password) }
      }),
      this.prisma.oneTimeToken.update({
        where: { id: token.id },
        data: { consumedAt: new Date() }
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: token.userId },
        data: { revokedAt: new Date() }
      })
    ]);
    await this.auditLogs.record({
      actorUserId: token.userId,
      action: 'user.password_changed',
      resourceType: 'user',
      resourceId: token.userId,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null
    });
    return { ok: true };
  }

  private async createTokenPair(userId: string, email: string, existingFamilyId?: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m') as any
      }
    );

    const rawRefreshToken = createOpaqueToken(48);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30));

    const stored = await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId: existingFamilyId ?? createJti(),
        jti: createJti(),
        tokenHash: hashSecret(rawRefreshToken),
        expiresAt
      }
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      refreshTokenId: stored.id,
      tokenType: 'Bearer',
      expiresIn: this.config.get<string>('JWT_ACCESS_TTL', '15m')
    };
  }

  private async createOneTimeToken(
    userId: string,
    type: OneTimeTokenType,
    to: string,
    notification: { type: NotificationType; organizationId?: string }
  ) {
    const rawToken = createOpaqueToken(32);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    await this.prisma.oneTimeToken.create({
      data: {
        userId,
        type,
        tokenHash: hashSecret(rawToken),
        expiresAt
      }
    });

    await this.notifications.enqueue({
      type: notification.type,
      to,
      userId,
      organizationId: notification.organizationId,
      payload: {
        token: rawToken,
        expiresAt
      }
    });
  }

  private async findValidOneTimeToken(rawToken: string, type: OneTimeTokenType) {
    const token = await this.prisma.oneTimeToken.findUnique({
      where: { tokenHash: hashSecret(rawToken) }
    });

    if (!token || token.type !== type || token.consumedAt) {
      throw new AppException('RESOURCE_NOT_FOUND', 'Token was not found.', HttpStatus.NOT_FOUND);
    }

    if (token.expiresAt <= new Date()) {
      throw new AppException('INVITATION_EXPIRED', 'Token has expired.', HttpStatus.GONE);
    }

    return token;
  }

  private publicUser(user: { id: string; email: string; name: string | null; emailVerifiedAt: Date | null }) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerifiedAt: user.emailVerifiedAt
    };
  }

  private publicTokenPair(tokens: Awaited<ReturnType<AuthService['createTokenPair']>>) {
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenType: tokens.tokenType,
      expiresIn: tokens.expiresIn
    };
  }

  private async ensureRole(slug: string) {
    return this.prisma.role.upsert({
      where: { slug },
      update: {},
      create: { slug, name: slug[0].toUpperCase() + slug.slice(1) }
    });
  }

  private async ensurePlan(slug: 'free') {
    const limits = PLAN_LIMITS[slug];
    return this.prisma.plan.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name: limits.name,
        memberLimit: limits.memberLimit,
        apiRequestLimit: limits.apiRequestLimit,
        apiKeyLimit: limits.apiKeyLimit,
        auditRetentionDays: limits.auditRetentionDays
      }
    });
  }
}
