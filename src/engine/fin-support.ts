import { abilitiesOf, isCreature, isLand, matches, other, stats } from './state';
import { manaValue } from './mana';
import type { Card, Cond, GameEvent, GameState, PID, TriggeredAbility } from './types';
export const FIN_SEA = ['Kraken', 'Leviathan', 'Merfolk', 'Octopus', 'Serpent'];
export const permanent = (c: Card) => c.def.types.some((t) => ['Creature', 'Artifact', 'Enchantment', 'Land', 'Planeswalker'].includes(t));
export function finStatic(g: GameState, pid: PID, name: string) {
  return g.battlefield
    .map((id) => g.cards[id])
    .filter((c) => c.controller === pid && abilitiesOf(g, c).some((a) => a.kind === 'static' && a.fin === name));
}
export function finAmount(g: GameState, pid: PID, source: number, name: string, ev?: GameEvent): number {
  const p = g.players[pid],
    src = g.cards[source];
  switch (name) {
    case 'otherPermanentMV':
      return g.battlefield
        .filter((id) => id !== source && g.cards[id].controller === pid)
        .reduce((n, id) => n + manaValue(g.cards[id].def), 0);
    case 'creaturesPlusEquipment':
      return g.battlefield.reduce((n, id) => {
        const c = g.cards[id];
        return n + (c.controller === pid ? Number(isCreature(c)) + Number(matches(g, { sub: 'Equipment' }, c, pid)) : 0);
      }, 0);
    case 'gravePermanents':
      return p.graveyard.filter((id) => permanent(g.cards[id])).length;
    case 'graveNonCreatureNonland':
      return p.graveyard.filter((id) => !isCreature(g.cards[id]) && !isLand(g.cards[id])).length;
    case 'nonbasicLands':
      return g.battlefield.filter(
        (id) => g.cards[id].controller === pid && isLand(g.cards[id]) && !g.cards[id].def.supertypes?.includes('Basic'),
      ).length;
    case 'manaSpent':
      return ev?.type === 'cast' ? (g.cards[ev.card].manaSpent ?? 0) : (src?.manaSpent ?? 0);
    case 'opponentHalfLibrary':
      return Math.floor(g.players[other(pid)].library.length / 2);
    case 'creaturesDied':
      return p.finFlags?.creaturesDied ?? 0;
    default:
      throw new Error('Unknown FIN amount ' + name);
  }
}
export function finCondition(g: GameState, cond: Extract<Cond, { c: 'fin' }>, pid: PID, source: number, ev?: GameEvent): boolean {
  const src = g.cards[source],
    p = g.players[pid],
    n = cond.n ?? 1;
  switch (cond.action) {
    case 'firstHuman':
      return (p.finFlags?.humanCast ?? 0) === 1;
    case 'manaSpent':
      return finAmount(g, pid, source, 'manaSpent', ev) >= n;
    case 'fromGraveyard':
      return src?.castOrigin === 'graveyard';
    case 'gravePermanents':
      return finAmount(g, pid, source, 'gravePermanents') >= n;
    case 'otherArtifact':
      return g.battlefield.some((id) => id !== source && g.cards[id].controller === pid && g.cards[id].def.types.includes('Artifact'));
    case 'opponentCreatureDied':
      return !!p.finFlags?.opponentCreatureDied;
    case 'notEntered':
      return src?.enteredTurn !== g.turn;
    case 'combatSix':
      return (p.finFlags?.combatTaken ?? 0) >= 6 || (g.players[other(pid)].finFlags?.combatTaken ?? 0) >= 6;
    case 'greatestPower': {
      const mine = g.battlefield.filter((id) => g.cards[id].controller === pid && isCreature(g.cards[id]));
      return (
        mine.length > 0 &&
        Math.max(...mine.map((id) => stats(g, g.cards[id]).p)) >=
          Math.max(0, ...g.battlefield.filter((id) => isCreature(g.cards[id])).map((id) => stats(g, g.cards[id]).p))
      );
    }
    case 'noDarkstar':
      return !g.battlefield.some((id) => g.cards[id].controller === pid && g.cards[id].def.name === 'Darkstar');
    case 'otherLegends':
    case 'legends':
      return (
        g.battlefield.filter(
          (id) =>
            (cond.action === 'legends' || id !== source) &&
            g.cards[id].controller === pid &&
            isCreature(g.cards[id]) &&
            g.cards[id].def.supertypes?.includes('Legendary'),
        ).length >= n
      );
    case 'legendCombat':
      return !!p.finFlags?.legendCombat;
    default:
      throw new Error('Unknown FIN condition ' + cond.action);
  }
}
export function finTriggerMatches(g: GameState, c: Card, ab: TriggeredAbility, ev: GameEvent) {
  const pid = c.controller;
  switch (ab.finEvent) {
    case 'planisphere':
      return (
        (ev.type === 'cast' && ev.player === pid && !isCreature(g.cards[ev.card])) ||
        (ev.type === 'fin' && ev.action === 'thirdDraw' && ev.player === pid)
      );
    case 'surveil':
      return ev.type === 'fin' && ev.action === 'surveil' && ev.player === pid;
    case 'enchantedDamaged':
      return ev.type === 'damaged' && ev.card === c.attachedTo;
    case 'graveLeaves':
      return ev.type === 'fin' && ev.action === 'zoneMove' && ev.from === 'graveyard' && ev.player === pid && ev.to !== 'graveyard';
    case 'cecilDamage':
      return ev.type === 'fin' && ev.action === 'sourceDamage' && ev.card === c.id;
    case 'anyCreatureDies':
      return ev.type === 'dies';
    case 'otherCreatureDies':
      return ev.type === 'dies' && ev.card !== c.id;
    case 'opponentCreatureDies':
      return ev.type === 'dies' && ev.controller !== pid;
    case 'otherSacrificeCreature':
      return ev.type === 'sacrifice' && ev.card !== c.id && isCreature(g.cards[ev.card]);
    case 'chosenLeaves':
      return ev.type === 'leaves' && c.finMarks?.chosen === ev.card;
    case 'endCombat':
      return ev.type === 'fin' && ev.action === 'endCombat' && ev.player === pid;
    case 'vaanCombat':
      return ev.type === 'combatBatch' && ev.attacker === pid && !!c.finMarks?.vaanHit;
    case 'castUnowned':
      return ev.type === 'cast' && ev.player === pid && g.cards[ev.card].owner !== pid;
    case 'birdsAttack':
      return ev.type === 'youAttack' && ev.player === pid && ev.attackers.some((id) => matches(g, { sub: 'Bird' }, g.cards[id], pid));
    case 'balthierCombat':
      return (
        ev.type === 'attacks' &&
        g.cards[ev.card].controller === pid &&
        (g.cards[ev.card].crewedBy ?? []).includes(c.id) &&
        g.cards[ev.card].crewedTurn === g.turn &&
        (g.finCombatNumber ?? 1) === 1
      );
    case 'opponentLifeLoss':
      return ev.type === 'lifeloss' && ev.player !== pid;
    case 'opponentTakesControl':
      return ev.type === 'fin' && ev.action === 'controlChange' && ev.player !== pid && ev.amount === pid;
    case 'seaAttack':
      return ev.type === 'attacks' && FIN_SEA.some((sub) => matches(g, { sub }, g.cards[ev.card], pid));
    case 'permanentDamage':
      return ev.type === 'fin' && ev.action === 'sourceDamage' && ev.card === c.id;
    default:
      throw new Error('Unknown FIN event ' + ab.finEvent);
  }
}
export function finApplyStats(g: GameState, c: Card, st: import('./state').Stats) {
  const pid = c.controller;
  for (const id of g.battlefield) {
    const s = g.cards[id],
      attached = s.attachedTo === c.id,
      own = s.controller === pid;
    for (const a of abilitiesOf(g, s))
      if (a.kind === 'static' && a.fin) {
        switch (a.fin) {
          case 'steiner':
            if (s.id === c.id) {
              const n = g.battlefield.filter(
                (id) => g.cards[id].controller === pid && matches(g, { sub: 'Equipment' }, g.cards[id], pid),
              ).length;
              st.p += n;
              st.t += n;
            }
            break;
          case 'arsenal':
            if (attached) {
              const n = g.battlefield.filter(
                (id) => g.cards[id].controller === s.controller && g.cards[id].def.types.includes('Artifact'),
              ).length;
              st.p += 2 * n;
              st.t += 2 * n;
            }
            break;
          case 'lanceFlying':
            if (attached && g.active === pid) st.kw.add('flying');
            break;
          case 'zell':
            if (s.id === c.id) st.p += g.battlefield.filter((id) => g.cards[id].controller === pid && isLand(g.cards[id])).length;
            break;
          case 'cid':
            if (own && ((isCreature(c) && c.def.types.includes('Artifact')) || matches(g, { sub: 'Hero' }, c, pid))) {
              const n =
                g.battlefield.filter((id) => g.cards[id].controller === pid && matches(g, { sub: 'Artificer' }, g.cards[id], pid)).length +
                g.players[pid].graveyard.filter((id) => matches(g, { sub: 'Artificer' }, g.cards[id], pid)).length;
              st.p += n;
              st.t += n;
            }
            break;
          case 'xande':
            if (s.id === c.id) {
              const n = finAmount(g, pid, c.id, 'graveNonCreatureNonland');
              st.p += n;
              st.t += n;
            }
            break;
          case 'yunaKeywords':
            if (own && g.active === pid && (c.id === s.id || (isCreature(c) && c.def.types.includes('Enchantment')))) {
              st.kw.add('trample');
              st.kw.add('lifelink');
            }
            break;
          case 'excalibur':
            if (attached) {
              st.p += s.charge ?? 0;
              st.t += s.charge ?? 0;
            }
            break;
          case 'masamune':
            if (attached && c.attacking) st.kw.add('first_strike');
            break;
          case 'cloudChampion':
            if (
              s.id === c.id &&
              g.active === pid &&
              g.battlefield.some((id) => g.cards[id].attachedTo === c.id && !!g.cards[id].def.equip)
            ) {
              st.kw.add('double_strike');
              st.kw.add('indestructible');
            }
            break;
        }
      }
  }
  if (c.finMarks?.hasteTurn === g.turn) st.kw.add('haste');
}
/** Characteristic power and Equipment base values precede counters and pumps. */
export function finBaseStats(g: GameState, c: Card, st: import('./state').Stats) {
  for (const a of abilitiesOf(g, c))
    if (a.kind === 'static') {
      if (a.fin === 'snow') st.p = g.battlefield.filter((id) => g.cards[id].controller === c.controller && isCreature(g.cards[id])).length;
      if (a.fin === 'exdeathPower') st.p = finAmount(g, c.controller, c.id, 'gravePermanents');
    }
  for (const id of g.battlefield) {
    const eq = g.cards[id];
    if (eq.attachedTo === c.id && abilitiesOf(g, eq).some((a) => a.kind === 'static' && a.fin === 'lifeBase'))
      st.p = st.t = g.players[eq.controller].life;
  }
}

export function refreshFinLands(g: GameState) {
  for (const id of g.battlefield) {
    const c = g.cards[id];
    if (c.finMarks?.blightedLand && !(c.eclCounters?.blight ?? 0) && c.tlaOriginalDef) {
      c.def = c.tlaOriginalDef;
      c.tlaOriginalDef = undefined;
      delete c.finMarks.blightedLand;
    }
  }
}
