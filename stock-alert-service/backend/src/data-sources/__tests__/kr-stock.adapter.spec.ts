import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { KrStockAdapter } from '../kr-stock.adapter';

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'KIS_APP_KEY') return 'test-app-key';
    if (key === 'KIS_APP_SECRET') return 'test-app-secret';
    return undefined;
  }),
};

const mockTokenResponse = {
  access_token: 'mock-access-token',
  token_type: 'Bearer',
};

describe('KrStockAdapter', () => {
  let adapter: KrStockAdapter;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KrStockAdapter,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    adapter = module.get<KrStockAdapter>(KrStockAdapter);
  });

  describe('getQuote', () => {
    it('fetches token and returns correct StockQuote shape', async () => {
      const mockQuoteData = {
        output: {
          stck_prpr: '75000',
          prdy_vrss: '1000',
          prdy_ctrt: '1.35',
          acml_vol: '500000',
        },
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockQuoteData),
        } as Response);

      const quote = await adapter.getQuote('005930');

      expect(quote.symbol).toBe('005930');
      expect(quote.price).toBe('75000');
      expect(quote.change).toBe('1000');
      expect(quote.changePercent).toBe('1.35');
      expect(quote.volume).toBe(500000);
      expect(quote.timestamp).toBeInstanceOf(Date);
    });

    it('returns zero-value quote on error', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('network error'));

      const quote = await adapter.getQuote('005930');

      expect(quote.symbol).toBe('005930');
      expect(quote.price).toBe('0');
      expect(quote.change).toBe('0');
    });

    it('reuses cached token on second call', async () => {
      const mockQuoteData = {
        output: {
          stck_prpr: '75000',
          prdy_vrss: '1000',
          prdy_ctrt: '1.35',
          acml_vol: '500000',
        },
      };

      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockQuoteData),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockQuoteData),
        } as Response);

      await adapter.getQuote('005930');
      await adapter.getQuote('005930');

      // Token fetch should only happen once; second call reuses it
      const tokenFetchCount = fetchSpy.mock.calls.filter((call) =>
        (call[0] as string).includes('oauth2/tokenP'),
      ).length;
      expect(tokenFetchCount).toBe(1);
    });
  });

  describe('getHistory', () => {
    it('returns array of OHLCVBar for 1d period', async () => {
      const mockHistoryData = {
        output2: [
          {
            stck_bsop_date: '20240101',
            stck_oprc: '74000',
            stck_hgpr: '76000',
            stck_lwpr: '73500',
            stck_clpr: '75000',
            acml_vol: '300000',
          },
          {
            stck_bsop_date: '20240102',
            stck_oprc: '75000',
            stck_hgpr: '77000',
            stck_lwpr: '74500',
            stck_clpr: '76500',
            acml_vol: '350000',
          },
        ],
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHistoryData),
        } as Response);

      const history = await adapter.getHistory('005930', '1d');

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(2);
      expect(history[0]).toMatchObject({
        date: '20240101',
        open: '74000',
        high: '76000',
        low: '73500',
        close: '75000',
        volume: 300000,
      });
    });

    it('returns array for 1w period', async () => {
      const mockHistoryData = {
        output2: [
          {
            stck_bsop_date: '20240101',
            stck_oprc: '74000',
            stck_hgpr: '78000',
            stck_lwpr: '72000',
            stck_clpr: '76000',
            acml_vol: '2000000',
          },
        ],
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockHistoryData),
        } as Response);

      const history = await adapter.getHistory('005930', '1w');

      expect(history.length).toBe(1);
    });

    it('returns empty array on error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('timeout'));

      const history = await adapter.getHistory('005930', '1m');

      expect(history).toEqual([]);
    });

    it('returns empty array when output2 is missing', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
        } as Response);

      const history = await adapter.getHistory('005930', '1d');

      expect(history).toEqual([]);
    });
  });

  describe('getFundamentals', () => {
    it('returns per, pbr, dividendYield, week52High, week52Low', async () => {
      const mockFundamentalsData = {
        output: {
          per: '12.5',
          pbr: '1.2',
          dvnd_yied: '2.5',
          w52_hgpr: '85000',
          w52_lwpr: '60000',
        },
      };

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockFundamentalsData),
        } as Response);

      const fundamentals = await adapter.getFundamentals('005930');

      expect(fundamentals.per).toBe('12.5');
      expect(fundamentals.pbr).toBe('1.2');
      expect(fundamentals.dividendYield).toBe('2.5');
      expect(fundamentals.week52High).toBe('85000');
      expect(fundamentals.week52Low).toBe('60000');
    });

    it('returns empty object on error', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('auth failed'));

      const fundamentals = await adapter.getFundamentals('005930');

      expect(fundamentals).toEqual({});
    });
  });

  describe('OAuth token refresh', () => {
    it('fetches new token when token is expired (>23h old)', async () => {
      const mockQuoteData = {
        output: {
          stck_prpr: '75000',
          prdy_vrss: '1000',
          prdy_ctrt: '1.35',
          acml_vol: '500000',
        },
      };

      // First call: get token and quote
      const fetchSpy = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockQuoteData),
        } as Response);

      await adapter.getQuote('005930');

      // Manually expire the token by setting tokenExpiry to past
      (adapter as unknown as { tokenExpiry: Date }).tokenExpiry = new Date(
        Date.now() - 1000,
      );

      // Add mocks for next call (token refresh + quote)
      fetchSpy
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockTokenResponse),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockQuoteData),
        } as Response);

      await adapter.getQuote('005930');

      // Token endpoint should have been called twice (initial + refresh)
      const tokenFetchCount = fetchSpy.mock.calls.filter((call) =>
        (call[0] as string).includes('oauth2/tokenP'),
      ).length;
      expect(tokenFetchCount).toBe(2);
    });

    it('returns null token and throws when token fetch fails', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new Error('network down'));

      const quote = await adapter.getQuote('005930');

      // getQuote catches error from ensureToken and returns fallback
      expect(quote.price).toBe('0');
    });
  });
});
