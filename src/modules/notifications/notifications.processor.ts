import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<{ notificationEventId: string }>) {
    const event = await this.prisma.notificationEvent.findUniqueOrThrow({
      where: { id: job.data.notificationEventId }
    });

    console.log(
      JSON.stringify({
        sandboxNotification: {
          type: event.type,
          to: event.to,
          payload: event.payload
        }
      })
    );

    await this.prisma.notificationEvent.update({
      where: { id: event.id },
      data: {
        status: 'SENT',
        attempts: { increment: 1 }
      }
    });
  }
}

