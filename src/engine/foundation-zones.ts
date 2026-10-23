import { frontierStatic, frontierFlags } from "./frontier-support";
import { abilitiesSuppressed, isCreature, other } from "./state";
import type { Card, GameState, PID, TargetRef } from "./types";
export function foundationGraveReplacement(g: GameState, c: Card) {
  if (!c.token) {
    if (
      frontierStatic(g, other(c.owner), "dsk:opponentGraveExile").length ||
      frontierFlags(g, c.owner).graveAll
    )
      return { to: "exile" as const };
    const eater = frontierStatic(g, other(c.owner), "dsk:valgavothExile").find(
      (s) => c.controller !== s.controller,
    );
    if (eater)
      return { to: "exile" as const, link: eater.tmtLinkKey ?? eater.id };
  }
  if (
    c.def.types.some((t) => t === "Instant" || t === "Sorcery") &&
    (frontierStatic(g, 0, "fdn:exileSpellsGrave").length ||
      frontierStatic(g, 1, "fdn:exileSpellsGrave").length)
  )
    return { to: "exile" as const };
  if (
    ["progenitus", "darksteel-colossus"].includes(c.def.id) &&
    (c.zone !== "battlefield" || !abilitiesSuppressed(g, c))
  )
    return { to: "library" as const };
  return undefined;
}
export function foundationDamage(
  g: GameState,
  src: Card | null,
  pid: PID,
  target: TargetRef,
  n: number,
  combat: boolean,
): { n: number; mill?: number } {
  if (
    combat &&
    src &&
    frontierStatic(g, src.controller, "fdn:preventCombatBoth").some(
      (c) => c.id === src.id,
    )
  )
    return { n: 0 };
  const victim = "p" in target ? target.p : g.cards[target.c]?.controller;
  if (victim !== undefined && victim !== pid)
    n *= 2 ** frontierStatic(g, pid, "fdn:doubleDamage").length;
  if (src && isCreature(src))
    n *= 2 ** frontierStatic(g, pid, "fdn:doubleCreatureDamage").length;
  if (
    !combat &&
    new Set(g.players[pid].graveyard.flatMap((id) => g.cards[id].def.types))
      .size >= 4
  )
    n *= 2 ** frontierStatic(g, pid, "dsk:deliriumDoubleDamage").length;
  if (
    "p" in target &&
    target.p !== pid &&
    frontierStatic(g, pid, "dsk:mindskinner").length
  )
    return { n: 0, mill: n };
  if ("c" in target) {
    const c = g.cards[target.c];
    if (c) {
      if (
        frontierStatic(g, c.controller, "fdn:protectionEverything").some(
          (x) => x.id === c.id,
        )
      )
        return { n: 0 };
      if (
        combat &&
        (frontierStatic(g, c.controller, "fdn:preventCombatBoth").some(
          (x) => x.id === c.id,
        ) ||
          (src &&
            frontierStatic(g, src.controller, "fdn:preventCombatBoth").some(
              (x) => x.id === src.id,
            )) ||
          c.frontierMarks?.combatFog === g.turn)
      )
        return { n: 0 };
      if (
        !combat &&
        isCreature(c) &&
        frontierStatic(g, c.controller, "fdn:preventOtherNoncombat").some(
          (x) => x.id !== c.id,
        )
      )
        return { n: 0 };
    }
  }
  return { n };
}
