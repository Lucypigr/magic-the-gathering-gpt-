import { canPayCost, payCost } from "./actions";
import {
  copiableDefinition,
  isCreature,
  isLand,
  matches,
  other,
  shuffleArr,
  stats,
  abilitiesOf,
} from "./state";
import { manaValue, parseCost } from "./mana";
import { runEffects, resolveRef, type Ctx } from "./effects";
import { legalTargets } from "./targets";
import { choose, freeCast } from "./tla";
import { makeEclTokenBatch } from "./ecl";
import { mshEffect } from "./msh";
import { frontierFlags } from "./frontier-support";
import {
  dealDamage,
  discardMany,
  drawCards,
  enterBattlefield,
  gainLife,
  moveCard,
  putCounters,
  sacrifice,
  tapCard,
  destroyCards,
} from "./zones";
import type {
  CardDef,
  Effect,
  Filter,
  GameState,
  PID,
  Ref,
  Response,
  SubFlow,
} from "./types";
const E = (action: string, what?: Ref, n?: number): Effect => ({
  e: "frontier",
  action: "woe:" + action,
  what,
  n,
});
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
export function* woeEffect(
  g: GameState,
  ctx: Ctx,
  ef: Extract<Effect, { e: "frontier" }>,
): SubFlow {
  const action = ef.action.slice(4),
    pid = ctx.controller,
    opp = other(pid),
    p = g.players[pid],
    src = g.cards[ctx.source],
    cards = resolveRef(g, ctx, ef.what ?? "T0").cards,
    c = cards[0];
  const own = (f: Filter = {}) =>
    g.battlefield.filter(
      (id) =>
        g.cards[id].controller === pid &&
        matches(g, f, g.cards[id], pid, src.id),
    );
  const pick = (ids: number[], prompt: string, min = 0, max = 1, who = pid) =>
    choose(g, who, prompt, ids, min, max);
  const run = (effects: Effect[]) => runEffects(g, ctx, effects);
  const impulse = function* (who: PID, n: number, until = g.turn): SubFlow {
    for (const id of g.players[who].library.slice(0, n)) {
      const x = g.cards[id];
      moveCard(g, x, "exile");
      x.playableBy = pid;
      x.playableUntil = until;
    }
  };
  const permanent = (patch: Partial<CardDef>, target = src) => {
    target.tlaOriginalDef ??= target.def;
    target.def = { ...target.def, ...patch };
  };
  switch (action) {
    case "youngHero": {
      const host = g.cards[src.attachedTo ?? -1];
      if (host && stats(g, host).t <= 3) putCounters(g, host, 1);
      break;
    }
    case "smallBlockers":
    case "largeBlockers":
      if (c) {
        Object.assign((c.frontierMarks ??= {}), {
          [action === "smallBlockers" ? "smallBlockTurn" : "largeBlockTurn"]:
            g.turn,
          [action === "smallBlockers" ? "smallBlock" : "largeBlock"]: ef.n ?? 2,
        });
      }
      break;
    case "hasteBlockers":
      (src.frontierMarks ??= {}).hasteBlockTurn = g.turn;
      break;
    case "princessExile":
      if (c) {
        moveCard(g, c, "exile");
        (c.frontierMarks ??= {}).princessLink = src.tmtLinkKey ?? src.id;
      }
      break;
    case "returnLinked":
      for (const x of Object.values(g.cards))
        if (
          x.zone === "exile" &&
          x.frontierMarks?.princessLink === (src.tmtLinkKey ?? src.id)
        ) {
          delete x.frontierMarks.princessLink;
          enterBattlefield(g, x, x.owner);
        }
      break;
    case "swiftReturn": {
      const x = g.cards[ef.n ?? -1];
      if (x?.zone === "exile" && x.frontierMarks?.swiftLink === ctx.source)
        enterBattlefield(g, x, x.owner);
      break;
    }
    case "topLibrary":
      if (c) moveCard(g, c, "library");
      break;
    case "discardHand":
      discardMany(
        g,
        p.hand.slice().map((id) => g.cards[id]),
      );
      break;
    case "copyToken":
    case "reflectionCopy":
    case "219": {
      if (!c) break;
      let def = copiableDefinition(c);
      if (action !== "copyToken")
        def = {
          ...def,
          supertypes: def.supertypes?.filter((s) => s !== "Legendary"),
        };
      if (action === "reflectionCopy")
        def = {
          ...def,
          subtypes: [...(def.subtypes ?? []), "Reflection"],
          keywords: [...(def.keywords ?? []), "haste"],
        };
      let attachTo: number | undefined;
      if (def.aura) {
        const options = legalTargets(
          g,
          def.aura.target ?? { kind: "creature" },
          pid,
        ).flatMap((t) => ("c" in t ? [t.c] : []));
        if (!options.length) break;
        attachTo = (yield* pick(options, "選擇靈氣進場結附的永久物", 1))[0];
      }
      const [t] = yield* makeEclTokenBatch(g, pid, def, 1, { attachTo });
      if (action === "219" && t?.def.subtypes?.includes("Aura")) {
        src.tapped = false;
        yield* run([{ e: "scry", n: 2 }]);
      }
      break;
    }
    case "steal":
      if (c) {
        const previous = c.controller;
        c.controller = pid;
        c.sick = true;
        c.tapped = false;
        c.returnControl = { player: previous, turn: g.turn };
        yield* run([{ e: "pump", what: "T0", p: 0, t: 0, kw: ["haste"] }]);
      }
      break;
    case "5":
      if (c) {
        const qualifies = c.token || c.controller === pid;
        destroyCards(g, [c]);
        if (c.zone !== "battlefield" && qualifies) drawCards(g, pid, 1);
      }
      break;
    case "10":
      if (c) {
        c.controller = opp;
        c.sick = true;
      }
      break;
    case "12":
      frontierFlags(g, pid).creatureDamageFog = 1;
      break;
    case "13": {
      const n = yield* mode(
        pid,
        "消滅力量至少多少的生物？",
        Array.from({ length: 11 }, (_, i) => String(i)),
      );
      destroyCards(
        g,
        g.battlefield
          .map((id) => g.cards[id])
          .filter((c) => isCreature(c) && stats(g, c).p >= n),
      );
      break;
    }
    case "32":
      if (c && (yield* yes(pid, "將永久物回手並占卜2？"))) {
        moveCard(g, c, "hand");
        yield* run([{ e: "scry", n: 2 }]);
      }
      break;
    case "33":
      if (c) {
        const ctl = c.controller;
        destroyCards(g, [c]);
        yield* makeEclTokenBatch(g, ctl, "tok-woe-human", 1);
      }
      break;
    case "48":
      for (const t of ctx.targets)
        if (t && "c" in t) {
          const x = g.cards[t.c];
          if (x.zone === "battlefield") {
            moveCard(g, x, "exile");
            x.playableBy = x.owner;
            x.playableUntil = Number.MAX_SAFE_INTEGER;
          }
        }
      break;
    case "51":
      (g.delayed ??= []).push({
        source: src.id,
        controller: pid,
        on: "castInstSorc",
        filter: { mvMax: 3 },
        once: true,
        effects: [{ e: "copySpell" }],
      });
      break;
    case "56":
      if (src.counters > 0 && (yield* yes(pid, "移去一個指示物抓牌？"))) {
        src.counters--;
        drawCards(g, pid, 1);
      }
      break;
    case "69": {
      const item = g.stack.find(
        (s) =>
          s.kind === "spell" &&
          ctx.targets[0] &&
          "c" in ctx.targets[0] &&
          s.cardId === ctx.targets[0].c,
      );
      if (!item) break;
      const cost = parseCost("{" + (2 + own({ sub: "Faerie" }).length) + "}");
      if (
        canPayCost(g, item.controller, cost) &&
        (yield* yes(item.controller, "支付法力避免被反擊？"))
      )
        payCost(g, item.controller, cost);
      else {
        g.stack = g.stack.filter((s) => s.sid !== item.sid);
        moveCard(g, g.cards[item.cardId], "graveyard");
      }
      break;
    }
    case "73": {
      drawCards(g, pid, 1);
      if (!p.hand.length) break;
      const ids = yield* pick(p.hand, "棄一張牌", 1);
      discardMany(
        g,
        ids.map((id) => g.cards[id]),
      );
      if (ids.length)
        yield* run([
          {
            e: "reflexive",
            targets: [
              { kind: "creature", filter: { ctrl: "you", sub: "Faerie" } },
            ],
            effects: [{ e: "counters", what: "T0", n: 1 }],
          },
        ]);
      break;
    }
    case "copyAbility":
      yield* mshEffect(g, ctx, { e: "msh", action: "copyAbility", n: ef.n });
      break;
    case "78": {
      const ids = p.library.slice(0, 2),
        id = (yield* pick(ids, "選一張放逐", Math.min(1, ids.length)))[0];
      for (const x of ids) moveCard(g, g.cards[x], x === id ? "exile" : "hand");
      break;
    }
    case "ashiokExile": {
      const t = ctx.targets[0],
        who = t && "p" in t ? t.p : opp,
        n = p.exile.reduce((sum, id) => sum + manaValue(g.cards[id].def), 0);
      for (const id of g.players[who].library.slice(0, n))
        moveCard(g, g.cards[id], "exile");
      break;
    }
    case "80": {
      const ids = cards.length
        ? ctx.targets.flatMap((t) => (t && "c" in t ? [t.c] : []))
        : [];
      let chosen: number | undefined;
      if (src.frontierBargained)
        chosen = (yield* pick(
          ids.filter((id) => manaValue(g.cards[id].def) <= 4),
          "可將一張返場",
          0,
        ))[0];
      for (const id of ids) {
        const x = g.cards[id];
        if (x.zone !== "graveyard") continue;
        if (id === chosen) enterBattlefield(g, x, pid);
        else moveCard(g, x, "hand");
      }
      break;
    }
    case "82": {
      const id = (yield* pick(p.library, "搜尋牌", 0))[0];
      if (id === undefined) {
        shuffleArr(g, p.library);
        break;
      }
      const x = g.cards[id];
      moveCard(g, x, "exile");
      shuffleArr(g, p.library);
      const faces = (
        [undefined, ...(x.def.adventure ? ["adventure" as const] : [])] as (
          undefined | "adventure"
        )[]
      ).filter(
        (alt) =>
          manaValue(
            alt
              ? { ...x.def, ...x.def.adventure!, adventure: undefined }
              : x.def,
          ) <= 4,
      );
      if (
        src.frontierBargained &&
        faces.length &&
        (yield* yes(pid, "免費施放？"))
      ) {
        const alt =
          faces.length > 1
            ? faces[
                yield* mode(
                  pid,
                  "選擇施放面",
                  faces.map((a) => (a ? x.def.adventure!.name : x.def.name)),
                )
              ]
            : faces[0];
        yield* freeCast(g, ctx, x, true, alt);
      }
      if (x.zone === "exile") moveCard(g, x, "hand");
      break;
    }
    case "86":
      yield* run([
        { e: "discardChosen", who: "opp", filter: { nonType: "Land" } },
      ]);
      if (!own({ sub: "Faerie" }).length) {
        const id = (yield* pick(
          p.hand,
          "放逐一張手牌",
          Math.min(1, p.hand.length),
        ))[0];
        if (id !== undefined) moveCard(g, g.cards[id], "exile");
      }
      break;
    case "87":
      if (c) {
        const name = c.def.name,
          owner = c.controller;
        moveCard(g, c, "exile");
        const pl = g.players[owner],
          ids = [...pl.graveyard, ...pl.hand, ...pl.library].filter(
            (id) => g.cards[id].def.name === name,
          ),
          chosen = yield* pick(ids, "放逐任意數量同名牌", 0, ids.length);
        let n = 0;
        for (const id of chosen) {
          if (g.cards[id].zone === "hand") n++;
          moveCard(g, g.cards[id], "exile");
        }
        shuffleArr(g, pl.library);
        drawCards(g, owner, n);
      }
      break;
    case "90":
      yield* run([
        {
          e: "pump",
          what: "T0",
          p: -(ctx.x ?? 0) - (src.frontierMarks?.castFaerie ? 3 : 0),
          t: -(ctx.x ?? 0) - (src.frontierMarks?.castFaerie ? 3 : 0),
        },
      ]);
      break;
    case "96":
    case "315": {
      const candidates = own({
          or: [{ type: "Artifact" }, { type: "Enchantment" }, { token: true }],
        }),
        ids = yield* pick(
          candidates,
          "犧牲任意數量永久物",
          0,
          candidates.length,
        );
      for (const id of ids) sacrifice(g, g.cards[id]);
      if (action === "315") drawCards(g, pid, ids.length);
      else {
        const chosen = yield* pick(
          p.graveyard.filter((id) => isCreature(g.cards[id])),
          "選擇返場生物",
          Math.min(
            ids.length,
            p.graveyard.filter((id) => isCreature(g.cards[id])).length,
          ),
          ids.length,
        );
        for (const id of chosen) enterBattlefield(g, g.cards[id], pid);
      }
      break;
    }
    case "101": {
      if (c)
        (g.delayed ??= []).push({
          source: c.id,
          controller: c.owner,
          on: "dies",
          once: true,
          effects: [
            { e: "reanimate", what: "selfAny", owner: true, tapped: true },
            { e: "role", what: "self", token: "tok-wicked-role" },
          ],
        });
      break;
    }
    case "104": {
      const top = p.library.slice(0, 4),
        keep = yield* pick(top, "選至多兩張留在牌庫頂（依序）", 0, 2);
      for (const id of top)
        if (!keep.includes(id)) moveCard(g, g.cards[id], "graveyard");
      for (const id of [...keep].reverse()) moveCard(g, g.cards[id], "library");
      break;
    }
    case "107": {
      const options = p.graveyard.filter((id) => isCreature(g.cards[id])),
        ids = yield* pick(options, "可放逐一張或更多生物牌", 0, options.length);
      for (const id of ids) moveCard(g, g.cards[id], "exile");
      if (ids.length)
        yield* run([
          {
            e: "pump",
            what: { all: { type: "Creature", other: true } },
            p: -ids.length,
            t: -ids.length,
          },
        ]);
      break;
    }
    case "131":
      (g.delayed ??= []).push({
        source: src.id,
        controller: pid,
        on: "frontierEvent",
        frontierEvent: "nontokenOwnDies",
        once: false,
        effects: [{ e: "token", token: "tok-woe-rat" }],
      });
      break;
    case "139":
      yield* impulse(opp, 3);
      break;
    case "145":
      for (let i = 0; i < 4; i++) yield* run([{ e: "addManaOfChoice", n: 1 }]);
      break;
    case "148": {
      const m = (src.frontierMarks ??= {}),
        n = (m.skewer = (m.skewer ?? 0) + 1);
      if (yield* yes(pid, "犧牲並放逐牌庫頂？")) {
        sacrifice(g, src);
        yield* impulse(pid, n);
      }
      break;
    }
    case "149": {
      const ev = ctx.ev;
      if (ev?.type === "frontier" && ev.other !== undefined)
        dealDamage(g, src, pid, { c: ev.other }, 1);
      break;
    }
    case "157": {
      const ev = ctx.ev;
      if (ev?.type === "noncombat") yield* impulse(pid, ev.amount);
      break;
    }
    case "163":
      yield* run([{ e: "mill", n: 3 }]);
      {
        const id = (yield* pick(
          p.graveyard.filter((id) => isLand(g.cards[id])),
          "選地返場",
          Math.min(1, p.graveyard.filter((id) => isLand(g.cards[id])).length),
        ))[0];
        if (id !== undefined) enterBattlefield(g, g.cards[id], pid, true);
      }
      break;
    case "fetchQuest":
    case "seekThrills": {
      const ids = p.library.slice(0, 7);
      for (const id of ids) moveCard(g, g.cards[id], "graveyard");
      if (action === "seekThrills") {
        for (const id of ids)
          if (g.cards[id].zone === "graveyard" && g.cards[id].def.adventure)
            moveCard(g, g.cards[id], "hand");
      } else {
        const options = ids.filter(
          (id) =>
            g.cards[id].zone === "graveyard" &&
            g.cards[id].def.types.some(
              (t) => t === "Creature" || t === "Enchantment" || t === "Land",
            ),
        );
        const id = (yield* pick(
          options,
          "將一個永久物返場",
          Math.min(1, options.length),
        ))[0];
        if (id !== undefined) enterBattlefield(g, g.cards[id], pid);
      }
      break;
    }
    case "167":
      if (c)
        yield* run([
          {
            e: "reflexive",
            targets: [
              { kind: "creature", filter: { ctrl: "opp" }, optional: true },
            ],
            effects: [{ e: "fight", a: { all: { ids: [c.id] } }, b: "T0" }],
          },
        ]);
      break;
    case "169": {
      const top = p.library.slice(0, 5),
        id = (yield* pick(
          top.filter((id) => isCreature(g.cards[id])),
          "可放逐一張生物",
          0,
        ))[0],
        rest = top.filter((x) => x !== id);
      if (id !== undefined) {
        moveCard(g, g.cards[id], "exile");
        g.cards[id].playableBy = pid;
        g.cards[id].playableUntil = g.turn;
      }
      shuffleArr(g, rest);
      for (const x of rest) moveCard(g, g.cards[x], "library", true);
      (g.delayed ??= []).push({
        source: src.id,
        controller: pid,
        on: "combatStart",
        once: true,
        effects: [
          {
            e: "reflexive",
            targets: [
              { kind: "creature", filter: { ctrl: "you" } },
              { kind: "creature", filter: { ctrl: "opp" }, optional: true },
            ],
            effects: [{ e: "bite", a: "T0", b: "T1" }],
          },
        ],
      });
      break;
    }
    case "171": {
      const t = ctx.targets[ctx.targets.length - 1];
      if (t && "c" in t)
        for (const a of ctx.targets.slice(0, -1))
          if (a && "c" in a && g.cards[a.c].zone === "battlefield")
            dealDamage(g, g.cards[a.c], pid, t, stats(g, g.cards[a.c]).p);
      break;
    }
    case "tripletCopies":
      if (!src.token)
        yield* makeEclTokenBatch(g, pid, copiableDefinition(src), 2);
      break;
    case "tripletCounters": {
      const n = ctx.ev?.type === "dies" ? ctx.ev.power : (src.lastPower ?? 0);
      for (const id of own({ name: "Gruff Triplets" }))
        putCounters(g, g.cards[id], n);
      break;
    }
    case "190": {
      const top = p.library.slice(0, 20),
        ids = yield* pick(
          top.filter((id) => isCreature(g.cards[id])),
          "可選至多兩張生物",
          0,
          2,
        );
      for (const id of ids) {
        if (src.frontierBargained) enterBattlefield(g, g.cards[id], pid);
        else moveCard(g, g.cards[id], "hand");
      }
      shuffleArr(g, p.library);
      break;
    }
    case "206":
      if (yield* yes(pid, "支付{1}觸發Hylda？")) {
        const cost = parseCost("{1}");
        if (!payCost(g, pid, cost)) break;
        const n = yield* mode(pid, "選擇效果", [
          "4/4元素",
          "每個生物放指示物",
          "占卜2抓1",
        ]);
        if (n === 0) yield* makeEclTokenBatch(g, pid, "tok-woe-elemental", 1);
        else if (n === 1)
          yield* run([
            {
              e: "counters",
              what: { all: { ctrl: "you", type: "Creature" } },
              n: 1,
            },
          ]);
        else
          yield* run([
            { e: "scry", n: 2 },
            { e: "draw", n: 1 },
          ]);
      }
      break;
    case "208":
      if (c && manaValue(c.def) === (ctx.x ?? 0)) {
        const ability = abilitiesOf(g, src).find(
          (a) =>
            a.kind === "activated" &&
            a.effects.some((e) => e.e === "frontier" && e.action === "woe:208"),
        );
        const def = {
          ...copiableDefinition(c),
          keywords: [...(c.def.keywords ?? []), "flying" as const],
          abilities: [
            ...(c.def.abilities ?? []),
            ...(ability ? [ability] : []),
          ],
        };
        permanent(def);
        src.copyLayer = def;
      }
      break;
    case "rowanDiscount":
      frontierFlags(g, pid).rowan = p.lifeLostThisTurn;
      break;
    case "willDiscount":
      frontierFlags(g, pid).will = p.lifeGainedThisTurn;
      break;
    case "exileGrave": {
      const t = ctx.targets[0];
      if (t && "p" in t)
        for (const id of [...g.players[t.p].graveyard])
          moveCard(g, g.cards[id], "exile");
      break;
    }
    case "exileOppGrave":
      for (const id of [...g.players[opp].graveyard])
        moveCard(g, g.cards[id], "exile");
      break;
    case "expensiveTaste":
      yield* impulse(opp, 2, Number.MAX_SAFE_INTEGER);
      break;
    case "224": {
      const ids = own({
          or: [{ type: "Artifact" }, { type: "Enchantment" }, { token: true }],
        }),
        id = (yield* pick(ids, "可犧牲一個神器、結界或衍生物", 0))[0];
      if (id !== undefined) sacrifice(g, g.cards[id]);
      else tapCard(g, src);
      break;
    }
    case "distributeX":
    case "distributeThree":
      for (let i = 0; i < ctx.targets.length; i++) {
        const t = ctx.targets[i];
        if (t && "c" in t)
          putCounters(g, g.cards[t.c], ctx.distribution?.[i] ?? 0);
      }
      break;
    case "231":
      (src.frontierMarks ??= {}).dreadUntil =
        g.turn + (g.active === pid ? 2 : 1);
      break;
    case "seekBeast": {
      const ids = p.library.slice(0, 2),
        end =
          g.turn +
          (g.active === pid
            ? g.phase === "end" || g.phase === "cleanup"
              ? 2
              : 0
            : 1);
      yield* impulse(pid, 2, end);
      for (const id of ids) (g.cards[id].frontierMarks ??= {}).seekEnd = end;
      break;
    }
    case "swiftSpiral":
      if (c) {
        moveCard(g, c, "exile");
        (c.frontierMarks ??= {}).swiftLink = src.id;
        (g.delayed ??= []).push({
          source: src.id,
          controller: pid,
          on: "eachEndStep",
          once: true,
          persistent: true,
          effects: [E("swiftReturn", undefined, c.id)],
        });
      }
      break;
    case "242":
      if (c) {
        const creature = isCreature(c);
        moveCard(g, c, "exile");
        (c.frontierMarks ??= {}).cauldronLink = src.tmtLinkKey ?? src.id;
        if (creature)
          yield* run([
            {
              e: "reflexive",
              targets: [{ kind: "creature", filter: { ctrl: "you" } }],
              effects: [{ e: "counters", what: "T0", n: 1 }],
            },
          ]);
      }
      break;
    case "248":
      if (yield* yes(pid, "變成Everflame武具？"))
        permanent({
          name: "Everflame, Heroes' Legacy",
          types: ["Artifact"],
          subtypes: ["Equipment"],
          supertypes: ["Legendary"],
          produces: undefined,
          abilities: [],
          equip: { cost: "{3}", grant: { p: 3, t: 3 } },
        });
      break;
    case "253": {
      const m = (src.frontierMarks ??= {}),
        options = [0, 1, 2].filter((i) => !m["porridge" + i]);
      if (!options.length) break;
      const idx =
        options[
          yield* mode(
            pid,
            "選尚未選過的模式",
            options.map((i) => ["造成2傷害", "橫置生物", "犧牲獲得3生命"][i]),
          )
        ];
      m["porridge" + idx] = 1;
      if (idx === 2) {
        sacrifice(g, src);
        gainLife(g, pid, 3);
      } else
        yield* run([
          {
            e: "reflexive",
            targets: [{ kind: "creature" }],
            effects: [
              idx === 0
                ? { e: "damage", to: "T0", n: 2 }
                : { e: "tap", what: "T0" },
            ],
          },
        ]);
      break;
    }
    case "311": {
      const ids = g.battlefield.filter((id) => isCreature(g.cards[id])),
        reward = ids.some((id) => g.cards[id].controller === opp);
      for (const id of ids) moveCard(g, g.cards[id], "hand");
      if (reward) yield* makeEclTokenBatch(g, pid, "tok-woe-fae-court", 2);
      break;
    }
    default:
      throw Error("Unimplemented WOE effect " + action);
  }
  g.version++;
}
