import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService]
})
export class BillingModule {}

