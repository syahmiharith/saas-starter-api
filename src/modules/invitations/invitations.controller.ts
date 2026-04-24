import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AuthUser } from '../common/types/request.types';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitations.dto';
import { InvitationsService } from './invitations.service';

@ApiTags('invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('organizations/:orgId/invitations')
  @RequirePermission(PERMISSIONS.MEMBERS_INVITE)
  create(
    @Param('orgId') organizationId: string,
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request
  ) {
    return this.invitations.create(organizationId, dto, user.id, request);
  }

  @Get('organizations/:orgId/invitations')
  @RequirePermission(PERMISSIONS.MEMBERS_INVITE)
  list(@Param('orgId') organizationId: string) {
    return this.invitations.list(organizationId);
  }

  @Delete('organizations/:orgId/invitations/:invitationId')
  @RequirePermission(PERMISSIONS.MEMBERS_INVITE)
  revoke(
    @Param('orgId') organizationId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthUser,
    @Req() request: Request
  ) {
    return this.invitations.revoke(organizationId, invitationId, user.id, request);
  }

  @Post('invitations/accept')
  accept(@Body() dto: AcceptInvitationDto, @CurrentUser() user: AuthUser, @Req() request: Request) {
    return this.invitations.accept(dto.token, user.id, request);
  }
}

