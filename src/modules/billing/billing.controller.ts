import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PERMISSIONS } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AuthUser } from '../common/types/request.types';
import { BillingService } from './billing.service';
import { CreateCheckoutDto, CreatePortalDto } from './dto/billing.dto';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('organizations/:orgId/billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  @RequirePermission(PERMISSIONS.BILLING_MANAGE)
  checkout(
    @Param('orgId') organizationId: string,
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: AuthUser,
    @Req() request: Request
  ) {
    return this.billing.createCheckoutSession(organizationId, dto, user.id, request);
  }

  @Post('portal')
  @RequirePermission(PERMISSIONS.BILLING_MANAGE)
  portal(@Param('orgId') organizationId: string, @Body() dto: CreatePortalDto) {
    return this.billing.createPortalSession(organizationId, dto);
  }

  @Get('subscription')
  @RequirePermission(PERMISSIONS.BILLING_READ)
  subscription(@Param('orgId') organizationId: string) {
    return this.billing.getSubscription(organizationId);
  }
}

