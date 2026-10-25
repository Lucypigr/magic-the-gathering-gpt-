import {campusAmount,campusCondition,campusTrigger,campusObserve,campusBaseStats,campusStats,campusGrantedAbilities} from './campus-support';
import {meadowAmount,meadowCondition,meadowTrigger,meadowObserve,meadowBaseStats,meadowStats,meadowGrantedAbilities} from './meadow-support';
import {foundationAmount,foundationCondition,foundationTrigger,foundationObserve,foundationBaseStats,foundationStats,foundationGrantedAbilities} from './foundation-support';
import {
  otjAmount,
  otjCondition,
  otjTrigger,
  otjObserve,
  otjBaseStats,
  otjStats,
} from "./otj-support";
import {
  abilitiesOf,
  abilitiesSuppressed,
  isCreature,
  isLand,
  matches,
  stats,
  other,
} from "./state";
import { manaValue } from "./mana";
import type {
  Card,
  GameState,
  PID,
  Cond,
  GameEvent,
  TriggeredAbility,
} from "./types";
// Check for the requested static ability before scanning ability-loss effects.
// Most existing cards have no WOE/OTJ static abilities at all.
export function frontierStatic(g: GameState, pid: PID, key: string) {
  const has = (list: import("./types").Ability[] | undefined) =>
    list?.some((a) => a.kind === "static" && a.frontier === key);
  return g.battlefield
    .map((id) => g.cards[id])
    .filter(
      (c) =>
        c.controller === pid &&
        (has(c.def.abilities) ||
          has(c.copiedAbilities) ||
          (c.temporaryAbilities?.turn === g.turn &&
            has(c.temporaryAbilities.abilities))) &&
        !abilitiesSuppressed(g, c),
    );
}
export function frontierFlags(g: GameState, pid: PID) {
  const p = g.players[pid];
  if (p.frontierTurn !== g.turn) {
    p.frontierTurn = g.turn;
    p.frontierFlags = {};
  }
  return (p.frontierFlags ??= {});
}
export const enchanted = (g: GameState, c: Card, pid?: PID) =>
  g.battlefield.some((id) => {
    const a = g.cards[id];
    return (
      a.attachedTo === c.id &&
      a.def.subtypes?.includes("Aura") &&
      (pid === undefined || a.controller === pid)
    );
  });
