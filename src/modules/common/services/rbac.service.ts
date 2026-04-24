import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async can(userId: string, permission: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId
        }
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    });

    if (!membership) {
      return false;
    }

    return membership.role.rolePermissions.some(
      (rolePermission) => rolePermission.permission.name === permission
    );
  }
}

