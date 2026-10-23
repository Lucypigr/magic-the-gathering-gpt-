import { describe, it, expect } from "vitest";
import { mk, put, inHand, inGy, lands, resolve, settleAll } from "./helpers";
import {
  canActivate,
  canPayCost,
  payCost,
  performAction,
} from "../src/engine/actions";
import {
  declareAttackers,
  declareBlockers,
  canBlock,
} from "../src/engine/combat";
import { matches, stats } from "../src/engine/state";
import { parseCost } from "../src/engine/mana";
import { dealDamage, emit } from "../src/engine/zones";
import { targetable } from "../src/engine/targets";
import { frontierFlags } from "../src/engine/frontier-support";
describe("WOE / OTJ printed-rule edge cases", () => {
  it("Grove Bounty distributes X at casting and invalid allocation spends nothing", () => {
    const g = mk(),
      a = put(g, 0, "novice-inspector"),
      b = put(g, 0, "topiary-panther"),
      c = inHand(g, 0, "elusive-otter");
    lands(g, 0, "forest", 4);
    expect(
      performAction(g, 0, {
        type: "cast",
        card: c.id,
        alt: "adventure",
        x: 3,
        mode: 2,
        targets: [{ c: a.id }, { c: b.id }],
        distribution: [1, 1],
      }),
    ).not.toBeNull();
    expect(g.battlefield.some((id) => g.cards[id].tapped)).toBe(false);
    expect(
      performAction(g, 0, {
        type: "cast",
        card: c.id,
        alt: "adventure",
        x: 3,
        mode: 2,
        targets: [{ c: a.id }, { c: b.id }],
        distribution: [1, 2],
      }),
    ).toBeNull();
    resolve(g);
    expect(a.counters).toBe(1);
    expect(b.counters).toBe(2);
  });
  it("Adventure is an instant spell and untaps Unruly Catapult", () => {
    const g = mk(),
      a = put(g, 0, "unruly-catapult"),
      c = inHand(g, 0, "frolicking-familiar");
    lands(g, 0, "mountain", 1);
    a.tapped = true;
    expect(
      performAction(g, 0, {
        type: "cast",
        card: c.id,
        alt: "adventure",
        targets: [{ p: 1 }],
      }),
    ).toBeNull();
    settleAll(g);
    expect(a.tapped).toBe(false);
    expect(g.players[1].life).toBe(19);
  });
  it("Goddric becomes a Dragon and its Dragon ability affects itself", () => {
    const g = mk(),
      c = put(g, 0, "goddric-cloaked-reveler");
    put(g, 0, "novice-inspector");
    expect(matches(g, { sub: "Dragon" }, c, 0)).toBe(true);
    expect(matches(g, { sub: "Human" }, c, 0)).toBe(false);
    lands(g, 0, "mountain", 1);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: c.id,
        ability: 0,
        targets: [],
      }),
    ).toBeNull();
    resolve(g);
    expect(stats(g, c).p).toBe(5);
  });
  it("Porridge locks a mode at activation and selects the target before resolution", () => {
    const g = mk(),
      c = put(g, 0, "three-bowls-of-porridge"),
      a = put(g, 1, "topiary-panther");
    lands(g, 0, "plains", 4);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: c.id,
        ability: 0,
        targets: [{ c: a.id }],
      }),
    ).toBeNull();
    expect(g.stack[0].targets).toEqual([{ c: a.id }]);
    c.tapped = false;
    expect(canActivate(g, 0, c, 0)).toBe(false);
    expect(canActivate(g, 0, c, 1)).toBe(true);
    resolve(g);
    expect(a.damage).toBe(2);
  });
  it("Likeness Looter rejects the wrong X without paying", () => {
    const g = mk(),
      c = put(g, 0, "likeness-looter"),
      a = inGy(g, 0, "topiary-panther");
    lands(g, 0, "island", 6);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: c.id,
        ability: 1,
        x: 1,
        targets: [{ c: a.id }],
      }),
    ).not.toBeNull();
    expect(g.battlefield.some((id) => g.cards[id].tapped)).toBe(false);
  });
  it("Roxanne adds mana of the same type, never two different colors from one token", () => {
    const g = mk();
    put(g, 0, "roxanne-starfall-savant");
    put(g, 0, "tok-treasure").token = true;
    expect(canPayCost(g, 0, parseCost("{G}{G}"))).toBe(true);
    expect(canPayCost(g, 0, parseCost("{G}{U}"))).toBe(false);
    expect(payCost(g, 0, parseCost("{G}"))).toBe(true);
    expect(g.players[0].pool).toEqual(["G"]);
  });
  it("Stablemaster produces two of one color only for Mount or Vehicle spells", () => {
    const g = mk();
    put(g, 0, "intrepid-stablemaster");
    const mount = inHand(g, 0, "stubborn-burrowfiend"),
      ordinary = inHand(g, 0, "topiary-panther");
    expect(
      canPayCost(g, 0, parseCost("{U}{U}"), undefined, false, mount.def),
    ).toBe(true);
    expect(
      canPayCost(g, 0, parseCost("{G}{U}"), undefined, false, mount.def),
    ).toBe(false);
    expect(
      canPayCost(g, 0, parseCost("{G}{G}"), undefined, false, ordinary.def),
    ).toBe(false);
  });
  it("Archangel taxes each attacking or blocking creature", () => {
    const g = mk(),
      angel = put(g, 1, "archangel-of-tithes"),
      c = put(g, 0, "topiary-panther");
    expect(declareAttackers(g, 0, [c.id])).toEqual([]);
    lands(g, 0, "plains", 1);
    expect(declareAttackers(g, 0, [c.id])).toHaveLength(1);
    c.attacking = false;
    c.tapped = false;
    angel.attacking = true;
    expect(declareBlockers(g, 0, [[c.id, angel.id]])).toEqual([]);
  });
  it("Terror requires three life when casting, but not when activating an ability", () => {
    const g = mk(),
      c = put(g, 1, "terror-of-the-peaks"),
      spell = inHand(g, 0, "scorching-shot");
    lands(g, 0, "mountain", 2);
    g.players[0].life = 2;
    expect(
      performAction(g, 0, {
        type: "cast",
        card: spell.id,
        targets: [{ c: c.id }],
      }),
    ).not.toBeNull();
    g.players[0].life = 20;
    expect(
      performAction(g, 0, {
        type: "cast",
        card: spell.id,
        targets: [{ c: c.id }],
      }),
    ).toBeNull();
    expect(g.players[0].life).toBe(17);
  });
  it("Gisa ward is a single optional mana-and-life payment after casting", () => {
    const g = mk(),
      c = put(g, 1, "gisa-the-hellraiser"),
      spell = inHand(g, 0, "scorching-shot");
    lands(g, 0, "mountain", 2);
    expect(
      performAction(g, 0, {
        type: "cast",
        card: spell.id,
        targets: [{ c: c.id }],
      }),
    ).toBeNull();
    expect(g.players[0].life).toBe(20);
    settleAll(g);
    expect(c.zone).toBe("battlefield");
    expect(c.damage).toBe(0);
    expect(spell.zone).toBe("graveyard");
    expect(g.players[0].life).toBe(20);
  });
  it("Roadrunner protection stops Coyotes targeting, damage and blocks", () => {
    const g = mk(),
      road = put(g, 0, "resilient-roadrunner"),
      coyote = put(g, 1, "cunning-coyote");
    expect(targetable(g, road, 1, coyote.id)).toBe(false);
    expect(dealDamage(g, coyote, 1, { c: road.id }, 5)).toBe(0);
    road.attacking = true;
    expect(canBlock(g, coyote, road)).toBe(false);
  });
  it("countering an opponents spell is a crime", () => {
    const g = mk(),
      enemy = inHand(g, 1, "novice-inspector"),
      counter = inHand(g, 0, "stoic-sphinx");
    lands(g, 0, "island", 4);
    lands(g, 1, "plains", 1);
    g.active = 1;
    expect(
      performAction(g, 1, { type: "cast", card: enemy.id, targets: [] }),
    ).toBeNull();
    // A real counterspell must count its stack target as an opponents object.
    const c = inHand(g, 0, "ice-out");
    expect(
      performAction(g, 0, {
        type: "cast",
        card: c.id,
        targets: [{ c: enemy.id }],
      }),
    ).toBeNull();
    expect(frontierFlags(g, 0).crime).toBe(1);
    expect(counter.zone).toBe("hand");
  });
  it("Forsaken Miner cannot block and triggers from its graveyard on a crime", () => {
    const g = mk(),
      c = put(g, 1, "forsaken-miner"),
      a = put(g, 0, "topiary-panther");
    a.attacking = true;
    expect(canBlock(g, c, a)).toBe(false);
    const dead = inGy(g, 0, "forsaken-miner");
    lands(g, 0, "swamp", 1);
    emit(g, {
      type: "frontier",
      action: "crime",
      card: a.id,
      player: 0,
      amount: 0,
    });
    settleAll(g);
    expect(dead.zone).toBe("battlefield");
  });
});

