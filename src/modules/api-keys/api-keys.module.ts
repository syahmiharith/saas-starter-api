import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService]
})
export class ApiKeysModule {}

