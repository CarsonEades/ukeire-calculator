import type { MouseEventHandler } from 'react';
import { isHonor, rankOf, suitOf, tileLongName } from '../engine/tiles';

const SUIT_GLYPH: Record<string, string> = { m: '萬', p: '筒', s: '索' };
// Winds as letters; the white dragon (index 4) is a blank tile.
const HONOR_GLYPH = ['E', 'S', 'W', 'N', '', '發', '中'];

export type TileSize = 'sm' | 'md' | 'lg';

interface TileProps {
  tile: number;
  red?: boolean;
  size?: TileSize;
  /** Small number in the corner (copies left). */
  badge?: number;
  dim?: boolean;
  highlight?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: MouseEventHandler;
  onMouseEnter?: MouseEventHandler;
  onMouseLeave?: MouseEventHandler;
}

/** One tile, drawn with CSS: a tile-shaped box with colored rank and suit text. */
export function Tile({ tile, red, size = 'md', badge, dim, highlight, disabled, title, onClick, onMouseEnter, onMouseLeave }: TileProps) {
  const suit = suitOf(tile);
  const classes = ['tile', `tile-${size}`, `suit-${suit}`];
  if (red) classes.push('tile-red');
  if (dim) classes.push('tile-dim');
  if (highlight) classes.push('tile-hl');
  if (onClick) classes.push('tile-btn');
  const label = `${red ? 'Red ' : ''}${tileLongName(tile)}`;
  const face = isHonor(tile) ? (
    tile === 31 ? null : (
      <span className={`honor honor-${tile - 27}${tile < 31 ? ' wind' : ''}`} aria-hidden="true">
        {HONOR_GLYPH[tile - 27]}
      </span>
    )
  ) : (
    <>
      <span className="rank" aria-hidden="true">
        {rankOf(tile)}
      </span>
      <span className="glyph" aria-hidden="true">
        {SUIT_GLYPH[suit]}
      </span>
    </>
  );
  const badgeEl = badge !== undefined ? <span className={`badge${badge === 0 ? ' badge-zero' : ''}`}>{badge}</span> : null;
  const tooltip = title ?? (badge !== undefined ? `${label}: ${badge} left` : label);
  if (onClick) {
    return (
      <button
        type="button"
        className={classes.join(' ')}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        disabled={disabled}
        title={tooltip}
        aria-label={tooltip}
      >
        {face}
        {badgeEl}
      </button>
    );
  }
  return (
    <span
      className={classes.join(' ')}
      title={tooltip}
      role="img"
      aria-label={tooltip}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {face}
      {badgeEl}
    </span>
  );
}
