import { describe, it, expect } from 'vitest';
import { slug, MODERN_AI_DECKS, expandDeck } from '../src/data';
import catalog from '../src/data/sets/modern-murktide-catalog.json';
import { getDef } from '../src/engine/registry';
import { zhName } from '../src/data/names';
import { traditionalRulesText } from '../src/data/localization';
import { abilitiesFor, castAlts, castOptionsFor, manaSources, performAction, spellCost } from '../src/engine/actions';
import { abilitiesOf, stats, matches } from '../src/engine/state';
import { manaValue } from '../src/engine/mana';
import { dealDamage, emit, enterBattlefield, moveCard } from '../src/engine/zones';
import { runHeadless } from '../src/engine/controller';
import { mk, put, inHand, inGy, resolve, settleAll, type Answer } from './helpers';
import type { TargetRef } from '../src/engine/types';
const cast = (g: ReturnType<typeof mk>, c: ReturnType<typeof inHand>, targets: TargetRef[] = [], extra = {}) => performAction(g, c.owner, { type: 'cast', card: c.id, targets, ...extra });
const activated = (g: ReturnType<typeof mk>, c: ReturnType<typeof put>) => performAction(g, c.controller, { type: 'activate', card: c.id, ability: 0, targets: [] });
const allCopies: Answer = d => d.type === 'choose' && d.prompt === '選擇任意數量的同名牌放逐' ? { type: 'choose', ids: d.options } : undefined;

