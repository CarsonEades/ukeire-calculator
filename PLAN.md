# Riichi Mahjong Tile Acceptance Calculator: Implementation Plan

Nov 10, 2026 · @Carson

## Goal and scope

Build a static, client-only website where you type or click in a riichi mahjong hand and see, for every possible discard, which tiles improve the hand, how many copies are left, and how the hand breaks into shapes. All the maths runs in the browser; there is no backend.

**In scope**

- Input a 13- or 14-tile closed hand, or a shorter hand with called melds (10/11, 7/8, 4/5, 1/2 tiles).
- Optionally mark tiles you can see elsewhere (discards, dora indicators, other players' calls) so remaining counts are accurate.
- Shanten for standard hands, seven pairs (chiitoitsu) and thirteen orphans (kokushi); the hand's shanten is the lowest of the three.
- Ukeire (tile acceptance) per discard: tile types and total remaining copies.
- Upgrades: draws that don't lower shanten but widen acceptance, shown separately from ukeire.
- Shape breakdown: each suit group labeled (ryanmen, kanchan, penchan, nobetan, nakabukure, sanmenchan and so on) with its wait.
- Shareable URL that encodes the hand.

**Out of scope (v1)**

- Yaku, han/fu and scoring; furiten; defense or safety.
- Discard recommendations beyond sorting by acceptance.
- Accounts, saving to a server, multiplayer.

## Tech stack and project structure

Use Vite + React + TypeScript, Vitest for tests, and deploy as static files (GitHub Pages, Netlify or similar). Keep the engine as pure TypeScript with no React imports, so it can be tested on its own and reused later.

```
src/
  engine/
    tiles.ts        // tile ids, names, notation parser/formatter
    shanten.ts      // standard, chiitoitsu, kokushi shanten
    ukeire.ts       // acceptance per discard, upgrades
    shapes.ts       // decomposition + shape labels
    remaining.ts    // copies left = 4 - hand - visible
  ui/
    TilePalette.tsx // 34 clickable tiles with remaining counts
    HandRow.tsx     // current hand, click to remove
    NotationInput.tsx
    ResultsTable.tsx
    ShapePanel.tsx
    Tile.tsx        // renders one tile
  App.tsx
tests/
  engine/*.test.ts
```

Tile art: draw tiles with CSS (colored text on a tile-shaped box) or use an openly licensed tile image set after checking its license. Unicode mahjong glyphs (U+1F000 block) render inconsistently across systems, so don't rely on them.

## Tile representation and input notation

Represent a hand as an array of 34 counts, one per tile type. Every engine function takes and returns this form.

| Index | Tiles | Notation |
| --- | --- | --- |
| 0–8 | 1–9 man (characters) | `1m`–`9m` |
| 9–17 | 1–9 pin (circles) | `1p`–`9p` |
| 18–26 | 1–9 sou (bamboo) | `1s`–`9s` |
| 27–30 | East, South, West, North | `1z`–`4z` |
| 31–33 | White, Green, Red dragons | `5z`–`7z` |

**Notation (mpsz):** digits followed by a suit letter, e.g. `123m456p789s1122z`. Accept `0` as a red five and treat it as a 5 for all calculations. Ignore spaces. Called melds go in brackets after the closed hand, e.g. `23456m789p11z [555p] [777z]`.

**Validation:**

- No tile type above 4 copies across hand + melds + visible tiles.
- Closed hand size must be 3n+1 (to evaluate) or 3n+2 (to choose a discard), with n matching the number of melds.
- Show the error next to the input; don't crash or silently drop tiles.

**Remaining copies** of a tile = 4 − copies in hand − copies in your melds − copies marked visible.

## Engine

The engine has four parts: shanten, ukeire, upgrades and shape labels. Each is a pure function on the 34-count array.

### 1. Shanten

Shanten is the number of tiles away from tenpai (0 = tenpai, −1 = complete hand).

- **Standard hand:** search every decomposition into melds (m), partial shapes (t: ryanmen, kanchan, penchan, pairs) and at most one head. Shanten = 8 − 2m − t − (1 if a head is chosen), with m + t capped at 4. Called melds count toward m. Decompose each suit separately and memoize by suit pattern (there are only a few thousand), then combine; honors only form triplets and pairs.
- **Chiitoitsu (closed hands only):** 6 − pairs + max(0, 7 − distinct tile types). Four of a kind counts as one pair.
- **Kokushi (closed hands only):** 13 − distinct terminal/honor types − (1 if any of them is paired).
- Hand shanten = minimum of the three. Show which form gives it.

### 2. Ukeire (acceptance)

For a hand of size 3n+1: for each of the 34 tile types with remaining copies > 0, add it and recompute shanten. If shanten drops, it is accepted; add its remaining copies to the total.

For a hand of size 3n+2: for each distinct tile in the hand, discard it, then run the above on the result. Sort discards by shanten after discarding (lowest first), then by total accepted copies (highest first).

### 3. Upgrades

Upgrades match the "upgrade" column from our shape analysis: draws that don't lower shanten but improve the hand's future acceptance.

For a 3n+1 hand H with ukeire U:

1. For each tile t with copies left that is not already accepted, form H + t.
2. For each discard d ≠ t that keeps shanten the same, compute the ukeire of H + t − d.
3. If the best of these is greater than U, t is an upgrade. Record t, its remaining copies, the best discard and the new ukeire.

Show totals for both: e.g. "accepts 16 tiles; 12 more tiles upgrade it".

### 4. Shape labels

For display only; this does not affect the numbers.

- Split each suit into connected groups (tiles no more than 2 apart).
- Match each group's pattern, relative to its lowest tile, against a lookup table of named shapes: penchan, kanchan, ryanmen, nobetan (abcd), nakabukure (abbc), sanmenchan (abcde), ryankan (a\_c\_e), and the pair/triplet shapes (aabc, abcc, aaab, aaac, aabb, aabd).
- Unmatched groups fall back to the decomposition chosen by the shanten search: meld, pair, partial, isolated.
- Next to each group show its wait if it were the last unfinished part of the hand, e.g. "3456: waits 3, 6 (6 tiles)".

## UI

The page has one column, top to bottom: input, a hand summary, the results table and the shape panel. Results update on every change, with no submit button.

**Input**

- **Tile palette:** 34 tiles in four rows (man, pin, sou, honors). Click to add to the hand. Each tile shows a small remaining-copies badge and is greyed out at 0.
- **Hand row:** the current hand, auto-sorted. Click a tile to remove it.
- **Notation box:** a text field kept in sync both ways with the hand row; typing `123m456p...` updates the tiles.
- **Mode switch:** "Hand" / "Visible tiles". In visible-tiles mode the palette adds to a separate visible list, shown below the hand in muted style.
- **Buttons:** Clear, Random hand, Copy link.

**Hand summary:** one line, e.g. "1-shanten (standard). Best discard: 9p, accepting 24 tiles (7 types)."

**Results table** (14-tile hands; for 13-tile hands, show one row with no discard column):

| Column | Content |
| --- | --- |
| Discard | the tile |
| Shanten after | number; rows that raise shanten are greyed |
| Accepted tiles | tile icons, each with a remaining-copies badge |
| Total | accepted copies and types, e.g. "24 (7)" |
| Upgrades | upgrade copies; expand to see each tile, its best discard and the new acceptance |

Highlight the best row. Clicking a row previews the hand after that discard in the shape panel.

**Shape panel:** the hand grouped by suit, each group labeled with its shape name and its wait (from Engine §4). Hovering an accepted tile in the table highlights the group it improves.

**State:** keep the hand and visible tiles in the URL hash, e.g. `#h=123m456p789s1122z&v=5z`, so any position can be shared.

## Test cases

The engine is done when all of these pass. Each expected value assumes no visible tiles other than the hand.

**Full hands**

| Hand | Expected |
| --- | --- |
| `123m456p789s11222z` (14) | shanten −1 (complete) |
| `123m456p789s1122z` | tenpai; waits 1z, 2z; 4 tiles |
| `19m19p19s1234567z` | kokushi tenpai; 13 types; 39 tiles |
| `1122m3344p5566s7z` | chiitoitsu tenpai; waits 7z; 3 tiles |
| `123m456p789s1z` `[222z] (one called meld)` | meld handling: tanki wait on 1z, 3 tiles |

**Shape waits** (shape as the last unfinished part of the hand; 4-tile shapes finish as meld + pair, 5-tile shapes as two melds):

| Shape | Waits | Tiles |
| --- | --- | --- |
| 3456 (nobetan) | 3, 6 | 6 |
| 3445 (nakabukure) | 4 | 2 |
| 3457 | 7 | 3 |
| 2344 | 1, 4 | 6 |
| 4456 | 4, 7 | 6 |
| 3334 | 2, 4, 5 | 11 |
| 3335 | 4, 5 | 7 |
| 3355 | 3, 5 | 4 |
| 2235 | 4 | 4 |
| 34567 (sanmenchan) | 2, 5, 8 | 11 |
| 23456 | 1, 4, 7 | 11 |
| 12345 | 3, 6 | 7 |
| 34578 | 6, 9 | 8 |
| 33345 | 3, 6 | 5 |
| 34445 | 4 | 1 |

**Shape building acceptance** (draws giving a meld + partial): 3456 → 28, 3457 → 22, 3445 → 16, 2344 and 4456 → 20, 3334 and 3335 → 16, 3355 → 8, 2235 → 6.

**Upgrades:** 34568 waits on 7 (4 tiles) and drawing 2 upgrades it to 23456 (11 tiles); 34579 waits on 8 and drawing 6 upgrades it to 34567 (11).

Also spot-check five or six random hands against an existing efficiency calculator before release.

## Milestones, acceptance criteria and open questions

Build in five steps, with each step's tests passing before the next starts.

1. **Engine core:** tiles, notation parser, remaining counts, standard shanten. Full-hand tests pass.
2. **Acceptance:** ukeire per discard, chiitoitsu and kokushi, called melds. All test-case tables pass.
3. **Upgrades and shape labels:** the upgrade examples and shape-wait table pass.
4. **UI:** palette, hand row, notation sync, results table, shape panel, URL state.
5. **Polish:** visible-tiles mode, random hand, mobile layout, deploy.

**Acceptance criteria**

- [ ] Every test case in this plan passes in Vitest.
- [ ] Results update in under 100 ms for any 14-tile hand on a mid-range laptop.
- [ ] Invalid input (5 copies, wrong hand size) shows a clear message and never crashes.
- [ ] A copied link reopens the same hand and visible tiles.
- [ ] Usable on a phone-width screen (375 px).

**Open questions**

- Should seven-pairs and thirteen-orphans acceptance be shown in separate rows, or only when they give the lowest shanten?
- Should upgrades also count draws that keep the same acceptance but turn kanchan/penchan waits into ryanmen (better quality, same count)?
- Tile art: CSS-drawn tiles or an openly licensed image set?
