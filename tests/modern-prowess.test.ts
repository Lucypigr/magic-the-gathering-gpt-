import { describe, it, expect } from 'vitest';
import { CARDS, slug } from '../src/data';
import catalog from '../src/data/sets/modern-prowess-catalog.json';
import { performAction, castAlts, castOptionsFor, spellCost, frontierStackChoices } from '../src/engine/actions';
import { stats } from '../src/engine/state';
import { manaValue, colorsOf } from '../src/engine/mana';
import { moveCard, emit } from '../src/engine/zones';
import { settle } from '../src/engine/flow';
import { canBlock, declareAttackers } from '../src/engine/combat';
import { mk, put, inHand, inGy, lands, resolve, settleAll, answerDefault, type Answer } from './helpers';
import type { TargetRef } from '../src/engine/types';
const activate = (g: ReturnType<typeof mk>, c: ReturnType<typeof put>, targets: TargetRef[] = [], n = 0) => performAction(g, c.controller, { type: 'activate', card: c.id, ability: n, targets });
function triggers(g: ReturnType<typeof mk>) { const gen = settle(g); let r = gen.next(); while (!r.done) r = gen.next(answerDefault(g, r.value)); }
const cast = (g: ReturnType<typeof mk>, c: ReturnType<typeof inHand>, targets: TargetRef[] = [], extra = {}) => performAction(g, c.owner, { type: 'cast', card: c.id, targets, ...extra });

