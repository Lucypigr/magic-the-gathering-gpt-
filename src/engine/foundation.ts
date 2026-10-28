import {innkeeperMultiplier} from './meadow-support';
import {
  copiableDefinition,
  isCreature,
  isLand,
  matches,
  newCard,
  randInt,
  other,
  shuffleArr,
  stats,
} from "./state";
import { parseCost, manaValue, colorsOf } from "./mana";
import {
  canPayCost,
  payCost,
  frontierCanPayLife,
  frontierPayLife,
} from "./actions";
import { choose, freeCast } from "./tla";
import { runEffects, resolveRef, type Ctx } from "./effects";
import { makeEclTokenBatch } from "./ecl";
import { counterKinds } from "./ecl-support";
import { changeDoor, doorCount, graveTypes } from "./foundation-support";
import { frontierStatic, frontierFlags } from "./frontier-support";
import { turnFaceUp } from "./facedown";
import { woeEffect } from "./woe";
import { otjEffect } from "./otj";
import {
  dealDamage,
  drawCards,
  discardMany,
  emit,
  enterBattlefield,
  gainLife,
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
function* yes(pid: PID, prompt: string): SubFlow<boolean> {
  const r: Response = yield { type: "yesno", player: pid, prompt };
  return r.type === "yesno" && r.yes;
}
export function* foundationEffect(
  g: GameState,
  original: Ctx,
  ef: Extract<Effect, { e: "frontier" }>,
): SubFlow {
  const [set, action] = ef.action.split(":"),
    offset =
      typeof ef.what === "string" && /^T\d+$/.test(ef.what)
        ? Number(ef.what.slice(1))
        : 0,
    ctx = { ...original, targets: original.targets.slice(offset) },
    pid = ctx.controller,
    opp = other(pid),
    p = g.players[pid],
    src = g.cards[ctx.source],
    c = resolveRef(
      g,
      ctx,
      typeof ef.what === "string" && !ef.what.startsWith("T") ? ef.what : "T0",
    ).cards[0],
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
  const fx = (action: string, n?: number): Effect => ({
    e: "frontier",
    action: set + ":" + action,
    n,
  });
  const token = (
    id: string | CardDef,
    n = 1,
    opts: Parameters<typeof makeEclTokenBatch>[4] = {},
  ) => makeEclTokenBatch(g, pid, id, n, opts);
  const targetPlayer = () =>
    ctx.targets[0] && "p" in ctx.targets[0] ? ctx.targets[0].p : opp;
  const impulse = function* (
    n: number,
    next = false,
    chooseOne = false,
  ): SubFlow {
    const ids = p.library.slice(0, n);
    let keep = ids;
    if (chooseOne)
      keep = yield* pick(ids, "選擇可使用的牌", Math.min(1, ids.length));
    for (const id of ids) {
      const x = g.cards[id];
      moveCard(g, x, "exile");
      if (keep.includes(id)) {
        x.playableBy = pid;
        x.playableUntil = g.turn + (next ? (g.active === pid ? 2 : 1) : 0);
      }
    }
  };
  const batchReturn = (ids: number[], who = pid, tapped = false) => {
    const old = g.frontierEntryBatch;
    g.frontierEntryBatch = g.nextSid++;
    for (const id of ids)
      if (g.cards[id].zone === "graveyard")
        enterBattlefield(g, g.cards[id], who, tapped);
    g.frontierEntryBatch = old;
  };
  const blink = function* (x: Card, controller = x.owner): SubFlow {
    moveCard(g, x, "exile");
    (g.delayed ??= []).push({
      source: x.id,
      controller,
      on: "eachEndStep",
      once: true,
      persistent: true,
      effects: [fx("returnCard", x.objectVersion)],
    });
  };
  const immediate = function* (x: Card, free = true): SubFlow<boolean> {
    let alt: undefined | "adventure";
    if (
      x.def.adventure &&
      (yield* mode(pid, "施放面", [x.def.name, x.def.adventure.name]))
    )
      alt = "adventure";
    return yield* freeCast(g, ctx, x, free, alt);
  };
  switch (action) {
    case "wardSpecial": {
      const item = g.stack.find((s) => s.sid === ef.n);
      if (!item) return;
      const who = item.controller;
      let paid = false;
      if (src.def.id === "ovika-enigma-goliath") {
        if (
          frontierCanPayLife(g, who, 3) &&
          canPayCost(g, who, parseCost("{3}")) &&
          (yield* yes(who, "支付{3}與3生命守護？"))
        ) {
          payCost(g, who, parseCost("{3}"));
          frontierPayLife(g, who, 3);
          paid = true;
        }
      } else if (src.def.id === "valgavoth-terror-eater") {
        const ids = g.battlefield.filter(
          (id) => g.cards[id].controller === who && !isLand(g.cards[id]),
        );
        if (
          ids.length >= 3 &&
          (yield* yes(who, "犧牲三個非地永久物支付守護？"))
        ) {
          for (const id of yield* pick(ids, "犧牲三個非地永久物", 3, 3, who))
            sacrifice(g, g.cards[id]);
          paid = true;
        }
      } else {
        const ids = g.players[who].hand;
        if (ids.length && (yield* yes(who, "棄一張牌支付守護？"))) {
          const id = src.def.meadow?.finalWardRandom?ids[randInt(g,ids.length)]:(yield* pick(ids, "棄牌", 1, 1, who))[0];
          discardMany(g, [g.cards[id]]);
          paid = true;
        }
      }
      if (
        !paid &&
        !item.uncounterable &&
        !g.cards[item.cardId].def.uncounterable
      ) {
        g.stack = g.stack.filter((s) => s.sid !== item.sid);
        if (item.kind === "spell")
          moveCard(g, g.cards[item.cardId], "graveyard");
      }
      return;
    }

    case "discardOpponentHand":
      discardMany(
        g,
        g.players[opp].hand.slice().map((id) => g.cards[id]),
      );
      return;
    case "ownGraveCreatures":
      batchReturn(p.graveyard.filter((id) => isCreature(g.cards[id])));
      return;
    case "poison2":
      g.players[opp].poison = (g.players[opp].poison ?? 0) + 2*innkeeperMultiplier(g,ctx.controller);
      return;
    case "activeDraw":
      drawCards(g, g.active, 1);
      return;
    case "selfTop":
      moveCard(g, src, "library");
      return;
    case "sacCreature":
      yield* run([
        { e: "sacPlayer", who: "T0", filter: { type: "Creature" }, n: 1 },
      ]);
      return;
    case "impendingTick":
      if (src.zone === "battlefield" && (src.impendingTime ?? 0) > 0) {
        src.impendingTime =
          (src.eclCounters?.time ?? src.impendingTime ?? 0) - 1;
        (src.eclCounters ??= {}).time = src.impendingTime;
        if (!src.impendingTime && src.tlaOriginalDef) {
          src.def = src.tlaOriginalDef;
          src.tlaOriginalDef = undefined;
        }
      }
      return;

    case "copyToken":
    case "reflectionCopy":
      yield* woeEffect(g, ctx, { ...ef, action: "woe:" + action, what: "T0" });
      return;
    case "steal":
      yield* woeEffect(g, ctx, { ...ef, action: "woe:steal", what: "T0" });
      return;
    case "retargetStack":
      yield* otjEffect(g, ctx, {
        ...ef,
        action: "otj:retargetStack",
        what: "T0",
      });
      return;
    case "fakeDeath":
      yield* otjEffect(g, ctx, { ...ef, action: "otj:87", what: "T0" });
      return;
    case "exileDeath":
      if (c) c.exileOnDeathTurn = g.turn;
      return;
    case "flashback":
      if (c) c.tempFlashbackTurn = g.turn;
      return;
    case "combatFog":
      if (c) (c.frontierMarks ??= {}).combatFog = g.turn;
      return;
    case "exileGrave":
      for (const id of g.players[targetPlayer()].graveyard.slice())
        moveCard(g, g.cards[id], "exile");
      return;
    case "exileOpponentGrave":
      for (const id of g.players[opp].graveyard.slice())
        moveCard(g, g.cards[id], "exile");
      return;
    case "impulse1":
      yield* impulse(1);
      return;
    case "impulseNext":
      yield* impulse(1, true);
      return;
    case "impulseTwoNext":
      yield* impulse(2, true);
      return;
    case "discardHand":
      discardMany(
        g,
        p.hand.slice().map((id) => g.cards[id]),
      );
      return;
    case "extraCombat":
      g.extraCombat = {
        player: pid,
        landOnly: false,
        count: (g.extraCombat?.count ?? 0) + 1,
      };
      return;
    case "returnCard":
      if (
        src.zone === "exile" &&
        (ef.n === undefined || src.objectVersion === ef.n)
      )
        enterBattlefield(g, src, pid);
      return;
    case "sacEnd":
      (g.delayed ??= []).push({
        source: src.id,
        controller: pid,
        on: "eachEndStep",
        once: true,
        effects: [{ e: "sac", what: "self" }],
      });
      return;
  }
  if (set === "dsk") {
    yield* dskEffect();
    return;
  }
  switch (action) {
    case "10":
      for (const t of ctx.targets)
        if (t && "c" in t)
          yield* runEffects(g, { ...ctx, targets: [t] }, [
            { e: "pump", what: "T0", p: 0, t: 0, kw: ["indestructible"] },
          ]);
      break;
    case "22":
      batchReturn(
        p.graveyard.filter(
          (id) => isCreature(g.cards[id]) && manaValue(g.cards[id].def) <= 2,
        ),
      );
      break;
    case "27":
    case "63": {
      const x = ev?.type === "dies" ? g.cards[ev.card] : src;
      if (x.zone !== "graveyard" || x.token) break;
      const original = copiableDefinition(x);
      enterBattlefield(g, x, x.owner);
      putCounters(g, x, action === "27" ? 1 : 2);
      x.tlaOriginalDef ??= x.def;
      x.def = {
        ...x.def,
        subtypes: [
          ...(original.subtypes ?? []),
          action === "27" ? "Angel" : "Demon",
        ],
        keywords: [
          ...(x.def.keywords ?? []),
          ...(action === "27" ? ["flying" as const] : []),
        ],
      };
      break;
    }
    case "34": {
      const ids = p.library.slice(0, 5),
        first = yield* pick(ids, "選擇面朝上的牌堆", 0, ids.length),
        second = ids.filter((id) => !first.includes(id)),
        selection = yield* mode(opp, "選擇放入對手手牌的牌堆", [
          "面朝上：" + first.map((id) => g.cards[id].def.name).join("、"),
          "面朝下：" + second.length + "張",
        ]);
      for (const id of ids)
        moveCard(
          g,
          g.cards[id],
          (selection === 0 ? first : second).includes(id)
            ? "hand"
            : "graveyard",
        );
      break;
    }
    case "copySelf":
      yield* token(copiableDefinition(src));
      break;
    case "loyaltyOne":
      src.loyalty = (src.loyalty ?? 0) + 1;
      break;
    case "kaitoEmblem":
      yield* token({
        id: "tok-fdn-kaito-emblem",
        name: "Kaito emblem",
        set: "TOK",
        rarity: "T",
        types: ["Emblem"],
        text: "",
        abilities: [
          {
            kind: "trigger",
            on: "castAny",
            anyPlayer: true,
            effects: [{ e: "token", token: "tok-fdn-ninja" }],
          },
        ],
      });
      break;
    case "54":
      if (c) {
        const def = copiableDefinition(c);
        moveCard(g, c, "exile");
        const [created] = yield* token({
          ...def,
          subtypes: [...(def.subtypes ?? []), "Nightmare"],
        });
        for (const id of own({
          type: "Creature",
          token: true,
          sub: "Nightmare",
        }))
          if (id !== created?.id) moveCard(g, g.cards[id], "exile");
      }
      break;
    case "57":
    case "sacrificeTwo":
      for (const who of [pid, opp]) {
        const n = action === "57" ? 13 : 2,
          ids = g.battlefield.filter(
            (id) => g.cards[id].controller === who && isCreature(g.cards[id]),
          ),
          chosen = yield* pick(
            ids,
            "犧牲生物",
            Math.min(n, ids.length),
            n,
            who,
          );
        for (const id of chosen) sacrifice(g, g.cards[id]);
      }
      break;
    case "60": {
      const top = p.library.slice(0, 3),
        keep = yield* pick(top, "可保留一張牌庫頂", 0);
      for (const id of top)
        if (!keep.includes(id)) moveCard(g, g.cards[id], "graveyard");
      break;
    }
    case "66":
      if (src.zone === "graveyard" && (src.lastCounterKinds?.charge ?? 0) > 0)
        (g.delayed ??= []).push({
          source: src.id,
          controller: src.owner,
          on: "eachEndStep",
          once: true,
          persistent: true,
          effects: [
            fx("familiarReturn", (src.lastCounterKinds?.charge ?? 0) - 1),
          ],
        });
      break;
    case "familiarReturn":
      if (src.zone === "graveyard") {
        const n = ef.n ?? 0;
        enterBattlefield(g, src, pid);
        src.charge =
          n * 2 ** frontierStatic(g, pid, "fdn:doubleCounters").length;
      }
      break;
    case "70": {
      let creature = false;
      for (const t of ctx.targets)
        if (t && "c" in t && g.cards[t.c].zone === "graveyard") {
          creature ||= isCreature(g.cards[t.c]);
          moveCard(g, g.cards[t.c], "exile");
        }
      if (creature) {
        loseLife(g, opp, 2);
        gainLife(g, pid, 2);
      }
      break;
    }
    case "72":
      if (ev?.type === "discard") {
        const x = g.cards[ev.card];
        if (x.zone === "graveyard") {
          moveCard(g, x, "exile");
          (x.frontierMarks ??= {}).stash = 1;
        }
      }
      break;
    case "zombieCast":
      if (c) {
        c.playableBy = pid;
        c.playableTurn = g.turn;
        (c.frontierMarks ??= {}).zombieCast = g.turn;
      }
      break;
    case "81":
      yield* impulse(3, false, true);
      break;
    case "divide8":
      for (let i = 0; i < ctx.targets.length; i++) {
        const t = ctx.targets[i];
        if (t)
          dealDamage(
            g,
            src,
            pid,
            t,
            ctx.distribution?.[i] ?? (i === 0 ? 8 : 0),
          );
      }
      break;
    case "86":
      if (c) {
        c.exileOnDeathTurn = g.turn;
        dealDamage(g, src, pid, { c: c.id }, 5);
        const t = ctx.targets[1];
        if (t && "c" in t && g.cards[t.c].attachedTo === c.id)
          moveCard(g, g.cards[t.c], "exile");
      }
      break;
    case "88":
      if (c) {
        const before = Math.max(0, stats(g, c).t - c.damage),
          n = dealDamage(g, src, pid, { c: c.id }, ctx.x ?? 0);
        yield* token("tok-g-goblin-11-r", Math.max(0, n - before));
      }
      break;
    case "kellan1":
      if (matches(g, { sub: "Scout" }, src, pid)) {
        src.tlaOriginalDef ??= src.def;
        src.def = {
          ...src.def,
          subtypes: ["Human", "Faerie", "Detective"],
          abilities: [
            ...(src.def.abilities ?? []),
            {
              kind: "trigger",
              on: "combatDamagePlayer",
              effects: [fx("impulse1")],
            },
          ],
        };
      }
      break;
    case "kellan2":
      if (matches(g, { sub: "Detective" }, src, pid)) {
        src.tlaOriginalDef ??= src.def;
        src.def = {
          ...src.def,
          subtypes: ["Human", "Faerie", "Rogue"],
          power: 3,
          toughness: 2,
          keywords: [...(src.def.keywords ?? []), "double_strike"],
        };
      }
      break;
    case "96":
      yield* impulse(2, true, true);
      break;
    case "106": {
      const top = p.library.slice(0, 6),
        max = own({ type: "Land" }).length,
        id = (yield* pick(
          top.filter(
            (id) =>
              isCreature(g.cards[id]) && manaValue(g.cards[id].def) <= max,
          ),
          "可放生物進場",
          0,
        ))[0];
      if (id !== undefined) enterBattlefield(g, g.cards[id], pid);
      const rest = top.filter((x) => x !== id);
      shuffleArr(g, rest);
      for (const id of rest) moveCard(g, g.cards[id], "library", true);
      break;
    }
    case "doublePlus":
      putCounters(g, c ?? src, (c ?? src).counters);
      break;
    case "doubleAllTarget":
      if (c)
        for (const [k, n] of Object.entries(counterKinds(c))) {
          if (n <= 0) continue;
          if (k === "+1/+1") putCounters(g, c, n);
          else if (k === "charge") c.charge = (c.charge ?? 0) + n;
          else if (k === "stun") c.stun += n;
          else (c.eclCounters ??= {})[k] = (c.eclCounters?.[k] ?? 0) + n;
        }
      break;
    case "111":
      if (ev?.type === "combatDamageAny") {
        const x = g.cards[ev.source];
        if (x.zone === "battlefield") putCounters(g, x, ev.amount);
      }
      break;
    case "112": {
      const until = p.library.findIndex((id) => isCreature(g.cards[id])),
        ids = p.library.slice(0, until < 0 ? p.library.length : until + 1),
        creature = until < 0 ? undefined : ids.pop();
      if (creature !== undefined) moveCard(g, g.cards[creature], "hand");
      shuffleArr(g, ids);
      for (const id of ids) moveCard(g, g.cards[id], "library", true);
      break;
    }
    case "blinkEnd":
      if (c) yield* blink(c);
      break;
    case "princeBlink":
      if (c) yield* blink(c, pid);
      break;
    case "124":
    case "painfulQuandary": {
      const who = opp,
        choice = yield* mode(who, "支付替代選擇", [
          "失去" + (action === "124" ? 3 : 5) + "生命",
          ...(g.players[who].hand.length ? ["棄一張牌"] : []),
          ...(action === "124" &&
          g.battlefield.some(
            (id) => g.cards[id].controller === who && !isLand(g.cards[id]),
          )
            ? ["犧牲非地永久物"]
            : []),
        ]);
      if (choice === 0) loseLife(g, who, action === "124" ? 3 : 5);
      else if (choice === 1 && g.players[who].hand.length) {
        const id = (yield* pick(g.players[who].hand, "棄一張牌", 1, 1, who))[0];
        discardMany(g, [g.cards[id]]);
      } else {
        const id = (yield* pick(
          g.battlefield.filter(
            (id) => g.cards[id].controller === who && !isLand(g.cards[id]),
          ),
          "犧牲非地永久物",
          1,
          1,
          who,
        ))[0];
        if (id !== undefined) sacrifice(g, g.cards[id]);
      }
      break;
    }
    case "128":
      if ((src.charge ?? 0) > 0) {
        src.charge!--;
        yield* token("tok-fdn-fish");
      }
      break;
    case "fishBait": {
      const pole = g.cards[ef.n ?? -1];
      if (pole)
        pole.charge =
          (pole.charge ?? 0) +
          2 ** frontierStatic(g, pole.controller, "fdn:doubleCounters").length;
      break;
    }
    case "strokeMidnight":
      if (c) {
        const controller = c.controller;
        destroyCards(g, [c]);
        yield* makeEclTokenBatch(g, controller, "tok-woe-human", 1);
      }
      break;
    case "160":
      if (c) {
        const who = c.controller;
        yield* run([{ e: "counter", what: "T0" }]);
        yield* makeEclTokenBatch(g, who, "tok-treasure", 2);
      }
      break;
    case "endTurn":
      for (const item of g.stack.splice(0))
        if (item.kind === "spell" && g.cards[item.cardId].zone === "stack")
          moveCard(g, g.cards[item.cardId], "exile");
      if (src.zone === "stack") moveCard(g, src, "exile");
      g.pending = [];
      g.finEndTurn = true;
      break;
    case "173": {
      const before = g.players[opp].life;
      loseLife(g, opp, ctx.x ?? 0);
      gainLife(g, pid, Math.max(0, before - g.players[opp].life));
      break;
    }
    case "176": {
      const ids = g.battlefield.filter((id) => g.cards[id].controller === opp),
        keep = new Set<number>();
      for (const type of [
        "Artifact",
        "Creature",
        "Enchantment",
        "Planeswalker",
        "Land",
      ]) {
        const options = ids.filter((id) =>
            g.cards[id].def.types.includes(type as any),
          ),
          id = (yield* pick(
            options,
            "保留一個" + type,
            Math.min(1, options.length),
            1,
            opp,
          ))[0];
        if (id !== undefined) keep.add(id);
      }
      for (const id of ids) if (!keep.has(id)) sacrifice(g, g.cards[id]);
      break;
    }
    case "allGraves":
      batchReturn(
        g.players
          .flatMap((pl) => pl.graveyard)
          .filter((id) => isCreature(g.cards[id])),
      );
      break;
    case "194":
      for (const pl of g.players) {
        const x = g.cards[pl.library[0]];
        if (!x) continue;
        moveCard(g, x, "exile");
        if (!isLand(x) && (yield* yes(pid, "可免費施放 " + x.def.name + "？")))
          yield* immediate(x);
      }
      break;
    case "202":
      if (g.players[targetPlayer()].life === 10)
        dealDamage(g, src, pid, { p: targetPlayer() }, 10);
      break;
    case "221": {
      const top = p.library.slice(0, ctx.x ?? 0),
        ids = yield* pick(
          top.filter(
            (id) =>
              !g.cards[id].def.types.some(
                (t) => t === "Instant" || t === "Sorcery",
              ) && manaValue(g.cards[id].def) <= (ctx.x ?? 0),
          ),
          "選任意數量永久物進場",
          0,
          top.length,
        ),
        old = g.frontierEntryBatch;
      g.frontierEntryBatch = g.nextSid++;
      for (const id of ids) enterBattlefield(g, g.cards[id], pid);
      g.frontierEntryBatch = old;
      for (const id of top)
        if (!ids.includes(id)) moveCard(g, g.cards[id], "graveyard");
      break;
    }
    case "226": {
      const ids = own({ type: "Creature", plusCounters: true });
      drawCards(g, pid, ids.length);
      for (const id of ids)
        yield* runEffects(g, { ...ctx, targets: [{ c: id }] }, [
          { e: "pump", what: "T0", p: 0, t: 0, kw: ["indestructible"] },
        ]);
      break;
    }
    case "228":
      src.tlaOriginalDef ??= src.def;
      src.def = { ...src.def, subtypes: ["Werewolf"] };
      putCounters(g, src, 2);
      drawCards(g, pid, 1);
      break;
    case "232":
      if (c) {
        const creature = isCreature(c);
        moveCard(g, c, "exile");
        if (creature) {
          putCounters(g, src, 1);
          gainLife(g, pid, 1);
        }
      }
      break;
    case "vivienEmblem":
      yield* token({
        id: "tok-fdn-vivien-emblem",
        name: "Vivien emblem",
        set: "TOK",
        rarity: "T",
        types: ["Emblem"],
        text: "",
        abilities: [
          {
            kind: "static",
            anthem: {
              filter: { ctrl: "you", type: "Creature" },
              grant: {
                p: 2,
                t: 2,
                kw: ["vigilance", "trample", "indestructible"],
              },
            },
          },
        ],
      });
      break;
    case "238": {
      const ids = g.players[opp].library,
        idx = ids.findIndex((id) => isLand(g.cards[id]));
      for (const id of ids.slice(0, idx < 0 ? ids.length : idx + 1))
        moveCard(g, g.cards[id], "graveyard");
      break;
    }
    case "248":
      for (let i = 1; i < g.players[pid].instSorcThisTurn; i++)
        yield* run([{ e: "copySpell" }]);
      break;
    case "251": {
      const id = (yield* pick(
        p.library.filter((id) =>
          matches(g, { type: "Land", basic: true }, g.cards[id], pid),
        ),
        "可找基本地放牌庫頂",
        0,
      ))[0];
      shuffleArr(g, p.library);
      if (id !== undefined) moveCard(g, g.cards[id], "library");
      break;
    }
    case "517":
      if (c) {
        const zombie = matches(g, { sub: "Zombie" }, c, pid);
        moveCard(g, c, "hand");
        if (zombie) drawCards(g, pid, 1);
      }
      break;
    case "undyingMalice":
      if (c)
        (g.delayed ??= []).push({
          source: c.id,
          controller: c.owner,
          on: "dies",
          once: true,
          effects: [
            {
              e: "reanimate",
              what: "selfAny",
              owner: true,
              tapped: true,
              counters: 1,
            },
          ],
        });
      break;
    case "goblinCombatSac":
      if (c)
        (g.delayed ??= []).push({
          source: c.id,
          controller: c.controller,
          on: "combatDamageAny",
          once: true,
          effects: [{ e: "sac", what: "self" }],
        });
      break;
    case "distributeThenDouble":
      for (let i = 0; i < ctx.targets.length; i++) {
        const t = ctx.targets[i];
        if (t && "c" in t) {
          const x = g.cards[t.c];
          putCounters(g, x, ctx.distribution?.[i] ?? 0);
          putCounters(g, x, x.counters);
        }
      }
      break;
    case "mustBlocked":
      for (const id of own({ type: "Creature" }))
        (g.cards[id].frontierMarks ??= {}).mustBlocked = g.turn;
      break;
    case "589": {
      const n = ctx.x ?? 0;
      if (n >= 10) {
        for (const id of p.graveyard.slice())
          moveCard(g, g.cards[id], "library");
        shuffleArr(g, p.library);
      }
      drawCards(g, pid, n);
      if (n >= 10) {
        const ids = yield* pick(
          own({ type: "Land" }),
          "可重置至多五個地",
          0,
          5,
        );
        for (const id of ids) g.cards[id].tapped = false;
        p.noHandLimit = true;
      }
      moveCard(g, src, "exile");
      break;
    }
    case "595":
      for (const id of g.battlefield.filter(
        (id) =>
          g.cards[id].controller === targetPlayer() && !isLand(g.cards[id]),
      ))
        moveCard(g, g.cards[id], "hand");
      break;
    case "602": {
      const choice = ctx.mode ?? 0;
      if (choice === 0) {
        if (ctx.targets[0]) dealDamage(g, src, pid, ctx.targets[0], 4);
        gainLife(g, pid, 4);
      } else if (choice === 1) yield* run([{ e: "discard", who: "T0", n: 2 }]);
      else if (choice === 2) drawCards(g, pid, 2);
      else p.foundationLost = p.lost = true;
      break;
    }
    case "603": {
      const ids = g.battlefield.filter(
        (id) => g.cards[id].controller === opp && isCreature(g.cards[id]),
      );
      if (ids.length && (yield* yes(opp, "犧牲一個生物橫置惡魔？"))) {
        const id = (yield* pick(ids, "犧牲生物", 1, 1, opp))[0];
        sacrifice(g, g.cards[id]);
        tapCard(g, src);
        putCounters(g, src, 1);
      }
      break;
    }
    case "604": {
      let count = 0;
      for (const pl of g.players)
        for (const id of pl.library.slice(0, ctx.x ?? 0)) {
          const x = g.cards[id];
          moveCard(g, x, "graveyard");
          if (x.zone === "graveyard" && isCreature(x)) count++;
        }
      yield* token("tok-g-zombie-22-b", count, { tapped: true });
      break;
    }
    case "614": {
      const who = targetPlayer(),
        ids = g.battlefield.filter(
          (id) => g.cards[id].controller === who && isCreature(g.cards[id]),
        ),
        id = (yield* pick(ids, "犧牲生物", Math.min(1, ids.length), 1, who))[0];
      if (id !== undefined) {
        const t = stats(g, g.cards[id]).t;
        sacrifice(g, g.cards[id]);
        gainLife(g, pid, t);
      }
      break;
    }
    case "giveTalisman":
      if (src.zone === "battlefield") {
        src.controller = opp;
        src.sick = true;
      }
      break;
    case "621":
      for (const pl of g.players) {
        discardMany(
          g,
          pl.hand.slice().map((id) => g.cards[id]),
        );
        drawCards(g, pl.id, 7);
      }
      break;
    case "625":
      {
        const t = ctx.targets[1];
        if (t && "c" in t) {
          g.cards[t.c].controller = targetPlayer();
          g.cards[t.c].sick = true;
        }
      }
      break;
    case "hoardDragon": {
      const id = (yield* pick(
        p.library.filter((id) => g.cards[id].def.types.includes("Artifact")),
        "可放逐神器",
        0,
      ))[0];
      if (id !== undefined) {
        moveCard(g, g.cards[id], "exile");
        (g.cards[id].frontierMarks ??= {}).hoardLink =
          ctx.sourceLinkKey ?? src.tmtLinkKey ?? src.id;
      }
      shuffleArr(g, p.library);
      break;
    }
    case "hoardReturn":
      for (const x of Object.values(g.cards))
        if (
          x.zone === "exile" &&
          x.frontierMarks?.hoardLink ===
            (ctx.sourceLinkKey ?? src.tmtLinkKey ?? src.id) &&
          (yield* yes(pid, "將放逐神器放入手牌？"))
        )
          moveCard(g, x, "hand");
      break;
    case "641": {
      const x = g.cards[src.attachedTo ?? -1];
      if (x) {
        putCounters(g, x, 1);
        if (x.counters >= 3) sacrifice(g, src);
      }
      break;
    }
    case "648": {
      const flags = frontierFlags(g, pid),
        key = "venom" + src.id;
      flags[key] = (flags[key] ?? 0) + 1;
      yield* run([
        {
          e: "pump",
          what:
            flags[key] === 2
              ? { all: { ctrl: "you", type: "Creature" } }
              : "self",
          p: 0,
          t: 0,
          kw: ["deathtouch"],
        },
      ]);
      break;
    }
    case "650": {
      let max = 0;
      while (max < 100 && canPayCost(g, pid, parseCost("{" + (max + 1) + "}")))
        max++;
      const n = yield* mode(
        pid,
        "可支付X放指示物",
        Array.from({ length: max + 1 }, (_, i) => String(i)),
      );
      if (payCost(g, pid, parseCost("{" + n + "}"))) putCounters(g, src, n);
      break;
    }
    case "sacToughLife":
      gainLife(
        g,
        pid,
        ctx.sacToughness ?? src.frontierMarks?.sacToughness ?? 0,
      );
      break;
    case "654": {
      let youSac: number | undefined;
      for (const who of [pid, opp]) {
        const ids = g.battlefield.filter(
            (id) =>
              g.cards[id].controller === who &&
              g.cards[id].def.types.some(
                (t) => t === "Creature" || t === "Planeswalker",
              ),
          ),
          id = (yield* pick(
            ids,
            "犧牲生物或鵬洛客",
            Math.min(1, ids.length),
            1,
            who,
          ))[0];
        if (id !== undefined) {
          sacrifice(g, g.cards[id]);
          if (who === pid) youSac = id;
        }
      }
      if (youSac !== undefined) {
        const id = (yield* pick(
          p.graveyard.filter(
            (id) =>
              id !== youSac &&
              !g.cards[id].def.types.some(
                (t) => t === "Instant" || t === "Sorcery",
              ),
          ),
          "可回手另一永久物",
          0,
        ))[0];
        if (id !== undefined) moveCard(g, g.cards[id], "hand");
      }
      break;
    }
    case "658":
      if (ev?.type === "dies") {
        if (ev.wasAttacking) drawCards(g, pid, 1);
        else dealDamage(g, src, pid, { p: opp }, 1);
      }
      break;
    case "661":
      if (c) {
        const name = c.def.name;
        destroyCards(
          g,
          g.battlefield
            .map((id) => g.cards[id])
            .filter((x) => !isLand(x) && x.def.name === name),
        );
      }
      break;
    case "663":
      if (ev?.type === "cast") {
        const x = g.cards[ev.card],
          n =
            manaValue(x.castFace ?? x.def) +
            (g.stack.find((s) => s.cardId === x.id && s.kind === "spell")?.x ??
              0);
        const goblins = yield* token("tok-fdn-phyrexian-goblin", n, {});
        for (const goblin of goblins)
          g.eot.push({ card: goblin.id, p: 0, t: 0, kw: ["haste"] });
      }
      break;
    case "ventmawMana":
      for (const mana of ["R", "R", "R", "G", "G", "G"] as const)
        (p.foundationPool ??= []).push({ mana, rule: "any", keepTurn: g.turn });
      break;
    case "liegeDiscard":
      if (src.zone === "graveyard") enterBattlefield(g, src, pid);
      break;
    case "shuffleGrave":
      for (const id of p.graveyard.slice()) moveCard(g, g.cards[id], "library");
      shuffleArr(g, p.library);
      break;
    case "tomeCheck":
      if ((src.charge ?? 0) >= 4) {
        moveCard(g, src, "exile");
        gainLife(g, pid, 4);
      }
      break;
    case "hellkiteHit":
      (src.frontierMarks ??= {}).hellkiteHit = g.turn;
      break;
    case "681":
      if (src.frontierMarks?.hellkiteHit === g.turn)
        destroyCards(
          g,
          g.battlefield
            .map((id) => g.cards[id])
            .filter(
              (x) =>
                x.controller !== pid &&
                !isLand(x) &&
                manaValue(x.def) === (ctx.x ?? 0),
            ),
        );
      break;
    case "687":
      if (c) {
        const who = c.controller;
        destroyCards(g, [c]);
        for (const player of [who, pid]) {
          const list = g.players[player].library.filter((id) =>
              matches(g, { type: "Land", basic: true }, g.cards[id], player),
            ),
            id = (yield* pick(list, "可找基本地進場", 0, 1, player))[0];
          if (id !== undefined) enterBattlefield(g, g.cards[id], player);
          shuffleArr(g, g.players[player].library);
        }
      }
      break;
    case "711":
      if (c) yield* token(copiableDefinition(c), src.kicked ? 5 : 1);
      break;
    case "712":
      if (c) {
        const n = manaValue(c.def);
        destroyCards(g, [c]);
        loseLife(g, pid, n);
      }
      break;
    case "lotusMana": {
      const i = yield* mode(pid, "選擇三點同色法力", ["W", "U", "B", "R", "G"]);
      (p.pool ??= []).push(...Array(3).fill(["W", "U", "B", "R", "G"][i]));
      break;
    }
    case "727":
      moveCard(g, src, "hand");
      {
        const id = (yield* pick(
          p.library.filter((id) =>
            matches(g, { type: "Land", sub: "Gate" }, g.cards[id], pid),
          ),
          "找門進場",
          0,
        ))[0];
        if (id !== undefined) enterBattlefield(g, g.cards[id], pid);
        shuffleArr(g, p.library);
        if (
          new Set(
            own({ type: "Land", sub: "Gate" }).map(
              (id) => g.cards[id].def.name,
            ),
          ).size >= 10
        )
          g.winner = pid;
      }
      break;
    default:
      throw Error("Unknown FDN effect " + action);
  }
  function* dskEffect(): SubFlow {
    const specRoom = () => ({
      kind: "permanent" as const,
      filter: { sub: "Room" },
    });
    const manifest = function* (counters = 0): SubFlow<Card | undefined> {
      const local = { ...ctx };
      yield* runEffects(g, local, [{ e: "manifestDread" }]);
      const x =
        local.created === undefined ? undefined : g.cards[local.created];
      if (x && counters) putCounters(g, x, counters);
      return x;
    };
    const unlock = function* (room?: Card, lockAllowed = false): SubFlow {
      let x = room;
      if (!x) {
        const id = (yield* pick(own({ sub: "Room" }), "選擇房間", 0))[0];
        if (id !== undefined) x = g.cards[id];
      }
      if (!x?.def.room) return;
      const choices = ([0, 1] as const).filter(
        (i) => lockAllowed || !((x!.roomUnlocked ?? 0) & (1 << i)),
      );
      if (!choices.length) return;
      const i =
        choices[
          yield* mode(
            pid,
            "選擇門",
            choices.map(
              (i) =>
                (i === 0 ? x!.def.room!.left : x!.def.room!.right).name +
                ((x!.roomUnlocked ?? 0) & (1 << i) ? "（鎖定）" : "（解鎖）"),
            ),
          )
        ];
      changeDoor(g, x, i, !((x.roomUnlocked ?? 0) & (1 << i)));
    };
    switch (action) {
      case "enduring":
        if (src.zone === "graveyard" && !src.token) {
          const def = copiableDefinition(src);
          enterBattlefield(g, src, src.owner, false, {
            ...def,
            types: ["Enchantment"],
            subtypes: [],
          });
          delete src.copyLayer;
        }
        break;
      case "flyingCounter":
        (src.eclCounters ??= {}).flying = (src.eclCounters?.flying ?? 0) + 1;
        break;
      case "abduction":
        if (
          c &&
          src.zone === "battlefield" &&
          (ctx.sourceLinkKey === undefined ||
            ctx.sourceLinkKey === src.tmtLinkKey)
        ) {
          const key = ((src.frontierMarks ??= {}).abductionKey ??=
            ctx.sourceLinkKey ?? src.tmtLinkKey ?? src.id);
          moveCard(g, c, "exile");
          (c.frontierMarks ??= {}).abductionLink = key;
        }
        break;
      case "abductionReturn": {
        const key =
          ev?.type === "leaves"
            ? ev.foundationMarks?.abductionKey
            : src.frontierMarks?.abductionKey;
        for (const x of Object.values(g.cards))
          if (
            x.zone === "exile" &&
            x.frontierMarks?.abductionLink === key &&
            key !== undefined
          )
            moveCard(g, x, "hand");
        break;
      }
      case "13": {
        const choices = ["回手結界", "解鎖房間"],
          m = yield* mode(pid, "選擇效果", choices);
        if (m === 1) yield* unlock();
        else {
          const id = (yield* pick(
            p.graveyard.filter((id) =>
              g.cards[id].def.types.includes("Enchantment"),
            ),
            "回手結界",
            0,
          ))[0];
          if (id !== undefined) moveCard(g, g.cards[id], "hand");
        }
        break;
      }
      case "horrorEnchantment":
      case "goatDemon":
        {
          const x = action === "goatDemon" ? src : c;
          if (x) {
            x.tlaOriginalDef ??= x.def;
            const old = x.def;
            x.def = {
              ...old,
              types: [
                ...new Set([
                  ...old.types,
                  ...(action === "horrorEnchantment"
                    ? ["Enchantment" as const, "Creature" as const]
                    : []),
                ]),
              ],
              subtypes: [
                ...(old.subtypes ?? []),
                action === "goatDemon" ? "Demon" : "Horror",
              ],
              ...(action === "goatDemon"
                ? { colors: [...new Set([...colorsOf(old), "B" as const])] }
                : {}),
            };
            if (action === "horrorEnchantment")
              (x.frontierMarks ??= {}).typeUntil = g.turn;
          }
        }
        break;
      case "22": {
        const ids = yield* pick(
          own().filter((id) => !g.cards[id].tapped && isCreature(g.cards[id])),
          "可橫置任意數量生物",
          0,
          g.battlefield.length,
        );
        for (const id of ids) tapCard(g, g.cards[id]);
        yield* run([{ e: "pump", what: "self", p: ids.length, t: ids.length }]);
        break;
      }
      case "chooseCounter": {
        const i = yield* mode(pid, "選擇指示物", ["飛行", "繫命", "+1/+1"]);
        if (i === 2) putCounters(g, src, 1);
        else {
          const key = i === 0 ? "flying" : "lifelink";
          (src.eclCounters ??= {})[key] = (src.eclCounters?.[key] ?? 0) + 1;
        }
        break;
      }
      case "26":
        if (c && ev?.type === "dies") {
          const x = g.cards[ev.card],
            kinds = x.lastCounterKinds;
          if (kinds)
            for (const [k, n] of Object.entries(kinds)) {
              const v = Number(n);
              if (v <= 0) continue;
              if (k === "plus") putCounters(g, c, v);
              else if (k === "stun") c.stun += v;
              else if (k === "charge") c.charge = (c.charge ?? 0) + v;
              else (c.eclCounters ??= {})[k] = (c.eclCounters?.[k] ?? 0) + v;
            }
          for (const [k, n] of Object.entries(x.eclCounters ?? {}))
            if (n > 0)
              (c.eclCounters ??= {})[k] = (c.eclCounters?.[k] ?? 0) + n;
        }
        break;
      case "hovershipExile":
      case "survivorExile":
      case "vacuumExile":
        if (c) {
          const owner = c.owner;
          moveCard(g, c, "exile");
          (c.frontierMarks ??= {})[
            action === "hovershipExile"
              ? "hoverLink"
              : action === "survivorExile"
                ? "survivorLink"
                : "vacuumLink"
          ] = ctx.sourceLinkKey ?? src.tmtLinkKey ?? src.id;
          if (action === "hovershipExile")
            (src.frontierMarks ??= {}).hoverOwner = owner;
        }
        break;
      case "hovershipManifest": {
        const who = (
          ev?.type === "leaves"
            ? ev.foundationMarks?.hoverOwner
            : src.frontierMarks?.hoverOwner
        ) as PID | undefined;
        if (who !== undefined)
          yield* runEffects(g, { ...ctx, controller: who }, [
            { e: "manifestDread" },
          ]);
        break;
      }
      case "39":
        if (c) {
          const who = c.controller;
          destroyCards(g, [c]);
          yield* runEffects(g, { ...ctx, controller: who }, [
            { e: "manifestDread" },
          ]);
        }
        break;
      case "47": {
        const x = yield* manifest();
        if (x) {
          src.attachedTo = x.id;
          emit(g, {
            type: "frontier",
            action: "attached",
            card: src.id,
            player: pid,
            other: x.id,
            amount: 0,
          });
        }
        break;
      }
      case "counterSurveil":
      case "counterManifest":
        if (c) {
          const who = c.controller;
          if (action === "counterManifest") {
            yield* run([{ e: "counter", what: "T0" }]);
            yield* runEffects(g, { ...ctx, controller: who }, [
              { e: "manifestDread" },
            ]);
          } else if (
            canPayCost(g, who, parseCost("{2}")) &&
            (yield* yes(who, "支付{2}避免反擊？"))
          ) {
            payCost(g, who, parseCost("{2}"));
            yield* run([{ e: "surveil", n: 2 }]);
          } else yield* run([{ e: "counter", what: "T0" }]);
        }
        break;
      case "59":
        if (c) {
          for (const x of [src, c]) {
            moveCard(g, x, "library");
            shuffleArr(g, g.players[x.owner].library);
          }
        }
        break;
      case "unlockTarget":
        yield* unlock(c);
        break;
      case "lockUnlock":
        yield* unlock(c, true);
        break;
      case "tutorRoom": {
        const controlled = own({ sub: "Room" }).flatMap((id) =>
            g.cards[id].def.name.split(" // "),
          ),
          id = (yield* pick(
            p.library.filter(
              (id) =>
                g.cards[id].def.room &&
                !g.cards[id].def.name
                  .split(" // ")
                  .some((n) => controlled.includes(n)),
            ),
            "尋找不同名房間",
            0,
          ))[0];
        if (id !== undefined) moveCard(g, g.cards[id], "hand");
        shuffleArr(g, p.library);
        break;
      }
      case "eightDoorsWin": {
        const names = new Set(
          own({ sub: "Room" }).flatMap((id) => {
            const x = g.cards[id];
            return [x.def.room!.left, x.def.room!.right].flatMap((d, i) =>
              (x.roomUnlocked ?? 0) & (1 << i) ? [d.name] : [],
            );
          }),
        );
        if (names.size >= 8) g.winner = pid;
        break;
      }
      case "64": {
        const n = ev && "amount" in ev ? (ev.amount??0) : 0,
          ids = yield* pick(
            p.hand,
            "因失去生命棄牌",
            Math.min(n, p.hand.length),
            n,
          );
        discardMany(
          g,
          ids.map((id) => g.cards[id]),
        );
        if (!p.hand.length) p.foundationLost = p.lost = true;
        break;
      }
      case "manifestGraveReturn":
        if (ev?.type === "frontier" && ev.other !== undefined) {
          const x = g.cards[ev.other];
          if (x?.zone === "graveyard") moveCard(g, x, "hand");
        }
        break;
      case "72": {
        const m = ctx.mode ?? 0;
        if (m === 0) putCounters(g, src, 2);
        else if (m === 1) drawCards(g, pid, 1);
        else if (c) {
          src.tlaOriginalDef ??= src.def;
          src.def = copiableDefinition(c);
          src.copyLayer = src.def;
        }
        break;
      }
      case "74": {
        const x = g.cards[src.attachedTo ?? -1];
        if (x) {
          const who = x.owner;
          moveCard(g, x, "library");
          shuffleArr(g, g.players[who].library);
        }
        yield* manifest();
        break;
      }
      case "tamiyoMill":
        for (let i = 0; i < 100; i++) {
          const ids = p.library.slice(0, 2);
          for (const id of ids) moveCard(g, g.cards[id], "graveyard");
          if (
            ids.length < 2 ||
            !g.cards[ids[0]].def.types.some((t) =>
              g.cards[ids[1]].def.types.includes(t),
            )
          )
            break;
          drawCards(g, pid, 1);
        }
        break;
      case "tamiyoCopies": {
        const ids = yield* pick(
          p.graveyard.filter(
            (id) =>
              g.cards[id].def.types.some(
                (t) => t === "Instant" || t === "Sorcery",
              ) ||
              (g.cards[id].def.types.includes("Planeswalker") &&
                g.cards[id].def.subtypes?.includes("Tamiyo")),
          ),
          "放逐並複製任意數量咒語",
          0,
          p.graveyard.length,
        );
        for (const id of ids) {
          const x = g.cards[id],
            def = copiableDefinition(x);
          moveCard(g, x, "exile");
          const cp = newCard(g, def, pid, true);
          cp.zone = "exile";
          p.exile.push(cp.id);
          if (yield* yes(pid, "支付費用施放複製？"))
            yield* immediate(cp, false);
          if (cp.zone === "exile") {
            p.exile = p.exile.filter((id) => id !== cp.id);
            cp.tokenDeparted = true;
          }
        }
        break;
      }
      case "manifestCounter":
        yield* manifest(1);
        break;
      case "manifestThree":
        yield* manifest(3);
        break;
      case "81": {
        const n = Object.values(src.lastCounterKinds ?? {}).reduce<number>(
          (a, n) => a + Number(n),
          0,
        );
        yield* token({
          id: "tok-dsk-spirit-x",
          name: "Spirit",
          set: "TOK",
          rarity: "T",
          types: ["Creature"],
          subtypes: ["Spirit"],
          colors: ["U"],
          power: n,
          toughness: n,
          keywords: ["flying"],
          text: "",
        });
        break;
      }
      case "86":
        if (c) {
          destroyCards(g, [c]);
          if (c.zone === "graveyard" && !c.token && isCreature(c)) {
            enterBattlefield(g, c, pid);
            (g.delayed ??= []).push({
              source: c.id,
              controller: pid,
              on: "endStep",
              once: true,
              effects: [{ e: "sac", what: "self" }],
            });
          }
        }
        break;
      case "94":
        for (const player of g.players)
          for (const id of player.library.slice(
            0,
            Math.max(0, player.library.length - 6),
          )) {
            moveCard(g, g.cards[id], "exile");
            g.cards[id].hiddenExile = true;
          }
        break;
      case "96": {
        let ownDiscard = false;
        for (const player of g.players) {
          const id = (yield* pick(
            player.hand,
            "棄一張牌",
            Math.min(1, player.hand.length),
            1,
            player.id,
          ))[0];
          if (id !== undefined) {
            if (player.id === pid) ownDiscard = true;
            discardMany(g, [g.cards[id]]);
          }
        }
        if (ownDiscard) drawCards(g, pid, 1);
        break;
      }
      case "halfLife": {
        const who =
          src.attachedToPlayer ??
          (ev?.type === "combatDamage" ? ev.player : opp);
        loseLife(g, who, Math.ceil(g.players[who].life / 2));
        break;
      }
      case "meathookSac":
        for (const player of g.players) {
          const ids = g.battlefield.filter(
              (id) =>
                g.cards[id].controller === player.id && isCreature(g.cards[id]),
            ),
            chosen = yield* pick(
              ids,
              "犧牲X生物",
              Math.min(ctx.x ?? 0, ids.length),
              ctx.x ?? 0,
              player.id,
            );
          for (const id of chosen) sacrifice(g, g.cards[id]);
        }
        break;
      case "meathookOwn":
      case "meathookOpponent":
        if (ev?.type === "dies") {
          const x = g.cards[ev.card],
            who = action === "meathookOwn" ? pid : opp,
            paid =
              frontierCanPayLife(g, who, 3) && (yield* yes(who, "支付3生命？"));
          if (paid) frontierPayLife(g, who, 3);
          if (
            (action === "meathookOwn" ? paid : !paid) &&
            x.zone === "graveyard" &&
            !x.token
          ) {
            x.finMarks = { ...x.finMarks, enterFinality: 1 };
            enterBattlefield(g, x, pid);
          }
        }
        break;
      case "109": {
        const ids = yield* pick(p.hand, "可棄任意數量牌", 0, p.hand.length);
        discardMany(
          g,
          ids.map((id) => g.cards[id]),
        );
        if (ids.length)
          yield* run([
            {
              e: "reflexive",
              targets: Array.from({ length: ids.length }, () => ({
                ...{ kind: "creature" as const },
                optional: true,
              })),
              effects: Array.from({ length: ids.length }, (_, i) => ({
                e: "pump" as const,
                what: ("T" + i) as any,
                p: -2,
                t: -2,
              })),
            },
          ]);
        break;
      }
      case "112": {
        const choices = [
            "承受傷害",
            ...(g.players[opp].hand.length ? ["棄一張牌"] : []),
            ...(g.battlefield.some(
              (id) => g.cards[id].controller === opp && !isLand(g.cards[id]),
            )
              ? ["犧牲非地永久物"]
              : []),
          ],
          i = yield* mode(opp, "選擇", choices);
        if (i === 0) dealDamage(g, src, pid, { p: opp }, stats(g, src).p);
        else if (choices[i] === "棄一張牌") {
          const id = (yield* pick(g.players[opp].hand, "棄牌", 1, 1, opp))[0];
          discardMany(g, [g.cards[id]]);
        } else {
          const id = (yield* pick(
            g.battlefield.filter(
              (id) => g.cards[id].controller === opp && !isLand(g.cards[id]),
            ),
            "犧牲非地永久物",
            1,
            1,
            opp,
          ))[0];
          if (id !== undefined) sacrifice(g, g.cards[id]);
        }
        break;
      }
      case "113": {
        const id = (yield* pick(
          p.graveyard.filter(
            (id) =>
              g.cards[id].def.types.includes("Planeswalker") ||
              (isCreature(g.cards[id]) &&
                !matches(g, { sub: "Avatar" }, g.cards[id], pid)),
          ),
          "可回手非化身生物或鵬洛客",
          0,
        ))[0];
        if (id !== undefined) moveCard(g, g.cards[id], "hand");
        break;
      }
      case "117": {
        const who = targetPlayer(),
          ids = g.battlefield.filter(
            (id) =>
              g.cards[id].controller === who &&
              isCreature(g.cards[id]) &&
              id !== src.attachedTo,
          ),
          id = (yield* pick(
            ids,
            "犧牲另一生物",
            Math.min(1, ids.length),
            1,
            who,
          ))[0];
        if (id !== undefined) sacrifice(g, g.cards[id]);
        break;
      }
      case "119":
        if (
          src.zone === "graveyard" &&
          Object.values(src.lastCounterKinds ?? {}).every((n) => !n)
        ) {
          enterBattlefield(g, src, src.owner, true);
          src.stun = 2;
        }
        break;
      case "aloneDeathtouch":
        if (ev?.type === "youAttack" && ev.attackers.length === 1)
          yield* runEffects(g, { ...ctx, targets: [{ c: ev.attackers[0] }] }, [
            { e: "pump", what: "T0", p: 1, t: 0, kw: ["deathtouch"] },
          ]);
        break;
      case "131":
        src.charge = (src.charge ?? 0) + 1;
        if (src.charge >= 7) {
          src.charge = 0;
          dealDamage(g, src, pid, { p: pid }, 20);
        }
        break;
      case "145":
        if (
          ev?.type === "mkm" &&
          ev.action === "blocked" &&
          (yield* yes(pid, "放逐攻擊生物並可於本回合使用？"))
        ) {
          const x = g.cards[ev.card];
          if (x.zone === "battlefield") {
            moveCard(g, x, "exile");
            x.playableBy = pid;
            x.playableUntil = g.turn;
          }
        }
        break;
      case "155":
        for (const t of ctx.targets)
          if (t && "c" in t)
            dealDamage(g, src, pid, t, ctx.x ?? src.castX ?? 0);
        break;
      case "157": {
        const t = ctx.targets[0];
        if (t) {
          const n = ev?.type === "damaged" ? (ev.amount??0) : 0,
            dealt = dealDamage(g, src, pid, t, n);
          if ("p" in t && dealt > 0) g.players[t.p].foundationNoLifeGain = true;
        }
        break;
      }
      case "159": {
        const ts = ctx.targets.flatMap((t) =>
          t && "c" in t ? [g.cards[t.c]] : [],
        );
        if (ts.length !== 2) break;
        const i = yield* mode(
          ts[0].controller,
          "選擇承受5傷害的生物",
          ts.map((c) => c.def.name),
        );
        dealDamage(g, src, pid, { c: ts[i].id }, 5);
        yield* runEffects(g, { ...ctx, targets: [{ c: ts[1 - i].id }] }, [
          { e: "grant", what: "T0", grant: { cantBlock: true } },
        ]);
        break;
      }
      case "dieManifest":
        if (c)
          (g.delayed ??= []).push({
            source: c.id,
            controller: pid,
            on: "dies",
            once: true,
            effects: [{ e: "manifestDread" }],
          });
        break;
      case "165":
        if (c) {
          (g.delayed ??= []).push({
            source: src.id,
            controller: pid,
            on: "frontierEvent",
            frontierEvent: "fdn:nontokenDeathAny",
            once: false,
            effects: [fx("impulseNext")],
          });
          for (const id of g.battlefield.slice())
            if (id !== c.id && isCreature(g.cards[id]))
              dealDamage(g, c, pid, { c: id }, stats(g, c).p);
        }
        break;
      case "167": {
        const options = [
            "不支付",
            ...(p.hand.length ? ["棄一張牌"] : []),
            ...(canPayCost(g, pid, parseCost("{2}")) ? ["支付{2}"] : []),
          ],
          i = yield* mode(pid, "可支付費用消滅房間", options);
        if (i === 0) break;
        if (options[i] === "棄一張牌") {
          const id = (yield* pick(p.hand, "棄一張牌", 1))[0];
          discardMany(g, [g.cards[id]]);
        } else payCost(g, pid, parseCost("{2}"));
        yield* run([
          {
            e: "reflexive",
            targets: [specRoom()],
            effects: [{ e: "destroy", what: "T0" }],
          },
        ]);
        break;
      }
      case "171": {
        if (c) {
          const who = c.owner;
          moveCard(g, c, "library");
          shuffleArr(g, g.players[who].library);
        }
        for (const t of ctx.targets.slice(1))
          if (t && "c" in t && g.cards[t.c].zone === "graveyard")
            moveCard(g, g.cards[t.c], "library");
        shuffleArr(g, p.library);
        break;
      }
      case "173": {
        const victims = ctx.targets[2];
        if (victims && "c" in victims)
          for (const t of ctx.targets.slice(0, 2))
            if (t && "c" in t) {
              const x = g.cards[t.c];
              tapCard(g, x);
              dealDamage(g, x, pid, victims, stats(g, x).p);
            }
        break;
      }
      case "181": {
        const top = p.library.slice(0, 4);
        for (const id of top) moveCard(g, g.cards[id], "graveyard");
        const ids = yield* pick(
          top.filter(
            (id) =>
              g.cards[id].zone === "graveyard" &&
              !g.cards[id].def.types.some(
                (t) => t === "Instant" || t === "Sorcery",
              ),
          ),
          "回手至多兩個永久物",
          0,
          2,
        );
        for (const id of ids) moveCard(g, g.cards[id], "hand");
        break;
      }
      case "revealFaceUp":
        if (
          c?.hidden?.types.includes("Creature") &&
          (yield* yes(pid, "將生物牌翻正面？"))
        )
          turnFaceUp(g, c);
        break;
      case "milledLandReturn":
        if (
          ev?.type === "fin" &&
          ev.action === "zoneMove" &&
          ev.card !== undefined &&
          g.cards[ev.card].zone === "graveyard"
        )
          enterBattlefield(g, g.cards[ev.card], pid, true);
        break;
      case "revealLand": {
        const i = p.library.findIndex((id) => isLand(g.cards[id])),
          ids = p.library.slice(0, i < 0 ? p.library.length : i + 1),
          land = i < 0 ? undefined : ids.pop();
        if (land !== undefined) moveCard(g, g.cards[land], "hand");
        shuffleArr(g, ids);
        for (const id of ids) moveCard(g, g.cards[id], "library", true);
        break;
      }
      case "landHandTapped": {
        const id = (yield* pick(
          p.hand.filter((id) => isLand(g.cards[id])),
          "可放地進場",
          0,
        ))[0];
        if (id !== undefined) enterBattlefield(g, g.cards[id], pid, true);
        break;
      }
      case "handPermanent": {
        const id = (yield* pick(
          p.hand.filter(
            (id) =>
              !g.cards[id].def.types.some(
                (t) => t === "Instant" || t === "Sorcery",
              ),
          ),
          "可放永久物進場",
          0,
        ))[0];
        if (id !== undefined) enterBattlefield(g, g.cards[id], pid);
        break;
      }
      case "192":
        for (let i = 0; i < ctx.targets.length; i++) {
          const t = ctx.targets[i];
          if (t && "c" in t) {
            putCounters(
              g,
              g.cards[t.c],
              ctx.distribution?.[i] ?? (i === 0 ? 2 : 0),
            );
            if (graveTypes(g, pid) >= 6)
              putCounters(g, g.cards[t.c], g.cards[t.c].counters);
          }
        }
        break;
      case "returnCreatureLand":
      case "returnPermanent": {
        const id = (yield* pick(
          p.graveyard.filter((id) =>
            action === "returnCreatureLand"
              ? isCreature(g.cards[id]) || isLand(g.cards[id])
              : !g.cards[id].def.types.some(
                  (t) => t === "Instant" || t === "Sorcery",
                ),
          ),
          "可回手一張牌",
          0,
        ))[0];
        if (id !== undefined) moveCard(g, g.cards[id], "hand");
        break;
      }
      case "197": {
        const id = (yield* pick(
          [...p.hand, ...p.graveyard, ...p.library].filter(
            (id) => g.cards[id].def.id === "altanak-the-thrice-called",
          ),
          "找Altanak進場",
          0,
        ))[0];
        if (id !== undefined) enterBattlefield(g, g.cards[id], pid);
        shuffleArr(g, p.library);
        break;
      }
      case "204": {
        const ids: Card[] = [];
        for (let i = 0; i < (ctx.x ?? 0); i++) {
          const x = yield* manifest();
          if (x) ids.push(x);
        }
        for (const x of ids) putCounters(g, x, ctx.x ?? 0);
        break;
      }
      case "graveCastTurn":
        frontierFlags(g, pid).graveAll = 1;
        break;
      case "207": {
        const x = g.cards[p.library[0]];
        if (x) {
          if (isLand(x) && (yield* yes(pid, "放地進場？")))
            enterBattlefield(g, x, pid);
          else moveCard(g, x, "hand");
        }
        break;
      }
      case "219":
        if (c) {
          const def = copiableDefinition(c),
            [t] = yield* token({
              ...def,
              types: [...new Set([...def.types, "Creature" as const])],
              subtypes: [...(def.subtypes ?? []), "Balloon"],
              colors: [...new Set([...colorsOf(def), "R" as const])],
              power: 1,
              toughness: 1,
              keywords: [...(def.keywords ?? []), "flying", "haste"],
            });
          if (t)
            (g.delayed ??= []).push({
              source: t.id,
              controller: pid,
              on: "eachEndStep",
              once: true,
              effects: [{ e: "sac", what: "self" }],
            });
        }
        break;
      case "ninjaEmblem":
        yield* token({
          id: "tok-dsk-ninja-emblem",
          name: "Kaito emblem",
          set: "TOK",
          rarity: "T",
          types: ["Emblem"],
          text: "",
          abilities: [
            {
              kind: "static",
              anthem: {
                filter: { ctrl: "you", type: "Creature", sub: "Ninja" },
                grant: { p: 1, t: 1 },
              },
            },
          ],
        });
        break;
      case "ninjutsuEnter":
        if (src.zone === "hand") {
          const attackTarget = src.frontierMarks?.ninjaTarget ?? -1;
          enterBattlefield(g, src, pid, true);
          src.attacking = true;
          src.attackTarget = attackTarget >= 0 ? attackTarget : null;
        }
        break;
      case "223": {
        const top = p.library.slice(
          0,
          ev?.type === "combatDamage" ? (ev.amount??0) : 0,
        );
        for (const id of top) moveCard(g, g.cards[id], "graveyard");
        const ids = yield* pick(
          top.filter(
            (id) =>
              g.cards[id].zone === "graveyard" &&
              (g.cards[id].def.types.includes("Enchantment") ||
                g.cards[id].def.supertypes?.includes("Legendary")),
          ),
          "可回手傳奇或結界",
          0,
          top.length,
        );
        for (const id of ids) moveCard(g, g.cards[id], "hand");
        if (!ids.length) putCounters(g, src, 1);
        break;
      }
      case "224":
        if (c) {
          const def = copiableDefinition(c);
          yield* blink(c);
          for (const id of own({ sub: "Shard" })) {
            const x = g.cards[id];
            x.tlaOriginalDef ??= x.def;
            x.def = def;
            x.copyLayer = def;
            (g.delayed ??= []).push({
              source: x.id,
              controller: pid,
              on: "eachEndStep",
              once: true,
              effects: [fx("restoreShard")],
            });
          }
        }
        break;
      case "restoreShard":
        if (src.tlaOriginalDef) {
          src.def = src.tlaOriginalDef;
          src.tlaOriginalDef = undefined;
          src.copyLayer = undefined;
        }
        break;
      case "225":
        if (yield* yes(pid, "抽一張牌？")) {
          drawCards(g, pid, 1);
          if (!frontierFlags(g, pid).faceEvent) {
            const id = (yield* pick(
              p.hand,
              "棄一張牌",
              Math.min(1, p.hand.length),
            ))[0];
            if (id !== undefined) discardMany(g, [g.cards[id]]);
          }
        }
        break;
      case "228": {
        const top = p.library.slice(0, Math.max(0, stats(g, src).p)),
          valid = top.filter(
            (id) =>
              g.cards[id].def.types.includes("Creature") ||
              g.cards[id].def.subtypes?.includes("Vehicle"),
          ),
          chosen: number[] = [],
          powers = new Set<number>();
        while (valid.some((id) => !powers.has(g.cards[id].def.power ?? 0))) {
          const id = (yield* pick(
            valid.filter((id) => !powers.has(g.cards[id].def.power ?? 0)),
            "可拿不同力量生物／載具",
            0,
          ))[0];
          if (id === undefined) break;
          chosen.push(id);
          powers.add(g.cards[id].def.power ?? 0);
        }
        for (const id of chosen) moveCard(g, g.cards[id], "hand");
        const rest = top.filter((id) => !chosen.includes(id));
        shuffleArr(g, rest);
        for (const id of rest) moveCard(g, g.cards[id], "library", true);
        break;
      }
      case "238": {
        const f = frontierFlags(g, pid),
          key = "victor" + src.id,
          n = (f[key] ?? 0) + 1;
        f[key] = n;
        if (n === 1) yield* run([{ e: "surveil", n: 2 }]);
        else if (n === 2) yield* run([{ e: "discard", who: "opp", n: 1 }]);
        else if (n === 3) {
          const ids = g.players
              .flatMap((pl) => pl.graveyard)
              .filter((id) => isCreature(g.cards[id])),
            id = (yield* pick(ids, "可返場生物", 0))[0];
          if (id !== undefined) enterBattlefield(g, g.cards[id], pid);
        }
        break;
      }
      case "roomMana":
        for (let i = 0; i < 2; i++)
          (p.foundationPool ??= []).push({ mana: "R", rule: "room" });
        break;
      case "doorSpirit": {
        const n = doorCount(g, pid);
        yield* token({
          id: "tok-dsk-spirit-x",
          name: "Spirit",
          set: "TOK",
          rarity: "T",
          types: ["Creature"],
          subtypes: ["Spirit"],
          colors: ["U"],
          power: n,
          toughness: n,
          keywords: ["flying"],
          text: "",
        });
        break;
      }
      case "241": {
        const [x] = yield* token({
          id: "tok-dsk-primo",
          name: "Primo, the Indivisible",
          set: "TOK",
          rarity: "T",
          types: ["Creature"],
          supertypes: ["Legendary"],
          subtypes: ["Fractal"],
          colors: ["G", "U"],
          power: 0,
          toughness: 0,
          text: "",
        });
        if (x) putCounters(g, x, own({ type: "Land" }).length);
        break;
      }
      case "vacuumReturn": {
        const link = ctx.sourceLinkKey ?? src.tmtLinkKey ?? src.id,
          ids = Object.values(g.cards).filter(
            (x) =>
              x.zone === "exile" &&
              x.frontierMarks?.vacuumLink === link &&
              isCreature(x),
          );
        for (const x of ids) {
          const def = {
            ...x.def,
            power: 1,
            toughness: 1,
            subtypes: [...(x.def.subtypes ?? []), "Spirit"],
          };
          enterBattlefield(g, x, pid, false, def);
          (x.eclCounters ??= {}).flying = 1;
        }
        break;
      }
      case "254": {
        const host = src.id,
          ids = own().filter(
            (id) =>
              id !== host &&
              !g.battlefield.some(
                (eid) =>
                  g.cards[eid].attachedTo === host &&
                  eid === id &&
                  g.cards[eid].def.id === "saw",
              ),
          ),
          id = (yield* pick(ids, "可犧牲另一永久物", 0))[0];
        if (id !== undefined) {
          sacrifice(g, g.cards[id]);
          drawCards(g, pid, 1);
        }
        break;
      }
      default:
        throw Error("Unknown DSK effect " + action);
    }
  }
}
