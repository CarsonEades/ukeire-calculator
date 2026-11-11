import { describe, expect, it } from 'vitest';
import { parseHand, tileName } from '../../src/engine/tiles';
import { describeHand, labelShape, shapeWaits } from '../../src/engine/shapes';

describe('shape waits (shape as the last unfinished part of the hand)', () => {
  it.each([
    ['3456', [3, 6], 6],
    ['3445', [4], 2],
    ['3457', [7], 3],
    ['2344', [1, 4], 6],
    ['4456', [4, 7], 6],
    ['3334', [2, 4, 5], 11],
    ['3335', [4, 5], 7],
    ['3355', [3, 5], 4],
    ['2235', [4], 4],
    ['34567', [2, 5, 8], 11],
    ['23456', [1, 4, 7], 11],
    ['12345', [3, 6], 7],
    ['34578', [6, 9], 8],
    ['33345', [3, 6], 5],
    ['34445', [4], 1],
  ])('%s waits %j (%i tiles)', (shape, waits, tiles) => {
    const w = shapeWaits(shape);
    expect(w.waits).toEqual(waits);
    expect(w.tiles).toBe(tiles);
  });
});

describe('shape labels', () => {
  it.each([
    ['12', 'penchan'],
    ['89', 'penchan'],
    ['34', 'ryanmen'],
    ['35', 'kanchan'],
    ['55', 'pair'],
    ['555', 'triplet'],
    ['345', 'run'],
    ['3456', 'nobetan'],
    ['3445', 'nakabukure'],
    ['34567', 'sanmenchan'],
    ['357', 'ryankan'],
    ['4456', 'aabc'],
    ['2344', 'abcc'],
    ['3334', 'aaab'],
    ['3444', 'abbb'],
    ['3335', 'aaac'],
    ['3344', 'aabb'],
    ['2235', 'aabd'],
    ['5', 'isolated'],
  ])('%s is %s', (shape, name) => {
    expect(labelShape(shape)?.name).toBe(name);
  });

  it('unmatched groups return undefined (caller falls back to the decomposition)', () => {
    expect(labelShape('3457')).toBeUndefined();
  });
});

describe('describeHand', () => {
  it('splits suits into connected groups with labels and waits', () => {
    const r = parseHand('3456m579p1199s12z');
    const groups = describeHand(r.hand, 0);
    const names = groups.map((g) => g.tiles.map(tileName).join(''));
    expect(names).toEqual(['3m4m5m6m', '5p7p9p', '1s1s', '9s9s', '1z', '2z']);
    const nobetan = groups[0];
    expect(nobetan.label).toBe('nobetan');
    expect(nobetan.waits.map(tileName)).toEqual(['3m', '6m']);
    expect(nobetan.waitTiles).toBe(6);
  });

  it('falls back to decomposition blocks for unnamed groups', () => {
    const r = parseHand('3457m123456p11z');
    const groups = describeHand(r.hand, 0);
    expect(groups[0].label).toBeUndefined();
    expect(groups[0].blocks.map((b) => b.kind).sort()).toEqual(['isolated', 'meld']);
  });
});
