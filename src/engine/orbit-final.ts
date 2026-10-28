import { finalTdmEffect } from './orbit-final-tdm';
import { finalEoeEffect } from './orbit-final-eoe';
import { finalContext } from './orbit-final-common';
import { copiableDefinition, isCreature } from './state';
import { choose } from './tla';
import { sacrifice, tapCard } from './zones';
import type { Card, CardDef, Effect, GameState, PID, SubFlow } from './types';
import type { Ctx } from './effects';
export function* orbitFinalEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, {
    e: 'frontier';
}>): SubFlow {
    g.orbitFinalActive = true;
    const key = ef.action.split(':').slice(2).join(':'), { target, run } = finalContext(g, ctx, ef);
    if (key === 'recoverTargets') {
        for (let i = 0; i < ctx.targets.length; i++) {
            const c = target(('T' + i) as 'T0');
            if (c?.zone === 'graveyard')
                yield* run([{ e: 'toHand', what: ('T' + i) as 'T0' }]);
        }
        return;
    }
    if (ef.action.startsWith('tdm:'))
        yield* finalTdmEffect(g, ctx, ef);
    else
        yield* finalEoeEffect(g, ctx, ef);
}
export function* orbitBeforeEntry(g: GameState, c: Card, p: PID): SubFlow<CardDef | undefined> {
    const kind = c.def.meadow?.finalEntry;
    if (kind === 'clone') {
        const [id] = yield* choose(g, p, '可複製場上一個生物', g.battlefield.filter(id => isCreature(g.cards[id])));
        if (id !== undefined)
            return { ...copiableDefinition(g.cards[id]), ecl: undefined };
    }
    else if (kind === 'devourLands') {
        const ids = yield* choose(g, p, '可吞噬任意數量的地', g.battlefield.filter(id => g.cards[id].controller === p && g.cards[id].def.types.includes('Land')), 0, g.battlefield.length);
        for (const id of ids)
            sacrifice(g, g.cards[id]);
        (c.frontierMarks ??= {}).finalDevourCount = ids.length;
    }
    else if (kind === 'commandTap') {
        const ids = g.battlefield.filter(id => g.cards[id].controller === p && !g.cards[id].tapped), [id] = yield* choose(g, p, '橫置一個永久物，否則此地進場後須犧牲', ids);
        if (id !== undefined)
            tapCard(g, g.cards[id], p);
        else
            (c.frontierMarks ??= {}).finalCommandSac = 1;
    }
    else if (typeof kind === 'string' && kind.includes('|')) {
        const options = kind.split('|'), r: import('./types').Response = yield { type: 'mode', player: p, prompt: '選擇此結界的模式', options, count: 1, purpose: 'trigger' };
        (c.frontierMarks ??= {}).finalMode = r.type === 'modes' ? r.picks[0] ?? 0 : 0;
    }
    return undefined;
}
