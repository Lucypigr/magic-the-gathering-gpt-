import { poolSize } from '../src/meta/booster';
import { describe, it, expect } from 'vitest';
import { CARDS } from '../src/data';
import catalog from '../src/data/sets/mkm-catalog.json';
import { mk, put, inHand, inGy, lands, resolve, settleAll, answerDefault } from './helpers';
import { performAction, castAlts } from '../src/engine/actions';
import { runEffects } from '../src/engine/effects';
import { getDef } from '../src/engine/registry';
import { newCard, stats } from '../src/engine/state';
import { emit, enterBattlefield, dealDamage, moveCard } from '../src/engine/zones';
import { canBlock, declareAttackers, declareBlockers } from '../src/engine/combat';
import { putFaceDown, turnFaceUp } from '../src/engine/facedown';
import { payEvidence } from '../src/engine/mkm';
import type { GameState, Effect, TargetRef } from '../src/engine/types';
function effect(g: GameState, source: number, effects: Effect[], targets: TargetRef[] = [], x = 0) {
  const f = runEffects(g, { source, controller: 0, targets, x }, effects);
  let r = f.next();
  let n = 0;
  while (!r.done) {
    if (++n > 300) throw new Error('loop');
    r = f.next(answerDefault(g, r.value));
  }
}
const cast = (g: GameState, id: number, targets: (TargetRef | null)[] = [], extra: object = {}) =>
  expect(performAction(g, 0, { type: 'cast', card: id, targets, ...extra })).toBeNull();
