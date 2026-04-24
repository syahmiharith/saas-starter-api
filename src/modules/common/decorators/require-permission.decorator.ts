import { SetMetadata } from '@nestjs/common';
import { PermissionName } from '../constants/permissions';

export const PERMISSION_METADATA = 'permission';

export const RequirePermission = (permission: PermissionName) =>
  SetMetadata(PERMISSION_METADATA, permission);

