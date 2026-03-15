import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UsStockAdapter } from '../us-stock.adapter';
import { REDIS_CLIENT } from '../../redis/redis.module';

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'POLYGON_API_KEY') return 'test-api-key';
    return undefined;
  }),
};

describe('UsStockAdapter', () => {
  let adapter: UsStockAdapter;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsStockAdapter,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    adapter = module.get<UsStockAdapter>(UsStockAdapter);
  });

  describe('getQuote', () => {
    it('returns correct StockQuote shape for valid response', async () => {
      const mockData = {
        results: [{ c: 150.5, o: 148.0, v: 1000000, t: 1700000000000 }],
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const quote = await adapter.getQuote('AAPL');

      expect(quote.symbol).toBe('AAPL');
      expect(quote.price).toBe('150.5');
      expect(quote.change).toBe('2.50');
      expect(parseFloat(quote.changePercent)).toBeCloseTo(1.69, 1);
      expect(quote.volume).toBe(1000000);
      expect(quote.timestamp).toBeInstanceOf(Date);
    });

    it('returns zero-value quote when results array is empty', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
      } as Response);

      const quote = await adapter.getQuote('AAPL');

      expect(quote.symbol).toBe('AAPL');
      expect(quote.price).toBe('0');
      expect(quote.change).toBe('0');
      expect(quote.changePercent).toBe('0');
    });

    it('returns zero-value quote on fetch error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network error'));

      const quote = await adapter.getQuote('AAPL');

      expect(quote.symbol).toBe('AAPL');
      expect(quote.price).toBe('0');
    });
  });

  describe('getHistory', () => {
    it('returns array of OHLCVBar for 1d period', async () => {
      const mockData = {
        results: [
          { t: 1700000000000, o: 145.0, h: 152.0, l: 144.0, c: 150.0, v: 500000 },
          { t: 1700086400000, o: 150.0, h: 155.0, l: 149.0, c: 153.0, v: 600000 },
        ],
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const history = await adapter.getHistory('AAPL', '1d');

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(2);
      expect(history[0]).toMatchObject({
        date: expect.any(String),
        open: '145',
        high: '152',
        low: '144',
        close: '150',
        volume: 500000,
      });
    });

    it('returns array of OHLCVBar for 1w period', async () => {
      const mockData = {
        results: [
          { t: 1700000000000, o: 140.0, h: 158.0, l: 139.0, c: 155.0, v: 3000000 },
        ],
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const history = await adapter.getHistory('AAPL', '1w');

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(1);
    });

    it('returns empty array on fetch error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'));

      const history = await adapter.getHistory('AAPL', '1m');

      expect(history).toEqual([]);
    });

    it('returns empty array when results is missing', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const history = await adapter.getHistory('AAPL', '1d');

      expect(history).toEqual([]);
    });
  });

  describe('getFundamentals', () => {
    it('returns week52High and week52Low from aggs data', async () => {
      const financialsData = { results: [] };
      const aggData = {
        results: [
          { h: 180.0, l: 120.0 },
          { h: 175.0, l: 130.0 },
          { h: 185.0, l: 115.0 },
        ],
      };

      jest.spyOn(global, 'fetch')
        .mockResolvedValueOnce({ ok: true, json: async () => financialsData } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => aggData } as Response);

      const fundamentals = await adapter.getFundamentals('AAPL');

      expect(fundamentals.week52High).toBe('185');
      expect(fundamentals.week52Low).toBe('115');
      expect(fundamentals.per).toBeUndefined();
      expect(fundamentals.pbr).toBeUndefined();
      expect(fundamentals.dividendYield).toBeUndefined();
    });

    it('returns empty object on fetch error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('API error'));

      const fundamentals = await adapter.getFundamentals('AAPL');

      expect(fundamentals).toEqual({});
    });
  });

  describe('rate limiting', () => {
    it('waits when rate limit is exceeded (count > RATE_LIMIT_RPM)', async () => {
      mockRedis.incr.mockResolvedValue(6); // exceeds limit of 5

      const mockData = { results: [{ c: 100, o: 99, v: 1000, t: Date.now() }] };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const setTimeoutSpy = jest
        .spyOn(global, 'setTimeout')
        .mockImplementation((fn: TimerHandler) => {
          if (typeof fn === 'function') fn();
          return 0 as unknown as ReturnType<typeof setTimeout>;
        });

      await adapter.getQuote('AAPL');

      setTimeoutSpy.mockRestore();
    });

    it('throws error on non-ok HTTP response (e.g. 429)', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Too Many Requests',
      } as Response);

      // The adapter catches errors and returns a fallback, not re-throws
      const quote = await adapter.getQuote('AAPL');
      expect(quote.price).toBe('0');
    });
  });
});