export function frontierAmount(
  g: GameState,
  pid: PID,
  source: number,
  key: string,
  x = 0,
  ev?: GameEvent,
) {
  if(/^(lci|sos):/.test(key))return campusAmount(g,pid,source,key,x,ev);
  if(/^(blb|dft):/.test(key))return meadowAmount(g,pid,source,key,ev);
  if(/^(fdn|dsk):/.test(key))return foundationAmount(g,pid,source,key,ev);
  const p = g.players[pid],
    s = g.cards[source];
  switch (key) {
    case "foodFightDamage":
      return 1 + frontierStatic(g, pid, "foodFight").length;
    case "lastPower":
      return s?.zone === "battlefield" ? stats(g, s).p : (s?.lastPower ?? 0);
    case "damageTaken":
      return s?.frontierTakenTurn === g.turn ? (s.frontierTaken ?? 0) : 0;
    case "graveSpellsPlus2":
      return (
        2 +
        p.graveyard.filter((id) =>
          matches(g, { frontierSpellOrAdventure: true }, g.cards[id], pid),
        ).length
      );
    case "twiceX":
      return 2 * x;
    case "halfXUp":
      return Math.ceil((s?.castX ?? x) / 2);
    case "foodsPlus1":
      return (
        1 +
        g.battlefield.filter(
          (id) =>
            g.cards[id].controller === pid &&
            matches(g, { sub: "Food" }, g.cards[id], pid),
        ).length
      );
    default:
      return otjAmount(g, pid, source, key, ev);
  }
}
export function frontierCondition(
  g: GameState,
  c: Extract<Cond, { c: "frontier" }>,
  pid: PID,
  source: number,
  ev?:GameEvent,
) {
  if(/^(lci|sos):/.test(c.action))return campusCondition(g,c.action,pid,source,ev);
  if(/^(blb|dft):/.test(c.action))return meadowCondition(g,c.action,pid,source,ev);
  if(/^(fdn|dsk):/.test(c.action))return foundationCondition(g,c.action,pid,source);
  switch (c.action) {
    case "exiledThisTurn":
      return !!frontierFlags(g, pid).exiled;
    case "bargained":
      return !!g.cards[source]?.frontierBargained;
    case "oppMoreLands":
      return (
        g.battlefield.filter(
          (id) => isLand(g.cards[id]) && g.cards[id].controller === other(pid),
        ).length >
        g.battlefield.filter(
          (id) => isLand(g.cards[id]) && g.cards[id].controller === pid,
        ).length
      );
    case "enchantedOwn":
      return g.battlefield.some(
        (id) =>
          g.cards[id].controller === pid &&
          isCreature(g.cards[id]) &&
          enchanted(g, g.cards[id]),
      );
    case "adventureExiled":
      return g.players[pid].exile.some((id) => g.cards[id].def.adventure);
    default:
      return otjCondition(g, c.action, pid, source);
  }
}
export function frontierTrigger(
  g: GameState,
  c: Card,
  a: TriggeredAbility,
  ev: GameEvent,
) {
  if(/^(lci|sos):/.test(a.frontierEvent??''))return campusTrigger(g,c,a,ev);
  if(/^(blb|dft):/.test(a.frontierEvent??''))return meadowTrigger(g,c,a,ev);
  if(/^(fdn|dsk):/.test(a.frontierEvent??''))return foundationTrigger(g,c,a,ev);
  const pid = c.controller,
    ec = "card" in ev ? g.cards[ev.card] : undefined;
  const move = ev.type === "fin" && ev.action === "zoneMove";
  switch (a.frontierEvent) {
    case "attachedAttack":
      return (
        ev.type === "attacks" &&
        ev.card === c.attachedTo &&
        (c.def.id !== "tok-young-hero-role" || (!!ec && stats(g, ec).t <= 3))
      );
    case "selfToGrave":
      return (
        move &&
        ev.card === c.id &&
        ev.from === "battlefield" &&
        ev.to === "graveyard"
      );
    case "enchantGy":
    case "otherArtifactGy":
      return (
        move &&
        ev.from === "battlefield" &&
        ev.to === "graveyard" &&
        !!ec &&
        (ec.frontierMarks?.lastController ?? ev.player) === pid &&
        (a.frontierEvent === "enchantGy"
          ? ec.def.types.includes("Enchantment")
          : ec.id !== c.id && ec.def.types.includes("Artifact"))
      );
    case "enchantEtbFromGrave":
      return (
        ev.type === "etb" &&
        ev.controller === pid &&
        !!ec?.def.types.includes("Enchantment")
      );
    case "tapOpp":
      return (
        ev.type === "tapped" &&
        ev.controller !== pid &&
        !!ec &&
        isCreature(ec) &&
        ec.frontierMarks?.tappedBy === pid
      );
    case "firstInstSorc":
      return (
        ev.type === "cast" &&
        ev.player === pid &&
        !!(ec?.castFace ?? ec?.def)?.types.some(
          (t) => t === "Instant" || t === "Sorcery",
        ) &&
        g.players[pid].instSorcThisTurn === 1
      );
    case "adventureCast":
      return (
        ev.type === "cast" &&
        ev.player === pid &&
        g.stack.some(
          (s) =>
            s.kind === "spell" && s.cardId === ev.card && s.alt === "adventure",
        )
      );
    case "creatureFromExile":
      return (
        ev.type === "etb" &&
        !!ec &&
        !ec.token &&
        isCreature(ec) &&
        (ec.frontierMarks?.enteredFromExile === g.turn ||
          ec.castOrigin === "exile")
      );
    case "faerieAttack":
      return (
        ev.type === "youAttack" &&
        ev.player === pid &&
        ev.attackers.some((id) =>
          matches(g, { sub: "Faerie" }, g.cards[id], pid),
        )
      );
    case "drawStep":
      return ev.type === "step" && ev.step === "draw" && ev.player === pid;
    case "imodaneHit":
      return (
        ev.type === "frontier" &&
        ev.action === "imodaneHit" &&
        ev.player === pid
      );
    case "slingerBlock":
      return (
        ev.type === "frontier" &&
        ev.action === "slingerBlock" &&
        ev.card === c.id
      );
    case "ratBlocked":
      return (
        ev.type === "frontier" &&
        ev.action === "ratBlocked" &&
        ec?.controller === pid
      );
    case "noncombatOpp":
      return (
        ev.type === "noncombat" &&
        ev.player !== pid &&
        ev.sourceController === pid
      );
    case "talionSpell":
      return (
        ev.type === "cast" &&
        ev.player !== pid &&
        !!ec &&
        [manaValue(ec.def), ec.def.power, ec.def.toughness].includes(
          c.frontierMarks?.talion ?? -1,
        )
      );
    case "nontokenOwnDies":
      return (
        ev.type === "dies" &&
        ev.controller === pid &&
        !!ec &&
        !ec.token &&
        isCreature(ec)
      );
    case "oppSmallSpell":
      return (
        ev.type === "cast" &&
        ev.player !== pid &&
        !!ec &&
        manaValue(ec.def) <= 3
      );
    default:
      return otjTrigger(g, c, a, ev);
  }
}
export function frontierObserve(g: GameState, ev: GameEvent) {
  otjObserve(g, ev);
  foundationObserve(g,ev);
  meadowObserve(g,ev);
  campusObserve(g,ev);
  if (ev.type === "step" && ev.step === "endStep")
    for (const c of Object.values(g.cards))
      if (
        c.playableBy === ev.player &&
        c.frontierMarks?.seekEnd !== undefined &&
        c.frontierMarks.seekEnd <= g.turn
      ) {
        c.playableUntil = g.turn - 1;
        delete c.frontierMarks.seekEnd;
      }
  if (ev.type === "youAttack")
    frontierFlags(g, ev.player).attackers =
      (frontierFlags(g, ev.player).attackers ?? 0) + ev.attackers.length;
  if (ev.type === "fin" && ev.action === "zoneMove" && ev.card !== undefined) {
    const c = g.cards[ev.card];
    if (ev.to === "exile")
      for (const p of g.players) frontierFlags(g, p.id).exiled = 1;
    if (ev.from === "battlefield" && ev.to === "graveyard" && isCreature(c)) {
      const pid = (c.frontierMarks?.lastController ?? ev.player) as PID;
      frontierFlags(g, pid).deaths = (frontierFlags(g, pid).deaths ?? 0) + 1;
    }
  }
  if (ev.type === "damaged") {
    const c = g.cards[ev.card];
    if (c.frontierTakenTurn !== g.turn) {
      c.frontierTakenTurn = g.turn;
      c.frontierTaken = 0;
    }
    c.frontierTaken = (c.frontierTaken ?? 0) + ev.amount;
  }
  if (ev.type === "cast") {
    const c = g.cards[ev.card];
    if (c.castOrigin === "library") frontierFlags(g, ev.player).johannTop = 1;
  }
}
export function frontierBaseStats(
  g: GameState,
  c: Card,
  st: import("./state").Stats,
) {
  otjBaseStats(g, c, st);
  foundationBaseStats(g,c,st);
  meadowBaseStats(g,c,st);
  campusBaseStats(g,c,st);
  if (!abilitiesSuppressed(g, c)) {
    if (c.def.id === "regal-bunnicorn")
      st.p = st.t = g.battlefield.filter(
        (id) => g.cards[id].controller === c.controller && !isLand(g.cards[id]),
      ).length;
    if (c.def.id === "cruel-somnophage")
      st.p = st.t = g.players
        .flatMap((p) => p.graveyard)
        .filter((id) => isCreature(g.cards[id])).length;
    if (
      c.def.id === "goddric-cloaked-reveler" &&
      (g.players[c.controller].nonlandEtbThisTurn ?? 0) >= 2
    )
      st.p = st.t = 4;
  }
  if (c.zone !== "battlefield") return;
  if (
    frontierStatic(g, c.controller, "roseBase").some((s) => s.id !== c.id) &&
    isCreature(c) &&
    enchanted(g, c, c.controller)
  )
    st.p = st.t = 4;
  if (
    g.battlefield.some(
      (id) =>
        g.cards[id].attachedTo === c.id &&
        g.cards[id].def.id === "tok-cursed-role" &&
        !abilitiesSuppressed(g, g.cards[id]),
    )
  )
    st.p = st.t = 1;
}
export function frontierStats(
  g: GameState,
  c: Card,
  st: import("./state").Stats,
) {
  otjStats(g, c, st);
  foundationStats(g,c,st);
  meadowStats(g,c,st);
  campusStats(g,c,st);
  if (
    isCreature(c) &&
    frontierStatic(g, c.controller, "roseBase").some((s) => s.id !== c.id) &&
    enchanted(g, c, c.controller)
  )
    st.kw.add("flying");
  if (!abilitiesSuppressed(g, c)) {
    if (
      c.def.id === "goddric-cloaked-reveler" &&
      (g.players[c.controller].nonlandEtbThisTurn ?? 0) >= 2
    )
      st.kw.add("flying");
    if (
      c.def.id === "restless-spire" &&
      isCreature(c) &&
      g.active === c.controller
    )
      st.kw.add("first_strike");
    if (
      c.def.id === "tok-woe-rat" ||
      c.def.id === "tangled-colony" ||
      abilitiesOf(g, c).some(
        (a) => a.kind === "static" && a.frontier === "cantBlock",
      )
    )
      st.cantBlock = true;
  }
  for (const s of frontierStatic(g, c.controller, "kellanAnthem"))
    if (c.id !== s.id && isCreature(c))
      st.p += g.battlefield.filter(
        (id) =>
          g.cards[id].attachedTo === s.id &&
          g.cards[id].def.subtypes?.some(
            (t) => t === "Aura" || t === "Equipment",
          ),
      ).length;
}
export function frontierCanBlock(g: GameState, b: Card, a: Card) {
  if (
    frontierStatic(g, a.controller, "coyoteProtection").some(
      (s) => s.id === a.id,
    ) &&
    matches(g, { sub: "Coyote" }, b, b.controller)
  )
    return false;
  const st = stats(g, a),
    bs = stats(g, b);
  if (
    !abilitiesSuppressed(g, a) &&
    ((a.def.id === "ingenious-prodigy" && bs.p > st.p) ||
      (a.def.id === "elusive-otter" && bs.p < st.p))
  )
    return false;
  if (b.def.id === "tok-woe-fae-court" && !st.kw.has("flying")) return false;
  const m = a.frontierMarks;
  if (m?.smallBlockTurn === g.turn && bs.p >= (m.smallBlock ?? 3)) return false;
  if (m?.largeBlockTurn === g.turn && bs.p <= (m.largeBlock ?? 2)) return false;
  if (m?.hasteBlockTurn === g.turn && !bs.kw.has("haste")) return false;
  return true;
}
export function frontierAbilityCost(
  g: GameState,
  c: Card,
  ab: import("./types").ActivatedAbility,
  cost: import("./mana").ManaCost,
) {
  if(ab.campusPageDiscount)cost.generic=Math.max(0,cost.generic-(c.eclCounters?.page??0));
  if(ab.bdExhaust)cost.generic=Math.max(0,cost.generic-2*frontierStatic(g,c.controller,'dft:exhaustDiscount').filter(s=>s.id!==c.id).length);
  cost.generic+=2*[...frontierStatic(g,0,'dft:namedAbilityTax'),...frontierStatic(g,1,'dft:namedAbilityTax')].filter(s=>s.foundationNamed===c.def.name||s.eclType===c.def.name).length;
  if (isCreature(c) && frontierStatic(g, c.controller, "cauldronMana").length) {
    cost.generic +=
      cost.W +
      cost.U +
      cost.B +
      cost.R +
      cost.G +
      cost.C +
      (cost.hyb?.length ?? 0);
    cost.W = cost.U = cost.B = cost.R = cost.G = cost.C = 0;
    cost.hyb = [];
  }
  if (ab.frontierOwnTurnDiscount && g.active === c.controller)
    cost.generic = Math.max(0, cost.generic - ab.frontierOwnTurnDiscount);
  if (isLand(c))
    cost.generic = Math.max(
      0,
      cost.generic -
        frontierStatic(g, c.controller, "landAbilityDiscount").length,
    );
  if (isCreature(c) && ab.cost.mana) {
    for (const source of frontierStatic(g, c.controller, "agathaDiscount"))
      cost.generic = Math.max(
        cost.W +
          cost.U +
          cost.B +
          cost.R +
          cost.G +
          cost.C +
          (cost.hyb?.length ?? 0) >
          0
          ? 0
          : 1,
        cost.generic - Math.max(0, stats(g, source).p),
      );
  }
}
export function frontierGrantedAbilities(
  g: GameState,
  c: Card,
): import("./types").ActivatedAbility[] {
  const out: import("./types").ActivatedAbility[] = [...foundationGrantedAbilities(g,c),...meadowGrantedAbilities(g,c),...campusGrantedAbilities(g,c)];
  if (
    c.def.types.includes("Artifact") &&
    frontierStatic(g, c.controller, "foodFight").length
  )
    out.push({
      kind: "activated",
      cost: { mana: "{2}", sacSelf: true },
      effects: [{ e: "damage", to: "T0", n: { frontier: "foodFightDamage" } }],
      targets: [{ kind: "any" }],
      label: "Food Fight：犧牲造成傷害",
    });
  if (
    c.def.id === "goddric-cloaked-reveler" &&
    (g.players[c.controller].nonlandEtbThisTurn ?? 0) >= 2
  )
    out.push({
      kind: "activated",
      cost: { mana: "{R}" },
      effects: [
        {
          e: "pump",
          what: { all: { ctrl: "you", sub: "Dragon" } },
          p: 1,
          t: 0,
        },
      ],
      label: "龍+1/+0",
    });
  if (isCreature(c) && c.counters > 0)
    for (const source of frontierStatic(g, c.controller, "cauldronAbilities"))
      for (const p of g.players)
        for (const id of p.exile) {
          const x = g.cards[id];
          if (
            x.frontierMarks?.cauldronLink ===
              (source.tmtLinkKey ?? source.id) &&
            isCreature(x)
          )
            out.push(
              ...(x.def.abilities ?? []).filter(
                (a): a is import("./types").ActivatedAbility =>
                  a.kind === "activated",
              ),
            );
        }
  return out;
}
