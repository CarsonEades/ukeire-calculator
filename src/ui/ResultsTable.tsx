import { Fragment, useState } from 'react';
import type { ResultRow } from '../engine/analyze';
import { FORM_LABEL } from '../engine/shanten';
import { Tile } from './Tile';

interface Props {
  rows: ResultRow[];
  selected: number | null;
  onSelect: (discard: number | null) => void;
  onHoverTile: (tile: number | null) => void;
}

const rowKey = (r: ResultRow) => (r.discard === null ? 'hand' : String(r.discard));

function shantenCell(s: number): string {
  return s < 0 ? 'done' : s === 0 ? 'tenpai' : String(s);
}

/** One row per discard (or a single row for a 13-tile hand). */
export function ResultsTable({ rows, selected, onSelect, onHoverTile }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  if (!rows.length) return null;
  const hasDiscard = rows[0].discard !== null;
  const best = rows[0];
  const toggle = (k: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const cols = hasDiscard ? 5 : 4;
  return (
    <div className="results-wrap">
      <table className="results">
        <thead>
          <tr>
            {hasDiscard && <th scope="col">Discard</th>}
            <th scope="col" className="num">
              Shanten
            </th>
            <th scope="col">Accepted tiles</th>
            <th scope="col" className="num">
              Total
            </th>
            <th scope="col" className="num">
              Upgrades
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const k = rowKey(row);
            const isBest = row === best || (row.shanten === best.shanten && row.total === best.total);
            const worse = row.shanten > best.shanten;
            const isSel = hasDiscard && row.discard === selected;
            const open = expanded.has(k);
            const cls = [isBest ? 'best' : '', worse ? 'worse' : '', isSel ? 'selected' : ''].filter(Boolean).join(' ');
            const special = row.forms.filter((f) => f !== 'standard');
            return (
              <Fragment key={k}>
                <tr
                  className={cls}
                  onClick={() => hasDiscard && onSelect(row.discard)}
                  aria-selected={hasDiscard ? isSel : undefined}
                >
                  {hasDiscard && (
                    <td className="discard-cell">
                      <Tile tile={row.discard!} size="md" />
                    </td>
                  )}
                  <td className="num">
                    {shantenCell(row.shanten)}
                    {special.length > 0 && (
                      <span className="form-tag" title={`Lowest shanten via ${row.forms.map((f) => FORM_LABEL[f]).join(' and ')}`}>
                        {special.map((f) => (f === 'chiitoitsu' ? '7 pairs' : '13 orph.')).join(', ')}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="accepted">
                      {row.tiles.map((a) => (
                        <Tile
                          key={a.tile}
                          tile={a.tile}
                          size="sm"
                          badge={a.count}
                          onMouseEnter={() => onHoverTile(a.tile)}
                          onMouseLeave={() => onHoverTile(null)}
                        />
                      ))}
                      {row.tiles.length === 0 && <span className="muted">{row.shanten < 0 ? 'complete' : 'none'}</span>}
                    </div>
                  </td>
                  <td className="num total">
                    {row.total} <span className="muted">({row.tiles.length})</span>
                  </td>
                  <td className="num">
                    <button
                      type="button"
                      className="expand"
                      aria-expanded={open}
                      disabled={row.upgrades.tiles.length === 0 && row.upgrades.quality.length === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(k);
                      }}
                    >
                      {row.upgrades.total}
                      <span className="chev" aria-hidden="true">
                        {open ? '▾' : '▸'}
                      </span>
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr className="detail">
                    <td colSpan={cols}>
                      <UpgradeDetail row={row} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UpgradeDetail({ row }: { row: ResultRow }) {
  const up = row.upgrades;
  return (
    <div className="upgrade-detail">
      {up.tiles.length > 0 ? (
        <>
          <p className="detail-head">
            Draws that keep shanten and widen acceptance ({up.total} tiles):
          </p>
          <ul className="upgrade-list">
            {up.tiles.map((u) => (
              <li key={u.tile}>
                <span className="lbl">Draw</span>
                <Tile tile={u.tile} size="sm" badge={u.count} />
                <span className="lbl">cut</span>
                <Tile tile={u.discard} size="sm" />
                <span className="arrow">→</span>
                <strong>{u.newTotal}</strong>
                <span className="muted">(was {row.total})</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="detail-head">No upgrades.</p>
      )}
      {up.quality.length > 0 && (
        <>
          <p className="detail-head">
            Shape improvements, same count (not added to the upgrade total):
          </p>
          <ul className="upgrade-list">
            {up.quality.map((q) => (
              <li key={q.tile}>
                <span className="lbl">Draw</span>
                <Tile tile={q.tile} size="sm" badge={q.count} />
                <span className="lbl">cut</span>
                <Tile tile={q.discard} size="sm" />
                <span className="arrow">→</span>
                <span>
                  {q.newTotal} tiles across {q.newTypes} tile types (was {q.oldTypes})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
