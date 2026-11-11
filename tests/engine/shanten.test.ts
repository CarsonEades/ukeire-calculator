import { describe, expect, it } from 'vitest';
import { parseHand } from '../../src/engine/tiles';
import { standardShanten } from '../../src/engine/shanten';

function std(notation: string): number {
  const r = parseHand(notation);
  return standardShanten(r.hand, r.melds.length);
}

describe('standard shanten (full-hand cases)', () => {
  it('complete 14-tile hand is -1', () => {
    expect(std('123m456p789s11222z')).toBe(-1);
  });
  it('123m456p789s1122z is tenpai', () => {
    expect(std('123m456p789s1122z')).toBe(0);
  });
  it('called meld counts toward melds: 123m456p789s1z [222z] is tenpai', () => {
    expect(std('123m456p789s1z [222z]')).toBe(0);
  });
  it('called-meld hand completes with the pair', () => {
    expect(std('123m456p789s11z [222z]')).toBe(-1);
  });
});

describe('standard shanten (sanity)', () => {
  it.each([
    ['19m19p19s1234567z', 8],
    ['1122m3344p5566s7z', 3],
    ['123456789m1234z', 2],
    ['13579m13579p135s', 4],
    ['1112345678999m', 0],
    ['11123456789999m', -1],
    ['147m258p369s1234z', 8],
  ])('%s -> %i', (hand, expected) => {
    expect(std(hand)).toBe(expected);
  });
});

describe('drawShantens fast path', () => {
  it('matches shantenValue after each draw on random hands', async () => {
    const { drawShantens, shantenValue } = await import('../../src/engine/shanten');
    let seed = 12345;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let n = 0; n < 300; n++) {
      const wall: number[] = [];
      for (let t = 0; t < 34; t++) for (let k = 0; k < 4; k++) wall.push(t);
      const melds = n % 5 === 0 ? 1 : 0;
      const hand = new Array(34).fill(0);
      for (let k = 0; k < 13 - 3 * melds; k++) {
        const i = Math.floor(rand() * wall.length);
        hand[wall.splice(i, 1)[0]]++;
      }
      const fast = drawShantens(hand, melds);
      for (let t = 0; t < 34; t++) {
        if (hand[t] >= 4) continue;
        hand[t]++;
        expect(fast[t]).toBe(shantenValue(hand, melds));
        hand[t]--;
      }
    }
  });
});
