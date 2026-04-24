import { HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        platformRole: true,
        memberships: {
          select: {
            id: true,
            organizationId: true,
            role: { select: { slug: true, name: true } },
            organization: { select: { id: true, name: true, slug: true } }
          }
        }
      }
    });
    return user;
  }

  updateMe(userId: string, dto: UpdateMeDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true
      }
    });
  }

  async deleteMe(userId: string) {
    const ownerMemberships = await this.prisma.membership.findMany({
      where: { userId, role: { slug: 'owner' } },
      include: { organization: true }
    });

    for (const membership of ownerMemberships) {
      const ownerCount = await this.prisma.membership.count({
        where: { organizationId: membership.organizationId, role: { slug: 'owner' } }
      });
      if (ownerCount === 1) {
        throw new AppException(
          'FORBIDDEN',
          'Transfer ownership before deleting this account.',
          HttpStatus.FORBIDDEN,
          { organizationId: membership.organizationId }
        );
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@deleted.local`,
        name: null,
        suspendedAt: new Date()
      }
    });
    return { ok: true };
  }
}