describe('Modern Murktide second batch', () => {
  it.each(catalog)('$name preserves source characteristics with sourced Chinese', row => {
    const d = getDef(slug(row.name));
    for (const k of ['cost', 'types', 'subtypes', 'supertypes', 'colors', 'text'] as const) expect(d[k], k).toEqual(row[k]);
    if ('power' in row) { expect(d.power).toBe(row.power); expect(d.toughness).toBe(row.toughness); }
    expect(zhName(d)).toMatch(/\p{Script=Han}/u); expect(traditionalRulesText(d.text)).toMatch(/\p{Script=Han}/u);
  });
  it.each([['misty-rainforest','forest'],['polluted-delta','swamp']])('%s fetches %s and pays life and sacrifice', (id, basic) => {
    const g = mk(), c = put(g, 0, id), land = inHand(g, 0, basic); moveCard(g, land, 'library');
    expect(activated(g, c)).toBeNull(); expect(c.zone).toBe('graveyard'); expect(g.players[0].life).toBe(19);
    resolve(g, d => d.type === 'choose' && d.purpose === 'tutor' ? { type: 'choose', ids: [land.id] } : undefined); expect(land.zone).toBe('battlefield');
  });
  it('Blood Moon changes nonbasic land types, removes printed abilities and changes mana; leaving restores them', () => {
    const g = mk(), fetch = put(g, 0, 'polluted-delta'), islet = put(g, 1, 'fiery-islet'), basic = put(g, 0, 'island'), moon = put(g, 0, 'blood-moon');
    expect(fetch.def.subtypes).toEqual(['Mountain']); expect(fetch.def.supertypes).not.toContain('Basic'); expect(abilitiesFor(g, fetch)).toHaveLength(0);
    expect(manaSources(g, 0).find(s => s.id === fetch.id)?.produces).toEqual(['R']); expect(islet.def.painMana).toBe(false); expect(basic.def.produces).toEqual(['U']);
    expect(matches(g, { sub: 'Island' }, fetch, 0)).toBe(false); expect(matches(g, { sub: 'Mountain' }, fetch, 0)).toBe(true);
    moveCard(g, moon, 'graveyard'); expect(fetch.def.subtypes).toEqual([]); expect(abilitiesFor(g, fetch)).toHaveLength(1); expect(islet.def.painMana).toBe(true);
  });
  it('a shock land enters untapped without life loss under Blood Moon and a departed land regains printed data', () => {
    const g = mk(); put(g, 0, 'blood-moon'); const c = inHand(g, 0, 'steam-vents'); enterBattlefield(g, c, 0); settleAll(g);
    expect(c.tapped).toBe(false); expect(g.players[0].life).toBe(20); expect(c.def.subtypes).toEqual(['Mountain']);
    moveCard(g, c, 'graveyard'); expect(c.def.subtypes).toEqual(['Island','Mountain']); expect(c.def.shock || c.def.ecl?.asEnters === 'shock').toBeTruthy();
  });
  it('Moon suppression restores lands immediately and removal of suppression reapplies it', () => {
    const g = mk(), land = put(g, 0, 'polluted-delta'), moon = put(g, 0, 'blood-moon');
    g.eot.push({ card: moon.id, p: 0, t: 0, kw: [], loseAbilities: true }); abilitiesOf(g, land); expect(abilitiesFor(g, land)).toHaveLength(1);
    g.eot = []; expect(abilitiesFor(g, land)).toHaveLength(0); expect(land.def.produces).toEqual(['R']);
  });
  it('Moon grants usable red mana to fetches and lets Lava Dart sacrifice them as Mountains', () => {
    const g=mk(),fetch=put(g,0,'polluted-delta');put(g,0,'blood-moon');const bolt=inHand(g,0,'lightning-bolt');
    expect(cast(g,bolt,[{p:1}])).toBeNull();resolve(g);expect(fetch.tapped).toBe(true);expect(g.players[0].life).toBe(20);
    const dart=inGy(g,0,'lava-dart');expect(cast(g,dart,[{p:1}],{alt:'flashback',sac:fetch.id})).toBeNull();resolve(g);expect(fetch.zone).toBe('graveyard');expect(fetch.def.subtypes).toEqual([]);expect(dart.zone).toBe('exile');
  });
  it('a second Moon maintains the effect when the first leaves', () => {
    const g=mk(),land=put(g,0,'fiery-islet'),a=put(g,0,'blood-moon'),b=put(g,1,'blood-moon');moveCard(g,a,'graveyard');expect(land.def.produces).toEqual(['R']);moveCard(g,b,'graveyard');expect(land.def.produces).toEqual(['U','R']);
  });
  it('Moon preserves Equipment subtypes and cooperates with Toph making artifacts into lands', () => {
    const g=mk(),equipment=put(g,0,'cori-steel-cutter'),toph=put(g,0,'toph-the-first-metalbender');put(g,1,'blood-moon');
    expect(equipment.def.types).toContain('Land');expect(equipment.def.subtypes).toEqual(['Equipment','Mountain']);expect(abilitiesFor(g,equipment)).toHaveLength(0);
    moveCard(g,toph,'graveyard');expect(equipment.def.types).not.toContain('Land');expect(equipment.def.subtypes).toEqual(['Equipment']);
  });
  it('a copied Blood Moon activates the continuous effect when entering as a copy', () => {
    const g=mk(),land=put(g,0,'polluted-delta'),copy=inHand(g,0,'opt');enterBattlefield(g,copy,0,false,{...getDef('blood-moon'),id:'copied-moon'});
    expect(land.def.subtypes).toEqual(['Mountain']);moveCard(g,copy,'graveyard');expect(land.def.subtypes).toEqual([]);
  });
  it('Counterspell rejects insufficient blue mana and counters any spell', () => {
    const g = mk(), a = inHand(g, 1, 'mishras-bauble'); expect(cast(g, a, [], { ignoreTiming: true })).toBeNull(); const c = inHand(g, 0, 'counterspell'); g.players[0].pool = ['U','R'];
    expect(cast(g, c, [{ c: a.id }])).not.toBeNull(); g.players[0].pool = ['U','U']; expect(cast(g, c, [{ c: a.id }])).toBeNull(); resolve(g); expect(a.zone).toBe('graveyard');
  });
  it('Stern Scolding accepts either power or toughness <=2 and rejects a 3/3 spell', () => {
    for (const [id, allowed] of [['ragavan-nimble-pilferer',true],['murktide-regent',false]] as const) {
      const g = mk(), a = inHand(g, 1, id); g.players[1].pool = ['R','U','U',...Array(5).fill('C')]; expect(cast(g, a, [], { ignoreTiming: true, orbitDelve: [] })).toBeNull(); const c = inHand(g, 0, 'stern-scolding'); g.players[0].pool = ['U'];
      expect(cast(g, c, [{ c: a.id }]) === null).toBe(allowed); if (allowed) { resolve(g); expect(a.zone).toBe('graveyard'); }
    }
  });
  it('Stern Scolding also accepts a spell with high power but toughness two', () => {
    const g=mk(),a=inHand(g,1,'ragavan-nimble-pilferer');g.players[1].pool=['R'];expect(cast(g,a,[],{ignoreTiming:true})).toBeNull();a.castFace={...a.def,power:6,toughness:2};
    const c=inHand(g,0,'stern-scolding');g.players[0].pool=['U'];expect(cast(g,c,[{c:a.id}])).toBeNull();resolve(g);expect(a.zone).toBe('graveyard');
  });
  it('Dispute is selectable with only U against a blue spell, but requires 2U against red', () => {
    for (const [id, cheap] of [['opt',true],['lightning-bolt',false]] as const) {
      const g = mk(), a = inHand(g, 1, id); g.players[1].pool = ['U','R']; expect(cast(g, a, id === 'opt' ? [] : [{ p: 0 }])).toBeNull(); const c = inHand(g, 0, 'mystical-dispute'); g.players[0].pool = ['U'];
      expect(castOptionsFor(g, 0, c).length > 0).toBe(cheap); expect(spellCost(g, c, 0, undefined, [{ c: a.id }]).generic).toBe(cheap ? 0 : 2);
      expect(cast(g, c, [{ c: a.id }]) === null).toBe(cheap);
      if (cheap) { g.players[1].pool = []; resolve(g); expect(a.zone).toBe('graveyard'); }
    }
  });
  it('Dispute lets the spell controller pay three to prevent the counter', () => {
    const g = mk(), a = inHand(g, 1, 'opt'); g.players[1].pool = ['U']; expect(cast(g, a)).toBeNull(); const c = inHand(g, 0, 'mystical-dispute'); g.players[0].pool = ['U'];
    expect(cast(g, c, [{ c: a.id }])).toBeNull(); g.players[1].pool = ['C','C','C']; resolve(g); expect(a.zone).toBe('stack'); expect(g.players[1].pool).toEqual([]);
  });
  it('Force can pitch another blue card only on an opponent turn and exiles the countered spell directly', () => {
    const g = mk(), a = inHand(g, 1, 'opt'); g.players[1].pool = ['U']; expect(cast(g, a)).toBeNull(); const c = inHand(g, 0, 'force-of-negation'), pitch = inHand(g, 0, 'preordain');
    expect(castAlts(g, 0, c)).not.toContain('modernPitch'); g.active = 1; expect(castAlts(g, 0, c)).toContain('modernPitch');
    expect(cast(g, c, [{ c: a.id }], { alt: 'modernPitch', modernExile: c.id })).not.toBeNull(); expect(c.zone).toBe('hand');
    expect(cast(g, c, [{ c: a.id }], { alt: 'modernPitch', modernExile: pitch.id })).toBeNull(); expect(pitch.zone).toBe('exile'); expect(manaValue(c.castFace!)).toBe(3);
    resolve(g); expect(a.zone).toBe('exile'); expect(g.players[1].graveyard).not.toContain(a.id);
  });
  it('Force normally costs 1UU, rejects creature targets and respects uncounterability', () => {
    const g = mk(), a = inHand(g, 1, 'mishras-bauble'); expect(cast(g, a, [], { ignoreTiming: true })).toBeNull(); g.stack[0].uncounterable = true;
    const c = inHand(g, 0, 'force-of-negation'); g.players[0].pool = ['C','U','U']; expect(cast(g, c, [{ c: a.id }])).toBeNull(); resolve(g); expect(a.zone).toBe('stack');
    const creature = inHand(g, 1, 'ragavan-nimble-pilferer'); g.players[1].pool = ['R']; expect(cast(g, creature, [], { ignoreTiming: true })).toBeNull(); const other = inHand(g, 0, 'force-of-negation');g.players[0].pool = ['C','U','U']; expect(cast(g, other, [{ c: creature.id }])).not.toBeNull();
  });
  it('Subtlety evoke exiles a blue hand card and its owner chooses top/bottom even for an uncounterable spell', () => {
    const g = mk(), a = inHand(g, 1, 'murktide-regent'); g.players[1].pool = ['U','U',...Array(5).fill('C')]; expect(cast(g, a, [], { ignoreTiming: true, orbitDelve: [] })).toBeNull(); g.stack[0].uncounterable = true;
    const c = inHand(g, 0, 'subtlety'), pitch = inHand(g, 0, 'opt'); expect(cast(g, c, [], { alt: 'evoke', modernExile: pitch.id })).toBeNull(); expect(manaValue(c.castFace!)).toBe(4);
    let chooser = -1;
    settleAll(g, d => { if (d.type === 'targets') return { type: 'targets', targets: [{ c: a.id }] }; if (d.type === 'mode' && d.prompt === '將咒語放在牌庫頂或牌庫底') { chooser = d.player; return { type: 'modes', picks: [1] }; } });
    expect(chooser).toBe(1); expect(g.players[1].library.at(-1)).toBe(a.id); expect(c.zone).toBe('graveyard'); expect(pitch.zone).toBe('exile');
  });
  it('Subtlety without evoke survives, and its optional target may be declined', () => {
    const g = mk(), c = inHand(g, 0, 'subtlety');g.players[0].pool = ['C','C','U','U']; expect(cast(g, c)).toBeNull();settleAll(g);expect(c.zone).toBe('battlefield');expect(stats(g, c).kw.has('flying')).toBe(true);
    const alone = mk(), evoke = inHand(alone, 0, 'subtlety'); expect(castAlts(alone, 0, evoke)).not.toContain('evoke');
  });
  it('Ragavan dash grants haste and returns at the next end step', () => {
    const g = mk(), c = inHand(g, 0, 'ragavan-nimble-pilferer');g.players[0].pool = ['R','C']; expect(cast(g, c, [], { alt: 'modernDash' })).toBeNull();expect(manaValue(c.castFace!)).toBe(1);resolve(g);expect(stats(g, c).kw.has('haste')).toBe(true);
    emit(g, { type: 'step', step: 'endStep', player: 0 });settleAll(g);expect(c.zone).toBe('hand');
  });
  it('dash return never returns a different object after blinking', () => {
    const g = mk(), c = inHand(g, 0, 'ragavan-nimble-pilferer');g.players[0].pool = ['R','C'];expect(cast(g, c, [], { alt: 'modernDash' })).toBeNull();resolve(g);moveCard(g, c, 'exile');enterBattlefield(g, c, 0);
    emit(g, { type: 'step', step: 'endStep', player: 0 });settleAll(g);expect(c.zone).toBe('battlefield');
  });
  it('Ragavan creates Treasure and exiles a hit player top card, permits normal-cost casts but never plays lands', () => {
    for (const land of [false,true]) {
      const g = mk(), c = put(g, 0, 'ragavan-nimble-pilferer'), top = inHand(g, 1, land ? 'island' : 'expressive-iteration');moveCard(g, top, 'library');
      dealDamage(g, c, 0, { p: 1 }, 2, { combat: true });settleAll(g);expect(top.zone).toBe('exile');expect(g.battlefield.some(id => g.cards[id].def.id === 'tok-treasure')).toBe(true);
      if (land) expect(performAction(g, 0, { type: 'play', card: top.id })).not.toBeNull();
      else { expect(performAction(g, 0, { type: 'cast', card: top.id, targets: [] })).not.toBeNull();g.players[0].pool=['U','R'];expect(performAction(g,0,{type:'cast',card:top.id,targets:[]})).toBeNull(); }
    }
  });
  it('Surgical can pay B or two life and exiles only chosen copies in all three zones, without drawing', () => {
    const g = mk(), target = inGy(g, 1, 'opt'), hand = inHand(g, 1, 'opt'), lib = inHand(g, 1, 'opt'), keep = inHand(g, 1, 'preordain');moveCard(g, lib, 'library');const n = g.players[1].hand.length;
    const c = inHand(g, 0, 'surgical-extraction');expect(cast(g,c,[{c:target.id}],{alt:'modernLife'})).toBeNull();expect(g.players[0].life).toBe(18);resolve(g,allCopies);
    expect([target,hand,lib].every(c=>c.zone==='exile')).toBe(true);expect(keep.zone).toBe('hand');expect(g.players[1].hand.length).toBe(n-1);
    const other=inHand(g,0,'surgical-extraction'),basic=inGy(g,1,'island');g.players[0].pool=['B'];expect(cast(g,other,[{c:basic.id}])).not.toBeNull();
  });
  it('Surgical allows zero chosen copies and black mana payment', () => {
    const g=mk(),t=inGy(g,1,'opt'),c=inHand(g,0,'surgical-extraction');g.players[0].pool=['B'];expect(cast(g,c,[{c:t.id}])).toBeNull();resolve(g);expect(t.zone).toBe('graveyard');expect(g.players[0].life).toBe(20);
  });
  it('Test of Talents searches even if the target cannot be countered, and draws only for exiled hand copies', () => {
    const g=mk(),t=inHand(g,1,'opt'),hand=inHand(g,1,'opt'),lib=inHand(g,1,'opt'),gy=inGy(g,1,'opt');moveCard(g,lib,'library');g.players[1].pool=['U'];expect(cast(g,t)).toBeNull();g.stack[0].uncounterable=true;
    const n=g.players[1].hand.length,c=inHand(g,0,'test-of-talents');g.players[0].pool=['C','U'];expect(cast(g,c,[{c:t.id}])).toBeNull();resolve(g,allCopies);
    expect(t.zone).toBe('stack');expect([hand,lib,gy].every(c=>c.zone==='exile')).toBe(true);expect(g.players[1].hand.length).toBe(n);
  });
  it('Test of Talents counters and can also extract the now-countered card from the graveyard', () => {
    const g=mk(),t=inHand(g,1,'opt');g.players[1].pool=['U'];expect(cast(g,t)).toBeNull();const c=inHand(g,0,'test-of-talents');g.players[0].pool=['C','U'];expect(cast(g,c,[{c:t.id}])).toBeNull();resolve(g,allCopies);expect(t.zone).toBe('exile');
  });
  it('the completed Murktide original main deck finishes a representative AI match', () => {
    const a=MODERN_AI_DECKS.find(d=>d.id==='modern-izzet-murktide')!,b=MODERN_AI_DECKS[0];expect(a).toBeDefined();
    const g=runHeadless({name:'A',deckName:a.name,deck:expandDeck(a),isAI:true},{name:'B',deckName:b.name,deck:expandDeck(b),isAI:true},['normal','normal'],807,['tempo','tempo']);expect(g.winner).not.toBeNull();
  });
});