describe('Modern prowess batch: source and individual effects', () => {
  it.each(catalog)('$name matches its pinned printed characteristics and rules', row => {
    const c = CARDS.find(c => c.id === slug(row.name))!;
    expect(c, row.name).toBeDefined();
    for (const k of ['cost', 'types', 'subtypes', 'supertypes', 'colors', 'text'] as const) expect(k === 'colors' ? colorsOf(c) : c[k], k).toEqual(row[k]);
    if ('power' in row) { expect(c.power).toBe(row.power); expect(c.toughness).toBe(row.toughness); }
    if ('adventure' in row) expect(c.adventure?.text).toBe(row.adventure!.text);
  });
  it.each(['Arid Mesa', 'Bloodstained Mire', 'Scalding Tarn', 'Wooded Foothills'])('%s pays life and sacrifices itself, then searches a matching land', name => {
    const g = mk(), fetch = put(g, 0, slug(name)), basic = inHand(g, 0, 'mountain'); moveCard(g, basic, 'library');
    expect(activate(g, fetch)).toBeNull(); expect(fetch.zone).toBe('graveyard'); expect(g.players[0].life).toBe(19);
    resolve(g, d => d.type === 'choose' && d.purpose === 'tutor' ? { type: 'choose', ids: [basic.id] } : undefined);
    expect(basic.zone).toBe('battlefield'); expect(basic.tapped).toBe(false);
  });
  it('a fetch may search a nonbasic with a matching basic land type', () => {
    const g = mk(), fetch = put(g, 0, 'arid-mesa'), dual = inHand(g, 0, 'steam-vents'); moveCard(g, dual, 'library');
    expect(activate(g, fetch)).toBeNull(); resolve(g, d => d.type === 'choose' && d.purpose === 'tutor' ? { type: 'choose', ids: [dual.id] } : undefined); settleAll(g);
    expect(dual.zone).toBe('battlefield');
  });
  it('Lightning Bolt and Lava Dart deal their printed amounts', () => {
    for (const [name, n] of [['lightning-bolt', 3], ['lava-dart', 1]] as const) {
      const g = mk(), c = inHand(g, 0, name); lands(g, 0, 'mountain', 1);
      expect(cast(g, c, [{ p: 1 }])).toBeNull(); resolve(g); expect(g.players[1].life).toBe(20 - n);
    }
  });
  it('Lava Dart flashback sacrifices a Mountain, keeps mana value one, and exiles after resolution', () => {
    const g = mk(), c = inGy(g, 0, 'lava-dart'), mountain = put(g, 0, 'mountain');
    expect(castAlts(g, 0, c)).toContain('flashback');
    expect(cast(g, c, [{ p: 1 }], { alt: 'flashback', sac: mountain.id })).toBeNull();
    expect(mountain.zone).toBe('graveyard'); expect(manaValue(c.castFace!)).toBe(1);
    resolve(g); expect(c.zone).toBe('exile'); expect(g.players[1].life).toBe(19);
  });
  it('a countered Lava Dart flashback is also exiled', () => {
    const g = mk(), c = inGy(g, 0, 'lava-dart'), mountain = put(g, 0, 'mountain');
    expect(cast(g, c, [{ p: 1 }], { alt: 'flashback', sac: mountain.id })).toBeNull();
    const counter = inHand(g, 1, 'negate'); lands(g, 1, 'island', 2);
    expect(cast(g, counter, [{ c: c.id }])).toBeNull(); resolve(g); expect(c.zone).toBe('exile');
  });
  it('Mutagenic Growth requires green mana or the explicitly selected two life', () => {
    const g = mk(), body = put(g, 0, 'brave-kin-duo'), c = inHand(g, 0, 'mutagenic-growth'), base = stats(g, body);
    expect(manaValue(c.def)).toBe(1); expect(cast(g, c, [{ c: body.id }])).not.toBeNull(); expect(g.players[0].life).toBe(20);
    expect(cast(g, c, [{ c: body.id }], { alt: 'modernLife' })).toBeNull(); expect(g.players[0].life).toBe(18); expect(manaValue(c.castFace!)).toBe(1);
    resolve(g); expect(stats(g, body).p).toBe(base.p + 2); expect(stats(g, body).t).toBe(base.t + 2);
    const other = inHand(g, 0, 'mutagenic-growth'); lands(g, 0, 'forest', 1);
    expect(cast(g, other, [{ c: body.id }])).toBeNull(); expect(g.players[0].life).toBe(18);
  });
  it('cannot pay two life with only one life remaining', () => {
    const g = mk(), body = put(g, 0, 'brave-kin-duo'), c = inHand(g, 0, 'mutagenic-growth'); g.players[0].life = 1;
    expect(castAlts(g, 0, c)).not.toContain('modernLife'); expect(cast(g, c, [{ c: body.id }], { alt: 'modernLife' })).not.toBeNull();
    expect(c.zone).toBe('hand'); expect(g.players[0].life).toBe(1);
  });
  it('Assault Strobe grants double strike only until end of turn', () => {
    const g = mk(), body = put(g, 0, 'brave-kin-duo'), c = inHand(g, 0, 'assault-strobe'); lands(g, 0, 'mountain', 1);
    expect(cast(g, c, [{ c: body.id }])).toBeNull(); resolve(g); expect(stats(g, body).kw.has('double_strike')).toBe(true);
    g.eot = []; expect(stats(g, body).kw.has('double_strike')).toBe(false);
  });
  it('Preordain scries before drawing, so a bottomed top card is not drawn', () => {
    const g = mk(), c = inHand(g, 0, 'preordain'); lands(g, 0, 'island', 1); const top = g.players[0].library.slice(0, 2), before = g.players[0].hand.length;
    expect(cast(g, c)).toBeNull(); resolve(g, d => d.type === 'choose' && d.purpose === 'scryBottom' ? { type: 'choose', ids: [top[0]] } : undefined);
    expect(g.cards[top[1]].zone).toBe('hand'); expect(g.cards[top[0]].zone).toBe('library'); expect(g.players[0].hand.length).toBe(before);
  });
  it('Expressive Iteration assigns three distinct cards to hand, bottom and exile', () => {
    const g = mk(), c = inHand(g, 0, 'expressive-iteration'); g.players[0].pool = ['U', 'R']; const top = g.players[0].library.slice(0, 3);
    expect(cast(g, c)).toBeNull(); resolve(g);
    expect(g.cards[top[0]].zone).toBe('hand'); expect(g.players[0].library.at(-1)).toBe(top[1]); expect(g.cards[top[2]].zone).toBe('exile');
    expect(performAction(g, 0, { type: 'play', card: top[2] })).toBeNull();
  });
  it('Iteration permission expires after the current turn', () => {
    const g = mk(), c = inHand(g, 0, 'expressive-iteration'); g.players[0].pool = ['U', 'R']; const exile = g.players[0].library[2];
    expect(cast(g, c)).toBeNull(); resolve(g); g.turn += 2;
    expect(performAction(g, 0, { type: 'play', card: exile })).not.toBeNull();
  });
  it('Bauble looks at the target top card but draws only at the next upkeep', () => {
    const g = mk(), c = put(g, 0, 'mishras-bauble'), n = g.players[0].hand.length;
    expect(activate(g, c, [{ p: 1 }])).toBeNull(); resolve(g); expect(g.players[0].hand.length).toBe(n); expect(c.zone).toBe('graveyard');
    g.active = 1; g.turn++; emit(g, { type: 'step', step: 'upkeep', player: 1 }); settleAll(g); expect(g.players[0].hand.length).toBe(n + 1);
    g.turn++; emit(g, { type: 'step', step: 'upkeep', player: 0 }); settleAll(g); expect(g.players[0].hand.length).toBe(n + 1);
  });
  it('Crypt exiles only the selected graveyard', () => {
    const g = mk(), c = put(g, 0, 'tormods-crypt'), ours = inGy(g, 0, 'opt'), theirs = inGy(g, 1, 'opt');
    expect(activate(g, c, [{ p: 1 }])).toBeNull(); resolve(g); expect(theirs.zone).toBe('exile'); expect(ours.zone).toBe('graveyard'); expect(c.zone).toBe('graveyard');
  });
  it('Fiery Islet pays life for colored mana and has a separate sacrifice draw ability', () => {
    const g = mk(), c = put(g, 0, 'fiery-islet');
    expect(activate(g, c)).toBeNull(); settleAll(g); expect(g.players[0].life).toBe(19); expect(g.players[0].pool).toContain('U');
    c.tapped = false; const n = g.players[0].hand.length;
    expect(activate(g, c, [], 2)).toBeNull(); resolve(g); expect(c.zone).toBe('graveyard'); expect(g.players[0].hand.length).toBe(n + 1); expect(g.players[0].life).toBe(19);
  });
  it('Channeler surveils for noncreature casts, gains delirium and must attack', () => {
    const g = mk(), c = put(g, 0, 'dragons-rage-channeler'), spell = inHand(g, 0, 'lightning-bolt'); lands(g, 0, 'mountain', 1); const top = g.players[0].library[0];
    expect(cast(g, spell, [{ p: 1 }])).toBeNull(); settleAll(g, d => d.type === 'choose' && d.purpose === 'surveilGy' ? { type: 'choose', ids: [top] } : undefined);
    expect(g.cards[top].zone).toBe('graveyard'); inGy(g, 0, 'mishras-bauble'); inGy(g, 0, 'brave-kin-duo');
    expect(stats(g, c).p).toBe(3); expect(stats(g, c).kw.has('flying')).toBe(true); expect(declareAttackers(g, 0, []).map(c => c.id)).toContain(c.id);
  });
  it('Unholy Heat uses delirium at resolution', () => {
    const g = mk(), target = put(g, 1, 'armament-dragon'), c = inHand(g, 0, 'unholy-heat'); lands(g, 0, 'mountain', 1);
    expect(cast(g, c, [{ c: target.id }])).toBeNull();
    for (const id of ['opt', 'forest', 'mishras-bauble', 'brave-kin-duo']) inGy(g, 0, id);
    settleAll(g); expect(target.zone).toBe('graveyard');
  });
  it('Murktide delves only generic mana, enters with spell-card counters, then watches later graveyard departures', () => {
    const g = mk(), old = put(g, 0, 'murktide-regent'), c = inHand(g, 0, 'murktide-regent');
    const cards = ['opt', 'lightning-bolt', 'forest', 'mishras-bauble', 'brave-kin-duo'].map(id => inGy(g, 0, id)); g.players[0].pool = ['U', 'U'];
    expect(castOptionsFor(g, 0, c).length).toBeGreaterThan(0);
    expect(cast(g, c, [], { orbitDelve: cards.map(c => c.id) })).toBeNull(); expect(cards.every(c => c.zone === 'exile')).toBe(true);
    settleAll(g); expect(c.zone).toBe('battlefield'); expect(c.counters).toBe(2); expect(old.counters).toBe(2);
    const later = inGy(g, 0, 'opt'); moveCard(g, later, 'hand'); settleAll(g); expect(c.counters).toBe(3); expect(old.counters).toBe(3);
  });
  it('delve cannot replace blue mana and a rejected cast leaves its graveyard untouched', () => {
    const g = mk(), c = inHand(g, 0, 'murktide-regent'), cards = Array.from({ length: 5 }, () => inGy(g, 0, 'opt')); g.players[0].pool = ['U'];
    expect(cast(g, c, [], { orbitDelve: cards.map(c => c.id) })).not.toBeNull(); expect(cards.every(c => c.zone === 'graveyard')).toBe(true);
  });
  it('Obsidian Charmaw counts tapped and untapped colorless-producing enemy lands', () => {
    const g = mk(), a = put(g, 1, 'soulstone-sanctuary'), b = put(g, 1, 'soulstone-sanctuary'), c = inHand(g, 0, 'obsidian-charmaw'); b.tapped = true;
    expect(spellCost(g, c, 0).generic).toBe(1); g.players[0].pool = ['R', 'R', 'C']; expect(cast(g, c)).toBeNull(); resolve(g); settleAll(g, d => d.type === 'targets' ? { type: 'targets', targets: [{ c: a.id }] } : undefined); expect(a.zone).toBe('graveyard');
  });
  it('Charmaw recognizes granted colorless production and ignores lands that lost their abilities', () => {
    const g = mk(), land = put(g, 1, 'island'), c = inHand(g, 0, 'obsidian-charmaw'), exiled = inHand(g, 1, 'opt');
    moveCard(g, exiled, 'exile'); land.bonusMana = exiled.id; land.tapped = true;
    expect(spellCost(g, c, 0).generic).toBe(2);
    g.loseAbilities = true; land.loseAbilitiesTurn = g.turn;
    expect(spellCost(g, c, 0).generic).toBe(3);
  });
  it('Prismatic Ending counts colors actually spent, not X or available colors', () => {
    for (const [pool, exiled] of [[['W', 'U'], true], [['W', 'W'], false], [['W', 'C'], false]] as const) {
      const g = mk(), target = put(g, 1, 'mind-stone'), c = inHand(g, 0, 'prismatic-ending'); g.players[0].pool = [...pool];
      expect(cast(g, c, [{ c: target.id }], { x: 1 })).toBeNull(); resolve(g); expect(target.zone === 'exile').toBe(exiled);
    }
  });
  it('Meltdown with X zero destroys zero-value artifacts on both sides', () => {
    const g = mk(), a = put(g, 0, 'mishras-bauble'), b = put(g, 1, 'tormods-crypt'), keep = put(g, 1, 'mind-stone'), c = inHand(g, 0, 'meltdown'); lands(g, 0, 'mountain', 1);
    expect(cast(g, c, [], { x: 0 })).toBeNull(); resolve(g); expect(a.zone).toBe('graveyard'); expect(b.zone).toBe('graveyard'); expect(keep.zone).toBe('battlefield');
  });
  it('Brazen Borrower Adventure bounces only enemy nonlands and later casts the creature from exile', () => {
    const g = mk(), victim = put(g, 1, 'brave-kin-duo'), c = inHand(g, 0, 'brazen-borrower'); g.players[0].pool = ['U', 'C'];
    expect(cast(g, c, [{ c: victim.id }], { alt: 'adventure' })).toBeNull(); resolve(g); expect(victim.zone).toBe('hand'); expect(c.zone).toBe('exile'); expect(c.onAdventure).toBe(true);
    g.active = 1; g.phase = 'end'; g.players[0].pool = ['U', 'U', 'C']; expect(cast(g, c)).toBeNull(); resolve(g);
    const ground = put(g, 1, 'brave-kin-duo'), flyer = put(g, 1, 'armament-dragon'); ground.attacking = flyer.attacking = true;
    expect(canBlock(g, c, ground)).toBe(false); expect(canBlock(g, c, flyer)).toBe(true);
  });
});

