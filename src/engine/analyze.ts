// One-call analysis used by the UI. Pure TypeScript, no React.

import { remainingCounts } from './remaining';
import { type HandForm, type ShantenOptions, shanten } from './shanten';
import { type Counts, type Meld, emptyCounts, expectedSizes, meldCounts, TILE_TYPES, tileName, totalTiles } from './tiles';
import { type AcceptedTile, type TileContribution, type UpgradeResult, analyzeDiscards, tileContributions, ukeire, upgrades } from './ukeire';

export interface ResultRow {
  /** Tile discarded, or null for a 13-tile (3n+1) hand. */
  discard: number | null;
  shanten: number;
  forms: HandForm[];
  tiles: AcceptedTile[];
  total: number;
  upgrades: UpgradeResult;
  /** The 3n+1 hand this row describes (after the discard). */
  hand: Counts;
}

export type AnalysisStatus = 'empty' | 'incomplete' | 'invalid' | 'ready';

export interface Analysis {
  status: AnalysisStatus;
  messages: string[];
  remaining: Counts;
  /** Shanten of the hand as entered (for 14-tile hands, -1 means complete). */
  handShanten?: number;
  handForms?: HandForm[];
  rows: ResultRow[];
  /** Acceptance each hand tile produces by being there (ready hands only). */
  contributions?: Map<number, TileContribution>;
}

export function analyze(hand: Counts, melds: Meld[], visible: Counts = emptyCounts(), opts: ShantenOptions = {}): Analysis {
  const remaining = remainingCounts(hand, melds, visible);
  const size = totalTiles(hand);
  const mc = meldCounts(melds);
  const messages: string[] = [];
  for (let i = 0; i < TILE_TYPES; i++) {
    const n = hand[i] + mc[i] + visible[i];
    if (n > 4) messages.push(`${tileName(i)} appears ${n} times; there are only 4 copies (counting visible tiles).`);
  }
  if (melds.length > 4) messages.push('A hand can have at most 4 called melds.');
  if (messages.length) return { status: 'invalid', messages, remaining, rows: [] };
  if (size === 0 && melds.length === 0) return { status: 'empty', messages, remaining, rows: [] };

  const [evalSize, discardSize] = expectedSizes(melds.length);
  if (size < evalSize) {
    const need = evalSize - size;
    return {
      status: 'incomplete',
      messages: [`Add ${need} more tile${need > 1 ? 's' : ''} (${evalSize} or ${discardSize} closed tiles with ${melds.length} called meld${melds.length === 1 ? '' : 's'}).`],
      remaining,
      rows: [],
    };
  }
  if (size !== evalSize && size !== discardSize) {
    return {
      status: 'invalid',
      messages: [`The closed hand has ${size} tiles; with ${melds.length} called meld${melds.length === 1 ? '' : 's'} it needs ${evalSize} or ${discardSize}.`],
      remaining,
      rows: [],
    };
  }

  const m = melds.length;
  const sh = shanten(hand, m, opts);
  const rows: ResultRow[] = [];
  if (size === evalSize) {
    const h = [...hand];
    rows.push({ discard: null, ...ukeire(h, m, remaining, opts), upgrades: upgrades(h, m, remaining, opts), hand: h });
  } else {
    for (const row of analyzeDiscards(hand, m, remaining, opts)) {
      const h = [...hand];
      h[row.discard]--;
      rows.push({ ...row, upgrades: upgrades(h, m, remaining, opts), hand: h });
    }
  }
  const order = rows[0]?.discard === null ? undefined : rows.map((r) => r.discard as number);
  const contributions = tileContributions(hand, m, remaining, order, opts);
  return { status: 'ready', messages, remaining, handShanten: sh.shanten, handForms: sh.forms, rows, contributions };
}

export function shantenText(s: number): string {
  if (s < 0) return 'Complete hand';
  if (s === 0) return 'Tenpai';
  return `${s}-shanten`;
}
