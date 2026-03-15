import { Test, TestingModule } from '@nestjs/testing';
import { StocksController } from '../stocks.controller';
import { StocksService } from '../stocks.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

const mockStocksService = {
  findAll: jest.fn(),
  search: jest.fn(),
  getDetail: jest.fn(),
  getChart: jest.fn(),
  getQuote: jest.fn(),
};

describe('StocksController', () => {
  let controller: StocksController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StocksController],
      providers: [
        { provide: StocksService, useValue: mockStocksService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<StocksController>(StocksController);
  });

  describe('findAll', () => {
    it('returns all stocks with no market filter', async () => {
      const stocks = [{ symbol: 'AAPL' }];
      mockStocksService.findAll.mockResolvedValue(stocks);

      const result = await controller.findAll(undefined);

      expect(mockStocksService.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(stocks);
    });

    it('passes market filter to service', async () => {
      mockStocksService.findAll.mockResolvedValue([]);

      await controller.findAll('KR');

      expect(mockStocksService.findAll).toHaveBeenCalledWith('KR');
    });
  });

  describe('search', () => {
    it('passes query to service', async () => {
      const stocks = [{ symbol: 'AAPL', name: 'Apple Inc.' }];
      mockStocksService.search.mockResolvedValue(stocks);

      const result = await controller.search('apple');

      expect(mockStocksService.search).toHaveBeenCalledWith('apple');
      expect(result).toEqual(stocks);
    });

    it('passes empty string when query is undefined', async () => {
      mockStocksService.search.mockResolvedValue([]);

      await controller.search(undefined as unknown as string);

      expect(mockStocksService.search).toHaveBeenCalledWith('');
    });
  });

  describe('getDetail', () => {
    it('returns stock detail for given symbol', async () => {
      const detail = { symbol: 'AAPL', price: 150, per: 28.5 };
      mockStocksService.getDetail.mockResolvedValue(detail);

      const result = await controller.getDetail('AAPL');

      expect(mockStocksService.getDetail).toHaveBeenCalledWith('AAPL');
      expect(result).toEqual(detail);
    });

    it('returns null when stock not found', async () => {
      mockStocksService.getDetail.mockResolvedValue(null);

      const result = await controller.getDetail('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('getChart', () => {
    it('returns chart data for default period 1d', async () => {
      const chartData = [{ date: '2024-01-01', close: 150 }];
      mockStocksService.getChart.mockResolvedValue(chartData);

      const result = await controller.getChart('AAPL', '1d');

      expect(mockStocksService.getChart).toHaveBeenCalledWith('AAPL', '1d');
      expect(result).toEqual(chartData);
    });

    it('passes period parameter to service', async () => {
      mockStocksService.getChart.mockResolvedValue([]);

      await controller.getChart('AAPL', '1m');

      expect(mockStocksService.getChart).toHaveBeenCalledWith('AAPL', '1m');
    });
  });

  describe('getQuote', () => {
    it('returns live quote for symbol', async () => {
      const quote = { price: 155, volume: 5000000 };
      mockStocksService.getQuote.mockResolvedValue(quote);

      const result = await controller.getQuote('AAPL');

      expect(mockStocksService.getQuote).toHaveBeenCalledWith('AAPL');
      expect(result).toEqual(quote);
    });
  });

  describe('JwtAuthGuard', () => {
    it('applies JwtAuthGuard at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', StocksController);
      expect(guards).toBeDefined();
      expect(guards.some((g: unknown) => g === JwtAuthGuard)).toBe(true);
    });
  });
});
