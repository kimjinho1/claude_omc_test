import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '../redis/redis.decorator';
import Redis from 'ioredis';
import { KrStockAdapter } from '../data-sources/kr-stock.adapter';
import { UsStockAdapter } from '../data-sources/us-stock.adapter';

/** How old cached data can be before we attempt a refresh (ms) */
const FRESHNESS_MS: Record<string, number> = {
  quote: 60_000,           // 1 minute
  detail: 60_000,          // 1 minute
  'chart:1d': 5 * 60_000,  // 5 minutes (hourly bars arrive slowly)
  'chart:1w': 60 * 60_000, // 1 hour
  'chart:1m': 60 * 60_000, // 1 hour
  'chart:3m': 6 * 60 * 60_000, // 6 hours
  'chart:1y': 24 * 60 * 60_000, // 24 hours
};

/** Safety-net expiry so Redis doesn't grow unbounded (7 days) */
const STORE_TTL_SEC = 7 * 24 * 3600;

interface CacheEntry<T> {
  data: T;
  fetchedAt: string; // ISO timestamp
}

@Injectable()
export class StocksService {
  private readonly logger = new Logger(StocksService.name);

  constructor(
    private prisma: PrismaService,
    private krAdapter: KrStockAdapter,
    private usAdapter: UsStockAdapter,
    @InjectRedis() private redis: Redis,
  ) {}

  /**
   * Stale-while-revalidate helper.
   * - Returns cached value if age < freshnessTtlMs.
   * - Tries API refresh when stale; on failure returns stale data (graceful degradation).
   * - Returns null only when there is no cached value AND the fetch fails.
   */
  private async withStaleCache<T>(
    key: string,
    freshnessTtlMs: number,
    fetcher: () => Promise<T>,
  ): Promise<T | null> {
    const raw = await this.redis.get(key);
    if (raw) {
      const entry = JSON.parse(raw) as CacheEntry<T>;
      const ageMs = Date.now() - new Date(entry.fetchedAt).getTime();
      if (ageMs < freshnessTtlMs) {
        // Cache is fresh — return directly without calling API
        this.logger.debug(`CACHE HIT [${key}] age=${ageMs}ms (fresh)`);
        return entry.data;
      }
      // Cache is stale — try to refresh; fall back to stale on failure
      this.logger.debug(`CACHE STALE [${key}] age=${ageMs}ms → calling API`);
      try {
        const fresh = await fetcher();
        const newEntry: CacheEntry<T> = { data: fresh, fetchedAt: new Date().toISOString() };
        await this.redis.setex(key, STORE_TTL_SEC, JSON.stringify(newEntry));
        this.logger.debug(`CACHE REFRESHED [${key}]`);
        return fresh;
      } catch {
        // API rate-limited or unavailable — serve stale data
        this.logger.debug(`CACHE STALE FALLBACK [${key}] API failed, serving stale data`);
        return entry.data;
      }
    }

    // No cache at all — fetch from API (no fallback possible)
    this.logger.debug(`CACHE MISS [${key}] → calling API`);
    const data = await fetcher();
    if (data !== null && data !== undefined) {
      const entry: CacheEntry<T> = { data, fetchedAt: new Date().toISOString() };
      await this.redis.setex(key, STORE_TTL_SEC, JSON.stringify(entry));
      this.logger.debug(`CACHE STORED [${key}]`);
    }
    return data;
  }

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
    const stock = await this.prisma.stock.findUnique({ where: { symbol } });
    if (!stock) return null;

    const adapter = stock.market === 'KOSPI' ? this.krAdapter : this.usAdapter;
    return this.withStaleCache(
      `quote:${symbol}`,
      FRESHNESS_MS.quote,
      () => adapter.getQuote(symbol),
    );
  }

  async getDetail(symbol: string) {
    const stock = await this.prisma.stock.findUnique({
      where: { symbol },
      include: { analytics: true },
    });
    if (!stock) return null;

    const adapter = stock.market === 'KOSPI' ? this.krAdapter : this.usAdapter;
    return this.withStaleCache(
      `detail:${symbol}`,
      FRESHNESS_MS.detail,
      async () => {
        const [quote, fundamentals] = await Promise.all([
          adapter.getQuote(symbol),
          adapter.getFundamentals(symbol),
        ]);
        return { ...stock, ...quote, ...fundamentals };
      },
    );
  }

  async getChart(symbol: string, period: '1d' | '1w' | '1m' | '3m' | '1y') {
    const stock = await this.prisma.stock.findUnique({ where: { symbol } });
    if (!stock) return null;

    const adapter = stock.market === 'KOSPI' ? this.krAdapter : this.usAdapter;
    const freshnessKey = `chart:${period}`;
    const freshnessTtlMs = FRESHNESS_MS[freshnessKey] ?? FRESHNESS_MS['chart:1m'];

    return this.withStaleCache(
      `chart:${symbol}:${period}`,
      freshnessTtlMs,
      () => adapter.getHistory(symbol, period),
    );
  }
}
