import { abilitiesSuppressed, isCreature, isLand, matches, stats } from './state';
import { colorsOf, manaValue } from './mana';
import type { Card, Cond, GameEvent, GameState, PID, TriggeredAbility } from './types';
export const mkmFlags = (g: GameState, pid: PID) => {
  const p = g.players[pid];
  if (p.mkmTurn !== g.turn) {
    p.mkmTurn = g.turn;
    p.mkmFlags = {};
    p.mkmSources = [];
  }
  return (p.mkmFlags ??= {});
};
export const mkmStatic = (g: GameState, pid: PID, name: string) =>
  g.battlefield
    .map((id) => g.cards[id])
    .filter(
      (c) =>
        c.controller === pid &&
        [
          ...(c.def.abilities ?? []),
          ...(c.copiedAbilities ?? []),
          ...(c.temporaryAbilities?.turn === g.turn ? c.temporaryAbilities.abilities : []),
        ].some((a) => a.kind === 'static' && a.mkm === name) &&
        !abilitiesSuppressed(g, c),
    );
export const evidenceChoices = (g: GameState, pid: PID, exclude?: number) => g.players[pid].graveyard.filter((id) => id !== exclude);
export const canEvidence = (g: GameState, pid: PID, n: number, exclude?: number) =>
  evidenceChoices(g, pid, exclude).reduce((v, id) => v + manaValue(g.cards[id].def), 0) >= n;
