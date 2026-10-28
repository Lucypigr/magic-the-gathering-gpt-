import { copiableDefinition, matches, newCard, other, shuffleArr } from './state';
import { moveCard, enterBattlefield } from './zones';
import { resolveRef, runEffects, type Ctx } from './effects';
import { choose, freeCast } from './tla';
import { makeEclTokenBatch } from './ecl';
import { campusPermit, campusReflexive } from './campus';
import { meadowCounter, meadowYes, meadowMode } from './meadow';
import {} from './mana';
import type { Card, CardDef, Effect, Filter, GameState, PID, Ref, SubFlow, TargetSpec, Ability } from './types';
export function finalContext(g: GameState, ctx: Ctx, ef: Extract<Effect, {
    e: 'frontier';
}>) {
    const p = ctx.controller, src = g.cards[ctx.source], player = g.players[p], them = other(p), key = ef.action.split(':').slice(2).join(':'), set = ef.action.split(':')[0];
    const E = (key: string | number, what: Ref = 'T0', n?: number): Effect => ({ e: 'frontier', action: set + ':final:' + key, what, n });
    const run = (list: Effect[]) => runEffects(g, ctx, list), cards = (f: Filter = {}) => g.battlefield.map(id => g.cards[id]).filter(c => matches(g, f, c, p, src.id)), ours = (f: Filter = {}) => cards({ ctrl: 'you', ...f });
    const pick = (ids: number[], prompt: string, min = 0, max = 1, who = p) => choose(g, who, prompt, ids, min, max);
    const token = (d: string | CardDef, n = 1, who = p, opts: Parameters<typeof makeEclTokenBatch>[4] = {}) => makeEclTokenBatch(g, who, d, n, opts);
    const target = (ref: Ref = ef.what ?? 'T0') => resolveRef(g, ctx, ref).cards[0];
    const live = (c: Card) => c.zone === 'battlefield', selfLive = () => live(src) && (ctx.sourceLinkKey === undefined || src.tmtLinkKey === ctx.sourceLinkKey);
    const permit = (c: Card, until = g.turn, who = p) => { moveCard(g, c, 'exile'); campusPermit(g, c, who, until); };
    const impulse = (n = 1, until = g.turn, who = p) => { const ids = g.players[who].library.slice(0, n); for (const id of ids)
        permit(g.cards[id], until); return ids; };
    const counter = (c: Card, kind: string, n = 1) => meadowCounter(g, c, kind, n, p);
    const grant = (c: Card, abilities: Ability[]) => { c.temporaryAbilities = { turn: g.turn, abilities: [...(c.temporaryAbilities?.turn === g.turn ? c.temporaryAbilities.abilities : []), ...abilities] }; };
    const reflex = (effects: Effect[], targets: TargetSpec[] = []) => campusReflexive(g, ctx, effects, targets);
    return { g, ctx, ef, p, src, player, them, key, set, E, run, cards, ours, pick, token, target, live, selfLive, permit, impulse, counter, grant, reflex, yes: (prompt: string, who = p) => meadowYes(who, prompt), mode: (prompt: string, options: string[], who = p) => meadowMode(who, prompt, options) };
}
export function* finalLook(g: GameState, p: PID, ids: number[], prompt = '檢視牌張'): SubFlow { if (ids.length)
    yield { type: 'choose', player: p, prompt, options: ids, min: 0, max: 0, reveal: true, purpose: 'dig' }; }
export function* finalCastCopy(g: GameState, ctx: Ctx, c: Card): SubFlow<boolean> {
    const cp = newCard(g, copiableDefinition(c), ctx.controller, true);
    cp.zone = 'exile';
    cp.eclCast = { by: ctx.controller, free: true };
    const cast = yield* freeCast(g, ctx, cp, true);
    if (!cast)
        moveCard(g, cp, 'exile');
    return cast;
}
export function* finalBehold(g: GameState, p: PID): SubFlow<boolean> {
    const ids = [...g.battlefield.filter(id => g.cards[id].controller === p), ...g.players[p].hand].filter(id => g.cards[id].def.subtypes?.includes('Dragon'));
    if (!ids.length || !(yield* meadowYes(p, '是否展示手上或選擇場上的龍？')))
        return false;
    const [id] = yield* choose(g, p, '選擇龍', ids, 1);
    return id !== undefined;
}
export function finalCopyUntilEnd(g: GameState, c: Card, template: CardDef) {
    c.baseDef ??= c.orbitTypeDef ?? c.def;
    c.orbitTypeDef = undefined;
    c.orbitAppliedDef = undefined;
    c.orbitFinalBase = undefined;
    c.orbitFinalApplied = undefined;
    c.def = { ...template };
    c.copyLayer = c.def;
}
export function finalEntryReanimate(g: GameState, c: Card, p: PID, markers: Record<string, number> = {}, tapped = false) { Object.assign(c.frontierMarks ??= {}, markers); enterBattlefield(g, c, p, tapped); }
export function* finalSearch(g: GameState, p: PID, f: Filter, to: 'hand' | 'graveyard' | 'battlefield' = 'hand', max = 1, tapped = false): SubFlow<Card[]> {
    const ids = g.players[p].library.filter(id => matches(g, f, g.cards[id], p)), picked = yield* choose(g, p, '搜尋牌庫', ids, 0, max), out: Card[] = [];
    for (const id of picked) {
        const c = g.cards[id];
        if (to === 'battlefield')
            enterBattlefield(g, c, p, tapped);
        else
            moveCard(g, c, to);
        out.push(c);
    }
    shuffleArr(g, g.players[p].library);
    return out;
}
export function finalTransferCounters(g: GameState, ctx: Ctx, target: Card | undefined) { if (!target || target.zone !== 'battlefield')
    return; const ev = ctx.ev, source = g.cards[ctx.source], all = ev && 'counterKinds' in ev ? ev.counterKinds : source.lastCounterKinds; for (const [k, n] of Object.entries(all ?? {})) {
    if (!n)
        continue;
    meadowCounter(g, target, k === 'plus' ? '+1/+1' : k, Number(n), ctx.controller);
} }
