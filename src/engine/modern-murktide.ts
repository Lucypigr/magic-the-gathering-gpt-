import { moveCard } from './zones';
import { runEffects, resolveRef, type Ctx } from './effects';
import { choose } from './tla';
import { finalLook } from './orbit-final-common';
import { campusPermit } from './campus';
import { meadowMode } from './meadow';
import { shuffleArr } from './state';
import type { Card, Effect, GameState, PID, SubFlow } from './types';
function* extract(g: GameState, p: PID, who: PID, name: string): SubFlow<number> {
  const owner = g.players[who], hand = new Set(owner.hand);
  yield* finalLook(g, p, [...owner.hand, ...owner.library], '檢視手牌與牌庫，選擇要放逐的同名牌');
  const ids = [...owner.graveyard, ...owner.hand, ...owner.library].filter(id => g.cards[id].def.name === name);
  const picked = yield* choose(g, p, '選擇任意數量的同名牌放逐', ids, 0, ids.length);
  let n = 0;
  for (const id of picked) { if (hand.has(id)) n++; moveCard(g, g.cards[id], 'exile'); }
  shuffleArr(g, owner.library);
  return n;
}
export function* murktideEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, { e: 'frontier' }>): SubFlow {
  const p = ctx.controller, source = g.cards[ctx.source], target = resolveRef(g, ctx, 'T0').cards[0];
  switch (ef.action.slice(7)) {
    case 'force':
      if (target?.zone === 'stack') {
        yield* runEffects(g, ctx, [{ e: 'counter', what: 'T0', exile: true }]);
      }
      break;
    case 'subtlety':
      if (target?.zone === 'stack') {
        const bottom = yield* meadowMode(target.owner, '將咒語放在牌庫頂或牌庫底', ['牌庫頂', '牌庫底']);
        moveCard(g, target, 'library', bottom === 1);
      }
      break;
    case 'surgical':
      if (target?.zone === 'graveyard') yield* extract(g, p, target.owner, target.def.name);
      break;
    case 'talents':
      if (target?.zone === 'stack') {
        const who = target.controller, name = (target.castFace ?? target.def).name;
        yield* runEffects(g, ctx, [{ e: 'counter', what: 'T0' }]);
        const n = yield* extract(g, p, who, name);
        if (n) yield* runEffects(g, { ...ctx, controller: who }, [{ e: 'draw', n }]);
      }
      break;
    case 'ragavan': {
      yield* runEffects(g, ctx, [{ e: 'token', token: 'tok-treasure' }]);
      const who = ctx.ev?.type === 'combatDamage' ? ctx.ev.player : undefined;
      if (who !== undefined) {
        const id = g.players[who].library[0];
        if (id !== undefined) {
          const c = g.cards[id]; moveCard(g, c, 'exile');
          if (!c.def.types.includes('Land')) campusPermit(g, c, p, g.turn);
        }
      }
      break;
    }
    case 'dashReturn':
      if (source.zone === 'battlefield' && source.objectVersion === ef.n) moveCard(g, source, 'hand');
      break;
  }
}
export function modernDashEntry(g: GameState, c: Card, from: string) {
  const dashed = c.frontierMarks?.modernDash;
  if(c.frontierMarks) delete c.frontierMarks.modernDash;
  if (from !== 'stack' || !dashed) return;
  (c.permanentGrants ??= []).push({ kw: ['haste'] });
  (g.delayed ??= []).push({ source: c.id, controller: c.controller, on: 'eachEndStep', persistent: true, once: true, effects: [{ e: 'frontier', action: 'modern:dashReturn', n: c.objectVersion }] });
}