export function mkmAmount(g: GameState, pid: PID, source: number, name: string, x = 0) {
  const list = g.battlefield.map((id) => g.cards[id]).filter((c) => c.controller === pid),
    src = g.cards[source];
  switch (name) {
    case 'extraDraws':
      return Math.max(0, g.players[pid].drawsThisTurn - 1);
    case 'twiceX':
      return 2 * x;
    case 'tokenNames':
      return new Set(list.filter((c) => c.token && isCreature(c)).map((c) => c.def.name)).size;
    case 'maxToughness':
      return Math.max(0, ...list.filter(isCreature).map((c) => stats(g, c).t));
    case 'otherCreatures':
      return list.filter((c) => isCreature(c) && c.id !== source).length;
    case 'sourceToughness':
      return src ? stats(g, src).t : 0;
    case 'pairs':
      if (mkmStatic(g, pid, 'guildpact').length) return 0;
      return new Set(
        list
          .map((c) => colorsOf(c.def))
          .filter((c) => c.length === 2)
          .map((c) => c.sort().join('')),
      ).size;
    default:
      throw new Error('Unknown MKM amount ' + name);
  }
}
export function mkmCondition(g: GameState, c: Extract<Cond, { c: 'mkm' }>, pid: PID, source: number, ev?: GameEvent) {
  const src = g.cards[source],
    flags = mkmFlags(g, pid),
    list = g.battlefield.map((id) => g.cards[id]).filter((c) => c.controller === pid);
  switch (c.action) {
    case 'solved':
      return !!src?.mkmSolved;
    case 'evidence':
      return !!src?.mkmEvidence;
    case 'artifactSac':
      return !!flags.artifactSac;
    case 'creatureGy':
      return !!flags.creatureGy;
    case 'faceDownEntered':
      return !!flags.faceDownEntered;
    case 'unlocked':
      return (src?.mkmMarks?.unlock ?? 0) >= 5;
    case 'damage3':
      return ev?.type === 'damaged' && ev.amount >= 3;
    case 'sourceToGy':
      return src.zone === 'graveyard';
    case 'solve':
      if (src.mkmSolved) return false;
      switch (src.def.id) {
        case 'case-of-the-shattered-pact':
          if (mkmStatic(g, pid, 'guildpact').length && list.some((c) => !isLand(c))) return true;
          return new Set(list.flatMap((c) => colorsOf(c.def))).size === 5;
        case 'case-of-the-gateway-express':
          return (flags.attackers ?? 0) >= 3;
        case 'case-of-the-pilfered-proof':
          return list.filter((c) => matches(g, { sub: 'Detective' }, c, pid)).length >= 3;
        case 'case-of-the-uneaten-feast':
          return g.players[pid].lifeGainedThisTurn >= 5;
        case 'case-of-the-filched-falcon':
          return list.filter((c) => c.def.types.includes('Artifact')).length >= 3;
        case 'case-of-the-ransacked-lab':
          return g.players[pid].instSorcThisTurn >= 4;
        case 'case-of-the-gorgons-kiss':
          return g.players.reduce((n, p) => n + (mkmFlags(g, p.id).creatureGy ?? 0), 0) >= 3;
        case 'case-of-the-stashed-skeleton':
          return !list.some((c) => c.suspected && matches(g, { sub: 'Skeleton' }, c, pid));
        case 'case-of-the-burning-masks':
          return (g.players[pid].mkmSources?.length ?? 0) >= 3;
        case 'case-of-the-crimson-pulse':
          return !g.players[pid].hand.length;
        case 'case-of-the-locked-hothouse':
          return list.filter(isLand).length >= 7;
        case 'case-of-the-trampled-garden':
          return list.filter(isCreature).reduce((n, c) => n + stats(g, c).p, 0) >= 8;
      }
      return false;
    default:
      throw new Error('Unknown MKM condition ' + c.action);
  }
}
export function mkmTriggerMatches(g: GameState, c: Card, ab: TriggeredAbility, ev: GameEvent) {
  const pid = c.controller,
    ec = 'card' in ev && ev.card !== undefined ? g.cards[ev.card] : undefined;
  const detective = ec && ec.controller === pid && matches(g, { type: 'Creature', sub: 'Detective' }, ec, pid);
  switch (ab.mkmEvent) {
    case 'blocked':
      return ev.type === 'mkm' && ev.action === 'blocked' && ev.card === c.id;
    case 'enchantedHit':
      return ev.type === 'combatDamage' && ev.source === c.attachedTo;
    case 'solve':
      return ev.type === 'step' && ev.step === 'endStep' && ev.player === pid && !c.mkmSolved;
    case 'solved':
      return ev.type === 'mkm' && ev.action === 'solved' && ev.player === pid;
    case 'evidence':
      return ev.type === 'mkm' && ev.action === 'evidence' && ev.player === pid;
    case 'detectiveEntersUp':
      return !!detective && (ev.type === 'etb' || ev.type === 'turnedFaceUp');
    case 'otherDetectiveEntersUp':
      return !!detective && ((ev.type === 'etb' && ec.id !== c.id) || ev.type === 'turnedFaceUp');
    case 'creatureUp':
      return ev.type === 'turnedFaceUp' && !!ec && ec.controller === pid && isCreature(ec);
    case 'attackThree':
      return ev.type === 'youAttack' && ev.player === pid && ev.attackers.length >= 3;
    case 'anyAttackThree':
      return ev.type === 'youAttack' && ev.attackers.length >= 3;
    case 'anyAttackFive':
      return ev.type === 'youAttack' && ev.attackers.length >= 5;
    case 'suspectAttack':
      return ev.type === 'youAttack' && ev.player === pid && ev.attackers.some((id) => g.cards[id].suspected);
    case 'anyDies':
      return ev.type === 'dies' && !!ec && isCreature(ec);
    case 'oneOrMoreDies':
      if (ev.type !== 'dies' || !ec || !isCreature(ec) || c.mkmMarks?.deathGroup === g.eclEventGroup) return false;
      (c.mkmMarks ??= {}).deathGroup = g.eclEventGroup ?? g.nextSid++;
      return true;
    case 'nontokenDies':
      return ev.type === 'dies' && ev.controller === pid && !!ec && isCreature(ec) && !ec.token;
    case 'zeroToughnessDies':
      return ev.type === 'dies' && ev.controller !== pid && !!ec && isCreature(ec) && (ev.toughness ?? 0) < 1;
    case 'impostorDies':
      return ev.type === 'dies' && ev.controller === pid && !!ec?.mkmMarks?.impostor;
    case 'artifactSac':
    case 'oppArtifactSac':
    case 'clueSac':
      return (
        ev.type === 'sacrifice' &&
        !!ec &&
        (ab.mkmEvent === 'oppArtifactSac' ? ev.player !== pid : ev.player === pid) &&
        (ab.mkmEvent === 'clueSac' ? matches(g, { sub: 'Clue' }, ec, pid) : ec.def.types.includes('Artifact'))
      );
    case 'clueGy':
    case 'artifactGy':
      return (
        ev.type === 'fin' &&
        ev.action === 'zoneMove' &&
        ev.from === 'battlefield' &&
        ev.to === 'graveyard' &&
        !!ec &&
        (ab.mkmEvent === 'artifactGy' ? ec.def.types.includes('Artifact') : ev.player === pid && matches(g, { sub: 'Clue' }, ec, pid))
      );
    case 'creatureGyLeaves':
      if (
        ev.type !== 'fin' ||
        ev.action !== 'zoneMove' ||
        ev.from !== 'graveyard' ||
        ev.to === 'graveyard' ||
        ev.player !== pid ||
        !ec ||
        !isCreature(ec)
      )
        return false;
      if (g.mkmCollecting !== undefined) {
        if (c.mkmMarks?.graveGroup === g.mkmCollecting) return false;
        (c.mkmMarks ??= {}).graveGroup = g.mkmCollecting;
      }
      return true;
    case 'anyDamaged':
      return ev.type === 'damaged';
    case 'otherCreatureEtb':
      return ev.type === 'etb' && !!ec && ec.id !== c.id && ec.controller === pid && isCreature(ec);
    case 'assassinHit':
      return (
        ev.type === 'combatDamage' &&
        ev.player !== pid &&
        matches(g, { sub: 'Assassin' }, g.cards[ev.source], pid) &&
        g.cards[ev.source].controller === pid
      );
    case 'creatureExiled':
      return (
        ev.type === 'fin' &&
        ev.action === 'zoneMove' &&
        ev.to === 'exile' &&
        !!ec &&
        isCreature(ec) &&
        ((ev.from === 'graveyard' && ev.player === pid) || (ev.from === 'battlefield' && ec.mkmMarks?.lastController === pid))
      );
    case 'wolfAttack':
      return ev.type === 'attacks' && !!ec && ec.controller === pid && matches(g, { sub: 'Wolf' }, ec, pid) && c.attackedTurn === g.turn;
    case 'faceDownCombat':
      return ev.type === 'combatBatch' && ev.attacker === pid && mkmFlags(g, pid).faceDownHit === g.turn;
    case 'faceDownDies':
      return ev.type === 'dies' && ev.controller === pid && !!ec?.hidden;
    default:
      throw new Error('Unknown MKM event ' + ab.mkmEvent);
  }
}
export function mkmObserve(g: GameState, ev: GameEvent) {
  if (ev.type === 'youAttack') mkmFlags(g, ev.player).attackers = Math.max(mkmFlags(g, ev.player).attackers ?? 0, ev.attackers.length);
  if (ev.type === 'etb' && g.cards[ev.card]?.hidden) mkmFlags(g, ev.controller).faceDownEntered = 1;
  if (ev.type === 'sacrifice') {
    const c = g.cards[ev.card];
    if (c.def.types.includes('Artifact')) mkmFlags(g, ev.player).artifactSac = 1;
  }
  if (ev.type === 'fin' && ev.action === 'sourceDamage' && ev.card !== undefined) {
    const c = g.cards[ev.card];
    if (c) {
      (c.mkmMarks ??= {}).dealtDamage = g.turn;
      const p = g.players[ev.player];
      mkmFlags(g, ev.player);
      if (!p.mkmSources!.includes(ev.card)) p.mkmSources!.push(ev.card);
    }
  }
  if (ev.type === 'fin' && ev.action === 'zoneMove' && ev.to === 'graveyard' && ev.card !== undefined) {
    const c = g.cards[ev.card];
    c.gyTurn = g.turn;
    if (isCreature(c)) mkmFlags(g, ev.player).creatureGy = (mkmFlags(g, ev.player).creatureGy ?? 0) + 1;
    if (ev.from === 'battlefield' && c.def.types.includes('Artifact'))
      for (const p of g.players) mkmFlags(g, p.id).artifactGy = (mkmFlags(g, p.id).artifactGy ?? 0) + 1;
  }
  if (ev.type === 'combatDamage' && g.cards[ev.source].hidden) mkmFlags(g, g.cards[ev.source].controller).faceDownHit = g.turn;
  if (ev.type === 'cast' && g.cards[ev.card].castOrigin === 'library') mkmFlags(g, ev.player).topCast = 1;
}
export function mkmBaseStats(g: GameState, c: Card, st: import('./state').Stats) {
  if (!abilitiesSuppressed(g, c) && c.def.id === 'living-conundrum' && !g.players[c.controller].library.length)
    st.p = st.t = 10;
  for (const id of g.battlefield) {
    const a = g.cards[id];
    if (a.attachedTo === c.id && a.def.id === 'burden-of-proof' && !abilitiesSuppressed(g, a) &&
        !(a.controller === c.controller && matches(g, { sub: 'Detective' }, c, c.controller)))
      st.p = st.t = 1;
  }
}
export function mkmApplyStats(g: GameState, c: Card, st: import('./state').Stats) {
  const pid = c.controller;

  const lost = abilitiesSuppressed(g, c);
  if (!lost && c.def.id === 'flourishing-bloom-kin') {
    const n = g.battlefield.filter((id) => g.cards[id].controller === pid && matches(g, { sub: 'Forest' }, g.cards[id], pid)).length;
    st.p += n;
    st.t += n;
  }
  if (!lost && c.def.id === 'living-conundrum' && !g.players[pid].library.length) {
    st.kw.add('flying');
    st.kw.add('vigilance');
  }
  if (!lost && c.def.id === 'furtive-courier' && mkmFlags(g, pid).artifactSac) st.kw.add('unblockable');
  if (c.tapped && mkmStatic(g, pid, 'tappedHexproof').length) st.kw.add('hexproof');
  for (const id of g.battlefield) {
    const a = g.cards[id];
    if (a.attachedTo !== c.id || !['knife', 'burden-of-proof'].includes(a.def.id) || abilitiesSuppressed(g, a)) continue;
    if (a.def.id === 'knife' && g.active === pid) {
      st.p++;
      st.kw.add('first_strike');
    }
    if (a.def.id === 'burden-of-proof') {
      if (a.controller === pid && matches(g, { sub: 'Detective' }, c, pid)) {
        st.p += 2;
        st.t += 2;
      }
    }
  }
}
