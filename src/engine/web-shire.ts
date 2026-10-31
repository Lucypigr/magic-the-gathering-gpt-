import { finalContext, finalLook } from './orbit-final-common';
import { webSpmEffect } from './web-spm';
import { webHobEffect } from './web-hob';
import { copiableDefinition, isCreature, matches, other, shuffleArr } from './state';
import { moveCard, enterBattlefield, putCounters, loseLife } from './zones';
import { runEffects, type Ctx } from './effects';
import { choose } from './tla';
import { meadowMode, meadowYes } from './meadow';
import type { Card, CardDef, Effect, GameState, PID, SubFlow, Filter } from './types';
export function webForm(c: Card, patch: Partial<CardDef>, permanent = false) { c.baseDef ??= c.def; c.def = { ...c.def, ...patch }; if (permanent)
    (c.frontierMarks ??= {}).permanentAnimation = 1; }
export function webAddTypes(c: Card, subtypes: string[], permanent = true, legendary = false) { webForm(c, { subtypes: [...new Set([...(c.def.subtypes ?? []), ...subtypes])], ...(legendary ? { supertypes: [...new Set([...(c.def.supertypes ?? []), 'Legendary' as const])] } : {}) }, permanent); }
export function* webCopy(g: GameState, ctx: Ctx, nonlegend = false, haste = false): SubFlow { const before = g.nextSid; yield* runEffects(g, ctx, [{ e: 'copySpell' }]); for (const s of g.stack)
    if (s.sid >= before && s.kind === 'spell') {
        const c = g.cards[s.cardId];
        c.def = { ...c.def, ...(nonlegend ? { supertypes: c.def.supertypes?.filter(t => t !== 'Legendary') } : {}) };
        if (haste && isCreature(c))
            c.def = { ...c.def, keywords: [...(c.def.keywords ?? []), 'haste'] };
    } }
export function* webDig(g: GameState, p: PID, n: number, f: Filter, max = 1, to: 'hand' | 'battlefield' | 'graveyard' = 'hand', optional = true, random = true): SubFlow<Card[]> { const ids = g.players[p].library.slice(0, n), options = ids.filter(id => matches(g, f, g.cards[id], p)), chosen = yield* choose(g, p, '檢視牌庫頂並選牌', options, optional ? 0 : Math.min(max, options.length), max), out: Card[] = []; for (const id of chosen) {
    const c = g.cards[id];
    if (to === 'battlefield')
        enterBattlefield(g, c, p);
    else
        moveCard(g, c, to);
    out.push(c);
} let rest = ids.filter(id => !chosen.includes(id)); if (random)
    shuffleArr(g, rest);
else if (rest.length > 1)
    rest = yield* choose(g, p, '依順序選擇置於牌庫底的牌', rest, rest.length, rest.length); for (const id of rest)
    moveCard(g, g.cards[id], 'library', true); return out; }
export function* webMillPick(g: GameState, p: PID, n: number, f: Filter, max = 1): SubFlow { const ids = g.players[p].library.slice(0, n); for (const id of ids)
    moveCard(g, g.cards[id], 'graveyard'); const options = ids.filter(id => g.cards[id].zone === 'graveyard' && matches(g, f, g.cards[id], p)), chosen = yield* choose(g, p, '可取回本次磨掉的牌', options, 0, max); for (const id of chosen)
    moveCard(g, g.cards[id], 'hand'); }