describe('MKM complete main set', () => {
  it('Living Conundrum sets its base to 10/10 without erasing counters or pumps', () => {
    const g = mk(), c = put(g, 0, 'living-conundrum');
    g.players[0].library = [];
    effect(g, c.id, [{ e: 'counters', what: 'self', n: 1 }, { e: 'pump', what: 'self', p: 3, t: 3 }]);
    expect(stats(g, c).p).toBe(14);
    expect(stats(g, c).t).toBe(14);
  });
  it('Burden of Proof changes base power and toughness while retaining bonuses', () => {
    const g = mk(), c = put(g, 1, 'topiary-panther'), aura = put(g, 0, 'burden-of-proof');
    aura.attachedTo = c.id;
    effect(g, aura.id, [{ e: 'counters', what: 'T0', n: 1 }, { e: 'pump', what: 'T0', p: 3, t: 3 }], [{ c: c.id }]);
    expect(stats(g, c).p).toBe(5);
    expect(stats(g, c).t).toBe(5);
  });
  it('Demand Answers cannot discard itself as its additional cost', () => {
    const g = mk(), spell = inHand(g, 0, 'demand-answers');
    inHand(g, 0, 'novice-inspector');
    lands(g, 0, 'mountain', 2);
    expect(performAction(g, 0, { type: 'cast', card: spell.id, targets: [], mode: 0, discard: spell.id })).not.toBeNull();
    expect(spell.zone).toBe('hand');
    expect(g.battlefield.every(id => !g.cards[id].tapped)).toBe(true);
  });
  it('Demand Answers pays the chosen discard option even if an artifact ID is supplied', () => {
    const g = mk(), artifact = put(g, 0, 'tok-clue');
    const spell = inHand(g, 0, 'demand-answers'), spare = inHand(g, 0, 'novice-inspector');
    lands(g, 0, 'mountain', 2);
    cast(g, spell.id, [], { mode: 0, discard: spare.id, sac: artifact.id });
    expect(spare.zone).toBe('graveyard');
    expect(artifact.zone).toBe('battlefield');
  });
  it('Lost in the Maze grants hexproof even to a creature that lost its own abilities', () => {
    const g = mk();
    put(g, 0, 'lost-in-the-maze');
    const c = put(g, 0, 'novice-inspector');
    c.tapped = true;
    c.eclLoseAbilities = true;
    expect(stats(g, c).kw.has('hexproof')).toBe(true);
    c.tapped = false;
    expect(stats(g, c).kw.has('hexproof')).toBe(false);
  });
  it('contains all 271 main cards with printed characteristics and executable definitions', () => {
    expect(catalog).toHaveLength(271);
    expect(poolSize('MKM')).toBe(271);
    for (const row of catalog) {
      const d = CARDS.find((c) => c.name === row.name)!;
      expect(d, row.name).toBeDefined();
      expect(d.text).toBe(row.text);
      expect(d.types).toEqual(row.types);
      expect(d.power).toBe(row.power);
      expect(d.toughness).toBe(row.toughness);
      if (d.types.some((t) => t === 'Instant' || t === 'Sorcery')) expect(d.spell, row.name).toBeDefined();
    }
  });
  it('optional evidence is paid before the spell resolves, and Inspector gets its reward', () => {
    const g = mk(),
      gy = inGy(g, 0, 'topiary-panther'),
      c = inHand(g, 0, 'vitu-ghazi-inspector');
    lands(g, 0, 'forest', 2);
    expect(castAlts(g, 0, c)).toContain('evidence');
    cast(g, c.id, [], { alt: 'evidence', evidenceCards: [gy.id] });
    expect(gy.zone).toBe('exile');
    resolve(g);
    settleAll(g);
    expect(c.counters).toBe(1);
    expect(g.players[0].life).toBe(22);
  });
  it('invalid evidence payment consumes neither mana nor cards', () => {
    const g = mk(),
      gy = inGy(g, 0, 'novice-inspector'),
      c = inHand(g, 0, 'vitu-ghazi-inspector');
    lands(g, 0, 'forest', 2);
    expect(performAction(g, 0, { type: 'cast', card: c.id, targets: [], alt: 'evidence', evidenceCards: [gy.id] })).not.toBeNull();
    expect(gy.zone).toBe('graveyard');
    expect(g.battlefield.every((id) => !g.cards[id].tapped)).toBe(true);
  });
  it('evidence triggers Roots once for a simultaneous group of creature cards', () => {
    const g = mk();
    put(g, 0, 'insidious-roots');
    const src = put(g, 0, 'surveillance-monitor'),
      a = inGy(g, 0, 'novice-inspector'),
      b = inGy(g, 0, 'topiary-panther');
    payEvidence(g, 0, src, [a.id, b.id]);
    settleAll(g);
    const plants = g.battlefield.filter((id) => g.cards[id].def.id === 'tok-mkm-plant');
    expect(plants).toHaveLength(1);
    expect(g.cards[plants[0]].counters).toBe(1);
    expect(g.battlefield.some((id) => g.cards[id].def.id === 'tok-thopter')).toBe(true);
  });
  it('Cases solve only on their controller end step and enable solved effects', () => {
    const g = mk(),
      c = put(g, 0, 'case-of-the-filched-falcon');
    put(g, 0, 'magnifying-glass');
    put(g, 0, 'thinking-cap');
    put(g, 0, 'tok-clue');
    emit(g, { type: 'step', step: 'endStep', player: 1 });
    settleAll(g);
    expect(c.mkmSolved).toBeFalsy();
    emit(g, { type: 'step', step: 'endStep', player: 0 });
    settleAll(g);
    expect(c.mkmSolved).toBe(true);
    lands(g, 0, 'island', 3);
    const a = put(g, 0, 'magnifying-glass');
    expect(performAction(g, 0, { type: 'activate', card: c.id, ability: 0, targets: [{ c: a.id }] })).toBeNull();
    resolve(g);
    expect(stats(g, a).p).toBe(4);
    expect(stats(g, a).kw.has('flying')).toBe(true);
  });
  it('a solved Case leaving the battlefield loses its solved status', () => {
    const g = mk(),
      c = put(g, 0, 'case-of-the-stashed-skeleton');
    c.mkmSolved = true;
    moveCard(g, c, 'hand');
    expect(c.mkmSolved).toBeFalsy();
  });
  it('Doorkeeper Thrull suppresses creature and artifact entry triggers', () => {
    const g = mk();
    put(g, 0, 'doorkeeper-thrull');
    const c = newCard(g, getDef('novice-inspector'), 0);
    c.zone = 'exile';
    enterBattlefield(g, c, 0);
    settleAll(g);
    expect(g.battlefield.some((id) => g.cards[id].def.id === 'tok-clue')).toBe(false);
  });
  it('Delney doubles a small creature trigger and restricts larger blockers', () => {
    const g = mk();
    put(g, 0, 'delney-streetwise-lookout');
    const c = newCard(g, getDef('novice-inspector'), 0);
    c.zone = 'exile';
    enterBattlefield(g, c, 0);
    settleAll(g);
    expect(g.battlefield.filter((id) => g.cards[id].def.id === 'tok-clue')).toHaveLength(2);
    c.sick = false;
    declareAttackers(g, 0, [c.id]);
    const b = put(g, 1, 'topiary-panther');
    expect(canBlock(g, b, c)).toBe(false);
  });
  it('No More Lies exiles a countered spell', () => {
    const g = mk(),
      enemy = inHand(g, 1, 'novice-inspector');
    g.cards[enemy.id].zone = 'stack';
    g.stack.push({ sid: g.nextSid++, kind: 'spell', controller: 1, cardId: enemy.id, targets: [], targetSpecs: [], effects: [], text: '' });
    const c = inHand(g, 0, 'no-more-lies');
    lands(g, 0, 'plains', 1);
    lands(g, 0, 'island', 1);
    cast(g, c.id, [{ c: enemy.id }]);
    resolve(g);
    expect(enemy.zone).toBe('exile');
  });
  it('Coat cloaks and attaches to the actual top card without printed entry triggers', () => {
    const g = mk(),
      c = put(g, 0, 'cryptic-coat'),
      top = g.cards[g.players[0].library[0]];
    emit(g, { type: 'etb', card: c.id, controller: 0 });
    settleAll(g);
    expect(top.hidden?.id).toBe('plains');
    expect(c.attachedTo).toBe(top.id);
    expect(stats(g, top).p).toBe(3);
    expect(stats(g, top).kw.has('unblockable')).toBe(true);
  });
  it('Watchdog stops opponent face-up actions during its controller turn', () => {
    const g = mk();
    put(g, 0, 'karlov-watchdog');
    const c = inHand(g, 1, 'bubble-smuggler');
    putFaceDown(g, c, 1, true);
    expect(turnFaceUp(g, c)).toBe(false);
    expect(c.hidden).toBeDefined();
  });
  it('Bubble Smuggler places counters as it turns face up', () => {
    const g = mk(),
      c = inHand(g, 0, 'bubble-smuggler');
    putFaceDown(g, c, 0, true);
    expect(turnFaceUp(g, c)).toBe(true);
    expect(c.counters).toBe(4);
  });
  it('Massacre Girl grants wither to allied creatures', () => {
    const g = mk();
    put(g, 0, 'massacre-girl-known-killer');
    const c = put(g, 0, 'novice-inspector'),
      target = put(g, 1, 'topiary-panther');
    dealDamage(g, c, 0, { c: target.id }, 2);
    expect(target.counters).toBe(-2);
    expect(target.damage).toBe(0);
  });
  it('Slime counts owned Ooze and Slime cards in graveyard and exile', () => {
    const g = mk(),
      c = inHand(g, 0, 'slime-against-humanity');
    inGy(g, 0, 'slime-against-humanity');
    const a = inGy(g, 0, 'slime-against-humanity');
    moveCard(g, a, 'exile');
    effect(g, c.id, [{ e: 'mkm', action: '177' }]);
    expect(g.cards[g.battlefield[0]].counters).toBe(4);
  });
  it('Anzrag schedules another combat when blocked', () => {
    const g = mk(),
      a = put(g, 0, 'anzrag-the-quake-mole'),
      b = put(g, 1, 'novice-inspector');
    declareAttackers(g, 0, [a.id]);
    declareBlockers(g, 1, [[b.id, a.id]]);
    settleAll(g);
    expect(g.extraCombat?.player).toBe(0);
    expect(a.tapped).toBe(false);
  });
  it('Conspiracy Unraveler provides an evidence payment alternative', () => {
    const g = mk();
    put(g, 0, 'conspiracy-unraveler');
    inGy(g, 0, 'the-pride-of-hull-clade');
    const c = inHand(g, 0, 'novice-inspector');
    expect(castAlts(g, 0, c)).toContain('evidenceFree');
    cast(g, c.id, [], { alt: 'evidenceFree' });
    resolve(g);
    expect(c.zone).toBe('battlefield');
  });
  it('MKM split spells offer both halves and go to graveyard after the second half', () => {
    const g = mk(),
      c = inHand(g, 0, 'fuss-bother');
    lands(g, 0, 'island', 1);
    lands(g, 0, 'mountain', 1);
    lands(g, 0, 'plains', 4);
    expect(castAlts(g, 0, c)).toContain('adventure');
    cast(g, c.id, [], { alt: 'adventure' });
    resolve(g);
    expect(c.zone).toBe('graveyard');
    expect(c.onAdventure).toBeFalsy();
    expect(g.battlefield.filter((id) => g.cards[id].def.id === 'tok-thopter')).toHaveLength(3);
  });
});
