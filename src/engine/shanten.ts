// Shanten for standard hands, seven pairs (chiitoitsu) and thirteen orphans (kokushi).
// Shanten = tiles away from tenpai: 0 = tenpai, -1 = complete.

import { type Counts, TILE_TYPES, isTerminalOrHonor } from './tiles';

export type HandForm = 'standard' | 'chiitoitsu' | 'kokushi';

export const FORM_LABEL: Record<HandForm, string> = {
  standard: 'standard',
  chiitoitsu: 'seven pairs',
  kokushi: 'thirteen orphans',
};

export interface ShantenOptions {
  /** Count seven pairs and thirteen orphans (default true). They also need a closed hand. */
  specialForms?: boolean;
}

function specialAllowed(meldCount: number, opts: ShantenOptions): boolean {
  return meldCount === 0 && opts.specialForms !== false;
}

// ---------------------------------------------------------------------------
// Standard hands.
//
// Each suit is decomposed on its own and the result is memoised by the suit's
// count pattern. A suit "table" stores, for every (head used?, melds) pair,
// the most partial shapes (taatsu) that decomposition can also hold:
//   table[p * 5 + m] = max taatsu, or NONE if (p, m) is unreachable.
// Keeping the max taatsu per (p, m) is enough because the formula
//   shanten = 8 - 2m - min(t, 4 - m) - p
// never gets worse with more taatsu.

const NONE = -1;
const MAX_M = 4;
const ROW = MAX_M + 1;
type Table = Int8Array; // length 2 * ROW

function emptyTable(): Table {
  return new Int8Array(2 * ROW).fill(NONE);
}

const suitMemo = new Map<number, Table>();
const honorMemo = new Map<number, Table>();

function keyOf(c: number[]): number {
  let k = 0;
  for (let i = c.length - 1; i >= 0; i--) k = k * 5 + c[i];
  return k;
}

function absorb(target: Table, sub: Table, dm: number, dt: number, dp: number): void {
  for (let p = 0; p + dp <= 1; p++) {
    for (let m = 0; m + dm <= MAX_M; m++) {
      const t = sub[p * ROW + m];
      if (t === NONE) continue;
      const idx = (p + dp) * ROW + m + dm;
      const nt = t + dt;
      if (nt > target[idx]) target[idx] = nt;
    }
  }
}

/** Decompose one suit (allowSeq) or the honors (no runs, no partial runs). */
function groupTable(c: number[], allowSeq: boolean): Table {
  const memo = allowSeq ? suitMemo : honorMemo;
  const key = keyOf(c);
  const hit = memo.get(key);
  if (hit) return hit;

  const out = emptyTable();
  let i = 0;
  while (i < c.length && c[i] === 0) i++;
  if (i === c.length) {
    out[0] = 0;
    memo.set(key, out);
    return out;
  }
  const L = c.length;
  const take = (idx: number[], dm: number, dt: number, dp: number) => {
    for (const j of idx) c[j]--;
    absorb(out, groupTable(c, allowSeq), dm, dt, dp);
    for (const j of idx) c[j]++;
  };

  take([i], 0, 0, 0); // leave this tile isolated
  if (c[i] >= 3) take([i, i, i], 1, 0, 0);
  if (c[i] >= 2) {
    take([i, i], 0, 0, 1); // head
    take([i, i], 0, 1, 0); // pair used as a partial (shanpon half)
  }
  if (allowSeq) {
    if (i + 2 < L && c[i + 1] > 0 && c[i + 2] > 0) take([i, i + 1, i + 2], 1, 0, 0);
    if (i + 1 < L && c[i + 1] > 0) take([i, i + 1], 0, 1, 0); // ryanmen / penchan
    if (i + 2 < L && c[i + 2] > 0) take([i, i + 2], 0, 1, 0); // kanchan
  }
  memo.set(key, out);
  return out;
}

function merge(a: Table, b: Table): Table {
  const out = emptyTable();
  for (let pa = 0; pa <= 1; pa++) {
    for (let ma = 0; ma <= MAX_M; ma++) {
      const ta = a[pa * ROW + ma];
      if (ta === NONE) continue;
      for (let pb = 0; pa + pb <= 1; pb++) {
        for (let mb = 0; ma + mb <= MAX_M; mb++) {
          const tb = b[pb * ROW + mb];
          if (tb === NONE) continue;
          const idx = (pa + pb) * ROW + ma + mb;
          const t = ta + tb;
          if (t > out[idx]) out[idx] = t;
        }
      }
    }
  }
  return out;
}

const scratch9 = new Array(9).fill(0);
const scratch7 = new Array(7).fill(0);

function suitTableOf(hand: Counts, suit: number): Table {
  for (let r = 0; r < 9; r++) scratch9[r] = hand[suit * 9 + r];
  return groupTable(scratch9, true);
}

function honorTableOf(hand: Counts): Table {
  for (let r = 0; r < 7; r++) scratch7[r] = hand[27 + r];
  return groupTable(scratch7, false);
}

