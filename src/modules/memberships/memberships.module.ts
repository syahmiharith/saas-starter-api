import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService]
})
export class MembershipsModule {}

