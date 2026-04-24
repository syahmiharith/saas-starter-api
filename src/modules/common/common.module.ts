import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';
import { PlanLimitsService } from './services/plan-limits.service';
import { RbacService } from './services/rbac.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    RbacService,
    PlanLimitsService,
    JwtAuthGuard,
    PermissionGuard,
    PlatformAdminGuard,
    ApiKeyAuthGuard
  ],
  exports: [
    JwtModule,
    RbacService,
    PlanLimitsService,
    JwtAuthGuard,
    PermissionGuard,
    PlatformAdminGuard,
    ApiKeyAuthGuard
  ]
})
export class CommonModule {}
