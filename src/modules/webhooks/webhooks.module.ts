import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [BillingModule],
  controllers: [WebhooksController]
})
export class WebhooksModule {}

