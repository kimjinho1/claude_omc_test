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

describe('StocksService', () => {
  let service: StocksService;

  beforeEach(async () => {
    jest.clearAllMocks();

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
            OR: expect.arrayContaining([
              { symbol: { contains: 'AAPL' } },
            ]),
          }),
        }),
      );
    });
  });

  describe('getDetail', () => {
    it('returns cached detail on cache hit', async () => {
      const cached = { symbol: 'AAPL', price: 150 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getDetail('AAPL');

      expect(mockRedis.get).toHaveBeenCalledWith('detail:AAPL');
      expect(mockPrisma.stock.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(cached);
    });

    it('fetches from DB and adapter on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      const stock = { symbol: 'AAPL', market: 'NASDAQ', analytics: null };
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      const quote = { price: 150, volume: 1000000 };
      const fundamentals = { per: 28.5, pbr: 12.1 };
      mockUsAdapter.getQuote.mockResolvedValue(quote);
      mockUsAdapter.getFundamentals.mockResolvedValue(fundamentals);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.getDetail('AAPL');

      expect(mockPrisma.stock.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
        include: { analytics: true },
      });
      expect(mockUsAdapter.getQuote).toHaveBeenCalledWith('AAPL');
      expect(mockUsAdapter.getFundamentals).toHaveBeenCalledWith('AAPL');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'detail:AAPL',
        3600,
        expect.any(String),
      );
      expect(result).toMatchObject({ symbol: 'AAPL', price: 150 });
    });

    it('uses KR adapter for KOSPI stocks', async () => {
      mockRedis.get.mockResolvedValue(null);
      const stock = { symbol: '005930', market: 'KOSPI', analytics: null };
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      mockKrAdapter.getQuote.mockResolvedValue({ price: 70000 });
      mockKrAdapter.getFundamentals.mockResolvedValue({ per: 15 });
      mockRedis.setex.mockResolvedValue('OK');

      await service.getDetail('005930');

      expect(mockKrAdapter.getQuote).toHaveBeenCalledWith('005930');
      expect(mockUsAdapter.getQuote).not.toHaveBeenCalled();
    });

    it('returns null when stock not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      const result = await service.getDetail('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('getQuote', () => {
    it('returns cached quote on cache hit', async () => {
      const cached = { price: 150 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));

      const result = await service.getQuote('AAPL');

      expect(mockRedis.get).toHaveBeenCalledWith('quote:AAPL');
      expect(result).toEqual(cached);
    });

    it('fetches live quote and caches on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.stock.findUnique.mockResolvedValue({ symbol: 'AAPL', market: 'NYSE' });
      const quote = { price: 180 };
      mockUsAdapter.getQuote.mockResolvedValue(quote);
      mockRedis.setex.mockResolvedValue('OK');

      const result = await service.getQuote('AAPL');

      expect(mockRedis.setex).toHaveBeenCalledWith('quote:AAPL', 30, JSON.stringify(quote));
      expect(result).toEqual(quote);
    });

    it('returns null when stock not found', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      const result = await service.getQuote('UNKNOWN');

      expect(result).toBeNull();
    });
  });
});