describe("WOE / OTJ copy and restricted mana rules", () => {
  it("Virtue Adventure selects an own ability on casting and copies it", () => {
    const g = mk(),
      catapult = put(g, 0, "unruly-catapult"),
      virtue = inHand(g, 0, "virtue-of-knowledge");
    lands(g, 0, "island", 2);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: catapult.id,
        ability: 0,
        targets: [],
      }),
    ).toBeNull();
    const sid = g.stack[0].sid;
    expect(
      performAction(g, 0, {
        type: "cast",
        card: virtue.id,
        alt: "adventure",
        targets: [],
        stackTargetSid: sid,
      }),
    ).toBeNull();
    resolve(g);
    expect(g.stack.filter((s) => s.kind === "activated")).toHaveLength(2);
    resolve(g);
    resolve(g);
    expect(g.players[1].life).toBe(18);
  });
  it("Return the Favor can copy an ability selected before resolving", () => {
    const g = mk(),
      catapult = put(g, 0, "unruly-catapult"),
      favor = inHand(g, 0, "return-the-favor");
    lands(g, 0, "mountain", 3);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: catapult.id,
        ability: 0,
        targets: [],
      }),
    ).toBeNull();
    const sid = g.stack[0].sid;
    expect(
      performAction(g, 0, {
        type: "cast",
        card: favor.id,
        mode: 0,
        targets: [],
        stackTargetSid: sid,
      }),
    ).toBeNull();
    resolve(g);
    resolve(g);
    resolve(g);
    expect(g.players[1].life).toBe(18);
  });
  it("Yenna Aura copy enters attached, then untaps Yenna", () => {
    const g = mk(),
      yenna = put(g, 0, "yenna-redtooth-regent"),
      body = put(g, 0, "topiary-panther"),
      aura = put(g, 0, "cooped-up");
    aura.attachedTo = body.id;
    lands(g, 0, "forest", 2);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: yenna.id,
        ability: 0,
        targets: [{ c: aura.id }],
      }),
    ).toBeNull();
    resolve(g, (d) =>
      d.type === "choose" && d.options.includes(body.id)
        ? { type: "choose", ids: [body.id] }
        : undefined,
    );
    expect(
      g.battlefield.filter(
        (id) =>
          g.cards[id].def.id === aura.def.id &&
          g.cards[id].attachedTo === body.id,
      ),
    ).toHaveLength(2);
    expect(yenna.tapped).toBe(false);
  });
  it("leftover Stablemaster mana retains the Mount or Vehicle restriction", () => {
    const g = mk();
    put(g, 0, "intrepid-stablemaster");
    const mount = inHand(g, 0, "stubborn-burrowfiend"),
      ordinary = inHand(g, 0, "topiary-panther");
    expect(payCost(g, 0, parseCost("{U}"), undefined, false, mount.def)).toBe(
      true,
    );
    expect(
      canPayCost(g, 0, parseCost("{U}"), undefined, false, mount.def),
    ).toBe(true);
    expect(
      canPayCost(g, 0, parseCost("{U}"), undefined, false, ordinary.def),
    ).toBe(false);
  });
});
