// Yaku of a complete hand, and of each winning tile of a tenpai hand. Pure TypeScript.
// Only yaku that follow from the tiles (plus seat/round wind and ron/tsumo) are counted;
// riichi, ippatsu, haitei, rinshan, chankan and dora depend on the moment and are left out.
// Called kans are treated as open (the notation has no closed-kan form).

import { kokushiShanten } from './shanten';
import { type Counts, type Meld, TILE_TYPES, isHonor, isTerminalOrHonor } from './tiles';

export interface YakuContext {
  /** 0 East … 3 North. Default East. */
  seatWind?: number;
  /** 0 East … 3 North. Default East. */
  roundWind?: number;
  /** Self-drawn win (default ron). */
  tsumo?: boolean;
  /** The tile that completed the hand. If absent, the best reading over every tile in the closed hand is used. */
  winTile?: number;
  /** Count seven pairs and thirteen orphans (default true). */
  specialForms?: boolean;
}

export interface Yaku {
  name: string;
  /** Han for regular yaku; 1 for each yakuman (double yakuman are not counted). */
  han: number;
}

export interface YakuResult {
  yaku: Yaku[];
  /** Total han of regular yaku (0 when the hand is a yakuman). */
  han: number;
  /** Number of yakuman (0 if none). */
  yakuman: number;
  /** The winning tile this reading assumes. */
  winTile: number;
}

/** Short English meaning of each yaku name, for tooltips. */
export const YAKU_MEANING: Record<string, string> = {
  'Menzen tsumo': 'Self-drawn win with a closed hand',
  Tanyao: 'All simples (no terminals or honors)',
  Pinfu: 'All runs, a non-value pair and a two-sided wait (closed)',
  Iipeikou: 'Two identical runs (closed)',
  Haku: 'Triplet of white dragons',
  Hatsu: 'Triplet of green dragons',
  Chun: 'Triplet of red dragons',
  'Seat wind': 'Triplet of your seat wind',
  'Round wind': 'Triplet of the round wind',
  Chanta: 'Every group and the pair has a terminal or honor',
  Junchan: 'Every group and the pair has a terminal, no honors',
  Ittsu: '1-2-3, 4-5-6, 7-8-9 in one suit',
  Sanshoku: 'The same run in all three suits',
  'Sanshoku doukou': 'The same triplet in all three suits',
  Toitoi: 'All triplets',
  Sanankou: 'Three concealed triplets',
  Sankantsu: 'Three kans',
  Honroutou: 'Only terminals and honors',
  Shousangen: 'Two dragon triplets and a dragon pair',
  Chiitoitsu: 'Seven pairs',
  Honitsu: 'One suit plus honors',
  Ryanpeikou: 'Two sets of identical runs (closed)',
  Chinitsu: 'One suit only',
  'Kokushi musou': 'Thirteen orphans',
  Suuankou: 'Four concealed triplets',
  Daisangen: 'Triplets of all three dragons',
  Shousuushii: 'Three wind triplets and a wind pair',
  Daisuushii: 'Triplets of all four winds',
  Tsuuiisou: 'All honors',
  Ryuuiisou: 'All green (2 3 4 6 8 sou and green dragon)',
  Chinroutou: 'Only terminals',
  'Chuuren poutou': 'Nine gates: 1112345678999 plus one, in one suit (closed)',
  Suukantsu: 'Four kans',
};

const ORDER = Object.keys(YAKU_MEANING);
const DRAGONS = [31, 32, 33];
const GREEN = new Set([19, 20, 21, 23, 25, 32]);

type GroupKind = 'seq' | 'trip' | 'pair';
interface Group {
  kind: GroupKind;
  /** First tile (lowest for runs). */
  tile: number;
  open: boolean;
  kan?: boolean;
}
type Wait = 'ryanmen' | 'kanchan' | 'penchan' | 'shanpon' | 'tanki';

/** Every way to split closed counts (3n+2 tiles) into one pair and runs/triplets. */
function decompositions(c: Counts): Group[][] {
  const out: Group[][] = [];
  const sets = (acc: Group[]) => {
    let i = 0;
    while (i < TILE_TYPES && c[i] === 0) i++;
    if (i === TILE_TYPES) {
      out.push([...acc]);
      return;
    }
    if (c[i] >= 3) {
      c[i] -= 3;
      acc.push({ kind: 'trip', tile: i, open: false });
      sets(acc);
      acc.pop();
      c[i] += 3;
    }
    if (!isHonor(i) && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--, c[i + 1]--, c[i + 2]--;
      acc.push({ kind: 'seq', tile: i, open: false });
      sets(acc);
      acc.pop();
      c[i]++, c[i + 1]++, c[i + 2]++;
    }
  };
  for (let p = 0; p < TILE_TYPES; p++) {
    if (c[p] < 2) continue;
    c[p] -= 2;
    sets([{ kind: 'pair', tile: p, open: false }]);
    c[p] += 2;
  }
  return out;
}

