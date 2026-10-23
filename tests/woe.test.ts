import { describe, it, expect } from "vitest";
import { CARDS, slug } from "../src/data";
import catalog from "../src/data/sets/woe-catalog.json";
import { poolSize } from "../src/meta/booster";
import {
  mk,
  put,
  inHand,
  lands,
  resolve,
  settleAll,
  answerDefault,
} from "./helpers";
import { performAction, castAlts, canPayCost } from "../src/engine/actions";
import { runEffects } from "../src/engine/effects";
import { stats } from "../src/engine/state";
import { parseCost } from "../src/engine/mana";
import { emit, moveCard } from "../src/engine/zones";
import type { Effect, GameState, TargetRef } from "../src/engine/types";
function effect(
  g: GameState,
  source: number,
  effects: Effect[],
  targets: TargetRef[] = [],
) {
  const f = runEffects(g, { source, controller: 0, targets }, effects);
  let r = f.next();
  while (!r.done) r = f.next(answerDefault(g, r.value));
}
const cast = (
  g: GameState,
  id: number,
  targets: (TargetRef | null)[] = [],
  extra: object = {},
) =>
  expect(
    performAction(g, 0, { type: "cast", card: id, targets, ...extra }),
  ).toBeNull();
describe("WOE printed cards and mechanics", () => {
  it("contains all 276 nonbasic cards, their printed characteristics and every Adventure", () => {
    expect(poolSize("WOE")).toBe(276);
    for (const row of catalog) {
      const d = CARDS.find((c) => c.id === slug(row.name))!;
      expect(d, row.name).toBeDefined();
      expect(d.text).toBe(row.text);
      expect(d.cost).toBe(row.cost);
      expect(d.power).toBe(row.power);
      expect(d.toughness).toBe(row.toughness);
      if (row.types.some((t) => t === "Instant" || t === "Sorcery"))
        expect(d.spell, row.name).toBeDefined();
      if ("adventure" in row) {
        expect(d.adventure?.name, row.name).toBe(row.adventure!.name);
        expect(d.adventure?.spell, row.name).toBeDefined();
      }
    }
  });
  it("pays creature Bargain before entry and creates its Cursed Role", () => {
    const g = mk(),
      clue = put(g, 0, "tok-clue"),
      victim = put(g, 1, "topiary-panther"),
      spell = inHand(g, 0, "diminisher-witch");
    lands(g, 0, "island", 3);
    expect(castAlts(g, 0, spell)).toContain("bargain");
    cast(g, spell.id, [], { alt: "bargain", sac: clue.id });
    expect(clue.zone).toBe("graveyard");
    resolve(g);
    settleAll(g);
    expect(stats(g, victim).p).toBe(1);
    expect(stats(g, victim).t).toBe(1);
  });
  it("replacing a Wicked Role with a Royal Role removes only the same controller old Role and drains one life", () => {
    const g = mk(),
      c = put(g, 0, "novice-inspector");
    effect(g, c.id, [{ e: "role", what: "self", token: "tok-wicked-role" }]);
    settleAll(g);
    effect(g, c.id, [{ e: "role", what: "self", token: "tok-royal-role" }]);
    settleAll(g);
    expect(
      g.battlefield.filter(
        (id) =>
          g.cards[id].attachedTo === c.id &&
          g.cards[id].def.subtypes?.includes("Role"),
      ),
    ).toHaveLength(1);
    expect(g.players[1].life).toBe(19);
    expect(stats(g, c).p).toBe(2);
  });
  it("Cursed Role sets only base size and retains counters and pumps", () => {
    const g = mk(),
      c = put(g, 0, "topiary-panther");
    effect(g, c.id, [
      { e: "role", what: "self", token: "tok-cursed-role" },
      { e: "counters", what: "self", n: 2 },
      { e: "pump", what: "self", p: 3, t: 3 },
    ]);
    expect(stats(g, c).p).toBe(6);
    expect(stats(g, c).t).toBe(6);
  });
  it("Adventure exiles after resolution and permits the permanent later", () => {
    const g = mk(),
      c = inHand(g, 0, "virtue-of-loyalty");
    lands(g, 0, "plains", 7);
    cast(g, c.id, [], { alt: "adventure" });
    resolve(g);
    expect(c.zone).toBe("exile");
    expect(c.onAdventure).toBe(true);
    expect(
      g.battlefield.some((id) => g.cards[id].def.id === "tok-knight"),
    ).toBe(true);
  });
  it("Bargained Hamlet Glutton costs two less and still gains three life", () => {
    const g = mk(),
      clue = put(g, 0, "tok-clue"),
      c = inHand(g, 0, "hamlet-glutton");
    lands(g, 0, "forest", 5);
    cast(g, c.id, [], { alt: "bargain", sac: clue.id });
    resolve(g);
    settleAll(g);
    expect(g.players[0].life).toBe(23);
  });
  it("The Goose Mother uses X for counters and rounded-up half X Foods", () => {
    const g = mk(),
      c = inHand(g, 0, "the-goose-mother");
    lands(g, 0, "forest", 4);
    lands(g, 0, "island", 1);
    cast(g, c.id, [], { x: 3 });
    resolve(g);
    settleAll(g);
    expect(c.counters).toBe(3);
    expect(
      g.battlefield.filter((id) => g.cards[id].def.subtypes?.includes("Food")),
    ).toHaveLength(2);
  });
  it("a non-token Gruff Triplets makes exactly two copies without recursion", () => {
    const g = mk(),
      c = inHand(g, 0, "gruff-triplets");
    lands(g, 0, "forest", 6);
    cast(g, c.id);
    resolve(g);
    settleAll(g);
    expect(
      g.battlefield.filter((id) => g.cards[id].def.id === "gruff-triplets"),
    ).toHaveLength(3);
  });
  it("Princess exile remains exiled when its Saga is removed before chapter III", () => {
    const g = mk(),
      saga = put(g, 0, "the-princess-takes-flight"),
      c = put(g, 1, "topiary-panther");
    effect(
      g,
      saga.id,
      [{ e: "frontier", action: "woe:princessExile" }],
      [{ c: c.id }],
    );
    moveCard(g, saga, "graveyard");
    expect(c.zone).toBe("exile");
  });
  it("Seek the Beast expires at the beginning of the next own end step", () => {
    const g = mk(),
      source = put(g, 0, "questing-druid");
    const ids = g.players[0].library.slice(0, 2);
    effect(g, source.id, [{ e: "frontier", action: "woe:seekBeast" }]);
    expect(g.cards[ids[0]].playableUntil).toBe(g.turn);
    emit(g, { type: "step", step: "endStep", player: 0 });
    expect(g.cards[ids[0]].playableUntil).toBeLessThan(g.turn);
  });
  it("Prophetic Prism cannot produce free mana by itself", () => {
    const g = mk();
    put(g, 0, "prophetic-prism");
    expect(canPayCost(g, 0, parseCost("{G}"))).toBe(false);
    put(g, 0, "plains");
    expect(canPayCost(g, 0, parseCost("{G}"))).toBe(true);
  });
});
