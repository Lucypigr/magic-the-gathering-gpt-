import {termNotes} from '../src/ui/explain';
import { describe, it, expect } from 'vitest';
import { CARDS, slug } from '../src/data';
import spm from '../src/data/sets/spm-catalog.json';
import hob from '../src/data/sets/hob-catalog.json';
import rules from '../scripts/localization/spm-hob-rules.json';
import { poolSize } from '../src/meta/booster';
import { displayName, setCardLanguage } from '../src/data/names';
import { colorsOf } from '../src/engine/mana';
import { performAction, castAlts, playOptions, abilitiesFor, spellCost } from '../src/engine/actions';
import { stats, cloneGame, copiableDefinition } from '../src/engine/state';
import { enterBattlefield, emit, moveCard, dealDamage, sacrifice, drawCards, putCounters, transformCard } from '../src/engine/zones';
import { checkSBA } from '../src/engine/flow';
import { runEffects } from '../src/engine/effects';
import { declareAttackers, canBlock } from '../src/engine/combat';
import { webStory } from '../src/engine/web-shire-support';
import { mk, put, inHand, inGy, lands, resolve, settleAll, answerDefault, type Answer } from './helpers';
import type { Effect, TargetRef } from '../src/engine/types';
const run = (g: ReturnType<typeof mk>, c: ReturnType<typeof put>, effects: Effect[], targets: (TargetRef | null)[] = [], custom?: Answer) => { const it = runEffects(g, { source: c.id, controller: c.controller, targets }, effects); let r = it.next(); while (!r.done)
    r = it.next(answerDefault(g, r.value, custom)); };
