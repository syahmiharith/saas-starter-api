import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AuthUser } from '../common/types/request.types';
import { UpdateMemberRoleDto } from './dto/memberships.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('organizations/:orgId/members')
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.MEMBERS_READ)
  list(@Param('orgId') organizationId: string) {
    return this.memberships.list(organizationId);
  }

  @Patch(':memberId/role')
  @RequirePermission(PERMISSIONS.MEMBERS_ROLE_UPDATE)
  updateRole(
    @Param('orgId') organizationId: string,
    @Param('memberId') membershipId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request
  ) {
    return this.memberships.updateRole(organizationId, membershipId, dto.role, user.id, request);
  }

  @Delete(':memberId')
  @RequirePermission(PERMISSIONS.MEMBERS_REMOVE)
  remove(
    @Param('orgId') organizationId: string,
    @Param('memberId') membershipId: string,
    @CurrentUser() user: AuthUser,
    @Req() request: Request
  ) {
    return this.memberships.remove(organizationId, membershipId, user.id, request);
  }
}

