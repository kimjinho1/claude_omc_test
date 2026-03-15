import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { KrStockAdapter } from '../../data-sources/kr-stock.adapter';
import { UsStockAdapter } from '../../data-sources/us-stock.adapter';
import { Decimal } from '@prisma/client/runtime/library';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: jest.Mocked<PrismaService>;
  let krAdapter: jest.Mocked<KrStockAdapter>;
  let usAdapter: jest.Mocked<UsStockAdapter>;

  beforeEach(async () => {
    const mockPrisma = {
      stock: { findMany: jest.fn() },
      stockPrice: { create: jest.fn() },
      stockAnalytics: { upsert: jest.fn() },
    };

    const mockKrAdapter = { getQuote: jest.fn() };
    const mockUsAdapter = { getQuote: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: KrStockAdapter, useValue: mockKrAdapter },
        { provide: UsStockAdapter, useValue: mockUsAdapter },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
    prisma = module.get(PrismaService);
    krAdapter = module.get(KrStockAdapter);
    usAdapter = module.get(UsStockAdapter);
  });

  describe('updateAnalytics', () => {
    it('records current prices and upserts analytics for KR market', async () => {
      const stocks = [{ symbol: '005930', market: 'KOSPI' }];
      const stocksWithHistory = [
        {
          symbol: '005930',
          market: 'KOSPI',
          priceHistory: [
            { price: new Decimal('85000') },
            { price: new Decimal('90000') },
            { price: new Decimal('80000') },
          ],
        },
      ];

      (prisma.stock.findMany as jest.Mock)
        .mockResolvedValueOnce(stocks)
        .mockResolvedValueOnce(stocksWithHistory);
      (prisma.stockPrice.create as jest.Mock).mockResolvedValue({});
      (prisma.stockAnalytics.upsert as jest.Mock).mockResolvedValue({});
      krAdapter.getQuote.mockResolvedValue({ symbol: '005930', price: '88000', change: '0', changePercent: '0', volume: 1000000, timestamp: new Date() });

      await service.updateAnalytics('KR');

      expect(prisma.stock.findMany).toHaveBeenCalledTimes(2);
      expect(krAdapter.getQuote).toHaveBeenCalledWith('005930');
      expect(prisma.stockPrice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ symbol: '005930' }),
        }),
      );
      expect(prisma.stockAnalytics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { symbol: '005930' },
          update: expect.objectContaining({ high6m: new Decimal('90000') }),
          create: expect.objectContaining({ symbol: '005930', high6m: new Decimal('90000') }),
        }),
      );
    });

    it('uses US adapter for US market', async () => {
      const stocks = [{ symbol: 'AAPL', market: 'NASDAQ' }];
      const stocksWithHistory = [
        { symbol: 'AAPL', market: 'NASDAQ', priceHistory: [{ price: new Decimal('200') }] },
      ];

      (prisma.stock.findMany as jest.Mock)
        .mockResolvedValueOnce(stocks)
        .mockResolvedValueOnce(stocksWithHistory);
      (prisma.stockPrice.create as jest.Mock).mockResolvedValue({});
      (prisma.stockAnalytics.upsert as jest.Mock).mockResolvedValue({});
      usAdapter.getQuote.mockResolvedValue({ symbol: 'AAPL', price: '195', change: '0', changePercent: '0', volume: 50000000, timestamp: new Date() });

      await service.updateAnalytics('US');

      expect(usAdapter.getQuote).toHaveBeenCalledWith('AAPL');
      expect(krAdapter.getQuote).not.toHaveBeenCalled();
    });

    it('skips stocks with no price history', async () => {
      const stocks = [{ symbol: 'EMPTY', market: 'KOSPI' }];
      const stocksWithHistory = [{ symbol: 'EMPTY', market: 'KOSPI', priceHistory: [] }];

      (prisma.stock.findMany as jest.Mock)
        .mockResolvedValueOnce(stocks)
        .mockResolvedValueOnce(stocksWithHistory);
      (prisma.stockPrice.create as jest.Mock).mockResolvedValue({});
      krAdapter.getQuote.mockResolvedValue({ symbol: 'EMPTY', price: '50000', change: '0', changePercent: '0', timestamp: new Date() });

      await service.updateAnalytics('KR');

      expect(prisma.stockAnalytics.upsert).not.toHaveBeenCalled();
    });

    it('new high replaces old: computes correct 6-month high', async () => {
      const priceHistory = [
        { price: new Decimal('100') },
        { price: new Decimal('150') },
        { price: new Decimal('120') },
      ];
      const stocksWithHistory = [{ symbol: 'TEST', market: 'KOSPI', priceHistory }];

      (prisma.stock.findMany as jest.Mock)
        .mockResolvedValueOnce([{ symbol: 'TEST', market: 'KOSPI' }])
        .mockResolvedValueOnce(stocksWithHistory);
      (prisma.stockPrice.create as jest.Mock).mockResolvedValue({});
      (prisma.stockAnalytics.upsert as jest.Mock).mockResolvedValue({});
      krAdapter.getQuote.mockResolvedValue({ symbol: 'TEST', price: '110', change: '0', changePercent: '0', volume: 500, timestamp: new Date() });

      await service.updateAnalytics('KR');

      const upsertCall = (prisma.stockAnalytics.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.update.high6m.toString()).toBe('150');
    });

    it('same high no change: upserts with identical high6m value', async () => {
      const priceHistory = [
        { price: new Decimal('200') },
        { price: new Decimal('200') },
      ];
      const stocksWithHistory = [{ symbol: 'FLAT', market: 'KOSPI', priceHistory }];

      (prisma.stock.findMany as jest.Mock)
        .mockResolvedValueOnce([{ symbol: 'FLAT', market: 'KOSPI' }])
        .mockResolvedValueOnce(stocksWithHistory);
      (prisma.stockPrice.create as jest.Mock).mockResolvedValue({});
      (prisma.stockAnalytics.upsert as jest.Mock).mockResolvedValue({});
      krAdapter.getQuote.mockResolvedValue({ symbol: 'FLAT', price: '200', change: '0', changePercent: '0', volume: 0, timestamp: new Date() });

      await service.updateAnalytics('KR');

      const upsertCall = (prisma.stockAnalytics.upsert as jest.Mock).mock.calls[0][0];
      expect(upsertCall.update.high6m.toString()).toBe('200');
    });

    it('6-month window cutoff: uses 180-day lookback', async () => {
      (prisma.stock.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await service.updateAnalytics('KR');

      const secondCall = (prisma.stock.findMany as jest.Mock).mock.calls[1][0];
      const cutoff: Date = secondCall.include.priceHistory.where.recordedAt.gte;
      expect(cutoff).toBeInstanceOf(Date);

      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      expect(Math.abs(cutoff.getTime() - sixMonthsAgo.getTime())).toBeLessThan(5000);
    });

    it('continues processing if getQuote fails for one stock', async () => {
      const stocks = [
        { symbol: 'FAIL', market: 'KOSPI' },
        { symbol: 'OK', market: 'KOSPI' },
      ];
      const stocksWithHistory = [
        { symbol: 'FAIL', market: 'KOSPI', priceHistory: [] },
        { symbol: 'OK', market: 'KOSPI', priceHistory: [{ price: new Decimal('100') }] },
      ];

      (prisma.stock.findMany as jest.Mock)
        .mockResolvedValueOnce(stocks)
        .mockResolvedValueOnce(stocksWithHistory);
      (prisma.stockPrice.create as jest.Mock).mockResolvedValue({});
      (prisma.stockAnalytics.upsert as jest.Mock).mockResolvedValue({});
      krAdapter.getQuote
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ symbol: 'OK', price: '100', change: '0', changePercent: '0', volume: 1000, timestamp: new Date() });

      await expect(service.updateAnalytics('KR')).resolves.not.toThrow();
    });
  });
});
