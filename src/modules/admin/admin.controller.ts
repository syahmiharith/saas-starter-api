import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { AuthUser } from '../common/types/request.types';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  users() {
    return this.admin.listUsers();
  }

  @Get('users/:userId')
  user(@Param('userId') userId: string) {
    return this.admin.getUser(userId);
  }

  @Patch('users/:userId/suspend')
  suspend(@Param('userId') userId: string, @CurrentUser() actor: AuthUser, @Req() request: Request) {
    return this.admin.suspendUser(userId, actor.id, request);
  }

  @Patch('users/:userId/unsuspend')
  unsuspend(@Param('userId') userId: string, @CurrentUser() actor: AuthUser, @Req() request: Request) {
    return this.admin.unsuspendUser(userId, actor.id, request);
  }

  @Get('organizations')
  organizations() {
    return this.admin.listOrganizations();
  }

  @Get('metrics')
  metrics() {
    return this.admin.metrics();
  }
}

