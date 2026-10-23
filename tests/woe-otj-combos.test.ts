import { describe, it, expect } from "vitest";
import { mk, put, inHand, inGy, lands, resolve, settleAll } from "./helpers";
import { performAction, abilitiesFor, canPayCost } from "../src/engine/actions";
import { stats, copiableDefinition } from "../src/engine/state";
import { canAttack } from "../src/engine/combat";
import { parseCost } from "../src/engine/mana";
import { createToken, moveCard, emit } from "../src/engine/zones";
import type { Card, GameState, PID, TargetRef } from "../src/engine/types";
const cast = (
  g: GameState,
  pid: PID,
  c: Card,
  targets: (TargetRef | null)[] = [],
  extra: object = {},
) =>
  expect(
    performAction(g, pid, { type: "cast", card: c.id, targets, ...extra }),
  ).toBeNull();
const tokens = (g: GameState, id: string) =>
  g.battlefield
    .map((i) => g.cards[i])
    .filter((c) => c.token && c.def.id === id);
const opponent = (d: any) =>
  d.type === "targets"
    ? {
        type: "targets" as const,
        targets: d.specs.map(() => ({ p: 1 as const })),
      }
    : undefined;

describe("WOE / OTJ actual card combinations", () => {
  it("Virtue of Knowledge + Gruff Triplets makes four token copies without recursion", () => {
    const g = mk();
    put(g, 0, "virtue-of-knowledge");
    const triplets = inHand(g, 0, "gruff-triplets");
    lands(g, 0, "forest", 6);
    cast(g, 0, triplets);
    settleAll(g);
    expect(tokens(g, "gruff-triplets")).toHaveLength(4);
    expect(
      g.battlefield.filter((id) => g.cards[id].def.id === "gruff-triplets"),
    ).toHaveLength(5);
  });
  it("Knowledge + Annie Joins Up stack additively on Roxanne, then double each Meteorite trigger", () => {
    const g = mk();
    put(g, 0, "virtue-of-knowledge");
    put(g, 0, "annie-joins-up");
    const c = inHand(g, 0, "roxanne-starfall-savant");
    lands(g, 0, "forest", 4);
    lands(g, 0, "mountain", 1);
    cast(g, 0, c);
    settleAll(g, opponent);
    expect(tokens(g, "tok-otj-meteorite")).toHaveLength(3);
    expect(g.players[1].life).toBe(8);
  });
  it("MKM Delney + Knowledge give Novice Inspector three ETB triggers, not four", () => {
    const g = mk();
    put(g, 0, "delney-streetwise-lookout");
    put(g, 0, "virtue-of-knowledge");
    const c = inHand(g, 0, "novice-inspector");
    lands(g, 0, "plains", 1);
    cast(g, 0, c);
    settleAll(g);
    expect(tokens(g, "tok-clue")).toHaveLength(3);
  });
  it("Heartflame Duelist gives an Adventure lifelink and Imodane repeats its creature damage", () => {
    const g = mk();
    put(g, 0, "heartflame-duelist");
    put(g, 0, "imodane-the-pyrohammer");
    const victim = put(g, 1, "topiary-panther"),
      c = inHand(g, 0, "heartflame-duelist");
    lands(g, 0, "mountain", 3);
    cast(g, 0, c, [{ c: victim.id }], { alt: "adventure" });
    settleAll(g);
    expect(victim.damage).toBe(3);
    expect(g.players[0].life).toBe(23);
    expect(g.players[1].life).toBe(17);
  });
  it("Taii + Imodane use actual modified damage, and Taii draws for exactly lethal spell damage", () => {
    const g = mk();
    const taii = put(g, 0, "taii-wakeen-perfect-shot");
    put(g, 0, "imodane-the-pyrohammer");
    put(g, 0, "heartflame-duelist");
    const victim = put(g, 1, "topiary-panther"),
      c = inHand(g, 0, "heartflame-duelist");
    lands(g, 0, "mountain", 5);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: taii.id,
        ability: 0,
        x: 2,
        targets: [],
      }),
    ).toBeNull();
    resolve(g);
    cast(g, 0, c, [{ c: victim.id }], { alt: "adventure" });
    settleAll(g);
    expect(victim.zone).toBe("graveyard");
    expect(g.players[0].hand).toHaveLength(1);
    expect(g.players[0].life).toBe(25);
    expect(g.players[1].life).toBe(13);
  });
  it("Gisa + Geralf + Knowledge make two Zombies with two counters each from one crime", () => {
    const g = mk();
    put(g, 0, "gisa-the-hellraiser");
    put(g, 0, "geralf-the-fleshwright");
    put(g, 0, "virtue-of-knowledge");
    put(g, 0, "deepmuck-desperado");
    const victim = put(g, 1, "topiary-panther"),
      c = inHand(g, 0, "scorching-shot");
    lands(g, 0, "mountain", 2);
    cast(g, 0, c, [{ c: victim.id }]);
    settleAll(g);
    const zs = tokens(g, "tok-otj-zombie");
    expect(zs).toHaveLength(2);
    expect(zs.map((c) => c.counters)).toEqual([2, 2]);
    expect(zs.map((c) => stats(g, c).p)).toEqual([5, 5]);
    expect(g.players[1].library).toHaveLength(27);
  });
  it("Lilah plots Lightning Helix, which can be cast for free on a later turn", () => {
    const g = mk();
    put(g, 0, "lilah-undefeated-slickshot");
    const c = inHand(g, 0, "lightning-helix");
    lands(g, 0, "plains", 1);
    lands(g, 0, "mountain", 1);
    cast(g, 0, c, [{ p: 1 }]);
    settleAll(g);
    expect(c.zone).toBe("exile");
    expect(c.plottedTurn).toBe(g.turn);
    expect(
      performAction(g, 0, {
        type: "cast",
        card: c.id,
        alt: "plotted",
        targets: [{ p: 1 }],
      }),
    ).not.toBeNull();
    g.turn += 2;
    cast(g, 0, c, [{ p: 1 }], { alt: "plotted" });
    settleAll(g);
    expect(g.players[1].life).toBe(14);
    expect(g.players[0].life).toBe(26);
    expect(c.zone).toBe("graveyard");
  });
  it("High Noon permits a Chancellor copy of an Adventure without counting another cast", () => {
    const g = mk();
    put(g, 0, "high-noon");
    put(g, 0, "chancellor-of-tales");
    const c = inHand(g, 0, "frolicking-familiar");
    lands(g, 0, "mountain", 1);
    cast(g, 0, c, [{ p: 1 }], { alt: "adventure" });
    settleAll(g, opponent);
    expect(g.players[1].life).toBe(18);
    expect(g.players[0].spellsThisTurn).toBe(1);
    expect(g.players[0].instSorcThisTurn).toBe(1);
  });
  it("Ashiok replaces the life portion of Gisa ward without losing life", () => {
    const g = mk();
    put(g, 0, "ashiok-wicked-manipulator");
    const gisa = put(g, 1, "gisa-the-hellraiser"),
      c = inHand(g, 0, "scorching-shot");
    lands(g, 0, "mountain", 4);
    cast(g, 0, c, [{ c: gisa.id }]);
    settleAll(g);
    expect(g.players[0].life).toBe(20);
    expect(g.players[0].library).toHaveLength(28);
    expect(g.players[0].exile).toHaveLength(2);
    expect(gisa.zone).toBe("graveyard");
  });
  it("Lavaspur Boots grants ward one, allowing a Scorching Shot with one mana left", () => {
    const g = mk(),
      victim = put(g, 0, "topiary-panther"),
      boots = put(g, 0, "lavaspur-boots");
    boots.attachedTo = victim.id;
    g.active = 1;
    const c = inHand(g, 1, "scorching-shot");
    lands(g, 1, "mountain", 3);
    cast(g, 1, c, [{ c: victim.id }]);
    settleAll(g);
    expect(victim.zone).toBe("graveyard");
    expect(
      g.battlefield.filter(
        (id) => g.cards[id].controller === 1 && g.cards[id].tapped,
      ),
    ).toHaveLength(3);
  });
  it("Yenna can attach a copied Aura to a hexproof creature because the new attachment does not target", () => {
    const g = mk(),
      yenna = put(g, 0, "yenna-redtooth-regent"),
      host = put(g, 0, "topiary-panther"),
      enemy = put(g, 1, "topiary-panther"),
      aura = put(g, 0, "cooped-up");
    aura.attachedTo = host.id;
    lands(g, 0, "forest", 2);
    lands(g, 1, "forest", 1);
    const veil = inHand(g, 1, "snakeskin-veil");
    cast(g, 1, veil, [{ c: enemy.id }]);
    settleAll(g);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: yenna.id,
        ability: 0,
        targets: [{ c: aura.id }],
      }),
    ).toBeNull();
    resolve(g, (d) =>
      d.type === "choose" && d.prompt.includes("結附")
        ? { type: "choose", ids: [enemy.id] }
        : undefined,
    );
    expect(tokens(g, "cooped-up").some((c) => c.attachedTo === enemy.id)).toBe(
      true,
    );
  });
  it("Eriette stops an opponent creature enchanted by your Aura from attacking you", () => {
    const g = mk();
    put(g, 0, "eriette-of-the-charmed-apple");
    const enemy = put(g, 1, "topiary-panther"),
      aura = createToken(g, "tok-royal-role", 0, { attachTo: enemy.id });
    g.active = 1;
    expect(canAttack(g, enemy)).toBe(false);
    emit(g, { type: "step", step: "endStep", player: 0 });
    settleAll(g);
    expect(g.players[1].life).toBe(19);
    expect(g.players[0].life).toBe(21);
    moveCard(g, aura, "graveyard");
    expect(canAttack(g, enemy)).toBe(true);
  });
  it("Cauldron lends Blood Hustler to a countered creature and lets green mana pay its black ability", () => {
    const g = mk(),
      cauldron = put(g, 0, "agathas-soul-cauldron"),
      body = put(g, 0, "novice-inspector"),
      hustler = inGy(g, 0, "blood-hustler");
    put(g, 0, "gisa-the-hellraiser");
    lands(g, 0, "forest", 4);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: cauldron.id,
        ability: 0,
        targets: [{ c: hustler.id }],
      }),
    ).toBeNull();
    settleAll(g, (d) =>
      d.type === "targets"
        ? { type: "targets", targets: [{ c: body.id }] }
        : undefined,
    );
    expect(body.counters).toBe(1);
    const ability = abilitiesFor(g, body).findIndex(
      (a) => a.label?.includes("失去") || a.effects.some((e) => e.e === "lose"),
    );
    expect(ability).toBeGreaterThanOrEqual(0);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: body.id,
        ability,
        targets: [{ p: 1 }],
      }),
    ).toBeNull();
    settleAll(g);
    expect(g.players[1].life).toBe(19);
    expect(tokens(g, "tok-otj-zombie")).toHaveLength(2);
    moveCard(g, cauldron, "graveyard");
    expect(abilitiesFor(g, body)).toHaveLength(0);
  });
  it("Vraska returns an enemy Inspector as a Treasure without triggering Satoru, retaining its ETB ability", () => {
    const g = mk();
    put(g, 0, "vraska-the-silencer");
    put(g, 0, "satoru-the-infiltrator");
    const victim = put(g, 1, "novice-inspector"),
      c = inHand(g, 0, "scorching-shot");
    lands(g, 0, "mountain", 3);
    cast(g, 0, c, [{ c: victim.id }]);
    settleAll(g);
    expect(victim.controller).toBe(0);
    expect(victim.def.types).toEqual(["Artifact"]);
    expect(victim.def.subtypes).toEqual(["Treasure"]);
    expect(g.players[0].hand).toHaveLength(0);
    expect(tokens(g, "tok-clue")).toHaveLength(1);
    expect(copiableDefinition(victim).types).toContain("Creature");
  });
  it("two Food Fights grant one sacrifice ability dealing three damage, which commits a crime", () => {
    const g = mk();
    put(g, 0, "food-fight");
    put(g, 0, "food-fight");
    put(g, 0, "deepmuck-desperado");
    const food = createToken(g, "tok-food", 0),
      victim = put(g, 1, "topiary-panther");
    lands(g, 0, "mountain", 2);
    const i = abilitiesFor(g, food).findIndex((a) =>
      a.label?.includes("Food Fight"),
    );
    expect(
      performAction(g, 0, {
        type: "activate",
        card: food.id,
        ability: i,
        targets: [{ c: victim.id }],
      }),
    ).toBeNull();
    settleAll(g);
    expect(food.zone).toBe("graveyard");
    expect(victim.damage).toBe(3);
    expect(g.players[1].library).toHaveLength(27);
  });
  it("Virtue of Strength triples basics, leaving the correct surplus mana and no bonus on Arid Archway", () => {
    const g = mk();
    put(g, 0, "virtue-of-strength");
    lands(g, 0, "forest", 3);
    const c = inHand(g, 0, "hamlet-glutton");
    cast(g, 0, c);
    settleAll(g);
    expect(g.players[0].pool).toEqual(["G", "G"]);
    const h = mk();
    put(h, 0, "virtue-of-strength");
    put(h, 0, "arid-archway");
    expect(canPayCost(h, 0, parseCost("{3}"))).toBe(false);
  });
});

