import { describe, expect, it } from 'vitest';
import { readHash, writeHash } from '../../src/ui/urlState';

describe('url state', () => {
  it('round-trips hand, melds and visible tiles', () => {
    const s = { hand: '123m456p789s1z [222z]', visible: '5z05m' };
    const hash = writeHash(s);
    expect(hash).toBe('#h=123m456p789s1z+[222z]&v=5z05m');
    expect(readHash(hash)).toEqual(s);
  });
  it('reads the plan example', () => {
    expect(readHash('#h=123m456p789s1122z&v=5z')).toEqual({ hand: '123m456p789s1122z', visible: '5z' });
  });
});
