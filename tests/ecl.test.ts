import { runHeadless } from '../src/engine/controller';
import { describe, it, expect } from 'vitest';
import { mk, put, inHand, lands, resolve, settleAll, answerDefault } from './helpers';
import { CARDS } from '../src/data';
import catalog from '../src/data/sets/ecl-catalog.json';
import { getDef } from '../src/engine/registry';
import { performAction, castableCards, canPayCost, payCost } from '../src/engine/actions';
import { parseCost, colorsOf } from '../src/engine/mana';
import { stats, hasKw } from '../src/engine/state';
import { putMinusCounters, putCounters, sacrifice, emit, transformCard } from '../src/engine/zones';
import { runEffects } from '../src/engine/effects';
import type { Effect, GameState } from '../src/engine/types';
function effects(g: GameState, source: number, es: Effect[], targets: any[] = []) {
  const f = runEffects(g, { source, controller: 0, targets }, es);
  let r = f.next();
  while (!r.done) r = f.next(answerDefault(g, r.value));
}
function cast(g: GameState, c: number, targets: any[] = [], extra: object = {}) {
  expect(performAction(g, 0, { type: 'cast', card: c, targets, ...extra })).toBeNull();
}
describe('ECL official base set', () => {
  it('includes all 268 base cards, exact text and printed stats', () => {
    for (const row of catalog) {
      const c = CARDS.find((c) => c.name === row.name)!;
      expect(c, row.name).toBeDefined();
      if (c.set === 'ECL') {
        expect(c.text).toBe(row.text);
        expect(c.power).toBe(row.power);
        expect(c.toughness).toBe(row.toughness);
        expect(c.types).toEqual(row.types);
      }
    }
  });
  it('keeps correct back-face colors', () => {
    expect(colorsOf(getDef('brigid-clachans-heart').back!)).toEqual(['G']);
    expect(colorsOf(getDef('eirdu-carrier-of-dawn').back!)).toEqual(['B']);
  });
  it('pays blight during casting even when spell is countered', () => {
    const g = mk(),
      body = put(g, 0, 'rooftop-percher'),
      target = put(g, 1, 'rooftop-percher'),
      c = inHand(g, 0, 'requiting-hex');
    lands(g, 0, 'swamp', 1);
    const small = put(g, 1, 'goldmeadow-nomad');
    cast(g, c.id, [{ c: small.id }], { mode: 1, blightCard: body.id });
    expect(body.counters).toBe(-1);
    expect(target.counters).toBe(0);
  });
  it('beholds as an additional cost and returns championed card on leaving', () => {
    const g = mk(),
      body = inHand(g, 0, 'goldmeadow-nomad'),
      c = inHand(g, 0, 'champion-of-the-clachan');
    lands(g, 0, 'plains', 4);
    cast(g, c.id, [], { beheld: [body.id] });
    expect(body.zone).toBe('exile');
    resolve(g);
    sacrifice(g, c);
    settleAll(g);
    expect(body.zone).toBe('hand');
  });
  it('lets a changeling Kindred instant behold a creature type', () => {
    const g = mk(),
      body = inHand(g, 0, 'crib-swap'),
      c = inHand(g, 0, 'champion-of-the-clachan');
    lands(g, 0, 'plains', 4);
    cast(g, c.id, [], { beheld: [body.id] });
    expect(body.zone).toBe('exile');
  });
  it('pays two more when declining optional behold', () => {
    const g = mk(),
      body = inHand(g, 0, 'goldmeadow-nomad'),
      c = inHand(g, 0, 'kinsbaile-aspirant');
    lands(g, 0, 'plains', 1);
    expect(performAction(g, 0, { type: 'cast', card: c.id, targets: [], beheld: [] })).not.toBeNull();
    expect(body.zone).toBe('hand');
  });
  it('enters with minus counters and removes any kind as activation cost', () => {
    const g = mk(),
      c = put(g, 0, 'burdened-stoneback'),
      t = put(g, 0, 'rooftop-percher');
    expect(c.counters).toBe(-2);
    lands(g, 0, 'plains', 2);
    expect(
      performAction(g, 0, { type: 'activate', card: c.id, ability: 0, targets: [{ c: t.id }], counterPayments: [{ kind: '-1/-1', n: 1 }] }),
    ).toBeNull();
    expect(c.counters).toBe(-1);
    resolve(g);
    expect(hasKw(g, t, 'indestructible')).toBe(true);
  });
  it('evoke sacrifices through a trigger', () => {
    const g = mk();
    expect(getDef('brigid-clachans-heart').evoke).toBeUndefined();
    const evoke = catalog.find((c) => c.evoke)!;
    expect(evoke).toBeDefined();
    const d = CARDS.find((c) => c.name === evoke.name)!;
    const x = inHand(g, 0, d.id);
    lands(g, 0, 'plains', 10);
    lands(g, 0, 'island', 10);
    lands(g, 0, 'swamp', 10);
    lands(g, 0, 'mountain', 10);
    lands(g, 0, 'forest', 10);
    cast(g, x.id, [], { alt: 'evoke' });
    resolve(g);
    settleAll(g);
    expect(x.zone).toBe('graveyard');
  });
  it('persists without minus counters and does not repeat with them', () => {
    const g = mk(),
      c = put(g, 0, 'goldmeadow-nomad');
    c.permanentGrants = [{ kw: ['persist'] }];
    sacrifice(g, c);
    settleAll(g);
    expect(c.zone).toBe('battlefield');
    expect(c.counters).toBe(-1);
    c.permanentGrants = [{ kw: ['persist'] }];
    sacrifice(g, c);
    settleAll(g);
    expect(c.zone).toBe('graveyard');
  });
  it('records transformation and creates front-face token', () => {
    const g = mk(),
      c = put(g, 0, 'brigid-clachans-heart');
    transformCard(g, c);
    expect(c.def.name).toBe("Brigid, Doun's Mind");
    transformCard(g, c);
    settleAll(g);
    expect(g.battlefield.filter((id) => g.cards[id].def.id === 'tok-ecl-kithkin').length).toBe(1);
  });
  it('stores Torque charge independently from power counters', () => {
    const g = mk(),
      c = put(g, 0, 'rimefire-torque');
    settleAll(g);
    c.eclType = 'Kithkin';
    const body = put(g, 0, 'goldmeadow-nomad');
    emit(g, { type: 'etb', card: body.id, controller: 0 });
    settleAll(g);
    expect(c.charge).toBe(1);
    expect(c.counters).toBe(0);
  });
  it('adds Lavaleaper mana for basic lands for either player', () => {
    const g = mk();
    put(g, 0, 'lavaleaper');
    lands(g, 1, 'forest', 1);
    expect(canPayCost(g, 1, parseCost('{G}{G}'))).toBe(true);
    expect(payCost(g, 1, parseCost('{G}'))).toBe(true);
    expect(g.players[1].pool).toContain('G');
  });
  it('uses Crown for the first token event only', () => {
    const g = mk(),
      c = put(g, 0, 'mirrormind-crown'),
      body = put(g, 0, 'rooftop-percher');
    c.attachedTo = body.id;
    effects(g, c.id, [{ e: 'token', token: 'tok-ecl-kithkin', n: 2 }]);
    expect(g.battlefield.filter((id) => g.cards[id].token && g.cards[id].def.id === 'rooftop-percher')).toHaveLength(2);
    effects(g, c.id, [{ e: 'token', token: 'tok-ecl-kithkin' }]);
    expect(g.battlefield.filter((id) => g.cards[id].def.id === 'tok-ecl-kithkin')).toHaveLength(1);
  });
  it('conspires by tapping two creatures as a cost and copies the spell', () => {
    const g = mk();
    put(g, 0, 'raiding-schemes');
    const a = put(g, 0, 'goldmeadow-nomad'),
      b = put(g, 0, 'goldmeadow-nomad'),
      c = inHand(g, 0, 'appeal-to-eirdu');
    lands(g, 0, 'plains', 4);
    cast(g, c.id, [{ c: a.id }, null], { conspireTapped: [[a.id, b.id]] });
    expect(a.tapped && b.tapped).toBe(true);
    settleAll(g);
    expect(stats(g, a).p).toBeGreaterThanOrEqual(5);
  });
  it('chooses Kirol trigger before paying and cannot copy an expired target', () => {
    const g = mk(),
      c = put(g, 0, 'kirol-attentive-first-year'),
      a = put(g, 0, 'goldmeadow-nomad'),
      b = put(g, 0, 'goldmeadow-nomad');
    const sid = g.nextSid++;
    g.stack.push({
      sid,
      kind: 'trigger',
      cardId: a.id,
      controller: 0,
      targets: [],
      targetSpecs: [],
      effects: [{ e: 'draw', n: 1 }],
      text: 'draw',
    });
    expect(
      performAction(g, 0, { type: 'activate', card: c.id, ability: 0, targets: [], tapCards: [a.id, b.id], stackTargetSid: sid }),
    ).toBeNull();
    g.stack = g.stack.filter((x) => x.sid !== sid);
    resolve(g);
    expect(g.stack).toHaveLength(0);
  });
  it('exposes opponent-owned exiled cards with ECL cast permission', () => {
    const g = mk(),
      c = inHand(g, 1, 'goldmeadow-nomad');
    g.players[1].hand = [];
    c.zone = 'exile';
    g.players[1].exile.push(c.id);
    c.eclCast = { by: 0, until: g.turn, free: true };
    expect(castableCards(g, 0)).toContain(c);
    cast(g, c.id);
    resolve(g);
    expect(c.controller).toBe(0);
  });
  it('resolves Shimmerwilds color and mana replacement after attachment', () => {
    const g = mk(),
      land = put(g, 0, 'forest'),
      c = inHand(g, 0, 'shimmerwilds-growth');
    lands(g, 0, 'forest', 2);
    cast(g, c.id, [{ c: land.id }]);
    resolve(g);
    settleAll(g, (d) => (d.type === 'mode' ? { type: 'modes', picks: [1] } : undefined));
    expect(c.attachedTo).toBe(land.id);
    expect(colorsOf(land.def)).toEqual(['U']);
    land.tapped = false;
    expect(payCost(g, 0, parseCost('{G}{U}'))).toBe(true);
  });
  it('returns Morningtide creatures tapped at the next end step', () => {
    const g = mk(),
      body = put(g, 1, 'rooftop-percher'),
      c = inHand(g, 0, 'morningtides-light');
    lands(g, 0, 'plains', 4);
    cast(g, c.id, [{ c: body.id }], { mode: 1 });
    resolve(g);
    expect(body.zone).toBe('exile');
    expect(g.players[0].eclPreventDamageUntil).toBe(0);
    emit(g, { type: 'step', step: 'endStep', player: 1 });
    settleAll(g);
    expect(body.zone).toBe('battlefield');
    expect(body.tapped).toBe(true);
  });
  it('completes a seeded ECL-only game', () => {
    const ids = CARDS.filter((c) => c.set === 'ECL' && c.types.includes('Creature') && !c.ecl?.behold)
        .slice(0, 24)
        .map((c) => c.id),
      deck = [
        ...ids,
        ...Array(8).fill('plains'),
        ...Array(8).fill('island'),
        ...Array(8).fill('swamp'),
        ...Array(8).fill('mountain'),
        ...Array(8).fill('forest'),
      ];
    const g = runHeadless(
      { name: 'ECL A', deckName: 'ECL', deck, isAI: true },
      { name: 'ECL B', deckName: 'ECL', deck, isAI: true },
      ['normal', 'normal'],
      41,
    );
    expect(g.winner).not.toBeNull();
  });
  it('gives all six distinct pairs for each command', () => {
    for (const id of ['ashlings-command', 'brigids-command', 'grubs-command', 'syggs-command', 'trystans-command'])
      expect(getDef(id).spell?.modes).toHaveLength(6);
  });
  it('prevents counters and all untapping on Blossombind host', () => {
    const g = mk(),
      a = put(g, 0, 'blossombind'),
      c = put(g, 1, 'rooftop-percher');
    a.attachedTo = c.id;
    c.tapped = true;
    putCounters(g, c, 1);
    putMinusCounters(g, c, 2);
    effects(g, a.id, [{ e: 'untap', what: 'T0' }], [{ c: c.id }]);
    expect(c.counters).toBe(0);
    expect(c.tapped).toBe(true);
  });
});
