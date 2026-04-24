import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PERMISSIONS } from '../common/constants/permissions';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ApiKeyAuthGuard } from '../common/guards/api-key-auth.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { UsageService } from './usage.service';

class UsageEventDto {
  @IsOptional()
  @IsString()
  feature?: string;
}

@ApiTags('usage')
@Controller('organizations/:orgId/usage')
export class UsageController {
  constructor(private readonly usage: UsageService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Get()
  @RequirePermission(PERMISSIONS.USAGE_READ)
  get(@Param('orgId') organizationId: string) {
    return this.usage.getUsage(organizationId);
  }

  @ApiSecurity('api-key')
  @UseGuards(ApiKeyAuthGuard)
  @Post('events')
  trackApiKeyEvent(@Param('orgId') organizationId: string, @Body() dto: UsageEventDto) {
    return this.usage.trackApiKeyDemoEvent(organizationId, dto.feature ?? 'api_request');
  }
}