describe("damage-source and cross-set interaction boundaries", () => {
  it("Imodane repeats an ordinary resolving spell after it has left the stack list", () => {
    const g = mk();
    put(g, 0, "imodane-the-pyrohammer");
    const victim = put(g, 1, "topiary-panther"),
      c = inHand(g, 0, "scorching-shot");
    lands(g, 0, "mountain", 2);
    cast(g, 0, c, [{ c: victim.id }]);
    settleAll(g);
    expect(g.players[1].life).toBe(15);
    expect(victim.zone).toBe("graveyard");
    expect(g.resolvingSpell).toBeUndefined();
  });
  it("Imodane also sees Hell to Pay custom damage, and excess damage makes tapped Treasures", () => {
    const g = mk();
    put(g, 0, "imodane-the-pyrohammer");
    const victim = put(g, 1, "novice-inspector"),
      c = inHand(g, 0, "hell-to-pay");
    lands(g, 0, "mountain", 6);
    cast(g, 0, c, [{ c: victim.id }], { x: 5 });
    settleAll(g);
    expect(g.players[1].life).toBe(15);
    expect(tokens(g, "tok-treasure")).toHaveLength(3);
    expect(tokens(g, "tok-treasure").every((c) => c.tapped)).toBe(true);
  });
  it("Imodane ignores a spell targeting both a creature and a token", () => {
    const g = mk();
    put(g, 0, "imodane-the-pyrohammer");
    const creature = put(g, 1, "topiary-panther"),
      token = createToken(g, "tok-otj-zombie", 1),
      c = inHand(g, 0, "trick-shot");
    lands(g, 0, "mountain", 5);
    cast(g, 0, c, [{ c: creature.id }, { c: token.id }]);
    settleAll(g);
    expect(creature.zone).toBe("graveyard");
    expect(token.zone).toBe("graveyard");
    expect(g.players[1].life).toBe(20);
  });
  it("Imodane and spell lifelink do not apply when Burn Together makes a creature deal damage", () => {
    const g = mk();
    put(g, 0, "imodane-the-pyrohammer");
    put(g, 0, "heartflame-duelist");
    const body = put(g, 0, "novice-inspector"),
      victim = put(g, 1, "topiary-panther"),
      c = inHand(g, 0, "callous-sell-sword");
    lands(g, 0, "mountain", 1);
    cast(g, 0, c, [{ c: body.id }, { c: victim.id }], { alt: "adventure" });
    settleAll(g);
    expect(victim.damage).toBe(1);
    expect(body.zone).toBe("graveyard");
    expect(g.players[0].life).toBe(20);
    expect(g.players[1].life).toBe(20);
  });
  it("FIN Traveling Chocobo + Knowledge add two landfall triggers to OTJ Bristly Bill", () => {
    const g = mk(),
      bill = put(g, 0, "bristly-bill-spine-sower");
    put(g, 0, "traveling-chocobo");
    put(g, 0, "virtue-of-knowledge");
    const land = inHand(g, 0, "forest");
    expect(performAction(g, 0, { type: "play", card: land.id })).toBeNull();
    settleAll(g, (d) =>
      d.type === "targets"
        ? { type: "targets", targets: [{ c: bill.id }] }
        : undefined,
    );
    expect(bill.counters).toBe(3);
  });
  it("MSH Hawkeye modifies both Adventure damage and Imodane damage while Duelist gains only spell damage", () => {
    const g = mk();
    put(g, 0, "hawkeye-young-avenger");
    put(g, 0, "imodane-the-pyrohammer");
    put(g, 0, "heartflame-duelist");
    const victim = put(g, 1, "topiary-panther"),
      c = inHand(g, 0, "heartflame-duelist");
    lands(g, 0, "mountain", 3);
    cast(g, 0, c, [{ c: victim.id }], { alt: "adventure" });
    settleAll(g);
    expect(victim.zone).toBe("graveyard");
    expect(g.players[0].life).toBe(25);
    expect(g.players[1].life).toBe(13);
  });
});

