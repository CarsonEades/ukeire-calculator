import { useMemo } from 'react';
import { type HandForm, FORM_LABEL } from '../engine/shanten';
import { type HandGroup, describeHand } from '../engine/shapes';
import { type Counts, type Meld, tileName } from '../engine/tiles';
import { Tile } from './Tile';

interface Props {
  hand: Counts;
  melds: Meld[];
  remaining: Counts;
  forms: HandForm[];
  title: string;
  highlightTile: number | null;
}

/** Would drawing `tile` touch this group? (Same suit within 2 ranks, or same honor.) */
function improves(g: HandGroup, tile: number): boolean {
  if (g.suit === 3) return g.tiles[0] === tile;
  if (Math.floor(tile / 9) !== g.suit || tile >= 27) return false;
  const lo = g.tiles[0];
  const hi = g.tiles[g.tiles.length - 1];
  return tile >= lo - 2 && tile <= hi + 2;
}

function blockSummary(g: HandGroup): string {
  const names: Record<string, string> = { meld: 'meld', pair: 'pair', partial: 'partial', isolated: 'isolated' };
  return g.blocks.map((b) => names[b.kind]).join(' + ');
}

/** The hand grouped by suit, each group labeled with its shape and wait. */
export function ShapePanel({ hand, melds, remaining, forms, title, highlightTile }: Props) {
  const groups = useMemo(() => describeHand(hand, melds.length, remaining), [hand, melds.length, remaining]);
  const special = forms.filter((f) => f !== 'standard');
  return (
    <section className="shape-panel" aria-label="Shape breakdown">
      <h2>{title}</h2>
      {special.length > 0 && (
        <p className="note">
          Lowest shanten comes from <strong>{special.map((f) => FORM_LABEL[f]).join(' and ')}</strong>
          {forms.includes('standard') ? ' (tied with a standard hand)' : ''}. The groups below show the standard-hand view.
        </p>
      )}
      <ul className="groups">
        {groups.map((g, i) => {
          const hl = highlightTile !== null && improves(g, highlightTile);
          const name = g.label ?? blockSummary(g);
          let wait: string;
          if (g.waits.length) wait = `waits ${g.waits.map(tileName).join(', ')} (${g.waitTiles} tile${g.waitTiles === 1 ? '' : 's'})`;
          else if (g.complete) wait = 'complete';
          else wait = 'no single-tile wait';
          return (
            <li key={i} className={`group${hl ? ' group-hl' : ''}`}>
              <div className="group-tiles">
                {g.tiles.map((t, k) => (
                  <Tile key={k} tile={t} size="sm" />
                ))}
              </div>
              <div className="group-text">
                <span className="group-name">{name}</span>
                {g.label && g.description && g.description !== g.label && <span className="muted"> · {g.description}</span>}
                <div className="group-wait">{wait}</div>
              </div>
            </li>
          );
        })}
        {melds.map((m, i) => (
          <li key={`m${i}`} className="group group-called">
            <div className="group-tiles">
              {m.tiles.map((t, k) => (
                <Tile key={k} tile={t} size="sm" />
              ))}
            </div>
            <div className="group-text">
              <span className="group-name">called {m.kind}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="muted small">Waits assume the group is the last unfinished part of the hand.</p>
    </section>
  );
}
