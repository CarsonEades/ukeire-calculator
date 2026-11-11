import type { CSSProperties } from 'react';
import { type Counts, type Meld, tileName } from '../engine/tiles';
import type { TileContribution } from '../engine/ukeire';
import { Tile } from './Tile';

export interface TileInstance {
  tile: number;
  red: boolean;
}

/** Expand counts into sorted tiles; the first `red[s]` fives of each suit are red. */
export function expandTiles(counts: Counts, red: number[] = [0, 0, 0]): TileInstance[] {
  const out: TileInstance[] = [];
  for (let t = 0; t < counts.length; t++) {
    const s = Math.floor(t / 9);
    for (let k = 0; k < counts[t]; k++) out.push({ tile: t, red: t < 27 && t % 9 === 4 && k < (red[s] ?? 0) });
  }
  return out;
}

/** What happens if this tile is discarded (only for hands that need a discard). */
export interface DiscardInfo {
  total: number;
  /** Discarding it raises shanten. */
  worse: boolean;
  /** One of the best discards. */
  best: boolean;
  /** 0 (fewest tiles among discards that keep shanten) to 1 (most). */
  quality: number;
}

interface Props {
  hand: Counts;
  discards?: Map<number, DiscardInfo>;
  /** Shown above each tile when given. */
  contributions?: Map<number, TileContribution>;
  /** A just-drawn tile, shown apart at the end of the hand. */
  drawnTile?: number | null;
  /** Hover text for what clicking a hand tile does. */
  removeHint?: string;
  melds: Meld[];
  red: number[];
  visible: Counts;
  visibleRed: number[];
  onRemove: (tile: number, red: boolean) => void;
  onRemoveMeld: (index: number) => void;
  onRemoveVisible: (tile: number, red: boolean) => void;
}

/** The current hand (auto-sorted, click to remove), called melds, and visible tiles. */
export function HandRow({
  hand,
  discards,
  contributions,
  drawnTile = null,
  removeHint = 'Click to remove',
  melds,
  red,
  visible,
  visibleRed,
  onRemove,
  onRemoveMeld,
  onRemoveVisible,
}: Props) {
  const tiles: (TileInstance & { drawn?: boolean })[] = expandTiles(hand, red);
  if (drawnTile !== null) {
    // Move one plain copy of the drawn tile to the end.
    let at = -1;
    for (let i = tiles.length - 1; i >= 0; i--) if (tiles[i].tile === drawnTile && !tiles[i].red) { at = i; break; }
    if (at >= 0) tiles.push({ ...tiles.splice(at, 1)[0], drawn: true });
  }
  // Red fives that aren't in the closed hand belong to the melds (in order).
  const meldRedLeft = red.map((n, s) => Math.max(0, n - hand[s * 9 + 4]));
  const visibleTiles = expandTiles(visible, visibleRed);
  return (
    <div className="hand-area">
      <div className="hand-row" aria-label="Your hand">
        {tiles.length === 0 && melds.length === 0 && <span className="placeholder">Click tiles below or type notation to build a hand.</span>}
        {tiles.map((x, i) => {
          const d = discards?.get(x.tile);
          const c = contributions?.get(x.tile);
          if (!d && !c) {
            return (
              <span key={i} className={`hand-slot${x.drawn ? ' slot-drawn' : ''}`}>
                <Tile tile={x.tile} red={x.red} size="lg" title={`${x.drawn ? 'Just drawn. ' : ''}${removeHint}.`} onClick={() => onRemove(x.tile, x.red)} />
              </span>
            );
          }
          const notes: string[] = [];
          if (c) {
            const frame = c.frameDiscard !== null ? ` after cutting ${tileName(c.frameDiscard)}` : '';
            notes.push(`Keeping this tile produces ${c.tiles} accepted tile${c.tiles === 1 ? '' : 's'} (${c.types} type${c.types === 1 ? '' : 's'})${frame}.`);
            if (c.sharedAway.length) {
              notes.push(`It also connects with ${c.sharedAway.map(tileName).join(', ')}, but a more central tile already covers ${c.sharedAway.length === 1 ? 'it' : 'them'}.`);
            }
          }
          if (d) notes.push(`Discarding it ${d.worse ? 'raises shanten' : `accepts ${d.total} tile${d.total === 1 ? '' : 's'}`}.`);
          return (
            <span key={i} className={`hand-slot${x.drawn ? ' slot-drawn' : ''}`}>
              {c && (
                <span className={`slot-gen${c.sharedAway.length ? ' slot-gen-shared' : ''}`}>
                  {c.tiles}
                  {c.types > 0 && <span className="slot-types">({c.types})</span>}
                </span>
              )}
              <Tile tile={x.tile} red={x.red} size="lg" title={`${x.drawn ? 'Just drawn. ' : ''}${notes.join(' ')} ${removeHint}.`} onClick={() => onRemove(x.tile, x.red)} />
              {d && (
                <span
                  className={`slot-total${d.best ? ' slot-best' : ''}${d.worse ? ' slot-worse' : ''}`}
                  style={d.worse ? undefined : ({ '--hue': Math.round(30 + 90 * d.quality) } as CSSProperties)}
                >
                  {d.total}
                </span>
              )}
            </span>
          );
        })}
        {melds.map((m, i) => (
          <button type="button" key={`m${i}`} className="meld" title="Called meld: click to remove" onClick={() => onRemoveMeld(i)}>
            {m.tiles.map((t, k) => {
              const s = Math.floor(t / 9);
              const isRed = t < 27 && t % 9 === 4 && meldRedLeft[s] > 0;
              if (isRed) meldRedLeft[s]--;
              return <Tile key={k} tile={t} red={isRed} size="md" />;
            })}
          </button>
        ))}
      </div>
      {visibleTiles.length > 0 && (
        <div className="visible-row" aria-label="Visible tiles">
          <span className="visible-label">Visible:</span>
          {visibleTiles.map((x, i) => (
            <Tile key={i} tile={x.tile} red={x.red} size="sm" dim title="Visible tile: click to remove" onClick={() => onRemoveVisible(x.tile, x.red)} />
          ))}
        </div>
      )}
    </div>
  );
}
