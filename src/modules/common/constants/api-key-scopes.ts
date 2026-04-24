export const API_KEY_SCOPES = ['usage:read', 'usage:write', 'organization:read'] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

