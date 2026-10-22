import { describe, expect, it } from 'vitest';
import catalog from '../src/data/sets/tmt-catalog.json';
import { CARDS, slug } from '../src/data';
import { poolSize } from '../src/meta/booster';
import { abilitiesFor, castAlts, canActivate, payCost, performAction } from '../src/engine/actions';
import { runEffects } from '../src/engine/effects';
import { parseCost } from '../src/engine/mana';
import { stats } from '../src/engine/state';
import { createToken, emit, moveCard, sacrifice } from '../src/engine/zones';
import { answerDefault, inGy, inHand, lands, mk, put, resolve, settleAll } from './helpers';
const sneakWindow = (g: ReturnType<typeof mk>) => {
  g.phase = 'combat_blockers';
  g.blockersDeclared = true;
};
const attacker = (g: ReturnType<typeof mk>) => {
  const c = put(g, 0, 'savannah-lions');
  c.attacking = true;
  c.tapped = true;
  return c;
};
describe('TMT catalog and mechanics', () => {
  it('covers all 190 base cards and the actual booster pool without duplicate IDs', () => {
    expect(catalog).toHaveLength(190);
    expect(poolSize('TMT')).toBe(190);
    for (const c of catalog)
      expect(
        CARDS.some((d) => d.id === slug(c.name)),
        c.name,
      ).toBe(true);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
  it('sneak requires an unblocked attacker after blockers, pays mana, then returns it and enters attacking', () => {
    const g = mk(),
      a = attacker(g),
      n = inHand(g, 0, 'leonardo-big-brother');
    expect(castAlts(g, 0, n)).not.toContain('sneak');
    sneakWindow(g);
    a.wasBlocked = true;
    expect(castAlts(g, 0, n)).not.toContain('sneak');
    a.wasBlocked = false;
    expect(performAction(g, 0, { type: 'cast', card: n.id, alt: 'sneak', sac: a.id, targets: [] })).not.toBeNull();
    expect(a.zone).toBe('battlefield');
    expect(n.zone).toBe('hand');
    lands(g, 0, 'plains', 1);
    expect(performAction(g, 0, { type: 'cast', card: n.id, alt: 'sneak', sac: a.id, targets: [] })).toBeNull();
    expect(a.zone).toBe('hand');
    expect(g.players[0].permanentLeftThisTurn).toBe(true);
    resolve(g);
    expect(n.zone).toBe('battlefield');
    expect(n.tapped && n.attacking).toBe(true);
    expect(n.sneakTurn).toBe(g.turn);
  });
  it('sneak permits a sorcery during combat and resolves its real effect', () => {
    const g = mk(),
      a = attacker(g),
      n = inHand(g, 0, 'donatellos-technique');
    sneakWindow(g);
    lands(g, 0, 'island', 1);
    expect(performAction(g, 0, { type: 'cast', card: n.id, alt: 'sneak', sac: a.id, targets: [] })).toBeNull();
    resolve(g);
    expect(g.players[0].hand).toHaveLength(3);
    expect(n.zone).toBe('graveyard');
  });
  it('disappear includes own artifacts leaving, but excludes the opponent’s permanents', () => {
    const g = mk(),
      m = put(g, 0, 'michelangelo-game-master'),
      op = put(g, 1, 'savannah-lions');
    moveCard(g, op, 'hand');
    expect(g.players[0].permanentLeftThisTurn).toBeFalsy();
    const clue = createToken(g, 'tok-clue', 0);
    sacrifice(g, clue);
    emit(g, { type: 'step', step: 'endStep', player: 0 });
    settleAll(g);
    expect(m.counters).toBe(1);
  });
  it('Mutagen is a sorcery-speed artifact ability, with token cost reduction and counter replacement', () => {
    const g = mk();
    put(g, 0, 'mutagen-man-living-ooze');
    put(g, 0, 'michelangelo-weirdness-to-11');
    const c = put(g, 0, 'savannah-lions'),
      token = createToken(g, 'tok-mutagen', 0);
    g.active = 1;
    expect(canActivate(g, 0, token, 0)).toBe(false);
    g.active = 0;
    expect(performAction(g, 0, { type: 'activate', card: token.id, ability: 0, targets: [{ c: c.id }] })).toBeNull();
    settleAll(g);
    expect(token.zone).toBe('graveyard');
    expect(c.counters).toBe(2);
  });
  it('Class levels resolve in order and gate later triggers', () => {
    const g = mk(),
      cls = put(g, 0, 'leaders-talent'),
      c = put(g, 0, 'savannah-lions');
    lands(g, 0, 'plains', 7);
    const abs = abilitiesFor(g, cls),
      l2 = abs.findIndex((a) => a.levelUp?.to === 2),
      l3 = abs.findIndex((a) => a.levelUp?.to === 3);
    expect(canActivate(g, 0, cls, l3)).toBe(false);
    expect(performAction(g, 0, { type: 'activate', card: cls.id, ability: l2, targets: [] })).toBeNull();
    expect(cls.classLevel).toBe(1);
    settleAll(g);
    expect(cls.classLevel).toBe(2);
    expect(performAction(g, 0, { type: 'activate', card: cls.id, ability: l3, targets: [] })).toBeNull();
    settleAll(g);
    expect(cls.classLevel).toBe(3);
    const spell = inHand(g, 0, 'divination');
    emit(g, { type: 'cast', card: spell.id, player: 0, opponentTurn: false });
    settleAll(g);
    expect(c.counters).toBe(1);
    moveCard(g, c, 'hand');
    settleAll(g);
    expect(g.players[0].life).toBe(22);
  });
  it('Ninja Teen grants graveyard sneak, while Sewer Samurai grants normal graveyard casting with finality', () => {
    const g = mk(),
      cls = put(g, 0, 'ninja-teen');
    cls.classLevel = 3;
    const a = attacker(g),
      c = inGy(g, 0, 'savannah-lions');
    sneakWindow(g);
    lands(g, 0, 'swamp', 4);
    expect(castAlts(g, 0, c)).toContain('sneak');
    expect(performAction(g, 0, { type: 'cast', card: c.id, alt: 'sneak', sac: a.id, targets: [] })).toBeNull();
    resolve(g);
    expect(c.attacking).toBe(true);
    const g2 = mk();
    put(g2, 0, 'leonardo-sewer-samurai');
    const weak = inGy(g2, 0, 'healers-hawk');
    lands(g2, 0, 'plains', 1);
    expect(performAction(g2, 0, { type: 'cast', card: weak.id, targets: [] })).toBeNull();
    resolve(g2);
    expect(weak.finality).toBe(true);
    sacrifice(g2, weak);
    expect(weak.zone).toBe('exile');
  });
  it('Splinter doubles Ninja entry triggers and Groundchuck supplies real extra land mana', () => {
    const g = mk();
    put(g, 0, 'splinter-radical-rat');
    const n = put(g, 0, 'foot-ninjas');
    emit(g, { type: 'etb', card: n.id, controller: 0 });
    settleAll(g);
    expect(g.players[0].life).toBe(26);
    const g2 = mk();
    put(g2, 0, 'groundchuck-dirtbag');
    const forest = put(g2, 0, 'forest');
    expect(payCost(g2, 0, parseCost('{G}{G}'))).toBe(true);
    expect(forest.tapped).toBe(true);
    expect(payCost(g2, 0, parseCost('{G}'))).toBe(false);
  });
  it('robot animation and counter inheritance retain real artifact counters', () => {
    const g = mk(),
      don = put(g, 0, 'donatello-mutant-mechanic'),
      clue = createToken(g, 'tok-clue', 0);
    expect(performAction(g, 0, { type: 'activate', card: don.id, ability: 0, targets: [{ c: clue.id }] })).toBeNull();
    settleAll(g);
    expect(stats(g, clue)).toMatchObject({ p: 3, t: 3 });
    expect(clue.def.types).toContain('Creature');
    sacrifice(g, clue);
    settleAll(g, (d) => (d.type === 'targets' ? { type: 'targets', targets: [{ c: don.id }] } : undefined));
    expect(don.counters).toBe(3);
  });
  it('declining an outside-game wish cleans up temporary candidates', () => {
    const g = mk(),
      c = put(g, 0, 'north-wind-avatar');
    const size = Object.keys(g.cards).length;
    const gen = runEffects(g, { source: c.id, controller: 0, targets: [] }, [{ e: 'tmt', action: 'wish' }]);
    let r = gen.next();
    while (!r.done) r = gen.next(answerDefault(g, r.value));
    expect(Object.keys(g.cards)).toHaveLength(size);
    expect(g.players[0].hand).toHaveLength(0);
  });
});
