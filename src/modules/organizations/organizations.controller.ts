import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AuthUser } from '../common/types/request.types';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organizations.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrganizationDto, @Req() request: Request) {
    return this.organizations.create(user.id, dto, request);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.organizations.listForUser(user.id);
  }

  @Get(':orgId')
  @RequirePermission(PERMISSIONS.ORGANIZATION_READ)
  get(@Param('orgId') organizationId: string) {
    return this.organizations.get(organizationId);
  }

  @Patch(':orgId')
  @RequirePermission(PERMISSIONS.ORGANIZATION_UPDATE)
  update(@Param('orgId') organizationId: string, @Body() dto: UpdateOrganizationDto, @Req() request: Request, @CurrentUser() user: AuthUser) {
    return this.organizations.update(organizationId, user.id, dto, request);
  }

  @Delete(':orgId')
  @RequirePermission(PERMISSIONS.ORGANIZATION_DELETE)
  remove(@Param('orgId') organizationId: string, @Req() request: Request, @CurrentUser() user: AuthUser) {
    return this.organizations.softDelete(organizationId, user.id, request);
  }
}

