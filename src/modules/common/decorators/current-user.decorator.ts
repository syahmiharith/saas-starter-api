import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest } from '../types/request.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthenticatedRequest>().user
);

