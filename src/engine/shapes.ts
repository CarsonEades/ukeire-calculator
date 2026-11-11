// Single-suit shape helpers and (for display) shape labels.

/** "3456" -> 9 counts for ranks 1..9. Throws on bad input (test/helper use). */
export function parseShape(shape: string): number[] {
  const c = new Array(9).fill(0);
  for (const ch of shape) {
    const r = Number(ch);
    if (!(r >= 1 && r <= 9)) throw new Error(`Bad shape "${shape}"`);
    c[r - 1]++;
  }
  return c;
}

/**
 * Can the counts be split *exactly* into `melds` melds, `pairs` pairs and
 * `partials` two-tile partial shapes (pair, ryanmen, penchan or kanchan)?
 * `allowSeq` is false for honors.
 */
export function canSplit(c: number[], melds: number, pairs: number, partials: number, allowSeq = true): boolean {
  let i = 0;
  while (i < c.length && c[i] === 0) i++;
  if (i === c.length) return melds === 0 && pairs === 0 && partials === 0;
  const L = c.length;
  const tryTake = (idx: number[], dm: number, dp: number, dq: number): boolean => {
    for (const j of idx) c[j]--;
    const ok = canSplit(c, melds - dm, pairs - dp, partials - dq, allowSeq);
    for (const j of idx) c[j]++;
    return ok;
  };
  if (melds > 0) {
    if (c[i] >= 3 && tryTake([i, i, i], 1, 0, 0)) return true;
    if (allowSeq && i + 2 < L && c[i + 1] > 0 && c[i + 2] > 0 && tryTake([i, i + 1, i + 2], 1, 0, 0)) return true;
  }
  if (c[i] >= 2) {
    if (pairs > 0 && tryTake([i, i], 0, 1, 0)) return true;
    if (partials > 0 && tryTake([i, i], 0, 0, 1)) return true;
  }
  if (partials > 0 && allowSeq) {
    if (i + 1 < L && c[i + 1] > 0 && tryTake([i, i + 1], 0, 0, 1)) return true;
    if (i + 2 < L && c[i + 2] > 0 && tryTake([i, i + 2], 0, 0, 1)) return true;
  }
  return false;
}

/** Is this group finished: all melds (size 3k) or melds + one pair (size 3k+2)? */
export function isCompleteGroup(c: number[], allowSeq = true): boolean {
  const n = c.reduce((a, b) => a + b, 0);
  if (n % 3 === 0) return canSplit(c, n / 3, 0, 0, allowSeq);
  if (n % 3 === 2) return canSplit(c, (n - 2) / 3, 1, 0, allowSeq);
  return false;
}

// ---------------------------------------------------------------------------
// Waits and upgrades of a single-suit shape, as the last unfinished part of a hand.

export interface ShapeWaits {
  /** Ranks 1..9 (positions in the counts array, 1-based). */
  waits: number[];
  /** Copies of the waits left (4 - copies in the shape, unless `remaining` is given). */
  tiles: number;
}

function toCounts(shape: string | number[]): number[] {
  return typeof shape === 'string' ? parseShape(shape) : [...shape];
}

/**
 * Waits of a shape if it were the last unfinished part of the hand: a draw
 * that turns it into melds + one pair (sizes 1, 4, 7...) or all melds
 * (sizes 2, 5, 8...). `remaining` (same indexing as the counts) overrides copies.
 */
export function shapeWaits(shape: string | number[], remaining?: number[], allowSeq = true): ShapeWaits {
  const c = toCounts(shape);
  const waits: number[] = [];
  let tiles = 0;
  for (let x = 0; x < c.length; x++) {
    if (c[x] >= 4) continue;
    c[x]++;
    const complete = isCompleteGroup(c, allowSeq);
    c[x]--;
    if (!complete) continue;
    waits.push(x + 1);
    tiles += remaining ? remaining[x] : 4 - c[x];
  }
  return { waits, tiles };
}

export interface ShapeUpgrade {
  draw: number;
  discard: number;
  tiles: number;
}

