// Tile ids, names, and the mpsz notation parser/formatter.
// A hand is always an array of 34 counts (index = tile type).

export type Counts = number[];

export const TILE_TYPES = 34;
export const SUITS = ['m', 'p', 's', 'z'] as const;
export type Suit = (typeof SUITS)[number];

export type MeldKind = 'chi' | 'pon' | 'kan';
export interface Meld {
  kind: MeldKind;
  /** Tile indices, sorted ascending (3 for chi/pon, 4 for kan). */
  tiles: number[];
}

export interface ParseResult {
  hand: Counts;
  melds: Meld[];
  /** Red fives per suit: [man, pin, sou]. */
  red: number[];
  error?: string;
}

export const emptyCounts = (): Counts => new Array(TILE_TYPES).fill(0);

export const suitOf = (tile: number): Suit => SUITS[Math.floor(tile / 9)];
export const rankOf = (tile: number): number => (tile % 9) + 1;
export const isHonor = (tile: number): boolean => tile >= 27;
export const isTerminalOrHonor = (tile: number): boolean =>
  tile >= 27 || tile % 9 === 0 || tile % 9 === 8;

export function tileName(tile: number): string {
  return `${rankOf(tile)}${suitOf(tile)}`;
}

/** Index of a single tile like "5p" or "0s" (red five). Returns -1 if invalid. */
export function tileIndex(name: string): number {
  const m = /^([0-9])([mpsz])$/.exec(name.trim());
  if (!m) return -1;
  let rank = Number(m[1]);
  const suit = m[2] as Suit;
  if (rank === 0) {
    if (suit === 'z') return -1;
    rank = 5;
  }
  if (suit === 'z' && rank > 7) return -1;
  return SUITS.indexOf(suit) * 9 + rank - 1;
}

export const HONOR_NAMES = ['East', 'South', 'West', 'North', 'White', 'Green', 'Red'];
const SUIT_NAMES: Record<Suit, string> = { m: 'man', p: 'pin', s: 'sou', z: '' };

export function tileLongName(tile: number): string {
  if (isHonor(tile)) return HONOR_NAMES[tile - 27];
  return `${rankOf(tile)} ${SUIT_NAMES[suitOf(tile)]}`;
}

export const totalTiles = (c: Counts): number => c.reduce((a, b) => a + b, 0);

interface TileGroupParse {
  tiles: number[];
  red: number[];
  error?: string;
}

/** Parse a run like "123m45p0s" into a flat list of tile indices. */
function parseTiles(text: string): TileGroupParse {
  const tiles: number[] = [];
  const red = [0, 0, 0];
  let pending: number[] = [];
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') {
      pending.push(Number(ch));
    } else if (ch === 'm' || ch === 'p' || ch === 's' || ch === 'z') {
      if (pending.length === 0) return { tiles, red, error: `"${ch}" has no digits before it` };
      for (const d of pending) {
        const idx = tileIndex(`${d}${ch}`);
        if (idx < 0) {
          return {
            tiles,
            red,
            error: ch === 'z' ? `"${d}z" is not a tile (honors are 1z-7z)` : `"${d}${ch}" is not a tile`,
          };
        }
        if (d === 0) red[SUITS.indexOf(ch)]++;
        tiles.push(idx);
      }
      pending = [];
    } else {
      return { tiles, red, error: `Unexpected character "${ch}"` };
    }
  }
  if (pending.length) {
    return { tiles, red, error: `"${pending.join('')}" needs a suit letter (m, p, s or z)` };
  }
  return { tiles, red };
}

function meldFromTiles(tiles: number[]): Meld | undefined {
  const t = [...tiles].sort((a, b) => a - b);
  if (t.length === 4 && t.every((x) => x === t[0])) return { kind: 'kan', tiles: t };
  if (t.length !== 3) return undefined;
  if (t[0] === t[1] && t[1] === t[2]) return { kind: 'pon', tiles: t };
  if (
    !isHonor(t[0]) &&
    t[1] === t[0] + 1 &&
    t[2] === t[0] + 2 &&
    suitOf(t[0]) === suitOf(t[2])
  ) {
    return { kind: 'chi', tiles: t };
  }
  return undefined;
}

/**
 * Parse mpsz notation. Called melds go in brackets after the closed hand:
 * `23456m789p11z [555p] [777z]`. Spaces are ignored. Never throws; problems
 * are reported in `error` and the tiles parsed so far are still returned.
 */
