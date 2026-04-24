import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export type NotificationInput = {
  type: NotificationType;
  to: string;
  payload: Record<string, unknown>;
  userId?: string;
  organizationId?: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notifications') private readonly queue: Queue,
    private readonly prisma: PrismaService
  ) {}

  async enqueue(input: NotificationInput) {
    const event = await this.prisma.notificationEvent.create({
      data: {
        type: input.type,
        to: input.to,
        payload: input.payload as Prisma.InputJsonValue,
        userId: input.userId,
        organizationId: input.organizationId
      }
    });

    await this.queue.add('deliver', { notificationEventId: event.id }, { attempts: 3, backoff: 5000 });
    return event;
  }
}
