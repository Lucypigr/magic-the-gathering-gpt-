import { validateTargets, sameTarget } from "./targets";
import { plotCard } from "./otj-support";
import {
  canPayCost,
  payCost,
  frontierCanPayLife,
  frontierPayLife,
} from "./actions";
import {
  copiableDefinition,
  isCreature,
  isLand,
  matches,
  newCard,
  other,
  randInt,
  shuffleArr,
  stats,
} from "./state";
import { manaValue, parseCost } from "./mana";
import { resolveRef, runEffects, type Ctx } from "./effects";
import { choose, freeCast } from "./tla";
import { makeEclTokenBatch } from "./ecl";
import { mshEffect } from "./msh";
import { woeEffect } from "./woe";
import { frontierFlags } from "./frontier-support";
import {
  dealDamage,
  discardMany,
  drawCards,
  emit,
  enterBattlefield,
  loseLife,
  moveCard,
  putCounters,
  sacrifice,
  tapCard,
  destroyCards,
} from "./zones";
import type {
  Card,
  CardDef,
  Effect,
  GameState,
  PID,
  Response,
  SubFlow,
} from "./types";
function* yes(pid: PID, prompt: string): SubFlow<boolean> {
  const r: Response = yield { type: "yesno", player: pid, prompt };
  return r.type === "yesno" && r.yes;
}
function* mode(pid: PID, prompt: string, options: string[]): SubFlow<number> {
  const r: Response = yield {
    type: "mode",
    player: pid,
    prompt,
    options,
    count: 1,
    purpose: "trigger",
  };
  return r.type === "modes" ? (r.picks[0] ?? 0) : 0;
}
const E = (action: string, n?: number): Effect => ({
  e: "frontier",
  action: "otj:" + action,
  n,
});
export function* otjEffect(
  g: GameState,
  original: Ctx,
  ef: Extract<Effect, { e: "frontier" }>,
): SubFlow {
  const offset =
    typeof ef.what === "string" && /^T\d+$/.test(ef.what)
      ? Number(ef.what.slice(1))
      : 0;
  const ctx = { ...original, targets: original.targets.slice(offset) },
    pid = ctx.controller,
    opp = other(pid),
    p = g.players[pid],
    src = g.cards[ctx.source],
    c = resolveRef(g, ctx, "T0").cards[0],
    action = ef.action.slice(4),
    ev = ctx.ev;
  const own = (filter: import("./types").Filter = {}) =>
    g.battlefield.filter(
      (id) =>
        g.cards[id].controller === pid &&
        matches(g, filter, g.cards[id], pid, src.id),
    );
  const pick = (ids: number[], prompt: string, min = 0, max = 1, who = pid) =>
    choose(g, who, prompt, ids, min, max);
  const run = (effects: Effect[]) => runEffects(g, ctx, effects);
  const token = (
    id: string,
    n = 1,
    opts: Parameters<typeof makeEclTokenBatch>[4] = {},
  ) => makeEclTokenBatch(g, pid, id, n, opts);
  const targetPlayer = () => {
    const t = ctx.targets[0];
    return t && "p" in t ? t.p : opp;
  };
  const impulse = function* (
    who: PID,
    n: number,
    until = g.turn,
    any = false,
    spellsOnly = false,
  ): SubFlow<Card[]> {
    const out: Card[] = [];
    for (const id of g.players[who].library.slice(0, n)) {
      const x = g.cards[id];
      moveCard(g, x, "exile");
      x.playableBy = pid;
      x.playableUntil = until;
      if (any) x.finMarks = { ...x.finMarks, anyMana: 1 };
      if (spellsOnly) (x.frontierMarks ??= {}).spellsOnly = 1;
      out.push(x);
    }
    return out;
  };
  const plot = (x: Card) => plotCard(g, x);
  const transient = (x: Card, patch: Partial<CardDef>) => {
    x.baseDef ??= x.def;
    x.def = { ...x.def, ...patch };
  };
  const immediate = function* (
    x: Card,
    free = false,
    any = false,
  ): SubFlow<boolean> {
    const before = x.finMarks,
      by = x.playableBy,
      until = x.playableUntil;
    x.playableBy = pid;
    x.playableUntil = g.turn;
    if (any) x.finMarks = { ...x.finMarks, anyMana: 1 };
    const alt =
      x.def.adventure &&
      (yield* mode(pid, "選擇施放面", [x.def.name, x.def.adventure.name])) === 1
        ? "adventure"
        : undefined;
    const result = yield* freeCast(g, ctx, x, free, alt);
    if (!result) {
      x.finMarks = before;
      x.playableBy = by;
      x.playableUntil = until;
    }
    return result;
  };
  switch (action) {
    case "swiftSpiral":
    case "copyToken":
    case "steal":
    case "hasteBlockers":
      yield* woeEffect(g, ctx, { ...ef, action: "woe:" + action, what: "T0" });
      break;
    case "1": {
      for (let round = 0; round <= (ctx.x ?? 0); round++) {
        const ids = yield* pick(
          own({ type: "Creature" }),
          "選擇任意數量己方生物閃爍",
          0,
          own({ type: "Creature" }).length,
        );
        const previous = g.frontierEntryBatch;
        g.frontierEntryBatch = g.nextSid++;
        for (const id of ids) moveCard(g, g.cards[id], "exile");
        for (const id of ids)
          enterBattlefield(g, g.cards[id], g.cards[id].owner);
        g.frontierEntryBatch = previous;
      }
      break;
    }
    case "4":
      if (c) {
        const item = g.stack.find(
          (s) => s.kind === "spell" && s.cardId === c.id,
        );
        if (item) plot(c);
      }
      break;
    case "6":
      if (c) {
        const controller = c.controller;
        destroyCards(g, [c]);
        yield* makeEclTokenBatch(g, controller, "tok-otj-ox", 1);
      }
      break;
    case "8":
      for (let i = 0; i < 2; i++) {
        const mine = own({ type: "Land" }).length,
          them = g.battlefield.filter(
            (id) => g.cards[id].controller === opp && isLand(g.cards[id]),
          ).length;
        if (them <= mine) break;
        const ids = p.library.filter((id) =>
            matches(g, { type: "Land", sub: "Plains" }, g.cards[id], pid),
          ),
          id = (yield* pick(ids, "可搜一張Plains", 0))[0];
        if (id !== undefined) enterBattlefield(g, g.cards[id], pid, true);
      }
      shuffleArr(g, p.library);
      break;
    case "chooseIndestructible": {
      const id = (yield* pick(
        own({ type: "Creature" }),
        "選擇己方生物",
        Math.min(1, own({ type: "Creature" }).length),
      ))[0];
      if (id !== undefined)
        yield* run([
          {
            e: "pump",
            what: { all: { ids: [id] } },
            p: 0,
            t: 0,
            kw: ["indestructible"],
          },
        ]);
      break;
    }
    case "12":
      (g.delayed ??= []).push({
        source: src.id,
        controller: pid,
        on: "frontierEvent",
        frontierEvent: "combatEnd",
        once: true,
        effects: [E("fortuneBlink")],
      });
      break;
    case "fortuneBlink": {
      if (src.zone !== "battlefield") break;
      const options = (src.crewedBy ?? []).filter(
          (id) => g.cards[id]?.zone === "battlefield",
        ),
        extra = (yield* pick(options, "可閃爍一個騎乘者", 0))[0],
        ids = [src.id, ...(extra !== undefined ? [extra] : [])],
        batch = g.frontierEntryBatch;
      g.frontierEntryBatch = g.nextSid++;
      for (const id of ids) moveCard(g, g.cards[id], "exile");
      for (const id of ids) enterBattlefield(g, g.cards[id], g.cards[id].owner);
      g.frontierEntryBatch = batch;
      break;
    }
    case "destroyLargest":
      if (
        c &&
        !g.battlefield.some(
          (id) =>
            isCreature(g.cards[id]) &&
            id !== c.id &&
            stats(g, g.cards[id]).p > stats(g, c).p,
        )
      )
        destroyCards(g, [c]);
      break;
    case "flyingCounter":
      if (!(src.eclCounters?.flying ?? 0)) (src.eclCounters ??= {}).flying = 1;
      break;
    case "20":
      if (c) {
        moveCard(g, c, "hand");
        putCounters(g, src, 1);
      }
      break;
    case "22":
      if (c) {
        const hosts = own({ type: "Creature" }),
          id = (yield* pick(
            hosts,
            "選擇要結附的己方生物",
            Math.min(1, hosts.length),
          ))[0];
        if (id !== undefined) {
          if (c.def.aura) c.attachedTo = id;
          enterBattlefield(g, c, pid);
          c.attachedTo = id;
          emit(g, {
            type: "frontier",
            action: "attached",
            card: c.id,
            player: pid,
            other: id,
            amount: 0,
          });
        }
      }
      break;
    case "24":
      frontierFlags(g, pid).prairiePlus =
        (frontierFlags(g, pid).prairiePlus ?? 0) + 1;
      break;
    case "untapPlayer":
      yield* run([
        {
          e: "untap",
          what: {
            all: {
              type: "Creature",
              ctrl: targetPlayer() === pid ? "you" : "opp",
            },
          },
        },
      ]);
      break;
    case "28":
      if (c) {
        if (own({ sub: "Mount" }).length) enterBattlefield(g, c, pid);
        else moveCard(g, c, "hand");
      }
      break;
    case "39":
      if (c) {
        c.tempFlashbackTurn = g.turn;
        if (src.saddledTurn === g.turn)
          (c.frontierMarks ??= {}).freeFlashback = g.turn;
      }
      break;
    case "46":
      if (!isCreature(src)) {
        src.tlaOriginalDef ??= src.def;
        src.def = {
          ...src.def,
          types: [...src.def.types, "Creature"],
          subtypes: [...(src.def.subtypes ?? []), "Spirit"],
          power: 3,
          toughness: 3,
          keywords: [...(src.def.keywords ?? []), "flying"],
        };
      }
      break;
    case "49": {
      const t = ctx.targets[1],
        other = t && "c" in t ? g.cards[t.c] : undefined;
      if (c && other && c.id !== other.id) {
        const def = copiableDefinition(other);
        transient(c, def);
        c.copyLayer = def;
      }
      break;
    }
    case "54": {
      const n = ev && "amount" in ev ? ev.amount : 0,
        top = p.library.slice(0, n),
        id = (yield* pick(
          top.filter((id) => !isLand(g.cards[id])),
          "可免費施放一張非地牌",
          0,
        ))[0],
        rest = top.filter((x) => x !== id);
      shuffleArr(g, rest);
      for (const x of rest) moveCard(g, g.cards[x], "library", true);
      if (id !== undefined) {
        const x = g.cards[id];
        moveCard(g, x, "exile");
        if (yield* yes(pid, "免費施放？")) yield* freeCast(g, ctx, x);
      }
      break;
    }
    case "rabbit":
      if (c) {
        transient(c, {
          types: ["Creature"],
          subtypes: ["Rabbit"],
          colors: ["W"],
        });
        yield* run([{ e: "setBase", what: "T0", p: 0, t: 1 }]);
      }
      break;
    case "surveilIfEmpty":
      if (!p.hand.length) yield* run([{ e: "surveil", n: 3 }]);
      break;
    case "65":
      if (c) {
        if (c.tapped) yield* run([{ e: "stun", what: "T0" }]);
        else tapCard(g, c, pid);
      }
      break;
    case "exchange": {
      const t = ctx.targets[1],
        b = t && "c" in t ? g.cards[t.c] : undefined;
      if (
        c &&
        b &&
        c.zone === "battlefield" &&
        b.zone === "battlefield" &&
        c.controller !== b.controller
      ) {
        const a = c.controller;
        c.controller = b.controller;
        b.controller = a;
        c.sick = b.sick = true;
      }
      break;
    }
    case "70":
      for (const player of g.players)
        if (yield* yes(player.id, "將手牌與墳墓場洗回並抓七張？")) {
          for (const id of [...player.hand, ...player.graveyard])
            moveCard(g, g.cards[id], "library");
          shuffleArr(g, player.library);
          drawCards(g, player.id, 7);
        }
      break;
    case "78": {
      const player = targetPlayer(),
        hand = g.players[player].hand,
        ids = hand.filter((id) => !isLand(g.cards[id])),
        id = (yield* pick(ids, "可選一張非地牌棄掉", 0))[0];
      if (id !== undefined) discardMany(g, [g.cards[id]]);
      else {
        const ex = (yield* pick(
          g.players[player].exile,
          "可將一張放逐牌放入墳墓場",
          0,
        ))[0];
        if (ex !== undefined) moveCard(g, g.cards[ex], "graveyard");
      }
      break;
    }
    case "81":
      if (src.frontierMarks?.sacOutlaw) yield* token("tok-treasure");
      break;
    case "82": {
      const x = g.cards[p.library[0]];
      if (x) {
        const n = manaValue(x.def);
        moveCard(g, x, "hand");
        loseLife(g, src.saddledTurn === g.turn ? opp : pid, n);
      }
      break;
    }
    case "83":
      if (c) {
        const n = manaValue(c.def);
        moveCard(g, c, "exile");
        if (n <= 3) yield* run([{ e: "surveil", n: 2 }]);
      }
      break;
    case "87":
      if (c)
        (g.delayed ??= []).push({
          source: c.id,
          controller: pid,
          on: "dies",
          once: true,
          effects: [
            { e: "reanimate", what: "selfAny", tapped: true, owner: true },
            {
              e: "token",
              token: "tok-treasure",
              who: pid === c.owner ? "you" : "opp",
            },
          ],
        });
      break;
    case "gisaWard": {
      const item = g.stack.find((s) => s.sid === ef.n);
      if (!item) break;
      const who = item.controller,
        cost = parseCost("{2}");
      if (
        frontierCanPayLife(g, who, 2) &&
        canPayCost(g, who, cost) &&
        (yield* yes(who, "支付{2}與2生命以通過守護？"))
      ) {
        payCost(g, who, cost);
        frontierPayLife(g, who, 2);
      } else {
        g.stack = g.stack.filter((s) => s.sid !== item.sid);
        if (item.kind === "spell") {
          const x = g.cards[item.cardId];
          if (x.zone === "stack")
            moveCard(g, x, item.alt === "flashback" ? "exile" : "graveyard");
        }
      }
      break;
    }
    case "gisaZombies":
      yield* token("tok-otj-zombie", 2, { tapped: true });
      break;
    case "90":
      if (ctx.targets[0]) {
        const player = targetPlayer(),
          pl = g.players[player],
          ids = yield* pick(
            pl.hand,
            "棄一張牌",
            Math.min(1, pl.hand.length),
            1,
            player,
          );
        const high = ids.some((id) => manaValue(g.cards[id].def) >= 4);
        discardMany(
          g,
          ids.map((id) => g.cards[id]),
        );
        if (!high) drawCards(g, pid, 1);
      }
      break;
    case "tutorTop":
    case "tutorGrave": {
      const id = (yield* pick(p.library, "搜尋牌", 0))[0];
      if (id !== undefined)
        moveCard(g, g.cards[id], action === "tutorTop" ? "exile" : "graveyard");
      shuffleArr(g, p.library);
      if (id !== undefined && action === "tutorTop")
        moveCard(g, g.cards[id], "library");
      break;
    }
    case "92":
      if (c && (yield* yes(pid, "放逐並可施放複製？"))) {
        const def = copiableDefinition(c);
        moveCard(g, c, "exile");
        const cp = newCard(g, def, pid, true);
        cp.zone = "exile";
        p.exile.push(cp.id);
        if (yield* yes(pid, "支付費用施放複製？"))
          if (yield* immediate(cp)) loseLife(g, pid, 2);
        if (cp.zone === "exile") {
          p.exile = p.exile.filter((id) => id !== cp.id);
          cp.tokenDeparted = true;
        }
      }
      break;
    case "93": {
      const ids: number[] = [];
      let budget = 4;
      for (let i = 0; i < 2; i++) {
        const options = p.graveyard.filter(
            (id) =>
              !ids.includes(id) &&
              isCreature(g.cards[id]) &&
              manaValue(g.cards[id].def) <= budget,
          ),
          id = (yield* pick(
            options,
            "返場生物（剩餘總法力值" + budget + "）",
            0,
          ))[0];
        if (id === undefined) break;
        ids.push(id);
        budget -= manaValue(g.cards[id].def);
      }
      if (ids.reduce((n, id) => n + manaValue(g.cards[id].def), 0) <= 4) {
        const batch = g.frontierEntryBatch;
        g.frontierEntryBatch = g.nextSid++;
        for (const id of ids) enterBattlefield(g, g.cards[id], pid);
        g.frontierEntryBatch = batch;
      }
      break;
    }
    case "95":
      yield* run([
        {
          e: "pump",
          what: {
            all: {
              type: "Creature",
              ctrl: targetPlayer() === pid ? "you" : "opp",
            },
          },
          p: -1,
          t: -1,
        },
      ]);
      break;
    case "98": {
      const ids = yield* pick(own(), "犧牲任意數量永久物", 0, own().length);
      for (const id of ids) sacrifice(g, g.cards[id]);
      drawCards(g, pid, ids.length);
      break;
    }
    case "halfCreatures": {
      const player = targetPlayer(),
        ids = g.battlefield.filter(
          (id) => g.cards[id].controller === player && isCreature(g.cards[id]),
        ),
        chosen = yield* pick(
          ids,
          "犧牲半數生物",
          Math.ceil(ids.length / 2),
          Math.ceil(ids.length / 2),
          player,
        );
      for (const id of chosen) sacrifice(g, g.cards[id]);
      break;
    }
    case "halfHand": {
      const player = targetPlayer(),
        ids = g.players[player].hand,
        chosen = yield* pick(
          ids,
          "棄半數手牌",
          Math.ceil(ids.length / 2),
          Math.ceil(ids.length / 2),
          player,
        );
      discardMany(
        g,
        chosen.map((id) => g.cards[id]),
      );
      break;
    }
    case "halfLife": {
      const player = targetPlayer();
      loseLife(g, player, Math.ceil(g.players[player].life / 2));
      break;
    }
    case "105":
      if (yield* yes(pid, "犧牲並搜尋牌？")) {
        sacrifice(g, src);
        yield* run([{ e: "tutor", filter: {} }]);
      }
      break;
    case "tinyDiscard":
    case "tinyMill":
      for (const t of ctx.targets)
        if (t && "p" in t) {
          if (action === "tinyDiscard")
            yield* run([
              { e: "discard", who: t.p === pid ? "you" : "opp", n: 1 },
            ]);
          else
            yield* run([
              { e: "mill", who: t.p === pid ? "you" : "opp", n: 1 },
              { e: "lose", who: t.p === pid ? "you" : "opp", n: 1 },
            ]);
        }
      break;
    case "109":
      if (c && (yield* yes(pid, "施放對手墳墓場永久物？")))
        yield* immediate(c, false, true);
      break;
    case "116": {
      for (let i = 0; i < 2; i++) {
        const ids = (src.crewedBy ?? []).filter(
            (id) =>
              g.cards[id]?.zone === "battlefield" &&
              !matches(g, { legendary: true }, g.cards[id], pid),
          ),
          id = (yield* pick(
            ids,
            "選一個非傳奇騎乘者",
            Math.min(1, ids.length),
          ))[0];
        if (id !== undefined)
          for (const t of yield* makeEclTokenBatch(
            g,
            pid,
            copiableDefinition(g.cards[id]),
            1,
            { tapped: true, attacking: true },
          ))
            t.sacAtEnd = true;
      }
      break;
    }
    case "gilaImpulse":
      yield* impulse(pid, 1, g.turn + (g.active === pid ? 2 : 1));
      break;
    case "extraCombat":
      if (g.phase.startsWith("combat_"))
        g.extraCombat = {
          player: pid,
          landOnly: false,
          count: (g.extraCombat?.count ?? 0) + 1,
        };
      break;
    case "combatTreasure":
      (g.delayed ??= []).push({
        source: src.id,
        controller: pid,
        on: "frontierEvent",
        frontierEvent: "combatTarget",
        once: false,
        effects: [E("tappedTreasure")],
        frontierPlayer: targetPlayer(),
      });
      break;
    case "126": {
      const before = c ? Math.max(0, stats(g, c).t - c.damage) : 0,
        n = c ? dealDamage(g, src, pid, { c: c.id }, ctx.x ?? 0) : 0;
      if (n > before)
        yield* token("tok-treasure", n - before, { tapped: true });
      break;
    }
    case "129": {
      const choice = yield* mode(pid, "可棄牌或犧牲地", [
        "不支付",
        "棄一張牌",
        "犧牲一個地",
      ]);
      if (choice === 1) {
        const id = (yield* pick(
          p.hand,
          "棄一張牌",
          Math.min(1, p.hand.length),
        ))[0];
        if (id !== undefined) {
          discardMany(g, [g.cards[id]]);
          drawCards(g, pid, 2);
        }
      } else if (choice === 2) {
        const id = (yield* pick(
          own({ type: "Land" }),
          "犧牲地",
          Math.min(1, own({ type: "Land" }).length),
        ))[0];
        if (id !== undefined) {
          sacrifice(g, g.cards[id]);
          drawCards(g, pid, 2);
        }
      }
      break;
    }
    case "tappedTreasure":
      yield* token("tok-treasure", 1, { tapped: true });
      break;
    case "138":
      yield* run([
        {
          e: "grant",
          what: {
            all: {
              type: "Creature",
              ctrl: targetPlayer() === pid ? "you" : "opp",
            },
          },
          grant: { removeKw: ["first_strike", "double_strike"] },
        },
      ]);
      break;
    case "copyStack":
    case "retargetStack": {
      const item = g.stack.find((s) => s.sid === ef.n);
      if (!item) break;
      if (action === "copyStack") {
        if (item.kind === "spell")
          yield* runEffects(
            g,
            {
              ...ctx,
              ev: {
                type: "cast",
                card: item.cardId,
                player: item.controller,
                opponentTurn: g.active !== item.controller,
              },
            },
            [{ e: "copySpell" }],
          );
        else
          yield* mshEffect(g, ctx, {
            e: "msh",
            action: "copyAbility",
            n: item.sid,
          });
      } else {
        const specs = item.targetSpecs.map((s) => ({
            ...s,
            targetController: item.controller,
          })),
          r: Response = yield {
            type: "targets",
            player: pid,
            source: item.cardId,
            specs,
            text: item.text,
            effects: item.effects,
          };
        if (
          r.type === "targets" &&
          !validateTargets(g, specs, r.targets, item.controller, item.cardId)
        ) {
          const previous = item.targets;
          item.targets = r.targets;
          item.targetVersions = r.targets.map((t) =>
            t && "c" in t ? (g.cards[t.c].objectVersion ?? 0) : undefined,
          );
          for (let i = 0; i < r.targets.length; i++) {
            const t = r.targets[i];
            if (
              t &&
              "c" in t &&
              !sameTarget(t, previous[i] ?? null) &&
              g.cards[t.c].zone === "battlefield"
            )
              emit(g, {
                type: "targeted",
                card: t.c,
                by: item.controller,
                spell: item.kind === "spell",
                stackSid: item.sid,
              });
          }
        }
      }
      break;
    }
    case "landElemental":
    case "powerElemental": {
      const n =
        action === "landElemental"
          ? own({ type: "Land" }).length
          : Math.max(
              0,
              ...own({ type: "Creature" }).map((id) => stats(g, g.cards[id]).p),
            );
      yield* makeEclTokenBatch(
        g,
        pid,
        {
          id: "tok-otj-elemental",
          name: "Elemental",
          set: "TOK",
          rarity: "T",
          types: ["Creature"],
          subtypes: ["Elemental"],
          colors: ["G"],
          power: n,
          toughness: n,
          text: "",
        },
        1,
      );
      break;
    }
    case "doubleCounters":
      for (const id of own({ type: "Creature" }))
        putCounters(g, g.cards[id], g.cards[id].counters);
      break;
    case "doubleTargetCounters":
      if (c) putCounters(g, c, c.counters);
      break;
    case "163": {
      const top = p.library.slice(0, 5),
        id = (yield* pick(
          top.filter((id) => isLand(g.cards[id])),
          "可放一張地進場",
          0,
        ))[0];
      if (id !== undefined) enterBattlefield(g, g.cards[id], pid, true);
      const rest = top.filter((x) => x !== id);
      shuffleArr(g, rest);
      for (const id of rest) moveCard(g, g.cards[id], "library", true);
      break;
    }
    case "hydraTreasures":
      yield* token(
        "tok-treasure",
        ev?.type === "dies" ? Math.max(0, ev.power) : 0,
        { tapped: true },
      );
      break;
    case "174": {
      const top = p.library.slice(0, 3);
      for (const id of top) moveCard(g, g.cards[id], "graveyard");
      const ids = top.filter(
          (id) => g.cards[id].zone === "graveyard" && isLand(g.cards[id]),
        ),
        id = (yield* pick(ids, "拿一張地", Math.min(1, ids.length)))[0];
      if (id !== undefined) moveCard(g, g.cards[id], "hand");
      else yield* token("tok-treasure");
      break;
    }
    case "176": {
      const ids = (src.crewedBy ?? []).filter(
          (id) => g.cards[id]?.zone === "battlefield",
        ),
        chosen = yield* pick(ids, "可收回任意數量騎乘者", 0, ids.length);
      for (const id of chosen) moveCard(g, g.cards[id], "hand");
      break;
    }
    case "surpriseMill": {
      const top = p.library.slice(0, 4);
      for (const id of top) moveCard(g, g.cards[id], "graveyard");
      const ids = yield* pick(
        top.filter(
          (id) =>
            g.cards[id].zone === "graveyard" &&
            g.cards[id].def.types.some((t) => t === "Creature" || t === "Land"),
        ),
        "可拿至多兩張生物或地",
        0,
        2,
      );
      for (const id of ids) moveCard(g, g.cards[id], "hand");
      break;
    }
    case "surpriseCreatures": {
      const ids = yield* pick(
          p.hand.filter((id) => isCreature(g.cards[id])),
          "可放至多兩個生物進場",
          0,
          2,
        ),
        batch = g.frontierEntryBatch;
      g.frontierEntryBatch = g.nextSid++;
      for (const id of ids) enterBattlefield(g, g.cards[id], pid);
      g.frontierEntryBatch = batch;
      break;
    }
    case "combatDraw2":
      if (c)
        (g.delayed ??= []).push({
          source: c.id,
          controller: pid,
          on: "combatDamagePlayer",
          once: false,
          effects: [{ e: "draw", n: 2 }],
        });
      break;
    case "handCreature": {
      const id = (yield* pick(
        p.hand.filter((id) => isCreature(g.cards[id])),
        "可放一個生物進場",
        0,
      ))[0];
      if (id !== undefined) enterBattlefield(g, g.cards[id], pid);
      break;
    }
    case "192": {
      const host = g.cards[src.attachedTo ?? -1],
        x = Object.values(g.cards).find(
          (x) => x.zone === "exile" && x.exiledBy === src.id && isCreature(x),
        );
      if (host && x) {
        const def = copiableDefinition(x);
        host.tlaOriginalDef ??= host.def;
        host.def = def;
        host.copyLayer = def;
        (host.frontierMarks ??= {}).aegisSource = src.id;
      }
      break;
    }
    case "196": {
      const id = (yield* pick(
        [...p.hand, ...p.graveyard].filter((id) => isLand(g.cards[id])),
        "可放一張地進場",
        0,
      ))[0];
      if (id !== undefined) enterBattlefield(g, g.cards[id], pid);
      break;
    }
    case "197":
      if (yield* yes(pid, "犧牲神器擲硬幣？")) {
        const id = (yield* pick(
          own({ type: "Artifact" }),
          "犧牲神器",
          Math.min(1, own({ type: "Artifact" }).length),
        ))[0];
        if (id === undefined) break;
        sacrifice(g, g.cards[id]);
        if (randInt(g, 2) === 0) yield* run([{ e: "copySpell" }]);
        else {
          const spell = ev?.type === "cast" ? g.cards[ev.card] : undefined,
            n = spell ? manaValue(spell.def) : 0;
          yield* run([
            {
              e: "reflexive",
              targets: [{ kind: "any" }],
              effects: [{ e: "damage", to: "T0", n }],
            },
          ]);
        }
      }
      break;
    case "198": {
      const x = g.cards[p.library[0]];
      if (x) {
        const land = isLand(x);
        moveCard(g, x, "exile");
        if (land) yield* token("tok-otj-ox");
        else {
          x.playableBy = pid;
          x.playableUntil = g.turn + (g.active === pid ? 2 : 1);
          (x.frontierMarks ??= {}).spellsOnly = 1;
        }
      }
      break;
    }
    case "202": {
      const aura = ev && "card" in ev ? g.cards[ev.card] : undefined,
        host = aura ? g.cards[aura.attachedTo ?? -1] : undefined;
      if (
        aura &&
        host &&
        host.controller !== pid &&
        !isLand(host) &&
        manaValue(host.def) <= manaValue(aura.def)
      ) {
        Object.assign((host.frontierMarks ??= {}), {
          erietteAura: aura.id,
          eriettePrevious: host.controller,
        });
        host.controller = pid;
        host.sick = true;
      }
      break;
    }
    case "copyActivated":
      if (ev?.type === "frontier")
        yield* mshEffect(g, ctx, {
          e: "msh",
          action: "copyAbility",
          n: ev.amount,
        });
      break;
    case "206": {
      const options = (src.crewedBy ?? []).filter(
          (id) => g.cards[id]?.zone === "battlefield",
        ),
        id = (yield* pick(options, "可犧牲一個騎乘者", 0))[0];
      if (id === undefined) break;
      const n = stats(g, g.cards[id]).p;
      sacrifice(g, g.cards[id]);
      drawCards(g, pid, n);
      const ids = yield* pick(
        p.hand.filter((id) => isLand(g.cards[id])),
        "可放至多X張地",
        0,
        n,
      );
      for (const id of ids) enterBattlefield(g, g.cards[id], pid, true);
      break;
    }
    case "211": {
      const entered = ev && "card" in ev ? g.cards[ev.card] : undefined,
        batch = entered?.frontierMarks?.tokenBatch,
        group = g.nextSid++;
      if (entered)
        for (const x of Object.values(g.cards).filter(
          (c) =>
            c.token &&
            c.controller === opp &&
            (batch === undefined
              ? c.id === entered.id
              : c.frontierMarks?.tokenBatch === batch),
        ))
          yield* makeEclTokenBatch(g, pid, copiableDefinition(x), 1, {
            tapped: true,
            batch: group,
          });
      break;
    }
    case "212": {
      const id = (yield* pick(
        p.hand.filter(
          (id) => !isLand(g.cards[id]) && manaValue(g.cards[id].def) <= 3,
        ),
        "可預謀一張法力值3以下非地牌",
        0,
      ))[0];
      if (id !== undefined) plot(g.cards[id]);
      break;
    }
    case "213": {
      const spell = ev?.type === "cast" ? g.cards[ev.card] : undefined,
        item = spell
          ? g.stack.find((s) => s.kind === "spell" && s.cardId === spell.id)
          : undefined,
        n = spell ? manaValue(spell.castFace ?? spell.def) + (item?.x ?? 0) : 0,
        options = p.hand.filter(
          (id) =>
            g.cards[id].def.types.some((t) =>
              ["Creature", "Artifact", "Enchantment", "Planeswalker"].includes(
                t,
              ),
            ) && manaValue(g.cards[id].def) <= n,
        ),
        id = (yield* pick(options, "可免費施放一個永久物", 0))[0];
      let cast = false;
      if (id !== undefined) cast = yield* freeCast(g, ctx, g.cards[id]);
      if (!cast) {
        const land = (yield* pick(
          p.hand.filter((id) => isLand(g.cards[id])),
          "可放一張地進場",
          0,
        ))[0];
        if (land !== undefined) enterBattlefield(g, g.cards[land], pid);
      }
      break;
    }
    case "215":
      yield* impulse(
        targetPlayer(),
        own({ outlaw: true }).length,
        g.turn,
        true,
        true,
      );
      break;
    case "216": {
      const ids = g.players.flatMap((p) => p.graveyard),
        id = (yield* pick(ids, "可放逐一張墳墓場牌", 0))[0];
      if (id === undefined) break;
      const x = g.cards[id],
        def = copiableDefinition(x),
        creature = isCreature(x);
      moveCard(g, x, "exile");
      if (creature && (yield* yes(pid, "暫時成為該生物複製？"))) {
        transient(src, def);
        src.copyLayer = def;
      }
      break;
    }
    case "218": {
      const top = p.library.slice(0, 3),
        id = (yield* pick(
          top.filter((id) => !isLand(g.cards[id])),
          "可預謀一張非地牌",
          0,
        ))[0];
      for (const x of top)
        if (x === id) plot(g.cards[x]);
        else moveCard(g, g.cards[x], "hand");
      break;
    }
    case "222":
      g.frontierExtraUpkeeps =
        (g.frontierExtraUpkeeps ?? 0) + (ev && "amount" in ev ? ev.amount : 0);
      break;
    case "okoCopy":
      if (c && (yield* yes(pid, "Oko成為該生物的複製？"))) {
        const def = copiableDefinition(c);
        transient(src, {
          ...def,
          keywords: [...(def.keywords ?? []), "hexproof"],
        });
        src.copyLayer = {
          ...def,
          keywords: [...(def.keywords ?? []), "hexproof"],
        };
      }
      break;
    case "223": {
      const batch = g.nextSid++;
      for (const id of own({ nonType: "Land", other: true }))
        yield* makeEclTokenBatch(g, pid, copiableDefinition(g.cards[id]), 1, {
          batch,
        });
      break;
    }
    case "226": {
      const x = ev?.type === "sacrifice" ? g.cards[ev.card] : undefined,
        n = x ? manaValue(x.def) : 0,
        end =
          g.turn +
          (g.active === pid
            ? g.phase === "end" || g.phase === "cleanup"
              ? 2
              : 0
            : 1),
        ids = yield* impulse(targetPlayer(), n, end, true);
      for (const c of ids) (c.frontierMarks ??= {}).seekEnd = end;
      break;
    }
    case "227": {
      const x =
          ev?.type === "cast"
            ? (g.cards[ev.card]?.frontierMarks?.modalChoices ?? 1)
            : 1,
        options = Array.from({ length: 8 }, (_, mask) => mask).filter(
          (mask) => mask.toString(2).replace(/0/g, "").length <= x,
        ),
        choice =
          options[
            yield* mode(
              pid,
              "選擇至多X項",
              options.map(
                (mask) =>
                  [
                    mask & 1 ? "放逐牌庫頂並可使用" : "",
                    mask & 2 ? "指示物與踐踏" : "",
                    mask & 4 ? "派飛鳥" : "",
                  ]
                    .filter(Boolean)
                    .join("＋") || "不選",
              ),
            )
          ];
      if (choice & 1)
        yield* impulse(pid, 1, g.turn + (g.active === pid ? 2 : 1));
      if (choice & 2)
        yield* run([
          { e: "counters", what: "self", n: 1 },
          { e: "pump", what: "self", p: 0, t: 0, kw: ["trample"] },
        ]);
      if (choice & 4) yield* token("tok-otj-bird");
      break;
    }
    case "meteorite":
      yield* token("tok-otj-meteorite", 1, { tapped: true });
      break;
    case "234":
      frontierFlags(g, pid).taii =
        (frontierFlags(g, pid).taii ?? 0) + (ctx.x ?? 0);
      break;
    case "deathtouchCounters":
      for (const id of own({ type: "Creature" }))
        (g.cards[id].eclCounters ??= {}).deathtouch =
          (g.cards[id].eclCounters?.deathtouch ?? 0) + 1;
      break;
    case "237": {
      const x = ev?.type === "dies" ? g.cards[ev.card] : undefined;
      if (
        !x ||
        x.zone !== "graveyard" ||
        !canPayCost(g, pid, parseCost("{1}")) ||
        !(yield* yes(pid, "支付{1}偷取作為珍寶？"))
      )
        break;
      payCost(g, pid, parseCost("{1}"));
      const def = {
        ...x.def,
        types: ["Artifact"] as CardDef["types"],
        subtypes: ["Treasure"],
        produces: ["W", "U", "B", "R", "G"] as CardDef["produces"],
        sacOnMana: true,
      };
      enterBattlefield(g, x, pid, true, def);
      delete x.copyLayer;
      break;
    }
    case "lootCounter":
      (src.frontierMarks ??= {}).loot = (src.frontierMarks?.loot ?? 0) + 1;
      break;
    case "245": {
      const x = g.cards[p.library[0]];
      if (x && isLand(x) && (yield* yes(pid, "將牌庫頂地牌橫置進場？")))
        enterBattlefield(g, x, pid, true);
      break;
    }
    case "248": {
      const options = p.library.filter((id) =>
          matches(
            g,
            { type: "Land", or: [{ basic: true }, { sub: "Desert" }] },
            g.cards[id],
            pid,
          ),
        ),
        id = (yield* pick(options, "可搜尋地放到牌庫頂", 0))[0];
      shuffleArr(g, p.library);
      if (id !== undefined) moveCard(g, g.cards[id], "library");
      break;
    }
    case "252": {
      const options = own({ type: "Land" }),
        id = (yield* pick(
          options,
          "將一張地回手",
          Math.min(1, options.length),
        ))[0];
      if (id !== undefined) {
        const desert =
          id !== src.id && matches(g, { sub: "Desert" }, g.cards[id], pid);
        moveCard(g, g.cards[id], "hand");
        if (desert) yield* run([{ e: "surveil", n: 1 }]);
      }
      break;
    }
    case "265": {
      const x = g.cards[p.library[0]];
      if (x) {
        if (
          matches(g, { sub: "Mount" }, x, pid) &&
          (yield* yes(pid, "展示坐騎並放入手牌？"))
        )
          moveCard(g, x, "hand");
        else if (yield* yes(pid, "放到牌庫底？"))
          moveCard(g, x, "library", true);
      }
      break;
    }
    case "271":
      (g.delayed ??= []).push({
        source: src.id,
        controller: pid,
        on: "castAny",
        once: false,
        effects: [{ e: "copySpell" }],
      });
      break;
    default:
      throw Error("Unimplemented OTJ effect " + action);
  }
  g.version++;
}
