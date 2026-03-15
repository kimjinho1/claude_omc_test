import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AnalyticsService } from './analytics.service';
import { DropDetectorService } from './drop-detector.service';
import Holidays from 'date-holidays';

const krHolidays = new Holidays('KR');
const usHolidays = new Holidays('US');

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private analytics: AnalyticsService,
    private dropDetector: DropDetectorService,
  ) {}

  // Korean market closes 15:30 KST = 06:30 UTC
  @Cron('30 7 * * 1-5')
  async runKrBatch() {
    const today = new Date().toISOString().slice(0, 10);
    if (krHolidays.isHoliday(new Date(today))) return;
    this.logger.debug('DEBUG KR batch started');
    await this.analytics.updateAnalytics('KR');
    await this.dropDetector.detectAndAlert('KR');
    this.logger.debug('DEBUG KR batch complete');
  }

  // US market closes 16:00 ET = 21:00 UTC (handles EST/EDT)
  @Cron('30 21 * * 1-5')
  async runUsBatch() {
    const today = new Date().toISOString().slice(0, 10);
    if (usHolidays.isHoliday(new Date(today))) return;
    this.logger.debug('DEBUG US batch started');
    await this.analytics.updateAnalytics('US');
    await this.dropDetector.detectAndAlert('US');
    this.logger.debug('DEBUG US batch complete');
  }
}
