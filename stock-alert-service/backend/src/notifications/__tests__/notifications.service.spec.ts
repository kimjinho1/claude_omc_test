jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import webpush from 'web-push';

const mockSendNotification = webpush.sendNotification as jest.MockedFunction<
  typeof webpush.sendNotification
>;

const mockPrisma = {
  pushSubscription: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    delete: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'VAPID_PUBLIC_KEY') return 'test-public-key';
    if (key === 'VAPID_PRIVATE_KEY') return 'test-private-key';
    if (key === 'VAPID_SUBJECT') return 'mailto:test@example.com';
    return undefined;
  }),
};

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('subscribe', () => {
    it('saves PushSubscription to DB via upsert by userId+endpoint', async () => {
      const userId = 'user-1';
      const subscription = {
        endpoint: 'https://push.example.com/sub1',
        keys: { p256dh: 'key-p256dh', auth: 'key-auth' },
      };

      const mockRecord = {
        id: 'sub-id-1',
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      };
      mockPrisma.pushSubscription.upsert.mockResolvedValue(mockRecord);

      const result = await service.subscribe(userId, subscription);

      expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledWith({
        where: { userId_endpoint: { userId, endpoint: subscription.endpoint } },
        update: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
        create: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });
      expect(result).toEqual(mockRecord);
    });

    it('updates existing subscription with new keys on re-subscribe', async () => {
      const userId = 'user-1';
      const subscription = {
        endpoint: 'https://push.example.com/sub1',
        keys: { p256dh: 'new-key-p256dh', auth: 'new-key-auth' },
      };

      mockPrisma.pushSubscription.upsert.mockResolvedValue({
        id: 'sub-id-1',
        userId,
        endpoint: subscription.endpoint,
        p256dh: 'new-key-p256dh',
        auth: 'new-key-auth',
      });

      await service.subscribe(userId, subscription);

      expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalledTimes(1);
      const [callArg] = mockPrisma.pushSubscription.upsert.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect((callArg as { update: { p256dh: string } }).update.p256dh).toBe(
        'new-key-p256dh',
      );
    });
  });

  describe('sendToUser', () => {
    it('retrieves all subscriptions for user and calls sendNotification for each', async () => {
      const userId = 'user-1';
      const payload = {
        title: 'Alert',
        body: 'Price dropped',
        symbol: 'AAPL',
        level: 10,
      };
      const subs = [
        {
          id: 'sub-1',
          userId,
          endpoint: 'https://push.example.com/sub1',
          p256dh: 'key1',
          auth: 'auth1',
        },
        {
          id: 'sub-2',
          userId,
          endpoint: 'https://push.example.com/sub2',
          p256dh: 'key2',
          auth: 'auth2',
        },
      ];

      mockPrisma.pushSubscription.findMany.mockResolvedValue(subs);
      mockSendNotification.mockResolvedValue(
        {} as unknown as import('web-push').SendResult,
      );

      await service.sendToUser(userId, payload);

      expect(mockPrisma.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
      expect(mockSendNotification).toHaveBeenCalledWith(
        {
          endpoint: subs[0].endpoint,
          keys: { p256dh: subs[0].p256dh, auth: subs[0].auth },
        },
        JSON.stringify(payload),
      );
      expect(mockSendNotification).toHaveBeenCalledWith(
        {
          endpoint: subs[1].endpoint,
          keys: { p256dh: subs[1].p256dh, auth: subs[1].auth },
        },
        JSON.stringify(payload),
      );
    });

    it('does nothing when user has no subscriptions', async () => {
      mockPrisma.pushSubscription.findMany.mockResolvedValue([]);

      await service.sendToUser('user-no-subs', { title: 'test' });

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('removes invalid endpoint (410 status) and continues sending to others', async () => {
      const userId = 'user-1';
      const payload = {
        title: 'Alert',
        body: 'Price dropped',
        symbol: 'AAPL',
        level: 10,
      };
      const subs = [
        {
          id: 'sub-gone',
          userId,
          endpoint: 'https://push.example.com/gone',
          p256dh: 'key1',
          auth: 'auth1',
        },
        {
          id: 'sub-valid',
          userId,
          endpoint: 'https://push.example.com/valid',
          p256dh: 'key2',
          auth: 'auth2',
        },
      ];

      mockPrisma.pushSubscription.findMany.mockResolvedValue(subs);

      const goneError = Object.assign(new Error('Gone'), { statusCode: 410 });
      mockSendNotification
        .mockRejectedValueOnce(goneError)
        .mockResolvedValueOnce({} as unknown as import('web-push').SendResult);
      mockPrisma.pushSubscription.delete.mockResolvedValue({});

      await service.sendToUser(userId, payload);

      expect(mockPrisma.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: 'sub-gone' },
      });
      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });

    it('logs error for non-410 failures but does not delete subscription', async () => {
      const userId = 'user-1';
      const payload = { title: 'Alert', body: 'Test' };
      const subs = [
        {
          id: 'sub-1',
          userId,
          endpoint: 'https://push.example.com/sub1',
          p256dh: 'key1',
          auth: 'auth1',
        },
      ];

      mockPrisma.pushSubscription.findMany.mockResolvedValue(subs);
      mockSendNotification.mockRejectedValueOnce(
        new Error('temporary failure'),
      );

      await service.sendToUser(userId, payload);

      expect(mockPrisma.pushSubscription.delete).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribe', () => {
    it('deletes subscription from DB by userId and endpoint', async () => {
      const userId = 'user-1';
      const endpoint = 'https://push.example.com/sub1';

      mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      await service.unsubscribe(userId, endpoint);

      expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { userId, endpoint },
      });
    });
  });
});
