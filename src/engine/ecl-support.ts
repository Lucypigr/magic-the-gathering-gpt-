import { colorsOf } from './mana';
import { abilitiesOf, isCreature, matches } from './state';
import type { Card, GameState, PID } from './types';
export const ECL_TRIBES = ['Elemental', 'Elf', 'Faerie', 'Giant', 'Goblin', 'Kithkin', 'Merfolk', 'Treefolk'];
export function counterKinds(c: Card): Record<string, number> {
  return {
    '+1/+1': Math.max(0, c.counters),
    '-1/-1': Math.max(0, -c.counters),
    charge: c.charge ?? 0,
    stun: c.stun,
    hexproof: c.hexproofCounters ?? 0,
    finality: c.finality?Math.max(1,c.finalityCount??1):0,
    lore: c.lore ?? 0,
    loyalty: c.loyalty ?? 0,
    ...c.eclCounters,
  };
}
export function counterTotal(c: Card): number {
  return Object.values(counterKinds(c)).reduce((n, v) => n + v, 0);
}
export function removeCounterKind(c: Card, kind: string, n = 1): boolean {
  if ((counterKinds(c)[kind] ?? 0) < n) return false;
  switch (kind) {
    case '+1/+1':
      c.counters -= n;
      break;
    case '-1/-1':
      c.counters += n;
      break;
    case 'charge':
      c.charge = (c.charge ?? 0) - n;
      break;
    case 'stun':
      c.stun -= n;
      break;
    case 'hexproof':
      c.hexproofCounters = (c.hexproofCounters ?? 0) - n;
      break;
    case 'finality':
      c.finalityCount=Math.max(0,(c.finality?Math.max(1,c.finalityCount??1):0)-n);c.finality=c.finalityCount>0;
      break;
    case 'lore':
      c.lore = (c.lore ?? 0) - n;
      break;
    case 'loyalty':
      c.loyalty = (c.loyalty ?? 0) - n;
      break;
    default:
      if (c.eclCounters) c.eclCounters[kind] -= n;
  }
  return true;
}
export function vividColors(g: GameState, pid: PID) {
  return [...new Set(g.battlefield.flatMap((id) => (g.cards[id].controller === pid ? colorsOf(g.cards[id].def) : [])))];
}
export function eclStatic(g: GameState, pid: PID, action: string): Card[] {
  return g.battlefield
    .map((id) => g.cards[id])
    .filter((c) => c.controller === pid && abilitiesOf(g, c).some((a) => a.kind === 'static' && a.ecl === action));
}
export function beholdOptions(g: GameState, pid: PID, c: Card, alt?: string): number[] {
  const b = c.def.ecl?.behold;
  if (!b || (b.flashbackOnly && alt !== 'flashback')) return [];
  return [...g.battlefield, ...g.players[pid].hand].filter((id) => {
    const x = g.cards[id];
    return (
      id !== c.id &&
      (x.zone === 'hand' ? x.owner === pid : x.controller === pid) &&
      matches(g, b.sub ? { sub: b.sub } : { type: 'Creature' }, x, pid, c.id)
    );
  });
}
export function validBehold(g: GameState, c: Card, ids: number[], pid: PID, alt?: string): boolean {
  const b = c.def.ecl?.behold;
  if (!b || (b.flashbackOnly && alt !== 'flashback')) return !ids.length;
  const opts = beholdOptions(g, pid, c, alt);
  if (ids.length !== b.n || new Set(ids).size !== ids.length || ids.some((id) => !opts.includes(id))) return false;
  if (!b.sub) {
    const first = g.cards[ids[0]];
    return (
      first.def.changeling ||
      first.def.subtypes?.some((sub) => ids.every((id) => matches(g, { sub }, g.cards[id], pid))) ||
      ids.every((id) => g.cards[id].def.changeling)
    );
  }
  return true;
}
export function canBehold(g: GameState, pid: PID, c: Card, alt?: string): boolean {
  const b = c.def.ecl?.behold;
  if (!b || (b.flashbackOnly && alt !== 'flashback')) return true;
  const ids = beholdOptions(g, pid, c, alt);
  if (b.sub) return ids.length >= b.n;
  for (const id of ids) {
    const x = g.cards[id];
    for (const sub of x.def.changeling ? ECL_TRIBES : (x.def.subtypes ?? []))
      if (ids.filter((id) => matches(g, { sub }, g.cards[id], pid)).length >= b.n) return true;
  }
  return false;
}
export function hasBlightBody(g: GameState, pid: PID) {
  return g.battlefield.some((id) => g.cards[id].controller === pid && isCreature(g.cards[id]) && canReceiveCounters(g, g.cards[id]));
}

export function canReceiveCounters(g: GameState, c: Card) {
  return !g.battlefield.some((id) => {
    const a = g.cards[id];
    return (
      a.attachedTo === c.id &&
      a.def.id === 'blossombind' &&
      abilitiesOf(g, a).some((b) => b.kind === 'static' && b.ecl === 'noCountersAura')
    );
  });
}
