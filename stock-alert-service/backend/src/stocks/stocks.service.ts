import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '../redis/redis.decorator';
import Redis from 'ioredis';
import { KrStockAdapter } from '../data-sources/kr-stock.adapter';
import { UsStockAdapter } from '../data-sources/us-stock.adapter';

const PRICE_TTL = 30; // 30 seconds
const DETAIL_TTL = 3600; // 1 hour

@Injectable()
export class StocksService {
  constructor(
    private prisma: PrismaService,
    private krAdapter: KrStockAdapter,
    private usAdapter: UsStockAdapter,
    @InjectRedis() private redis: Redis,
  ) {}

  async findAll(market?: string) {
    let where = {};
    if (market) {
      const m = market.toUpperCase();
      if (m === 'KR') {
        where = { market: 'KOSPI' };
      } else if (m === 'US') {
        where = { market: { in: ['NYSE', 'NASDAQ'] } };
      } else {
        where = { market: m };
      }
    }
    return this.prisma.stock.findMany({ where, orderBy: { symbol: 'asc' } });
  }

  async search(q: string) {
    return this.prisma.stock.findMany({
      where: {
        OR: [
          { symbol: { contains: q.toUpperCase() } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 20,
    });
  }

  async getQuote(symbol: string) {
    const cacheKey = `quote:${symbol}`;
    const cached = await this.redis.get(cacheKey);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (cached) return JSON.parse(cached);

    const stock = await this.prisma.stock.findUnique({ where: { symbol } });
    if (!stock) return null;

    const adapter = stock.market === 'KOSPI' ? this.krAdapter : this.usAdapter;
    const quote = await adapter.getQuote(symbol);
    await this.redis.setex(cacheKey, PRICE_TTL, JSON.stringify(quote));
    return quote;
  }

  async getDetail(symbol: string) {
    const cacheKey = `detail:${symbol}`;
    const cached = await this.redis.get(cacheKey);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (cached) return JSON.parse(cached);

    const stock = await this.prisma.stock.findUnique({
      where: { symbol },
      include: { analytics: true },
    });
    if (!stock) return null;

    const adapter = stock.market === 'KOSPI' ? this.krAdapter : this.usAdapter;
    const [quote, fundamentals] = await Promise.all([
      adapter.getQuote(symbol),
      adapter.getFundamentals(symbol),
    ]);

    const result = { ...stock, ...quote, ...fundamentals };
    await this.redis.setex(cacheKey, DETAIL_TTL, JSON.stringify(result));
    return result;
  }

  async getChart(symbol: string, period: '1d' | '1w' | '1m') {
    const stock = await this.prisma.stock.findUnique({ where: { symbol } });
    if (!stock) return null;
    const adapter = stock.market === 'KOSPI' ? this.krAdapter : this.usAdapter;
    return adapter.getHistory(symbol, period);
  }
}
