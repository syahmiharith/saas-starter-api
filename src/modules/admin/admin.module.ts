import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}

