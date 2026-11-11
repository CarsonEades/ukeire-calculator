import { describe, expect, it } from 'vitest';
import { parseHand, tileName } from '../../src/engine/tiles';
import { analyze } from '../../src/engine/analyze';

const run = (h: string, v = '') => {
  const r = parseHand(h);
  return analyze(r.hand, r.melds, parseHand(v).hand);
};

describe('analyze', () => {
  it('reports incomplete and invalid hands without throwing', () => {
    expect(run('').status).toBe('empty');
    expect(run('123m').status).toBe('incomplete');
    expect(run('11111m23456789p').status).toBe('invalid');
    expect(run('123m456p789s1122z', '1111z').status).toBe('invalid');
    expect(run('123m456p789s112233z').status).toBe('invalid'); // 15 tiles
  });

  it('13-tile hand gives one row with no discard', () => {
    const a = run('123m456p789s1122z');
    expect(a.status).toBe('ready');
    expect(a.rows.length).toBe(1);
    expect(a.rows[0].discard).toBeNull();
    expect(a.rows[0].total).toBe(4);
  });

  it('14-tile hand gives sorted rows with upgrades', () => {
    const a = run('34568m123p789p11z9s');
    expect(tileName(a.rows[0].discard!)).toBe('9s');
    expect(a.rows[0].total).toBe(4);
    expect(a.rows[0].upgrades.total).toBeGreaterThan(0);
  });

  it('visible tiles reduce remaining counts', () => {
    const a = run('123m456p789s1122z', '1z');
    expect(a.rows[0].total).toBe(3);
  });
});
