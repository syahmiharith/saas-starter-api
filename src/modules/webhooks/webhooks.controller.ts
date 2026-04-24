import { Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { BillingService } from '../billing/billing.service';

type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly billing: BillingService) {}

  @Post('stripe')
  stripe(@Headers('stripe-signature') signature: string | undefined, @Req() request: RawBodyRequest) {
    const body = request.rawBody ?? Buffer.from(JSON.stringify(request.body));
    return this.billing.processStripeWebhook(signature, body);
  }
}