function waitOf(g: Group, win: number): Wait {
  if (g.kind === 'pair') return 'tanki';
  if (g.kind === 'trip') return 'shanpon';
  const pos = win - g.tile;
  if (pos === 1) return 'kanchan';
  if ((pos === 2 && g.tile % 9 === 0) || (pos === 0 && g.tile % 9 === 6)) return 'penchan';
  return 'ryanmen';
}

const groupTiles = (g: Group): number[] =>
  g.kind === 'seq' ? [g.tile, g.tile + 1, g.tile + 2] : g.kind === 'pair' ? [g.tile, g.tile] : [g.tile, g.tile, g.tile];
const hasTermOrHonor = (g: Group) => groupTiles(g).some(isTerminalOrHonor);

function finish(found: Yaku[], yakuman: Yaku[], winTile: number): YakuResult {
  if (yakuman.length) {
    yakuman.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
    return { yaku: yakuman, han: 0, yakuman: yakuman.reduce((s, y) => s + y.han, 0), winTile };
  }
  found.sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name));
  return { yaku: found, han: found.reduce((s, y) => s + y.han, 0), yakuman: 0, winTile };
}

/** Yaku that depend only on which tiles are in the hand. */
function tileYaku(all: Counts, closed: boolean, found: Yaku[], yakuman: Yaku[]) {
  const tiles: number[] = [];
  all.forEach((n, i) => n > 0 && tiles.push(i));
  const suits = new Set(tiles.filter((x) => !isHonor(x)).map((x) => Math.floor(x / 9)));
  const honors = tiles.some(isHonor);
  if (tiles.every(isHonor)) yakuman.push({ name: 'Tsuuiisou', han: 1 });
  if (tiles.every((x) => GREEN.has(x))) yakuman.push({ name: 'Ryuuiisou', han: 1 });
  if (tiles.every((x) => !isHonor(x) && isTerminalOrHonor(x))) yakuman.push({ name: 'Chinroutou', han: 1 });
  if (tiles.every((x) => !isTerminalOrHonor(x))) found.push({ name: 'Tanyao', han: 1 });
  if (honors && tiles.every(isTerminalOrHonor) && !tiles.every(isHonor)) found.push({ name: 'Honroutou', han: 2 });
  if (suits.size === 1 && !honors) found.push({ name: 'Chinitsu', han: closed ? 6 : 5 });
  if (suits.size === 1 && honors) found.push({ name: 'Honitsu', han: closed ? 3 : 2 });
}

function better(a: YakuResult | null, b: YakuResult): YakuResult {
  if (!a) return b;
  if (b.yakuman !== a.yakuman) return b.yakuman > a.yakuman ? b : a;
  return b.han > a.han ? b : a;
}

/** One reading: a standard split with the winning tile in group `wi`. */
function readStandard(groups: Group[], wi: number, win: number, ctx: Required<Omit<YakuContext, 'winTile'>>, closed: boolean, all: Counts): YakuResult {
  const found: Yaku[] = [];
  const yakuman: Yaku[] = [];
  const wait = waitOf(groups[wi], win);
  const pair = groups.find((g) => g.kind === 'pair')!;
  const sets = groups.filter((g) => g.kind !== 'pair');
  const seqs = sets.filter((g) => g.kind === 'seq');
  const trips = sets.filter((g) => g.kind === 'trip');
  const seat = 27 + ctx.seatWind;
  const round = 27 + ctx.roundWind;
  const ankou = trips.filter((g) => !g.open && !(!ctx.tsumo && g === groups[wi])).length;
  const kans = trips.filter((g) => g.kan).length;
  const has = (t: number) => trips.some((g) => g.tile === t);

  // Yakuman.
  if (ankou === 4) yakuman.push({ name: 'Suuankou', han: 1 });
  if (DRAGONS.every(has)) yakuman.push({ name: 'Daisangen', han: 1 });
  const windTrips = [27, 28, 29, 30].filter(has).length;
  if (windTrips === 4) yakuman.push({ name: 'Daisuushii', han: 1 });
  else if (windTrips === 3 && pair.tile >= 27 && pair.tile <= 30) yakuman.push({ name: 'Shousuushii', han: 1 });
  if (kans === 4) yakuman.push({ name: 'Suukantsu', han: 1 });
  if (closed) {
    const s = Math.floor(win / 9);
    if (!isHonor(win) && all.every((n, i) => n === 0 || Math.floor(i / 9) === s)) {
      const r = all.slice(s * 9, s * 9 + 9);
      if (r[0] >= 3 && r[8] >= 3 && r.every((n) => n >= 1)) yakuman.push({ name: 'Chuuren poutou', han: 1 });
    }
  }
  tileYaku(all, closed, found, yakuman);

  if (closed && ctx.tsumo) found.push({ name: 'Menzen tsumo', han: 1 });
  const valuePair = DRAGONS.includes(pair.tile) || pair.tile === seat || pair.tile === round;
  if (closed && seqs.length === 4 && !valuePair && wait === 'ryanmen') found.push({ name: 'Pinfu', han: 1 });
  if (closed) {
    const key = (g: Group) => g.tile;
    const counts = new Map<number, number>();
    for (const g of seqs) counts.set(key(g), (counts.get(key(g)) ?? 0) + 1);
    const dup = [...counts.values()].reduce((s, n) => s + Math.floor(n / 2), 0);
    if (dup === 2) found.push({ name: 'Ryanpeikou', han: 3 });
    else if (dup === 1) found.push({ name: 'Iipeikou', han: 1 });
  }
  ['Haku', 'Hatsu', 'Chun'].forEach((name, i) => has(DRAGONS[i]) && found.push({ name, han: 1 }));
  if (has(seat)) found.push({ name: 'Seat wind', han: 1 });
  if (has(round)) found.push({ name: 'Round wind', han: 1 });
  if (seqs.length && groups.every(hasTermOrHonor)) {
    if (all.some((n, i) => n > 0 && isHonor(i))) found.push({ name: 'Chanta', han: closed ? 2 : 1 });
    else found.push({ name: 'Junchan', han: closed ? 3 : 2 });
  }
  for (let s = 0; s < 3; s++) {
    if ([0, 3, 6].every((r) => seqs.some((g) => g.tile === s * 9 + r))) found.push({ name: 'Ittsu', han: closed ? 2 : 1 });
  }
  for (let r = 0; r < 9; r++) {
    if (r <= 6 && [0, 1, 2].every((s) => seqs.some((g) => g.tile === s * 9 + r))) found.push({ name: 'Sanshoku', han: closed ? 2 : 1 });
    if ([0, 1, 2].every((s) => has(s * 9 + r))) found.push({ name: 'Sanshoku doukou', han: 2 });
  }
  if (trips.length === 4) found.push({ name: 'Toitoi', han: 2 });
  if (ankou === 3) found.push({ name: 'Sanankou', han: 2 });
  if (kans === 3) found.push({ name: 'Sankantsu', han: 2 });
  if (DRAGONS.filter(has).length === 2 && DRAGONS.includes(pair.tile)) found.push({ name: 'Shousangen', han: 2 });
  return finish(found, yakuman, win);
}

