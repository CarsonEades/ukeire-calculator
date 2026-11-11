import { describe, expect, it } from 'vitest';
import { formatHand, parseHand, tileIndex, tileName, validateHand } from '../../src/engine/tiles';

describe('tile ids', () => {
  it('maps notation to the 34-index layout', () => {
    expect(tileIndex('1m')).toBe(0);
    expect(tileIndex('9m')).toBe(8);
    expect(tileIndex('1p')).toBe(9);
    expect(tileIndex('1s')).toBe(18);
    expect(tileIndex('1z')).toBe(27);
    expect(tileIndex('7z')).toBe(33);
    expect(tileName(31)).toBe('5z');
  });
});

describe('parseHand', () => {
  it('parses a closed hand into 34 counts', () => {
    const r = parseHand('123m456p789s1122z');
    expect(r.error).toBeUndefined();
    expect(r.hand.length).toBe(34);
    expect(r.hand.reduce((a, b) => a + b, 0)).toBe(13);
    expect(r.hand[tileIndex('1z')]).toBe(2);
    expect(r.hand[tileIndex('5p')]).toBe(1);
    expect(r.melds).toEqual([]);
  });

  it('treats 0 as a red five', () => {
    const r = parseHand('0m055p');
    expect(r.hand[tileIndex('5m')]).toBe(1);
    expect(r.hand[tileIndex('5p')]).toBe(3);
    expect(r.red).toEqual([1, 1, 0]);
  });

  it('ignores spaces', () => {
    expect(parseHand('12 3m 4 5 6p').hand).toEqual(parseHand('123m456p').hand);
  });

  it('parses called melds in brackets', () => {
    const r = parseHand('23456m789p11z [555p] [777z]');
    expect(r.error).toBeUndefined();
    expect(r.hand.reduce((a, b) => a + b, 0)).toBe(10);
    expect(r.melds.length).toBe(2);
    expect(r.melds[0].tiles).toEqual([13, 13, 13]);
    expect(r.melds[1].kind).toBe('pon');
  });

  it('reports syntax errors instead of dropping tiles', () => {
    expect(parseHand('123m45').error).toMatch(/suit/i);
    expect(parseHand('123x').error).toBeDefined();
    expect(parseHand('8z').error).toBeDefined();
    expect(parseHand('123m [12m]').error).toMatch(/meld/i);
    expect(parseHand('123m [135m]').error).toMatch(/meld/i);
  });

  it('round-trips through formatHand', () => {
    const r = parseHand('2m3m1m 55z [999s]');
    expect(formatHand(r.hand, r.melds, r.red)).toBe('123m55z [999s]');
    const red = parseHand('406p');
    expect(formatHand(red.hand, red.melds, red.red)).toBe('406p');
  });
});

describe('validateHand', () => {
  it('rejects more than 4 copies across hand, melds and visible', () => {
    const r = parseHand('11111m');
    expect(validateHand(r.hand, r.melds).some((e) => /1m/.test(e))).toBe(true);
    const m = parseHand('11m234p [111m]');
    expect(validateHand(m.hand, m.melds).some((e) => /1m/.test(e))).toBe(true);
    const v = parseHand('11m');
    expect(validateHand(v.hand, v.melds, parseHand('111m').hand).length).toBeGreaterThan(0);
  });

  it('checks hand size against the number of melds', () => {
    const ok = parseHand('123m456p789s1122z');
    expect(validateHand(ok.hand, ok.melds)).toEqual([]);
    const wrong = parseHand('123m456p789s112z');
    expect(validateHand(wrong.hand, wrong.melds).length).toBeGreaterThan(0);
    const melded = parseHand('123m456p789s1z [222z]');
    expect(validateHand(melded.hand, melded.melds)).toEqual([]);
    const melded14 = parseHand('123m456p789s11z [222z]');
    expect(validateHand(melded14.hand, melded14.melds)).toEqual([]);
  });
});
