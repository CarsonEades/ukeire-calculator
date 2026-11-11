// Tile acceptance (ukeire) per discard, and upgrades.

import { type Counts, TILE_TYPES } from './tiles';
import { type HandForm, type ShantenOptions, drawShantens, shanten, shantenValue } from './shanten';
import { canSplit, decomposeHand, parseShape } from './shapes';

export interface AcceptedTile {
  tile: number;
  /** Copies left (4 - hand - melds - visible). */
  count: number;
}

export interface UkeireResult {
  shanten: number;
  forms: HandForm[];
  tiles: AcceptedTile[];
  /** Total copies accepted. */
  total: number;
}

/**
 * Acceptance of a 3n+1 hand: every tile type with copies left that lowers
 * shanten when drawn. `hand` is mutated temporarily and restored.
 */
export function ukeire(hand: Counts, meldCount: number, remaining: Counts, opts: ShantenOptions = {}): UkeireResult {
  const base = shanten(hand, meldCount, opts);
  const tiles: AcceptedTile[] = [];
  let total = 0;
  if (base.shanten >= 0) {
    const after = drawShantens(hand, meldCount, opts);
    for (let t = 0; t < TILE_TYPES; t++) {
      if (remaining[t] <= 0 || hand[t] >= 4) continue;
      if (after[t] < base.shanten) {
        tiles.push({ tile: t, count: remaining[t] });
        total += remaining[t];
      }
    }
  }
  return { shanten: base.shanten, forms: base.forms, tiles, total };
}

/** Fast acceptance total, given the known shanten. Used inside upgrade searches. */
export function ukeireTotal(hand: Counts, meldCount: number, remaining: Counts, baseShanten: number, opts: ShantenOptions = {}): number {
  const after = drawShantens(hand, meldCount, opts);
  let total = 0;
  for (let t = 0; t < TILE_TYPES; t++) {
    if (remaining[t] > 0 && after[t] < baseShanten) total += remaining[t];
  }
  return total;
}

export interface DiscardRow extends UkeireResult {
  discard: number;
}

/**
 * For a 3n+2 hand: one row per distinct tile type, with the ukeire of the hand
 * after discarding it. Sorted by shanten (low first) then accepted copies (high first).
 * `remaining` should be computed from the full 14-tile hand.
 */
export function analyzeDiscards(hand: Counts, meldCount: number, remaining: Counts, opts: ShantenOptions = {}): DiscardRow[] {
  const h = [...hand];
  const rows: DiscardRow[] = [];
  for (let d = 0; d < TILE_TYPES; d++) {
    if (h[d] === 0) continue;
    h[d]--;
    rows.push({ discard: d, ...ukeire(h, meldCount, remaining, opts) });
    h[d]++;
  }
  rows.sort((a, b) => a.shanten - b.shanten || b.total - a.total || a.discard - b.discard);
  return rows;
}

export interface TileContribution {
  /** Accepted tile types this tile helps produce. */
  types: number;
  /** Copies left of those types. */
  tiles: number;
  /** The discard that gave the 3n+1 hand this was measured in (null for a 3n+1 hand). */
  frameDiscard: number | null;
  /**
   * Accepted tile types this tile also connects with but that were credited to
   * a more central tile in another group (overlapping acceptance).
   */
  sharedAway: number[];
}

/** How far a tile is from the middle of its suit (0 for a 5; honors count as 0). */
function centerDistance(t: number): number {
  return t >= 27 ? 0 : Math.abs((t % 9) - 4);
}

/** Neighbouring ranks in the same suit (e.g. 7s and 8s). */
function adjacent(t: number, u: number): boolean {
  return t < 27 && u < 27 && Math.floor(t / 9) === Math.floor(u / 9) && Math.abs(t - u) === 1;
}

/** Could drawing `x` connect with `t`? Same tile, or same suit within two ranks. */
function connects(t: number, x: number): boolean {
  if (t === x) return true;
  if (t >= 27 || x >= 27 || Math.floor(t / 9) !== Math.floor(x / 9)) return false;
  return Math.abs(t - x) <= 2;
}

