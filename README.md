# Ukeire Calculator

A static, client-only riichi mahjong tile acceptance (ukeire) calculator. Enter a hand by
clicking tiles or typing mpsz notation and see, for every discard, which tiles improve the
hand, how many copies are left, which draws upgrade it, and how the hand breaks into shapes.

See [PLAN.md](PLAN.md) for the full spec.

## Run locally

Requires Node.js 20+ (built with Node 26).

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

```bash
npm test
```

## Build and deploy (static site)

```bash
npm run build
```

This writes a fully static site to `dist/`. `vite.config.ts` sets `base: './'`, so the files work
from any folder or sub-path; there is no server code and no routing to configure (state lives in
the URL hash).

```bash
npm run preview
```

serves `dist/` locally to check the production build.

**Netlify:** drag the `dist/` folder onto https://app.netlify.com/drop, or connect the repo with
build command `npm run build` and publish directory `dist`.

**GitHub Pages:** push the repo, then in *Settings → Pages* choose *GitHub Actions* and use the
standard "Static HTML"/Vite workflow with `npm ci && npm run build` and `path: dist`. Or push the
contents of `dist/` to a `gh-pages` branch.

**Anywhere else** (Cloudflare Pages, S3, any web server): upload the contents of `dist/`.

## Project layout

```
src/engine/   pure TypeScript, no React
  tiles.ts      tile ids, notation parser/formatter, validation
  shanten.ts    standard / seven pairs / thirteen orphans shanten (memoised per suit)
  ukeire.ts     acceptance per discard, upgrades, shape-building acceptance
  shapes.ts     shape waits, labels, decomposition, hand grouping
  remaining.ts  copies left = 4 - hand - melds - visible
  analyze.ts    one-call analysis used by the UI
src/ui/       React components (tiles are drawn with CSS, no images)
tests/engine/ Vitest tests, including every case from PLAN.md
```

## Notes on behaviour

- Seven pairs and thirteen orphans only affect results when they give the lowest shanten; the
  form used is labelled in the summary, the table and the shape panel. The "Count seven pairs &
  thirteen orphans" checkbox turns them off entirely (engine option `{ specialForms: false }`).
- Upgrades count only draws that increase the number of accepted tiles. Draws that keep the same
  count but widen the shape (e.g. kanchan → ryanmen whose other side is all visible) are listed
  in the expanded row as "shape improvements" and are not added to the upgrade total.
- Under each hand tile: acceptance if you discard it (red and struck through if that raises
  shanten; otherwise green → orange from most to fewest). Above each tile (toggleable): accepted
  tiles it produces by staying in the hand. This is a shape-based estimate: in the hand after the
  best discard, each accepted tile is credited to the unfinished tiles (pairs, partials, loose
  tiles) it connects with. If no unfinished tile is close enough, the draw works by re-splitting a
  complete meld (2346 + 1 = 123 + 46), so every tile of that meld gets it. When a
  draw connects with tiles in different groups, a loose tile loses it to any group holding a more
  central tile (pairs and partial shapes always keep theirs, and so does a loose tile right next to
  the winning group, e.g. the 8 in 778, which is a ryanmen with the 7); a loose tile that loses acceptance
  this way has its number shown in red.
- Discard & draw mode (checkbox under the hand): clicking a hand tile moves it to the visible
  tiles and draws a random replacement from the tiles still unaccounted for (4 − hand − melds −
  visible). The drawn tile is shown apart at the end of the hand until the hand changes.
- Yaku panel (shown when the hand is complete or in tenpai): set seat wind, round wind and ron/tsumo.
  A complete hand lists its yaku and han, using the just-drawn tile as the winning tile in draw mode
  and otherwise the best reading. A tenpai hand lists the yaku for each winning tile, with "No yaku"
  in red. Only yaku that follow from the tiles count: riichi, ippatsu, haitei/houtei, rinshan,
  chankan and dora are left out. Open tanyao is allowed, called kans count as open, and every
  yakuman counts as a single yakuman.
- For 14-tile hands, copies left are counted from the full 14-tile hand (the discarded tile is
  not available to draw).
