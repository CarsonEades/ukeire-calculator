import { describe, expect, it } from 'vitest';
import { parseHand, tileIndex } from '../../src/engine/tiles';
import { remainingCounts } from '../../src/engine/remaining';

describe('remainingCounts', () => {
  it('is 4 - hand - melds - visible', () => {
    const r = parseHand('123m456p789s1z [222z]');
    const visible = parseHand('11z9s').hand;
    const rem = remainingCounts(r.hand, r.melds, visible);
    expect(rem[tileIndex('1z')]).toBe(1);
    expect(rem[tileIndex('2z')]).toBe(1);
    expect(rem[tileIndex('9s')]).toBe(2);
    expect(rem[tileIndex('5m')]).toBe(4);
  });

  it('never goes below zero', () => {
    const rem = remainingCounts(parseHand('1111m').hand, [], parseHand('1m').hand);
    expect(rem[0]).toBe(0);
  });
});
