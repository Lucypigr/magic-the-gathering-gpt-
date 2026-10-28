import { finalContext, finalLook, finalCastCopy, finalBehold, finalCopyUntilEnd, finalEntryReanimate, finalSearch, finalTransferCounters } from './orbit-final-common';
import { copiableDefinition, isCreature, isLand, matches, randInt, shuffleArr, stats } from './state';
import { moveCard, enterBattlefield, putCounters, drawCards, discardMany, destroyCards, sacrifice, dealDamage, loseLife, gainLife } from './zones';
import { runEffects, resolveRef, type Ctx } from './effects';
import { freeCast } from './tla';
import {} from './ecl';
import { frontierFlags } from './frontier-support';
import { colorsOf, manaValue } from './mana';
import { counterKinds } from './ecl-support';
import type { Effect, GameState, SubFlow, PID, Card, Color } from './types';
export function* finalTdmEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, {
    e: 'frontier';
}>): SubFlow {
    const { p, src, player, them, key, E, run, cards, ours, pick, token, target, selfLive, permit, impulse, counter, grant, reflex, yes, mode } = finalContext(g, ctx, ef), t = target();
    switch (key) {
        case '1': {
            const ids = player.library.filter(id => !isLand(g.cards[id]) && colorsOf(g.cards[id].def).length === 0), chosen = yield* pick(ids, '可搜尋任意數量無色非地牌', 0, ids.length);
            for (const id of chosen) {
                permit(g.cards[id]);
                g.cards[id].eclCast = { by: p, free: true, until: g.turn };
            }
            shuffleArr(g, player.library);
            break;
        }
        case 'exileTargets':
            for (let i = 0; i < ctx.targets.length; i++) {
                const c = target(('T' + i) as 'T0');
                if (c)
                    moveCard(g, c, 'exile');
            }
            break;
        case '50': {
            const ids = player.graveyard.filter(id => isCreature(g.cards[id])), [id] = yield* pick(ids, '可放逐一張生物牌以取回瞬間或法術');
            if (id !== undefined) {
                moveCard(g, g.cards[id], 'exile');
                reflex([{ e: 'toHand', what: 'T0' }], [{ kind: 'gyCard', filter: { ctrl: 'you', type: ['Instant', 'Sorcery'] } }]);
            }
            break;
        }
        case '52':
            if (t) {
                const template = copiableDefinition(t);
                for (const c of ours({ type: 'Creature' }))
                    if (c.id !== t.id)
                        finalCopyUntilEnd(g, c, template);
            }
            break;
        case '59':
            if (!player.library.length) {
                if (selfLive())
                    moveCard(g, src, 'exile');
                const ids = yield* pick(player.graveyard.slice(), '選擇五張牌置於牌庫頂', Math.min(5, player.graveyard.length), 5);
                for (const id of ids.slice().reverse()) {
                    moveCard(g, g.cards[id], 'library');
                    const i = player.library.indexOf(id);
                    player.library.splice(i, 1);
                    player.library.unshift(id);
                }
            }
            break;
        case '60': {
            const ev = ctx.ev;
            if (ev?.type !== 'cast')
                break;
            const c = g.cards[ev.card];
            if (c.zone !== 'stack')
                break;
            moveCard(g, c, 'exile');
            (c.eclCounters ??= {}).time = 4;
            (c.frontierMarks ??= {}).finalSuspended = 1;
            (g.delayed ??= []).push({ source: c.id, controller: c.owner, on: 'upkeep', persistent: true, once: false, effects: [E('suspendTick')] });
            break;
        }
        case 'suspendTick':
            if (src.zone === 'exile' && src.frontierMarks?.finalSuspended) {
                src.eclCounters!.time = Math.max(0, (src.eclCounters?.time ?? 0) - 1);
                if (!src.eclCounters?.time) {
                    delete src.frontierMarks.finalSuspended;
                    g.delayed = g.delayed?.filter(d => !(d.source === src.id && d.effects.some(e => e.e === 'frontier' && e.action.endsWith(':suspendTick'))));
                    reflex([E('suspendCast')]);
                }
            }
            break;
        case 'suspendCast':
            if (src.zone === 'exile') {
                if (yield* freeCast(g, ctx, src, true))
                    (src.frontierMarks ??= {}).finalSuspendHaste = p + 1;
            }
            break;
        case '73': {
            const n = player.graveyard.filter(id => isCreature(g.cards[id])).length;
            const made = yield* token('tok-warrior-r11', n, p, { tapped: true, attacking: true });
            for (const c of made) {
                c.sacAtEnd = true;
                (c.frontierMarks ??= {}).orbitTempController = p + 1;
            }
            break;
        }
        case '78':
            if (t && t.zone === 'battlefield') {
                grant(t, [{ kind: 'trigger', on: 'dies', effects: [{ e: 'frontier', action: 'tdm:final:measuresDraw', n: p }] }]);
            }
            break;
        case 'measuresDraw':
            if (ctx.ev?.type === 'dies' && ctx.ev.controller === ef.n)
                drawCards(g, ef.n as PID, 2);
            break;
        case 'decay':
            (g.delayed ??= []).push({ source: src.id, controller: p, on: 'endCombat', once: true, persistent: true, effects: [E('sacDecay')] });
            break;
        case 'sacDecay':
            if (selfLive() && src.controller === p)
                sacrifice(g, src);
            break;
        case '87':
            for (let i = 0; i < ctx.targets.length; i++) {
                const c = target(('T' + i) as 'T0');
                if (c)
                    counter(c, 'decayed');
            }
            break;
        case '91': {
            const c = ctx.ev?.type === 'etb' ? g.cards[ctx.ev.card] : undefined;
            if (c?.zone === 'battlefield') {
                destroyCards(g, [c]);
                yield* token('tok-or-zombie');
            }
            break;
        }
        case '92':
            if (t && t.zone === 'graveyard' && manaValue(t.def) === (ctx.bdSac?.mana ?? -2) + 1)
                enterBattlefield(g, t, p);
            break;
        case '111':
            if (t) {
                const who = t.controller;
                destroyCards(g, [t]);
                for (const c of yield* finalSearch(g, who, { type: 'Land', basic: true }, 'battlefield', 1, true))
                    counter(c, 'stun');
            }
            break;
        case '101': {
            let found: Card | undefined;
            while (player.library.length) {
                const c = g.cards[player.library[0]];
                moveCard(g, c, 'exile');
                if (!isLand(c)) {
                    found = c;
                    break;
                }
            }
            if (found) {
                let cast = false;
                if (manaValue(found.def) <= 8 && (yield* yes('免費施放這張牌？')))
                    cast = yield* freeCast(g, ctx, found, true);
                if (!cast && found.zone === 'exile')
                    moveCard(g, found, 'hand');
            }
            break;
        }
        case 'impulseNext':
            impulse(ef.n ?? 1, g.turn + (g.active === p ? 2 : 1));
            break;
        case '118':
            if (yield* finalBehold(g, p))
                yield* token('tok-treasure');
            break;
        case 'sarkhanDragon':
            if (selfLive()) {
                g.eot.push({ card: src.id, p: 0, t: 0, kw: ['flying'] });
                src.baseDef ??= src.def;
                src.def = { ...src.def, subtypes: [...new Set([...(src.def.subtypes ?? []), 'Dragon'])] };
            }
            break;
        case 'storm': {
            const n = Math.max(0, g.players[0].spellsThisTurn + g.players[1].spellsThisTurn - 1);
            for (let i = 0; i < n; i++)
                yield* run([{ e: 'copySpell' }]);
            break;
        }
        case '127': {
            const ids = yield* pick(player.hand.slice(), '可棄至多兩張牌', 0, 2);
            discardMany(g, ids.map(id => g.cards[id]));
            drawCards(g, p, ids.length);
            break;
        }
        case 'tersaPlay':
            if (player.graveyard.length) {
                const id = player.graveyard[randInt(g, player.graveyard.length)];
                permit(g.cards[id]);
            }
            break;
        case '136': {
            const selected = yield* pick(player.library.filter(id => matches(g, { type: 'Land', basic: true, sub: 'Forest' }, g.cards[id], p)), '搜尋至多兩張基本樹林', 0, 2);
            if (selected.length) {
                const [land] = yield* pick(selected, '選一張橫置放進戰場', 1);
                if (land !== undefined)
                    enterBattlefield(g, g.cards[land], p, true);
                for (const id of selected)
                    if (id !== land)
                        moveCard(g, g.cards[id], 'hand');
            }
            shuffleArr(g, player.library);
            break;
        }
        case '144':
            if (t)
                grant(t, [{ kind: 'trigger', on: 'combatDamagePlayer', effects: [{ e: 'draw', n: 1 }] }]);
            break;
        case '150':
            yield* finalSearch(g, p, { type: 'Creature', mvMax: ctx.x ?? 0 }, 'battlefield');
            break;
        case '153': {
            for (let i = 0; i < 2; i++) {
                const c = target(('T' + i) as 'T0');
                if (c?.zone === 'graveyard')
                    moveCard(g, c, 'hand');
            }
            const who = resolveRef(g, ctx, 'T2').players[0];
            if (who !== undefined) {
                for (let i = 3; i < 7; i++) {
                    const c = target(('T' + i) as 'T0');
                    if (c?.zone === 'graveyard' && c.owner === who)
                        moveCard(g, c, 'library');
                }
                shuffleArr(g, g.players[who].library);
            }
            break;
        }
        case 'vigilanceCounters':
            yield* run([{ e: 'pump', what: { all: { ctrl: 'you', type: 'Creature', hasCounters: true } }, p: 0, t: 0, kw: ['vigilance', 'trample'] }]);
            break;
        case '166': {
            const c = ctx.ev?.type === 'etb' ? g.cards[ctx.ev.card] : undefined;
            if (c?.zone === 'battlefield') {
                const n = Object.values(counterKinds(src)).reduce((a, b) => a + b, 0), sub = runEffects(g, { ...ctx, source: c.id, sourceLinkKey: c.tmtLinkKey }, [{ e: 'endure', n }]);
                yield* sub;
            }
            break;
        }
        case '167':
            if (g.active === p && (g.phase === 'main1' || g.phase === 'main2')) {
                g.extraCombat = { player: p, landOnly: false, mainPhases: (g.extraCombat?.mainPhases ?? 0) + 1, count: (g.extraCombat?.count ?? 0) + 1 };
                (g.delayed ??= []).push({ source: src.id, controller: p, on: 'youAttack', once: true, effects: [{ e: 'untap', what: mineRef }] });
            }
            break;
        case '170': {
            const ids = yield* pick(player.hand.slice(), '可棄一張牌取回生物或地');
            if (ids.length) {
                discardMany(g, ids.map(id => g.cards[id]));
                reflex([{ e: 'toHand', what: 'T0' }], [{ kind: 'gyCard', filter: { ctrl: 'you', type: ['Creature', 'Land'] } }]);
            }
            break;
        }
        case '172': {
            const total = () => ours({ type: 'Creature' }).reduce((n, c) => n + stats(g, c).t, 0);
            if (total() >= 10)
                drawCards(g, p, 1);
            if (total() >= 20)
                yield* run([{ e: 'untap', what: mineRef }]);
            if (total() >= 40)
                loseLife(g, them, Math.ceil(g.players[them].life / 2));
            break;
        }
        case '174': {
            const placed = new Set<number>();
            for (const color of ['W', 'U', 'B', 'R', 'G'] as Color[]) {
                const ids = ours({ sub: 'Dragon' }).filter(c => colorsOf(c.def).includes(color)).map(c => c.id);
                if (!ids.length)
                    continue;
                const [id] = yield* pick(ids, '選擇' + color + '色龍以放置指示物', 1);
                if (id !== undefined && putCounters(g, g.cards[id], 1) > 0)
                    placed.add(id);
            }
            if (placed.size === 5)
                g.winner = p;
            break;
        }
        case '176': {
            const doomed = cards({ type: ['Creature', 'Enchantment'] }), before = new Set(doomed.map(c => c.id));
            destroyCards(g, doomed);
            drawCards(g, p, [...before].filter(id => g.cards[id].zone !== 'battlefield').length);
            break;
        }
        case '184': {
            const ids = ours({ nonType: 'Land' }).map(c => c.id), [id] = yield* pick(ids, '可犧牲非地永久物');
            if (id !== undefined) {
                sacrifice(g, g.cards[id]);
                reflex([{ e: 'counters', what: mineRef, n: 1 }]);
            }
            break;
        }
        case 'nextCopy':
            frontierFlags(g, p).finalNextCopy = (frontierFlags(g, p).finalNextCopy ?? 0) + 1;
            break;
        case '188': {
            const ids = yield* pick(player.hand.slice(), '可棄一張牌');
            if (ids.length) {
                const c = g.cards[ids[0]], land = isLand(c);
                discardMany(g, [c]);
                if (!land)
                    reflex([{ e: 'damage', n: 3, to: 'T0' }], [{ kind: 'creature' }]);
            }
            break;
        }
        case '193':
            finalTransferCounters(g, ctx, t);
            break;
        case 'counterFlying':
            if (t)
                counter(t, 'flying');
            break;
        case '202': {
            const ev = ctx.ev;
            if (ev?.type !== 'combatDamage')
                break;
            const ids = g.players[ev.player].library.slice(0, ev.amount);
            for (const id of ids)
                moveCard(g, g.cards[id], 'exile');
            let options = ids.filter(id => !isLand(g.cards[id]) && manaValue(g.cards[id].def) <= ev.amount);
            while (options.length) {
                const [id] = yield* pick(options, '可免費施放其中一張牌');
                if (id === undefined)
                    break;
                options = options.filter(x => x !== id);
                yield* freeCast(g, ctx, g.cards[id], true);
            }
            break;
        }
        case '203': {
            const c = target('T0'), victim = target('T1');
            if (!c || c.zone !== 'graveyard')
                break;
            const n = stats(g, c).p;
            moveCard(g, c, 'hand');
            if (victim)
                dealDamage(g, src, p, { c: victim.id }, Math.max(0, n));
            break;
        }
        case '204':
            for (const color of ['B', 'G', 'U'] as Color[])
                yield* finalSearch(g, p, { color }, 'graveyard');
            break;
        case '206': {
            const entries = Object.values(g.cards).filter(c => c.zone === 'exile' && c.exiledBy === src.id).map(c => c.id);
            for (const id of entries) {
                const c = g.cards[id];
                if (c?.zone !== 'exile')
                    continue;
                const made = yield* token(copiableDefinition(c), 1, p, { tapped: true, attacking: true });
                for (const t of made) {
                    (g.delayed ??= []).push({ source: t.id, controller: p, on: 'endStep', until: p, persistent: true, once: true, effects: [{ e: 'tmt', action: 'sacrificeSelf' }] });
                }
            }
            break;
        }
        case '211': {
            const ids = Object.values(g.cards).filter(c => c.zone === 'battlefield' || c.zone === 'stack' || g.stack.some(s => s.cardId === c.id)).map(c => c.id);
            const [id] = yield* pick(ids, '選擇下次要防止其傷害的來源', ids.length ? 1 : 0);
            if (id !== undefined)
                (g.orbitShields ??= []).push({ player: p, source: id, link: g.cards[id].tmtLinkKey, spell: src.id, turn: g.turn });
            break;
        }
        case '212':
            if (t?.zone === 'graveyard')
                finalEntryReanimate(g, t, p, { finalEntryHexproof: 1, finalEntryIndestructible: 1 });
            break;
        case '222': {
            const who = resolveRef(g, ctx, 'T0').players[0];
            if (who === undefined)
                break;
            yield* finalLook(g, p, g.players[who].hand.slice(), '對手展示手牌');
            const [id] = yield* pick(g.players[who].hand.filter(id => !isLand(g.cards[id])), '可放逐一張非地牌');
            if (id !== undefined) {
                const c = g.cards[id];
                (src.frontierMarks ??= {}).finalPriestOwner = c.owner + 1;
                src.frontierMarks.finalPriestMv = manaValue(c.def);
                moveCard(g, c, 'exile');
            }
            break;
        }
        case 'priestSpirit': {
            const who = (src.frontierMarks?.finalPriestOwner ?? 0) - 1, n = src.frontierMarks?.finalPriestMv ?? 0;
            if (who >= 0)
                yield* token({ id: 'tok-or-spirit', name: 'Spirit', set: 'TOK', rarity: 'T', types: ['Creature'], subtypes: ['Spirit'], colors: ['W'], power: n, toughness: n, text: '' }, 1, who as PID);
            break;
        }
        case 'castGraveCopy':
            if (t?.zone === 'graveyard') {
                moveCard(g, t, 'exile');
                yield* finalCastCopy(g, ctx, t);
            }
            break;
        case '225':
            if (t?.zone === 'graveyard')
                (t.frontierMarks ??= {}).finalHarmonize = g.turn;
            break;
        case '226': {
            const ref = ctx.targets[0];
            if (!ref)
                break;
            const dealt = dealDamage(g, src, p, ref, 2);
            gainLife(g, p, 2);
            if ('p' in ref && dealt > 0)
                yield* run([{ e: 'discard', who: 'T0', n: 1 }]);
            break;
        }
        case 'drainEtbTurn':
            (g.delayed ??= []).push({ source: src.id, controller: p, on: 'allyEtb', once: false, effects: [{ e: 'lose', who: 'opp', n: 1 }, { e: 'gain', n: 1 }] });
            break;
        case '236':
            reflex([{ e: 'reanimate', what: 'T0' }], [{ kind: 'gyCard', filter: { ctrl: 'you', type: 'Creature', mvMax: 3 } }]);
            break;
        case '253':
            (g.delayed ??= []).push({ source: src.id, controller: p, on: 'youAttack', once: false, effects: [{ e: 'token', token: 'tok-warrior-r11', n: 2, tapped: true, attacking: true, temp: true }] });
            break;
        case 'dragonOmenMana': {
            const colors: Color[] = ['W', 'U', 'B', 'R', 'G'], color = colors[yield* mode('選擇龍或預兆咒語專用的法術力', colors)] ?? 'W';
            (player.eclRestrictedMana ??= []).push({ mana: color, rule: 'orbitDragonOmen', source: src.id });
            break;
        }
        case 'decayCounterSac':
            if (selfLive() && src.controller === p)
                sacrifice(g, src);
            break;
        default: throw Error('Unimplemented TDM action ' + key);
    }
    g.version++;
}
const mineRef = { all: { ctrl: 'you' as const, type: 'Creature' as const } };
