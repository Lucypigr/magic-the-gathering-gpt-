import { redMastery } from './modern-red';
import { webNoCounter } from './web-shire-support';
import { finalContext, finalLook } from './orbit-final-common';
import { webAddTypes, webForm, webCopy, webDig, webMillPick } from './web-shire';
import { copiableDefinition, isCreature, shuffleArr, stats } from './state';
import { moveCard, enterBattlefield, putCounters, drawCards, discardMany, sacrifice, tapCard, dealDamage, loseLife, gainLife } from './zones';
import { resolveRef, type Ctx } from './effects';
import { freeCast } from './tla';
import { frontierFlags } from './frontier-support';
import { counterKinds } from './ecl-support';
import { allDefs } from './registry';
import { manaValue, parseCost } from './mana';
import { canPayCost, payCost } from './actions';
import { campusLink } from './campus';
import type { Effect, GameState, SubFlow, PID, Card, Color } from './types';
export function* webSpmEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, {
    e: 'frontier';
}>): SubFlow {
    const { p, src, player, them, key, E, run, cards, ours, pick, token, target, selfLive, permit, impulse, counter, grant, reflex, yes, mode } = finalContext(g, ctx, ef), t = target();
    switch (key) {
        case '5':
            if (selfLive() && src.counters > 0 && t?.zone === 'battlefield') {
                src.counters--;
                putCounters(g, t, 1);
            }
            break;
        case 'spiderHero':
            if (t)
                webAddTypes(t, ['Spider', 'Hero'], true, true);
            break;
        case '11': {
            const ids = ours({ tapped: false }).filter(c => isCreature(c) || c.def.subtypes?.includes('Treasure')).map(c => c.id);
            if (ids.length >= 2 && (yield* yes('橫置兩個生物或珍寶來抓牌？'))) {
                const chosen = yield* pick(ids, '橫置兩個永久物', 2, 2);
                for (const id of chosen)
                    tapCard(g, g.cards[id], p);
                drawCards(g, p, 1);
            }
            else if (selfLive())
                sacrifice(g, src);
            break;
        }
        case 'nextCreatureCopy':
            frontierFlags(g, p).webNextCreatureCopy = (frontierFlags(g, p).webNextCreatureCopy ?? 0) + 1;
            break;
        case 'nameCombatDraw': {
            const defs = allDefs().filter(d => !d.token && d.set !== 'TOK'), index = yield* mode('選擇牌名', defs.map(d => d.name));
            src.foundationNamed = defs[index]?.name;
            (g.delayed ??= []).push({ source: src.id, controller: p, on: 'frontierEvent', frontierEvent: 'spm:final:namedCombat:' + encodeURIComponent(src.foundationNamed ?? ''), once: false, effects: [{ e: 'draw', n: 1 }] });
            break;
        }
        case '33':
            if (selfLive()) {
                src.baseDef ??= src.def;
                webForm(src, { types: ['Land'], subtypes: [], produces: ['U'] });
                (src.frontierMarks ??= {}).webHydroUntil = g.turn + (g.active === p ? 2 : 1);
                src.frontierMarks.animationUntilTurn = src.frontierMarks.webHydroUntil;
                src.tapped = false;
            }
            break;
        case '34':
            if (ctx.ev?.type === 'combatDamage') {
                const c = g.cards[ctx.ev.source], def = copiableDefinition(c);
                yield* token({ ...def, supertypes: def.supertypes?.filter(t => t !== 'Legendary') });
            }
            break;
        case 'ingenuity':
            if (selfLive())
                counter(src, 'ingenuity');
            break;
        case '35': {
            const ids = player.hand.filter(id => g.cards[id].def.types.includes('Artifact') && manaValue(g.cards[id].def) <= (src.eclCounters?.ingenuity ?? 0)), [id] = yield* pick(ids, '可免費施放一個神器');
            if (id !== undefined)
                yield* freeCast(g, ctx, g.cards[id], true);
            break;
        }
        case '37': {
            const n = ours({ sub: 'Villain', token: false }).length;
            const made = yield* token('tok-ws-illusion', n);
            for (const c of made)
                (c.frontierMarks ??= {}).webMysterio = src.tmtLinkKey ?? src.id;
            break;
        }
        case 'exileLinkedTokens':
            for (const c of cards())
                if (c.frontierMarks?.webMysterio === (ctx.sourceLinkKey ?? src.tmtLinkKey ?? src.id))
                    moveCard(g, c, 'exile');
            break;
        case 'citizenForm':
        case 'heroForm':
            if (t) {
                webForm(t, { subtypes: [key === 'citizenForm' ? 'Citizen' : 'Hero'] });
                yield* run([{ e: 'setBase', what: 'T0', p: key === 'citizenForm' ? 1 : 3, t: key === 'citizenForm' ? 1 : 4 }, { e: 'pump', what: 'T0', p: 0, t: 0, kw: key === 'citizenForm' ? ['hexproof'] : ['flying', 'vigilance'] }]);
            }
            break;
        case 'counterStack': {
            const item = g.stack.find(s => s.sid === ef.n);
            if (item && !webNoCounter(g) && !item.uncounterable && !(g.cards[item.cardId].def.uncounterable||(item.kind==='spell'&&redMastery(g,g.cards[item.cardId])))) {
                g.stack = g.stack.filter(s => s.sid !== item.sid);
                if (item.kind === 'spell')
                    moveCard(g, g.cards[item.cardId], 'graveyard');
            }
            break;
        }
        case '52': {
            const ids = g.players[them].library.slice(0, 9), selected = yield* pick(ids, '選擇兩張牌面朝下放逐', Math.min(2, ids.length), 2);
            for (const id of selected) {
                const c = g.cards[id];
                permit(c, Number.MAX_SAFE_INTEGER, p);
                (c.finMarks ??= {}).anyMana = 1;
                (c.frontierMarks ??= {}).webAnyMana = 1;
                (c.frontierMarks ??= {}).webHiddenBy = p + 1;
            }
            const rest = ids.filter(id => !selected.includes(id));
            shuffleArr(g, rest);
            for (const id of rest)
                moveCard(g, g.cards[id], 'library', true);
            break;
        }
        case 'discardOrLose':
            for (const who of [p, them]) {
                const ids = g.players[who].hand.slice();
                if (ids.length && (yield* yes('可棄一張牌，否則失去3生命', who))) {
                    const [id] = yield* pick(ids, '棄一張牌', 1, 1, who);
                    discardMany(g, [g.cards[id]]);
                }
                else
                    loseLife(g, who, 3);
            }
            break;
        case 'exileGraves':
            for (const ref of ctx.targets)
                if (ref && 'p' in ref)
                    for (const id of g.players[ref.p].graveyard.slice())
                        moveCard(g, g.cards[id], 'exile');
            break;
        case 'venomAttack': {
            const [id] = yield* pick(ours({ type: 'Creature', other: true }).map(c => c.id), '可犧牲另一生物');
            if (id !== undefined) {
                const n = manaValue(g.cards[id].def);
                sacrifice(g, g.cards[id]);
                drawCards(g, p, n);
                const options = player.hand.filter(id => !g.cards[id].def.types.some(t => t === 'Instant' || t === 'Sorcery') && manaValue(g.cards[id].def) <= n), [chosen] = yield* pick(options, '可將符合費用的永久物放進戰場');
                if (chosen !== undefined)
                    enterBattlefield(g, g.cards[chosen], p);
            }
            break;
        }
        case 'topLife':
            frontierFlags(g, p).webTopLife = 1;
            break;
        case '60': {
            const refs = ctx.targets.filter((r): r is {
                p: PID;
            } => !!r && 'p' in r);
            if (refs.length !== 2)
                break;
            const ids = refs.map(r => g.players[r.p].library[0]), mv = ids.map(id => id === undefined ? 0 : manaValue(g.cards[id].def));
            for (let i = 0; i < 2; i++)
                loseLife(g, refs[i].p, mv[1 - i]);
            yield* finalLook(g, p, ids.filter(id => id !== undefined), '展示牌庫頂牌');
            for (const id of ids)
                if (id !== undefined)
                    moveCard(g, g.cards[id], 'hand');
            break;
        }
        case 'harness':
            if (selfLive())
                (src.frontierMarks ??= {}).webHarnessedVersion = src.objectVersion ?? 0;
            break;
        case 'noirSurveil':
            if (ctx.ev?.type === 'attacks')
                yield* run([{ e: 'surveil', n: Object.values(counterKinds(g.cards[ctx.ev.card])).reduce((n, v) => n + v, 0) }]);
            break;
        case '74': {
            const who = resolveRef(g, ctx, 'T0').players[0];
            if (who !== undefined)
                loseLife(g, who, cards({ ctrl: 'opp', type: 'Creature' }).length);
            break;
        }
        case 'electroLeave': {
            let max = 0;
            while (max < 100 && canPayCost(g, p, parseCost('{' + (max + 1) + '}')))
                max++;
            const n = yield* mode('可支付X點法術力以造成X傷害（0略過）', Array.from({ length: max + 1 }, (_, i) => String(i)));
            if (n > 0 && payCost(g, p, parseCost('{' + n + '}')))
                reflex([{ e: 'damage', n, to: 'T0' }], [{ kind: 'player' }]);
            break;
        }
        case 'gwenImpulse': {
            const ids = impulse();
            for (const id of ids) {
                const c = g.cards[id];
                c.playableUntil = Number.MAX_SAFE_INTEGER;
                (c.frontierMarks ??= {}).webGwenSource = src.id;
                c.frontierMarks.webGwenVersion = src.objectVersion ?? 0;
            }
            break;
        }
        case '79': {
            const ids = player.library.slice(0, 2);
            for (const id of ids)
                moveCard(g, g.cards[id], 'exile');
            if (ids.length) {
                const [id] = yield* pick(ids, '選擇一張可使用至下回合結束', 1);
                permit(g.cards[id], g.turn + (g.active === p ? 2 : 1));
            }
            break;
        }
        case 'firstStrikeTargets':
            for (let i = 0; i < ctx.targets.length; i++)
                yield* run([{ e: 'pump', what: 'T' + i as 'T0', p: 1, t: 0, kw: ['first_strike'] }]);
            break;
        case 'forceAttack':
            for (const c of cards({ type: 'Creature' }))
                (c.frontierMarks ??= {}).webForceAttack = g.turn + (g.active === p ? 2 : 1);
            break;
        case '89':
            if (t) {
                const who = t.controller;
                dealDamage(g, src, p, { c: t.id }, 2);
                dealDamage(g, src, p, { p: who }, 2);
            }
            break;
        case 'verseCopy':
            if (!frontierFlags(g, p).webVerseUsed && (yield* yes('複製從手牌外施放的咒語？'))) {
                frontierFlags(g, p).webVerseUsed = 1;
                yield* webCopy(g, ctx, false, true);
            }
            break;
        case 'dinosaur':
            if (t)
                webAddTypes(t, ['Dinosaur'], false);
            break;
        case '96':
            if (yield* yes('放逐並可使用牌庫頂牌？')) {
                for (const c of Object.values(g.cards))
                    if (c.frontierMarks?.webFoesSource === src.id && c.frontierMarks?.webFoesVersion === src.objectVersion) {
                        c.playableTurn = undefined;
                        c.playableUntil = undefined;
                        delete c.eclCast;
                    }
                const ids = impulse();
                for (const id of ids) {
                    const c = g.cards[id];
                    c.playableUntil = Number.MAX_SAFE_INTEGER;
                    (c.frontierMarks ??= {}).webFoesSource = src.id;
                    c.frontierMarks.webFoesVersion = src.objectVersion ?? 0;
                }
            }
            break;
        case '98':
            if (t) {
                const attacking = t.attacking, who = t.controller, n = Math.max(0, stats(g, t).p);
                dealDamage(g, t, t.controller, { c: t.id }, n);
                if (attacking)
                    dealDamage(g, src, p, { p: who }, 2);
            }
            break;
        case '105':
            reflex([{ e: 'damage', n: { frontier: 'spm:final:graveGreatestPower' }, to: 'T0' }], [{ kind: 'creature' }]);
            break;
        case '106':
            if (t) {
                webForm(t, { types: ['Creature'], subtypes: ['Lizard'], colors: ['G'], power: 4, toughness: 4, keywords: [], abilities: [], produces: undefined }, true);
                t.eclLoseAbilities = true;
            }
            break;
        case 'camouflage':
            if (selfLive()) {
                webForm(src, { colors: [] });
                g.eot.push({ card: src.id, p: 0, t: 0, kw: ['hexproof'] });
            }
            break;
        case 'doubleSpiderCounters':
            for (const c of ours({ type: 'Creature' }).filter(c => c.def.subtypes?.includes('Spider') || c.def.supertypes?.includes('Legendary')))
                for (const [k, n] of Object.entries(counterKinds(c)))
                    counter(c, k === 'plus' ? '+1/+1' : k, n);
            break;
        case '109':
            yield* webDig(g, p, 5, { type: 'Creature' }, 2);
            break;
        case '112':
            if (src.zone === 'graveyard' && t?.zone === 'graveyard') {
                enterBattlefield(g, src, p, true);
                enterBattlefield(g, t, p, true);
            }
            break;
        case '113':
            yield* webMillPick(g, p, 3, { nonType: ['Instant', 'Sorcery'] });
            break;
        case '118':
            if (t)
                grant(t, [{ kind: 'trigger', on: 'dealtDamage', effects: [{ e: 'counters', what: 'self', n: { ev: true } }] }]);
            break;
        case '120':
            for (let i = 0; i < 2; i++) {
                const c = target('T' + i as 'T0'), victim = target('T2');
                if (c && victim) {
                    g.eot.push({ card: c.id, p: 1, t: 0, kw: [] });
                    dealDamage(g, c, c.controller, { c: victim.id }, Math.max(0, stats(g, c).p));
                }
            }
            break;
        case '122':
            yield* webDig(g, p, 5, { type: 'Creature' }, 1, 'battlefield');
            break;
        case '125':
            if (t?.zone === 'graveyard') {
                enterBattlefield(g, t, p);
                if ((t as Card).zone === 'battlefield') {
                    t.baseDef ??= t.def;
                    t.def = { ...t.def, abilities: [...(t.def.abilities ?? []), { kind: 'static', frontier: 'spm:final:mustAttack' }, { kind: 'trigger', on: 'combatDamagePlayer', effects: [{ e: 'sac', what: 'self' }] }] };
                    (t.frontierMarks ??= {}).permanentAnimation = 1;
                }
            }
            break;
        case '126': {
            const who = g.active;
            if (yield* yes('放置一個+1/+1指示物以加入無色法術力？', who)) {
                putCounters(g, src, 1, undefined, who);
                (g.players[who].pool ??= []).push(...Array(Math.max(0, src.counters)).fill('C'));
            }
            break;
        }
        case '128':
            drawCards(g, p, Math.max(0, 8 - player.hand.length));
            break;
        case '135':
            if (yield* yes('交換生命總量？')) {
                const old = player.life, amount = g.players[them].life, delta = amount - old;
                if (delta !== 0) {
                    const recipient = delta > 0 ? p : them, loser = delta > 0 ? them : p;
                    const before = g.players[recipient].life;
                    gainLife(g, recipient, Math.abs(delta));
                    // An exchange cannot happen if either player cannot make the change.
                    if (g.players[recipient].life === before)
                        break;
                    loseLife(g, loser, Math.abs(delta));
                    if (player.life < old)
                        drawCards(g, p, old - player.life);
                }
            }
            break;
        case '137':
            yield* webDig(g, p, 3, {}, 1, 'hand', false, false);
            break;
        case '141': {
            const a = target('T0'), b = target('T1');
            if (a?.zone === 'battlefield' && b?.zone === 'battlefield' && isCreature(a) && isCreature(b)) {
                const sa = stats(g, a), sb = stats(g, b);
                const needed = sa.kw.has('deathtouch') ? Math.min(1, Math.max(0, sb.t - b.damage)) : Math.max(0, sb.t - b.damage);
                const dealt = dealDamage(g, a, a.controller, { c: b.id }, sa.p);
                dealDamage(g, b, b.controller, { c: a.id }, sb.p);
                if (dealt > needed)
                    reflex([{ e: 'destroy', what: 'T0' }], [{ kind: 'permanent', optional: true, filter: { type: 'Artifact', nonType: 'Creature', mvMax: 3 } }]);
            }
            break;
        }
        case '144': {
            const ids = yield* pick(player.hand.slice(), '可棄一張牌');
            if (ids.length) {
                discardMany(g, ids.map(id => g.cards[id]));
                reflex([{ e: 'pump', what: 'T0', p: 0, t: 0 }, { e: 'frontier', action: 'spm:final:cantBlock' }], [{ kind: 'creature' }]);
            }
            break;
        }
        case 'cantBlock':
            if (t)
                (t.frontierMarks ??= {}).webCantBlockTurn = g.turn;
            break;
        case 'shriekDamage':
            if (ctx.ev?.type === 'dies')
                dealDamage(g, src, p, { p: ctx.ev.controller }, 1);
            break;
        case '153':
            for (let i = 0; i < 2; i++) {
                const c = target('T' + i as 'T0');
                if (c)
                    campusLink(g, src, c);
            }
            break;
        case 'spotReturn':
            if (src.zone === 'graveyard') {
                const entries = (src.campusLinked ?? []).slice();
                moveCard(g, src, 'library', true);
                if ((src as Card).zone === 'library')
                    for (const item of entries) {
                        const c = g.cards[item.id];
                        if (c?.zone === 'exile' && c.objectVersion === item.version)
                            moveCard(g, c, 'hand');
                    }
            }
            break;
        case '156': {
            const n = ctx.ev?.type === 'combatDamage' ? ctx.ev.amount : 0, ids = player.library.slice(0, n), [id] = yield* pick(ids, '選一張放進手上', ids.length ? 1 : 0);
            if (id !== undefined)
                moveCard(g, g.cards[id], 'hand');
            for (const x of ids)
                if (x !== id)
                    moveCard(g, g.cards[x], 'graveyard');
            break;
        }
        case 'grantSymbiote':
            if (t) {
                t.copiedAbilities = [...(t.copiedAbilities ?? []), { kind: 'trigger', on: 'combatDamagePlayer', effects: [E(156)] }];
            }
            break;
        case '163':
            yield* webMillPick(g, p, 4, { type: 'Creature' });
            break;
        case 'exileMana':
            for (let i = 0; i < 2; i++) {
                const col = ['W', 'U', 'B', 'R', 'G'][yield* mode('選擇放逐區施放專用法術力', ['白', '藍', '黑', '紅', '綠'])] as Color;
                (player.eclRestrictedMana ??= []).push({ mana: col, rule: 'webExile', source: src.id });
            }
            break;
        case '167':
            if (t) {
                webForm(t, { types: [...new Set([...t.def.types, 'Creature' as const])] });
                yield* run([{ e: 'setBase', what: 'T0', p: 3, t: 3 }]);
            }
            break;
        case '170':
            reflex([{ e: 'pump', what: 'T0', p: 0, t: 0, kw: ['unblockable'] }], [{ kind: 'creature', notSelf: true, filter: { attacking: true } }]);
            break;
        case '171': {
            const items = g.stack.filter(s => s.controller === p && s.kind !== 'spell' && !s.manaAbility);
            if (!items.length)
                break;
            const index = yield* mode('選擇己方起動或觸發異能', items.map(s => s.text)), item = items[index], targets = item.targetSpecs.length ? yield* chooseAbilityTargets(g, p, item) : item.targets;
            g.stack.push({ ...item, sid: g.nextSid++, targets, targetVersions: targets.map(t => t && 'c' in t ? g.cards[t.c].objectVersion : undefined) });
            break;
        }
        case 'destroyDamagedSpider':
            if (ctx.ev?.type === 'frontier' && ctx.ev.other !== undefined) {
                const victim = g.cards[ctx.ev.other];
                if (victim?.zone === 'battlefield' && victim.objectVersion === ctx.ev.webVersion && isCreature(victim))
                    yield* run([{ e: 'destroy', what: { all: { ids: [victim.id] } } }]);
            }
            break;
        case 'urbanRetreat':
            if (src.zone === 'hand')
                enterBattlefield(g, src, p, true);
            break;
        default: throw Error('Unimplemented SPM ' + key);
    }
    g.version++;
}
function* chooseAbilityTargets(g: GameState, p: PID, item: GameState['stack'][number]): SubFlow<(import('./types').TargetRef | null)[]> { const r: import('./types').Response = yield { type: 'targets', player: p, source: item.cardId, specs: item.targetSpecs, text: item.text, effects: item.effects }; return r.type === 'targets' ? r.targets : item.targets; }