export function parseHand(notation: string): ParseResult {
  const hand = emptyCounts();
  const melds: Meld[] = [];
  const red = [0, 0, 0];
  const text = notation.replace(/\s+/g, '');
  const closedPart = text.split('[')[0];
  if (closedPart.includes(']')) return { hand, melds, red, error: 'Unmatched "]"' };
  const closedParse = parseTiles(closedPart);
  for (const t of closedParse.tiles) hand[t]++;
  closedParse.red.forEach((n, i) => (red[i] += n));
  if (closedParse.error) return { hand, melds, red, error: closedParse.error };

  let rest = text.slice(closedPart.length);
  while (rest.length) {
    const m = /^\[([^\]]*)\]/.exec(rest);
    if (!m) return { hand, melds, red, error: 'Called melds must be written like [555p]' };
    const p = parseTiles(m[1]);
    if (p.error) return { hand, melds, red, error: `In meld [${m[1]}]: ${p.error}` };
    const meld = meldFromTiles(p.tiles);
    if (!meld) {
      return { hand, melds, red, error: `[${m[1]}] is not a meld (use a run, triplet or quad)` };
    }
    melds.push(meld);
    p.red.forEach((n, i) => (red[i] += n));
    rest = rest.slice(m[0].length);
  }
  return { hand, melds, red };
}

function formatTiles(counts: Counts, red: number[] = [0, 0, 0]): string {
  let out = '';
  for (let s = 0; s < 4; s++) {
    let digits = '';
    let redLeft = s < 3 ? red[s] : 0;
    for (let r = 0; r < 9; r++) {
      const n = counts[s * 9 + r] ?? 0;
      for (let k = 0; k < n; k++) {
        if (r === 4 && redLeft > 0) {
          digits += '0';
          redLeft--;
        } else digits += String(r + 1);
      }
    }
    if (digits) out += digits + SUITS[s];
  }
  return out;
}

/** Canonical notation. Red fives are written as 0 (hand first, then melds). */
export function formatHand(hand: Counts, melds: Meld[] = [], red: number[] = [0, 0, 0]): string {
  const redLeft = [...red];
  const handRed = redLeft.map((n, s) => Math.min(n, hand[s * 9 + 4]));
  handRed.forEach((n, s) => (redLeft[s] -= n));
  let out = formatTiles(hand, handRed);
  for (const m of melds) {
    const c = emptyCounts();
    for (const t of m.tiles) c[t]++;
    const mr = redLeft.map((n, s) => Math.min(n, c[s * 9 + 4]));
    mr.forEach((n, s) => (redLeft[s] -= n));
    out += `${out ? ' ' : ''}[${formatTiles(c, mr)}]`;
  }
  return out;
}

export function meldCounts(melds: Meld[]): Counts {
  const c = emptyCounts();
  for (const m of melds) for (const t of m.tiles) c[t]++;
  return c;
}

/** Closed-hand sizes that make sense with `meldCount` melds: [evaluate, discard]. */
export function expectedSizes(meldCount: number): [number, number] {
  return [13 - 3 * meldCount, 14 - 3 * meldCount];
}

/**
 * Validation errors (empty if the hand can be analysed).
 * Checks the 4-copy limit across hand + melds + visible, the meld count,
 * and the closed hand size (3n+1 or 3n+2 for the number of melds).
 */
export function validateHand(hand: Counts, melds: Meld[], visible: Counts = emptyCounts()): string[] {
  const errors: string[] = [];
  const mc = meldCounts(melds);
  for (let i = 0; i < TILE_TYPES; i++) {
    const n = hand[i] + mc[i] + visible[i];
    if (n > 4) errors.push(`${tileName(i)} appears ${n} times (max 4 including visible tiles)`);
  }
  if (melds.length > 4) errors.push('A hand can have at most 4 called melds');
  const size = totalTiles(hand);
  const [a, b] = expectedSizes(Math.min(melds.length, 4));
  if (melds.length <= 4 && size !== a && size !== b) {
    const meldText = melds.length ? ` with ${melds.length} called meld${melds.length > 1 ? 's' : ''}` : '';
    errors.push(`The closed hand has ${size} tiles; it needs ${a} or ${b}${meldText}`);
  }
  return errors;
}
