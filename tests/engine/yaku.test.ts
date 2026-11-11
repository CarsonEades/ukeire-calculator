import { describe, expect, it } from 'vitest';
import { parseHand, tileIndex } from '../../src/engine/tiles';
import { type YakuContext, evaluateYaku, waitYaku } from '../../src/engine/yaku';

const t = (name: string) => tileIndex(name);

function yaku(notation: string, ctx: YakuContext = {}) {
  const r = parseHand(notation);
  return evaluateYaku(r.hand, r.melds, ctx);
}
const names = (notation: string, ctx: YakuContext = {}) => yaku(notation, ctx)?.yaku.map((y) => y.name) ?? null;

describe('evaluateYaku', () => {
  it('returns null for a hand that is not complete', () => {
    expect(yaku('123m456p789s11z25m')).toBeNull();
  });

  it('pinfu needs a two-sided wait', () => {
    // 234m 456p 567s 234s 88s
    expect(names('234m456p567s234s88s', { winTile: t('4s') })).toEqual(['Tanyao', 'Pinfu']);
    // 3s completes 234s only as a closed (kanchan) wait.
    expect(names('234m456p567s234s88s', { winTile: t('3s') })).toEqual(['Tanyao']);
  });

  it('without a winning tile it takes the best reading', () => {
    const r = yaku('234m456p567s234s88s')!;
    expect(r.han).toBe(2);
  });

  it('dragon and wind triplets', () => {
    expect(names('123m456p789s11z [777z]')).toEqual(['Chun']);
    // East triplet with East seat and East round counts twice.
    const east = yaku('123m456p789s22z111z', { winTile: t('2z') })!;
    expect(east.yaku).toEqual([
      { name: 'Seat wind', han: 1 },
      { name: 'Round wind', han: 1 },
    ]);
    // South seat, East round: only the round wind.
    expect(names('123m456p789s22z111z', { winTile: t('2z'), seatWind: 1 })).toEqual(['Round wind']);
  });

  it('an open hand with no yaku has none', () => {
    const r = yaku('123m456p789s11z [234m]')!;
    expect(r.yaku).toEqual([]);
    expect(r.han).toBe(0);
  });

  it('menzen tsumo only when closed and self-drawn', () => {
    expect(names('123789m456p789s11z', { winTile: t('4p'), tsumo: true })).toEqual(['Menzen tsumo']);
    expect(names('123m456p789s11z [234m]', { tsumo: true })).toEqual([]);
  });

  it('seven pairs', () => {
    expect(names('1133m2255p6699s77z')).toEqual(['Chiitoitsu']);
    expect(yaku('1133m2255p6699s77z', { specialForms: false })).toBeNull();
  });

  it('iipeikou and ryanpeikou', () => {
    expect(names('112233m456p789s55p', { winTile: t('5p') })).toEqual(['Iipeikou']);
    // Read as two identical-run pairs (3 han), not seven pairs (2 han).
    expect(names('112233m445566p77s', { winTile: t('7s') })).toEqual(['Ryanpeikou']);
  });

  it('half and full flush, with ittsu', () => {
    expect(yaku('123456789m55z [777z]')).toMatchObject({
      han: 4,
      yaku: [
        { name: 'Chun', han: 1 },
        { name: 'Ittsu', han: 1 },
        { name: 'Honitsu', han: 2 },
      ],
    });
    expect(yaku('123345567789m99m', { winTile: t('2m') })).toMatchObject({ han: 6, yaku: [{ name: 'Chinitsu', han: 6 }] });
  });

  it('toitoi and sanankou depend on how the last triplet was completed', () => {
    // Ron on 4s completes a shanpon: three concealed triplets, not four.
    expect(names('111m222p333s444s55z', { winTile: t('4s') })).toEqual(['Toitoi', 'Sanankou']);
    expect(yaku('111m222p333s444s55z', { winTile: t('4s'), tsumo: true })).toMatchObject({ yakuman: 1, yaku: [{ name: 'Suuankou' }] });
    expect(yaku('111m222p333s444s55z', { winTile: t('5z') })).toMatchObject({ yakuman: 1, yaku: [{ name: 'Suuankou' }] });
  });

  it('sanshoku, chanta and junchan', () => {
    expect(names('123m123p123s789m99s', { winTile: t('9s') })).toEqual(['Junchan', 'Sanshoku']);
    expect(names('123m123p123s789m11z', { winTile: t('1z') })).toEqual(['Chanta', 'Sanshoku']);
  });

  it('yakuman', () => {
    expect(yaku('19m19p19s1234567z1m')).toMatchObject({ yakuman: 1, yaku: [{ name: 'Kokushi musou' }] });
    expect(yaku('555666777z123m44p')).toMatchObject({ yakuman: 1, yaku: [{ name: 'Daisangen' }] });
    expect(yaku('111222333z55z [444z]')).toMatchObject({ yaku: [{ name: 'Daisuushii' }, { name: 'Tsuuiisou' }] });
  });

  it('shousangen with its dragon triplets', () => {
    expect(names('555666z77z123m456p', { winTile: t('7z') })).toEqual(['Haku', 'Hatsu', 'Shousangen']);
  });
});

describe('waitYaku', () => {
  it('lists the yaku for each winning tile', () => {
    const r = parseHand('234m456p567s23s88s');
    const w = waitYaku(r.hand, r.melds);
    expect(w.map((x) => x.tile)).toEqual([t('1s'), t('4s')]);
    expect(w[0].result.yaku.map((y) => y.name)).toEqual(['Pinfu']);
    expect(w[1].result.yaku.map((y) => y.name)).toEqual(['Tanyao', 'Pinfu']);
  });
});
