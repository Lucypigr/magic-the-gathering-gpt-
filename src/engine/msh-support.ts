import { abilitiesSuppressed, isCreature, isLand, matches, stats } from './state';
import { colorsOf, manaValue, parseCost } from './mana';
import type { Card, CardDef, Cond, GameEvent, GameState, PID, TriggeredAbility } from './types';
export function mshStatic(g: GameState, pid: PID, name: string) {
  return g.battlefield
    .map((id) => g.cards[id])
    .filter(
      (c) =>
        c.controller === pid &&
        [...(c.def.abilities ?? []), ...(c.copiedAbilities ?? [])].some((a) => a.kind === 'static' && a.msh === name) &&
        !abilitiesSuppressed(g, c),
    );
}
export const mshFlags = (g: GameState, pid: PID) => {
  const p = g.players[pid];
  if (p.mshFlagsTurn !== g.turn) {
    p.mshFlagsTurn = g.turn;
    p.mshFlags = {};
  }
  return (p.mshFlags ??= {});
};
export const planLimit = (c: Card) =>
  ({
    'political-triumph': 4,
    'rewrite-history': 4,
    'construct-a-cosmic-cube': 7,
    'doom-reigns-supreme': 5,
    'robot-domination': 3,
    'death-to-our-enemies': 4,
    'claim-the-kingdom': 4,
  })[c.def.id] ?? 0;
