import {
  abilitiesSuppressed,
  isCreature,
  isLand,
  matches,
  stats,
} from "./state";
import { frontierStatic, frontierFlags } from "./frontier-support";
import { emit, moveCard } from "./zones";
import type {
  Card,
  GameState,
  PID,
  GameEvent,
  TriggeredAbility,
  TargetRef,
} from "./types";
export function otjAmount(
  g: GameState,
  pid: PID,
  source: number,
  key: string,
  ev?: GameEvent,
) {
  const own = (filter: import("./types").Filter) =>
    g.battlefield.filter(
      (id) =>
        g.cards[id].controller === pid && matches(g, filter, g.cards[id], pid),
    );
  switch (key) {
    case "sourceToughness":
      return stats(g, g.cards[source]).t;
    case "steerClear":
      return g.cards[source].frontierMarks?.castMount ? 4 : 2;
    case "otherZombiesEntered":
      return Math.max(0, (frontierFlags(g, pid).zombies ?? 0) - 1);
    case "twiceExtraSpells":
      return 2 * Math.max(0, g.players[pid].spellsThisTurn - 1);
    case "negativeDeserts2":
      return -2 - own({ sub: "Desert" }).length;
    case "noncreatureSpells":
      return ev?.type === "cast"
        ? (g.players[ev.player].noncreatureThisTurn ?? 0)
        : 0;
    case "spellsPlus1":
      return 1 + g.players[pid].spellsThisTurn;
    case "twiceTreasures":
      return 2 * own({ sub: "Treasure" }).length;
    case "twiceLands":
      return 2 * own({ type: "Land" }).length;
    case "crewCount":
      return g.cards[source].crewedBy?.length ?? 0;
    default:
      throw Error("Unknown frontier amount " + key);
  }
}
export function otjCondition(
  g: GameState,
  key: string,
  pid: PID,
  source: number,
) {
  switch (key) {
    case "crime":
      return !!frontierFlags(g, pid).crime;
    case "noHandSpell":
      return !frontierFlags(g, pid).handCast;
    case "fourCounters":
      return g.cards[source].counters >= 4;
    case "firstSpell":
      return g.players[pid].spellsThisTurn === 1;
    default:
      throw Error("Unknown frontier condition " + key);
  }
}
function tokenBatch(c: Card, ec: Card, key: string) {
  const batch = ec.frontierMarks?.tokenBatch;
  if (batch !== undefined && c.frontierMarks?.[key] === batch) return false;
  (c.frontierMarks ??= {})[key] = batch ?? ec.id;
  return true;
}
export function otjTrigger(
  g: GameState,
  c: Card,
  a: TriggeredAbility,
  ev: GameEvent,
) {
  const pid = c.controller,
    ec = "card" in ev ? g.cards[ev.card] : undefined,
    item =
      ev.type === "cast"
        ? g.stack.find((s) => s.kind === "spell" && s.cardId === ev.card)
        : undefined;
  switch (a.frontierEvent) {
    case "crime":
      return (
        (!a.fromGraveyard || c.zone === "graveyard") &&
        ev.type === "frontier" &&
        ev.action === "crime" &&
        ev.player === pid
      );
    case "otherOwnDiesBatch":
      if (ev.type !== "dies" || ev.controller !== pid || !ec || ec.id === c.id)
        return false;
      {
        const group = g.eclEventGroup;
        if (group !== undefined && c.frontierMarks?.deathBatch === group)
          return false;
        (c.frontierMarks ??= {}).deathBatch = group ?? g.nextSid++;
        return true;
      }
    case "outlawCast":
      return (
        ev.type === "cast" &&
        ev.player === pid &&
        !!ec &&
        matches(g, { outlaw: true }, ec, pid)
      );
    case "notFirstOwnTurnSpell":
      return (
        ev.type === "cast" &&
        ev.player === pid &&
        g.active === pid &&
        g.players[pid].spellsThisTurn >= 2
      );
    case "selfPlotted":
      return (
        ev.type === "frontier" && ev.action === "plotted" && ev.card === c.id
      );
    case "anyNoncreatureSpell":
      return (
        ev.type === "cast" &&
        !!ec &&
        !(
          item?.alt === "adventure" ? ec.def.adventure!.types : ec.def.types
        ).includes("Creature")
      );
    case "firstSaddled":
      return (
        ev.type === "frontier" &&
        ev.action === "saddled" &&
        ev.card === c.id &&
        ev.amount === 1
      );
    case "selfTapped":
      return ev.type === "tapped" && ev.card === c.id;
    case "selfAttached":
      return (
        ev.type === "frontier" && ev.action === "attached" && ev.card === c.id
      );
    case "auraAttached":
      return (
        ev.type === "frontier" &&
        ev.action === "attached" &&
        ev.player === pid &&
        !!ec?.def.subtypes?.includes("Aura")
      );
    case "activatedTargets":
      return (
        ev.type === "frontier" &&
        ev.action === "activatedTargets" &&
        ev.player === pid
      );
    case "ownTokensBatch":
      return (
        ev.type === "etb" &&
        ec?.controller === pid &&
        !!ec.token &&
        tokenBatch(c, ec, "ownTokenBatch")
      );
    case "oppTokensBatch":
      return (
        ev.type === "etb" &&
        ec?.controller !== pid &&
        !!ec?.token &&
        tokenBatch(c, ec, "oppTokenBatch")
      );
    case "power4Attack":
      return (
        ev.type === "youAttack" &&
        ev.player === pid &&
        ev.attackers.some((id) => stats(g, g.cards[id]).p >= 4)
      );
    case "castNotHand":
      return (
        ev.type === "cast" && ev.player === pid && ec?.castOrigin !== "hand"
      );
    case "mountAttack":
      return (
        ev.type === "attacks" &&
        ec?.controller === pid &&
        matches(g, { sub: ["Mount", "Vehicle"] }, ec, pid)
      );
    case "modalSpell":
      return (
        ev.type === "cast" &&
        ev.player === pid &&
        !!ec &&
        !!ec.frontierMarks?.modalChoices
      );
    case "combatTarget":
      return (
        ev.type === "combatDamage" &&
        g.cards[ev.source].controller === pid &&
        ev.player === a.frontierPlayer
      );
    case "combatEnd":
      return (
        ev.type === "fin" && ev.action === "endCombat" && ev.player === pid
      );
    case "freeCreatureEntry":
      if (
        ev.type !== "etb" ||
        !ec ||
        ec.controller !== pid ||
        ec.token ||
        !isCreature(ec) ||
        (ec.wasCast && (ec.manaSpent ?? 0) > 0)
      )
        return false;
      {
        const batch = g.frontierEntryBatch;
        if (batch !== undefined && c.frontierMarks?.creatureBatch === batch)
          return false;
        if (batch !== undefined) (c.frontierMarks ??= {}).creatureBatch = batch;
        return true;
      }
    case "exactNoncombat":
      return (
        ev.type === "frontier" &&
        ev.action === "exactNoncombat" &&
        ev.player === pid
      );
    case "legendCombat":
      return (
        ev.type === "combatDamage" &&
        g.cards[ev.source].controller === pid &&
        matches(g, { legendary: true }, g.cards[ev.source], pid)
      );
    default:
      throw Error("Unknown frontier trigger " + a.frontierEvent);
  }
}
export function otjObserve(g: GameState, ev: GameEvent) {
  if (ev.type === "cast") {
    const c = g.cards[ev.card],
      item = g.stack.find((s) => s.kind === "spell" && s.cardId === ev.card);
    if (c.castOrigin === "hand") frontierFlags(g, ev.player).handCast = 1;
    if (item?.modeIndex !== undefined && c.def.spell?.modes)
      (c.frontierMarks ??= {}).modalChoices =
        c.def.spell.modes[item.modeIndex].frontierChoices ?? 1;
    const d = item?.alt === "adventure" ? c.def.adventure! : c.def;
    if (
      c.castOrigin === "hand" &&
      d.types.some((t) => t === "Instant" || t === "Sorcery") &&
      ((d.cost ?? "").match(/[WUBRG]/g)?.filter((x, i, a) => a.indexOf(x) === i)
        .length ?? 0) >= 2 &&
      frontierStatic(g, ev.player, "lilahPlot").length
    )
      (c.frontierMarks ??= {}).lilahPlot = 1;
  }
  if (ev.type === "etb") {
    const c = g.cards[ev.card];
    if (matches(g, { type: "Creature", sub: "Zombie" }, c, c.controller))
      frontierFlags(g, c.controller).zombies =
        (frontierFlags(g, c.controller).zombies ?? 0) + 1;
    if (c.token)
      (c.frontierMarks ??= {}).tokenBatch = g.mshTokenGroup ?? g.nextSid++;
  }
}
export function commitCrime(
  g: GameState,
  pid: PID,
  source: number,
  targets: (TargetRef | null)[],
  sid: number,
  stackSids: number[] = [],
) {
  const flags = frontierFlags(g, pid);
  if (flags.crimeSid === sid) return;
  if (
    !stackSids.some((id) =>
      g.stack.some((s) => s.sid === id && s.controller !== pid),
    ) &&
    !targets.some(
      (t) =>
        t &&
        ("p" in t
          ? t.p !== pid
          : g.cards[t.c] &&
            (g.cards[t.c].zone === "battlefield" ||
            g.cards[t.c].zone === "stack"
              ? g.cards[t.c].controller !== pid
              : g.cards[t.c].zone === "graveyard" &&
                g.cards[t.c].owner !== pid)),
    )
  )
    return;
  flags.crime = 1;
  flags.crimeSid = sid;
  emit(g, {
    type: "frontier",
    action: "crime",
    card: source,
    player: pid,
    amount: 0,
  });
}
export function otjBaseStats(
  g: GameState,
  c: Card,
  st: import("./state").Stats,
) {
  if (abilitiesSuppressed(g, c)) return;
  if (c.def.id === "duelist-of-the-mind")
    st.p = g.players[c.controller].drawsThisTurn;
  if (c.def.id === "tok-otj-beau")
    st.p = st.t = g.battlefield.filter(
      (id) => isLand(g.cards[id]) && g.cards[id].controller === c.controller,
    ).length;
}
export function otjStats(g: GameState, c: Card, st: import("./state").Stats) {
  if (!abilitiesSuppressed(g, c)) {
    if (c.def.id === "stingerback-terror") {
      st.p -= g.players[c.controller].hand.length;
      st.t -= g.players[c.controller].hand.length;
    }
    if (c.def.id === "outcaster-greenblade") {
      const n = g.battlefield.filter(
        (id) =>
          g.cards[id].controller === c.controller &&
          matches(g, { sub: "Desert" }, g.cards[id], c.controller),
      ).length;
      st.p += n;
      st.t += n;
    }
  }
  if (
    matches(g, { sub: ["Mount", "Vehicle"] }, c, c.controller) &&
    g.active === c.controller &&
    frontierStatic(g, c.controller, "mountHexproof").length
  )
    st.kw.add("hexproof");
  if (
    matches(g, { outlaw: true }, c, c.controller) &&
    g.active === c.controller &&
    frontierStatic(g, c.controller, "outlawFirst").length
  )
    st.kw.add("first_strike");
}
export function refreshFrontierCopies(g: GameState) {
  for (const id of g.battlefield) {
    const c = g.cards[id],
      m = c.frontierMarks;
    if (m?.aegisSource !== undefined) {
      const e = g.cards[m.aegisSource];
      if (!e || e.zone !== "battlefield" || e.attachedTo !== c.id) {
        if (c.tlaOriginalDef) {
          c.def = c.tlaOriginalDef;
          c.tlaOriginalDef = undefined;
          c.copyLayer = undefined;
        }
        delete m.aegisSource;
      }
    }
    if (m?.erietteAura !== undefined) {
      const a = g.cards[m.erietteAura];
      if (!a || a.zone !== "battlefield" || a.attachedTo !== c.id) {
        c.controller = m.eriettePrevious as PID;
        delete m.erietteAura;
        delete m.eriettePrevious;
      }
    }
  }
}

export function plotCard(g: GameState, c: Card) {
  moveCard(g, c, "exile");
  c.plottedTurn = g.turn;
  const ev: GameEvent = {
    type: "frontier",
    action: "plotted",
    card: c.id,
    player: c.owner,
    amount: 0,
  };
  for (const [i, a] of (c.def.abilities ?? []).entries())
    if (a.kind === "trigger" && a.frontierEvent === "selfPlotted")
      g.pending.push({
        source: c.id,
        controller: c.owner,
        ability: a,
        abilityIndex: i,
        ev,
      });
  emit(g, ev);
}
