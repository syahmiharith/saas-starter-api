import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { AppException } from '../errors/app.exception';
import { AuthenticatedRequest } from '../types/request.types';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user.platformRole !== 'admin') {
      throw new AppException('FORBIDDEN', 'Platform admin access is required.', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}