export function* webDelayedBlink(g: GameState, ctx: Ctx): SubFlow { for (const ref of ctx.targets) {
    if (!ref || !('c' in ref))
        continue;
    const c = g.cards[ref.c];
    if (c.zone !== 'battlefield')
        continue;
    moveCard(g, c, 'exile');
    (c.frontierMarks ??= {}).webBlinkVersion = c.objectVersion ?? 0;
    (g.delayed ??= []).push({ source: c.id, controller: ctx.controller, on: 'eachEndStep', once: true, persistent: true, effects: [{ e: 'frontier', action: 'spm:final:blinkBack', n: c.objectVersion }] });
} }
export function* webEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, {
    e: 'frontier';
}>): SubFlow {
    g.webActive = true;
    const { src, p, key, target, run, impulse, counter } = finalContext(g, ctx, ef), t = target();
    switch (key) {
        case 'countersEach':
            for (let i = 0; i < ctx.targets.length; i++)
                yield* run([{ e: 'counters', what: 'T' + i as 'T0', n: 1 }]);
            return;
        case 'transferPlus':
            if (t)
                putCounters(g, t, Math.max(0, Number(ctx.ev && 'counterKinds' in ctx.ev ? ctx.ev.counterKinds?.plus ?? 0 : src.lastCounterKinds?.plus ?? 0)));
            return;
        case 'delayedBlink':
            yield* webDelayedBlink(g, ctx);
            return;
        case 'blinkBack':
            if (src.zone === 'exile' && src.objectVersion === ef.n)
                enterBattlefield(g, src, src.owner);
            return;
        case 'impulse':
            impulse();
            return;
        case 'impulseNext':
            impulse(1, g.turn + (g.active === p ? 2 : 1));
            return;
        case 'impulseTwoNext':
            impulse(2, g.turn + (g.active === p ? 2 : 1));
            return;
        case 'reanimateTargets':
            for (let i = 0; i < ctx.targets.length; i++)
                yield* run([{ e: 'reanimate', what: 'T' + i as 'T0' }]);
            return;
        case 'reanimateCounter':
            if (t?.zone === 'graveyard') {
                (t.finMarks ??= {}).enterCounters = 1;
                enterBattlefield(g, t, p);
            }
            return;
        case 'exileDeath':
            if (t)
                (t.exileOnDeathTurn = g.turn);
            return;
        case 'extraLand':
            g.players[p].extraLandsThisTurn = (g.players[p].extraLandsThisTurn ?? 0) + 1;
            return;
        case 'copyNonlegend':
            yield* webCopy(g, ctx, true);
            return;
        case 'countersAtEvent':
            if (t)
                counter(t, ef.action.split(':')[0] === 'spm' ? 'ingenuity' : 'hone');
            return;
    }
    if (ef.action.startsWith('spm:'))
        yield* webSpmEffect(g, ctx, ef);
    else
        yield* webHobEffect(g, ctx, ef);
}
export function* webBeforeEntry(g: GameState, c: Card, p: PID): SubFlow<CardDef | undefined> {
    const entry = c.def.meadow?.webEntry;
    if (entry === 'arichne') {
        yield* finalLook(g, p, g.players[other(p)].hand.slice(), '檢視對手手牌');
        const types = ['Artifact', 'Enchantment', 'Instant', 'Sorcery', 'Planeswalker', 'Land', 'Kindred'], pick = yield* meadowMode(p, '選擇生物以外的牌類別', types);
        c.eclType = types[pick];
    }
    else if (entry === 'chameleon' || entry === 'superior') {
        const gy = entry === 'superior', ids = (gy ? g.players.flatMap(pl => pl.graveyard) : g.battlefield.filter(id => g.cards[id].controller === p)).filter(id => isCreature(g.cards[id])), [id] = yield* choose(g, p, '可複製一張生物牌', ids);
        if (id !== undefined) {
            const target = g.cards[id], template = copiableDefinition(target);
            if (gy)
                moveCard(g, target, 'exile');
            return { ...template, name: c.def.name, ...(gy ? { power: 4, toughness: 4, subtypes: [...new Set([...(template.subtypes ?? []), 'Spider', 'Human', 'Hero'])] } : {}), ecl: undefined, meadow: { ...template.meadow, webShire: true } };
        }
    }
    else if (entry === 'oddEven')
        (c.frontierMarks ??= {}).webParity = yield* meadowMode(p, '選擇奇數或偶數', ['奇數', '偶數']);
    else if (entry === 'passage') {
        const names = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'], mana = ['W', 'U', 'B', 'R', 'G'] as const, index = yield* meadowMode(p, '選擇基本地類別', names), paid = g.players[p].life >= 2 && (yield* meadowYes(p, '支付2生命使此地不橫置？'));
        if (paid)
            loseLife(g, p, 2);
        return { ...c.def, subtypes: [names[index]], produces: [mana[index]], etbTapped: !paid, ecl: undefined };
    }
    return undefined;
}
