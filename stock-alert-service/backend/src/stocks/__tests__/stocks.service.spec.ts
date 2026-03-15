/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { StocksService } from '../stocks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { KrStockAdapter } from '../../data-sources/kr-stock.adapter';
import { UsStockAdapter } from '../../data-sources/us-stock.adapter';
import { REDIS_CLIENT } from '../../redis/redis.module';

const mockPrisma = {
  stock: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockRedis = {
  get: jest.fn(),
  setex: jest.fn(),
};

const mockKrAdapter = {
  getQuote: jest.fn(),
  getFundamentals: jest.fn(),
  getHistory: jest.fn(),
};

const mockUsAdapter = {
  getQuote: jest.fn(),
  getFundamentals: jest.fn(),
  getHistory: jest.fn(),
};

/** Build a fresh CacheEntry (age = 0ms) */
function freshEntry<T>(data: T) {
  return JSON.stringify({ data, fetchedAt: new Date().toISOString() });
}

/** Build a stale CacheEntry (age = 25 hours — exceeds all freshness thresholds) */
function staleEntry<T>(data: T) {
  const fetchedAt = new Date(Date.now() - 25 * 60 * 60_000).toISOString();
  return JSON.stringify({ data, fetchedAt });
}

describe('StocksService', () => {
  let service: StocksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.setex.mockResolvedValue('OK');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StocksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: KrStockAdapter, useValue: mockKrAdapter },
        { provide: UsStockAdapter, useValue: mockUsAdapter },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<StocksService>(StocksService);
  });

  describe('findAll', () => {
    it('returns all stocks when no market filter', async () => {
      const stocks = [{ symbol: 'AAPL' }, { symbol: '005930' }];
      mockPrisma.stock.findMany.mockResolvedValue(stocks);

      const result = await service.findAll();

      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { symbol: 'asc' },
      });
      expect(result).toEqual(stocks);
    });

    it('filters by KOSPI when market=KR', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([]);
      await service.findAll('KR');
      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith({
        where: { market: 'KOSPI' },
        orderBy: { symbol: 'asc' },
      });
    });

    it('filters by NYSE and NASDAQ when market=US', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([]);
      await service.findAll('US');
      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith({
        where: { market: { in: ['NYSE', 'NASDAQ'] } },
        orderBy: { symbol: 'asc' },
      });
    });

    it('passes raw market value for other filters', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([]);
      await service.findAll('NASDAQ');
      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith({
        where: { market: 'NASDAQ' },
        orderBy: { symbol: 'asc' },
      });
    });
  });

  describe('search', () => {
    it('searches by symbol and name with OR', async () => {
      const stocks = [{ symbol: 'AAPL', name: 'Apple Inc.' }];
      mockPrisma.stock.findMany.mockResolvedValue(stocks);

      const result = await service.search('apple');

      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { symbol: { contains: 'APPLE' } },
            { name: { contains: 'apple', mode: 'insensitive' } },
          ],
        },
        take: 20,
      });
      expect(result).toEqual(stocks);
    });

    it('converts query to uppercase for symbol search', async () => {
      mockPrisma.stock.findMany.mockResolvedValue([]);
      await service.search('aapl');
      expect(mockPrisma.stock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ symbol: { contains: 'AAPL' } }]),
          }),
        }),
      );
    });
  });

  describe('getQuote', () => {
    const stock = { symbol: 'AAPL', market: 'NASDAQ' };
    // Use string timestamp — Date objects serialize to strings in JSON round-trips
    const quote = { symbol: 'AAPL', price: '180', change: '1', changePercent: '0.56', timestamp: '2026-01-01T00:00:00.000Z' };

    it('returns fresh cached quote without calling adapter', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      mockRedis.get.mockResolvedValue(freshEntry(quote));

      const result = await service.getQuote('AAPL');

      expect(result).toEqual(quote);
      expect(mockUsAdapter.getQuote).not.toHaveBeenCalled();
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('refreshes stale cache and updates Redis', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      const staleQuote = { ...quote, price: '170' };
      mockRedis.get.mockResolvedValue(staleEntry(staleQuote));
      mockUsAdapter.getQuote.mockResolvedValue(quote);

      const result = await service.getQuote('AAPL');

      expect(mockUsAdapter.getQuote).toHaveBeenCalledWith('AAPL');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'quote:AAPL',
        expect.any(Number),
        expect.stringContaining('"price":"180"'),
      );
      expect(result).toEqual(quote);
    });

    it('returns stale data when API fails on stale cache', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      const staleQuote = { ...quote, price: '170' };
      mockRedis.get.mockResolvedValue(staleEntry(staleQuote));
      mockUsAdapter.getQuote.mockRejectedValue(new Error('Rate limit'));

      const result = await service.getQuote('AAPL');

      expect(result).toEqual(staleQuote);
    });

    it('fetches and caches on cache miss', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      mockRedis.get.mockResolvedValue(null);
      mockUsAdapter.getQuote.mockResolvedValue(quote);

      const result = await service.getQuote('AAPL');

      expect(mockUsAdapter.getQuote).toHaveBeenCalledWith('AAPL');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'quote:AAPL',
        expect.any(Number),
        expect.stringContaining('"fetchedAt"'),
      );
      expect(result).toEqual(quote);
    });

    it('returns null when stock not found', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      const result = await service.getQuote('UNKNOWN');

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('uses KR adapter for KOSPI stocks', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue({ symbol: '005930', market: 'KOSPI' });
      mockRedis.get.mockResolvedValue(null);
      const krQuote = { ...quote, symbol: '005930', price: '70000' };
      mockKrAdapter.getQuote.mockResolvedValue(krQuote);

      await service.getQuote('005930');

      expect(mockKrAdapter.getQuote).toHaveBeenCalledWith('005930');
      expect(mockUsAdapter.getQuote).not.toHaveBeenCalled();
    });
  });

  describe('getDetail', () => {
    const stock = { symbol: 'AAPL', market: 'NASDAQ', analytics: null };
    const quote = { price: '150', volume: 1000000 };
    const fundamentals = { per: '28.5', pbr: '12.1' };

    it('returns fresh cached detail without calling adapters', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      const cached = { ...stock, ...quote, ...fundamentals };
      mockRedis.get.mockResolvedValue(freshEntry(cached));

      const result = await service.getDetail('AAPL');

      expect(result).toEqual(cached);
      expect(mockUsAdapter.getQuote).not.toHaveBeenCalled();
    });

    it('refreshes stale detail and stores updated entry', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      const staleDetail = { ...stock, price: '140' };
      mockRedis.get.mockResolvedValue(staleEntry(staleDetail));
      mockUsAdapter.getQuote.mockResolvedValue(quote);
      mockUsAdapter.getFundamentals.mockResolvedValue(fundamentals);

      const result = await service.getDetail('AAPL');

      expect(mockUsAdapter.getQuote).toHaveBeenCalledWith('AAPL');
      expect(mockUsAdapter.getFundamentals).toHaveBeenCalledWith('AAPL');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'detail:AAPL',
        expect.any(Number),
        expect.stringContaining('"fetchedAt"'),
      );
      expect(result).toMatchObject({ symbol: 'AAPL', price: '150' });
    });

    it('returns stale detail when API fails on stale cache', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      const staleDetail = { ...stock, price: '140' };
      mockRedis.get.mockResolvedValue(staleEntry(staleDetail));
      mockUsAdapter.getQuote.mockRejectedValue(new Error('Rate limit'));

      const result = await service.getDetail('AAPL');

      expect(result).toEqual(staleDetail);
    });

    it('fetches from DB and adapter on cache miss', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      mockRedis.get.mockResolvedValue(null);
      mockUsAdapter.getQuote.mockResolvedValue(quote);
      mockUsAdapter.getFundamentals.mockResolvedValue(fundamentals);

      const result = await service.getDetail('AAPL');

      expect(mockPrisma.stock.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        include: { analytics: true },
      });
      expect(mockUsAdapter.getQuote).toHaveBeenCalledWith('AAPL');
      expect(mockUsAdapter.getFundamentals).toHaveBeenCalledWith('AAPL');
      expect(result).toMatchObject({ symbol: 'AAPL', price: '150' });
    });

    it('uses KR adapter for KOSPI stocks', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue({ symbol: '005930', market: 'KOSPI', analytics: null });
      mockRedis.get.mockResolvedValue(null);
      mockKrAdapter.getQuote.mockResolvedValue({ price: '70000' });
      mockKrAdapter.getFundamentals.mockResolvedValue({ per: '15' });

      await service.getDetail('005930');

      expect(mockKrAdapter.getQuote).toHaveBeenCalledWith('005930');
      expect(mockUsAdapter.getQuote).not.toHaveBeenCalled();
    });

    it('returns null when stock not found', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      const result = await service.getDetail('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('getChart', () => {
    const stock = { symbol: 'AAPL', market: 'NASDAQ' };
    const bars = [
      { date: '2024-01-01', open: '150', high: '155', low: '148', close: '153', volume: 1000 },
    ];

    it('returns fresh cached chart without calling adapter', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      mockRedis.get.mockResolvedValue(freshEntry(bars));

      const result = await service.getChart('AAPL', '1m');

      expect(result).toEqual(bars);
      expect(mockUsAdapter.getHistory).not.toHaveBeenCalled();
    });

    it('refreshes stale chart cache', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      mockRedis.get.mockResolvedValue(staleEntry(bars));
      const newBars = [...bars, { date: '2024-01-02', open: '153', high: '157', low: '151', close: '156', volume: 1200 }];
      mockUsAdapter.getHistory.mockResolvedValue(newBars);

      const result = await service.getChart('AAPL', '1m');

      expect(mockUsAdapter.getHistory).toHaveBeenCalledWith('AAPL', '1m');
      expect(result).toEqual(newBars);
    });

    it('returns stale chart when API fails', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      mockRedis.get.mockResolvedValue(staleEntry(bars));
      mockUsAdapter.getHistory.mockRejectedValue(new Error('Rate limit'));

      const result = await service.getChart('AAPL', '1m');

      expect(result).toEqual(bars);
    });

    it('fetches and caches chart on cache miss', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      mockRedis.get.mockResolvedValue(null);
      mockUsAdapter.getHistory.mockResolvedValue(bars);

      const result = await service.getChart('AAPL', '1w');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'chart:AAPL:1w',
        expect.any(Number),
        expect.stringContaining('"fetchedAt"'),
      );
      expect(result).toEqual(bars);
    });

    it('returns null when stock not found', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      const result = await service.getChart('UNKNOWN', '1m');

      expect(result).toBeNull();
    });

    it('uses KR adapter for KOSPI chart', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue({ symbol: '005930', market: 'KOSPI' });
      mockRedis.get.mockResolvedValue(null);
      mockKrAdapter.getHistory.mockResolvedValue(bars);

      await service.getChart('005930', '3m');

      expect(mockKrAdapter.getHistory).toHaveBeenCalledWith('005930', '3m');
      expect(mockUsAdapter.getHistory).not.toHaveBeenCalled();
    });
  });
});
