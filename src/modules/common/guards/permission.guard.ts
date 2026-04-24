import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_METADATA } from '../decorators/require-permission.decorator';
import { AppException } from '../errors/app.exception';
import { AuthenticatedRequest } from '../types/request.types';
import { RbacService } from '../services/rbac.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService
  ) {}

  async canActivate(context: ExecutionContext) {
    const permission = this.reflector.getAllAndOverride<string>(PERMISSION_METADATA, [
      context.getHandler(),
      context.getClass()
    ]);

    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organizationId = String(request.params.orgId ?? request.params.organizationId ?? '');
    if (!organizationId) {
      throw new AppException('FORBIDDEN', 'Organization context is required.', HttpStatus.FORBIDDEN);
    }

    const allowed = await this.rbac.can(request.user.id, permission, organizationId);
    if (!allowed) {
      throw new AppException('FORBIDDEN', 'You do not have permission for this action.', HttpStatus.FORBIDDEN, {
        permission,
        organizationId
      });
    }

    return true;
  }
}