const E = (action: string): Effect => ({ e: 'frontier', action });
const activate = (g: ReturnType<typeof mk>, c: ReturnType<typeof put>, targets: (TargetRef | null)[] = [], extra: object = {}, find = (a: ReturnType<typeof abilitiesFor>[number]) => !a.isEquip) => performAction(g, c.controller, { type: 'activate', card: c.id, ability: abilitiesFor(g, c).findIndex(find), targets, ...extra });
describe('complete SPM and HOB', () => {
    it('matches every main card and additional face to the pinned source and human Chinese', () => { setCardLanguage(true); for (const [code, catalog] of [['SPM', spm], ['HOB', hob]] as const) {
        expect(poolSize(code)).toBe(188);
        for (const row of catalog) {
            const c = CARDS.find(c => c.id === slug(row.name));
            expect(c, row.name).toBeDefined();
            for (const key of ['cost', 'types', 'subtypes', 'colors', 'power', 'toughness'] as const)
                expect(key === 'colors' ? colorsOf(c!) : c![key], row.name + ' ' + key).toEqual((row as any)[key]);
            if (c!.set === code)
                expect(c!.text, row.name).toBe(row.text);
            expect(displayName(c!)).toMatch(/[\u3400-\u9fff]/);
            for (const face of [row, ...(['back', 'adventure'] as const).flatMap(key => (row as any)[key] ? [(row as any)[key]] : [])])
                if (face.text) {
                    expect((rules as any)[face.name]?.oracleText, face.name).toBe(face.text);
                    expect((rules as any)[face.name]?.text).toMatch(/[\u3400-\u9fff]/);
                }
            if ('adventure' in row) {
                expect(c!.adventure?.text).toBe(row.adventure!.text);
                expect(c!.adventure?.spell).toBeDefined();
            }
            if ('back' in row)
                expect(c!.back?.text).toBe(row.back!.text);
        }
    } setCardLanguage(false); });
    it('web-slinging pays the alternate mana and returns the selected tapped creature', () => { const g = mk(), body = put(g, 0, 'city-pigeon'), spell = inHand(g, 0, 'spider-man-web-slinger'); body.tapped = true; lands(g, 0, 'plains', 1); expect(castAlts(g, 0, spell)).toContain('web'); expect(performAction(g, 0, { type: 'cast', card: spell.id, alt: 'web', webReturn: body.id, targets: [] })).toBeNull(); expect(body.zone).toBe('hand'); resolve(g); expect(spell.zone).toBe('battlefield'); });
    it('rejects untapped creatures as a web-slinging payment before spending mana', () => { const g = mk(), body = put(g, 0, 'city-pigeon'), spell = inHand(g, 0, 'spider-man-web-slinger'); lands(g, 0, 'plains', 1); expect(performAction(g, 0, { type: 'cast', card: spell.id, alt: 'web', webReturn: body.id, targets: [] })).not.toBeNull(); expect(body.zone).toBe('battlefield'); });
    it('Scarlet Spider enters with counters equal to the returned creature mana value', () => { const g = mk(), body = put(g, 0, 'armament-dragon'), spell = inHand(g, 0, 'scarlet-spider-ben-reilly'); body.tapped = true; lands(g, 0, 'mountain', 1); lands(g, 0, 'forest', 1); expect(performAction(g, 0, { type: 'cast', card: spell.id, alt: 'web', webReturn: body.id, targets: [] })).toBeNull(); resolve(g); expect(spell.counters).toBe(6); });
    it('heroic horde receives its cast-via-web reward', () => { const g = mk(), body = put(g, 0, 'city-pigeon'), spell = inHand(g, 0, 'spiders-man-heroic-horde'); body.tapped = true; lands(g, 0, 'forest', 6); expect(performAction(g, 0, { type: 'cast', card: spell.id, alt: 'web', webReturn: body.id, targets: [] })).toBeNull(); resolve(g); settleAll(g); expect(g.battlefield.map(id => g.cards[id]).filter(c => c.def.id === 'tok-ws-spider')).toHaveLength(2); expect(g.players[0].life).toBe(23); });
    it('Storied remains true after the enabling permanents leave and is isolated in clones', () => { const g = mk(), a = put(g, 0, slug('Dáin, Lord of the Iron Hills')), b = put(g, 0, 'short-bow'), c = put(g, 0, 'hot-dog-cart'); checkSBA(g); expect(webStory(g, 0)).toBe(true); moveCard(g, b, 'hand'); moveCard(g, c, 'hand'); checkSBA(g); expect(webStory(g, 0)).toBe(true); const copy = cloneGame(g); copy.webStories![0] = false; expect(webStory(g, 0)).toBe(true); expect(a.zone).toBe('battlefield'); });
    it('Storied counts a legendary artifact once rather than twice', () => { const g = mk(); put(g, 0, slug('Dáin, Lord of the Iron Hills')); put(g, 0, 'the-arkenstone'); checkSBA(g); expect(webStory(g, 0)).toBe(false); });
    it('Storied attack tax must be paid before attacking', () => { const g = mk(); put(g, 1, slug('Dáin, Lord of the Iron Hills')); put(g, 1, 'short-bow'); put(g, 1, 'hot-dog-cart'); const attacker = put(g, 0, 'armament-dragon'); checkSBA(g); expect(declareAttackers(g, 0, [attacker.id])).toHaveLength(0); lands(g, 0, 'forest', 1); expect(declareAttackers(g, 0, [attacker.id])).toHaveLength(1); });
    it('Anti-Venom prevents damage and receives counters', () => { const g = mk(), c = put(g, 0, 'anti-venom-horrifying-healer'), source = put(g, 1, 'armament-dragon'); expect(dealDamage(g, source, 1, { c: c.id }, 4)).toBe(0); expect(c.counters).toBe(4); expect(c.damage).toBe(0); });
    it('Spider-Punk disables damage prevention, including Anti-Venom', () => { const g = mk(), victim = put(g, 0, 'anti-venom-horrifying-healer'), source = put(g, 1, 'armament-dragon'); const punk = inHand(g, 0, 'spider-punk'); enterBattlefield(g, punk, 0); settleAll(g); expect(dealDamage(g, source, 1, { c: victim.id }, 3)).toBe(3); expect(victim.counters).toBe(0); });
    it('Riot lets the controller choose permanent haste', () => { const g = mk(), punk = inHand(g, 0, 'spider-punk'); enterBattlefield(g, punk, 0); settleAll(g, d => d.type === 'mode' ? { type: 'modes', picks: [1] } : undefined); expect(punk.counters).toBe(0); expect(stats(g, punk).kw.has('haste')).toBe(true); g.turn++; expect(stats(g, punk).kw.has('haste')).toBe(true); });
    it('Madame Web allows both Spider and noncreature spells from library top', () => { const g = mk(); put(g, 0, 'madame-web-clairvoyant'); const c = inHand(g, 0, 'opt'); moveCard(g, c, 'library'); g.players[0].library = g.players[0].library.filter(id => id !== c.id); g.players[0].library.unshift(c.id); lands(g, 0, 'island', 1); expect(performAction(g, 0, { type: 'cast', card: c.id, targets: [] })).toBeNull(); resolve(g); expect(c.zone).toBe('graveyard'); });
    it('Green Goblin grants Mayhem to a discarded nonland without altering its printed cost', () => { const g = mk(), norman = put(g, 0, 'norman-osborn'); transformCard(g, norman); const c = inGy(g, 0, 'opt'); c.discardedTurn = g.turn; expect(castAlts(g, 0, c)).toContain('mayhem'); lands(g, 0, 'island', 1); expect(playOptions(g,0).some(o=>o.card===c.id&&o.alt==='mayhem')).toBe(true); expect(performAction(g, 0, { type: 'cast', card: c.id, alt: 'mayhem', targets: [] })).toBeNull(); resolve(g); expect(c.zone).toBe('graveyard'); });
    it('Hobbit Adventure exiles on resolution and grants later casting', () => { const g = mk(), c = inHand(g, 0, 'bofur-reliable-guardian'), body = put(g, 0, 'city-pigeon'); lands(g, 0, 'plains', 2); expect(performAction(g, 0, { type: 'cast', card: c.id, alt: 'adventure', targets: [{ c: body.id }] })).toBeNull(); resolve(g); expect(c.zone).toBe('exile'); expect(c.onAdventure).toBe(true); expect(stats(g, body).kw.has('indestructible')).toBe(true); });
    it('recruit respects Bard token doubling', () => { const g = mk(), bard = put(g, 0, 'bard-king-of-dale'), c = inHand(g, 0, 'opt'); run(g, bard, [{ e: 'recruit' }], [], d => d.type === 'choose' ? { type: 'choose', ids: [c.id] } : undefined); expect(c.zone).toBe('graveyard'); expect(g.battlefield.map(id => g.cards[id]).filter(c => c.def.id === 'tok-human-soldier')).toHaveLength(2); });
    it('hone counters boost the equipped creature and do not affect its toughness', () => { const g = mk(), body = put(g, 0, 'city-pigeon'), eq = put(g, 0, 'short-bow'), dwalin = put(g, 0, 'dwalin-weaponmaster'); eq.attachedTo = body.id; const before = stats(g, body); run(g, dwalin, [E('hob:final:honeEquipment')]); expect(stats(g, body).p).toBe(before.p + 1); expect(stats(g, body).t).toBe(before.t); });
    it('Head of the Hunt replaces death with exile and queues a Wolf', () => { const g = mk(); put(g, 0, 'head-of-the-hunt'); const victim = put(g, 1, 'city-pigeon'); sacrifice(g, victim); settleAll(g); expect(victim.zone).toBe('exile'); expect(g.battlefield.map(id => g.cards[id]).filter(c => c.def.id === 'tok-wolf')).toHaveLength(1); });
    it('Bard doubles additional draws while preserving the first draw-step draw', () => { const g = mk(); put(g, 0, 'bard-king-of-dale'); let n = g.players[0].hand.length; drawCards(g, 0, 1); expect(g.players[0].hand.length).toBe(n + 2); g.phase = 'draw'; emit(g, { type: 'step', step: 'draw', player: 0 }); n = g.players[0].hand.length; drawCards(g, 0, 1); expect(g.players[0].hand.length).toBe(n + 1); drawCards(g, 0, 1); expect(g.players[0].hand.length).toBe(n + 3); });
    it('a future Spider-Man is unavailable during each player first three turns', () => { const g = mk(), c = inHand(g, 0, 'spider-man-2099'); lands(g, 0, 'island', 1); lands(g, 0, 'mountain', 1); g.turn = 5; expect(playOptions(g, 0).some(x => x.card === c.id)).toBe(false); g.turn = 7; expect(playOptions(g, 0).some(x => x.card === c.id)).toBe(true); });
    it('delayed blink returns at the next end step under its owner control', () => { const g = mk(), spell = put(g, 0, 'roll-roll-roll-roll'), body = put(g, 0, 'city-pigeon'); run(g, spell, [E('hob:final:delayedBlink')], [{ c: body.id }]); expect(body.zone).toBe('exile'); g.active = 1; emit(g, { type: 'step', step: 'endStep', player: 1 }); settleAll(g); expect(body.zone).toBe('battlefield'); expect(body.controller).toBe(0); });
    it('Bilbo gift makes Treasure before bouncing the spell and stops further spells that turn', () => { const g = mk(), target = inHand(g, 1, 'opt'), spell = inHand(g, 0, 'bilbos-gambit'); lands(g, 1, 'island', 1); expect(performAction(g, 1, { type: 'cast', card: target.id, targets: [] })).toBeNull(); lands(g, 0, 'plains', 2); expect(performAction(g, 0, { type: 'cast', card: spell.id, alt: 'gift', targets: [{ c: target.id }] })).toBeNull(); resolve(g); expect(target.zone).toBe('hand'); expect(g.battlefield.map(id => g.cards[id]).filter(c => c.token && c.controller === 1 && c.def.subtypes?.includes('Treasure'))).toHaveLength(1); expect(performAction(g, 1, { type: 'cast', card: target.id, targets: [] })).not.toBeNull(); });
    it('every completed permanent handles ordinary game events', () => { for (const def of CARDS.filter(c => c.meadow?.webShire && !c.types.some(t => t === 'Instant' || t === 'Sorcery'))) {
        const g = mk(), c = put(g, 0, def.id), opponent = put(g, 1, 'armament-dragon'), spell = inHand(g, 0, 'opt');
        spell.zone = 'stack';
        spell.castFace = spell.def;
        for (const e of [{ type: 'step', step: 'upkeep', player: 0 }, { type: 'etb', card: opponent.id, controller: 1 }, { type: 'targeted', card: c.id, by: 1, spell: true }, { type: 'cast', card: spell.id, player: 0, opponentTurn: false }, { type: 'draw', card: spell.id, player: 0 }, { type: 'attacks', card: c.id }, { type: 'blocks', card: opponent.id }, { type: 'step', step: 'endStep', player: 0 }] as const)
            expect(() => emit(g, e), def.name + ' ' + e.type).not.toThrow();
    } });
    it('Arachne chooses a noncreature card type and taxes both players spells of that type', () => { const g = mk(), c = inHand(g, 0, 'arachne-psionic-weaver'); enterBattlefield(g, c, 0); settleAll(g, d => d.type === 'mode' ? { type: 'modes', picks: [0] } : undefined); const artifact = inHand(g, 1, 'short-bow'); expect(spellCost(g, artifact, 1).generic).toBe(3); });
    it('Soul Stone exiles the chosen creature as a harness payment', () => { const g = mk(), stone = put(g, 0, 'the-soul-stone'), body = put(g, 0, 'city-pigeon'); lands(g, 0, 'swamp', 7); expect(activate(g, stone, [], { costCards: [body.id] }, a => !!a.webExileCreature)).toBeNull(); expect(body.zone).toBe('exile'); resolve(g); expect(stone.frontierMarks?.webHarnessedVersion).toBe(stone.objectVersion); });
    it('Iron Spider removes two counters from different artifacts as its actual cost', () => { const g = mk(), c = put(g, 0, 'iron-spider-stark-upgrade'), other = put(g, 0, 'short-bow'); putCounters(g, c, 1); putCounters(g, other, 1); lands(g, 0, 'forest', 2); const before = g.players[0].hand.length; expect(activate(g, c, [], { webCounterCards: [c.id, other.id] }, a => !!a.webRemoveCounters)).toBeNull(); expect(c.counters + other.counters).toBe(0); resolve(g); expect(g.players[0].hand.length).toBe(before + 1); });
    it('Hide on the Ceiling pays X for exactly X artifact or creature targets', () => { const g = mk(), spell = inHand(g, 0, 'hide-on-the-ceiling'), a = put(g, 1, 'short-bow'), b = put(g, 1, 'city-pigeon'); lands(g, 0, 'island', 3); expect(performAction(g, 0, { type: 'cast', card: spell.id, mode: 2, targets: [{ c: a.id }, { c: b.id }] })).toBeNull(); expect(g.stack.at(-1)?.x).toBe(2); resolve(g); expect(a.zone).toBe('exile'); expect(b.zone).toBe('exile'); emit(g, { type: 'step', step: 'endStep', player: 0 }); settleAll(g); expect(a.zone).toBe('battlefield'); expect(b.zone).toBe('battlefield'); });
    it('Behold the Sinister Six rejects different objects with the same name', () => { const g = mk(), spell = inHand(g, 0, 'behold-the-sinister-six'), a = inGy(g, 0, 'city-pigeon'), b = inGy(g, 0, 'city-pigeon'), c = inGy(g, 0, 'brave-kin-duo'); lands(g, 0, 'swamp', 7); expect(performAction(g, 0, { type: 'cast', card: spell.id, mode: 2, targets: [{ c: a.id }, { c: b.id }] })).not.toBeNull(); expect(performAction(g, 0, { type: 'cast', card: spell.id, mode: 2, targets: [{ c: a.id }, { c: c.id }] })).toBeNull(); resolve(g); expect(a.zone).toBe('battlefield'); expect(c.zone).toBe('battlefield'); });
    it('Story allows only the first equip activation that turn for zero mana', () => { const g = mk(), kili = put(g, 0, slug('Kíli the Resourceful')), eq = put(g, 0, 'short-bow'); const cart = put(g, 0, 'hot-dog-cart'); cart.tapped = true; checkSBA(g); expect(webStory(g, 0)).toBe(true); expect(activate(g, eq, [{ c: kili.id }], {}, a => !!a.isEquip)).toBeNull(); resolve(g); expect(activate(g, eq, [{ c: kili.id }], {}, a => !!a.isEquip)).not.toBeNull(); });
    it('With Great Power redirects player damage to its enchanted creature', () => { const g = mk(), body = put(g, 0, 'armament-dragon'), aura = put(g, 0, slug('With Great Power . . .')), source = put(g, 1, 'armament-dragon'); aura.attachedTo = body.id; checkSBA(g); expect(dealDamage(g, source, 1, { p: 0 }, 3)).toBe(3); expect(g.players[0].life).toBe(20); expect(body.damage).toBe(3); expect(stats(g, body).p).toBe(body.def.power! + 2); });
    it('Spider-Punk prevents Counterspell effects from countering a spell', () => { const g = mk(), punk = inHand(g, 0, 'spider-punk'); enterBattlefield(g, punk, 0); settleAll(g); const spell = inHand(g, 0, 'opt'), counter = inHand(g, 1, 'negate'); lands(g, 0, 'island', 1); lands(g, 1, 'island', 2); expect(performAction(g, 0, { type: 'cast', card: spell.id, targets: [] })).toBeNull(); expect(performAction(g, 1, { type: 'cast', card: counter.id, targets: [{ c: spell.id }] })).toBeNull(); resolve(g); expect(spell.zone).toBe('stack'); });
    it('the Spider-Man No More type and base changes are not copiable', () => { const g = mk(), body = put(g, 0, 'armament-dragon'), aura = put(g, 0, 'spider-man-no-more'); aura.attachedTo = body.id; checkSBA(g); expect(stats(g, body).p).toBe(1); expect(body.def.subtypes).toEqual(['Citizen']); expect(copiableDefinition(body).subtypes).toContain('Dragon'); moveCard(g, aura, 'hand'); checkSBA(g); expect(body.def.subtypes).toContain('Dragon'); });
    it('Wall Crawl stops only creatures with defender from blocking Spiders', () => { const g = mk(), spider = put(g, 0, 'tok-ws-spider'), blocker = put(g, 1, 'tok-ws-boulder'); put(g, 0, 'wall-crawl'); checkSBA(g); expect(canBlock(g, blocker, spider)).toBe(false); });
    it('uses sourced mechanic names and permanent story help',()=>{setCardLanguage(true);const c=CARDS.find(c=>c.name==='Dáin, Lord of the Iron Hills')!;expect(termNotes(c).find(n=>n.term==='立傳／歷世書傳')?.desc).toContain('保留到遊戲結束');setCardLanguage(false);});

    it('amass chooses one Army when Bard doubles its creation',()=>{const g=mk(),bard=put(g,0,'bard-king-of-dale');run(g,bard,[{e:'amass',n:3}],[],d=>d.type==='choose'?{type:'choose',ids:[d.options.at(-1)!]}:undefined);const armies=g.battlefield.map(id=>g.cards[id]).filter(c=>c.def.subtypes?.includes('Army'));expect(armies).toHaveLength(2);expect(armies[1].counters).toBe(3);expect(armies[0].counters).toBe(0);checkSBA(g);expect(armies[0].zone).toBe('graveyard');});

    it('the Trolls return as an artifact without causing creature-entry triggers',()=>{const g=mk();put(g,0,'aunt-may');const c=put(g,0,slug('Tom, Bert, and William'));sacrifice(g,c);settleAll(g);expect(c.zone).toBe('battlefield');expect(c.def.types).toEqual(['Artifact']);expect(g.players[0].life).toBe(20);sacrifice(g,c);settleAll(g);expect(c.zone).toBe('graveyard');});

});

