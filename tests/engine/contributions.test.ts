import { describe, expect, it } from 'vitest';
import { remainingCounts } from '../../src/engine/remaining';
import { tileIndex } from '../../src/engine/tiles';
import { parseHand } from '../../src/engine/tiles';
import { tileContributions } from '../../src/engine/ukeire';

function contrib(notation: string) {
  const r = parseHand(notation);
  const rem = remainingCounts(r.hand, r.melds);
  return tileContributions(r.hand, r.melds.length, rem);
}
const t = (name: string) => tileIndex(name);

describe('tileContributions', () => {
  it('ryanmen tiles generate both waits; complete melds and the pair generate nothing', () => {
    // Best discard 7z leaves tenpai on 3m/6m from the 45m ryanmen.
    const c = contrib('45m123p456p789s117z');
    expect(c.get(t('4m'))).toMatchObject({ types: 2, tiles: 8 });
    expect(c.get(t('5m'))).toMatchObject({ types: 2, tiles: 8 });
    for (const name of ['1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z']) {
      expect(c.get(t(name))).toMatchObject({ types: 0, tiles: 0 });
    }
  });

  it('shanpon: each pair generates its own triplet tile', () => {
    // Best discard 5z leaves tenpai on 1z/2z.
    const c = contrib('123m456p789s11225z');
    expect(c.get(t('1z'))).toMatchObject({ types: 1, tiles: 2 });
    expect(c.get(t('2z'))).toMatchObject({ types: 1, tiles: 2 });
    expect(c.get(t('1m'))).toMatchObject({ types: 0, tiles: 0 });
  });

  it('the best-discard tile is measured in the hand where it is kept', () => {
    const c = contrib('45m123p456p789s117z');
    const seven = c.get(t('7z'))!;
    expect(seven.frameDiscard).not.toBe(t('7z'));
    // Kept as an isolated honor, 7z at least generates its own pair.
    expect(seven.types).toBeGreaterThanOrEqual(1);
    expect(c.get(t('4m'))!.frameDiscard).toBe(t('7z'));
  });

  it('overlapping acceptance goes to the more central tile; the other is marked', () => {
    // Best discard 7z leaves loose 6m and 9m. Both connect with 7m and 8m; 6m is more central.
    const c = contrib('69m123p456p789s117z');
    // 6m: 4m 5m 6m 7m 8m = 4 + 4 + 3 + 4 + 4.
    expect(c.get(t('6m'))).toMatchObject({ types: 5, tiles: 19, sharedAway: [] });
    // 9m keeps only its own pair draw (3 left) and loses 7m and 8m to 6m.
    expect(c.get(t('9m'))).toMatchObject({ types: 1, tiles: 3, sharedAway: [t('7m'), t('8m')] });
  });

  it('tiles in the same shape still share credit', () => {
    const c = contrib('45m123p456p789s117z');
    expect(c.get(t('4m'))!.sharedAway).toEqual([]);
    expect(c.get(t('5m'))!.sharedAway).toEqual([]);
  });

  it('only loose tiles lose overlapping acceptance, never partial shapes', () => {
    // After cutting 4z: 13m kanchan and 56m ryanmen both connect with 4m. The kanchan keeps it.
    const c = contrib('1356m24p34789s114z');
    expect(c.get(t('3m'))).toMatchObject({ types: 2, tiles: 8, sharedAway: [] });
    expect(c.get(t('5m'))).toMatchObject({ types: 2, tiles: 8, sharedAway: [] });
  });

  it('a loose tile next to a pair (778) is still a ryanmen and keeps its acceptance', () => {
    // After cutting 1z the split is 77s pair + loose 8s, but 78s is a ryanmen.
    const c = contrib('778s123m456m789p15z');
    const eight = c.get(t('8s'))!;
    expect(eight.sharedAway).toEqual([]);
    expect(eight.types).toBeGreaterThanOrEqual(2);
    expect(eight.tiles).toBeGreaterThanOrEqual(8);
  });

  it('a draw that only works by re-splitting a meld credits the whole meld (2346 + 1)', () => {
    // Split: 234m meld + loose 6m. 1m works only as 123m + 46m, which needs the 4m.
    const c = contrib('2346m456p789s11z');
    for (const name of ['2m', '3m', '4m']) {
      expect(c.get(t(name)), name).toMatchObject({ types: 1, tiles: 4 });
    }
    expect(c.get(t('6m'))).toMatchObject({ types: 5, tiles: 18 });
    // Melds nothing reaches still produce nothing.
    expect(c.get(t('5p'))).toMatchObject({ types: 0, tiles: 0 });
  });

  it('works for 13-tile hands (no discard)', () => {
    const c = contrib('45m123p456p789s11z');
    expect(c.get(t('4m'))).toMatchObject({ types: 2, tiles: 8, frameDiscard: null });
  });

  it('has an entry for every tile type in the hand and nothing else', () => {
    const c = contrib('45m123p456p789s117z');
    expect([...c.keys()].sort((a, b) => a - b)).toEqual(
      ['4m', '5m', '1p', '2p', '3p', '4p', '5p', '6p', '7s', '8s', '9s', '1z', '7z'].map(t).sort((a, b) => a - b),
    );
  });
});
