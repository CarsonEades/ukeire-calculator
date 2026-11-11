import { YAKU_MEANING, type YakuResult } from '../engine/yaku';
import { Tile } from './Tile';

const WINDS = ['E', 'S', 'W', 'N'];

export interface YakuSettings {
  seatWind: number;
  roundWind: number;
  tsumo: boolean;
}

interface Props {
  settings: YakuSettings;
  onChange: (s: YakuSettings) => void;
  closed: boolean;
  /** Complete hand: its yaku. */
  complete?: YakuResult | null;
  /** Whether the complete hand's winning tile is known (the tile just drawn). */
  winKnown?: boolean;
  /** Tenpai: yaku per winning tile. */
  waits?: { tile: number; result: YakuResult }[];
}

function YakuList({ r }: { r: YakuResult }) {
  if (!r.yaku.length) return <span className="yaku-none">No yaku</span>;
  return (
    <>
      {r.yaku.map((y) => (
        <span key={y.name} className={`yaku-chip${r.yakuman ? ' yaku-yakuman' : ''}`} title={YAKU_MEANING[y.name]}>
          {y.name}
          {!r.yakuman && <span className="yaku-han">{y.han}</span>}
        </span>
      ))}
      <span className="yaku-total">{r.yakuman ? (r.yakuman > 1 ? `${r.yakuman}× yakuman` : 'Yakuman') : `${r.han} han`}</span>
    </>
  );
}

function WindPicker({ label, value, onPick }: { label: string; value: number; onPick: (w: number) => void }) {
  return (
    <span className="yaku-setting" role="radiogroup" aria-label={label}>
      {label}
      {WINDS.map((w, i) => (
        <button key={w} type="button" role="radio" aria-checked={value === i} className={value === i ? 'on' : ''} onClick={() => onPick(i)}>
          {w}
        </button>
      ))}
    </span>
  );
}

/** Yaku of the complete hand, or of each winning tile when in tenpai. */
export function YakuPanel({ settings, onChange, closed, complete, winKnown, waits }: Props) {
  const situational = closed ? `Riichi would add 1 han${settings.tsumo ? '' : '; a self-drawn win adds Menzen tsumo'}.` : null;
  return (
    <div className="yaku-panel" aria-label="Yaku">
      <div className="yaku-head">
        <strong>Yaku</strong>
        <WindPicker label="Seat" value={settings.seatWind} onPick={(w) => onChange({ ...settings, seatWind: w })} />
        <WindPicker label="Round" value={settings.roundWind} onPick={(w) => onChange({ ...settings, roundWind: w })} />
        <span className="yaku-setting" role="radiogroup" aria-label="Win by">
          Win by
          <button type="button" role="radio" aria-checked={!settings.tsumo} className={!settings.tsumo ? 'on' : ''} onClick={() => onChange({ ...settings, tsumo: false })}>
            Ron
          </button>
          <button type="button" role="radio" aria-checked={settings.tsumo} className={settings.tsumo ? 'on' : ''} onClick={() => onChange({ ...settings, tsumo: true })}>
            Tsumo
          </button>
        </span>
      </div>
      {complete && (
        <div className="yaku-line">
          <span className="yaku-win">
            {winKnown ? 'Won on' : 'Best reading, won on'} <Tile tile={complete.winTile} size="sm" />
          </span>
          <YakuList r={complete} />
        </div>
      )}
      {complete === null && <p className="muted small">Not a winning hand under the current settings.</p>}
      {waits?.map((w) => (
        <div className="yaku-line" key={w.tile}>
          <span className="yaku-win">
            <Tile tile={w.tile} size="sm" />
          </span>
          <YakuList r={w.result} />
        </div>
      ))}
      {situational && <p className="muted small">{situational}</p>}
    </div>
  );
}
