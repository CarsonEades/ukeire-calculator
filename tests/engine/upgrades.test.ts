import { describe, expect, it } from 'vitest';
import { parseHand, tileIndex } from '../../src/engine/tiles';
import { remainingCounts } from '../../src/engine/remaining';
import { shapeUpgrades, shapeWaits } from '../../src/engine/shapes';
import { ukeire, upgrades } from '../../src/engine/ukeire';

describe('shape upgrades (plan test cases)', () => {
  it('34568 waits on 7 (4 tiles); drawing 2 upgrades it to 23456 (11 tiles)', () => {
    expect(shapeWaits('34568')).toEqual({ waits: [7], tiles: 4 });
    const up = shapeUpgrades('34568');
    const two = up.find((u) => u.draw === 2);
    expect(two).toEqual({ draw: 2, discard: 8, tiles: 11 });
  });

  it('34579 waits on 8; drawing 6 upgrades it to 34567 (11 tiles)', () => {
    expect(shapeWaits('34579').waits).toEqual([8]);
    const six = shapeUpgrades('34579').find((u) => u.draw === 6);
    expect(six).toEqual({ draw: 6, discard: 9, tiles: 11 });
  });
});

describe('hand upgrades', () => {
  it('34568m in a tenpai hand: 2m is an upgrade (discard 8m, 11 tiles)', () => {
    const r = parseHand('34568m123p789p11z');
    const rem = remainingCounts(r.hand);
    expect(ukeire(r.hand, 0, rem).total).toBe(4);
    const up = upgrades(r.hand, 0, rem);
    const two = up.tiles.find((u) => u.tile === tileIndex('2m'));
    expect(two).toMatchObject({ count: 4, discard: tileIndex('8m'), newTotal: 11 });
    expect(up.tiles.some((u) => u.tile === tileIndex('7m'))).toBe(false); // accepted tiles are not upgrades
    expect(up.total).toBe(up.tiles.reduce((a, u) => a + u.count, 0));
  });

  it('34579m in a tenpai hand: 6m upgrades to 34567m (11 tiles)', () => {
    const r = parseHand('34579m123p789p11z');
    const up = upgrades(r.hand, 0, remainingCounts(r.hand));
    expect(up.tiles.find((u) => u.tile === tileIndex('6m'))).toMatchObject({
      discard: tileIndex('9m'),
      newTotal: 11,
    });
  });

  it('notes same-count shape improvements separately, not in the total', () => {
    // 46m kanchan waits on 5m (4 copies). Drawing 3m and discarding 6m gives a
    // 34m ryanmen (waits 2m, 5m), but every 2m is visible, so it still accepts 4.
    const r = parseHand('46m123p456p789s11z');
    const visible = parseHand('2222m').hand;
    const rem = remainingCounts(r.hand, [], visible);
    expect(ukeire(r.hand, 0, rem).total).toBe(4);
    const up = upgrades(r.hand, 0, rem);
    expect(up.tiles.some((u) => u.tile === tileIndex('3m'))).toBe(false);
    expect(up.tiles.some((u) => u.tile === tileIndex('7m'))).toBe(true); // 67m: 5m + 8m = 8
    const q = up.quality.find((u) => u.tile === tileIndex('3m'));
    expect(q).toMatchObject({ discard: tileIndex('6m'), newTotal: 4, newTypes: 2, oldTypes: 1 });
  });
});
