import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyze, shantenText } from './engine/analyze';
import { FORM_LABEL, type HandForm } from './engine/shanten';
import {
  type Counts,
  type ParseResult,
  emptyCounts,
  expectedSizes,
  formatHand,
  meldCounts,
  parseHand,
  tileName,
  totalTiles,
} from './engine/tiles';
import { type DiscardInfo, HandRow } from './ui/HandRow';
import { Tile } from './ui/Tile';
import { NotationInput } from './ui/NotationInput';
import { ResultsTable } from './ui/ResultsTable';
import { ShapePanel } from './ui/ShapePanel';
import { type YakuSettings, YakuPanel } from './ui/YakuPanel';
import { evaluateYaku, waitYaku } from './engine/yaku';
import { TilePalette } from './ui/TilePalette';
import { readHash, writeHash } from './ui/urlState';
import { remainingCounts } from './engine/remaining';

type Mode = 'hand' | 'visible';
const CONTRIB_KEY = 'ukeire.showContributions';
const DRAW_KEY = 'ukeire.drawMode';
const SPECIAL_KEY = 'ukeire.specialForms';
const YAKU_KEY = 'ukeire.yakuSettings';

function loadYakuSettings(): YakuSettings {
  try {
    const v = JSON.parse(localStorage.getItem(YAKU_KEY) ?? 'null');
    if (v && typeof v === 'object') {
      const w = (x: unknown) => (typeof x === 'number' && x >= 0 && x <= 3 ? x : 0);
      return { seatWind: w(v.seatWind), roundWind: w(v.roundWind), tsumo: v.tsumo === true };
    }
  } catch {
    /* defaults */
  }
  return { seatWind: 0, roundWind: 0, tsumo: false };
}

/** On/off preferences remembered in this browser (silently skipped if storage is unavailable). */
function loadPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
function savePref(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* not remembered */
  }
}

const formsText = (forms: HandForm[]) => forms.map((f) => FORM_LABEL[f]).join(' / ');
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Keep showing the last hand that parsed while the user is mid-edit. */
function useLastGood(parse: ParseResult): ParseResult {
  const ref = useRef(parse);
  if (!parse.error) ref.current = parse;
  return ref.current;
}

