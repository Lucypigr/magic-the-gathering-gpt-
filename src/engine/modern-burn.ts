import { costTotal, parseCost } from './mana';
import { cardName, isCreature, isLand, log, other } from './state';
import { dealDamage, moveCard } from './zones';
import { runEffects, resolveRef, type Ctx } from './effects';
import { finalLook } from './orbit-final-common';
import { choose } from './tla';
import type { Card, Effect, GameEvent, GameState, PID, SubFlow, TargetRef, TriggeredAbility } from './types';
const state = (g: GameState) => g.modernBurn ??= { landTurns: [-1, -1], noGainTurns: [-1, -1], noPreventTurn: -1, palms: [], blood: [] };
export function burnTrigger(g: GameState, a: TriggeredAbility, ev: GameEvent): boolean {
  if (ev.type !== 'cast') return false;
  const c = g.cards[ev.card];
  if (a.frontierEvent === 'modern:burn:vortex') return c.manaSpent === 0;
  if (a.frontierEvent === 'modern:burn:eidolon') {
    const cost = parseCost((c.castFace ?? c.def).cost);
    return costTotal(cost) + (cost.x ?? 0) * (g.stack.find(s=>s.kind==='spell'&&s.cardId===c.id)?.x ?? 0) <= 3;
  }
  return false;
}
export function burnObserve(g: GameState, ev: GameEvent) {
  if (ev.type === 'etb' && isLand(g.cards[ev.card])) state(g).landTurns[ev.controller] = g.turn;
  if (ev.type !== 'dies' || !isCreature(g.cards[ev.card])) return;
  const s = g.modernBurn; if (!s) return;
  const hits = s.blood.filter(b => b.turn === g.turn && b.creature === ev.card && b.version === (g.cards[ev.card].objectVersion ?? 0));
  s.blood = s.blood.filter(b => !hits.includes(b));
  for (const b of hits) g.pending.push({ source: b.source, controller: b.controller, abilityIndex: -461, ev, ability: { kind: 'trigger', on: 'frontierEvent', effects: [{ e: 'frontier', action: 'modern:burn:bloodAfter', n: ev.controller }] } });
}
export function burnCleanup(g: GameState) {
  const s = g.modernBurn; if (!s) return;
  s.noPreventTurn = -1; s.noGainTurns = [-1, -1]; s.palms = []; s.blood = [];
}
/** A chosen battlefield source keeps its identity through LKI, but not a blink. */
export function burnPrevent(g: GameState, source: Card | null, controller: PID, to: TargetRef, n: number): boolean {
  if (!source || !('p' in to)) return false;
  const s = g.modernBurn;
  const palm = s?.palms.find(x => x.turn === g.turn && x.player === to.p && x.chosen === source.id && (x.link !== undefined ? x.link === source.tmtLinkKey : x.version === (source.objectVersion ?? 0) || x.fromStack && source.zone === 'battlefield' && x.version + 1 === source.objectVersion));
  if (!s || !palm) return false;
  s.palms = s.palms.filter(x => x !== palm);
  dealDamage(g, g.cards[palm.source], palm.player, { p: controller }, n);
  return true;
}
export function* burnEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, { e: 'frontier' }>): SubFlow {
  const p = ctx.controller, src = g.cards[ctx.source], target = resolveRef(g, ctx, 'T0').cards[0];
  switch (ef.action.slice(12)) {
    case 'guide': {
      const who = other(p), id = g.players[who].library[0];
      if (id === undefined) break;
      const c = g.cards[id];
      log(g, `${cardName(src)}展示：${cardName(c)}`, p);
      yield* finalLook(g, 0, [id], '展示防禦玩家的牌庫頂');
      yield* finalLook(g, 1, [id], '展示防禦玩家的牌庫頂');
      if (isLand(c)) moveCard(g, c, 'hand');
      break;
    }
    case 'eidolon': case 'vortex': {
      if (ctx.ev?.type === 'cast') dealDamage(g, src, p, { p: ctx.ev.player }, ef.action.endsWith('eidolon') ? 2 : 5);
      break;
    }
    case 'upkeep': if (ctx.ev?.type === 'step') dealDamage(g, src, p, { p: ctx.ev.player }, 1); break;
    case 'noGain': state(g).noGainTurns[other(p)] = g.turn; break;
    case 'skullcrack': { const s = state(g); s.noGainTurns = [g.turn, g.turn]; s.noPreventTurn = g.turn; break; }
    case 'smash': {
      if (!target) break;
      const controller = target.controller;
      yield* runEffects(g, ctx, [{ e: 'destroy', what: 'T0' }]);
      dealDamage(g, src, p, { p: controller }, 3); break;
    }
    case 'blood':
      if (target) {
        state(g).blood.push({ source: src.id, controller: p, creature: target.id, version: target.objectVersion ?? 0, turn: g.turn });
        dealDamage(g, src, p, { c: target.id }, 2);
      }
      break;
    case 'bloodAfter': dealDamage(g, src, p, { p: ef.n as PID }, 3); break;
    case 'blaze': {
      const n = g.modernBurn?.landTurns[p] === g.turn ? 3 : 1;
      for (const t of ctx.targets) if (t) dealDamage(g, src, p, t, n);
      break;
    }
    case 'palm': {
      const ids = [...new Set([src.id, ...g.battlefield, ...g.stack.flatMap(s => [s.cardId, ...s.targets.flatMap(t => t && 'c' in t ? [t.c] : [])]), ...g.pending.map(t => t.source), ...(g.delayed ?? []).map(t=>t.source), ...(g.modernBurn?.blood ?? []).map(t=>t.source), ...(g.modernBurn?.palms ?? []).map(t=>t.source)])];
      const [chosen] = yield* choose(g, p, '選擇本回合要防止傷害的來源（不是指定目標）', ids, Math.min(1, ids.length), 1);
      if (chosen !== undefined) {
        const c = g.cards[chosen];
        state(g).palms.push({ source: src.id, chosen, player: p, turn: g.turn, version: c.objectVersion ?? 0, link: c.zone === 'battlefield' ? c.tmtLinkKey : undefined, fromStack: c.zone === 'stack' });
      }
      break;
    }
  }
}