describe('Consign to Memory and replicate interactions', () => {
  it('rejects colored spells and activated abilities as targets', () => {
    const g = mk(), spell = inHand(g, 1, 'opt'); g.players[1].pool = ['U']; expect(cast(g, spell)).toBeNull();
    expect(frontierStackChoices(g, 0, 'modernConsign')).toHaveLength(0);
    const c = inHand(g, 0, 'consign-to-memory'); g.players[0].pool = ['U']; expect(cast(g, c, [], { stackTargetSid: g.stack[0].sid })).not.toBeNull(); expect(g.players[0].pool).toEqual(['U']);
    const artifact = put(g, 1, 'mishras-bauble'); expect(activate(g, artifact, [{ p: 0 }])).toBeNull();
    expect(frontierStackChoices(g, 0, 'modernConsign')).toHaveLength(0);
  });
  it('pays replicate costs, chooses different targets and does not cast its copies', () => {
    const g = mk(), targets = Array.from({ length: 3 }, () => inHand(g, 1, 'mishras-bauble'));
    for (const c of targets) expect(cast(g, c, [], { ignoreTiming: true })).toBeNull();
    const source = inHand(g, 0, 'consign-to-memory'); g.players[0].pool = ['U', 'C', 'C'];
    expect(cast(g, source, [], { stackTargetSid: g.stack[0].sid, replicate: 2 })).toBeNull(); expect(g.players[0].pool).toHaveLength(0);
    let copy = 0; const pick: Answer = d => d.type === 'mode' && d.prompt === '複製品的目標' ? { type: 'modes', picks: [++copy + 1] } : undefined;
    settleAll(g, pick); expect(targets.every(c => c.zone === 'graveyard')).toBe(true); expect(g.players[0].spellsThisTurn).toBe(1);
  });
  it('replicate still creates copies after the original spell is countered', () => {
    const g = mk(), target = inHand(g, 1, 'mishras-bauble'); expect(cast(g, target, [], { ignoreTiming: true })).toBeNull();
    const source = inHand(g, 0, 'consign-to-memory'); g.players[0].pool = ['U', 'C']; expect(cast(g, source, [], { stackTargetSid: g.stack[0].sid, replicate: 1 })).toBeNull(); triggers(g);
    const negate = inHand(g, 1, 'negate'); g.players[1].pool = ['U', 'C']; expect(cast(g, negate, [{ c: source.id }])).toBeNull(); resolve(g); expect(source.zone).toBe('graveyard');
    settleAll(g); expect(target.zone).toBe('graveyard');
  });
});
