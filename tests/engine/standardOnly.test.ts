import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/engine/analyze';
import { remainingCounts } from '../../src/engine/remaining';
import { drawShantens, shanten, shantenValue, standardShanten } from '../../src/engine/shanten';
import { emptyCounts, parseHand, tileName } from '../../src/engine/tiles';
import { analyzeDiscards, ukeire } from '../../src/engine/ukeire';

const OFF = { specialForms: false };
const hand = (s: string) => parseHand(s).hand;

describe('standard hands only (specialForms: false)', () => {
  it('seven pairs is not counted as complete', () => {
    const h = hand('1133557799m1155p');
    expect(shanten(h, 0).forms).toEqual(['chiitoitsu']);
    const off = shanten(h, 0, OFF);
    expect(off.forms).toEqual(['standard']);
    expect(off.shanten).toBe(standardShanten(h, 0));
    expect(off.shanten).toBeGreaterThan(-1);
    expect(shantenValue(h, 0, OFF)).toBe(off.shanten);
  });

  it('thirteen orphans tenpai becomes a standard-hand count', () => {
    const h = hand('19m19p19s1234567z');
    const rem = remainingCounts(h, []);
    const on = ukeire(h, 0, rem);
    expect(on.forms).toEqual(['kokushi']);
    expect(on.tiles.length).toBe(13);
    const off = ukeire(h, 0, rem, OFF);
    expect(off.forms).toEqual(['standard']);
    expect(off.shanten).toBe(standardShanten(h, 0));
  });

  it('defaults are unchanged (special forms on)', () => {
    const h = hand('1133557799m1155p');
    expect(shanten(h, 0).shanten).toBe(-1);
    expect(shanten(h, 0, { specialForms: true }).shanten).toBe(-1);
  });

  it('drawShantens agrees with shantenValue when special forms are off', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let n = 0; n < 200; n++) {
      const h = emptyCounts();
      let placed = 0;
      while (placed < 13) {
        const t = Math.floor(rnd() * 34);
        if (h[t] < 4) {
          h[t]++;
          placed++;
        }
      }
      const fast = drawShantens(h, 0, OFF);
      for (let t = 0; t < 34; t++) {
        if (h[t] >= 4) continue;
        h[t]++;
        expect(fast[t]).toBe(shantenValue(h, 0, OFF));
        h[t]--;
      }
    }
  });

  it('discard rows and the full analysis use only the standard form', () => {
    const p = parseHand('1133557799m1156p');
    const rem = remainingCounts(p.hand, []);
    const rows = analyzeDiscards(p.hand, 0, rem, OFF);
    for (const r of rows) expect(r.forms).toEqual(['standard']);
    const a = analyze(p.hand, [], emptyCounts(), OFF);
    expect(a.status).toBe('ready');
    expect(a.handForms).toEqual(['standard']);
    for (const r of a.rows) expect(r.forms).toEqual(['standard']);
    // With seven pairs on, this hand is tenpai after cutting 5p or 6p.
    const on = analyze(p.hand, [], emptyCounts());
    expect(on.rows[0].shanten).toBe(0);
    expect(a.rows[0].shanten).toBeGreaterThan(0);
    expect(tileName(on.rows[0].discard!)).toMatch(/^[56]p$/);
  });
});
