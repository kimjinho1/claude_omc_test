import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationWorker } from './notification.worker';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, BullModule.registerQueue({ name: 'notifications' })],
  providers: [NotificationsService, NotificationWorker],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
