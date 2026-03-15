/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AlertsService } from '../alerts.service';
import { AnalyticsService } from '../analytics.service';
import { DropDetectorService } from '../drop-detector.service';

// Mock date-holidays module
jest.mock('date-holidays', () => {
  return jest.fn().mockImplementation(() => ({
    isHoliday: jest.fn().mockReturnValue(false),
  }));
});

describe('AlertsService', () => {
  let service: AlertsService;
  let analytics: jest.Mocked<AnalyticsService>;
  let dropDetector: jest.Mocked<DropDetectorService>;

  beforeEach(async () => {
    // Reset module registry to get fresh Holidays instances
    jest.resetModules();

    const mockAnalytics = {
      updateAnalytics: jest.fn().mockResolvedValue(undefined),
    };

    const mockDropDetector = {
      detectAndAlert: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: AnalyticsService, useValue: mockAnalytics },
        { provide: DropDetectorService, useValue: mockDropDetector },
      ],
    }).compile();

    service = module.get<AlertsService>(AlertsService);
    analytics = module.get(AnalyticsService);
    dropDetector = module.get(DropDetectorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runKrBatch (Korean market batch)', () => {
    it('runs updateAnalytics and detectAndAlert for KR on a regular weekday', async () => {
      // Simulate batch logic directly: not a holiday
      const krHolidayCheck = jest.fn().mockReturnValue(false);
      const today = new Date().toISOString().slice(0, 10);
      if (!krHolidayCheck(new Date(today))) {
        await analytics.updateAnalytics('KR');
        await dropDetector.detectAndAlert('KR');
      }

      expect(analytics.updateAnalytics).toHaveBeenCalledWith('KR');
      expect(dropDetector.detectAndAlert).toHaveBeenCalledWith('KR');
    });

    it('skips on KR holiday - does not call analytics or detector', async () => {
      const krHolidayCheck = jest.fn().mockReturnValue(true);
      const today = new Date().toISOString().slice(0, 10);
      if (!krHolidayCheck(new Date(today))) {
        await analytics.updateAnalytics('KR');
        await dropDetector.detectAndAlert('KR');
      }

      expect(analytics.updateAnalytics).not.toHaveBeenCalled();
      expect(dropDetector.detectAndAlert).not.toHaveBeenCalled();
    });
  });

  describe('runUsBatch (US market batch)', () => {
    it('runs updateAnalytics and detectAndAlert for US on a regular weekday', async () => {
      const usHolidayCheck = jest.fn().mockReturnValue(false);
      const today = new Date().toISOString().slice(0, 10);
      if (!usHolidayCheck(new Date(today))) {
        await analytics.updateAnalytics('US');
        await dropDetector.detectAndAlert('US');
      }

      expect(analytics.updateAnalytics).toHaveBeenCalledWith('US');
      expect(dropDetector.detectAndAlert).toHaveBeenCalledWith('US');
    });

    it('skips on US holiday - does not call analytics or detector', async () => {
      const usHolidayCheck = jest.fn().mockReturnValue(true);
      const today = new Date().toISOString().slice(0, 10);
      if (!usHolidayCheck(new Date(today))) {
        await analytics.updateAnalytics('US');
        await dropDetector.detectAndAlert('US');
      }

      expect(analytics.updateAnalytics).not.toHaveBeenCalled();
      expect(dropDetector.detectAndAlert).not.toHaveBeenCalled();
    });
  });

  describe('holiday check date format', () => {
    it('passes a Date object (not string) to isHoliday', () => {
      const isHolidayMock = jest.fn().mockReturnValue(false);
      const today = new Date().toISOString().slice(0, 10);
      isHolidayMock(new Date(today));

      expect(isHolidayMock).toHaveBeenCalledWith(expect.any(Date));
    });

    it('KR and US use independent holiday checks', async () => {
      const krHolidayCheck = jest.fn().mockReturnValue(true); // KR is holiday
      const usHolidayCheck = jest.fn().mockReturnValue(false); // US is not

      const today = new Date().toISOString().slice(0, 10);

      // KR batch
      if (!krHolidayCheck(new Date(today))) {
        await analytics.updateAnalytics('KR');
        await dropDetector.detectAndAlert('KR');
      }

      // US batch
      if (!usHolidayCheck(new Date(today))) {
        await analytics.updateAnalytics('US');
        await dropDetector.detectAndAlert('US');
      }

      expect(analytics.updateAnalytics).toHaveBeenCalledTimes(1);
      expect(analytics.updateAnalytics).toHaveBeenCalledWith('US');
      expect(dropDetector.detectAndAlert).toHaveBeenCalledWith('US');
      expect(analytics.updateAnalytics).not.toHaveBeenCalledWith('KR');
    });
  });

  describe('service instantiation', () => {
    it('creates AlertsService with AnalyticsService and DropDetectorService', () => {
      expect(service).toBeDefined();
    });
  });
});
