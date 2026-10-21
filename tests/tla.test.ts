import { describe, expect, it } from 'vitest';
import catalog from '../src/data/sets/tla-catalog.json';
import { CARDS, REPRINTS } from '../src/data';
import { poolSize } from '../src/meta/booster';
import { abilitiesFor, canPayCost, castAlts, castableCards, payCost, performAction } from '../src/engine/actions';
import { declareAttackers, endCombat } from '../src/engine/combat';
import { runEffects } from '../src/engine/effects';
import { checkSBA } from '../src/engine/flow';
import { parseCost } from '../src/engine/mana';
import { getDef } from '../src/engine/registry';
import { cloneGame, stats } from '../src/engine/state';
import type { Effect, GameState } from '../src/engine/types';
import { createToken, emit, moveCard, tapCard } from '../src/engine/zones';
import { answerDefault, inGy, inHand, lands, mk, put, resolve, settleAll } from './helpers';

function effects(g: GameState, source: number, efs: Effect[], targets: ({ c: number } | { p: 0 | 1 })[] = []) {
  const gen = runEffects(g, { source, controller: 0, targets }, efs);
  let r = gen.next();
  while (!r.done) r = gen.next(answerDefault(g, r.value));
}
describe('TLA full catalog and bending', () => {
  it('registers all 281 main-set cards, including reprints, with no duplicate IDs', () => {
    expect(catalog).toHaveLength(281);
    for (const row of catalog)
      expect(
        CARDS.some((c) => c.name === row.name),
        row.name,
      ).toBe(true);
    const pool = new Set([...CARDS.filter((c) => c.set === 'TLA').map((c) => c.id), ...(REPRINTS.TLA ?? []).map(([id]) => id)]);
    expect(pool.size).toBe(281);
    expect(poolSize('TLA')).toBe(281);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
  it('airbending preserves ownership, allows recasting for {2}, then removes that permission', () => {
    const g = mk(),
      s = put(g, 0, 'aang-the-last-airbender'),
      c = put(g, 1, 'saber-tooth-moose-lion');
    effects(g, s.id, [{ e: 'airbend', what: 'T0' }], [{ c: c.id }]);
    expect(c.zone).toBe('exile');
    expect(castableCards(g, 1)).toContain(c);
    lands(g, 1, 'island', 2);
    g.active = 1;
    expect(performAction(g, 1, { type: 'cast', card: c.id, targets: [] })).toBeNull();
    resolve(g);
    expect(c.zone).toBe('battlefield');
    expect(c.airbent).toBeUndefined();
    moveCard(g, c, 'exile');
    expect(castAlts(g, 1, c)).toEqual([]);
  });
  it('waterbending taps sick creatures and artifacts without sacrificing a Treasure or double counting', () => {
    const g = mk(),
      s = put(g, 0, 'flexible-waterbender');
    s.sick = true;
    const t = createToken(g, 'tok-treasure', 0),
      a = put(g, 0, 'compassionate-healer');
    a.sick = true;
    expect(canPayCost(g, 0, parseCost(''), undefined, false, undefined, false, 4)).toBe(false);
    expect(s.tapped || a.tapped || t.tapped).toBe(false);
    expect(payCost(g, 0, parseCost(''), undefined, false, undefined, false, 3)).toBe(true);
    expect(t.zone).toBe('battlefield');
    expect([s, a, t].every((c) => c.tapped)).toBe(true);
    settleAll(g);
    expect(g.players[0].life).toBe(21);
    expect(g.players[0].bends).toContain('water');
  });
  it('waterbend cannot pay colored costs, and failure is atomic', () => {
    const g = mk();
    put(g, 0, 'flexible-waterbender');
    createToken(g, 'tok-clue', 0);
    expect(payCost(g, 0, parseCost('{U}'), undefined, false, undefined, false, 1)).toBe(false);
    expect(g.battlefield.every((id) => !g.cards[id].tapped)).toBe(true);
  });
  it('activates a waterbend ability using three artifacts', () => {
    const g = mk(),
      c = put(g, 0, 'flexible-waterbender');
    for (let i = 0; i < 3; i++) createToken(g, 'tok-clue', 0);
    expect(performAction(g, 0, { type: 'activate', card: c.id, ability: 0, targets: [] })).toBeNull();
    settleAll(g);
    expect(stats(g, c)).toMatchObject({ p: 5, t: 2 });
  });
  it('firebending adds spendable red mana and expires at the end of combat', () => {
    const g = mk(),
      c = put(g, 0, 'fire-sages');
    g.phase = 'combat_attackers';
    declareAttackers(g, 0, [c.id]);
    settleAll(g);
    expect(g.players[0].firePool).toEqual(['R']);
    expect(payCost(g, 0, parseCost('{R}'))).toBe(true);
    expect(g.players[0].firePool).toEqual([]);
    effects(g, c.id, [{ e: 'firebend', n: 2 }]);
    endCombat(g);
    expect(g.players[0].firePool).toEqual([]);
  });
  it('uses a persistent quest counter, not a +1/+1 counter', () => {
    const g = mk(),
      asc = put(g, 0, 'waterbender-ascension'),
      c = put(g, 0, 'water-tribe-captain');
    for (let i = 0; i < 4; i++) {
      emit(g, { type: 'combatDamage', source: c.id, player: 1, amount: 1 });
      settleAll(g);
    }
    expect(asc.charge).toBe(4);
    expect(asc.counters).toBe(0);
    expect(g.players[0].hand).toHaveLength(1);
  });
  it('shrine entry and subsequent shrine triggers use the actual shrine count', () => {
    const g = mk();
    lands(g, 0, 'island', 5);
    const spirit = inHand(g, 0, 'the-spirit-oasis');
    expect(performAction(g, 0, { type: 'cast', card: spirit.id, targets: [] })).toBeNull();
    resolve(g);
    settleAll(g);
    expect(g.players[0].hand).toHaveLength(1);
    const north = inHand(g, 0, 'northern-air-temple');
    lands(g, 0, 'swamp', 1);
    expect(performAction(g, 0, { type: 'cast', card: north.id, targets: [] })).toBeNull();
    resolve(g);
    settleAll(g);
    expect(g.players[0].life).toBe(22);
    expect(g.players[1].life).toBe(18);
    expect(g.players[0].hand).toHaveLength(2);
  });
  it('Avatar Aang draws for each element and transforms only after all four', () => {
    const g = mk(),
      a = put(g, 0, 'avatar-aang'),
      c = put(g, 1, 'water-tribe-captain');
    effects(g, a.id, [{ e: 'airbend', what: 'T0' }], [{ c: c.id }]);
    settleAll(g);
    effects(g, a.id, [{ e: 'earthbend', n: 2 }]);
    settleAll(g);
    effects(g, a.id, [{ e: 'firebend', n: 1 }]);
    settleAll(g);
    expect(a.def.id).toBe('avatar-aang');
    expect(payCost(g, 0, parseCost(''), undefined, false, undefined, false, 1)).toBe(true);
    settleAll(g);
    expect(a.def.id).toBe('aang-master-of-elements');
    expect(g.players[0].hand).toHaveLength(4);
  });
  it('saga final chapter returns its creature face, without sacrificing it', () => {
    const g = mk(),
      s = put(g, 0, 'the-legend-of-roku');
    effects(g, s.id, [{ e: 'returnTransformed' }]);
    checkSBA(g);
    expect(s.zone).toBe('battlefield');
    expect(s.def.id).toBe('avatar-roku');
    expect(s.def.firebending).toBe(4);
  });
  it('Katara doubles Ally triggers and copies preserve independent state', () => {
    const g = mk();
    put(g, 0, 'katara-the-fearless');
    const c = put(g, 0, 'compassionate-healer');
    tapCard(g, c);
    settleAll(g);
    expect(g.players[0].life).toBe(22);
    const clone = cloneGame(g);
    clone.players[0].bends = ['air'];
    expect(g.players[0].bends).toBeUndefined();
    const original = put(g, 0, 'flopsie-bumis-buddy');
    expect(stats(g, original).onlyOneBlocker).toBe(true);
  });
  it('tapped triggers see crew costs and Lesson conditions are conditional', () => {
    const g = mk(),
      gran = put(g, 0, 'gran-gran'),
      ship = put(g, 0, 'fire-nation-warship');
    put(g, 0, 'momo-playful-pet');
    const crew = abilitiesFor(g, ship).findIndex((a) => a.cost.crew !== undefined);
    expect(performAction(g, 0, { type: 'activate', card: ship.id, ability: crew, targets: [] })).toBeNull();
    settleAll(g);
    expect(gran.tapped).toBe(true);
    expect(g.players[0].hand).toHaveLength(0);
    for (let i = 0; i < 3; i++) inGy(g, 0, 'airbending-lesson');
    expect(getDef('gran-gran').abilities?.length).toBe(2);
  });
  it('free casting pays no mana, while foretell still charges its later cost', () => {
    const g = mk(),
      yue = put(g, 0, 'yue-the-moon-spirit'),
      spell = inHand(g, 0, 'divination');
    const choice = runEffects(g, { source: yue.id, controller: 0, targets: [] }, [{ e: 'tla', action: 'yue' }]);
    expect(choice.next().value).toMatchObject({ type: 'choose' });
    choice.next({ type: 'choose', ids: [spell.id] });
    expect(spell.zone).toBe('stack');
    resolve(g);
    expect(g.players[0].hand).toHaveLength(2);
    const g2 = mk(),
      comet = inHand(g2, 0, 'sozins-comet');
    lands(g2, 0, 'mountain', 2);
    expect(performAction(g2, 0, { type: 'cast', card: comet.id, targets: [], alt: 'plot' })).toBeNull();
    expect(comet.zone).toBe('exile');
    expect(castAlts(g2, 0, comet)).toEqual([]);
    g2.turn += 2;
    g2.battlefield.forEach((id) => (g2.cards[id].tapped = false));
    expect(performAction(g2, 0, { type: 'cast', card: comet.id, targets: [], alt: 'plotted' })).toMatch(/法術力不足/);
    lands(g2, 0, 'mountain', 1);
    expect(performAction(g2, 0, { type: 'cast', card: comet.id, targets: [], alt: 'plotted' })).toBeNull();
  });
});
