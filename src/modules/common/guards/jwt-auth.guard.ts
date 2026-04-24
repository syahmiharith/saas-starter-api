import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../errors/app.exception';
import { AuthenticatedRequest } from '../types/request.types';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

    if (!token) {
      throw new AppException('UNAUTHENTICATED', 'Missing bearer token.', HttpStatus.UNAUTHORIZED);
    }

    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET')
      });
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || user.suspendedAt) {
        throw new AppException('UNAUTHENTICATED', 'User is not active.', HttpStatus.UNAUTHORIZED);
      }
      request.user = {
        id: user.id,
        email: user.email,
        platformRole: user.platformRole
      };
      return true;
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      throw new AppException('UNAUTHENTICATED', 'Invalid or expired bearer token.', HttpStatus.UNAUTHORIZED);
    }
  }
}

