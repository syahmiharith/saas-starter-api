import { PERMISSIONS, ROLE_PERMISSION_MATRIX } from './permissions';

describe('RBAC matrix', () => {
  it('grants owners all permissions', () => {
    expect(ROLE_PERMISSION_MATRIX.owner).toEqual(Object.values(PERMISSIONS));
  });

  it('keeps billing management owner-only', () => {
    expect(ROLE_PERMISSION_MATRIX.owner).toContain(PERMISSIONS.BILLING_MANAGE);
    expect(ROLE_PERMISSION_MATRIX.admin).not.toContain(PERMISSIONS.BILLING_MANAGE);
    expect(ROLE_PERMISSION_MATRIX.member).not.toContain(PERMISSIONS.BILLING_MANAGE);
    expect(ROLE_PERMISSION_MATRIX.viewer).not.toContain(PERMISSIONS.BILLING_MANAGE);
  });

  it('allows members to read usage but not audit logs', () => {
    expect(ROLE_PERMISSION_MATRIX.member).toContain(PERMISSIONS.USAGE_READ);
    expect(ROLE_PERMISSION_MATRIX.member).not.toContain(PERMISSIONS.AUDIT_LOGS_READ);
  });
});

