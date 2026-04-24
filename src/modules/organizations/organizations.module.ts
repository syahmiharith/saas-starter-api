import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService]
})
export class OrganizationsModule {}

