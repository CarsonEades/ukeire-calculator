import type { Counts } from '../engine/tiles';
import { Tile } from './Tile';

interface Props {
  remaining: Counts;
  /** True when the hand (or visible list) can't take more tiles. */
  full: boolean;
  onAdd: (tile: number) => void;
}

const ROWS = [
  { name: 'Man', start: 0, len: 9 },
  { name: 'Pin', start: 9, len: 9 },
  { name: 'Sou', start: 18, len: 9 },
  { name: 'Honors', start: 27, len: 7 },
];

/** 34 clickable tiles in four rows, each with a copies-left badge. */
export function TilePalette({ remaining, full, onAdd }: Props) {
  return (
    <div className="palette" role="group" aria-label="Tile palette">
      {ROWS.map((row) => (
        <div className="palette-row" key={row.name}>
          {Array.from({ length: row.len }, (_, k) => {
            const t = row.start + k;
            const left = remaining[t];
            return (
              <Tile
                key={t}
                tile={t}
                badge={left}
                dim={left === 0}
                disabled={left === 0 || full}
                onClick={() => onAdd(t)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
