import { Test, TestingModule } from '@nestjs/testing';
import {
  NotificationWorker,
  NotificationJobData,
} from '../notification.worker';
import { NotificationsService } from '../notifications.service';
import { Job } from 'bullmq';

const mockNotificationsService = {
  sendToUser: jest.fn(),
};

function createMockJob(
  data: NotificationJobData,
  id = 'job-1',
): Job<NotificationJobData> {
  return {
    id,
    data,
    name: 'send-notification',
  } as unknown as Job<NotificationJobData>;
}

describe('NotificationWorker', () => {
  let worker: NotificationWorker;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationWorker,
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    worker = module.get<NotificationWorker>(NotificationWorker);
  });

  describe('process', () => {
    it('calls notificationsService.sendToUser with correct userId and payload', async () => {
      const jobData: NotificationJobData = {
        userId: 'user-1',
        payload: {
          title: 'Stock Alert',
          body: 'AAPL dropped 10% from 6-month high',
          symbol: 'AAPL',
          level: 10,
        },
      };
      const job = createMockJob(jobData);
      mockNotificationsService.sendToUser.mockResolvedValue(undefined);

      await worker.process(job);

      expect(mockNotificationsService.sendToUser).toHaveBeenCalledWith(
        'user-1',
        jobData.payload,
      );
    });

    it('processes job with a different userId and payload', async () => {
      const jobData: NotificationJobData = {
        userId: 'user-99',
        payload: {
          title: 'KR Alert',
          body: '삼성전자 20% 하락',
          symbol: '005930',
          level: 20,
        },
      };
      const job = createMockJob(jobData, 'job-99');
      mockNotificationsService.sendToUser.mockResolvedValue(undefined);

      await worker.process(job);

      expect(mockNotificationsService.sendToUser).toHaveBeenCalledWith(
        'user-99',
        jobData.payload,
      );
    });

    it('does not crash when sendToUser throws an error', async () => {
      const jobData: NotificationJobData = {
        userId: 'user-fail',
        payload: {
          title: 'Error Test',
          body: 'Test body',
          symbol: 'FAIL',
          level: 15,
        },
      };
      const job = createMockJob(jobData, 'job-fail');
      mockNotificationsService.sendToUser.mockRejectedValue(
        new Error('Push service down'),
      );

      // process() should propagate but BullMQ handles the error — verify it doesn't swallow silently
      await expect(worker.process(job)).rejects.toThrow('Push service down');
    });

    it('calls sendToUser exactly once per job', async () => {
      const jobData: NotificationJobData = {
        userId: 'user-2',
        payload: {
          title: 'Alert',
          body: 'Price drop',
          symbol: 'GOOGL',
          level: 15,
        },
      };
      const job = createMockJob(jobData, 'job-2');
      mockNotificationsService.sendToUser.mockResolvedValue(undefined);

      await worker.process(job);

      expect(mockNotificationsService.sendToUser).toHaveBeenCalledTimes(1);
    });
  });
});
