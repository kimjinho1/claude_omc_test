import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesController } from '../favorites.controller';
import { FavoritesService } from '../favorites.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

const mockFavoritesService = {
  findAll: jest.fn(),
  add: jest.fn(),
  remove: jest.fn(),
};

const mockUser = { id: 'user-123' };

describe('FavoritesController', () => {
  let controller: FavoritesController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        { provide: FavoritesService, useValue: mockFavoritesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FavoritesController>(FavoritesController);
  });

  describe('findAll', () => {
    it('returns favorites for the current user', async () => {
      const favorites = [
        { id: '1', userId: 'user-123', symbol: 'AAPL', stock: { symbol: 'AAPL' } },
      ];
      mockFavoritesService.findAll.mockResolvedValue(favorites);

      const result = await controller.findAll(mockUser);

      expect(mockFavoritesService.findAll).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(favorites);
    });

    it('returns empty array when user has no favorites', async () => {
      mockFavoritesService.findAll.mockResolvedValue([]);

      const result = await controller.findAll(mockUser);

      expect(result).toEqual([]);
    });
  });

  describe('add', () => {
    it('adds a favorite and converts symbol to uppercase', async () => {
      const favorite = { id: '1', userId: 'user-123', symbol: 'AAPL' };
      mockFavoritesService.add.mockResolvedValue(favorite);

      const result = await controller.add(mockUser, 'aapl');

      expect(mockFavoritesService.add).toHaveBeenCalledWith('user-123', 'AAPL');
      expect(result).toEqual(favorite);
    });

    it('passes already-uppercase symbol unchanged', async () => {
      mockFavoritesService.add.mockResolvedValue({ id: '1' });

      await controller.add(mockUser, 'TSLA');

      expect(mockFavoritesService.add).toHaveBeenCalledWith('user-123', 'TSLA');
    });
  });

  describe('remove', () => {
    it('removes a favorite and converts symbol to uppercase', async () => {
      const deleted = { id: '1', userId: 'user-123', symbol: '005930' };
      mockFavoritesService.remove.mockResolvedValue(deleted);

      const result = await controller.remove(mockUser, '005930');

      expect(mockFavoritesService.remove).toHaveBeenCalledWith('user-123', '005930');
      expect(result).toEqual(deleted);
    });

    it('converts lowercase symbol to uppercase before removing', async () => {
      mockFavoritesService.remove.mockResolvedValue({ id: '1' });

      await controller.remove(mockUser, 'msft');

      expect(mockFavoritesService.remove).toHaveBeenCalledWith('user-123', 'MSFT');
    });
  });

  describe('JwtAuthGuard', () => {
    it('applies JwtAuthGuard at controller level', () => {
      const guards = Reflect.getMetadata('__guards__', FavoritesController);
      expect(guards).toBeDefined();
      expect(guards.some((g: unknown) => g === JwtAuthGuard)).toBe(true);
    });
  });
});
