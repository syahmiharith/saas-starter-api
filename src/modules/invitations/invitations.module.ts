import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [AuditLogsModule, NotificationsModule],
  controllers: [InvitationsController],
  providers: [InvitationsService]
})
export class InvitationsModule {}

