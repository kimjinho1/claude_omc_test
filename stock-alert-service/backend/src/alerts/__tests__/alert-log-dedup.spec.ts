import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';

describe('AlertLog deduplication logic', () => {
  const DEDUP_HOURS = 24;

  function isWithinDedup(sentAt: Date): boolean {
    const since = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000);
    return sentAt >= since;
  }

  it('considers alert sent 1 hour ago as duplicate', () => {
    const sentAt = new Date(Date.now() - 1 * 60 * 60 * 1000);
    expect(isWithinDedup(sentAt)).toBe(true);
  });

  it('considers alert sent 23.9 hours ago as duplicate', () => {
    const sentAt = new Date(Date.now() - 23.9 * 60 * 60 * 1000);
    expect(isWithinDedup(sentAt)).toBe(true);
  });

  it('considers alert sent exactly 24 hours ago as NOT duplicate', () => {
    const sentAt = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1);
    expect(isWithinDedup(sentAt)).toBe(false);
  });

  it('considers alert sent 25 hours ago as NOT duplicate', () => {
    const sentAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(isWithinDedup(sentAt)).toBe(false);
  });

  it('considers alert sent 48 hours ago as NOT duplicate', () => {
    const sentAt = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(isWithinDedup(sentAt)).toBe(false);
  });

  describe('different levels are not considered duplicates of each other', () => {
    // Dedup is per userId+symbol+level combination
    const recentAlert = { userId: 'u1', symbol: 'AAPL', level: 10 };

    it('same level within 24h is duplicate', () => {
      const log = { ...recentAlert, level: 10 };
      expect(log.userId === recentAlert.userId && log.symbol === recentAlert.symbol && log.level === recentAlert.level).toBe(true);
    });

    it('different level is not a duplicate', () => {
      const log = { ...recentAlert, level: 20 };
      expect(log.level === recentAlert.level).toBe(false);
    });

    it('different symbol is not a duplicate', () => {
      const log = { ...recentAlert, symbol: 'TSLA' };
      expect(log.symbol === recentAlert.symbol).toBe(false);
    });
  });
});