export function teamworkOptions(g: GameState, pid: PID) {
  return g.battlefield.filter((id) => g.cards[id].controller === pid && isCreature(g.cards[id]) && !g.cards[id].tapped);
}
export function teamworkPayment(g: GameState, pid: PID, n: number, chosen?: number[]) {
  const options = teamworkOptions(g, pid);
  if (chosen)
    return new Set(chosen).size === chosen.length &&
      chosen.every((id) => options.includes(id)) &&
      chosen.reduce((v, id) => v + Math.max(0, stats(g, g.cards[id]).p), 0) >= n
      ? chosen
      : null;
  const out: number[] = [];
  let value = 0;
  for (const id of options.sort((a, b) => stats(g, g.cards[b]).p - stats(g, g.cards[a]).p)) {
    if (value >= n) break;
    out.push(id);
    value += Math.max(0, stats(g, g.cards[id]).p);
  }
  return value >= n ? out : null;
}
export function mshAmount(g: GameState, pid: PID, source: number, name: string, ev?: GameEvent) {
  const c = g.cards[source],
    mine = g.battlefield.map((id) => g.cards[id]).filter((x) => x.controller === pid);
  const spell = ev?.type === 'cast' ? g.cards[ev.card] : undefined;
  switch (name) {
    case 'selfToughness':
      return c ? stats(g, c).t : 0;
    case 'equipmentAttached':
      return mine.filter((x) => x.attachedTo === source && x.def.subtypes?.includes('Equipment')).length;
    case 'blueSymbols':
      return spell ? (spell.def.cost?.match(/\{[^}]*U[^}]*\}/g)?.length ?? 0) : 0;
    case 'spellManaValue':
      return spell
        ? manaValue(spell.def) +
            (g.stack.find((s) => s.kind === 'spell' && s.cardId === spell.id)?.x ?? 0) * (parseCost(spell.def.cost).x ?? 0)
        : 0;
    case 'maxArtifactMV':
      return Math.max(0, ...mine.filter((x) => x.def.types.includes('Artifact')).map((x) => manaValue(x.def)));
    case 'toTen':
      return Math.max(0, 10 - g.players[pid].hand.length);
    default:
      throw new Error('Unknown MSH amount ' + name);
  }
}
export function mshCondition(g: GameState, cond: Extract<Cond, { c: 'msh' }>, pid: PID, source: number) {
  const c = g.cards[source];
  switch (cond.action) {
    case 'teamwork':
      return !!c?.mshTeamwork;
    case 'harnessed':
      return !!c?.mshHarnessed;
    case 'heroThisTurn':
      return !!mshFlags(g, pid).heroThisTurn;
    case 'oneAttacker':
      return g.battlefield.filter((id) => g.cards[id].controller === pid && g.cards[id].attacking).length === 1;
    case 'doomIndestructible':
      return g.battlefield.some(
        (id) =>
          g.cards[id].controller === pid &&
          (g.cards[id].def.subtypes?.includes('Plan') || (isCreature(g.cards[id]) && g.cards[id].def.types.includes('Artifact'))),
      );
    case 'attackedSelf':
      return c?.attackedTurn === g.turn;
    case 'selfPower4':
      return !!c && stats(g, c).p >= 4;
    default:
      throw new Error('Unknown MSH condition ' + cond.action);
  }
}
export function mshTriggerMatches(g: GameState, c: Card, ab: TriggeredAbility, ev: GameEvent) {
  const pid = c.controller,
    ec = 'card' in ev ? g.cards[ev.card] : undefined;
  const creature = ec && isCreature(ec);
  const castOwn = ev.type === 'cast' && ev.player === pid;
  const item = ev.type === 'cast' ? g.stack.find((s) => s.kind === 'spell' && s.cardId === ev.card) : undefined;
  const targetsOwn = !!item?.targets.some((t) => t && 'c' in t && g.cards[t.c]?.controller === pid && isCreature(g.cards[t.c]));
  switch (ab.mshEvent) {
    case 'aloneAttack':
      return ev.type === 'youAttack' && ev.player === pid && ev.attackers.length === 1;
    case 'teamworkTap':
      return ev.type === 'msh' && ev.action === 'teamworkTap' && ev.card === c.id;
    case 'castTargetsOwnCreature':
      return castOwn && targetsOwn;
    case 'castTargetsCreatures':
      return castOwn && !!item?.targets.some((t) => t && 'c' in t && isCreature(g.cards[t.c]));
    case 'otherHeroCounters':
      if (
        ev.type === 'counterPlaced' &&
        ev.controller === pid &&
        ev.card !== c.id &&
        !!creature &&
        matches(g, { sub: 'Hero' }, ec, pid) &&
        (ev.counterKind === undefined || ev.counterKind === '+1/+1')
      ) {
        if (ev.counterBatch !== undefined) {
          if (c.mshMarks?.heroCounterGroup === ev.counterBatch) return false;
          (c.mshMarks ??= {}).heroCounterGroup = ev.counterBatch;
        }
        return true;
      }
      return false;
    case 'otherCreatureCounter':
      return ev.type === 'counterPlaced' && ev.card !== c.id && !!creature && (ev.counterKind === undefined || ev.counterKind === '+1/+1');
    case 'anyCreatureCounter':
      return ev.type === 'counterPlaced' && !!creature && (ev.counterKind === undefined || ev.counterKind === '+1/+1');
    case 'allyDamaged':
      return ev.type === 'damaged' && ec?.controller === pid && !!creature;
    case 'merfolkAttack':
      return ev.type === 'youAttack' && ev.player === pid && ev.attackers.some((id) => matches(g, { sub: 'Merfolk' }, g.cards[id], pid));
    case 'abilityTargets':
      return (
        (ev.type === 'targeted' && ev.by === pid && !ev.spell) ||
        (ev.type === 'msh' && ev.action === 'abilityPlayerTarget' && ev.player === pid)
      );
    case 'tokensEntered':
      if (ev.type !== 'etb' || !ec?.token || ec.controller !== pid) return false;
      if (g.mshTokenGroup !== undefined) {
        if (c.mshMarks?.tokenGroup === g.mshTokenGroup) return false;
        (c.mshMarks ??= {}).tokenGroup = g.mshTokenGroup;
      }
      return true;
    case 'blueNoncreature':
      return castOwn && !!ec && !isCreature(ec) && (ec.def.cost ?? '').includes('U');
    case 'allyTapped':
      if (ev.type !== 'tapped' || ev.controller !== pid || !creature) return false;
      if (g.mshTapGroup !== undefined) {
        if (c.mshMarks?.tapGroup === g.mshTapGroup) return false;
        (c.mshMarks ??= {}).tapGroup = g.mshTapGroup;
      }
      return true;
    case 'enchantedAttackBlock':
      return (ev.type === 'attacks' || ev.type === 'blocks') && ev.card === c.attachedTo;
    case 'enchantedUpkeep':
      return ev.type === 'step' && ev.step === 'upkeep' && g.cards[c.attachedTo ?? -1]?.controller === ev.player;
    case 'otherBounced':
      return (
        ev.type === 'fin' &&
        ev.action === 'zoneMove' &&
        ev.from === 'battlefield' &&
        ev.to === 'hand' &&
        ec?.mshMarks?.lastController === pid &&
        ec.id !== c.id &&
        !isLand(ec)
      );
    case 'nextSmallSpell':
      return (
        castOwn && !!ec && ec.def.types.some((t) => t === 'Instant' || t === 'Sorcery') && manaValue(ec.def) <= (c.mshMarks?.lokiPower ?? 0)
      );
    case 'blackFromHand':
      return castOwn && !!ec && ec.castOrigin === 'hand' && colorsOf(ec.def).includes('B');
    case 'planReady':
      return ev.type === 'msh' && ev.action === 'planReady' && ev.card === c.id;
    case 'creatureToGrave':
      if (ev.type !== 'fin' || ev.action !== 'zoneMove' || ev.to !== 'graveyard' || ev.player !== pid || !creature) return false;
      if (g.eclEventGroup !== undefined) {
        if (c.mshMarks?.graveGroup === g.eclEventGroup) return false;
        (c.mshMarks ??= {}).graveGroup = g.eclEventGroup;
      }
      return true;
    case 'equippedAttack':
      return (
        ev.type === 'attacks' &&
        ec?.controller === pid &&
        g.battlefield.some((id) => g.cards[id].attachedTo === ec.id && g.cards[id].def.equip)
      );
    case 'spellTargetsArtifactLand':
      return (
        castOwn &&
        !!ec &&
        ec.def.types.some((t) => t === 'Instant' || t === 'Sorcery') &&
        !!item?.targets.some((t) => t && 'c' in t && g.cards[t.c].def.types.some((s) => s === 'Artifact' || s === 'Land'))
      );
    case 'draw':
      return ev.type === 'msh' && ev.action === 'draw' && ev.player === pid;
    case 'villainOrArtifactEnters':
      return (
        ev.type === 'etb' &&
        ec?.controller === pid &&
        ec.id !== c.id &&
        (matches(g, { sub: 'Villain' }, ec, pid) || ec.def.types.includes('Artifact'))
      );
    case 'heroDamageBatch':
      return ev.type === 'msh' && ev.action === 'heroDamage' && ev.player === pid;
    case 'firstAllyTap':
      return (
        ev.type === 'tapped' &&
        ev.controller === pid &&
        g.active === pid &&
        !!creature &&
        ec.mshMarks?.firstTap === g.turn &&
        ec.mshMarks?.firstTapEvent === g.mshEvent
      );
    case 'targetedBySpell':
      return ev.type === 'targeted' && ev.spell && ev.card === c.id;
    default:
      throw new Error('Unknown MSH trigger ' + ab.mshEvent);
  }
}
export function mshObserve(g: GameState, ev: GameEvent) {
  g.mshEvent = (g.mshEvent ?? 0) + 1;
  if (ev.type === 'etb' && matches(g, { sub: 'Hero' }, g.cards[ev.card], ev.controller)) mshFlags(g, ev.controller).heroThisTurn = 1;
  if (ev.type === 'attacks') {
    const c = g.cards[ev.card];
    if (matches(g, { sub: 'Hero' }, c, c.controller)) mshFlags(g, c.controller).heroThisTurn = 1;
  }
  if (ev.type === 'counterPlaced' && (ev.counterKind === undefined || ev.counterKind === '+1/+1') && (ev.amount ?? 0) > 0)
    (g.cards[ev.card].mshMarks ??= {}).plusTurn = g.turn;
  if (ev.type === 'tapped') {
    const c = g.cards[ev.card];
    if (c.mshMarks?.firstTap !== g.turn) {
      (c.mshMarks ??= {}).firstTap = g.turn;
      c.mshMarks.firstTapEvent = g.mshEvent;
    }
  }
}
export function mshApplyStats(g: GameState, c: Card, st: import('./state').Stats) {
  const pid = c.controller;
  for (const [kw, n] of Object.entries(c.eclCounters ?? {}))
    if (
      n > 0 &&
      [
        'flying',
        'first_strike',
        'double_strike',
        'deathtouch',
        'indestructible',
        'lifelink',
        'menace',
        'reach',
        'trample',
        'vigilance',
        'haste',
      ].includes(kw)
    )
      st.kw.add(kw as import('./types').Keyword);
  if (c.mshMarks?.freezeBy !== undefined) {
    const s = g.cards[c.mshMarks.freezeBy];
    if (s?.zone === 'battlefield') st.noUntap = true;
  }
  if (c.mshMarks?.sizeHand === g.turn) st.p = g.players[pid].hand.length + c.counters;
  if (!abilitiesSuppressed(g, c)) {
    if (c.def.id === 'namor-the-sub-mariner')
      st.p =
        g.battlefield.filter((id) => g.cards[id].controller === pid && matches(g, { sub: 'Merfolk' }, g.cards[id], pid)).length +
        c.counters;
    if (c.def.id === 'super-adaptoid')
      st.p =
        g.battlefield.filter(
          (id) => g.cards[id].controller === pid && isCreature(g.cards[id]) && g.cards[id].def.supertypes?.includes('Legendary'),
        ).length + c.counters;
    if (c.def.id === 'stature-size-shifter' && st.p <= 1) st.kw.add('unblockable');
    if (c.def.id === 'doctor-doom' && mshCondition(g, { c: 'msh', action: 'doomIndestructible' }, pid, c.id)) st.kw.add('indestructible');
    if (c.def.id === 'iron-man-master-of-machines')
      st.p += g.battlefield.filter(
        (id) => g.cards[id].controller === pid && id !== c.id && g.cards[id].def.types.includes('Artifact'),
      ).length;
    if (c.def.id === 'winter-soldier-icy-assassin')
      st.p += 2 * g.battlefield.filter((id) => g.cards[id].attachedTo === c.id && g.cards[id].def.equip).length;
    if (c.def.id === 'undercover-skrull' && g.players[pid].graveyard.filter((id) => isCreature(g.cards[id])).length >= 2) {
      st.p += 2;
      st.t += 2;
    }
    if (c.def.id === 'killmonger-scourge-of-wakanda' && g.players[pid].graveyard.filter((id) => isCreature(g.cards[id])).length >= 2) {
      st.p += 2;
      st.t++;
    }
    if (c.def.id === 'iron-man-armor' && isCreature(c)) {
      const n = g.battlefield.filter((id) => g.cards[id].controller === pid && g.cards[id].def.types.includes('Artifact')).length;
      st.p += n;
      st.t += n;
    }
    if (c.def.id === 'beast-erudite-aerialist' && c.mshMarks?.plusTurn === g.turn) st.kw.add('flying');
  }
  if (c.mshMarks?.plusTurn === g.turn && mshStatic(g, pid, 'counterHexproof').length) st.kw.add('hexproof');
  for (const source of mshStatic(g, pid, 'shieldHexproof'))
    if (source.id !== c.id && (source.eclCounters?.shield ?? 0) > 0 && matches(g, { sub: 'Hero' }, c, pid)) st.kw.add('hexproof');
}
export function mshCanImprovise(g: GameState, pid: PID, def: CardDef) {
  return (
    !def.eclAbilityPayment &&
    (!!def.msh?.improvise || (!def.types.includes('Creature') && mshStatic(g, pid, 'noncreatureImprovise').length > 0))
  );
}

export function blackSymbols(c: Card) {
  return c.def.cost?.match(/\{[^}]*B[^}]*\}/g)?.length ?? 0;
}
