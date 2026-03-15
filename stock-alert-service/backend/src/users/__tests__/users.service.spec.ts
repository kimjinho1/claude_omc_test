/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    alertSetting: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.findById('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(result).toEqual(user);
    });

    it('returns null when user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('returns user when found by email', async () => {
      const user = { id: 'user-1', email: 'test@example.com' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.findByEmail('test@example.com');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(user);
    });
  });

  describe('upsert (syncUser)', () => {
    it('creates new user if not exists', async () => {
      const newUser = {
        id: 'new-user',
        email: 'new@example.com',
        name: 'New User',
        image: 'https://example.com/avatar.jpg',
        provider: 'google',
      };
      (prisma.user.upsert as jest.Mock).mockResolvedValue(newUser);

      const dto = {
        email: 'new@example.com',
        name: 'New User',
        image: 'https://example.com/avatar.jpg',
        provider: 'google',
      };
      const result = await service.upsert(dto);

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { email: dto.email },
        update: { name: dto.name, image: dto.image },
        create: {
          email: dto.email,
          name: dto.name,
          image: dto.image,
          provider: dto.provider,
        },
      });
      expect(result).toEqual(newUser);
    });

    it('updates existing user name and image', async () => {
      const updatedUser = {
        id: 'existing-user',
        email: 'existing@example.com',
        name: 'Updated Name',
        image: 'https://example.com/new-avatar.jpg',
        provider: 'google',
      };
      (prisma.user.upsert as jest.Mock).mockResolvedValue(updatedUser);

      const dto = {
        email: 'existing@example.com',
        name: 'Updated Name',
        image: 'https://example.com/new-avatar.jpg',
        provider: 'google',
      };
      const result = await service.upsert(dto);

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { email: dto.email },
        update: { name: dto.name, image: dto.image },
        create: expect.any(Object),
      });
      expect(result).toEqual(updatedUser);
    });

    it('handles upsert with undefined optional fields', async () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        provider: 'google',
      };
      (prisma.user.upsert as jest.Mock).mockResolvedValue(user);

      await service.upsert({ email: 'test@example.com', provider: 'google' });

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        update: { name: undefined, image: undefined },
        create: {
          email: 'test@example.com',
          name: undefined,
          image: undefined,
          provider: 'google',
        },
      });
    });
  });

  describe('getAlertSettings', () => {
    it('returns alert settings for user', async () => {
      const settings = { userId: 'user-1', thresholds: [10, 20, 30] };
      (prisma.alertSetting.findUnique as jest.Mock).mockResolvedValue(settings);

      const result = await service.getAlertSettings('user-1');

      expect(prisma.alertSetting.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toEqual(settings);
    });

    it('returns null when no alert settings exist', async () => {
      (prisma.alertSetting.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getAlertSettings('user-1');

      expect(result).toBeNull();
    });
  });

  describe('upsertAlertSettings', () => {
    it('creates alert settings if none exist', async () => {
      const created = { userId: 'user-1', thresholds: [10, 20] };
      (prisma.alertSetting.upsert as jest.Mock).mockResolvedValue(created);

      const result = await service.upsertAlertSettings('user-1', [10, 20]);

      expect(prisma.alertSetting.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { thresholds: [10, 20] },
        create: { userId: 'user-1', thresholds: [10, 20] },
      });
      expect(result).toEqual(created);
    });

    it('updates existing alert settings with new thresholds', async () => {
      const updated = { userId: 'user-1', thresholds: [15, 25, 35] };
      (prisma.alertSetting.upsert as jest.Mock).mockResolvedValue(updated);

      const result = await service.upsertAlertSettings('user-1', [15, 25, 35]);

      expect(prisma.alertSetting.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { thresholds: [15, 25, 35] },
        create: { userId: 'user-1', thresholds: [15, 25, 35] },
      });
      expect(result).toEqual(updated);
    });

    it('handles empty thresholds array', async () => {
      const cleared = { userId: 'user-1', thresholds: [] };
      (prisma.alertSetting.upsert as jest.Mock).mockResolvedValue(cleared);

      const result = await service.upsertAlertSettings('user-1', []);

      expect(prisma.alertSetting.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        update: { thresholds: [] },
        create: { userId: 'user-1', thresholds: [] },
      });
      expect(result).toEqual(cleared);
    });
  });
});
