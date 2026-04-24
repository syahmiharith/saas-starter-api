import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'TOKEN_REUSE_DETECTED'
  | 'PLAN_LIMIT_EXCEEDED'
  | 'INVITATION_EXPIRED'
  | 'API_KEY_REVOKED'
  | 'WEBHOOK_ALREADY_PROCESSED'
  | 'CONFLICT';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus,
    public readonly details: Record<string, unknown> = {}
  ) {
    super({ error: { code, message, details } }, status);
  }
}

