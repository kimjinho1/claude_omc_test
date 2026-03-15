import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  async updateAnalytics(market: string) {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const stocks = await this.prisma.stock.findMany({
      where: { market: market === 'KR' ? 'KOSPI' : { in: ['NASDAQ', 'NYSE'] } },
      include: {
        priceHistory: {
          where: { recordedAt: { gte: sixMonthsAgo } },
          select: { price: true },
        },
      },
    });

    for (const stock of stocks) {
      if (!stock.priceHistory.length) continue;
      const high6m = stock.priceHistory.reduce(
        (max, p) => (p.price.greaterThan(max) ? p.price : max),
        new Decimal(0),
      );
      await this.prisma.stockAnalytics.upsert({
        where: { symbol: stock.symbol },
        update: { high6m, high6mUpdatedAt: new Date() },
        create: { symbol: stock.symbol, high6m, high6mUpdatedAt: new Date() },
      });
    }
    this.logger.log(`Analytics updated for ${market}: ${stocks.length} stocks`);
  }
}
