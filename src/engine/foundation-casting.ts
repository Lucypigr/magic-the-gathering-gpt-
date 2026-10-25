import {meadowExtraCosts,validForage,payForage,festivalCast} from './meadow-costs';
import { frontierStatic, frontierFlags } from "./frontier-support";
import { isCreature, isLand, stats } from "./state";
import { moveCard, tapCard, sacrifice,loseLife } from "./zones";
import type { Card, CastAlt, GameState, PID, PriorityAction } from "./types";
export function foundationPermission(g: GameState, pid: PID, c: Card): boolean {
  const f = frontierFlags(g, pid),
    own = c.owner === pid;
  if (
    c.zone === "library" &&
    own &&
    isCreature(c) &&
    g.players[pid].library[0] === c.id &&
    frontierStatic(g, pid, "fdn:vizierCast").length
  )
    return true;
  if (c.zone === "exile")
    return (
      !!(
        g.active === pid &&
        c.owner !== pid &&
        c.frontierMarks?.stash &&
        frontierStatic(g, pid, "fdn:stashPlay").length
      ) ||
      (frontierStatic(g, pid, "dsk:valgavothPlay").some(
        (s) => c.frontierMarks?.valgavothLink === s.tmtLinkKey,
      ) &&
        g.active === pid)
    );
  if (c.zone !== "graveyard" || !own) return false;
  if (c.frontierMarks?.zombieCast === g.turn) return true;
  if (f.graveAll) return true;
  if (c.def.id === "undead-sprinter" && f.nonZombieDied) return true;
  if (
    c.def.id === "quilled-greatwurm" &&
    g.battlefield
      .filter((id) => g.cards[id].controller === pid && isCreature(g.cards[id]))
      .reduce((n, id) => n + Math.max(0, g.cards[id].counters), 0) >= 6
  )
    return true;
  if (g.active !== pid) return false;
  if (isLand(c) && frontierStatic(g, pid, "dsk:graveLands").length) return true;
  return (
    !!frontierStatic(g, pid, "fdn:muldrotha").length &&
    c.def.types.some(
      (t) => !["Instant", "Sorcery"].includes(t) && !f["muldrotha" + t],
    )
  );
}
export function foundationExtraCosts(g: GameState, pid: PID, c: Card, alt?:CastAlt) {
  const meadow=meadowExtraCosts(g,pid,c,alt);if(meadow)return meadow;
  const f = c.def.foundation,
    p = g.players[pid],
    battle = g.battlefield.filter((id) => g.cards[id].controller === pid);
  return f?.exileCreatureCost
    ? {
        kind: "exile" as const,
        n: 1,
        ids: battle.filter((id) => isCreature(g.cards[id])),
      }
    : f?.returnPermanentCost
      ? { kind: "bounce" as const, n: 1, ids: battle }
      : f?.exileGraveCost
        ? {
            kind: "exile" as const,
            n: f.exileGraveCost,
            ids: p.graveyard.filter((id) => id !== c.id),
          }
        : f?.tapCastCost
          ? {
              kind: "tap" as const,
              n: f.tapCastCost,
              ids: battle.filter(
                (id) =>
                  !g.cards[id].tapped &&
                  (isCreature(g.cards[id]) || isLand(g.cards[id])),
              ),
            }
          : f?.revealCreaturePower
            ? {
                kind: "reveal" as const,
                n: 1,
                ids: [...battle, ...p.hand].filter((id) =>
                  isCreature(g.cards[id]),
                ),
              }
            : undefined;
}
export function foundationCastError(
  g: GameState,
  pid: PID,
  c: Card,
  a: Extract<PriorityAction, { type: "cast" }>,
): string | null {
  const cost = foundationExtraCosts(g, pid, c,a.alt);
  if(festivalCast(g,pid,c)&&g.players[pid].life<1)return '生命不足';
  if (!cost) return null;
  const ids = a.foundationCosts ?? ('defaults'in cost?cost.defaults:cost.ids.slice(0,cost.n));
  if(cost.kind==='forage')return validForage(g,pid,ids,c.id)?null:'請犧牲一個食物或放逐三張墳墓場牌';
  if(cost.kind==='sacAny')return new Set(ids).size===ids.length&&ids.every(id=>cost.ids.includes(id))?null:'犧牲費用不合法';
  return ids.length !== cost.n ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !cost.ids.includes(id))
    ? "請選擇合法的額外費用"
    : null;
}
export function foundationPayExtras(
  g: GameState,
  pid: PID,
  c: Card,
  a: Extract<PriorityAction, { type: "cast" }>,
) {
  const cost = foundationExtraCosts(g, pid, c,a.alt);
  if(festivalCast(g,pid,c))loseLife(g,pid,1);
  if(cost?.kind==='forage'){payForage(g,pid,a.foundationCosts??cost.defaults);if(c.zone==='graveyard')(c.finMarks??={}).enterFinality=1;}
  if(cost?.kind==='sacAny')for(const id of a.foundationCosts??[])sacrifice(g,g.cards[id]);
  if (cost&&cost.kind!=='forage'&&cost.kind!=='sacAny')
    for (const id of a.foundationCosts ?? cost.ids.slice(0, cost.n)) {
      const x = g.cards[id];
      if (cost.kind === "exile") {
        if (c.def.foundation?.exileCreatureCost)
          (x.frontierMarks ??= {}).abductionLink = (c.frontierMarks ??=
            {}).abductionKey ??= g.nextSid++;
        moveCard(g, x, "exile");
      }
      if (cost.kind === "bounce") moveCard(g, x, "hand");
      if (cost.kind === "tap") tapCard(g, x);
      if (cost.kind === "reveal") {
        (c.frontierMarks ??= {}).chosenPower = stats(g, x).p;
        (c.frontierMarks ??= {}).chosenCreature =
          x.zone === "battlefield" ? x.id : -1;
      }
    }
  if (c.zone === "graveyard") {
    const f = frontierFlags(g, pid);
    if (c.def.id === "quilled-greatwurm") {
      let left = 6;
      for (const id of g.battlefield) {
        const x = g.cards[id];
        if (x.controller !== pid || !isCreature(x)) continue;
        const n = Math.min(left, Math.max(0, x.counters));
        x.counters -= n;
        left -= n;
      }
    }
    if (c.def.id === "undead-sprinter") (c.finMarks ??= {}).enterCounters = 1;
    if (frontierStatic(g, pid, "fdn:muldrotha").length && !f.graveAll) {
      const t = c.def.types.find(
        (t) => !["Instant", "Sorcery"].includes(t) && !f["muldrotha" + t],
      );
      if (t) f["muldrotha" + t] = 1;
    }
    if (f.graveAll) (c.frontierMarks ??= {}).graveExileTurn = g.turn;
  }
}
