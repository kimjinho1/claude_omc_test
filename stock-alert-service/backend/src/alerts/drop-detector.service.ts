import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

const DROP_LEVELS = [10, 15, 20, 25, 30];
const DEDUP_HOURS = 24;

@Injectable()
export class DropDetectorService {
  private readonly logger = new Logger(DropDetectorService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('notifications') private notificationsQueue: Queue,
  ) {}

  async detectAndAlert(market: string) {
    const stocks = await this.prisma.stock.findMany({
      where: { market: market === 'KR' ? 'KOSPI' : { in: ['NASDAQ', 'NYSE'] } },
      include: { analytics: true },
    });

    const users = await this.prisma.user.findMany({
      include: { alertSettings: true, favorites: true },
    });

    for (const stock of stocks) {
      if (!stock.analytics) continue;

      const latest = await this.prisma.stockPrice.findFirst({
        where: { symbol: stock.symbol },
        orderBy: { recordedAt: 'desc' },
      });
      if (!latest) continue;

      const high6m = stock.analytics.high6m;
      if (high6m.isZero()) continue;

      const dropPct = high6m.minus(latest.price).div(high6m).times(100);

      for (const user of users) {
        const isFavorite = user.favorites.some((f) => f.symbol === stock.symbol);
        const thresholds = isFavorite
          ? DROP_LEVELS // favorites always get all levels
          : (user.alertSettings[0]?.thresholds ?? []);

        const hitLevel = this.getHitLevel(dropPct, thresholds);
        if (hitLevel === null) continue;

        const alreadySent = await this.checkDuplicate(user.id, stock.symbol, hitLevel);
        if (alreadySent) continue;

        await this.prisma.alertLog.create({
          data: {
            userId: user.id,
            symbol: stock.symbol,
            dropPercent: dropPct,
            level: hitLevel,
          },
        });

        await this.notificationsQueue.add('send', {
          userId: user.id,
          payload: {
            title: `${stock.name} 하락 알림`,
            body: `${stock.symbol} 전고점 대비 ${dropPct.toFixed(1)}% 하락 (${hitLevel}% 단계)`,
            symbol: stock.symbol,
            level: hitLevel,
          },
        });
      }
    }
    this.logger.log(`Drop detection completed for ${market}`);
  }

  private getHitLevel(dropPct: Decimal, thresholds: number[]): number | null {
    const sorted = [...thresholds].sort((a, b) => b - a);
    for (const level of sorted) {
      if (dropPct.greaterThanOrEqualTo(level)) return level;
    }
    return null;
  }

  private async checkDuplicate(userId: string, symbol: string, level: number): Promise<boolean> {
    const since = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);
    const existing = await this.prisma.alertLog.findFirst({
      where: { userId, symbol, level, sentAt: { gte: since } },
    });
    return !!existing;
  }
}
