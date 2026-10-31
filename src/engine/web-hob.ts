import { finalContext, finalLook } from './orbit-final-common';
import { webAddTypes, webForm, webDig, webMillPick } from './web-shire';
import { copiableDefinition, isCreature, isLand, uncounterableSpells, matches, randInt, shuffleArr, stats } from './state';
import { moveCard, enterBattlefield, putCounters, drawCards, discardMany, destroyCards, sacrifice, dealDamage, loseLife, gainLife, emit } from './zones';
import { runEffects, resolveRef, type Ctx } from './effects';
import { freeCast } from './tla';
import { frontierFlags } from './frontier-support';
import { webStory } from './web-shire-support';
import { manaValue } from './mana';
import { finalSearch } from './orbit-final-common';
import type { Effect, GameState, SubFlow, Card, Color } from './types';
export function* webHobEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, {
    e: 'frontier';
}>): SubFlow {
    const { p, src, player, them, key, run, cards, ours, pick, token, target, selfLive, permit, counter, reflex, yes, mode } = finalContext(g, ctx, ef), t = target();
    switch (key) {
        case '3': {
            const ids = player.library.filter(id => matches(g, { type: 'Land', basic: true }, g.cards[id], p)), chosen = yield* pick(ids, '可搜尋至多兩張基本地', 0, 2);
            if (chosen.length) {
                const [id] = yield* pick(chosen, '選擇一張橫置放進戰場', 1);
                enterBattlefield(g, g.cards[id], p, true);
                for (const x of chosen)
                    if (x !== id)
                        moveCard(g, g.cards[x], 'hand');
            }
            shuffleArr(g, player.library);
            break;
        }
        case '4': {
            const m = src.frontierMarks ??= {};
            if (m.webBelladonnaTurn !== g.turn) {
                m.webBelladonnaTurn = g.turn;
                m.webBelladonna = 0;
            }
            m.webBelladonna++;
            if (m.webBelladonna === 1)
                gainLife(g, p, 1);
            else if (m.webBelladonna === 2)
                drawCards(g, p, 1);
            else if (m.webBelladonna === 3)
                for (const c of ours({ type: 'Creature' }))
                    putCounters(g, c, 1);
            break;
        }
        case 'gift':
            if (ctx.webGift)
                yield* token('tok-treasure', 1, them);
            break;
        case '5':
            if (ctx.webGift)
                for (const who of [p, them])
                    frontierFlags(g, who).webNoCast = 1;
            break;
        case '12': {
            let n = 0;
            for (const ref of ctx.targets) {
                if (!ref || !('c' in ref))
                    continue;
                const c = g.cards[ref.c];
                if (c.zone === 'battlefield' && c.owner === p) {
                    moveCard(g, c, 'hand');
                    if ((c as Card).zone === 'hand')
                        n++;
                }
            }
            if (n)
                (g.delayed ??= []).push({ source: src.id, controller: p, on: 'eachUpkeep', persistent: true, once: true, effects: [{ e: 'token', token: 'tok-ws-bird', n }] });
            break;
        }
        case '21':
            for (const c of ours({ type: 'Creature' }))
                if (c.id !== t?.id)
                    putCounters(g, c, 1);
            break;
        case '25': {
            const ids = player.library.filter(id => matches(g, { type: 'Land', basic: true, sub: 'Plains' }, g.cards[id], p)), chosen = yield* pick(ids, '可搜尋至多兩張基本平原', 0, 2);
            for (const id of chosen) {
                moveCard(g, g.cards[id], 'exile');
                (src.meadowLinked ??= []).push(id);
            }
            shuffleArr(g, player.library);
            break;
        }
        case 'roadsHand': {
            const ids = (src.meadowLinked ?? []).filter(id => g.cards[id].zone === 'exile'), [id] = yield* pick(ids, '將一張以此傳紀放逐的牌放進手上', ids.length ? 1 : 0);
            if (id !== undefined)
                moveCard(g, g.cards[id], 'hand');
            break;
        }
        case 'roadsAttack':
            (g.delayed ??= []).push({ source: src.id, controller: p, on: 'youAttack', once: false, targets: [{ kind: 'creature', filter: { ctrl: 'you' } }], effects: [{ e: 'pump', what: 'T0', p: { count: { ctrl: 'you', sub: 'Plains' } }, t: { count: { ctrl: 'you', sub: 'Plains' } } }] });
            break;
        case '26': {
            const who = resolveRef(g, ctx, 'T0').players[0];
            if (who === undefined)
                break;
            const list = cards({ type: 'Creature', attacking: true }).filter(c => c.controller === who), n = list.length;
            for (const c of list)
                moveCard(g, c, 'exile');
            yield* finalSearch(g, who, { type: 'Land', basic: true }, 'battlefield', n, true);
            break;
        }
        case 'artifactUntilEnd':
            if (t)
                webForm(t, { types: [...new Set([...t.def.types, 'Artifact' as const])] });
            break;
        case '31':
            if (t?.def.subtypes?.includes('Dwarf')) {
                const [id] = yield* pick(ours({ sub: 'Equipment' }).map(c => c.id), '可附著一個武具');
                if (id !== undefined)
                    g.cards[id].attachedTo = t.id;
            }
            break;
        case 'exchange': {
            const a = target('T0'), b = target('T1');
            if (a && b && a.def.types.some(type => b.def.types.includes(type))) {
                const who = a.controller;
                a.controller = b.controller;
                b.controller = who;
                a.sick = b.sick = true;
                emit(g, { type: 'fin', action: 'controlChange', card: a.id, player: a.controller, amount: who });
                emit(g, { type: 'fin', action: 'controlChange', card: b.id, player: b.controller, amount: a.controller });
            }
            break;
        }
        case '33': {
            const ids = player.graveyard.filter(id => g.cards[id].def.types.some(t => t === 'Artifact' || t === 'Instant' || t === 'Sorcery')), [id] = yield* pick(ids, '可從墓地施放一個神器、瞬間或法術');
            if (id !== undefined) {
                const c = g.cards[id];
                c.finExileOnResolve = c.def.types.some(t => t === 'Instant' || t === 'Sorcery');
                yield* freeCast(g, ctx, c, false);
            }
            break;
        }
        case 'removeAttachedCounters':
            {
                const c = g.cards[src.attachedTo ?? -1];
                if (c) {
                    c.counters = 0;
                    c.stun = 0;
                    c.charge = 0;
                    c.hexproofCounters = 0;
                    c.finality = false;
                    c.finalityCount = 0;
                    c.loyalty = 0;
                    c.lore = 0;
                    c.eclCounters = {};
                }
            }
            break;
        case '41': {
            const owner = src.owner;
            if (src.zone === 'battlefield') {
                moveCard(g, src, 'library');
                shuffleArr(g, g.players[owner].library);
                drawCards(g, owner, 3);
            }
            break;
        }
        case 'millPickSpell4':
            yield* webMillPick(g, p, 4, { type: ['Instant', 'Sorcery'] });
            break;
        case 'linkedHexproof':
        case 'linkedFog':
            if (t) {
                const m = t.frontierMarks ??= {};
                m[key === 'linkedHexproof' ? 'webHexproofSource' : 'webFogSource'] = src.id + 1;
                m[key === 'linkedHexproof' ? 'webHexproofVersion' : 'webFogVersion'] = src.objectVersion ?? 0;
            }
            break;
        case '53': {
            const ids = player.library.slice(0, 4), faceUp = yield* pick(ids, '將任意張牌分成公開的一堆，其餘為隱藏的一堆', 0, ids.length), faceDown = ids.filter(id => !faceUp.includes(id));
            yield* finalLook(g, them, faceUp, '公開的牌堆');
            const selected = (yield* mode('選擇要讓對手拿到手上的牌堆', ['公開牌堆（' + faceUp.length + '張）', '隱藏牌堆（' + faceDown.length + '張）'], them)) === 0 ? faceUp : faceDown;
            for (const id of ids)
                moveCard(g, g.cards[id], selected.includes(id) ? 'hand' : 'graveyard');
            break;
        }
        case '55': {
            const n = t ? manaValue(t.castFace ?? t.def) : Infinity;
            yield* run([{ e: 'counter', what: 'T0' }]);
            if (n <= 2)
                yield* run([{ e: 'recruit' }]);
            break;
        }
        case '56':
            if (t?.zone === 'stack') {
                const item = g.stack.find(s => s.kind === 'spell' && s.cardId === t.id), permanent = !t.castFace?.types.some(type => type === 'Instant' || type === 'Sorcery') && !t.def.types.some(type => type === 'Instant' || type === 'Sorcery');
                if (item && !uncounterableSpells(g, item.controller) && !item.uncounterable && !t.def.uncounterable) {
                    if (permanent) {
                        g.stack = g.stack.filter(s => s !== item);
                        permit(t, Number.MAX_SAFE_INTEGER);
                        t.eclCast = { by: p, free: true };
                    }
                    else
                        yield* run([{ e: 'counter', what: 'T0' }]);
                }
            }
            break;
        case '57':
            if (ctx.ev?.type === 'cast' && (yield* yes('依施放所花法術力抓牌，然後棄兩張？'))) {
                drawCards(g, p, g.cards[ctx.ev.card].manaSpent ?? 0);
                yield* run([{ e: 'discard', who: 'you', n: 2 }]);
            }
            break;
        case '61':
            if (t) {
                const who = t.controller, n = Math.max(0, stats(g, t).p);
                destroyCards(g, [t]);
                yield* runEffects(g, { ...ctx, controller: who }, [{ e: 'amass', n }]);
                if (who === p)
                    drawCards(g, p, 1);
            }
            break;
        case 'minusEach': {
            const who = resolveRef(g, ctx, 'T0').players[0];
            if (who !== undefined)
                yield* run([{ e: 'pump', what: { all: { ctrl: who === p ? 'you' : 'opp', type: 'Creature' } }, p: -1, t: -1 }]);
            break;
        }
        case '70': {
            const used = src.chosenModes ?? [], available = [0, 1, 2].filter(i => !used.includes(i));
            if (!available.length)
                break;
            const index = yield* mode('選擇尚未選過的模式', available.map(i => ['放置指示物', '吸取兩點生命', '抓牌'][i])), pick = available[index];
            src.chosenModes = [...used, pick];
            if (pick === 0)
                putCounters(g, src, 1);
            else if (pick === 1) {
                loseLife(g, them, 2);
                gainLife(g, p, 2);
            }
            else
                drawCards(g, p, 1);
            break;
        }
        case '76': {
            const ids = g.players[them].library.slice(0, ctx.x ?? 0);
            for (const id of ids) {
                permit(g.cards[id]);
                (g.cards[id].frontierMarks ??= {}).webLifePermission = p + 1;
            }
            break;
        }
        case '82': {
            const [id] = yield* pick(ours({ type: 'Creature', other: true }).map(c => c.id), '可犧牲另一生物');
            if (id !== undefined) {
                const n = Math.max(0, stats(g, g.cards[id]).p);
                sacrifice(g, g.cards[id]);
                if (selfLive())
                    putCounters(g, src, n);
            }
            break;
        }
        case 'amassLastPower':
            yield* run([{ e: 'amass', n: Math.max(0, ctx.lkiPower ?? (ctx.ev?.type === 'dies' ? ctx.ev.power : src.lastPower ?? 0)) }]);
            break;
        case '86':
            for (const id of g.players[them].graveyard.slice()) {
                const c = g.cards[id];
                if (!isCreature(c) || c.frontierMarks?.webDiedTurn !== g.turn)
                    continue;
                c.webFoodEntry = true;
                enterBattlefield(g, c, p);
            }
            break;
        case '87':
            if (yield* yes('棄掉所有手牌後抓等量牌？')) {
                const n = player.hand.length;
                discardMany(g, player.hand.slice().map(id => g.cards[id]));
                drawCards(g, p, n);
                if (webStory(g, p))
                    dealDamage(g, src, p, { p: them }, n);
            }
            break;
        case '91':
            for (const id of ctx.createdList ?? [])
                reflex([{ e: 'frontier', action: 'hob:final:attachCreated', n: id }], [{ kind: 'creature', filter: { ctrl: 'you' } }]);
            break;
        case 'attachCreated': {
            const eq = g.cards[ef.n ?? -1];
            if (eq?.zone === 'battlefield' && t?.zone === 'battlefield')
                eq.attachedTo = t.id;
            break;
        }
        case '92':
            for (const c of ours({ type: 'Creature', attacking: true }))
                c.tapped = false;
            g.extraCombat = { player: p, landOnly: false, count: (g.extraCombat?.count ?? 0) + 1 };
            break;
        case 'dragonMana4':
            for (let i = 0; i < 4; i++) {
                const colors = ['W', 'U', 'B', 'R', 'G'] as Color[], c = colors[yield* mode('選擇龍咒語專用法術力', ['白', '藍', '黑', '紅', '綠'])];
                (player.eclRestrictedMana ??= []).push({ mana: c, rule: 'webDragon', source: src.id });
            }
            break;
        case '96':
            for (const id of player.library.slice(0, 2)) {
                moveCard(g, g.cards[id], 'exile');
                (g.cards[id].frontierMarks ??= {}).webWizardPermission = p + 1;
                g.cards[id].frontierMarks!.webHiddenBy = p + 1;
            }
            break;
        case '98': {
            const ids = player.library.slice(0, 13);
            yield* finalLook(g, p, ids, '展示牌庫頂十三張');
            const options = ids.filter(id => isCreature(g.cards[id]));
            let chosen: number | undefined;
            if (options.length) {
                chosen = options[randInt(g, options.length)];
                enterBattlefield(g, g.cards[chosen], p);
            }
            const rest = ids.filter(id => id !== chosen);
            shuffleArr(g, rest);
            for (const id of rest)
                moveCard(g, g.cards[id], 'library', true);
            break;
        }
        case 'attachTwo': {
            const eq = target('T0'), body = target('T1');
            if (eq?.zone === 'battlefield' && body?.zone === 'battlefield')
                eq.attachedTo = body.id;
            break;
        }
        case '103':
            if (selfLive()) {
                counter(src, 'quest');
                if ((src.eclCounters?.quest ?? 0) >= 6) {
                    sacrifice(g, src);
                    if (src.zone === 'battlefield')
                        break;
                    const ids = [...player.hand, ...player.library].filter(id => g.cards[id].def.subtypes?.includes('Dragon')), [id] = yield* pick(ids, '可搜尋手牌或牌庫的龍並放進戰場');
                    if (id !== undefined)
                        enterBattlefield(g, g.cards[id], p);
                    shuffleArr(g, player.library);
                }
            }
            break;
        case '104':
            if (ours({ sub: 'Treasure' }).length >= 4 && selfLive()) {
                sacrifice(g, src);
                if (src.zone !== 'battlefield')
                    yield* token('tok-ws-dragon');
            }
            break;
        case '114': {
            const body = target('T0');
            if (!body)
                break;
            let attached = false;
            for (let i = 1; i < ctx.targets.length; i++) {
                const c = target('T' + i as 'T0');
                if (c?.zone === 'battlefield' && c.def.subtypes?.includes('Equipment') && c.attachedTo !== body.id) {
                    c.attachedTo = body.id;
                    attached = true;
                }
            }
            if (attached)
                reflex([{ e: 'frontier', action: 'hob:final:thorinDamage', n: body.id }], [{ kind: 'creature', optional: true }]);
            break;
        }
        case 'thorinDamage': {
            const c = g.cards[ef.n ?? -1];
            if (c && t)
                dealDamage(g, c, c.controller, { c: t.id }, Math.max(0, stats(g, c).p));
            break;
        }
        case '119':
            if (t) {
                counter(t, 'trample');
                webAddTypes(t, ['Bear']);
            }
            if (ours({ sub: 'Bear' }).length >= 3)
                drawCards(g, p, 2);
            break;
        case 'bearLands':
            if (selfLive())
                webForm(src, { types: [...new Set([...src.def.types, 'Creature' as const])], subtypes: [...(src.def.subtypes ?? []), 'Bear'], abilities: [...(src.def.abilities ?? []), { kind: 'static', frontier: 'hob:final:landsBody' }] }, true);
            break;
        case '121':
            yield* webDig(g, p, 4, { nonType: ['Instant', 'Sorcery'] });
            break;
        case '122':
            yield* webMillPick(g, p, 4, { sub: 'Elf' }, 4);
            break;
        case 'sagaLandElf':
            if (selfLive()) {
                src.baseDef ??= src.def;
                src.def = { ...src.def, abilities: [...(src.def.abilities ?? []), { kind: 'trigger', on: 'landfall', effects: [{ e: 'token', token: 'tok-elf-g11' }] }] };
                (src.frontierMarks ??= {}).permanentAnimation = 1;
            }
            break;
        case '125':
            if (t) {
                const st = stats(g, src);
                yield* run([{ e: 'setBase', what: 'T0', p: st.p, t: st.t }]);
            }
            break;
        case '131': {
            const def = copiableDefinition(src);
            yield* token({ ...def, supertypes: def.supertypes?.filter(t => t !== 'Legendary') }, 2);
            break;
        }
        case 'halflingMana':
            (player.pool ??= []).push(...Array(ours({ sub: 'Halfling' }).length).fill('C'));
            break;
        case '134': {
            const noncreatures: number[] = [];
            let creature: Card | undefined;
            while (player.library.length) {
                const c = g.cards[player.library[0]];
                moveCard(g, c, 'exile');
                if (isCreature(c)) {
                    creature = c;
                    break;
                }
                noncreatures.push(c.id);
            }
            if (creature) {
                if (manaValue(creature.def) <= ours({ type: 'Land' }).length)
                    enterBattlefield(g, creature, p);
                else
                    moveCard(g, creature, 'hand');
            }
            shuffleArr(g, noncreatures);
            for (const id of noncreatures)
                moveCard(g, g.cards[id], 'library', true);
            break;
        }
        case '137': {
            const ids = player.library.slice(0, 20), options = ids.filter(id => isLand(g.cards[id])), chosen = yield* pick(options, '任意數量的地橫置進場', 0, options.length);
            for (const id of chosen)
                enterBattlefield(g, g.cards[id], p, true);
            shuffleArr(g, player.library);
            break;
        }
        case 'elfMana': {
            const n = Math.max(0, stats(g, src).p), colors = ['W', 'U', 'B', 'R', 'G'] as Color[], c = colors[yield* mode('選擇精靈專用法術力顏色', ['白', '藍', '黑', '紅', '綠'])];
            for (let i = 0; i < n; i++)
                (player.eclRestrictedMana ??= []).push({ mana: c, rule: 'webElf', source: src.id });
            break;
        }
        case '148': {
            const [id] = yield* pick(ours({ type: 'Creature', other: true }).map(c => c.id), '可犧牲另一生物');
            if (id !== undefined) {
                const n = Math.max(0, stats(g, g.cards[id]).p);
                sacrifice(g, g.cards[id]);
                reflex([{ e: 'frontier', action: 'hob:final:bolgDamage', n }], [{ kind: 'creature', notSelf: true }]);
            }
            break;
        }
        case 'bolgDamage':
            if (t) {
                const remaining = Math.max(0, stats(g, t).t - t.damage), needed = stats(g, src).kw.has('deathtouch') ? Math.min(1, remaining) : remaining, n = dealDamage(g, src, p, { c: t.id }, ef.n ?? 0), excess = Math.max(0, n - needed);
                if (excess)
                    yield* run([{ e: 'amass', n: excess }]);
            }
            break;
        case '152':
            yield* webDig(g, p, 4, { sub: ['Dwarf', 'Equipment'] });
            break;
        case 'honeEquipment':
            for (const c of ours({ sub: 'Equipment' }))
                counter(c, 'hone');
            break;
        case '155':
            if (src.zone === 'graveyard' && t?.zone === 'battlefield') {
                enterBattlefield(g, src, p);
                src.attachedTo = t.id;
            }
            break;
        case 'attachArmy': {
            const c = ours({ sub: 'Army' })[0];
            if (c && selfLive())
                src.attachedTo = c.id;
            break;
        }
        case '160':
            if (t?.zone === 'battlefield') {
                moveCard(g, t, 'hand');
                if ((t as Card).zone === 'hand' && selfLive())
                    putCounters(g, src, 1);
            }
            break;
        case '163': {
            drawCards(g, p, 1);
            const [id] = yield* pick(player.hand.slice(), '棄一張牌', Math.min(1, player.hand.length));
            if (id !== undefined) {
                const c = g.cards[id], land = isLand(c);
                discardMany(g, [c]);
                if (land && c.zone === 'graveyard')
                    enterBattlefield(g, c, p, true);
            }
            break;
        }
        case 'millPickSpells6':
            yield* webMillPick(g, p, 6, { type: ['Instant', 'Sorcery'] }, 6);
            break;
        case 'millPickLands4':
            yield* webMillPick(g, p, 4, { type: 'Land' }, 2);
            break;
        case '169':
            drawCards(g, p, Math.max(0, ctx.bdSac?.power ?? 0));
            yield* run([{ e: 'discard', who: 'you', n: 1 }]);
            break;
        case 'trollReturn':
            if (src.zone === 'graveyard') {
                src.webArtifactEntry=true;
                enterBattlefield(g, src, p);
            }
            break;
        case '171': {
            const ref = ctx.targets[0];
            if (ref) {
                const n = dealDamage(g, src, p, ref, 1);
                if (n > 0 && t?.def.subtypes?.includes('Dragon'))
                    destroyCards(g, [t]);
            }
            break;
        }
        case '177': {
            const types = [...new Set(ours({ type: 'Creature' }).flatMap(c => c.def.subtypes ?? []))];
            if (types.length) {
                const type = types[yield* mode('選擇生物類別', types)];
                yield* token('tok-treasure', ours({ type: 'Creature', sub: type }).length);
            }
            break;
        }
        case '178': {
            const who = resolveRef(g, ctx, 'T0').players[0], body = target('T1');
            if (selfLive() && who !== undefined)
                counter(src, 'hone', cards({ type: 'Creature' }).filter(c => c.controller === who).length);
            if (body && selfLive())
                src.attachedTo = body.id;
            break;
        }
        case '181': {
            const made = yield* finalSearch(g, p, { type: 'Land', basic: true }, 'battlefield', 1, true), ids = [...player.hand, ...g.battlefield.filter(id => g.cards[id].controller === p)].filter(id => g.cards[id].def.subtypes?.includes('Elf'));
            if (made.length && ids.length && (yield* yes('展示手牌或選擇場上精靈以重置該地？'))) {
                yield* pick(ids, 'Behold一個精靈', 1);
                made[0].tapped = false;
            }
            break;
        }
        default: throw Error('Unimplemented HOB ' + key);
    }
    g.version++;
}
