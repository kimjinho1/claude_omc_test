import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUsersService = {
    getAlertSettings: jest.fn(),
    upsertAlertSettings: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('getAlertSettings (GET /users/alert-settings)', () => {
    it('returns alert settings for current user', async () => {
      const settings = { userId: 'user-1', thresholds: [10, 20, 30] };
      mockUsersService.getAlertSettings.mockResolvedValue(settings);

      const result = await controller.getAlertSettings({ id: 'user-1' });

      expect(usersService.getAlertSettings).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(settings);
    });

    it('returns null when no settings configured', async () => {
      mockUsersService.getAlertSettings.mockResolvedValue(null);

      const result = await controller.getAlertSettings({ id: 'user-1' });

      expect(result).toBeNull();
    });
  });

  describe('updateAlertSettings (PUT /users/alert-settings)', () => {
    it('updates alert settings thresholds', async () => {
      const updated = { userId: 'user-1', thresholds: [15, 25] };
      mockUsersService.upsertAlertSettings.mockResolvedValue(updated);

      const result = await controller.updateAlertSettings(
        { id: 'user-1' },
        { thresholds: [15, 25] },
      );

      expect(usersService.upsertAlertSettings).toHaveBeenCalledWith('user-1', [15, 25]);
      expect(result).toEqual(updated);
    });

    it('creates alert settings if none exist (upsert behavior)', async () => {
      const created = { userId: 'user-new', thresholds: [10] };
      mockUsersService.upsertAlertSettings.mockResolvedValue(created);

      const result = await controller.updateAlertSettings(
        { id: 'user-new' },
        { thresholds: [10] },
      );

      expect(usersService.upsertAlertSettings).toHaveBeenCalledWith('user-new', [10]);
      expect(result).toEqual(created);
    });

    it('accepts all valid threshold levels', async () => {
      const allThresholds = [10, 15, 20, 25, 30];
      const saved = { userId: 'user-1', thresholds: allThresholds };
      mockUsersService.upsertAlertSettings.mockResolvedValue(saved);

      const result = await controller.updateAlertSettings(
        { id: 'user-1' },
        { thresholds: allThresholds },
      );

      expect(usersService.upsertAlertSettings).toHaveBeenCalledWith('user-1', allThresholds);
      expect(result).toEqual(saved);
    });

    it('accepts empty thresholds to clear all alerts', async () => {
      const cleared = { userId: 'user-1', thresholds: [] };
      mockUsersService.upsertAlertSettings.mockResolvedValue(cleared);

      const result = await controller.updateAlertSettings(
        { id: 'user-1' },
        { thresholds: [] },
      );

      expect(usersService.upsertAlertSettings).toHaveBeenCalledWith('user-1', []);
      expect(result).toEqual(cleared);
    });
  });
});
