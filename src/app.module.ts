import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminModule } from './modules/admin/admin.module';
import { HealthController } from './health.controller';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { CommonModule } from './modules/common/common.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UsageModule } from './modules/usage/usage.module';
import { UsersModule } from './modules/users/users.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379)
        }
      })
    }),
    PrismaModule,
    CommonModule,
    NotificationsModule,
    AuditLogsModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    MembershipsModule,
    InvitationsModule,
    BillingModule,
    ApiKeysModule,
    UsageModule,
    AdminModule,
    WebhooksModule
  ]
})
export class AppModule {}
