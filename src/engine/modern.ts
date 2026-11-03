import { murktideEffect } from './modern-murktide';
import { abilitiesOf, abilitiesSuppressed, matches, stats, uncounterableSpells } from './state';
import { colorsOf, manaValue } from './mana';
import { moveCard } from './zones';
import { runEffects, resolveRef, type Ctx } from './effects';
import { choose } from './tla';
import { finalLook } from './orbit-final-common';
import { campusPermit } from './campus';
import { meadowMode } from './meadow';
import type { Card, Effect, GameEvent, GameState, PID, SubFlow, TriggeredAbility } from './types';
/** Could produce ignores whether a tap cost can be paid at this moment. */
export function modernColorlessLand(g: GameState, c: Card): boolean {
  if (abilitiesSuppressed(g, c)) return false;
  if (c.def.produces?.includes('C') || c.bonusMana !== undefined && g.cards[c.bonusMana]?.zone === 'exile') return true;
  const abilities = abilitiesOf(g, c);
  if (abilities.some(a => a.kind === 'static' && a.msh === 'conditionalDual') && c.enteredTurn !== g.turn && !g.battlefield.some(id => g.cards[id].controller === c.controller && g.cards[id].def.supertypes?.includes('Basic'))) return true;
  return g.battlefield.some(id => abilitiesOf(g, g.cards[id]).some(a => a.kind === 'static' && a.manaGrant?.colors.includes('C') && matches(g, a.manaGrant.filter, c, g.cards[id].controller, id)));
}
export function modernDelirium(g: GameState, p: PID) { return new Set(g.players[p].graveyard.flatMap(id => g.cards[id].def.types)).size >= 4; }
function has(g: GameState, c: Card, key: string) { return abilitiesOf(g, c).some(a => a.kind === 'static' && a.frontier === 'modern:' + key); }
export function modernStats(g: GameState, c: Card, st: import('./state').Stats) {
  if (has(g, c, 'channeler') && modernDelirium(g, c.controller)) { st.p += 2; st.t += 2; st.kw.add('flying'); }
}
export const modernForced = (g: GameState, c: Card) => has(g, c, 'channeler') && modernDelirium(g, c.controller);
export const modernCanBlock = (g: GameState, b: Card, a: Card) => !has(g, b, 'blockFlyingOnly') || importFlying(g, a);
const importFlying = (g: GameState, c: Card) => stats(g, c).kw.has('flying');
export function modernTrigger(g: GameState, c: Card, a: TriggeredAbility, e: GameEvent) {
  return a.frontierEvent === 'modern:graveSpellLeaves' && e.type === 'fin' && e.action === 'zoneMove' && e.from === 'graveyard' && e.player === c.controller && g.cards[e.card].def.types.some(t => t === 'Instant' || t === 'Sorcery');
}
export function modernEntry(c: Card, from: string) {
  if (c.def.meadow?.modernDelve && from === 'stack') c.counters += c.frontierMarks?.modernDelveSpells ?? 0;
  if (c.frontierMarks) delete c.frontierMarks.modernDelveSpells;
}
export function modernConsignChoices(g: GameState) { return g.stack.filter(s => s.kind === 'trigger' || s.kind === 'spell' && colorsOf(g.cards[s.cardId].castFace ?? g.cards[s.cardId].def).length === 0); }
export function* modernEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, { e: 'frontier' }>): SubFlow {
  const p = ctx.controller, source = g.cards[ctx.source], player = g.players[p], target = resolveRef(g, ctx, 'T0').cards[0];
  switch (ef.action.slice(7)) {
    case 'force': case 'subtlety': case 'surgical': case 'talents': case 'ragavan': case 'dashReturn': yield* murktideEffect(g, ctx, ef); break;
    case 'iteration': {
      const ids = player.library.slice(0, 3);
      const [hand] = yield* choose(g, p, '選一張放進手上', ids, Math.min(1, ids.length), 1);
      if (hand !== undefined) moveCard(g, g.cards[hand], 'hand');
      const rest = ids.filter(id => id !== hand), [bottom] = yield* choose(g, p, '選一張放到牌庫底', rest, Math.min(1, rest.length), 1);
      if (bottom !== undefined) moveCard(g, g.cards[bottom], 'library', true);
      for (const id of rest.filter(id => id !== bottom)) { moveCard(g, g.cards[id], 'exile'); campusPermit(g, g.cards[id], p, g.turn); }
      break;
    }
    case 'bauble': {
      const who = resolveRef(g, ctx, 'T0').players[0];
      if (who !== undefined) yield* finalLook(g, p, g.players[who].library.slice(0, 1), '檢視目標玩家牌庫頂');
      (g.delayed ??= []).push({ source: source.id, controller: p, on: 'eachUpkeep', once: true, persistent: true, effects: [{ e: 'draw', n: 1 }] }); break;
    }
    case 'crypt': {
      const who = resolveRef(g, ctx, 'T0').players[0];
      if (who !== undefined) for (const id of g.players[who].graveyard.slice()) moveCard(g, g.cards[id], 'exile'); break;
    }
    case 'meltdown':
      yield* runEffects(g, ctx, [{ e: 'destroy', what: { all: { type: 'Artifact', mvMax: ctx.x ?? 0 } } }]); break;
    case 'ending': {
      const colors = new Set((source.manaPaid ?? []).filter(m => m !== 'C')).size;
      if (target?.zone === 'battlefield' && manaValue(target.def) <= colors) moveCard(g, target, 'exile'); break;
    }
    case 'counter': {
      const item = g.stack.find(s => s.sid === ef.n);
      if (!item || !modernConsignChoices(g).includes(item)) break;
      if (item.kind === 'spell' && (uncounterableSpells(g, item.controller) || item.uncounterable || g.cards[item.cardId].def.uncounterable)) break;
      // Use the native counter effect, including flashback's exile replacement.
      if (item.kind === 'spell') yield* runEffects(g, { ...ctx, targets: [{ c: item.cardId }] }, [{ e: 'counter', what: 'T0' }]);
      else g.stack = g.stack.filter(s => s !== item);
      break;
    }
    case 'replicate':
      for (let i = 0; i < (ef.n ?? 0); i++) {
        const before = g.nextSid;
        yield* runEffects(g, ctx, [{ e: 'copySpell' }]);
        const copy = g.stack.find(s => s.sid >= before && s.kind === 'spell');
        if (!copy) continue;
        const choices = modernConsignChoices(g), selected = yield* meadowMode(p, '複製品的目標', ['保留原目標', ...choices.map(s => s.text)]);
        if (selected > 0) copy.effects = copy.effects.map(e => e.e === 'frontier' && e.action === 'modern:counter' ? { ...e, n: choices[selected - 1].sid } : e);
      }
      break;
    default: throw Error('Unknown Modern effect ' + ef.action);
  }
}
