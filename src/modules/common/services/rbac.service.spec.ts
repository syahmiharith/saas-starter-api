import { RbacService } from './rbac.service';

describe('RbacService', () => {
  it('returns true when a membership role grants the requested permission', async () => {
    const prisma = {
      membership: {
        findUnique: jest.fn().mockResolvedValue({
          role: {
            rolePermissions: [
              { permission: { name: 'organization.read' } },
              { permission: { name: 'members.invite' } }
            ]
          }
        })
      }
    };
    const service = new RbacService(prisma as any);

    await expect(service.can('user_1', 'members.invite', 'org_1')).resolves.toBe(true);
    expect(prisma.membership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_organizationId: {
            userId: 'user_1',
            organizationId: 'org_1'
          }
        }
      })
    );
  });

  it('returns false when the user is not a member of the organization', async () => {
    const prisma = {
      membership: {
        findUnique: jest.fn().mockResolvedValue(null)
      }
    };
    const service = new RbacService(prisma as any);

    await expect(service.can('user_1', 'organization.read', 'org_1')).resolves.toBe(false);
  });

  it('returns false when the role does not grant the requested permission', async () => {
    const prisma = {
      membership: {
        findUnique: jest.fn().mockResolvedValue({
          role: {
            rolePermissions: [{ permission: { name: 'organization.read' } }]
          }
        })
      }
    };
    const service = new RbacService(prisma as any);

    await expect(service.can('user_1', 'billing.manage', 'org_1')).resolves.toBe(false);
  });
});
