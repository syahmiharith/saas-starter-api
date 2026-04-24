import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  get() {
    return {
      ok: true,
      service: 'saas-starter-api',
      timestamp: new Date().toISOString()
    };
  }
}

