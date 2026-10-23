import { describe, it, expect } from 'vitest';
import { CARDS, slug } from '../src/data';
import catalog from '../src/data/sets/msh-catalog.json';
import { poolSize } from '../src/meta/booster';
import { mk, put, inHand, inGy, lands, resolve, settleAll, answerDefault } from './helpers';
import { canActivate, performAction, castAlts, canPayCost, payCost } from '../src/engine/actions';
import { runEffects } from '../src/engine/effects';
import { newCard, stats, matches, copiableDefinition } from '../src/engine/state';
import { getDef } from '../src/engine/registry';
import { parseCost } from '../src/engine/mana';
import { emit, enterBattlefield, dealDamage, destroyCards, putCounters, moveCard, transformCard } from '../src/engine/zones';
import type { Effect, GameState, TargetRef } from '../src/engine/types';
function effect(g: GameState, source: number, effects: Effect[], targets: TargetRef[] = []) {
  const f = runEffects(g, { source, controller: 0, targets }, effects);
  let r = f.next();
  while (!r.done) r = f.next(answerDefault(g, r.value));
}
const cast = (g: GameState, id: number, targets: (TargetRef | null)[] = [], extra: object = {}) =>
  expect(performAction(g, 0, { type: 'cast', card: id, targets, ...extra })).toBeNull();
const activate = (g: GameState, id: number, ability = 0, targets: (TargetRef | null)[] = [], extra: object = {}) =>
  expect(performAction(g, 0, { type: 'activate', card: id, ability, targets, ...extra })).toBeNull();
