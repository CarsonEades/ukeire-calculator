import { describe, expect, it } from 'vitest';
import { parseHand } from '../../src/engine/tiles';
import { remainingCounts } from '../../src/engine/remaining';
import { analyzeDiscards, upgrades } from '../../src/engine/ukeire';

const HANDS = ['1234567m13579p2s', '113355m2468p13579s', '19m19p19s123456z5m', '2345678m234567p1s', '11223344556677m'];

describe('performance', () => {
  it('full 14-tile analysis with upgrades stays fast', () => {
    for (const n of HANDS) {
      const r = parseHand(n);
      const rem = remainingCounts(r.hand);
      const t0 = performance.now();
      const rows = analyzeDiscards(r.hand, 0, rem);
      for (const row of rows) {
        const h = [...r.hand];
        h[row.discard]--;
        upgrades(h, 0, rem);
      }
      const ms = performance.now() - t0;
      console.log(`${n}: ${ms.toFixed(1)} ms`);
      expect(ms).toBeLessThan(2000);
    }
  });
});
