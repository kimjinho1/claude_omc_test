import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRedis } from '../redis/redis.decorator';
import Redis from 'ioredis';
import {
  IStockDataSource,
  OHLCVBar,
  StockFundamentals,
  StockQuote,
} from './interfaces/stock-data-source.interface';

const RATE_LIMIT_RPM = 5; // free tier: 5 req/min

/**
 * Polygon.io 어댑터 (US stocks)
 * Free tier: 5 req/min, no daily cap
 * ~800 symbols nightly batch = ~160 min
 */
@Injectable()
export class UsStockAdapter implements IStockDataSource {
  private readonly logger = new Logger(UsStockAdapter.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.polygon.io';

  constructor(
    private config: ConfigService,
    @InjectRedis() private redis: Redis,
  ) {
    this.apiKey = config.get<string>('POLYGON_API_KEY') || '';
  }

  private async throttledFetch(url: string): Promise<unknown> {
    // Simple token bucket: wait until a slot is available
    const now = Date.now();
    const windowKey = `polygon:window:${Math.floor(now / 60000)}`;
    const count = await this.redis.incr(windowKey);
    await this.redis.expire(windowKey, 65);

    if (count > RATE_LIMIT_RPM) {
      const waitMs = 60000 - (now % 60000) + 100;
      this.logger.warn(`Polygon rate limit hit, waiting ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const separator = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${separator}apiKey=${this.apiKey}`);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Polygon API error ${res.status}: ${text}`);
    }
    return res.json();
  }

  async getQuote(symbol: string): Promise<StockQuote> {
    try {
      const data = (await this.throttledFetch(
        `${this.baseUrl}/v2/aggs/ticker/${symbol}/prev`,
      )) as { results?: Array<{ c: number; o: number; v: number; t: number }> };
      const result = data.results?.[0];
      if (!result)
        return {
          symbol,
          price: '0',
          change: '0',
          changePercent: '0',
          timestamp: new Date(),
        };
      const change = result.c - result.o;
      const changePercent = ((change / result.o) * 100).toFixed(2);
      return {
        symbol,
        price: result.c.toString(),
        change: change.toFixed(2),
        changePercent,
        volume: result.v,
        timestamp: new Date(result.t),
      };
    } catch (err) {
      this.logger.error(`Polygon getQuote failed for ${symbol}`, err);
      return {
        symbol,
        price: '0',
        change: '0',
        changePercent: '0',
        timestamp: new Date(),
      };
    }
  }

  async getHistory(
    symbol: string,
    period: '1d' | '1w' | '1m' | '3m' | '1y',
  ): Promise<OHLCVBar[]> {
    const now = Date.now();
    const to = new Date(now).toISOString().slice(0, 10);
    const daysBackMap: Record<string, number> = {
      '1d': 2,
      '1w': 7,
      '1m': 30,
      '3m': 90,
      '1y': 365,
    };
    const from = new Date(now - daysBackMap[period] * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const timespan = period === '1d' ? 'hour' : 'day';

    try {
      const data = (await this.throttledFetch(
        `${this.baseUrl}/v2/aggs/ticker/${symbol}/range/1/${timespan}/${from}/${to}`,
      )) as {
        results?: Array<{
          t: number;
          o: number;
          h: number;
          l: number;
          c: number;
          v: number;
        }>;
      };
      return (data.results || []).map((bar) => ({
        date:
          period === '1d'
            ? new Date(bar.t).toISOString().slice(0, 16).replace('T', ' ')
            : new Date(bar.t).toISOString().slice(0, 10),
        open: bar.o.toString(),
        high: bar.h.toString(),
        low: bar.l.toString(),
        close: bar.c.toString(),
        volume: bar.v,
      }));
    } catch (err) {
      this.logger.error(`Polygon getHistory failed for ${symbol}`, err);
      return [];
    }
  }

  async getFundamentals(symbol: string): Promise<StockFundamentals> {
    try {
      // Polygon.io free tier has limited fundamental data — financials endpoint unused
      // week52 from aggs endpoint
      const year = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const today = new Date().toISOString().slice(0, 10);
      const aggData = (await this.throttledFetch(
        `${this.baseUrl}/v2/aggs/ticker/${symbol}/range/1/day/${year}/${today}?adjusted=true&sort=asc&limit=365`,
      )) as { results?: Array<{ h: number; l: number }> };
      const prices = aggData.results || [];
      const week52High = prices.length
        ? Math.max(...prices.map((p) => p.h)).toString()
        : undefined;
      const week52Low = prices.length
        ? Math.min(...prices.map((p) => p.l)).toString()
        : undefined;
      // PER/PBR/dividendYield not available on Polygon.io free tier
      return {
        per: undefined,
        pbr: undefined,
        dividendYield: undefined,
        week52High,
        week52Low,
      };
    } catch (err) {
      this.logger.error(`Polygon getFundamentals failed for ${symbol}`, err);
      return {};
    }
  }
}
