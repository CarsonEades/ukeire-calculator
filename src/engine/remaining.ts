import { type Counts, type Meld, TILE_TYPES, emptyCounts, meldCounts } from './tiles';

/** Copies left of each tile type: 4 - hand - own melds - visible (never below 0). */
export function remainingCounts(hand: Counts, melds: Meld[] = [], visible: Counts = emptyCounts()): Counts {
  const mc = meldCounts(melds);
  const out = emptyCounts();
  for (let i = 0; i < TILE_TYPES; i++) out[i] = Math.max(0, 4 - hand[i] - mc[i] - visible[i]);
  return out;
}
