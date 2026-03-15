import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KrStockAdapter } from '../data-sources/kr-stock.adapter';
import { UsStockAdapter } from '../data-sources/us-stock.adapter';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private krAdapter: KrStockAdapter,
    private usAdapter: UsStockAdapter,
  ) {}

  async updateAnalytics(market: string) {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const stocks = await this.prisma.stock.findMany({
      where: { market: market === 'KR' ? 'KOSPI' : { in: ['NASDAQ', 'NYSE'] } },
    });

    const adapter = market === 'KR' ? this.krAdapter : this.usAdapter;

    // Record current prices to StockPrice table before computing analytics
    for (const stock of stocks) {
      try {
        const quote = await adapter.getQuote(stock.symbol);
        await this.prisma.stockPrice.create({
          data: {
            symbol: stock.symbol,
            price: new Decimal(quote.price),
            volume: quote.volume ? BigInt(quote.volume) : null,
            recordedAt: new Date(),
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to record price for ${stock.symbol}: ${err}`);
      }
    }

    // Compute 6-month high from recorded prices
    const stocksWithHistory = await this.prisma.stock.findMany({
      where: { market: market === 'KR' ? 'KOSPI' : { in: ['NASDAQ', 'NYSE'] } },
      include: {
        priceHistory: {
          where: { recordedAt: { gte: sixMonthsAgo } },
          select: { price: true },
        },
      },
    });

    for (const stock of stocksWithHistory) {
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
