import { frontierStatic, frontierFlags } from "./frontier-support";
import {
  abilitiesOf,
  abilitiesSuppressed,
  isCreature,
  isLand,
  matches,
  stats,
  other,
} from "./state";
import { colorsOf, manaValue } from "./mana";
import { counterKinds } from "./ecl-support";
import { emit } from "./zones";
import type {
  Card,
  GameState,
  PID,
  GameEvent,
  TriggeredAbility,
  ActivatedAbility,
} from "./types";
export const foundationStatic = (g: GameState, pid: PID, key: string) =>
  frontierStatic(g, pid, key);
export const graveTypes = (g: GameState, pid: PID) =>
  new Set(g.players[pid].graveyard.flatMap((id) => g.cards[id].def.types)).size;
export const doorCount = (g: GameState, pid: PID) =>
  g.battlefield.reduce(
    (n, id) =>
      n +
      (g.cards[id].controller === pid && g.cards[id].def.room
        ? Number(!!(g.cards[id].roomUnlocked! & 1)) +
          Number(!!(g.cards[id].roomUnlocked! & 2))
        : 0),
    0,
  );
export function foundationRoomRefresh(c: Card) {
  if (!c.def.room) return;
  const root = c.tlaOriginalDef ?? c.def;
  c.tlaOriginalDef = root;
  const doors = [root.room!.left, root.room!.right].filter(
    (_, i) => (c.roomUnlocked ?? 0) & (1 << i),
  );
  c.def = {
    ...root,
    name: doors.map((d) => d.name).join(" // "),
    imageName: root.imageName ?? root.name,
    cost: doors.map((d) => d.cost).join(""),
    abilities: doors.flatMap((d) => d.abilities ?? []),
    colors: undefined,
  };
}
export function changeDoor(g: GameState, c: Card, door: 0 | 1, unlock = true) {
  if (c.zone !== "battlefield" || !c.def.room) return;
  const old = c.roomUnlocked ?? 0;
  if ((unlock && old & (1 << door)) || (!unlock && !(old & (1 << door))))
    return;
  c.roomUnlocked = unlock ? old | (1 << door) : old & ~(1 << door);
  foundationRoomRefresh(c);
  g.version++;
  if (unlock)
    emit(g, {
      type: "frontier",
      action: "doorUnlocked",
      card: c.id,
      player: c.controller,
      amount: c.roomUnlocked,
      other: door,
    });
}
export function foundationPrepareEntry(
  g: GameState,
  c: Card,
  pid: PID,
  origin: string,
) {
  const f = c.def.foundation,
    m = (c.frontierMarks ??= {});
  if (c.def.room) {
    c.roomUnlocked = origin === "stack" ? (m.castRoomDoor === 1 ? 2 : 1) : 0;
    foundationRoomRefresh(c);
  }
  if (c.impendingPaid && origin === "stack" && c.def.impending) {
    c.impendingTime = c.def.impending.n;
    (c.eclCounters ??= {}).time = c.impendingTime;
    c.tlaOriginalDef ??= c.def;
    c.def = { ...c.def, types: c.def.types.filter((t) => t !== "Creature") };
  }
  if (f?.charge) c.charge = f.charge;
  if (f?.revival) c.charge = origin === "stack" && c.wasCast ? f.revival : 0;
  if (f?.divinity)
    c.charge = origin === "stack" && c.castOrigin === "hand" ? 1 : 0;
  if (f?.raidCounter && g.attackedThisTurn && g.active === pid) c.counters++;
  if (f?.kickerCounters && c.kicked) c.counters += f.kickerCounters;
  if (f?.morbidCounter && g.creatureDiedThisTurn) c.counters++;
  if (f?.plaything && origin === "stack" && c.castOrigin === "hand")
    c.counters -= 2;
  if (f?.zegana)
    c.counters += Math.max(
      0,
      ...g.battlefield
        .filter(
          (id) =>
            id !== c.id &&
            g.cards[id].controller === pid &&
            isCreature(g.cards[id]),
        )
        .map((id) => stats(g, g.cards[id]).p),
    );
  if (
    frontierStatic(g, pid, "fdn:giadaCounters").length &&
    matches(g, { sub: "Angel" }, c, pid)
  )
    c.counters += g.battlefield.filter(
      (id) =>
        id !== c.id &&
        g.cards[id].controller === pid &&
        isCreature(g.cards[id]) &&
        matches(g, { sub: "Angel" }, g.cards[id], pid),
    ).length;
  if (c.def.id === "banner-of-kinship")
    c.charge = g.battlefield.filter(
      (id) =>
        id !== c.id &&
        g.cards[id].controller === pid &&
        matches(g, { type: "Creature", sub: c.eclType }, g.cards[id], pid),
    ).length;
  if (
    frontierStatic(g, other(pid), "fdn:opponentCreaturesTapped").length &&
    isCreature(c)
  )
    c.tapped = true;
}
export function foundationAmount(
  g: GameState,
  pid: PID,
  source: number,
  action: string,
  ev?: GameEvent,
) {
  const key = action.split(":")[1],
    c = g.cards[source],
    p = g.players[pid],
    own = (f: import("./types").Filter) =>
      g.battlefield.filter(
        (id) =>
          g.cards[id].controller === pid &&
          matches(g, f, g.cards[id], pid, source),
      );
  switch (key) {
    case "charge":
      return c.charge ?? 0;
    case "lastPower":
      return c?.zone === "battlefield" ? stats(g, c).p : (c?.lastPower ?? 0);
    case "life":
      return p.life;
    case "attackers":
      return own({ type: "Creature", attacking: true }).length;
    case "eventAttackers":
      return ev?.type === "youAttack" ? ev.attackers.length : 0;
    case "distinctManaValues":
      return new Set(
        own({ nonType: "Land" }).map((id) => manaValue(g.cards[id].def)),
      ).size;
    case "morbidMinus":
      return g.creatureDiedThisTurn ? -13 : -1;
    case "twiceGates":
      return 2 * own({ sub: "Gate" }).length;
    case "eventColors":
      return ev?.type === "cast"
        ? colorsOf(g.cards[ev.card].castFace ?? g.cards[ev.card].def).length
        : 0;
    case "graveTypes":
      return graveTypes(g, pid);
    case "sacrifices":
      return frontierFlags(g, pid).foundationSac ?? 0;
    case "lastCounterTotal":
      return Object.values(
        c.lastCounterKinds ?? counterKinds(c),
      ).reduce<number>((sum, n) => sum + Number(n), 0);
    case "chosenCreaturePower":
      return c.frontierMarks?.chosenCreature !== undefined &&
        c.frontierMarks.chosenCreature >= 0 &&
        g.cards[c.frontierMarks.chosenCreature]?.zone === "battlefield"
        ? stats(g, g.cards[c.frontierMarks.chosenCreature]).p
        : (c.frontierMarks?.chosenPower ?? 0);
    default:
      throw Error("Unknown foundation amount " + action);
  }
}
export function foundationCondition(
  g: GameState,
  action: string,
  pid: PID,
  source: number,
) {
  const key = action.split(":")[1],
    c = g.cards[source],
    p = g.players[pid],
    creatures = g.battlefield.filter((id) => isCreature(g.cards[id]));
  switch (key) {
    case "attack3":
      return (frontierFlags(g, pid).attackers ?? 0) >= 3;
    case "kicked":
      return !!c?.kicked;
    case "threshold":
      return p.graveyard.length >= 7;
    case "creatures13":
      return creatures.length >= 13;
    case "notDemon":
      return !matches(g, { sub: "Demon" }, c, pid);
    case "opponentLostLife":
      return g.players[other(pid)].lifeLostThisTurn > 0;
    case "totalPower8":
      return (
        creatures
          .filter((id) => g.cards[id].controller === pid)
          .reduce((n, id) => n + stats(g, g.cards[id]).p, 0) >= 8
      );
    case "lands6":
      return (
        g.battlefield.filter(
          (id) => g.cards[id].controller === pid && isLand(g.cards[id]),
        ).length >= 6
      );
    case "lands5":
      return (
        g.battlefield.filter(
          (id) => g.cards[id].controller === pid && isLand(g.cards[id]),
        ).length >= 5
      );
    case "opponentNoGlimmer":
      return !g.battlefield.some(
        (id) =>
          g.cards[id].controller === other(pid) &&
          matches(g, { type: "Creature", sub: "Glimmer" }, g.cards[id], pid),
      );
    case "discardedNonland":
      return !!c.frontierMarks?.discardedNonland;
    case "threeNames":
      return (
        p.graveyard.filter((id) => g.cards[id].def.id === "say-its-name")
          .length >= 3
      );
    case "sacrificed":
      return (frontierFlags(g, pid).foundationSac ?? 0) > 0;
    case "primeLands": {
      const n = g.battlefield.filter(
        (id) => g.cards[id].controller === pid && isLand(g.cards[id]),
      ).length;
      return (
        (frontierFlags(g, pid).foundationLandEntered ?? 0) > 0 &&
        n >= 2 &&
        !Array.from(
          { length: Math.max(0, Math.floor(Math.sqrt(n)) - 1) },
          (_, i) => i + 2,
        ).some((d) => n % d === 0)
      );
    }
    default:
      throw Error("Unknown foundation condition " + action);
  }
}
export function foundationTrigger(
  g: GameState,
  c: Card,
  a: TriggeredAbility,
  ev: GameEvent,
) {
  const key = a.frontierEvent?.split(":")[1],
    pid = c.controller,
    ec = "card" in ev ? g.cards[ev.card] : undefined;
  switch (key) {
    case "attachedAttack":
      return ev.type === "attacks" && ev.card === c.attachedTo;
    case "nontokenDeathAny":
      return ev.type === "dies" && !g.cards[ev.card].token;
    case "door":
      return (
        ev.type === "frontier" &&
        ev.action === "doorUnlocked" &&
        ev.card === c.id &&
        ev.other === a.foundationDoor
      );
    case "eerie":
      return (
        (ev.type === "etb" &&
          ev.controller === pid &&
          !!ec?.def.types.includes("Enchantment")) ||
        (ev.type === "frontier" &&
          ev.action === "doorUnlocked" &&
          ev.player === pid &&
          ev.amount === 3)
      );
    case "firstLife":
    case "firstLifeOwn":
      return (
        ev.type === "lifegain" &&
        ev.player === pid &&
        (key === "firstLife" || g.active === pid) &&
        frontierFlags(g, pid).foundationLifeEvents === 1
      );
    case "selfPlus":
      return (
        ev.type === "counterPlaced" &&
        ev.card === c.id &&
        ev.counterKind === "+1/+1"
      );
    case "secondDraw":
      return (
        ev.type === "draw" &&
        ev.player === pid &&
        g.players[pid].drawsThisTurn === 2
      );
    case "opponentLifeLost":
      return ev.type === "lifeloss" && ev.player !== pid;
    case "selfLifeLost":
      return ev.type === "lifeloss" && ev.player === pid;
    case "opponentDraw":
      return ev.type === "draw" && ev.player !== pid;
    case "opponentDiscard":
    case "opponentDiscardSelf":
      return (
        ev.type === "discard" &&
        !ev.batchSummary &&
        ev.player !== pid &&
        !!ec &&
        (key !== "opponentDiscardSelf" || ec.id === c.id)
      );
    case "ownNoncombatOpp":
      return (
        ev.type === "noncombat" &&
        ev.sourceController === pid &&
        ev.player !== pid
      );
    case "ownCombatAny":
      return (
        ev.type === "combatDamageAny" &&
        ev.controller === pid &&
        g.active === pid
      );
    case "equippedUntap":
      return (
        ev.type === "frontier" &&
        ev.action === "untapped" &&
        ev.card === c.attachedTo
      );
    case "otherNonHydraPlus":
      return (
        ev.type === "counterPlaced" &&
        ev.card !== c.id &&
        ev.controller === pid &&
        ev.counterKind === "+1/+1" &&
        !!ec &&
        isCreature(ec) &&
        !matches(g, { sub: "Hydra" }, ec, pid)
      );
    case "noncreatureOrDragon":
      return (
        ev.type === "cast" &&
        ev.player === pid &&
        !!ec &&
        (!isCreature(ec) || matches(g, { sub: "Dragon" }, ec, pid))
      );
    case "oppWhiteBlueSpell":
      return (
        ev.type === "cast" &&
        ev.player !== pid &&
        !!ec &&
        (ec.castFace ?? ec.def).types.some(
          (t) => t === "Instant" || t === "Sorcery",
        ) &&
        colorsOf(ec.castFace ?? ec.def).some(
          (col) => col === "W" || col === "U",
        )
      );
    case "oppBlueBlack":
      return (
        ev.type === "cast" &&
        ev.player !== pid &&
        !!ec &&
        colorsOf(ec.castFace ?? ec.def).some(
          (col) => col === "U" || col === "B",
        )
      );
    case "deathtouchHit":
      return (
        ev.type === "combatDamage" &&
        g.cards[ev.source].controller === pid &&
        stats(g, g.cards[ev.source]).kw.has("deathtouch")
      );
    case "ownSpellSelfTarget":
      return (
        ev.type === "cast" &&
        ev.player === pid &&
        g.stack.some(
          (s) =>
            s.kind === "spell" &&
            s.cardId === ev.card &&
            s.targets.some((t) => t && "c" in t && t.c === c.id),
        )
      );
    case "castChosenColor":
      return (
        ev.type === "cast" &&
        ev.player === pid &&
        !!ec &&
        !!c.chosenColor &&
        colorsOf(ec.castFace ?? ec.def).includes(c.chosenColor)
      );
    case "damagedBySelfDies":
      return (
        ev.type === "dies" &&
        !!ec &&
        ec.frontierMarks?.["damagedBy" + c.id] === g.turn
      );
    case "eachCombat":
      return ev.type === "step" && ev.step === "combatStart";
    case "nonToyAttack":
      return (
        ev.type === "youAttack" &&
        ev.player === pid &&
        ev.attackers.some((id) => !matches(g, { sub: "Toy" }, g.cards[id], pid))
      );
    case "smallEtbBatch":
      return (
        ev.type === "etb" &&
        ev.controller === pid &&
        ev.card !== c.id &&
        !!ec &&
        isCreature(ec) &&
        stats(g, ec).p <= 2
      );
    case "manifestDread":
      return (
        ev.type === "frontier" &&
        ev.action === "manifestDread" &&
        ev.player === pid
      );
    case "ownGraveLeaves":
      return (
        ev.type === "fin" &&
        ev.action === "zoneMove" &&
        ev.from === "graveyard" &&
        ev.player === pid
      );
    case "creaturesDieBatch":
      if (ev.type !== "dies") return false;
      {
        const group = g.eclEventGroup;
        if (group !== undefined && c.frontierMarks?.chainsawBatch === group)
          return false;
        (c.frontierMarks ??= {}).chainsawBatch = group ?? g.nextSid++;
        return true;
      }
    case "ownSingleTargetCreature":
      if (
        ev.type !== "cast" ||
        ev.player !== pid ||
        !ec ||
        !(ec.castFace ?? ec.def).types.some(
          (t) => t === "Instant" || t === "Sorcery",
        )
      )
        return false;
      {
        const ts =
          g.stack
            .find((s) => s.kind === "spell" && s.cardId === ec.id)
            ?.targets.filter(Boolean) ?? [];
        return (
          ts.length > 0 &&
          ts.every(
            (t) =>
              t &&
              "c" in t &&
              "c" in ts[0]! &&
              t.c === (ts[0] as { c: number }).c &&
              g.cards[t.c].controller === pid &&
              isCreature(g.cards[t.c]),
          )
        );
      }
    case "ownBlocked":
      return (
        ev.type === "mkm" &&
        ev.action === "blocked" &&
        !!ec &&
        ec.controller === pid
      );
    case "ownFaceDownEtb":
      return ev.type === "etb" && ev.controller === pid && !!ec?.hidden;
    case "ownFaceUp":
      return ev.type === "turnedFaceUp" && g.cards[ev.card].controller === pid;
    case "otherFaceUp":
      return (
        ev.type === "turnedFaceUp" &&
        g.cards[ev.card].controller === pid &&
        ev.card !== c.id
      );
    case "landMilled":
      return (
        ev.type === "fin" &&
        ev.action === "zoneMove" &&
        ev.from === "library" &&
        ev.to === "graveyard" &&
        ev.player === pid &&
        !!ec &&
        isLand(ec)
      );
    case "selfSacrifice":
      return ev.type === "sacrifice" && ev.card === c.id;
    case "enchantedPlayerDamage":
      return (
        (ev.type === "noncombat" && ev.player === c.attachedToPlayer) ||
        (ev.type === "combatDamage" && ev.player === c.attachedToPlayer)
      );
    default:
      throw Error("Unknown foundation trigger " + a.frontierEvent);
  }
}
export function foundationObserve(g: GameState, ev: GameEvent) {
  if (ev.type === "step" && ev.step === "endStep")
    for (const id of g.battlefield) {
      const c = g.cards[id];
      if (
        c.controller === ev.player &&
        (c.impendingTime ?? 0) > 0 &&
        !abilitiesSuppressed(g, c)
      )
        g.pending.push({
          source: c.id,
          controller: c.controller,
          abilityIndex: -120,
          ev,
          ability: {
            kind: "trigger",
            on: "endStep",
            effects: [{ e: "frontier", action: "dsk:impendingTick" }],
          },
        });
    }

  if (ev.type === "etb" && isLand(g.cards[ev.card]))
    frontierFlags(g, ev.controller).foundationLandEntered = 1;
  if (ev.type === "lifegain") {
    const f = frontierFlags(g, ev.player);
    f.foundationLifeEvents = (f.foundationLifeEvents ?? 0) + 1;
  }
  if (ev.type === "sacrifice") {
    const f = frontierFlags(g, ev.player);
    f.foundationSac = (f.foundationSac ?? 0) + 1;
  }
  if (
    ev.type === "dies" &&
    !matches(g, { sub: "Zombie" }, g.cards[ev.card], ev.controller)
  )
    for (const p of g.players) frontierFlags(g, p.id).nonZombieDied = 1;
  if (ev.type === "etb" && g.cards[ev.card].hidden)
    frontierFlags(g, ev.controller).faceEvent = 1;
  if (ev.type === "turnedFaceUp")
    frontierFlags(g, g.cards[ev.card].controller).faceEvent = 1;
}
export function foundationBaseStats(
  g: GameState,
  c: Card,
  st: import("./state").Stats,
) {
  if (!abilitiesSuppressed(g, c)) {
    if (c.def.id === "crusader-of-odric")
      st.p = st.t = g.battlefield.filter(
        (id) =>
          g.cards[id].controller === c.controller && isCreature(g.cards[id]),
      ).length;
    if (c.def.id === "consuming-aberration")
      st.p = st.t = g.players[other(c.controller)].graveyard.length;
    if (c.def.id === "enigma-drake")
      st.p = g.players[c.controller].graveyard.filter((id) =>
        g.cards[id].def.types.some((t) => t === "Instant" || t === "Sorcery"),
      ).length;
  }
  if (
    c.zone === "battlefield" &&
    isCreature(c) &&
    frontierStatic(g, c.controller, "dsk:porcelainBase").length
  )
    st.p = st.t = g.battlefield.filter(
      (id) =>
        g.cards[id].controller === c.controller && isCreature(g.cards[id]),
    ).length;
}
export function foundationStats(
  g: GameState,
  c: Card,
  st: import("./state").Stats,
) {
  const pid = c.controller;
  if (c.frontierMarks?.orbHaste) st.kw.add("haste");
  if (!abilitiesSuppressed(g, c)) {
    switch (c.def.id) {
      case "skyknight-squire":
        if (c.counters >= 3) st.kw.add("flying");
        break;
      case "elenda-saint-of-dusk":
        if (g.players[pid].life > 20) {
          st.p++;
          st.t++;
          st.kw.add("menace");
        }
        if (g.players[pid].life >= 30) {
          st.p += 5;
          st.t += 5;
        }
        break;
      case "tempest-djinn":
        st.p += g.battlefield.filter(
          (id) =>
            g.cards[id].controller === pid &&
            matches(
              g,
              { type: "Land", basic: true, sub: "Island" },
              g.cards[id],
              pid,
            ),
        ).length;
        break;
      case "knight-of-grace":
      case "knight-of-malice":
        if (
          g.battlefield.some((id) =>
            colorsOf(g.cards[id].def).includes(
              c.def.id === "knight-of-grace" ? "B" : "W",
            ),
          )
        )
          st.p++;
        break;
      case "ghitu-lavarunner":
        if (
          g.players[pid].graveyard.filter((id) =>
            g.cards[id].def.types.some(
              (t) => t === "Instant" || t === "Sorcery",
            ),
          ).length >= 2
        ) {
          st.p++;
          st.kw.add("haste");
        }
        break;
      case "myojin-of-nights-reach":
        if (c.charge) st.kw.add("indestructible");
        break;
      case "kitesail-corsair":
        if (c.attacking) st.kw.add("flying");
        break;
      case "veteran-survivor":
        if (
          Object.values(g.cards).filter(
            (x) =>
              x.zone === "exile" &&
              x.frontierMarks?.survivorLink === (c.tmtLinkKey ?? c.id),
          ).length >= 3
        ) {
          st.p += 3;
          st.t += 3;
          st.kw.add("hexproof");
        }
        break;
      case "rampaging-soulrager":
        if (doorCount(g, pid) >= 2) st.p += 3;
        break;
      case "patchwork-beastie":
        if (graveTypes(g, pid) < 4) st.cantAttack = st.cantBlock = true;
        break;
      case "stalked-researcher":
        break;
    }
    if (
      abilitiesOf(g, c).some(
        (a) => a.kind === "static" && a.frontier?.endsWith(":cantBlock"),
      )
    )
      st.cantBlock = true;
  }
  if (!isCreature(c)) return;
  for (const banner of frontierStatic(g, pid, "fdn:bannerColor"))
    if (banner.chosenColor && colorsOf(c.def).includes(banner.chosenColor))
      st.p++;
  if (
    g.active === pid &&
    c.counters > 0 &&
    frontierStatic(g, pid, "fdn:counterFirstStrike").length
  )
    st.kw.add("first_strike");
  if (
    c.token &&
    frontierStatic(g, pid, "dsk:tobyFlying").some(
      () =>
        g.battlefield.filter(
          (id) =>
            g.cards[id].controller === pid &&
            g.cards[id].token &&
            isCreature(g.cards[id]),
        ).length >= 4,
    )
  )
    st.kw.add("flying");
  if (
    c.tapped &&
    frontierStatic(g, pid, "dsk:tappedOtherHexproof").some((s) => s.id !== c.id)
  )
    st.kw.add("hexproof");
  if (
    frontierStatic(g, pid, "dsk:otherPermanentHexproof").some(
      (s) => s.id !== c.id,
    )
  )
    st.kw.add("hexproof");
  for (const b of frontierStatic(g, pid, "fdn:bannerKinship"))
    if (b.eclType && matches(g, { sub: b.eclType }, c, pid)) {
      st.p += b.charge ?? 0;
      st.t += b.charge ?? 0;
    }
  for (const a of g.battlefield
    .map((id) => g.cards[id])
    .filter((a) => a.attachedTo === c.id))
    for (const ab of abilitiesOf(g, a))
      if (ab.kind === "static") {
        const key = ab.frontier;
        if (key === "fdn:blanchwood") {
          const n = g.battlefield.filter(
            (id) =>
              g.cards[id].controller === a.controller &&
              matches(g, { sub: "Forest" }, g.cards[id], pid),
          ).length;
          st.p += n;
          st.t += n;
        }
        if (key === "dsk:etherealArmor") {
          const n = g.battlefield.filter(
            (id) =>
              g.cards[id].controller === a.controller &&
              g.cards[id].def.types.includes("Enchantment"),
          ).length;
          st.p += n;
          st.t += n;
        }
        if (key === "fdn:katana" && g.active === a.controller) {
          st.p += 2;
          st.kw.add("first_strike");
        }
        if (key === "dsk:rescueHexproof" && a.enteredTurn === g.turn)
          st.kw.add("hexproof");
        if (key === "dsk:chainsaw") st.p += a.charge ?? 0;
      }
  if (
    g.players[pid].life >= 27 &&
    frontierStatic(g, pid, "dsk:hopeAnthem").length
  ) {
    const n = frontierStatic(g, pid, "dsk:hopeAnthem").length;
    st.p += 2 * n;
    st.t += 2 * n;
  }
  if (
    graveTypes(g, pid) >= 4 &&
    matches(g, { sub: ["Insect", "Spider"] }, c, pid)
  ) {
    const n = frontierStatic(g, pid, "dsk:deliriumInsects").length;
    st.p += n;
    st.t += n;
    if (n) st.kw.add("deathtouch");
  }
}
export function foundationGrantedAbilities(
  g: GameState,
  c: Card,
): ActivatedAbility[] {
  const out: ActivatedAbility[] = [];
  if (c.zone === "hand" && c.def.foundation?.ninjutsu)
    out.push({
      kind: "activated",
      fromHand: true,
      foundationNinjutsu: true,
      label: "忍術 " + c.def.foundation.ninjutsu,
      cost: { mana: c.def.foundation.ninjutsu },
      effects: [{ e: "frontier", action: "dsk:ninjutsuEnter" }],
    });
  if (c.def.room)
    for (const i of [0, 1] as const)
      if (!((c.roomUnlocked ?? 0) & (1 << i))) {
        const door = i === 0 ? c.def.room.left : c.def.room.right;
        out.push({
          kind: "activated",
          label: "解鎖 " + door.name + " " + door.cost,
          cost: { mana: door.cost },
          effects: [],
          sorcery: true,
          special: true,
          roomDoor: i,
        });
      }
  if (c.def.id === "marvin-murderous-mimic" && !abilitiesSuppressed(g, c))
    for (const id of g.battlefield) {
      const x = g.cards[id];
      if (
        x.controller === c.controller &&
        isCreature(x) &&
        x.def.name !== c.def.name
      )
        out.push(
          ...abilitiesOf(g, x).filter(
            (a): a is ActivatedAbility => a.kind === "activated",
          ),
        );
    }
  for (const id of g.battlefield) {
    const pole = g.cards[id];
    if (
      pole.attachedTo === c.id &&
      abilitiesOf(g, pole).some(
        (a) => a.kind === "static" && a.frontier === "fdn:fishingAbility",
      )
    )
      out.push({
        kind: "activated",
        label: "釣魚",
        cost: { mana: "{1}", tap: true },
        effects: [{ e: "frontier", action: "fdn:fishBait", n: pole.id }],
      });
  }
  return out;
}
export function foundationRefresh(g: GameState) {
  for (const c of g.battlefield.map((id) => g.cards[id])) {
    if (c.impendingPaid && c.impendingTime !== undefined) {
      c.impendingTime = c.eclCounters?.time ?? 0;
      if (c.impendingTime <= 0 && c.tlaOriginalDef) {
        c.def = c.tlaOriginalDef;
        c.tlaOriginalDef = undefined;
      } else if (c.impendingTime > 0 && c.def.types.includes("Creature")) {
        c.tlaOriginalDef ??= c.def;
        c.def = {
          ...c.def,
          types: c.def.types.filter((t) => t !== "Creature"),
        };
      }
    }
    const control = g.battlefield
      .map((id) => g.cards[id])
      .filter(
        (a) =>
          a.attachedTo === c.id &&
          abilitiesOf(g, a).some(
            (x) =>
              x.kind === "static" &&
              (x.frontier === "fdn:controlAura" ||
                x.frontier === "dsk:controlAura"),
          ),
      )
      .at(-1);
    if (control) {
      (c.frontierMarks ??= {}).foundationOriginalController ??= c.controller;
      if (c.controller !== control.controller) {
        c.controller = control.controller;
        c.sick = true;
      }
    } else if (c.frontierMarks?.foundationOriginalController !== undefined) {
      c.controller = c.frontierMarks.foundationOriginalController as PID;
      delete c.frontierMarks.foundationOriginalController;
      c.sick = true;
    }
    const aura = g.battlefield
      .map((id) => g.cards[id])
      .filter((a) => a.attachedTo === c.id)
      .reverse()
      .find((a) =>
        abilitiesOf(g, a).some(
          (x) =>
            x.kind === "static" &&
            [
              "fdn:moonAura",
              "fdn:witnessAura",
              "fdn:piranhaAura",
              "dsk:unableAura",
            ].includes(x.frontier ?? ""),
        ),
      );
    if (aura) {
      c.foundationAuraOriginal ??= c.def;
      const root = c.foundationAuraOriginal,
        key = abilitiesOf(g, aura).find(
          (x) =>
            x.kind === "static" &&
            [
              "fdn:moonAura",
              "fdn:witnessAura",
              "fdn:piranhaAura",
              "dsk:unableAura",
            ].includes(x.frontier ?? ""),
        );
      if (key?.kind === "static") {
        const k = key.frontier;
        c.def =
          k === "fdn:moonAura"
            ? {
                ...root,
                types: ["Land"],
                colors: [],
                subtypes: [],
                produces: ["C"],
                abilities: [],
              }
            : {
                ...root,
                types:
                  k === "dsk:unableAura"
                    ? [
                        ...new Set([
                          ...root.types,
                          "Artifact",
                          "Creature",
                        ] as const),
                      ]
                    : ["Creature"],
                subtypes:
                  k === "fdn:witnessAura"
                    ? ["Citizen"]
                    : k === "fdn:piranhaAura"
                      ? ["Skeleton"]
                      : ["Toy"],
                colors:
                  k === "fdn:witnessAura"
                    ? ["G", "W"]
                    : k === "fdn:piranhaAura"
                      ? ["B"]
                      : root.colors,
                power: k === "dsk:unableAura" ? 0 : 1,
                toughness: k === "dsk:unableAura" ? 2 : 1,
                ...(k === "fdn:witnessAura"
                  ? { name: "Legitimate Businessperson" }
                  : {}),
                abilities: [],
              };
      }
    } else if (c.foundationAuraOriginal) {
      c.def = c.foundationAuraOriginal;
      c.foundationAuraOriginal = undefined;
    }
    if (c.def.id === "kaito-bane-of-nightmares") {
      if (g.active === c.controller && (c.loyalty ?? 0) > 0) {
        c.tlaOriginalDef ??= c.def;
        c.def = {
          ...c.def,
          types: ["Planeswalker", "Creature"],
          subtypes: ["Ninja"],
          power: 3,
          toughness: 4,
          keywords: ["hexproof"],
        };
      } else if (c.tlaOriginalDef) {
        c.def = c.tlaOriginalDef;
        c.tlaOriginalDef = undefined;
      }
    }
  }
}