describe('SPM/HOB source-effect review regressions', () => {
    it('Thorin does not retrigger damage when the Equipment is already attached there', () => {
        const g = mk(), source = put(g, 0, 'thorin-mountain-king'), body = put(g, 0, 'city-pigeon'), eq = put(g, 0, 'short-bow');
        eq.attachedTo = body.id;
        run(g, source, [E('hob:final:114')], [{ c: body.id }, { c: eq.id }]);
        expect(g.pending).toHaveLength(0);
        eq.attachedTo = source.id;
        run(g, source, [E('hob:final:114')], [{ c: body.id }, { c: eq.id }]);
        expect(eq.attachedTo).toBe(body.id);
        expect(g.pending).toHaveLength(1);
    });
    it('Rhino Rampage cannot trigger excess damage when damage is prevented', () => {
        const g = mk(), source = put(g, 0, 'rhinos-rampage'), a = put(g, 0, 'armament-dragon'), b = put(g, 1, 'anti-venom-horrifying-healer');
        run(g, source, [E('spm:final:141')], [{ c: a.id }, { c: b.id }]);
        expect(b.damage).toBe(0);
        expect(g.pending).toHaveLength(0);
    });
    it('Rhino Rampage uses actual damage and deathtouch to determine excess', () => {
        const g = mk(), source = put(g, 0, 'rhinos-rampage'), a = put(g, 0, 'armament-dragon'), b = put(g, 1, 'armament-dragon');
        a.permanentGrants = [{ p: 0, t: 0, kw: ['deathtouch'] }];
        run(g, source, [E('spm:final:141')], [{ c: a.id }, { c: b.id }]);
        expect(b.damage).toBe(stats(g, a).p);
        expect(g.pending).toHaveLength(1);
    });
    it('Bolg amasses only excess damage after accounting for deathtouch', () => {
        const g = mk(), source = put(g, 0, 'bolg-of-the-north'), victim = put(g, 1, 'armament-dragon');
        source.permanentGrants = [{ p: 0, t: 0, kw: ['deathtouch'] }];
        run(g, source, [{ e: 'frontier', action: 'hob:final:bolgDamage', n: 3 }], [{ c: victim.id }]);
        const army = g.battlefield.map(id => g.cards[id]).find(c => c.def.subtypes?.includes('Army'));
        expect(army?.counters).toBe(2);
    });
    it('Biotech Specialist sacrifice damage targets an opponent and can be responded to', () => {
        const g = mk(), source = put(g, 0, 'biotech-specialist'), artifact = put(g, 0, 'hot-dog-cart');
        sacrifice(g, artifact);
        const trigger = g.pending.find(t => t.source === source.id);
        expect(trigger?.ability.targets?.[0].kind).toBe('opponent');
        expect(g.players[1].life).toBe(20);
        settleAll(g);
        expect(g.players[1].life).toBe(18);
    });
    it('Mister Negative exchange emits both life events and draws for actual life lost', () => {
        const g = mk(), source = put(g, 0, 'mister-negative');
        put(g, 0, 'the-master-of-lake-town');
        g.players[0].life = 20; g.players[1].life = 15;
        const hand = g.players[0].hand.length;
        run(g, source, [E('spm:final:135')], [{ p: 1 }]);
        expect(g.players.map(p => p.life)).toEqual([15, 20]);
        expect(g.players[0].lifeLostThisTurn).toBe(5);
        expect(g.players[1].lifeGainedThisTurn).toBe(5);
        expect(g.players[0].hand).toHaveLength(hand + 5);
        expect(g.pending.some(t => t.ev.type === 'lifeloss')).toBe(true);
    });
    it('Mister Negative cannot exchange life when the required gain is prohibited', () => {
        const g = mk(), source = put(g, 0, 'mister-negative');
        g.players[0].life = 20; g.players[1].life = 15; g.players[1].cantGainLife = true;
        const hand = g.players[0].hand.length;
        run(g, source, [E('spm:final:135')], [{ p: 1 }]);
        expect(g.players.map(p => p.life)).toEqual([20, 15]);
        expect(g.players[0].hand).toHaveLength(hand);
    });
});
