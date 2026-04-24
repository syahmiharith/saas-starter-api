import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AuthUser } from '../common/types/request.types';
import { CreateApiKeyDto } from './dto/api-keys.dto';
import { ApiKeysService } from './api-keys.service';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('organizations/:orgId/api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  @RequirePermission(PERMISSIONS.API_KEYS_CREATE)
  create(
    @Param('orgId') organizationId: string,
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request
  ) {
    return this.apiKeys.create(organizationId, dto, user.id, request);
  }

  @Get()
  @RequirePermission(PERMISSIONS.API_KEYS_READ)
  list(@Param('orgId') organizationId: string) {
    return this.apiKeys.list(organizationId);
  }

  @Delete(':keyId')
  @RequirePermission(PERMISSIONS.API_KEYS_REVOKE)
  revoke(
    @Param('orgId') organizationId: string,
    @Param('keyId') apiKeyId: string,
    @CurrentUser() user: AuthUser,
    @Req() request: Request
  ) {
    return this.apiKeys.revoke(organizationId, apiKeyId, user.id, request);
  }
}

