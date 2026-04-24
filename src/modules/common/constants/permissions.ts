export const PERMISSIONS = {
  ORGANIZATION_READ: 'organization.read',
  ORGANIZATION_UPDATE: 'organization.update',
  ORGANIZATION_DELETE: 'organization.delete',
  MEMBERS_READ: 'members.read',
  MEMBERS_INVITE: 'members.invite',
  MEMBERS_REMOVE: 'members.remove',
  MEMBERS_ROLE_UPDATE: 'members.role.update',
  BILLING_READ: 'billing.read',
  BILLING_MANAGE: 'billing.manage',
  API_KEYS_CREATE: 'api_keys.create',
  API_KEYS_READ: 'api_keys.read',
  API_KEYS_REVOKE: 'api_keys.revoke',
  USAGE_READ: 'usage.read',
  AUDIT_LOGS_READ: 'audit_logs.read'
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSION_MATRIX: Record<string, PermissionName[]> = {
  owner: Object.values(PERMISSIONS),
  admin: [
    PERMISSIONS.ORGANIZATION_READ,
    PERMISSIONS.ORGANIZATION_UPDATE,
    PERMISSIONS.MEMBERS_READ,
    PERMISSIONS.MEMBERS_INVITE,
    PERMISSIONS.MEMBERS_REMOVE,
    PERMISSIONS.API_KEYS_CREATE,
    PERMISSIONS.API_KEYS_READ,
    PERMISSIONS.API_KEYS_REVOKE,
    PERMISSIONS.USAGE_READ,
    PERMISSIONS.AUDIT_LOGS_READ
  ],
  member: [PERMISSIONS.ORGANIZATION_READ, PERMISSIONS.MEMBERS_READ, PERMISSIONS.USAGE_READ],
  viewer: [PERMISSIONS.ORGANIZATION_READ, PERMISSIONS.MEMBERS_READ]
};

