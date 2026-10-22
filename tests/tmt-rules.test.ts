import { describe, expect, it } from 'vitest';
import catalog from '../src/data/sets/tmt-catalog.json';
import { CARDS, slug } from '../src/data';
import { abilitiesFor, castAlts, performAction, spellCost } from '../src/engine/actions';
import { runEffects } from '../src/engine/effects';
import { checkSBA, settle } from '../src/engine/flow';
import { createGame, newCard, stats } from '../src/engine/state';
import { getDef } from '../src/engine/registry';
import { legalTargets, validateTargets } from '../src/engine/targets';
import { combatDamage } from '../src/engine/combat';
import { createToken, discardMany, emit, enterBattlefield, moveCard, putCounters, sacrifice } from '../src/engine/zones';
import type { Effect, GameState, SubFlow } from '../src/engine/types';
import { answerDefault, inGy, inHand, lands, mk, put, resolve, settleAll, type Answer } from './helpers';
function drive(g: GameState, gen: SubFlow, custom?: Answer) {
  let r = gen.next();
  while (!r.done) r = gen.next(answerDefault(g, r.value, custom));
}
function effects(g: GameState, source: number, es: Effect[], targets: { c: number }[] = [], custom?: Answer) {
  drive(g, runEffects(g, { source, controller: g.cards[source].controller, targets }, es), custom);
}
function enter(g: GameState, id: string) {
  const c = newCard(g, getDef(id), 0);
  c.zone = 'exile';
  enterBattlefield(g, c, 0);
  return c;
}
describe('TMT full rules-text audit regressions', () => {
  it('preserves the full catalog text, costs, types, keywords and cycling of every TMT definition', () => {
    for (const row of catalog) {
      const d = CARDS.find((c) => c.id === slug(row.name))!;
      if (d.set !== 'TMT') continue;
      expect(d.text, row.name).toBe(row.text);
      expect(d.cost ?? '', row.name).toBe(row.cost);
      expect(d.types, row.name).toEqual(row.types);
      expect(d.power, row.name).toBe('power' in row ? row.power : undefined);
      expect(d.toughness, row.name).toBe('toughness' in row ? row.toughness : undefined);
      if ('cycling' in row) expect(d.cycling, row.name).toEqual(row.cycling);
    }
  });
  it('Action News Crew channels as a hand ability and High-Flying Ace has its sorcery ability', () => {
    const g = mk(),
      c = put(g, 0, 'savannah-lions'),
      news = inHand(g, 0, 'action-news-crew');
    lands(g, 0, 'plains', 6);
    expect(
      performAction(g, 0, {
        type: 'activate',
        card: news.id,
        ability: 0,
        targets: [],
      }),
    ).toBeNull();
    expect(news.zone).toBe('graveyard');
    resolve(g);
    expect(c.counters).toBe(1);
    const ace = put(g, 0, 'high-flying-ace');
    expect(abilitiesFor(g, ace)[0].sorcery).toBe(true);
  });
  it('Super Shredder counts any other permanent leaving, including opponent artifacts', () => {
    const g = mk(),
      s = put(g, 0, 'super-shredder'),
      a = createToken(g, 'tok-food', 1);
    moveCard(g, a, 'exile');
    settleAll(g);
    expect(s.counters).toBe(1);
  });
  it('Ooze Spill creates Mutagen after countering and Tunnel Rats can return from the graveyard', () => {
    const g = mk(),
      d = inHand(g, 1, 'divination');
    g.players[1].pool = ['U', 'U', 'U'];
    g.active = 1;
    expect(performAction(g, 1, { type: 'cast', card: d.id, targets: [] })).toBeNull();
    g.active = 0;
    const ooze = inHand(g, 0, 'ooze-spill');
    lands(g, 0, 'island', 3);
    expect(
      performAction(g, 0, {
        type: 'cast',
        card: ooze.id,
        targets: [{ c: d.id }],
      }),
    ).toBeNull();
    resolve(g);
    expect(d.zone).toBe('graveyard');
    expect(g.battlefield.some((id) => g.cards[id].def.id === 'tok-mutagen')).toBe(true);
    const rat = inGy(g, 0, 'tunnel-rats');
    lands(g, 0, 'swamp', 5);
    expect(
      performAction(g, 0, {
        type: 'activate',
        card: rat.id,
        ability: 0,
        targets: [],
      }),
    ).toBeNull();
    resolve(g);
    expect(rat.zone).toBe('battlefield');
    expect(rat.tapped).toBe(true);
  });
  it('Foot Mystic and Putrid Pals apply disappear, with counters present before entry triggers', () => {
    const g = mk();
    g.players[0].permanentLeftThisTurn = true;
    const pals = enter(g, 'putrid-pals');
    expect(pals.counters).toBe(2);
    enter(g, 'foot-mystic');
    settleAll(g);
    expect(g.battlefield.some((id) => g.cards[id].def.id === 'tok-tmt-ninja')).toBe(true);
  });
  it('South Wind Avatar gains the dying creature’s toughness, and Mouser Foundry triggers on leaving', () => {
    const g = mk();
    put(g, 0, 'south-wind-avatar');
    const c = put(g, 0, 'primordial-pachyderm');
    putCounters(g, c, 2);
    sacrifice(g, c);
    settleAll(g);
    expect(g.players[0].life).toBe(26);
    const foundry = put(g, 0, 'mouser-foundry');
    sacrifice(g, foundry);
    settleAll(g);
    expect(g.battlefield.some((id) => g.cards[id].def.id === 'tok-robot')).toBe(true);
  });
  it('Uneasy Alliance exiles the previously enchanted creature after sacrificing the Aura', () => {
    const g = mk(),
      a = put(g, 0, 'uneasy-alliance'),
      c = put(g, 1, 'savannah-lions');
    a.attachedTo = c.id;
    lands(g, 0, 'plains', 5);
    expect(
      performAction(g, 0, {
        type: 'activate',
        card: a.id,
        ability: 0,
        targets: [],
      }),
    ).toBeNull();
    expect(a.zone).toBe('graveyard');
    resolve(g);
    expect(c.zone).toBe('exile');
    expect(g.battlefield.some((id) => g.cards[id].def.id === 'tok-tmt-ninja')).toBe(true);
  });
  it('Bot Bashing Time exiles its victim and Lessons from Life puts the chosen land in tapped', () => {
    const g = mk(),
      victim = put(g, 1, 'primordial-pachyderm'),
      bot = inHand(g, 0, 'bot-bashing-time');
    lands(g, 0, 'mountain', 4);
    expect(
      performAction(g, 0, {
        type: 'cast',
        card: bot.id,
        targets: [{ c: victim.id }],
      }),
    ).toBeNull();
    resolve(g);
    checkSBA(g);
    expect(victim.zone).toBe('exile');
    const land = inHand(g, 0, 'forest'),
      src = put(g, 0, 'savannah-lions');
    effects(g, src.id, [{ e: 'landFromHand', tapped: true }], [], (d) =>
      d.type === 'choose' ? { type: 'choose', ids: [land.id] } : undefined,
    );
    expect(land.tapped).toBe(true);
  });
  it('Saved by the Shell costs one less while its caster controls a Turtle', () => {
    const g = mk(),
      c = inHand(g, 0, 'saved-by-the-shell');
    expect(spellCost(g, c, 0).generic).toBe(1);
    put(g, 0, 'leonardo-big-brother');
    expect(spellCost(g, c, 0).generic).toBe(0);
  });
  it('The Last Ronin chapter II selects targets after milling, chapter III waits for solo attacks', () => {
    const g = mk(),
      ronin = put(g, 0, 'the-last-ronin'),
      creature = inHand(g, 0, 'savannah-lions');
    moveCard(g, creature, 'library');
    effects(g, ronin.id, ronin.def.saga!.chapters[1].effects);
    expect(creature.zone).toBe('graveyard');
    expect(g.stack).toHaveLength(1);
    resolve(g);
    expect(creature.zone).toBe('hand');
    const solo = put(g, 0, 'primordial-pachyderm');
    effects(g, ronin.id, ronin.def.saga!.chapters[2].effects);
    expect(solo.counters).toBe(0);
    emit(g, { type: 'youAttack', player: 0, attackers: [solo.id] });
    settleAll(g);
    expect(solo.counters).toBe(3);
    expect(stats(g, solo).kw.has('indestructible')).toBe(true);
  });
  it('Does Machines upgrade triggers separately and targets graveyard artifacts on the stack', () => {
    const g = mk(),
      cls = put(g, 0, 'does-machines'),
      a = inGy(g, 0, 'skateboard');
    lands(g, 0, 'island', 2);
    const idx = abilitiesFor(g, cls).findIndex((a) => a.levelUp?.to === 2);
    expect(
      performAction(g, 0, {
        type: 'activate',
        card: cls.id,
        ability: idx,
        targets: [],
      }),
    ).toBeNull();
    resolve(g);
    expect(cls.classLevel).toBe(2);
    expect(a.zone).toBe('graveyard');
    expect(g.pending).toHaveLength(1);
    settleAll(g, (d) => (d.type === 'targets' ? { type: 'targets', targets: [{ c: a.id }, null] } : undefined));
    expect(a.zone).toBe('hand');
  });
  it('Lita chooses modes when triggers go on the stack and cannot repeat them before resolution', () => {
    const g = mk(),
      lita = put(g, 0, 'lita-little-orphan-amphibian'),
      c = put(g, 0, 'savannah-lions');
    for (let i = 0; i < 4; i++) emit(g, { type: 'etb', card: c.id, controller: 0 });
    drive(g, settle(g));
    expect(g.stack).toHaveLength(3);
    expect(lita.classModesTurn?.modes).toEqual([0, 1, 2]);
  });
  it('Ninja Teen and Leader’s Talent include themselves when they are creatures', () => {
    const g = mk(),
      cls = put(g, 0, 'ninja-teen');
    cls.def = {
      ...cls.def,
      types: [...cls.def.types, 'Creature'],
      power: 1,
      toughness: 1,
    };
    moveCard(g, cls, 'hand');
    settleAll(g);
    expect(g.players[1].life).toBe(19);
  });
  it('Mikey and Venus recognize non-plus counters, and Mikey & Leo excludes noncreatures', () => {
    const g = mk();
    put(g, 0, 'michelangelo-mutant-bff');
    const c = put(g, 0, 'savannah-lions');
    c.stun = 1;
    expect(stats(g, c).onlyOneBlocker).toBe(true);
    put(g, 0, 'mikey-leo-chaos-order');
    const clue = createToken(g, 'tok-clue', 0);
    putCounters(g, clue, 1);
    expect(g.pending).toHaveLength(0);
    putCounters(g, c, 1);
    expect(g.pending).toHaveLength(1);
  });
  it('Brilliance Unleashed returns animated artifacts as creatures before entry events', () => {
    const g = mk();
    put(g, 0, 'mighty-mutanimals');
    const a = inGy(g, 0, 'skateboard'),
      src = put(g, 0, 'savannah-lions');
    effects(g, src.id, [{ e: 'tmt', action: 'brilliance' }], [{ c: a.id }]);
    expect(stats(g, a).p).toBe(3);
    expect(stats(g, a).kw.has('flying')).toBe(true);
    expect(g.pending.some((t) => t.source !== src.id && t.ev.type === 'etb' && t.ev.card === a.id)).toBe(true);
  });
  it('Retro-Mutation applies immediately, removes creature types, and preserves counters', () => {
    const g = mk(),
      c = put(g, 1, 'primordial-pachyderm');
    c.counters = 2;
    const aura = inHand(g, 0, 'retro-mutation');
    lands(g, 0, 'island', 3);
    expect(
      performAction(g, 0, {
        type: 'cast',
        card: aura.id,
        targets: [{ c: c.id }],
      }),
    ).toBeNull();
    resolve(g);
    expect(c.def.subtypes).toEqual(['Turtle']);
    expect(stats(g, c)).toMatchObject({ p: 2, t: 3, cantAttack: true });
    expect(stats(g, c).kw.has('trample')).toBe(false);
    moveCard(g, aura, 'graveyard');
    expect(stats(g, c).p).toBe(6);
  });
  it('Kitsune requires different controllers, while Karai’s two modes may target the same creature', () => {
    const g = mk(),
      k = put(g, 0, 'kitsune-dragons-daughter'),
      a = put(g, 0, 'savannah-lions'),
      b = put(g, 0, 'primordial-pachyderm');
    const specs = k.def.abilities!.find((a) => a.kind === 'trigger')!.targets!;
    expect(validateTargets(g, specs, [{ c: a.id }, { c: b.id }], 0, k.id)).not.toBeNull();
    const spell = inHand(g, 0, 'karais-technique');
    expect(validateTargets(g, spell.def.spell!.modes![2].targets!, [{ c: a.id }, { c: a.id }], 0, spell.id)).toBeNull();
  });
  it('Fugitive Droid can only target spells targeting its controller’s artifact or creature', () => {
    const g = mk(),
      droid = put(g, 0, 'fugitive-droid'),
      spell = inHand(g, 1, 'divination');
    g.active = 1;
    lands(g, 1, 'island', 3);
    expect(performAction(g, 1, { type: 'cast', card: spell.id, targets: [] })).toBeNull();
    const spec = abilitiesFor(g, droid)[0].targets![0];
    expect(legalTargets(g, spec, 0, droid.id)).toEqual([]);
  });
  it('Mondo Gecko retains hexproof from every chosen color this turn', () => {
    const g = mk(),
      c = put(g, 0, 'mondo-gecko');
    effects(g, c.id, [{ e: 'tmt', action: 'mondo' }], [], (d) => (d.type === 'mode' ? { type: 'modes', picks: [1] } : undefined));
    effects(g, c.id, [{ e: 'tmt', action: 'mondo' }], [], (d) => (d.type === 'mode' ? { type: 'modes', picks: [3] } : undefined));
    expect(c.colorProtections?.map((p) => p.color)).toEqual(['U', 'R']);
  });
  it('Pain 101 grants a real death trigger, which Splinter doubles for a Ninja', () => {
    const g = mk();
    put(g, 0, 'splinter-radical-rat');
    const c = put(g, 0, 'foot-ninjas');
    effects(g, c.id, [{ e: 'tmt', action: 'returnOnDeath' }], [{ c: c.id }]);
    sacrifice(g, c);
    expect(g.pending.filter((t) => t.ability.on === 'dies')).toHaveLength(2);
    settleAll(g);
    expect(c.zone).toBe('battlefield');
    expect(c.tapped).toBe(true);
  });
  it('outside-game wishes only access cards actually owned outside this game', () => {
    const g = createGame(
      {
        name: 'A',
        deckName: '',
        deck: [],
        isAI: true,
        outside: ['savannah-lions'],
      },
      { name: 'B', deckName: '', deck: [], isAI: true },
    );
    const src = put(g, 0, 'north-wind-avatar'),
      id = g.players[0].outside[0];
    effects(g, src.id, [{ e: 'tmt', action: 'wish' }], [], (d) => (d.type === 'choose' ? { type: 'choose', ids: [id] } : undefined));
    expect(g.players[0].outside).toEqual([]);
    expect(g.players[0].hand).toEqual([id]);
    const empty = mk(),
      src2 = put(empty, 0, 'turtles-forever');
    const count = Object.keys(empty.cards).length;
    effects(empty, src2.id, [{ e: 'tmt', action: 'forever' }]);
    expect(Object.keys(empty.cards)).toHaveLength(count);
  });
  it('crew and Rat King payments accept player choices and reject duplicates before mana or taps', () => {
    const g = mk(),
      van = put(g, 0, 'turtle-van'),
      a = put(g, 0, 'savannah-lions'),
      b = put(g, 0, 'primordial-pachyderm');
    const idx = abilitiesFor(g, van).findIndex((x) => x.cost.crew !== undefined);
    expect(
      performAction(g, 0, {
        type: 'activate',
        card: van.id,
        ability: idx,
        targets: [],
        costCards: [a.id, a.id],
      }),
    ).not.toBeNull();
    expect(a.tapped).toBe(false);
    expect(
      performAction(g, 0, {
        type: 'activate',
        card: van.id,
        ability: idx,
        targets: [],
        costCards: [a.id],
      }),
    ).toBeNull();
    resolve(g);
    expect(
      performAction(g, 0, {
        type: 'activate',
        card: van.id,
        ability: idx,
        targets: [],
        costCards: [b.id],
      }),
    ).toBeNull();
    expect(van.crewedBy).toEqual([a.id, b.id]);
  });
  it('Ray Fillet removes the counter from the chosen creature', () => {
    const g = mk(),
      ray = put(g, 0, 'ray-fillet-man-ray'),
      a = put(g, 0, 'savannah-lions'),
      b = put(g, 0, 'primordial-pachyderm');
    a.counters = 1;
    b.counters = 1;
    lands(g, 0, 'island', 2);
    const idx = abilitiesFor(g, ray).findIndex((a) => a.removeCounter?.fromCreature);
    expect(
      performAction(g, 0, {
        type: 'activate',
        card: ray.id,
        ability: idx,
        targets: [],
        counterCard: b.id,
      }),
    ).toBeNull();
    expect(a.counters).toBe(1);
    expect(b.counters).toBe(0);
  });
  it('Cool but Rude triggers once for every card discarded simultaneously', () => {
    const g = mk(),
      cls = put(g, 0, 'cool-but-rude');
    cls.classLevel = 2;
    const a = inHand(g, 0, 'plains'),
      b = inHand(g, 0, 'island');
    discardMany(g, [a, b]);
    settleAll(g);
    expect(g.players[1].life).toBe(16);
  });
  it('Ninja Teen offers both native and granted sneak costs', () => {
    const g = mk(),
      cls = put(g, 0, 'ninja-teen');
    cls.classLevel = 3;
    const a = put(g, 0, 'savannah-lions');
    a.attacking = true;
    g.phase = 'combat_blockers';
    g.blockersDeclared = true;
    const n = inGy(g, 0, 'leonardo-big-brother');
    expect(castAlts(g, 0, n)).toEqual(expect.arrayContaining(['sneak', 'sneakGranted']));
  });
  it('Katana triggers once when combat damage is split among blockers', () => {
    const g = mk(),
      a = put(g, 0, 'primordial-pachyderm'),
      kat = put(g, 0, 'quintessential-katana'),
      b = put(g, 1, 'savannah-lions'),
      c = put(g, 1, 'savannah-lions');
    kat.attachedTo = a.id;
    a.attacking = true;
    a.wasBlocked = true;
    a.blockedBy = [b.id, c.id];
    b.blocking = a.id;
    c.blocking = a.id;
    combatDamage(g, 'all');
    expect(g.pending.filter((t) => t.ability.on === 'combatDamageAny')).toHaveLength(1);
  });
  it('TMT ward is an optional triggered payment; spells can target it with no spare mana', () => {
    const g = mk(),
      frog = put(g, 1, 'punk-frogs'),
      bolt = inHand(g, 0, 'manhole-missile');
    lands(g, 0, 'mountain', 2);
    expect(
      performAction(g, 0, {
        type: 'cast',
        card: bolt.id,
        targets: [{ c: frog.id }],
      }),
    ).toBeNull();
    expect(g.pending.some((t) => t.ability.effects.some((e) => e.e === 'tmt' && e.action === 'ward'))).toBe(true);
    settleAll(g);
    expect(bolt.zone).toBe('graveyard');
    expect(frog.damage).toBe(0);
    const g2 = mk(),
      f2 = put(g2, 1, 'punk-frogs'),
      b2 = inHand(g2, 0, 'manhole-missile');
    b2.def = { ...b2.def, uncounterable: true };
    lands(g2, 0, 'mountain', 2);
    expect(
      performAction(g2, 0, {
        type: 'cast',
        card: b2.id,
        targets: [{ c: f2.id }],
      }),
    ).toBeNull();
    settleAll(g2);
    expect(f2.damage).toBe(3);
  });
  it('ward can counter an activated ability without removing its source permanent', () => {
    const g = mk(),
      frog = put(g, 1, 'punk-frogs'),
      maker = put(g, 0, 'weather-maker');
    maker.charge = 3;
    const idx = abilitiesFor(g, maker).findIndex((a) => !!a.targets?.length);
    expect(
      performAction(g, 0, {
        type: 'activate',
        card: maker.id,
        ability: idx,
        targets: [{ c: frog.id }],
      }),
    ).toBeNull();
    settleAll(g);
    expect(frog.damage).toBe(0);
    expect(maker.zone).toBe('battlefield');
    expect(maker.charge).toBe(0);
  });
  it('The Ooze really exiles a graveyard card, and Turtles in Time really exiles itself', () => {
    const g = mk(),
      ooze = put(g, 0, 'the-ooze'),
      dead = inGy(g, 1, 'savannah-lions');
    expect(
      performAction(g, 0, {
        type: 'activate',
        card: ooze.id,
        ability: 0,
        targets: [{ c: dead.id }],
      }),
    ).toBeNull();
    resolve(g);
    expect(dead.zone).toBe('exile');
    const spell = inHand(g, 0, 'turtles-in-time');
    g.players[0].pool = ['U', 'U', 'U', 'U', 'U', 'U', 'U'];
    expect(performAction(g, 0, { type: 'cast', card: spell.id, targets: [] })).toBeNull();
    resolve(g, (d) => (d.type === 'yesno' ? { type: 'yesno', yes: false } : undefined));
    expect(spell.zone).toBe('exile');
  });
  it('North Wind Avatar recognizes a cast entry, then does not wish again after a blink', () => {
    const g = mk(),
      n = inHand(g, 0, 'north-wind-avatar');
    g.players[0].pool = ['U', 'U', 'U', 'U', 'R'];
    expect(performAction(g, 0, { type: 'cast', card: n.id, targets: [] })).toBeNull();
    resolve(g);
    expect(g.pending).toHaveLength(1);
    settleAll(g);
    moveCard(g, n, 'exile');
    enterBattlefield(g, n, 0);
    expect(g.pending).toHaveLength(0);
  });
  it('Raphael grants a choice at actual play time and permits only one of the linked cards', () => {
    const g = mk(),
      raph = put(g, 0, 'raphael-most-attitude');
    effects(g, raph.id, [
      { e: 'tmt', action: 'raphExile' },
      { e: 'tmt', action: 'raphExile' },
      { e: 'tmt', action: 'raphPlay' },
    ]);
    const ids = g.players[0].exile.slice();
    expect(ids).toHaveLength(2);
    expect(castAlts(g, 0, g.cards[ids[0]])).toContain(undefined);
    expect(castAlts(g, 0, g.cards[ids[1]])).toContain(undefined);
    expect(performAction(g, 0, { type: 'play', card: ids[1] })).toBeNull();
    expect(castAlts(g, 0, g.cards[ids[0]])).toEqual([]);
  });
  it('Robot animation puts counters on the noncreature artifact before animating it', () => {
    const g = mk();
    put(g, 0, 'michelangelo-weirdness-to-11');
    const don = put(g, 0, 'donatello-mutant-mechanic'),
      clue = createToken(g, 'tok-clue', 0);
    effects(g, don.id, [{ e: 'tmt', action: 'robot', n: 3 }], [{ c: clue.id }]);
    expect(clue.counters).toBe(3);
  });
  it('Rat King creates a normal Rat that can block', () => {
    const g = mk(),
      king = put(g, 0, 'rat-king-verminister');
    g.players[0].permanentLeftThisTurn = true;
    emit(g, { type: 'step', step: 'endStep', player: 0 });
    settleAll(g);
    const rat = g.battlefield.map((id) => g.cards[id]).find((c) => c.def.id === 'tok-tmt-rat')!;
    expect(rat).toBeDefined();
    expect(stats(g, rat).cantBlock).toBe(false);
    expect(king.counters).toBe(1);
  });
  it('a blinked creature is a new object and cannot be hit by an old targeted spell', () => {
    const g = mk(),
      c = put(g, 1, 'primordial-pachyderm'),
      missile = inHand(g, 0, 'manhole-missile');
    lands(g, 0, 'mountain', 2);
    expect(
      performAction(g, 0, {
        type: 'cast',
        card: missile.id,
        targets: [{ c: c.id }],
      }),
    ).toBeNull();
    moveCard(g, c, 'exile');
    enterBattlefield(g, c, 1);
    resolve(g);
    expect(c.damage).toBe(0);
  });
  it('sneak entry bonuses and Class triggers still resolve after their source leaves', () => {
    const g = mk(),
      leo = put(g, 0, 'leonardo-leader-in-blue'),
      c = put(g, 0, 'savannah-lions');
    leo.sneakTurn = g.turn;
    emit(g, { type: 'etb', card: leo.id, controller: 0 });
    moveCard(g, leo, 'hand');
    settleAll(g);
    expect(stats(g, c).p).toBe(4);
    const cls = put(g, 0, 'leaders-talent');
    cls.classLevel = 3;
    const sp = inHand(g, 0, 'divination');
    emit(g, { type: 'cast', card: sp.id, player: 0, opponentTurn: false });
    moveCard(g, cls, 'hand');
    settleAll(g);
    expect(c.counters).toBe(1);
  });
  it('a reentered Raphael cannot play cards linked to its previous incarnation', () => {
    const g = mk(),
      raph = put(g, 0, 'raphael-most-attitude');
    effects(g, raph.id, [{ e: 'tmt', action: 'raphExile' }]);
    const id = g.players[0].exile[0];
    moveCard(g, raph, 'hand');
    enterBattlefield(g, raph, 0);
    effects(g, raph.id, [{ e: 'tmt', action: 'raphPlay' }]);
    expect(castAlts(g, 0, g.cards[id])).toEqual([]);
  });
  it('each nonlegendary Splinter copy adds a separate Ninja trigger', () => {
    const g = mk();
    put(g, 0, 'splinter-radical-rat');
    const copy = put(g, 0, 'splinter-radical-rat');
    copy.def = { ...copy.def, supertypes: [] };
    const n = put(g, 0, 'foot-ninjas');
    emit(g, { type: 'etb', card: n.id, controller: 0 });
    settleAll(g);
    expect(g.players[0].life).toBe(29);
  });
  it('April Hacktivist draws for distinct card types among spells cast this turn',()=>{
    const g=mk();put(g,0,'april-oneil-hacktivist');g.players[0].spellTypesThisTurn=['Creature','Artifact','Instant'];
    emit(g,{type:'step',step:'endStep',player:0});settleAll(g);expect(g.players[0].hand).toHaveLength(3);
  });

});
