import { Request } from 'express';

export type AuthUser = {
  id: string;
  email: string;
  platformRole: string | null;
};

export type AuthenticatedRequest = Request & {
  user: AuthUser;
};

export type ApiKeyPrincipal = {
  id: string;
  organizationId: string;
  scopes: string[];
};

export type ApiKeyRequest = Request & {
  apiKey: ApiKeyPrincipal;
};