it("ECL Sygg protection still forbids a colored Yenna Aura copy even though attachment does not target", () => {
  const g = mk(),
    yenna = put(g, 0, "yenna-redtooth-regent"),
    host = put(g, 0, "topiary-panther"),
    enemy = put(g, 1, "topiary-panther");
  put(g, 1, "sygg-wanderwine-wisdom");
  const aura = put(g, 0, "cooped-up");
  aura.attachedTo = host.id;
  lands(g, 0, "forest", 2);
  lands(g, 1, "plains", 1);
  g.active = 1;
  emit(g, { type: "step", step: "main1", player: 1 });
  settleAll(g, (d) =>
    d.type === "targets"
      ? { type: "targets", targets: [{ c: enemy.id }] }
      : undefined,
  );
  expect(stats(g, enemy).kw.has("protection_colors")).toBe(true);
  g.active = 0;
  expect(
    performAction(g, 0, {
      type: "activate",
      card: yenna.id,
      ability: 0,
      targets: [{ c: aura.id }],
    }),
  ).toBeNull();
  let choices: number[] = [];
  resolve(g, (d) => {
    if (d.type === "choose" && d.prompt.includes("結附")) {
      choices = d.options;
      return { type: "choose", ids: [host.id] };
    }
  });
  expect(choices).not.toContain(enemy.id);
  expect(tokens(g, "cooped-up")).toHaveLength(1);
});