export default function App() {
  const initial = useMemo(() => readHash(window.location.hash), []);
  const [handText, setHandText] = useState(initial.hand);
  const [visibleText, setVisibleText] = useState(initial.visible);
  const [mode, setMode] = useState<Mode>('hand');
  const [selected, setSelected] = useState<number | null>(null);
  const [hoverTile, setHoverTile] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [showContrib, setShowContrib] = useState(() => loadPref(CONTRIB_KEY, true));
  const toggleContrib = (on: boolean) => {
    setShowContrib(on);
    savePref(CONTRIB_KEY, on);
  };
  const [drawMode, setDrawMode] = useState(() => loadPref(DRAW_KEY, false));
  const [specialForms, setSpecialForms] = useState(() => loadPref(SPECIAL_KEY, true));
  const toggleSpecialForms = (on: boolean) => {
    setSpecialForms(on);
    savePref(SPECIAL_KEY, on);
  };
  const [yakuSettings, setYakuSettings] = useState(loadYakuSettings);
  const changeYakuSettings = (v: YakuSettings) => {
    setYakuSettings(v);
    try {
      localStorage.setItem(YAKU_KEY, JSON.stringify(v));
    } catch {
      /* not remembered */
    }
  };
  const toggleDrawMode = (on: boolean) => {
    setDrawMode(on);
    savePref(DRAW_KEY, on);
  };
  /** The tile drawn last in draw mode, shown apart while the hand is unchanged since. */
  const [lastDraw, setLastDraw] = useState<{ tile: number; handText: string } | null>(null);
  const drawnTile = lastDraw && lastDraw.handText === handText ? lastDraw.tile : null;

  const handParse = useMemo(() => parseHand(handText), [handText]);
  const visParse = useMemo(() => parseHand(visibleText), [visibleText]);
  const hp = useLastGood(handParse);
  const vp = useLastGood(visParse);
  const visible = useMemo<Counts>(() => {
    const mc = meldCounts(vp.melds);
    return vp.hand.map((n, i) => n + mc[i]);
  }, [vp]);

  const analysis = useMemo(() => analyze(hp.hand, hp.melds, visible, { specialForms }), [hp, visible, specialForms]);
  const remaining = analysis.remaining;
  const ready = analysis.status === 'ready' && analysis.rows.length > 0;
  const handComplete = ready && analysis.handShanten === -1;
  // Tenpai: a 13-tile hand waiting now, or a 14-tile hand with a discard that leaves it waiting.
  const tenpaiRow = ready && !handComplete && analysis.rows[0].shanten === 0 ? analysis.rows[0] : null;
  const tenpaiDiscards = tenpaiRow ? analysis.rows.filter((r) => r.shanten === 0).length : 0;

  // Yaku: of the complete hand, or of each winning tile when in tenpai.
  const yakuCtx = useMemo(() => ({ ...yakuSettings, specialForms }), [yakuSettings, specialForms]);
  const completeYaku = useMemo(
    () => (handComplete ? evaluateYaku(hp.hand, hp.melds, { ...yakuCtx, winTile: drawnTile ?? undefined }) : undefined),
    [handComplete, hp, yakuCtx, drawnTile],
  );
  const tenpaiYaku = useMemo(() => (tenpaiRow ? waitYaku(tenpaiRow.hand, hp.melds, yakuCtx) : undefined), [tenpaiRow, hp, yakuCtx]);

  // Acceptance per discard, shown under each hand tile.
  const discards = useMemo(() => {
    const rs = analysis.status === 'ready' ? analysis.rows : [];
    if (!rs.length || rs[0].discard === null || analysis.handShanten === -1) return undefined;
    const bestShanten = Math.min(...rs.map((r) => r.shanten));
    const keep = rs.filter((r) => r.shanten === bestShanten).map((r) => r.total);
    const bestTotal = Math.max(...keep);
    const lowTotal = Math.min(...keep);
    const m = new Map<number, DiscardInfo>();
    for (const r of rs) {
      const worse = r.shanten > bestShanten;
      const quality = bestTotal === lowTotal ? 1 : (r.total - lowTotal) / (bestTotal - lowTotal);
      m.set(r.discard!, { total: r.total, worse, best: !worse && r.total === bestTotal, quality });
    }
    return m;
  }, [analysis]);

  // URL hash <-> state.
  useEffect(() => {
    const hash = writeHash({ hand: handText, visible: visibleText });
    const url = window.location.pathname + window.location.search + hash;
    window.history.replaceState(null, '', url);
  }, [handText, visibleText]);
  useEffect(() => {
    const onHash = () => {
      const s = readHash(window.location.hash);
      setHandText(s.hand);
      setVisibleText(s.visible);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [, discardSize] = expectedSizes(Math.min(hp.melds.length, 4));
  const handSize = totalTiles(hp.hand);
  const handFull = handSize >= discardSize;
  const visibleCount = totalTiles(visible);

  const addTile = useCallback(
    (t: number) => {
      if (remaining[t] <= 0) return;
      if (mode === 'hand') {
        if (handFull) return;
        const h = [...hp.hand];
        h[t]++;
        setHandText(formatHand(h, hp.melds, hp.red));
      } else {
        const v = [...vp.hand];
        v[t]++;
        setVisibleText(formatHand(v, vp.melds, vp.red));
      }
    },
    [mode, remaining, handFull, hp, vp],
  );

  const removeCounts = (p: ParseResult, t: number, isRed: boolean) => {
    const h = [...p.hand];
    const red = [...p.red];
    h[t]--;
    const s = Math.floor(t / 9);
    if (t < 27 && t % 9 === 4) {
      if (isRed) red[s]--;
      // Red fives in the hand can't exceed fives in the hand plus those in melds.
      const meldFives = meldCounts(p.melds)[t];
      red[s] = Math.max(0, Math.min(red[s], h[t] + meldFives));
    }
    return { h, red };
  };
  const removeFrom = (p: ParseResult, t: number, isRed: boolean): string => {
    const { h, red } = removeCounts(p, t, isRed);
    return formatHand(h, p.melds, red);
  };

  /** Draw mode: the clicked tile goes to the visible tiles and a random tile from the wall replaces it. */
  const discardAndDraw = (t: number, isRed: boolean) => {
    const { h, red } = removeCounts(hp, t, isRed);
    const v = [...vp.hand];
    const vRed = [...vp.red];
    v[t]++;
    if (isRed) vRed[Math.floor(t / 9)]++;
    const newVisible = visible.map((n, i) => n + (i === t ? 1 : 0));
    const wall = remainingCounts(h, hp.melds, newVisible);
    const left = wall.reduce((a, b) => a + Math.max(0, b), 0);
    let drawn: number | null = null;
    if (left > 0) {
      let k = Math.floor(Math.random() * left);
      for (let x = 0; x < wall.length; x++) {
        k -= Math.max(0, wall[x]);
        if (k < 0) {
          drawn = x;
          break;
        }
      }
    }
    if (drawn !== null) h[drawn]++;
    const nextHand = formatHand(h, hp.melds, red);
    setVisibleText(formatHand(v, vp.melds, vRed));
    setHandText(nextHand);
    setLastDraw(drawn === null ? null : { tile: drawn, handText: nextHand });
    setSelected(null);
  };

  const removeMeld = (i: number) => {
    const melds = hp.melds.filter((_, k) => k !== i);
    setHandText(formatHand(hp.hand, melds, hp.red));
  };

  const randomHand = () => {
    const wall: number[] = [];
    // A new hand starts a new round: visible tiles are cleared, so draw from the full set.
    for (let t = 0; t < 34; t++) for (let k = 0; k < 4; k++) wall.push(t);
    const h = emptyCounts();
    for (let k = 0; k < 14 && wall.length; k++) {
      const i = Math.floor(Math.random() * wall.length);
      h[wall.splice(i, 1)[0]]++;
    }
    setHandText(formatHand(h));
    setVisibleText('');
    setSelected(null);
  };

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };

  // Which hand the shape panel shows.
  const rows = analysis.rows;
  const hasDiscard = rows.length > 0 && rows[0].discard !== null;
  const shownRow = hasDiscard ? (rows.find((r) => r.discard === selected) ?? rows[0]) : rows[0];

  let summary: string | null = null;
  if (analysis.status === 'ready' && rows.length) {
    const best = rows[0];
    if (hasDiscard) {
      if (analysis.handShanten === -1) {
        summary = `Complete hand (${formsText(analysis.handForms ?? [])}).`;
      } else {
        summary =
          `${shantenText(best.shanten)} (${formsText(best.forms)}). Best discard: ${tileName(best.discard!)}, ` +
          `accepting ${plural(best.total, 'tile')} (${plural(best.tiles.length, 'type')})` +
          (best.upgrades.total ? `; ${plural(best.upgrades.total, 'more tile')} upgrade${best.upgrades.total === 1 ? 's' : ''} it.` : '.');
      }
    } else {
      summary =
        `${shantenText(best.shanten)} (${formsText(best.forms)}). Accepts ${plural(best.total, 'tile')} (${plural(best.tiles.length, 'type')})` +
        (best.upgrades.total ? `; ${plural(best.upgrades.total, 'more tile')} upgrade${best.upgrades.total === 1 ? 's' : ''} it.` : '.');
    }
  }

  return (
    <main className="app">
      <header className="top">
        <h1>Ukeire Calculator</h1>
        <p className="muted">Riichi mahjong tile acceptance, upgrades and shapes, for every discard.</p>
      </header>

      <section className="input" aria-label="Hand input">
        <HandRow
          hand={hp.hand}
          discards={discards}
          contributions={showContrib && analysis.status === 'ready' && !handComplete ? analysis.contributions : undefined}
          melds={hp.melds}
          red={hp.red}
          visible={visible}
          visibleRed={vp.red}
          onRemove={(t, r) => (drawMode ? discardAndDraw(t, r) : setHandText(removeFrom(hp, t, r)))}
          removeHint={drawMode ? 'Click to discard and draw' : 'Click to remove'}
          drawnTile={drawnTile}
          onRemoveMeld={removeMeld}
          onRemoveVisible={(t, r) => setVisibleText(removeFrom(vp, t, r))}
        />

        {handComplete && (
          <div className="hand-status status-complete" role="status">
            <strong>Complete hand!</strong>
            {(analysis.handForms ?? []).some((f) => f !== 'standard') && (
              <span>{formsText((analysis.handForms ?? []).filter((f) => f !== 'standard'))}</span>
            )}
          </div>
        )}
        {tenpaiRow && (
          <div className="hand-status status-tenpai" role="status">
            <strong>Tenpai!</strong>
            {tenpaiRow.discard !== null && (
              <>
                <span>Discard</span>
                <Tile tile={tenpaiRow.discard} size="sm" />
                <span>to wait on</span>
              </>
            )}
            {tenpaiRow.discard === null && <span>Waiting on</span>}
            {tenpaiRow.tiles.map((a) => (
              <Tile key={a.tile} tile={a.tile} size="sm" badge={a.count} />
            ))}
            <span>
              ({plural(tenpaiRow.total, 'tile')} left
              {tenpaiRow.total === 0 ? ', all visible' : ''})
            </span>
            {tenpaiDiscards > 1 && <span className="muted">· {tenpaiDiscards} discards reach tenpai; this one waits widest</span>}
          </div>
        )}

        {(handComplete || tenpaiRow) && (
          <YakuPanel
            settings={yakuSettings}
            onChange={changeYakuSettings}
            closed={hp.melds.length === 0}
            complete={handComplete ? completeYaku : undefined}
            winKnown={drawnTile !== null}
            waits={tenpaiYaku}
          />
        )}

        <div className="toggles">
          <label className="contrib-toggle" title="Above each tile: accepted tiles (and types) that this tile helps produce by staying in the hand">
            <input type="checkbox" checked={showContrib} onChange={(e) => toggleContrib(e.target.checked)} />
            Show what each tile produces (above the tile)
          </label>
          <label className="contrib-toggle" title="Clicking a hand tile discards it to the visible tiles and draws a random tile from what's left">
            <input type="checkbox" checked={drawMode} onChange={(e) => toggleDrawMode(e.target.checked)} />
            Discard &amp; draw mode
          </label>
          <label className="contrib-toggle" title="When off, shanten, acceptance and upgrades count only standard hands (four melds and a pair)">
            <input type="checkbox" checked={specialForms} onChange={(e) => toggleSpecialForms(e.target.checked)} />
            Count seven pairs &amp; thirteen orphans
          </label>
        </div>

        <div className="controls">
          <div className="mode" role="radiogroup" aria-label="Palette adds to">
            <button type="button" role="radio" aria-checked={mode === 'hand'} className={mode === 'hand' ? 'on' : ''} onClick={() => setMode('hand')}>
              Hand <span className="count">{handSize}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={mode === 'visible'}
              className={mode === 'visible' ? 'on' : ''}
              onClick={() => setMode('visible')}
            >
              Visible tiles <span className="count">{visibleCount}</span>
            </button>
          </div>
          <div className="buttons">
            <button
              type="button"
              onClick={() => {
                // Clearing the hand starts over, so the visible tiles go too.
                if (mode === 'hand') setHandText('');
                setVisibleText('');
                setSelected(null);
              }}
            >
              Clear {mode === 'hand' ? 'hand' : 'visible'}
            </button>
            <button type="button" onClick={randomHand}>
              Random hand
            </button>
            <button type="button" onClick={copyLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>

        <TilePalette remaining={remaining} full={mode === 'hand' && handFull} onAdd={addTile} />

        <div className="notations">
          <NotationInput
            id="hand-notation"
            label="Hand"
            value={handText}
            placeholder="e.g. 123m456p789s1122z or 123m456p789s1z [222z]"
            error={handParse.error}
            onChange={(t) => {
              setHandText(t);
              setSelected(null);
            }}
          />
          <NotationInput
            id="visible-notation"
            label="Visible tiles (discards, dora indicators, others' calls)"
            value={visibleText}
            placeholder="e.g. 5z19m"
            error={visParse.error}
            onChange={setVisibleText}
          />
        </div>
      </section>

      <section className="summary" aria-live="polite">
        {analysis.messages.map((m, i) => (
          <p key={i} className={analysis.status === 'invalid' ? 'error' : 'muted'}>
            {m}
          </p>
        ))}
        {analysis.status === 'empty' && <p className="muted">Enter 13 or 14 tiles to see acceptance.</p>}
        {summary && <p className="summary-line">{summary}</p>}
      </section>

      {analysis.status === 'ready' && (
        <>
          <ResultsTable rows={rows} selected={shownRow?.discard ?? null} onSelect={setSelected} onHoverTile={setHoverTile} />
          {shownRow && (
            <ShapePanel
              hand={shownRow.hand}
              melds={hp.melds}
              remaining={remaining}
              forms={shownRow.forms}
              highlightTile={hoverTile}
              title={shownRow.discard !== null ? `Shapes after discarding ${tileName(shownRow.discard)}` : 'Shapes'}
            />
          )}
        </>
      )}

      <footer className="foot muted small">
        <p>
          Notation: digits then suit — <code>m</code> man, <code>p</code> pin, <code>s</code> sou, <code>z</code> honors (1–4 winds, 5 white, 6
          green, 7 red). <code>0</code> is a red five. Called melds go in brackets: <code>[555p]</code>.
        </p>
        <p>Copies left = 4 − your hand − your melds − visible tiles. Upgrades count only draws that increase acceptance.</p>
      </footer>
    </main>
  );
}
