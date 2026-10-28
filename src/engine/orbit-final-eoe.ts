import { finalContext, finalCastCopy, finalTransferCounters } from './orbit-final-common';
import { copiableDefinition, isCreature, isLand, newCard, shuffleArr, stats, other } from './state';
import { moveCard, enterBattlefield, putCounters, drawCards, discardMany, destroyCards, sacrifice, dealDamage, loseLife, tapCard } from './zones';
import { runEffects, resolveRef, type Ctx } from './effects';
import { campusLink } from './campus';
import {} from './ecl';
import { getDef } from './registry';
import { frontierFlags } from './frontier-support';
import { manaValue, parseCost } from './mana';
import { canPayCost, payCost } from './actions';
import type { Card, Effect, GameState, SubFlow, Color } from './types';
export function* finalEoeEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, {
    e: 'frontier';
}>): SubFlow {
    const { p, src, player, them, key, E, run, cards, ours, pick, token, target, selfLive, permit, impulse, counter, grant, reflex, yes, mode } = finalContext(g, ctx, ef), t = target();
    if (key.startsWith('restricted:')) {
        const [, rule, mana] = key.split(':');
        for (const color of mana)
            (player.eclRestrictedMana ??= []).push({ mana: color as Color, rule: 'orbit' + rule, source: src.id });
        return;
    }
    switch (key) {
        case 'commandTap': {
            const ids = ours().filter(c => !c.tapped).map(c => c.id), [id] = yield* pick(ids, '可橫置一個永久物，否則犧牲此地');
            if (id !== undefined)
                tapCard(g, g.cards[id], p);
            else if (selfLive())
                sacrifice(g, src);
            break;
        }
        case 'ward1': {
            const item = g.stack.find(s => s.sid === ef.n);
            if (item) {
                const cost = parseCost('{1}');
                if (canPayCost(g, item.controller, cost) && (yield* yes('支付{1}守護？', item.controller)))
                    payCost(g, item.controller, cost);
                else if (!item.uncounterable && !g.cards[item.cardId].def.uncounterable) {
                    g.stack = g.stack.filter(s => s.sid !== item.sid);
                    if (item.kind === 'spell')
                        moveCard(g, g.cards[item.cardId], 'graveyard');
                }
            }
            break;
        }
        case 'steal':
            if (t) {
                t.returnControl = { player: t.controller, turn: g.turn };
                t.controller = p;
                t.sick = true;
            }
            break;
        case 'stealAll':
            for (const c of cards({ type: 'Creature' })) {
                c.returnControl = { player: c.controller, turn: g.turn };
                c.controller = p;
                c.sick = true;
            }
            break;
        case 'choraleReturn':
            if (t?.zone === 'graveyard') {
                enterBattlefield(g, t, p, true);
                t.attacking = true;
                t.attackTarget = null;
            }
            break;
        case '1': {
            const max = ours({ type: 'Land' }).length, ids = player.hand.filter(id => !g.cards[id].def.types.some(t => t === 'Instant' || t === 'Sorcery') && manaValue(g.cards[id].def) <= max), [id] = yield* pick(ids, '可將符合費用的永久物橫置放進戰場');
            if (id !== undefined)
                enterBattlefield(g, g.cards[id], p, true);
            break;
        }
        case '2':
            if (t?.zone === 'battlefield' && isCreature(t) && t.def.types.includes('Artifact'))
                putCounters(g, t, 1);
            break;
        case 'loyalty':
            if (selfLive())
                counter(src, 'loyalty');
            break;
        case 'emblem': {
            const c = newCard(g, { ...getDef('tok-or-tezzeret-emblem'), token: false }, p);
            c.zone = 'outside';
            (g.delayed ??= []).push({ source: c.id, controller: p, on: 'combatStart', once: false, persistent: true, targets: [{ kind: 'permanent', filter: { ctrl: 'you', type: 'Artifact' } }], effects: [E('tezEmblem')] });
            break;
        }
        case 'tezEmblem':
            if (t) {
                putCounters(g, t, 3);
                if (!isCreature(t))
                    yield* run([{ e: 'animate', what: 'T0', p: 0, t: 0, subtypes: ['Robot'], permanent: true }]);
            }
            break;
        case 'transferCounters':
            finalTransferCounters(g, ctx, t);
            break;
        case '24': {
            const ids = g.players[them].hand.slice(), [id] = yield* pick(ids, '放逐一張手牌，可持續使用', ids.length ? 1 : 0, 1, them);
            if (id !== undefined) {
                const c = g.cards[id];
                permit(c, Number.MAX_SAFE_INTEGER, them);
                (c.frontierMarks ??= {}).finalInquisitor = 1;
            }
            break;
        }
        case '27': {
            const ids = cards({ type: ['Artifact', 'Creature'], mvMax: 2 }).map(c => c.id);
            for (const id of ids) {
                if (!selfLive())
                    break;
                yield* run([{ e: 'exileLinked', what: { all: { ids: [id] } } }]);
            }
            break;
        }
        case 'starcage': {
            let n = 0;
            for (const c of Object.values(g.cards).filter(c => c.zone === 'exile' && c.exiledBy === src.id)) {
                c.exiledBy = undefined;
                moveCard(g, c, 'graveyard');
                if (c.zone === 'graveyard')
                    n++;
            }
            yield* token('tok-g-robot-22-', n);
            if (selfLive() && src.controller === p)
                sacrifice(g, src);
            break;
        }
        case '28': {
            const ids = player.library.slice(0, 5), [id] = yield* pick(ids.filter(id => g.cards[id].def.subtypes?.includes('Spacecraft')), '可展示一張太空船並放進手上');
            if (id !== undefined)
                moveCard(g, g.cards[id], 'hand');
            else if (selfLive())
                putCounters(g, src, 1);
            const rest = ids.filter(x => x !== id);
            shuffleArr(g, rest);
            for (const id of rest)
                moveCard(g, g.cards[id], 'library', true);
            break;
        }
        case '33': {
            const returned: Card[] = [];
            for (let i = 0; i < ctx.targets.length; i++) {
                const c = target(('T' + i) as 'T0');
                if (c?.zone === 'graveyard') {
                    enterBattlefield(g, c, p);
                    returned.push(c);
                }
            }
            for (const c of returned)
                if (c.zone === 'battlefield')
                    putCounters(g, c, 1);
            break;
        }
        case '54':
            if (t) {
                const attacking = t.attacking;
                moveCard(g, t, 'hand');
                if (attacking)
                    yield* token('tok-or-drone');
            }
            break;
        case '55': {
            if (!t || t.zone !== 'stack')
                break;
            const payer = t.controller, cost = parseCost('{2}');
            let paid = false;
            if (canPayCost(g, payer, cost) && (yield* yes('支付{2}避免被反擊？', payer)))
                paid = payCost(g, payer, cost);
            if (paid)
                yield* token('tok-lander');
            else
                yield* run([{ e: 'counter', what: 'T0' }]);
            break;
        }
        case '74': {
            const [id] = yield* pick(ours({ type: 'Artifact' }).map(c => c.id), '可犧牲一個神器');
            if (id !== undefined) {
                sacrifice(g, g.cards[id]);
                reflex([{ e: 'counters', what: 'T0', n: 1 }, { e: 'draw', n: 1 }], [{ kind: 'creature' }]);
            }
            break;
        }
        case '83':
            if (t) {
                const discounted = (t.manaSpent ?? 0) < manaValue(t.castFace ?? t.def);
                yield* run([{ e: 'counter', what: 'T0' }]);
                if (discounted)
                    drawCards(g, p, 1);
            }
            break;
        case '86': {
            const ids = [...player.hand, ...player.graveyard];
            for (const id of ids)
                moveCard(g, g.cards[id], 'library');
            shuffleArr(g, player.library);
            drawCards(g, p, 7);
            break;
        }
        case 'warpBottom':
            if (t?.zone === 'exile' && t.def.warp)
                moveCard(g, t, 'library', true);
            break;
        case '100':
            if (t) {
                const who = t.controller, damaged = t.frontierTakenTurn === g.turn && (t.frontierTaken ?? 0) > 0;
                destroyCards(g, [t]);
                if (!damaged)
                    drawCards(g, who, 2);
            }
            break;
        case '112':
            if (t)
                grant(t, [{ kind: 'trigger', on: 'dies', effects: [E('beckonerReturn')] }]);
            break;
        case 'beckonerReturn':
            if (src.zone === 'graveyard' && (ctx.sourceLinkKey === undefined || src.tmtLinkKey === ctx.sourceLinkKey))
                enterBattlefield(g, src, src.owner, true);
            break;
        case '113':
            if (t) {
                grant(t, [{ kind: 'trigger', on: 'dealtDamage', effects: [{ e: 'draw', n: { ev: true } }, { e: 'lose', who: 'you', n: { ev: true } }] }]);
                if (yield* yes('讓此神器對該生物造成1點傷害？', t.controller))
                    dealDamage(g, src, p, { c: t.id }, 1);
            }
            break;
        case '115': {
            const ids = cards({ ctrl: 'opp', type: 'Creature' }).map(c => c.id), [id] = yield* pick(ids, '選擇要放逐的生物', ids.length ? 1 : 0, 1, them);
            if (id !== undefined)
                campusLink(g, src, g.cards[id]);
            break;
        }
        case 'sotheraReturn': {
            const entries = (src.campusLinked ?? []).filter(e => g.cards[e.id]?.zone === 'exile' && g.cards[e.id].objectVersion === e.version && isCreature(g.cards[e.id]));
            if (selfLive() && src.controller === p)
                sacrifice(g, src);
            const [id] = yield* pick(entries.map(e => e.id), '將一張以此牌放逐的生物放進戰場', entries.length ? 1 : 0);
            if (id !== undefined) {
                (g.cards[id].finMarks ??= {}).enterCounters = 2;
                enterBattlefield(g, g.cards[id], p);
            }
            break;
        }
        case '127':
            if (t?.zone === 'graveyard') {
                enterBattlefield(g, t, p);
                if ((t as Card).zone === 'battlefield') {
                    t.baseDef ??= t.def;
                    t.def = { ...t.def, subtypes: [...new Set([...(t.def.subtypes ?? []), 'Skeleton'])] };
                    t.eclLoseAbilities = true;
                    (t.frontierMarks ??= {}).permanentAnimation = 1;
                }
            }
            break;
        case '128': {
            const n = ctx.x ?? 0, list = cards({ type: 'Creature' }).filter(c => stats(g, c).t <= n);
            destroyCards(g, list);
            loseLife(g, p, n);
            if (n >= 6) {
                const ids = list.filter(c => c.zone === 'graveyard').map(c => c.id), [id] = yield* pick(ids, '將本次死去的一個生物復活', ids.length ? 1 : 0);
                if (id !== undefined)
                    enterBattlefield(g, g.cards[id], p);
            }
            break;
        }
        case '132':
            if (t)
                for (let i = 0; i < (ctx.x ?? 0); i++) {
                    const made = yield* token(copiableDefinition(t));
                    for (const c of made) {
                        g.eot.push({ card: c.id, p: 0, t: 0, kw: ['haste'] });
                        c.sacAtEnd = true;
                        (c.frontierMarks ??= {}).orbitTempController = p + 1;
                    }
                }
            break;
        case 'charge5':
            if (t)
                counter(t, 'charge', 5);
            break;
        case '135':
            if (t?.frontierMarks?.finalWarped)
                yield* run([{ e: 'pump', what: 'T0', p: 0, t: 0, kw: ['trample', 'haste'] }]);
            break;
        case '138':
            for (const id of ctx.createdList ?? []) {
                const c = g.cards[id];
                (g.delayed ??= []).push({ source: id, controller: p, on: 'endStep', persistent: true, once: false, effects: [E('landerEnd', 'self', g.turn)] });
                if (c)
                    (c.frontierMarks ??= {}).finalLanderOwner = p + 1;
            }
            break;
        case 'landerEnd':
            if (g.turn > (ef.n ?? g.turn) && g.active === p) {
                if (selfLive() && src.controller === p)
                    sacrifice(g, src);
                g.delayed = g.delayed?.filter(d => !(d.source === src.id && d.effects.some(e => e.e === 'frontier' && e.action.endsWith(':landerEnd'))));
            }
            break;
        case 'sacCombat':
            for (const id of ctx.createdList ?? [])
                (g.delayed ??= []).push({ source: id, controller: p, on: 'endCombat', persistent: true, once: true, effects: [{ e: 'tmt', action: 'sacrificeSelf' }] });
            break;
        case '142': {
            const [id] = yield* pick(ours({ type: 'Artifact' }).map(c => c.id), '可犧牲神器以對所有生物造成2點傷害');
            if (id !== undefined) {
                sacrifice(g, g.cards[id]);
                reflex([{ e: 'damage', n: 2, to: { all: { type: 'Creature' } } }]);
            }
            break;
        }
        case '145':
            impulse(1 + (ctx.bdSac?.mana ?? 0));
            break;
        case '149':
            if (t) {
                const needed = Math.max(0, stats(g, t).t - t.damage), dealt = dealDamage(g, src, p, { c: t.id }, 6);
                if (dealt > needed)
                    yield* token('tok-lander');
            }
            break;
        case '151':
            if (ctx.ev?.type === 'damaged') {
                const c = g.cards[ctx.ev.card];
                dealDamage(g, c, c.controller, { p: other(c.controller) }, ctx.ev.amount);
            }
            break;
        case '153': {
            const id = player.library[0];
            if (id !== undefined) {
                const c = g.cards[id];
                moveCard(g, c, 'exile');
                (c.frontierMarks ??= {}).finalKavuPermission = p + 1;
            }
            break;
        }
        case 'castGraveCopy':
            if (t?.zone === 'graveyard') {
                moveCard(g, t, 'exile');
                yield* finalCastCopy(g, ctx, t);
            }
            break;
        case '161':
            if (t) {
                yield* run([E('steal'), { e: 'untap', what: 'T0' }, { e: 'pump', what: 'T0', p: 0, t: 0, kw: ['haste'] }]);
                if (t.def.subtypes?.includes('Spacecraft')) {
                    counter(t, 'charge', 10);
                    (g.delayed ??= []).push({ source: t.id, controller: p, on: 'eachEndStep', persistent: true, once: true, effects: [E('removeCharge10')] });
                }
            }
            break;
        case 'removeCharge10':
            if (selfLive())
                src.charge = Math.max(0, (src.charge ?? 0) - 10);
            break;
        case '163': {
            const ids = player.hand.filter(id => g.cards[id].def.types.some(t => t === 'Artifact' || t === 'Creature')), [id] = yield* pick(ids, '可將神器或生物放進戰場');
            if (id !== undefined) {
                const c = g.cards[id];
                enterBattlefield(g, c, p);
                c.baseDef ??= c.def;
                c.def = { ...c.def, keywords: [...(c.def.keywords ?? []), 'haste'], abilities: [...(c.def.abilities ?? []), { kind: 'trigger', on: 'leaves', effects: [{ e: 'damage', n: manaValue(c.def), to: { all: { type: 'Creature' } } }] }, { kind: 'trigger', on: 'endStep', effects: [{ e: 'sac', what: 'self' }] }] };
                (c.frontierMarks ??= {}).permanentAnimation = 1;
            }
            break;
        }
        case '164':
            if (yield* yes('讓對手派出兩個登陸艇？', them))
                yield* token('tok-lander', 2, them);
            else if (selfLive())
                putCounters(g, src, 2);
            break;
        case '165': {
            while (player.library.length) {
                const c = g.cards[player.library[0]];
                permit(c);
                if (!isLand(c))
                    break;
            }
            break;
        }
        case 'discardHandDraw2':
            if (yield* yes('棄掉手牌並抓兩張？')) {
                discardMany(g, player.hand.slice().map(id => g.cards[id]));
                drawCards(g, p, 2);
            }
            break;
        case '176': {
            const selected = ctx.orbitChoice, c = selected ? g.cards[selected.card] : undefined, chosen = c && selected ? (c.objectVersion === selected.version ? stats(g, c).p : c.orbitPowerHistory?.[selected.version]) : undefined;
            if (chosen !== undefined && t)
                dealDamage(g, src, p, { c: t.id }, Math.max(0, chosen));
            break;
        }
        case '182': {
            const n = stats(g, src).p, ids = player.library.slice(0, Math.max(0, n)), chosen = yield* pick(ids.filter(id => isLand(g.cards[id])), '可將任意數量的地橫置放進戰場', 0, ids.length);
            for (const id of chosen)
                enterBattlefield(g, g.cards[id], p, true);
            shuffleArr(g, player.library);
            break;
        }
        case '202':
            for (let i = 0; i < 4; i++) {
                const c = target(('T' + i) as 'T0');
                if (c?.zone === 'graveyard') {
                    if (i < 2)
                        moveCard(g, c, 'hand');
                    else
                        enterBattlefield(g, c, p, true);
                }
            }
            break;
        case '205':
            if (t) {
                const n = manaValue(t.def);
                destroyCards(g, [t]);
                if (n <= 2)
                    yield* token('tok-lander');
            }
            break;
        case '210':
            if (frontierFlags(g, p).finalTerraDraw)
                break;
            else if (ctx.ev?.type === 'counterPlaced' && (yield* yes('依放置的指示物數量抓牌？'))) {
                frontierFlags(g, p).finalTerraDraw = 1;
                drawCards(g, p, ctx.ev.amount);
            }
            break;
        case '212': {
            const artifacts = player.hand.filter(id => g.cards[id].def.types.includes('Artifact'));
            if (artifacts.length && (yield* mode('選擇棄牌方式', ['棄一張神器牌', '棄兩張牌'])) === 0) {
                const ids = yield* pick(artifacts, '棄一張神器牌', 1);
                discardMany(g, ids.map(id => g.cards[id]));
            }
            else
                yield* run([{ e: 'discard', who: 'you', n: 2 }]);
            break;
        }
        case '216': {
            const eligible = ours({ type: 'Creature', plusCounters: true });
            if (eligible.length < 2 || !(yield* yes('從兩個生物各移除一個指示物？')))
                break;
            const ids = yield* pick(eligible.map(c => c.id), '選擇兩個生物', 2, 2);
            for (const id of ids)
                g.cards[id].counters--;
            drawCards(g, p, 1);
            yield* token('tok-g-robot-22-');
            break;
        }
        case '217':
            yield* run([{ e: 'setBase', what: 'T0', p: ours({ type: 'Land' }).length >= 6 ? 6 : 3, t: ours({ type: 'Land' }).length >= 6 ? 6 : 3 }]);
            break;
        case '222': {
            const even = (yield* mode('選擇奇數或偶數', ['奇數', '偶數'])) === 1;
            destroyCards(g, cards({ type: 'Creature' }).filter(c => (manaValue(c.def) % 2 === 0) === even));
            yield* run([E('stealAll'), { e: 'untap', what: { all: { type: 'Creature' } } }, { e: 'pump', what: { all: { type: 'Creature' } }, p: 0, t: 0, kw: ['haste'] }]);
            break;
        }
        case '228':
            for (const ref of ctx.targets)
                if (ref && 'p' in ref)
                    yield* runEffects(g, { ...ctx, targets: [ref] }, [{ e: 'mill', who: 'T0', n: Math.floor(g.players[ref.p].library.length / 2) }]);
            break;
        case '233': {
            const m = src.frontierMarks ??= {};
            if (m.finalTannukTurn !== g.turn) {
                m.finalTannukTurn = g.turn;
                m.finalTannukCount = 0;
            }
            m.finalTannukCount++;
            if (m.finalTannukCount === 2)
                drawCards(g, p, 1);
            break;
        }
        case 'graveBottom':
            if (t?.zone === 'graveyard')
                moveCard(g, t, 'library', true);
            break;
        case 'exileOpponentGrave':
            for (const id of g.players[them].graveyard.slice())
                moveCard(g, g.cards[id], 'exile');
            break;
        case 'dominion': {
            const eq = g.cards[ef.n ?? -1], who = resolveRef(g, ctx, 'T0').players[0];
            if (!eq || who === undefined)
                break;
            g.playerControl = { controller: p, player: who, whole: true, starts: g.turn + 1, ends: g.turn + 3 };
            break;
        }
        case '240':
            player.life = 10;
            break;
        case '257': {
            const n = ctx.orbitTappedCount ?? 0;
            if (t)
                g.eot.push({ card: t.id, p: n, t: 0, kw: [] });
            break;
        }
        case '248':
            if (ctx.ev?.type === 'combatDamage') {
                const who = ctx.ev.player;
                g.players[who].poison = (g.players[who].poison ?? 0) + 2;
            }
            break;
        default: throw Error('Unimplemented EOE action ' + key);
    }
    g.version++;
}