/** Standard-hand shanten. `meldCount` called melds count as completed melds. */
export function standardShanten(hand: Counts, meldCount = 0): number {
  const table = merge(merge(suitTableOf(hand, 0), suitTableOf(hand, 1)), merge(suitTableOf(hand, 2), honorTableOf(hand)));
  return evaluate(table, meldCount);
}

function groupTableOf(hand: Counts, g: number): Table {
  return g < 3 ? suitTableOf(hand, g) : honorTableOf(hand);
}

/**
 * Shanten (lowest of all forms) after drawing each tile type, for hot loops.
 * Only the drawn tile's suit is re-decomposed; the other three suits are
 * merged once. Entry is 99 where the hand already holds 4 copies.
 */
export function drawShantens(hand: Counts, meldCount = 0, opts: ShantenOptions = {}): Int8Array {
  const out = new Int8Array(TILE_TYPES).fill(99);
  const tables = [0, 1, 2, 3].map((g) => groupTableOf(hand, g));
  const others = [
    merge(merge(tables[1], tables[2]), tables[3]),
    merge(merge(tables[0], tables[2]), tables[3]),
    merge(merge(tables[0], tables[1]), tables[3]),
    merge(merge(tables[0], tables[1]), tables[2]),
  ];
  const closed = specialAllowed(meldCount, opts);
  let pairs = 0;
  let distinct = 0;
  let thDistinct = 0;
  let thPaired = false;
  if (closed) {
    for (let i = 0; i < TILE_TYPES; i++) {
      if (hand[i] >= 1) distinct++;
      if (hand[i] >= 2) pairs++;
      if (isTerminalOrHonor(i) && hand[i] >= 1) {
        thDistinct++;
        if (hand[i] >= 2) thPaired = true;
      }
    }
  }
  for (let t = 0; t < TILE_TYPES; t++) {
    if (hand[t] >= 4) continue;
    const g = t < 27 ? Math.floor(t / 9) : 3;
    hand[t]++;
    let s = evaluate(merge(groupTableOf(hand, g), others[g]), meldCount);
    hand[t]--;
    if (closed) {
      const p = pairs + (hand[t] === 1 ? 1 : 0);
      const d = distinct + (hand[t] === 0 ? 1 : 0);
      s = Math.min(s, 6 - p + Math.max(0, 7 - d));
      if (isTerminalOrHonor(t)) {
        const kd = thDistinct + (hand[t] === 0 ? 1 : 0);
        s = Math.min(s, 13 - kd - (thPaired || hand[t] === 1 ? 1 : 0));
      } else {
        s = Math.min(s, 13 - thDistinct - (thPaired ? 1 : 0));
      }
    }
    out[t] = s;
  }
  return out;
}

function evaluate(table: Table, meldCount: number): number {
  const free = MAX_M - meldCount;
  let best = 8;
  for (let p = 0; p <= 1; p++) {
    for (let m = 0; m <= free; m++) {
      const t = table[p * ROW + m];
      if (t === NONE) continue;
      const s = 8 - 2 * (meldCount + m) - Math.min(t, free - m) - p;
      if (s < best) best = s;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Seven pairs and thirteen orphans (closed hands only).

export function chiitoitsuShanten(hand: Counts): number {
  let pairs = 0;
  let distinct = 0;
  for (let i = 0; i < TILE_TYPES; i++) {
    if (hand[i] >= 1) distinct++;
    if (hand[i] >= 2) pairs++;
  }
  return 6 - pairs + Math.max(0, 7 - distinct);
}

export function kokushiShanten(hand: Counts): number {
  let distinct = 0;
  let paired = false;
  for (let i = 0; i < TILE_TYPES; i++) {
    if (!isTerminalOrHonor(i) || hand[i] === 0) continue;
    distinct++;
    if (hand[i] >= 2) paired = true;
  }
  return 13 - distinct - (paired ? 1 : 0);
}

export interface ShantenResult {
  shanten: number;
  /** Every form that reaches the lowest shanten. */
  forms: HandForm[];
}

/** Lowest shanten across the three forms. Special forms need a closed 13/14-tile hand. */
export function shanten(hand: Counts, meldCount = 0, opts: ShantenOptions = {}): ShantenResult {
  const std = standardShanten(hand, meldCount);
  if (!specialAllowed(meldCount, opts)) return { shanten: std, forms: ['standard'] };
  const chi = chiitoitsuShanten(hand);
  const kok = kokushiShanten(hand);
  const best = Math.min(std, chi, kok);
  const forms: HandForm[] = [];
  if (std === best) forms.push('standard');
  if (chi === best) forms.push('chiitoitsu');
  if (kok === best) forms.push('kokushi');
  return { shanten: best, forms };
}

/** Just the number, for hot loops. */
export function shantenValue(hand: Counts, meldCount = 0, opts: ShantenOptions = {}): number {
  const std = standardShanten(hand, meldCount);
  if (!specialAllowed(meldCount, opts)) return std;
  return Math.min(std, chiitoitsuShanten(hand), kokushiShanten(hand));
}