/** Draws (not waits) that, with the best discard, leave a shape with more wait tiles. */
export function shapeUpgrades(shape: string): ShapeUpgrade[] {
  const c = toCounts(shape);
  const base = shapeWaits(c);
  const out: ShapeUpgrade[] = [];
  for (let x = 0; x < 9; x++) {
    if (c[x] >= 4 || base.waits.includes(x + 1)) continue;
    c[x]++;
    let best: ShapeUpgrade | undefined;
    for (let d = 0; d < 9; d++) {
      if (d === x || c[d] === 0) continue;
      c[d]--;
      const w = shapeWaits(c);
      c[d]++;
      if (w.waits.length && w.tiles > base.tiles && (!best || w.tiles > best.tiles)) {
        best = { draw: x + 1, discard: d + 1, tiles: w.tiles };
      }
    }
    c[x]--;
    if (best) out.push(best);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Labels

export interface ShapeLabel {
  name: string;
  description: string;
}

const LABELS: Record<string, ShapeLabel> = {
  '1': { name: 'isolated', description: 'single tile' },
  '2': { name: 'pair', description: 'pair' },
  '3': { name: 'triplet', description: 'meld' },
  '4': { name: 'quad', description: 'four of a kind' },
  '11': { name: 'ryanmen', description: 'open two-sided' },
  '101': { name: 'kanchan', description: 'closed middle' },
  '111': { name: 'run', description: 'meld' },
  '1111': { name: 'nobetan', description: 'abcd' },
  '121': { name: 'nakabukure', description: 'abbc' },
  '11111': { name: 'sanmenchan', description: 'abcde' },
  '10101': { name: 'ryankan', description: 'a_c_e' },
  '211': { name: 'aabc', description: 'pair + ryanmen' },
  '112': { name: 'abcc', description: 'ryanmen + pair' },
  '31': { name: 'aaab', description: 'triplet + neighbour' },
  '13': { name: 'abbb', description: 'neighbour + triplet' },
  '301': { name: 'aaac', description: 'triplet + gap tile' },
  '103': { name: 'accc', description: 'gap tile + triplet' },
  '22': { name: 'aabb', description: 'two adjacent pairs' },
  '202': { name: 'aacc', description: 'two pairs, one apart' },
  '2101': { name: 'aabd', description: 'pair + kanchan' },
  '1012': { name: 'abdd', description: 'kanchan + pair' },
};

function patternKey(c: number[]): string {
  let lo = 0;
  while (lo < c.length && c[lo] === 0) lo++;
  let hi = c.length - 1;
  while (hi >= 0 && c[hi] === 0) hi--;
  return hi < lo ? '' : c.slice(lo, hi + 1).join('');
}

/**
 * Named shape for one connected group, or undefined if it isn't in the table.
 * For suits pass 9 counts (absolute ranks, so penchan can be detected).
 */
export function labelShape(shape: string | number[], allowSeq = true): ShapeLabel | undefined {
  const c = toCounts(shape);
  const key = patternKey(c);
  if (!allowSeq) return ['1', '2', '3', '4'].includes(key) ? LABELS[key] : undefined;
  if (key === '11') {
    const lo = c.findIndex((n) => n > 0);
    if (lo === 0 || lo === 7) return { name: 'penchan', description: 'edge wait' };
  }
  return LABELS[key];
}

// ---------------------------------------------------------------------------
// Decomposition (the one the shanten search would choose) and hand description.

export type BlockKind = 'meld' | 'pair' | 'partial' | 'isolated';
export interface Block {
  kind: BlockKind;
  /** Tile indices (0..33). */
  tiles: number[];
}

interface SuitOption {
  m: number;
  t: number;
  p: number;
  blocks: Block[];
}

/** Every distinct (melds, partials, head) outcome for one suit, with one block list each. */
function suitOptions(c: number[], offset: number, allowSeq: boolean): SuitOption[] {
  const seen = new Map<string, SuitOption>();
  const blocks: Block[] = [];
  const walk = (m: number, t: number, p: number) => {
    let i = 0;
    while (i < c.length && c[i] === 0) i++;
    if (i === c.length) {
      const key = `${m},${t},${p}`;
      if (!seen.has(key)) seen.set(key, { m, t, p, blocks: blocks.map((b) => ({ kind: b.kind, tiles: [...b.tiles] })) });
      return;
    }
    const take = (idx: number[], kind: BlockKind, dm: number, dt: number, dp: number) => {
      for (const j of idx) c[j]--;
      blocks.push({ kind, tiles: idx.map((j) => j + offset) });
      walk(m + dm, t + dt, p + dp);
      blocks.pop();
      for (const j of idx) c[j]++;
    };
    if (c[i] >= 3) take([i, i, i], 'meld', 1, 0, 0);
    if (allowSeq && i + 2 < c.length && c[i + 1] && c[i + 2]) take([i, i + 1, i + 2], 'meld', 1, 0, 0);
    if (c[i] >= 2) {
      if (p === 0) take([i, i], 'pair', 0, 0, 1);
      take([i, i], 'pair', 0, 1, 0);
    }
    if (allowSeq && i + 1 < c.length && c[i + 1]) take([i, i + 1], 'partial', 0, 1, 0);
    if (allowSeq && i + 2 < c.length && c[i + 2]) take([i, i + 2], 'partial', 0, 1, 0);
    take([i], 'isolated', 0, 0, 0);
  };
  walk(0, 0, 0);
  return [...seen.values()];
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/** A decomposition reaching the lowest standard shanten (ties: more melds, then a head). */
export function decomposeHand(hand: number[], meldCount = 0): Block[] {
  const groups = [0, 1, 2].map((s) => suitOptions(hand.slice(s * 9, s * 9 + 9), s * 9, true));
  groups.push(suitOptions(hand.slice(27, 34), 27, false));
  const free = 4 - meldCount;
  let best: { score: number[]; picks: SuitOption[] } | undefined;
  const pick: SuitOption[] = [];
  const rec = (g: number, m: number, t: number, p: number) => {
    if (p > 1 || m > free) return;
    if (g === groups.length) {
      const sh = 8 - 2 * (meldCount + m) - Math.min(t, free - m) - p;
      const score = [sh, -m, -p];
      if (!best || lexLess(score, best.score)) best = { score, picks: [...pick] };
      return;
    }
    for (const o of groups[g]) {
      pick.push(o);
      rec(g + 1, m + o.m, t + o.t, p + o.p);
      pick.pop();
    }
  };
  rec(0, 0, 0, 0);
  return best ? best.picks.flatMap((o) => o.blocks) : [];
}

export interface HandGroup {
  /** 0 man, 1 pin, 2 sou, 3 honors. */
  suit: number;
  /** Tile indices, sorted, with repeats. */
  tiles: number[];
  label?: string;
  description?: string;
  /** Tile indices that would finish this group if it were the last unfinished part. */
  waits: number[];
  waitTiles: number;
  /** Already all melds (or melds + pair). */
  complete: boolean;
  /** Blocks of the shanten decomposition that fall in this group. */
  blocks: Block[];
}

/**
 * Split the closed hand into connected groups (tiles no more than 2 apart in a
 * suit; each honor type on its own), with shape labels and waits.
 * `remaining` (34 counts) gives wait copies; default is 4 - copies in hand.
 */
export function describeHand(hand: number[], meldCount = 0, remaining?: number[]): HandGroup[] {
  const blocks = decomposeHand(hand, meldCount);
  const groups: HandGroup[] = [];
  const build = (suit: number, lo: number, hi: number) => {
    const tiles: number[] = [];
    for (let i = lo; i <= hi; i++) for (let k = 0; k < hand[i]; k++) tiles.push(i);
    let counts: number[];
    let base: number;
    let allowSeq: boolean;
    if (suit < 3) {
      // Full 9-rank suit so waits outside the group (e.g. 12 -> 3) are found.
      base = suit * 9;
      counts = new Array(9).fill(0);
      for (let i = lo; i <= hi; i++) counts[i - base] = hand[i];
      allowSeq = true;
    } else {
      base = lo;
      counts = [hand[lo]];
      allowSeq = false;
    }
    const rem = remaining ? remaining.slice(base, base + counts.length) : undefined;
    const w = shapeWaits(counts, rem, allowSeq);
    const label = labelShape(counts, allowSeq);
    groups.push({
      suit,
      tiles,
      label: label?.name,
      description: label?.description,
      waits: w.waits.map((r) => base + r - 1),
      waitTiles: w.tiles,
      complete: isCompleteGroup(counts, allowSeq),
      blocks: blocks.filter((b) => b.tiles[0] >= lo && b.tiles[0] <= hi),
    });
  };
  for (let s = 0; s < 3; s++) {
    let start = -1;
    let last = -1;
    for (let i = s * 9; i < s * 9 + 9; i++) {
      if (!hand[i]) continue;
      if (start >= 0 && i - last > 2) {
        build(s, start, last);
        start = -1;
      }
      if (start < 0) start = i;
      last = i;
    }
    if (start >= 0) build(s, start, last);
  }
  for (let i = 27; i < 34; i++) if (hand[i]) build(3, i, i);
  return groups;
}