/**
 * How much acceptance each tile in the hand produces by being there.
 *
 * The 3n+1 hand is split into its best standard decomposition. Each accepted
 * tile is credited to the unfinished tiles (pair, partial or isolated) it
 * connects with; if none, to every tile of the complete melds it connects with
 * (the draw works by re-splitting the meld, e.g. 2346 + 1 = 123 + 46). When
 * it connects with tiles in more than one group, a loose (isolated) tile loses
 * it to any group holding a more central tile; pairs and partial shapes always
 * keep their credit, and tiles in the same group share it.
 *
 * For a 3n+2 hand each tile is measured in the hand after the best discard;
 * the best-discard tile itself (when it is the only copy) is measured in the
 * hand after the best discard of a different tile, i.e. as if it were kept.
 */
export function tileContributions(
  hand: Counts,
  meldCount: number,
  remaining: Counts,
  discardOrder?: number[],
  opts: ShantenOptions = {},
): Map<number, TileContribution> {
  const out = new Map<number, TileContribution>();
  const size = hand.reduce((a, b) => a + b, 0);
  const needsDiscard = (size + 3 * meldCount) % 3 === 2;

  const measure = (h: Counts, frameDiscard: number | null): Map<number, TileContribution> => {
    const res = new Map<number, TileContribution>();
    const accepted = ukeire(h, meldCount, remaining, opts).tiles;
    const blocks = decomposeHand(h, meldCount);
    const open = blocks.filter((b) => b.kind !== 'meld');
    const done = blocks.filter((b) => b.kind === 'meld');
    const credit = new Map<number, Set<number>>();
    const lost = new Map<number, Set<number>>();
    const add = (m: Map<number, Set<number>>, t: number, x: number) => {
      if (!m.has(t)) m.set(t, new Set());
      m.get(t)!.add(x);
    };
    for (const a of accepted) {
      // Each block that touches the draw, with the tiles in it that connect.
      const touching = (bs: typeof blocks) =>
        bs
          .map((b) => ({ loose: b.kind === 'isolated', all: b.tiles, ts: b.tiles.filter((t) => connects(t, a.tile)) }))
          .filter((o) => o.ts.length > 0);
      let owners = touching(open);
      if (!owners.length) {
        // The draw only works by re-splitting a complete meld (2346 + 1 = 123 + 46), so every
        // tile in a meld it touches shares the credit.
        owners = touching(done).map((o) => ({ ...o, ts: o.all }));
      }
      if (!owners.length) continue;
      // Overlap: a loose tile keeps the draw only if no other group touching it has a more
      // central tile (closer to a 5). Pairs, partial shapes and melds always keep it, and so
      // does a loose tile right next to a winning group's tile: in 778 the split is 77 + 8,
      // but 78 is a ryanmen, so the 8 is part of that shape.
      const inner = owners.map((o) => Math.min(...o.ts.map(centerDistance)));
      const best = Math.min(...inner);
      const winners = owners.filter((_, i) => inner[i] === best);
      const nextToWinner = (o: (typeof owners)[number]) =>
        o.all.some((t) => winners.some((w) => w !== o && w.all.some((u) => adjacent(t, u))));
      owners.forEach((o, i) => {
        const keeps = !o.loose || inner[i] === best || nextToWinner(o);
        for (const t of o.ts) add(keeps ? credit : lost, t, a.tile);
      });
    }
    for (let t = 0; t < TILE_TYPES; t++) {
      if (!h[t]) continue;
      const set = credit.get(t) ?? new Set<number>();
      let tiles = 0;
      for (const x of set) tiles += remaining[x];
      const sharedAway = [...(lost.get(t) ?? [])].filter((x) => !set.has(x)).sort((p, q) => p - q);
      res.set(t, { types: set.size, tiles, frameDiscard, sharedAway });
    }
    return res;
  };

  if (!needsDiscard) return measure([...hand], null);

  const order = discardOrder ?? analyzeDiscards(hand, meldCount, remaining, opts).map((r) => r.discard);
  if (!order.length) return out;
  const frames = new Map<number, Map<number, TileContribution>>();
  const frame = (d: number) => {
    if (!frames.has(d)) {
      const h = [...hand];
      h[d]--;
      frames.set(d, measure(h, d));
    }
    return frames.get(d)!;
  };
  for (let t = 0; t < TILE_TYPES; t++) {
    if (!hand[t]) continue;
    const d = order.find((x) => !(x === t && hand[t] === 1));
    if (d === undefined) continue;
    const c = frame(d).get(t);
    if (c) out.set(t, c);
  }
  return out;
}

