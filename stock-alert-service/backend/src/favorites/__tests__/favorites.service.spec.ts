import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FavoritesService } from '../favorites.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  stock: {
    findUnique: jest.fn(),
  },
  favorite: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
};

describe('FavoritesService', () => {
  let service: FavoritesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
  });

  describe('findAll', () => {
    it('returns favorites list for user', async () => {
      const favorites = [
        {
          id: '1',
          userId: 'u1',
          symbol: 'AAPL',
          stock: { symbol: 'AAPL', analytics: null },
        },
      ];
      mockPrisma.favorite.findMany.mockResolvedValue(favorites);

      const result = await service.findAll('u1');

      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        include: { stock: { include: { analytics: true } } },
      });
      expect(result).toEqual(favorites);
    });

    it('returns empty array when no favorites', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([]);

      const result = await service.findAll('u1');

      expect(result).toEqual([]);
    });
  });

  describe('add', () => {
    it('creates a favorite successfully', async () => {
      const stock = { symbol: 'AAPL' };
      const favorite = { id: '1', userId: 'u1', symbol: 'AAPL' };
      mockPrisma.stock.findUnique.mockResolvedValue(stock);
      mockPrisma.favorite.create.mockResolvedValue(favorite);

      const result = await service.add('u1', 'AAPL');

      expect(mockPrisma.stock.findUnique).toHaveBeenCalledWith({
        where: { symbol: 'AAPL' },
      });
      expect(mockPrisma.favorite.create).toHaveBeenCalledWith({
        data: { userId: 'u1', symbol: 'AAPL' },
      });
      expect(result).toEqual(favorite);
    });

    it('throws NotFoundException when stock does not exist', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue(null);

      await expect(service.add('u1', 'UNKNOWN')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.favorite.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException on duplicate favorite', async () => {
      mockPrisma.stock.findUnique.mockResolvedValue({ symbol: 'AAPL' });
      mockPrisma.favorite.create.mockRejectedValue(
        new Error('Unique constraint failed'),
      );

      await expect(service.add('u1', 'AAPL')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('remove', () => {
    it('removes a favorite successfully', async () => {
      const favorite = { id: '1', userId: 'u1', symbol: 'AAPL' };
      mockPrisma.favorite.findUnique.mockResolvedValue(favorite);
      mockPrisma.favorite.delete.mockResolvedValue(favorite);

      const result = await service.remove('u1', 'AAPL');

      expect(mockPrisma.favorite.findUnique).toHaveBeenCalledWith({
        where: { userId_symbol: { userId: 'u1', symbol: 'AAPL' } },
      });
      expect(mockPrisma.favorite.delete).toHaveBeenCalledWith({
        where: { userId_symbol: { userId: 'u1', symbol: 'AAPL' } },
      });
      expect(result).toEqual(favorite);
    });

    it('throws NotFoundException when favorite does not exist', async () => {
      mockPrisma.favorite.findUnique.mockResolvedValue(null);

      await expect(service.remove('u1', 'AAPL')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.favorite.delete).not.toHaveBeenCalled();
    });
  });

  describe('getFavoriteSymbols', () => {
    it('returns array of symbols for user', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([
        { symbol: 'AAPL' },
        { symbol: '005930' },
      ]);

      const result = await service.getFavoriteSymbols('u1');

      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
      });
      expect(result).toEqual(['AAPL', '005930']);
    });

    it('returns empty array when user has no favorites', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([]);

      const result = await service.getFavoriteSymbols('u1');

      expect(result).toEqual([]);
    });
  });
});
