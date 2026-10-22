import { describe, it, expect } from 'vitest';
import { CARDS } from '../src/data';
import catalog from '../src/data/sets/fin-catalog.json';
import { mk, put, inHand, inGy, lands, resolve, settleAll, answerDefault } from './helpers';
import { performAction, castAlts, castableCards } from '../src/engine/actions';
import { getDef } from '../src/engine/registry';
import { runEffects } from '../src/engine/effects';
import { stats, matches, newCard, cloneGame } from '../src/engine/state';
import { addLore, dealDamage, emit, enterBattlefield, gainLife, putCounters, sacrifice, transformCard } from '../src/engine/zones';
import { runHeadless } from '../src/engine/controller';
import { findPayment, parseCost } from '../src/engine/mana';
import type { Effect, GameState } from '../src/engine/types';
function effect(g: GameState, source: number, es: Effect[], targets: any[] = []) {
  const f = runEffects(g, { source, controller: 0, targets }, es);
  let r = f.next();
  while (!r.done) r = f.next(answerDefault(g, r.value));
}
const cast = (g: GameState, id: number, targets: any[] = [], extra: object = {}) =>
  expect(performAction(g, 0, { type: 'cast', card: id, targets, ...extra })).toBeNull();
describe('FIN complete card pool and official mechanics', () => {
  it('contains all 306 unique FIN cards with exact printed characteristics', () => {
    expect(catalog).toHaveLength(306);
    for (const row of catalog) {
      const d = CARDS.find((c) => c.name === row.name)!;
      expect(d, row.name).toBeDefined();
      expect(d.text).toBe(row.text);
      expect(d.types).toEqual(row.types);
      expect(d.power).toBe(row.power);
      expect(d.toughness).toBe(row.toughness);
    }
  });
  it('Job select creates and equips a colorless Hero with its job type', () => {
    const g = mk(),
      eq = put(g, 0, 'dragoons-lance');
    emit(g, { type: 'etb', card: eq.id, controller: 0 });
    settleAll(g);
    const host = g.cards[eq.attachedTo!];
    expect(host.def.id).toBe('tok-fin-hero');
    expect(matches(g, { sub: 'Knight' }, host, 0)).toBe(true);
    expect(stats(g, host).p).toBe(2);
    expect(stats(g, host).kw.has('flying')).toBe(true);
  });
  it('Quina adds a Frog without changing which token Job select attaches to', () => {
    const g = mk();
    put(g, 0, 'quina-qu-gourmet');
    const eq = put(g, 0, 'monks-fist');
    emit(g, { type: 'etb', card: eq.id, controller: 0 });
    settleAll(g);
    expect(g.cards[eq.attachedTo!].def.id).toBe('tok-fin-hero');
    expect(g.battlefield.filter((id) => g.cards[id].def.id === 'tok-fin-frog')).toHaveLength(1);
  });
  it('tiered mana costs are the base plus chosen additional cost', () => {
    const g = mk(),
      body = put(g, 0, 'dwarven-castle-guard'),
      c = inHand(g, 0, 'restoration-magic');
    lands(g, 0, 'plains', 2);
    cast(g, c.id, [{ c: body.id }], { mode: 1 });
    resolve(g);
    expect(g.players[0].life).toBe(23);
    expect(stats(g, body).kw.has('indestructible')).toBe(true);
  });
  it('Combat Tutorial can make the opponent draw', () => {
    const g = mk(),
      c = inHand(g, 0, 'combat-tutorial');
    lands(g, 0, 'island', 3);
    cast(g, c.id, [{ p: 1 }, null]);
    resolve(g);
    expect(g.players[1].hand).toHaveLength(2);
  });
  it('Coeurl cannot target an enchantment creature', () => {
    const g = mk(),
      c = put(g, 0, 'coeurl'),
      target = put(g, 1, 'summon-choco-mog');
    lands(g, 0, 'plains', 2);
    expect(performAction(g, 0, { type: 'activate', card: c.id, ability: 0, targets: [{ c: target.id }] })).not.toBeNull();
  });
  it('summon saga gets its entry chapter and sacrifices after the last chapter resolves', () => {
    const g = mk(),
      c = newCard(g, getDef('summon-choco-mog'), 0);
    c.zone = 'exile';
    enterBattlefield(g, c, 0);
    settleAll(g);
    expect(c.lore).toBe(1);
    for (let i = 0; i < 3; i++) {
      addLore(g, c, 1);
      settleAll(g);
    }
    expect(c.zone).toBe('graveyard');
  });
  it('transforms Dion by exile and reentry, starts Bahamut at chapter I and later returns front', () => {
    const g = mk(),
      c = put(g, 0, 'dion-bahamuts-dominant'),
      target = put(g, 1, 'hill-gigas');
    lands(g, 0, 'plains', 6);
    expect(performAction(g, 0, { type: 'activate', card: c.id, ability: 0, targets: [] })).toBeNull();
    resolve(g);
    settleAll(g);
    expect(c.def.name).toBe('Bahamut, Warden of Light');
    expect(c.lore).toBe(1);
    addLore(g, c, 2);
    settleAll(g, (d) => (d.type === 'targets' ? { type: 'targets', targets: [{ c: target.id }] } : undefined));
    expect(c.def.name).toBe("Dion, Bahamut's Dominant");
    expect(target.zone).toBe('graveyard');
  });
  it('doubles life and +1/+1 counters with the matching crystals', () => {
    const g = mk();
    put(g, 0, 'the-wind-crystal');
    put(g, 0, 'the-earth-crystal');
    const body = put(g, 0, 'dwarven-castle-guard');
    gainLife(g, 0, 3);
    putCounters(g, body, 2);
    expect(g.players[0].life).toBe(26);
    expect(body.counters).toBe(4);
  });
  it('The Water Crystal adds four to opponent milling', () => {
    const g = mk(),
      c = put(g, 0, 'the-water-crystal');
    effect(g, c.id, [{ e: 'mill', n: 2, who: 'opp' }]);
    expect(g.players[1].graveyard).toHaveLength(6);
  });
  it('Matoya draws once for surveil, after the decision', () => {
    const g = mk(),
      c = put(g, 0, 'matoya-archon-elder');
    effect(g, c.id, [{ e: 'surveil', n: 1 }]);
    expect(g.players[0].hand).toHaveLength(0);
    settleAll(g);
    expect(g.players[0].hand).toHaveLength(1);
  });
  it('mana-spent triggers use actual payment, including reductions', () => {
    const g = mk(),
      c = put(g, 0, 'blazing-bomb');
    put(g, 0, 'the-fire-crystal');
    const spell = inHand(g, 0, 'fire-magic');
    lands(g, 0, 'mountain', 3);
    cast(g, spell.id, [], { mode: 1 });
    settleAll(g);
    expect(c.counters).toBe(0);
    expect(spell.manaSpent).toBe(2);
  });
  it('Noctis requires 3 life and the artifact returns with finality', () => {
    const g = mk();
    put(g, 0, 'noctis-prince-of-lucis');
    const c = inGy(g, 0, 'instant-ramen');
    lands(g, 0, 'plains', 2);
    cast(g, c.id);
    expect(g.players[0].life).toBe(17);
    resolve(g);
    expect(c.finality).toBe(true);
    sacrifice(g, c);
    expect(c.zone).toBe('exile');
  });
  it('Hades permits own-turn graveyard land play and exiles cards headed to the graveyard', () => {
    const g = mk(),
      c = put(g, 0, 'emet-selch-unsundered');
    transformCard(g, c);
    const land = inGy(g, 0, 'forest');
    expect(castableCards(g, 0)).toContain(land);
    expect(performAction(g, 0, { type: 'play', card: land.id })).toBeNull();
    const body = put(g, 0, 'dwarven-castle-guard');
    sacrifice(g, body);
    expect(body.zone).toBe('exile');
  });
  it('adventure lands cast their spell and can be played from exile', () => {
    const g = mk(),
      c = inHand(g, 0, 'lindblum-industrial-regency');
    lands(g, 0, 'mountain', 3);
    cast(g, c.id, [], { alt: 'adventure' });
    resolve(g);
    expect(c.zone).toBe('exile');
    expect(c.onAdventure).toBe(true);
    expect(performAction(g, 0, { type: 'play', card: c.id })).toBeNull();
    expect(c.zone).toBe('battlefield');
  });
  it('Louisoix counters an activated ability using a stack target', () => {
    const g = mk(),
      c = inHand(g, 0, 'louisoixs-sacrifice');
    lands(g, 0, 'island', 3);
    const sid = g.nextSid++;
    g.stack.push({
      sid,
      kind: 'activated',
      cardId: put(g, 1, 'qiqirn-merchant').id,
      controller: 1,
      targets: [],
      targetSpecs: [],
      effects: [{ e: 'draw', n: 1 }],
      text: 'draw',
    });
    cast(g, c.id, [], { mode: 0, stackTargetSid: sid });
    resolve(g);
    expect(g.stack).toHaveLength(0);
  });
  it('Gogo pays XX and copies the selected ability X times', () => {
    const g = mk(),
      c = put(g, 0, 'gogo-master-of-mimicry');
    lands(g, 0, 'island', 4);
    const sid = g.nextSid++;
    g.stack.push({
      sid,
      kind: 'trigger',
      cardId: c.id,
      controller: 0,
      targets: [],
      targetSpecs: [],
      effects: [{ e: 'draw', n: 1 }],
      text: 'draw',
    });
    expect(performAction(g, 0, { type: 'activate', card: c.id, ability: 0, targets: [], x: 2, stackTargetSid: sid })).toBeNull();
    resolve(g);
    expect(g.stack).toHaveLength(3);
  });
  it('Chocobo Kick returns a land as a cost before its spell resolves', () => {
    const g = mk(),
      a = put(g, 0, 'hill-gigas'),
      b = put(g, 1, 'hill-gigas'),
      land = put(g, 0, 'forest'),
      c = inHand(g, 0, 'chocobo-kick');
    lands(g, 0, 'forest', 1);
    cast(g, c.id, [{ c: a.id }, { c: b.id }], { mode: 1, returnLand: land.id });
    expect(land.zone).toBe('hand');
    resolve(g);
    expect(b.damage).toBe(10);
  });
  it('the Darkness Crystal exiles an opposing dying creature, gains life, then reanimates it', () => {
    const g = mk(),
      crystal = put(g, 0, 'the-darkness-crystal'),
      body = put(g, 1, 'dwarven-castle-guard');
    sacrifice(g, body);
    settleAll(g);
    expect(body.zone).toBe('exile');
    expect(g.battlefield.filter((id) => g.cards[id].def.id === 'tok-hero-cl')).toHaveLength(0);
    expect(g.players[0].life).toBe(22);
    lands(g, 0, 'swamp', 6);
    expect(performAction(g, 0, { type: 'activate', card: crystal.id, ability: 0, targets: [] })).toBeNull();
    resolve(g);
    expect(body.controller).toBe(0);
    expect(body.counters).toBe(2);
    expect(body.tapped).toBe(true);
  });
  it('Absolute Virtue protects its player from targeting and damage', () => {
    const g = mk(),
      c = put(g, 0, 'absolute-virtue');
    expect(dealDamage(g, c, 1, { p: 0 }, 5)).toBe(0);
    expect(g.players[0].life).toBe(20);
  });
  it('Adamantoise redirects friendly damage and still dies with ten tapped Treasures', () => {
    const g = mk(),
      c = put(g, 0, 'ancient-adamantoise'),
      body = put(g, 0, 'dwarven-castle-guard');
    dealDamage(g, null, 1, { c: body.id }, 2);
    expect(c.damage).toBe(2);
    expect(body.damage).toBe(0);
    sacrifice(g, c);
    settleAll(g);
    expect(c.zone).toBe('exile');
    expect(g.battlefield.filter((id) => g.cards[id].def.id === 'tok-treasure')).toHaveLength(10);
  });
  it('Vivi produces its power as blue/red mana with no mana payment', () => {
    const g = mk(),
      c = put(g, 0, 'vivi-ornitier');
    putCounters(g, c, 2);
    expect(performAction(g, 0, { type: 'activate', card: c.id, ability: 0, targets: [] })).toBeNull();
    resolve(g);
    expect(g.players[0].pool).toEqual(['U', 'U']);
  });
  it('base power characteristics retain counters and temporary pumps', () => {
    const g = mk(),
      c = put(g, 0, 'snow-villiers');
    put(g, 0, 'dwarven-castle-guard');
    putCounters(g, c, 1);
    effect(g, c.id, [{ e: 'pump', what: 'self', p: 2, t: 0 }]);
    expect(stats(g, c).p).toBe(5);
  });
  it('Traveling Chocobo exposes land and Bird cards from the library', () => {
    const g = mk();
    put(g, 0, 'traveling-chocobo');
    const c = g.cards[g.players[0].library[0]];
    expect(castAlts(g, 0, c)).toContain(undefined);
    expect(castableCards(g, 0)).toContain(c);
  });
  it('Ultima mana bonus requires tapping the same land for colorless', () => {
    const sources = [
      { id: 1, produces: ['C', 'R'] as const, isCreature: false },
      { id: 2, produces: ['C'] as const, isCreature: false, extra: true, extraRequires: { id: 1, mana: 'C' as const } },
    ].map((s) => ({ ...s, produces: [...s.produces] }));
    expect(findPayment(parseCost('{R}{C}'), sources)).toBeNull();
    expect(findPayment(parseCost('{C}{C}'), sources)).toHaveLength(2);
  });
  it('Ultima land blight is a removable counter and the land recovers its abilities', () => {
    const g = mk(),
      source = put(g, 0, 'ultima-origin-of-oblivion'),
      land = put(g, 1, 'forest');
    effect(g, source.id, [{ e: 'fin', action: 'blightLand' }], [{ c: land.id }]);
    expect(land.def.produces).toEqual(['C']);
    expect(land.eclCounters?.blight).toBe(1);
    effect(g, source.id, [{ e: 'ecl', action: 'removeAll' }], [{ c: land.id }]);
    settleAll(g);
    expect(land.def.produces).toEqual(['G']);
  });
  it('cloned simulation states do not share FIN markers', () => {
    const g = mk(),
      c = put(g, 0, 'vivi-ornitier');
    c.finMarks = { x: 1 };
    g.players[0].finFlags = { x: 1 };
    const cloned = cloneGame(g);
    cloned.cards[c.id].finMarks!.x = 2;
    cloned.players[0].finFlags!.x = 2;
    expect(c.finMarks.x).toBe(1);
    expect(g.players[0].finFlags.x).toBe(1);
  });
  it('runs a FIN-only seeded game without invalid action loops', () => {
    const pool = CARDS.filter((c) => c.set === 'FIN' && c.types.includes('Creature') && !c.fin?.stackTarget)
      .slice(0, 22)
      .map((c) => c.id);
    const deck = [
      ...pool,
      ...Array(10).fill('plains'),
      ...Array(8).fill('island'),
      ...Array(8).fill('swamp'),
      ...Array(8).fill('mountain'),
      ...Array(8).fill('forest'),
    ];
    const g = runHeadless(
      { name: 'FIN A', deckName: 'FIN', deck, isAI: true },
      { name: 'FIN B', deckName: 'FIN', deck, isAI: true },
      ['normal', 'normal'],
      88,
    );
    expect(g.winner).not.toBeNull();
  });
});