/**
 * Shape-building acceptance of a single-suit shape such as "3456": copies of
 * every draw after which the shape splits exactly into melds plus one
 * two-tile partial (pair, ryanmen, penchan or kanchan). For a 4-tile shape
 * that means "meld + partial". Copies left = 4 - copies in the shape.
 */
export function shapeBuildingAcceptance(shape: string): number {
  const c = parseShape(shape);
  const n = c.reduce((a, b) => a + b, 0) + 1;
  if (n % 3 !== 2) return 0;
  let total = 0;
  for (let x = 0; x < 9; x++) {
    if (c[x] >= 4) continue;
    c[x]++;
    if (canSplit(c, (n - 2) / 3, 0, 1)) total += 4 - (c[x] - 1);
    c[x]--;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Upgrades

export interface UpgradeTile {
  tile: number;
  /** Copies left of the drawn tile. */
  count: number;
  /** Best discard after drawing it. */
  discard: number;
  /** Acceptance after drawing `tile` and discarding `discard`. */
  newTotal: number;
}

export interface QualityTile extends UpgradeTile {
  /** Tile types that would advance the hand, counting types with no copies left. */
  newTypes: number;
  oldTypes: number;
}

export interface UpgradeResult {
  /** Draws that keep shanten and strictly increase acceptance. */
  tiles: UpgradeTile[];
  /** Total copies of upgrade draws. */
  total: number;
  /**
   * Same acceptance but a wider shape (e.g. kanchan -> ryanmen whose other
   * side is dead). Shown for information only, never added to `total`.
   */
  quality: QualityTile[];
}

/** Tile types that lower shanten, ignoring how many copies are left. */
function shapeWidth(hand: Counts, meldCount: number, baseShanten: number, opts: ShantenOptions): number {
  const after = drawShantens(hand, meldCount, opts);
  let n = 0;
  for (let t = 0; t < TILE_TYPES; t++) if (after[t] < baseShanten) n++;
  return n;
}

/**
 * Upgrades of a 3n+1 hand H with acceptance U: draws t (not accepted, copies
 * left) such that some discard d != t keeps shanten and gives acceptance > U.
 * For the new hand the drawn tile counts as one fewer copy left.
 */
export function upgrades(hand: Counts, meldCount: number, remaining: Counts, opts: ShantenOptions = {}): UpgradeResult {
  const h = [...hand];
  const rem = [...remaining];
  const base = shantenValue(h, meldCount, opts);
  const result: UpgradeResult = { tiles: [], total: 0, quality: [] };
  if (base < 0) return result;

  const accepted = new Array<boolean>(TILE_TYPES).fill(false);
  let U = 0;
  const after = drawShantens(h, meldCount, opts);
  for (let t = 0; t < TILE_TYPES; t++) {
    if (rem[t] > 0 && after[t] < base) {
      accepted[t] = true;
      U += rem[t];
    }
  }
  let oldWidth = -1;

  for (let t = 0; t < TILE_TYPES; t++) {
    if (rem[t] <= 0 || h[t] >= 4 || accepted[t]) continue;
    const copies = rem[t];
    h[t]++;
    rem[t]--;
    let best = -1;
    let bestD = -1;
    const sameCount: number[] = [];
    for (let d = 0; d < TILE_TYPES; d++) {
      if (d === t || h[d] === 0) continue;
      h[d]--;
      if (shantenValue(h, meldCount, opts) === base) {
        const tot = ukeireTotal(h, meldCount, rem, base, opts);
        if (tot > best) {
          best = tot;
          bestD = d;
        }
        if (tot === U) sameCount.push(d);
      }
      h[d]++;
    }
    if (best > U) {
      result.tiles.push({ tile: t, count: copies, discard: bestD, newTotal: best });
      result.total += copies;
    } else if (sameCount.length) {
      if (oldWidth < 0) {
        h[t]--;
        oldWidth = shapeWidth(h, meldCount, base, opts);
        h[t]++;
      }
      let bestQ: QualityTile | undefined;
      for (const d of sameCount) {
        h[d]--;
        const w = shapeWidth(h, meldCount, base, opts);
        h[d]++;
        if (w > oldWidth && (!bestQ || w > bestQ.newTypes)) {
          bestQ = { tile: t, count: copies, discard: d, newTotal: U, newTypes: w, oldTypes: oldWidth };
        }
      }
      if (bestQ) result.quality.push(bestQ);
    }
    rem[t]++;
    h[t]--;
  }
  return result;
}
