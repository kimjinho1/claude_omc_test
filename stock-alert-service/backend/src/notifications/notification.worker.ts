import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NotificationsService } from './notifications.service';

export interface NotificationJobData {
  userId: string;
  payload: {
    title: string;
    body: string;
    symbol: string;
    level: number;
  };
}

@Processor('notifications')
export class NotificationWorker extends WorkerHost {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(private notifications: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { userId, payload } = job.data;
    this.logger.log(`Processing notification job ${job.id} for user ${userId}`);
    await this.notifications.sendToUser(userId, payload);
  }
}