/**
 * Yaku of a complete hand. `hand` is the closed part (3n+2 tiles, winning tile included).
 * Returns null if the hand is not complete.
 */
export function evaluateYaku(hand: Counts, melds: Meld[], ctx: YakuContext = {}): YakuResult | null {
  const c: Required<Omit<YakuContext, 'winTile'>> = {
    seatWind: ctx.seatWind ?? 0,
    roundWind: ctx.roundWind ?? 0,
    tsumo: ctx.tsumo ?? false,
    specialForms: ctx.specialForms ?? true,
  };
  const closed = melds.length === 0;
  const all = [...hand];
  for (const m of melds) for (const t of m.tiles) all[t]++;
  const wins = ctx.winTile !== undefined ? [ctx.winTile] : hand.flatMap((n, i) => (n > 0 ? [i] : []));
  const meldGroups: Group[] = melds.map((m) => ({ kind: m.kind === 'chi' ? 'seq' : 'trip', tile: m.tiles[0], open: true, kan: m.kind === 'kan' }));

  let best: YakuResult | null = null;
  for (const groups of decompositions([...hand])) {
    const full = [...groups, ...meldGroups];
    for (const win of wins) {
      for (let wi = 0; wi < groups.length; wi++) {
        if (!groupTiles(groups[wi]).includes(win)) continue;
        best = better(best, readStandard(full, wi, win, c, closed, all));
      }
    }
  }
  if (closed && c.specialForms) {
    if (hand.reduce((s, n) => s + n, 0) === 14 && kokushiShanten(hand) === -1) {
      const win = wins[0];
      best = better(best, finish([], [{ name: 'Kokushi musou', han: 1 }], win));
    }
    if (hand.filter((n) => n === 2).length === 7) {
      const found: Yaku[] = [{ name: 'Chiitoitsu', han: 2 }];
      const yakuman: Yaku[] = [];
      if (c.tsumo) found.push({ name: 'Menzen tsumo', han: 1 });
      tileYaku(all, true, found, yakuman);
      best = better(best, finish(found, yakuman, wins[0]));
    }
  }
  return best;
}

/** For a tenpai hand (3n+1 closed tiles), the yaku each winning tile would give. */
export function waitYaku(hand: Counts, melds: Meld[], ctx: Omit<YakuContext, 'winTile'> = {}): { tile: number; result: YakuResult }[] {
  const out: { tile: number; result: YakuResult }[] = [];
  const all = [...hand];
  for (const m of melds) for (const t of m.tiles) all[t]++;
  for (let t = 0; t < TILE_TYPES; t++) {
    if (all[t] >= 4) continue;
    const h = [...hand];
    h[t]++;
    const result = evaluateYaku(h, melds, { ...ctx, winTile: t });
    if (result) out.push({ tile: t, result });
  }
  return out;
}
