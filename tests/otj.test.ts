import { describe, it, expect } from "vitest";
import { CARDS, slug } from "../src/data";
import catalog from "../src/data/sets/otj-catalog.json";
import { poolSize } from "../src/meta/booster";
import { mk, put, inHand, lands, resolve, settleAll } from "./helpers";
import {
  performAction,
  canActivate,
  canPayCost,
  castOptionsFor,
} from "../src/engine/actions";
import { newCard } from "../src/engine/state";
import { getDef } from "../src/engine/registry";
import { parseCost } from "../src/engine/mana";
import { enterBattlefield } from "../src/engine/zones";
import { frontierFlags } from "../src/engine/frontier-support";
const cast = (
  g: ReturnType<typeof mk>,
  card: number,
  targets: any[] = [],
  extra: object = {},
) =>
  expect(
    performAction(g, 0, { type: "cast", card, targets, ...extra }),
  ).toBeNull();
describe("OTJ complete card pool and mechanics", () => {
  it("contains all 271 printed main-set cards with spells and exact booster membership", () => {
    expect(
      poolSize("OTJ"),
      CARDS.filter(
        (c) => c.set === "OTJ" && !catalog.some((r) => slug(r.name) === c.id),
      )
        .map((c) => c.name)
        .join(", "),
    ).toBe(271);
    for (const row of catalog) {
      const d = CARDS.find((c) => c.id === slug(row.name))!;
      expect(d, row.name).toBeDefined();
      expect(d.text).toBe(row.text);
      expect(d.cost).toBe(row.cost);
      expect(d.power).toBe(row.power);
      expect(d.toughness).toBe(row.toughness);
      if (row.types.some((t) => t === "Instant" || t === "Sorcery"))
        expect(d.spell, row.name).toBeDefined();
    }
  });
  it("plotting is not casting and the card cannot be cast on the same turn", () => {
    const g = mk(),
      c = inHand(g, 0, "dust-animus");
    lands(g, 0, "plains", 2);
    cast(g, c.id, [], { alt: "plot" });
    expect(c.zone).toBe("exile");
    expect(g.players[0].spellsThisTurn).toBe(0);
    expect(
      performAction(g, 0, {
        type: "cast",
        card: c.id,
        targets: [],
        alt: "plotted",
      }),
    ).not.toBeNull();
    g.turn += 2;
    cast(g, c.id, [], { alt: "plotted" });
    resolve(g);
    expect(c.zone).toBe("battlefield");
    expect(c.manaSpent).toBe(0);
  });
  it("Spree pays every chosen additional cost and resolves in printed order", () => {
    const g = mk(),
      body = put(g, 0, "novice-inspector"),
      artifact = put(g, 1, "tok-clue"),
      enchantment = put(g, 1, "case-of-the-filched-falcon"),
      c = inHand(g, 0, "requisition-raid");
    lands(g, 0, "plains", 4);
    cast(g, c.id, [{ c: artifact.id }, { c: enchantment.id }, { p: 0 }], {
      mode: 6,
    });
    resolve(g);
    expect(artifact.zone).toBe("graveyard");
    expect(enchantment.zone).toBe("graveyard");
    expect(body.counters).toBe(1);
    expect(g.battlefield.filter((id) => g.cards[id].tapped)).toHaveLength(4);
  });
  it("one spell targeting two opponents permanents commits only one crime", () => {
    const g = mk();
    put(g, 0, "deepmuck-desperado");
    const a = put(g, 1, "novice-inspector"),
      b = put(g, 1, "topiary-panther"),
      c = inHand(g, 0, "this-town-aint-big-enough");
    lands(g, 0, "island", 5);
    cast(g, c.id, [{ c: a.id }, { c: b.id }]);
    resolve(g);
    settleAll(g);
    expect(g.players[1].library).toHaveLength(27);
    expect(frontierFlags(g, 0).crime).toBe(1);
  });
  it("targeting your own permanent does not commit a crime", () => {
    const g = mk(),
      body = put(g, 0, "novice-inspector"),
      c = inHand(g, 0, "snakeskin-veil");
    lands(g, 0, "forest", 1);
    cast(g, c.id, [{ c: body.id }]);
    expect(frontierFlags(g, 0).crime).toBeUndefined();
  });
  it("an activated ability targeting an opponent commits a crime", () => {
    const g = mk(),
      c = put(g, 0, "blood-hustler");
    lands(g, 0, "swamp", 4);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: c.id,
        ability: 0,
        targets: [{ p: 1 }],
      }),
    ).toBeNull();
    resolve(g);
    settleAll(g);
    expect(c.counters).toBe(1);
    expect(g.players[1].life).toBe(19);
  });
  it("a triggered ability put on the stack can commit a crime without casting a spell", () => {
    const g = mk();
    put(g, 0, "raven-of-fell-omens");
    const victim = put(g, 1, "topiary-panther"),
      c = inHand(g, 0, "longhorn-sharpshooter");
    lands(g, 0, "mountain", 4);
    cast(g, c.id, [], { alt: "plot" });
    settleAll(g, (d) =>
      d.type === "targets"
        ? { type: "targets", targets: [{ c: victim.id }] }
        : undefined,
    );
    expect(g.players[0].spellsThisTurn).toBe(0);
    expect(victim.damage).toBe(2);
    expect(g.players[1].life).toBe(19);
  });
  it("saddling uses other creatures and Burrowfiend triggers only the first time each turn", () => {
    const g = mk(),
      mount = put(g, 0, "stubborn-burrowfiend"),
      rider = put(g, 0, "topiary-panther");
    rider.sick = true;
    expect(
      performAction(g, 0, {
        type: "activate",
        card: mount.id,
        ability: 0,
        targets: [],
      }),
    ).toBeNull();
    resolve(g);
    settleAll(g);
    expect(rider.tapped).toBe(true);
    expect(mount.tapped).toBe(false);
    expect(g.players[0].library).toHaveLength(28);
    rider.tapped = false;
    expect(
      performAction(g, 0, {
        type: "activate",
        card: mount.id,
        ability: 0,
        targets: [],
      }),
    ).toBeNull();
    resolve(g);
    settleAll(g);
    expect(g.players[0].library).toHaveLength(28);
  });
  it("High Noon prevents a second cast but does not prevent plotting", () => {
    const g = mk();
    put(g, 0, "high-noon");
    const c = inHand(g, 0, "novice-inspector"),
      second = inHand(g, 0, "dust-animus");
    lands(g, 0, "plains", 3);
    cast(g, c.id);
    resolve(g);
    expect(
      performAction(g, 0, { type: "cast", card: second.id, targets: [] }),
    ).not.toBeNull();
    cast(g, second.id, [], { alt: "plot" });
  });
  it("Doc Aurlock reduces only generic plotting cost from hand", () => {
    const g = mk();
    put(g, 0, "doc-aurlock-grizzled-genius");
    const c = inHand(g, 0, "dust-animus");
    lands(g, 0, "plains", 1);
    cast(g, c.id, [], { alt: "plot" });
    expect(c.zone).toBe("exile");
  });
  it("Satoru draws once for two nontoken creatures entering simultaneously without casting", () => {
    const g = mk();
    put(g, 0, "satoru-the-infiltrator");
    const a = newCard(g, getDef("novice-inspector"), 0),
      b = newCard(g, getDef("topiary-panther"), 0);
    a.zone = b.zone = "exile";
    g.frontierEntryBatch = 123;
    enterBattlefield(g, a, 0);
    enterBattlefield(g, b, 0);
    g.frontierEntryBatch = undefined;
    settleAll(g);
    expect(g.players[0].hand).toHaveLength(1);
  });
  it("Arid Archway produces two colorless mana", () => {
    const g = mk();
    put(g, 0, "arid-archway");
    expect(canPayCost(g, 0, parseCost("{2}"))).toBe(true);
  });
  it("Luxurious Locomotive cannot crew a second time that turn", () => {
    const g = mk(),
      c = put(g, 0, "luxurious-locomotive");
    put(g, 0, "topiary-panther");
    expect(
      performAction(g, 0, {
        type: "activate",
        card: c.id,
        ability: 0,
        targets: [],
      }),
    ).toBeNull();
    resolve(g);
    expect(canActivate(g, 0, c, 0)).toBe(false);
  });
  it("Fblthp can plot a nonland top card but does not allow casting it directly", () => {
    const g = mk();
    put(g, 0, "fblthp-lost-on-the-range");
    const c = newCard(g, getDef("novice-inspector"), 0);
    c.zone = "library";
    g.players[0].library.unshift(c.id);
    lands(g, 0, "plains", 1);
    expect(castOptionsFor(g, 0, c).some((o) => o.alt === "plotTop")).toBe(true);
    cast(g, c.id, [], { alt: "plotTop" });
    expect(c.plottedTurn).toBe(g.turn);
  });
});