describe('MSH full main set and mechanics', () => {
  it('Spider-Woman untap prevention ends when control is lost or she leaves and returns', () => {
    const g = mk(), source = put(g, 0, 'spider-woman-secret-agent'), victim = put(g, 1, 'topiary-panther');
    effect(g, source.id, [{ e: 'msh', action: '229' }], [{ c: victim.id }]);
    expect(stats(g, victim).noUntap).toBe(true);
    source.controller = 1;
    expect(stats(g, victim).noUntap).not.toBe(true);
    source.controller = 0;
    expect(stats(g, victim).noUntap).not.toBe(true);
    effect(g, source.id, [{ e: 'msh', action: '229' }], [{ c: victim.id }]);
    moveCard(g, source, 'hand');
    enterBattlefield(g, source, 0);
    expect(stats(g, victim).noUntap).not.toBe(true);
    effect(g, source.id, [{ e: 'untap', what: 'T0' }], [{ c: victim.id }]);
    expect(victim.tapped).toBe(false);
  });
  it('declining She-Hulk damage does not consume the once-per-turn effect', () => {
    const g = mk(), hulk = put(g, 0, 'jennifer-walters');
    transformCard(g, hulk);
    const ally = put(g, 0, 'topiary-panther'), enemy = put(g, 1, 'novice-inspector');
    dealDamage(g, enemy, 1, { c: ally.id }, 1);
    settleAll(g, d => d.type === 'yesno' ? { type: 'yesno', yes: false } : d.type === 'targets' ? { type: 'targets', targets: [{ p: 1 }] } : undefined);
    expect(g.players[1].life).toBe(20);
    dealDamage(g, enemy, 1, { c: ally.id }, 2);
    settleAll(g, d => d.type === 'targets' ? { type: 'targets', targets: [{ p: 1 }] } : undefined);
    expect(g.players[1].life).toBe(18);
    dealDamage(g, enemy, 1, { c: hulk.id }, 1);
    settleAll(g, d => d.type === 'targets' ? { type: 'targets', targets: [{ p: 1 }] } : undefined);
    expect(g.players[1].life).toBe(18);
  });
  it('variable base powers retain counters and other power bonuses', () => {
    for (const id of ['namor-the-sub-mariner', 'super-adaptoid', 'ms-marvel-kamala-khan']) {
      const g = mk(), c = put(g, 0, id);
      put(g, 0, 'loki-god-of-mischief');
      inHand(g, 0, 'plains');
      if (id === 'ms-marvel-kamala-khan') effect(g, c.id, [{ e: 'msh', action: '67' }]);
      putCounters(g, c, 1);
      effect(g, c.id, [{ e: 'pump', what: 'self', p: 3, t: 3 }]);
      expect(stats(g, c).p, id).toBe(id === 'super-adaptoid' ? 6 : 5);
    }
  });
  it('Super-Soldier Serum grants continuous types without changing the copiable definition', () => {
    const g = mk(), c = put(g, 0, 'brave-brawler'), aura = inHand(g, 0, 'super-soldier-serum');
    lands(g, 0, 'plains', 2);
    cast(g, aura.id, [{ c: c.id }]);
    resolve(g);
    settleAll(g);
    expect(matches(g, { legendary: true, sub: 'Soldier' }, c, 0)).toBe(true);
    expect(copiableDefinition(c).supertypes ?? []).not.toContain('Legendary');
    moveCard(g, aura, 'graveyard');
    expect(matches(g, { legendary: true }, c, 0)).toBe(false);
    expect(matches(g, { sub: 'Soldier' }, c, 0)).toBe(false);
  });
  it('Invisible Woman triggers for independent counter placements without an effect batch', () => {
    const g = mk();
    put(g, 0, 'invisible-woman-sue-storm');
    const hero = put(g, 0, 'brave-brawler');
    putCounters(g, hero, 1);
    settleAll(g);
    putCounters(g, hero, 1);
    settleAll(g);
    expect(g.battlefield.filter(id => g.cards[id].def.id === 'tok-msh-wall')).toHaveLength(2);
  });
  it('Invisible Woman triggers once per simultaneous instruction, including separate instructions in one effect', () => {
    const g = mk();
    const sue = put(g, 0, 'invisible-woman-sue-storm');
    put(g, 0, 'brave-brawler');
    put(g, 0, 'brave-brawler');
    effect(g, sue.id, [
      { e: 'counters', what: { all: { ctrl: 'you', sub: 'Hero', other: true } }, n: 1 },
      { e: 'counters', what: { all: { ctrl: 'you', sub: 'Hero', other: true } }, n: 1 },
    ]);
    settleAll(g);
    expect(g.battlefield.filter(id => g.cards[id].def.id === 'tok-msh-wall')).toHaveLength(2);
  });
  it('stun and charge counters do not trigger +1/+1 counter abilities or grant flying', () => {
    for (const kind of ['stun', 'chargeCounter'] as const) {
      const g = mk();
      const sue = put(g, 0, 'invisible-woman-sue-storm');
      const beast = put(g, 0, 'beast-erudite-aerialist');
      const knight = put(g, 0, 'knight-of-wundagore');
      effect(g, sue.id, [{ e: kind, what: 'T0', n: 1 }], [{ c: beast.id }]);
      settleAll(g);
      expect(knight.counters).toBe(0);
      expect(stats(g, beast).kw.has('flying')).toBe(false);
      expect(g.battlefield.some(id => g.cards[id].def.id === 'tok-msh-wall')).toBe(false);
    }
  });
  it('contains all 276 printed definitions and the exact booster pool', () => {
    expect(catalog).toHaveLength(276);
    expect(poolSize('MSH')).toBe(276);
    for (const row of catalog) {
      const d = CARDS.find((c) => c.id === slug(row.name))!;
      expect(d, row.name).toBeDefined();
      expect(d.text).toBe(row.text);
      expect(d.cost).toBe(row.cost);
      expect(d.types).toEqual(row.types);
      expect(d.power).toBe(row.power);
      expect(d.toughness).toBe(row.toughness);
      if (row.types.some((t) => t === 'Instant' || t === 'Sorcery')) expect(d.spell, row.name).toBeDefined();
      if ('back' in row) expect(d.back?.name).toBe(row.back!.name);
    }
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
  it('power-up reduces the full mana cost on its entry turn and works once per permanent', () => {
    const g = mk(),
      c = put(g, 0, 'brave-brawler');
    lands(g, 0, 'plains', 3);
    activate(g, c.id);
    resolve(g);
    expect(c.counters).toBe(2);
    g.turn++;
    for (const id of g.battlefield) g.cards[id].tapped = false;
    expect(canActivate(g, 0, c, 0)).toBe(false);
    moveCard(g, c, 'hand');
    enterBattlefield(g, c, 0);
    expect(canActivate(g, 0, c, 0)).toBe(true);
  });
  it('Wonder Man allows one additional power-up activation', () => {
    const g = mk();
    put(g, 0, 'wonder-man-hollywood-hero');
    const c = put(g, 0, 'brave-brawler');
    lands(g, 0, 'plains', 9);
    activate(g, c.id);
    resolve(g);
    activate(g, c.id);
    resolve(g);
    expect(c.counters).toBe(4);
    expect(canActivate(g, 0, c, 0)).toBe(false);
  });
  it('Hulk reduces other creature power-up generic costs', () => {
    const g = mk();
    put(g, 0, 'hulk-gamma-goliath');
    const c = put(g, 0, 'brave-brawler');
    expect(canActivate(g, 0, c, 0)).toBe(true);
    activate(g, c.id);
    resolve(g);
    expect(c.counters).toBe(2);
  });
  it('Teamwork can tap a summoning-sick helper and triggers Maria Hill', () => {
    const g = mk(),
      hill = put(g, 0, 'agent-maria-hill'),
      ally = put(g, 0, 'novice-inspector'),
      c = inHand(g, 0, 'team-tactics');
    hill.sick = true;
    ally.sick = true;
    lands(g, 0, 'mountain', 2);
    cast(g, c.id, [{ c: ally.id }], { alt: 'teamwork', teamworkTapped: [hill.id] });
    expect(hill.tapped).toBe(true);
    resolve(g);
    settleAll(g);
    expect(stats(g, ally).kw.has('double_strike')).toBe(true);
    expect(stats(g, ally).kw.has('trample')).toBe(true);
    expect(hill.counters).toBe(1);
    expect(g.players[0].hand.length).toBe(1);
  });
  it('invalid Teamwork payment changes neither mana nor battlefield', () => {
    const g = mk(),
      a = put(g, 0, 'novice-inspector'),
      c = inHand(g, 0, 'earths-mightiest-heroes');
    lands(g, 0, 'forest', 6);
    expect(performAction(g, 0, { type: 'cast', card: c.id, targets: [], alt: 'teamwork', teamworkTapped: [a.id] })).not.toBeNull();
    expect(g.battlefield.every((id) => !g.cards[id].tapped)).toBe(true);
    expect(c.zone).toBe('hand');
  });
  it('Teamwork modes choose both while ordinary casting chooses one', () => {
    const g = mk(),
      c = inHand(g, 0, 'murdocks-crusade'),
      a = put(g, 1, 'topiary-panther'),
      b = put(g, 1, 'illicit-masquerade');
    putCounters(g, b, 0);
    const helper = put(g, 0, 'topiary-panther');
    lands(g, 0, 'plains', 2);
    expect(castAlts(g, 0, c)).toContain('teamwork');
    cast(g, c.id, [{ c: a.id }, { c: b.id }], { alt: 'teamwork', teamworkTapped: [helper.id] });
    resolve(g);
    expect(a.zone).toBe('exile');
    expect(b.zone).toBe('exile');
  });
  it('a shield counter prevents one damage event and grants allied Hero hexproof', () => {
    const g = mk(),
      cap = put(g, 0, 'captain-america-super-soldier'),
      hero = put(g, 0, 'brave-brawler'),
      src = put(g, 1, 'novice-inspector');
    expect(cap.eclCounters?.shield).toBe(1);
    expect(stats(g, hero).kw.has('hexproof')).toBe(true);
    dealDamage(g, src, 1, { c: cap.id }, 9);
    expect(cap.damage).toBe(0);
    expect(cap.eclCounters?.shield).toBe(0);
    expect(stats(g, hero).kw.has('hexproof')).toBe(false);
  });
  it('a shield counter replaces destruction but does not stop sacrifice', () => {
    const g = mk(),
      cap = put(g, 0, 'captain-america-super-soldier');
    destroyCards(g, [cap]);
    expect(cap.zone).toBe('battlefield');
    expect(cap.eclCounters?.shield).toBe(0);
    destroyCards(g, [cap]);
    expect(cap.zone).toBe('graveyard');
  });
  it('Doc Samson adds one extra plus counter and one extra counter of another kind', () => {
    const g = mk();
    put(g, 0, 'doc-samson-super-psychiatrist');
    const c = put(g, 0, 'novice-inspector');
    putCounters(g, c, 1);
    expect(c.counters).toBe(2);
    const plan = put(g, 0, 'political-triumph');
    effect(g, plan.id, [{ e: 'msh', action: 'plan' }]);
    expect(plan.eclCounters?.plan).toBe(2);
  });
  it('the fourth Plan counter sacrifices Political Triumph and awards its payoff', () => {
    const g = mk(),
      plan = put(g, 0, 'political-triumph'),
      body = put(g, 0, 'novice-inspector');
    for (let i = 0; i < 4; i++) effect(g, plan.id, [{ e: 'msh', action: 'plan' }]);
    settleAll(g);
    expect(plan.zone).toBe('graveyard');
    expect(body.counters).toBe(1);
    expect(g.players[0].hand.length).toBe(1);
  });
  it('Mind Stone must be harnessed before its infinity trigger can flicker', () => {
    const g = mk(),
      stone = put(g, 0, 'the-mind-stone'),
      body = put(g, 0, 'novice-inspector');
    const before = body.objectVersion ?? 0;
    emit(g, { type: 'step', step: 'endStep', player: 0 });
    settleAll(g);
    expect(body.objectVersion ?? 0).toBe(before);
    lands(g, 0, 'plains', 6);
    activate(g, stone.id);
    resolve(g);
    expect(stone.mshHarnessed).toBe(true);
    emit(g, { type: 'step', step: 'endStep', player: 0 });
    settleAll(g);
    expect(body.objectVersion ?? 0).toBeGreaterThan(before);
  });
  it('Arc Reactor enters tapped and generates exactly three colorless mana', () => {
    const g = mk(),
      c = newCard(g, getDef('arc-reactor'), 0);
    c.zone = 'exile';
    enterBattlefield(g, c, 0);
    expect(c.tapped).toBe(true);
    c.tapped = false;
    expect(canPayCost(g, 0, parseCost('{3}'))).toBe(true);
    expect(payCost(g, 0, parseCost('{3}'))).toBe(true);
    expect(c.tapped).toBe(true);
    expect(canPayCost(g, 0, parseCost('{1}'))).toBe(false);
  });
  it('Ironheart improvise taps artifacts to pay generic costs without inventing mana spent', () => {
    const g = mk(),
      heart = put(g, 0, 'ironheart-clever-champion'),
      a = put(g, 0, 'tok-clue'),
      b = put(g, 0, 'tok-clue'),
      spell = inHand(g, 0, 'depower'),
      target = put(g, 1, 'novice-inspector');
    void heart;
    lands(g, 0, 'island', 1);
    cast(g, spell.id, [{ c: target.id }]);
    expect(a.tapped && b.tapped).toBe(true);
    expect(spell.manaSpent).toBe(1);
  });
  it('conditional dual lands produce colored mana only on entry turn or with a basic land', () => {
    const g = mk(),
      land = put(g, 0, 'dark-fortress');
    expect(canPayCost(g, 0, parseCost('{B}'))).toBe(true);
    g.turn++;
    expect(canPayCost(g, 0, parseCost('{B}'))).toBe(false);
    put(g, 0, 'plains');
    expect(canPayCost(g, 0, parseCost('{B}'))).toBe(true);
    void land;
  });
  it('five double-faced heroes can be cast on either face and transformed', () => {
    for (const name of ['Jennifer Walters', 'Monica Rambeau', 'Bruce Banner', 'Tony Stark', "King T'Challa"]) {
      const g = mk(),
        c = inHand(g, 0, slug(name));
      expect(castAlts(g, 0, c)).toContain('back');
      enterBattlefield(g, c, 0);
      expect(transformCard(g, c)).toBe(true);
      expect(c.front?.name).toBe(name);
    }
  });
  it('Wolverine heals previous marked damage before each new damage event', () => {
    const g = mk(),
      w = put(g, 0, 'wolverine-fierce-fighter'),
      src = put(g, 1, 'novice-inspector');
    dealDamage(g, src, 1, { c: w.id }, 3);
    dealDamage(g, src, 1, { c: w.id }, 4);
    expect(w.damage).toBe(4);
  });
  it('Captain America Living Legend only untaps the first tap of each creature in the turn', () => {
    const g = mk();
    put(g, 0, 'captain-america-living-legend');
    const c = put(g, 0, 'stark-industries-executive');
    lands(g, 0, 'mountain', 4);
    activate(g, c.id);
    resolve(g);
    settleAll(g);
    expect(c.tapped).toBe(false);
    activate(g, c.id);
    resolve(g);
    settleAll(g);
    expect(c.tapped).toBe(true);
  });
  it('Mister Fantastic triggers once for a simultaneous batch of tokens', () => {
    const g = mk();
    put(g, 0, 'mister-fantastic-reed-richards');
    const spell = inHand(g, 0, 'borough-backup');
    lands(g, 0, 'plains', 5);
    cast(g, spell.id);
    resolve(g);
    settleAll(g);
    expect(g.players[0].hand.length).toBe(1);
  });
  it('Zemo pays its black-symbol exile cost before the ability is on the stack', () => {
    const g = mk(),
      c = put(g, 0, 'baron-helmut-zemo');
    c.attackedTurn = g.turn;
    expect(canActivate(g, 0, c, 0)).toBe(false);
    const ids = Array.from({ length: 5 }, () => inGy(g, 0, 'vein-ripper').id);
    activate(g, c.id, 0, [], { costCards: ids });
    expect(ids.every((id) => g.cards[id].zone === 'exile')).toBe(true);
    expect(g.stack.at(-1)?.effects[0]).toMatchObject({ e: 'msh', action: '87', ids });
    expect(canActivate(g, 0, c, 0)).toBe(false);
  });
  it('Photon Blast Barrage copies its cast spell X times without recasting the copies', () => {
    const g = mk(),
      body = put(g, 1, 'topiary-panther'),
      spell = inHand(g, 0, 'photon-blast-barrage');
    lands(g, 0, 'mountain', 4);
    cast(g, spell.id, [{ c: body.id }], { x: 2 });
    settleAll(g);
    expect(body.damage).toBe(3);
    expect(g.stack).toHaveLength(0);
    expect(g.players[0].spellsThisTurn).toBe(1);
  });
  it('Hydraulic Helper mana may activate a nonartifact creature ability but cannot cast a nonartifact spell',()=>{const g=mk();put(g,0,'hydraulic-helper');const c=put(g,0,'stature-size-shifter');expect(canActivate(g,0,c,0)).toBe(true);expect(canPayCost(g,0,parseCost('{U}'),undefined,false,getDef('kid-loki'))).toBe(false);expect(canPayCost(g,0,parseCost('{U}'),undefined,false,getDef('super-suit'))).toBe(true);});

});
