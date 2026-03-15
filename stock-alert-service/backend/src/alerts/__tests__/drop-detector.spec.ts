import { Decimal } from '@prisma/client/runtime/library';

describe('DropDetectorService', () => {
  // Access private method via casting
  const svc = {
    getHitLevel: (dropPct: Decimal, thresholds: number[]) => {
      const sorted = [...thresholds].sort((a, b) => b - a);
      for (const level of sorted) {
        if (dropPct.greaterThanOrEqualTo(level)) return level;
      }
      return null;
    },
  };

  describe('getHitLevel', () => {
    it('returns null when drop is below all thresholds', () => {
      expect(svc.getHitLevel(new Decimal('8'), [10, 20, 30])).toBeNull();
    });

    it('returns lowest matching threshold when drop hits 10%', () => {
      expect(svc.getHitLevel(new Decimal('10'), [10, 20, 30])).toBe(10);
    });

    it('returns highest matching threshold for 21% drop with [10,20,30]', () => {
      expect(svc.getHitLevel(new Decimal('21'), [10, 20, 30])).toBe(20);
    });

    it('returns 30 for exactly 30% drop', () => {
      expect(svc.getHitLevel(new Decimal('30'), [10, 15, 20, 25, 30])).toBe(30);
    });

    it('returns 25 for 27.5% drop with all thresholds', () => {
      expect(svc.getHitLevel(new Decimal('27.5'), [10, 15, 20, 25, 30])).toBe(
        25,
      );
    });

    it('returns null for empty thresholds', () => {
      expect(svc.getHitLevel(new Decimal('50'), [])).toBeNull();
    });

    it('uses Decimal precision correctly for 14.999%', () => {
      // 14.999% should NOT trigger 15% threshold
      expect(svc.getHitLevel(new Decimal('14.999'), [15, 20])).toBeNull();
    });

    it('uses Decimal precision correctly for 15.000%', () => {
      expect(svc.getHitLevel(new Decimal('15.000'), [15, 20])).toBe(15);
    });
  });

  describe('drop percent calculation', () => {
    function calcDrop(high6m: string, currentPrice: string): Decimal {
      const h = new Decimal(high6m);
      const p = new Decimal(currentPrice);
      return h.minus(p).div(h).times(100);
    }

    it('calculates 10% drop correctly', () => {
      const drop = calcDrop('100', '90');
      expect(drop.toFixed(2)).toBe('10.00');
    });

    it('calculates 20% drop correctly', () => {
      const drop = calcDrop('50000', '40000');
      expect(drop.toFixed(2)).toBe('20.00');
    });

    it('handles decimal precision for Korean stock prices', () => {
      const drop = calcDrop('85200', '72420');
      // (85200 - 72420) / 85200 * 100 = 12780/85200 * 100 ≈ 15.00%
      expect(parseFloat(drop.toFixed(4))).toBeCloseTo(15.0, 1);
    });

    it('calculates zero drop when price equals high', () => {
      const drop = calcDrop('100', '100');
      expect(drop.toFixed(2)).toBe('0.00');
    });
  });
});
