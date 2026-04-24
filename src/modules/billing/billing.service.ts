import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, SubscriptionStatus, WebhookProvider } from '@prisma/client';
import { Request } from 'express';
import Stripe from 'stripe';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PLAN_LIMITS, PlanSlug } from '../common/constants/plans';
import { AppException } from '../common/errors/app.exception';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutDto, CreatePortalDto } from './dto/billing.dto';

@Injectable()
export class BillingService {
  private readonly stripe: Stripe;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditLogs: AuditLogsService,
    private readonly notifications: NotificationsService
  ) {
    this.stripe = new Stripe(this.config.get<string>('STRIPE_SECRET_KEY', 'sk_test_missing'));
  }

  async createCheckoutSession(
    organizationId: string,
    dto: CreateCheckoutDto,
    actorUserId: string,
    request: Request
  ) {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId }
    });
    const plan = await this.ensurePlan(dto.plan as PlanSlug);
    const customerId =
      organization.stripeCustomerId ??
      (
        await this.stripe.customers.create({
          name: organization.name,
          metadata: { organizationId }
        })
      ).id;

    if (!organization.stripeCustomerId) {
      await this.prisma.organization.update({
        where: { id: organizationId },
        data: { stripeCustomerId: customerId }
      });
    }

    if (!plan.stripePriceId) {
      await this.auditLogs.record({
        organizationId,
        actorUserId,
        action: 'billing.checkout_created',
        resourceType: 'plan',
        resourceId: plan.id,
        ipAddress: request.ip,
        userAgent: request.header('user-agent') ?? null,
        metadata: { sandbox: true, plan: plan.slug }
      });
      return {
        mode: 'sandbox',
        plan: plan.slug,
        url: `${this.config.get<string>('APP_BASE_URL', 'http://localhost:3000')}/sandbox-checkout/${organizationId}/${plan.slug}`
      };
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      success_url: dto.successUrl ?? `${this.config.get<string>('APP_BASE_URL')}/billing/success`,
      cancel_url: dto.cancelUrl ?? `${this.config.get<string>('APP_BASE_URL')}/billing/cancel`,
      metadata: { organizationId, plan: plan.slug }
    });

    await this.auditLogs.record({
      organizationId,
      actorUserId,
      action: 'billing.checkout_created',
      resourceType: 'stripe_checkout_session',
      resourceId: session.id,
      ipAddress: request.ip,
      userAgent: request.header('user-agent') ?? null,
      metadata: { plan: plan.slug }
    });

    return { id: session.id, url: session.url };
  }

  async createPortalSession(organizationId: string, dto: CreatePortalDto) {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: organizationId }
    });
    if (!organization.stripeCustomerId) {
      throw new AppException('RESOURCE_NOT_FOUND', 'Organization has no Stripe customer.', HttpStatus.NOT_FOUND);
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: dto.returnUrl ?? this.config.get<string>('APP_BASE_URL', 'http://localhost:3000')
    });
    return { id: session.id, url: session.url };
  }

  async getSubscription(organizationId: string) {
    return this.prisma.subscription.findFirst({
      where: { organizationId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async processStripeWebhook(signature: string | undefined, rawBody: Buffer) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new AppException('FORBIDDEN', 'Stripe webhook secret is not configured.', HttpStatus.FORBIDDEN);
    }

    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature ?? '', webhookSecret);
    } catch {
      throw new AppException('FORBIDDEN', 'Invalid Stripe webhook signature.', HttpStatus.FORBIDDEN);
    }

    const duplicate = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: WebhookProvider.STRIPE,
          providerEventId: event.id
        }
      }
    });
    if (duplicate?.processedAt) {
      throw new AppException('WEBHOOK_ALREADY_PROCESSED', 'Webhook already processed.', HttpStatus.CONFLICT);
    }

    const webhookEvent =
      duplicate ??
      (await this.prisma.webhookEvent.create({
        data: {
          provider: WebhookProvider.STRIPE,
          providerEventId: event.id,
          type: event.type,
          payload: event as unknown as object
        }
      }));

    try {
      await this.applyStripeEvent(event);
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: { processedAt: new Date() }
      });
      return { ok: true };
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          failedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      throw error;
    }
  }

  private async applyStripeEvent(event: Stripe.Event) {
    if (
      event.type !== 'customer.subscription.created' &&
      event.type !== 'customer.subscription.updated' &&
      event.type !== 'customer.subscription.deleted' &&
      event.type !== 'invoice.payment_failed'
    ) {
      return;
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) {
        return;
      }
      const organization = await this.prisma.organization.findUnique({
        where: { stripeCustomerId: customerId }
      });
      if (organization) {
        await this.notifications.enqueue({
          type: NotificationType.BILLING_PAYMENT_FAILED,
          to: 'billing@example.local',
          organizationId: organization.id,
          payload: { stripeEventId: event.id }
        });
      }
      return;
    }

    const subscription = event.data.object as Stripe.Subscription;
    const subscriptionPeriods = subscription as unknown as {
      current_period_start?: number;
      current_period_end?: number;
    };
    const organizationId = subscription.metadata.organizationId;
    const planSlug = (subscription.metadata.plan || 'pro') as PlanSlug;
    if (!organizationId) {
      return;
    }

    const plan = await this.ensurePlan(planSlug);
    await this.prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      update: {
        planId: plan.id,
        status: this.mapStripeStatus(subscription.status),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart: subscriptionPeriods.current_period_start
          ? new Date(subscriptionPeriods.current_period_start * 1000)
          : null,
        currentPeriodEnd: subscriptionPeriods.current_period_end
          ? new Date(subscriptionPeriods.current_period_end * 1000)
          : null
      },
      create: {
        organizationId,
        planId: plan.id,
        stripeSubscriptionId: subscription.id,
        status: this.mapStripeStatus(subscription.status),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart: subscriptionPeriods.current_period_start
          ? new Date(subscriptionPeriods.current_period_start * 1000)
          : null,
        currentPeriodEnd: subscriptionPeriods.current_period_end
          ? new Date(subscriptionPeriods.current_period_end * 1000)
          : null
      }
    });

    await this.auditLogs.record({
      organizationId,
      action: 'billing.subscription_updated',
      resourceType: 'stripe_subscription',
      resourceId: subscription.id,
      metadata: { plan: plan.slug, status: subscription.status }
    });
    await this.notifications.enqueue({
      type: NotificationType.BILLING_SUBSCRIPTION_UPDATED,
      to: 'billing@example.local',
      organizationId,
      payload: { plan: plan.slug, status: subscription.status }
    });
  }

  private mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    const normalized = status.toUpperCase();
    if (normalized in SubscriptionStatus) {
      return SubscriptionStatus[normalized as keyof typeof SubscriptionStatus];
    }
    return SubscriptionStatus.INCOMPLETE;
  }

  private ensurePlan(slug: PlanSlug) {
    const limits = PLAN_LIMITS[slug];
    return this.prisma.plan.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name: limits.name,
        memberLimit: limits.memberLimit,
        apiRequestLimit: limits.apiRequestLimit,
        apiKeyLimit: limits.apiKeyLimit,
        auditRetentionDays: limits.auditRetentionDays,
        stripePriceId: this.config.get<string>(`STRIPE_PRICE_${slug.toUpperCase()}`)
      }
    });
  }
}
