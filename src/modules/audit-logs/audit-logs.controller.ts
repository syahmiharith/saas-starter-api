import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '../common/constants/permissions';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AuditLogsService } from './audit-logs.service';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('organizations/:orgId/audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.AUDIT_LOGS_READ)
  list(@Param('orgId') organizationId: string) {
    return this.auditLogs.listForOrganization(organizationId);
  }
}

