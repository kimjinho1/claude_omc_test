import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { AnalyticsService } from './analytics.service';
import { DropDetectorService } from './drop-detector.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';

@Module({
  imports: [PrismaModule, NotificationsModule, DataSourcesModule],
  providers: [AlertsService, AnalyticsService, DropDetectorService],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}
