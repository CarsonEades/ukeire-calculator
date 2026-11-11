import { describe, expect, it } from 'vitest';
import { parseHand, tileName } from '../../src/engine/tiles';
import { remainingCounts } from '../../src/engine/remaining';
import { shanten } from '../../src/engine/shanten';
import { analyzeDiscards, shapeBuildingAcceptance, ukeire } from '../../src/engine/ukeire';

function accept(notation: string) {
  const r = parseHand(notation);
  const rem = remainingCounts(r.hand, r.melds);
  return ukeire(r.hand, r.melds.length, rem);
}

describe('full hands (plan test cases)', () => {
  it('123m456p789s11222z is complete (-1)', () => {
    const r = parseHand('123m456p789s11222z');
    expect(shanten(r.hand, 0).shanten).toBe(-1);
  });

  it('123m456p789s1122z: tenpai, waits 1z 2z, 4 tiles', () => {
    const u = accept('123m456p789s1122z');
    expect(u.shanten).toBe(0);
    expect(u.tiles.map((t) => tileName(t.tile))).toEqual(['1z', '2z']);
    expect(u.total).toBe(4);
  });

  it('19m19p19s1234567z: kokushi tenpai, 13 types, 39 tiles', () => {
    const u = accept('19m19p19s1234567z');
    expect(u.shanten).toBe(0);
    expect(u.forms).toEqual(['kokushi']);
    expect(u.tiles.length).toBe(13);
    expect(u.total).toBe(39);
  });

  it('1122m3344p5566s7z: chiitoitsu tenpai, waits 7z, 3 tiles', () => {
    const u = accept('1122m3344p5566s7z');
    expect(u.shanten).toBe(0);
    expect(u.forms).toEqual(['chiitoitsu']);
    expect(u.tiles.map((t) => tileName(t.tile))).toEqual(['7z']);
    expect(u.total).toBe(3);
  });

  it('123m456p789s1z [222z]: tanki on 1z, 3 tiles', () => {
    const u = accept('123m456p789s1z [222z]');
    expect(u.shanten).toBe(0);
    expect(u.tiles.map((t) => tileName(t.tile))).toEqual(['1z']);
    expect(u.total).toBe(3);
  });
});

describe('shape building acceptance (draws giving a meld + partial)', () => {
  it.each([
    ['3456', 28],
    ['3457', 22],
    ['3445', 16],
    ['2344', 20],
    ['4456', 20],
    ['3334', 16],
    ['3335', 16],
    ['3355', 8],
    ['2235', 6],
  ])('%s -> %i', (shape, expected) => {
    expect(shapeBuildingAcceptance(shape)).toBe(expected);
  });
});

describe('ukeire details', () => {
  it('only counts tiles with copies left', () => {
    const r = parseHand('123m456p789s1122z');
    const visible = parseHand('11z').hand;
    const u = ukeire(r.hand, 0, remainingCounts(r.hand, [], visible));
    expect(u.tiles.map((t) => tileName(t.tile))).toEqual(['2z']);
    expect(u.total).toBe(2);
  });

  it('a hand where both standard and seven pairs tie lists both forms', () => {
    const u = accept('112233m445566p7z');
    expect(u.shanten).toBe(0);
    expect(u.forms).toContain('standard');
    expect(u.forms).toContain('chiitoitsu');
  });
});

describe('analyzeDiscards (14-tile hands)', () => {
  it('sorts by shanten after discarding, then by accepted copies', () => {
    const r = parseHand('123m456p789s1122z9m');
    const rows = analyzeDiscards(r.hand, 0, remainingCounts(r.hand));
    expect(tileName(rows[0].discard)).toBe('9m');
    expect(rows[0].shanten).toBe(0);
    expect(rows[0].total).toBe(4);
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1];
      const b = rows[i];
      expect(a.shanten < b.shanten || (a.shanten === b.shanten && a.total >= b.total)).toBe(true);
    }
    expect(rows.length).toBe(12); // one row per distinct tile type in the hand
  });

  it('a complete 14-tile hand still lists discards (all raise shanten to 0)', () => {
    const r = parseHand('123m456p789s11222z');
    const rows = analyzeDiscards(r.hand, 0, remainingCounts(r.hand));
    expect(rows.every((row) => row.shanten >= 0)).toBe(true);
  });
});
