import { checkSBA } from "../src/engine/flow";
import { describe, it, expect } from "vitest";
import { CARDS, slug } from "../src/data";
import fdn from "../src/data/sets/fdn-catalog.json";
import dsk from "../src/data/sets/dsk-catalog.json";
import { mk, put, inHand, lands, resolve, settleAll, inGy } from "./helpers";
import {
  performAction,
  abilitiesFor,
  canActivate,
  canPayCost,
  manaSources,
  castAlts,
} from "../src/engine/actions";
import {
  enterBattlefield,
  moveCard,
  dealDamage,
  emit,
  gainLife,
  loseLife,
  putCounters,
  putIntoGraveyard,
} from "../src/engine/zones";
import { stats, isCreature } from "../src/engine/state";
import { manaValue, parseCost } from "../src/engine/mana";
import { poolSize } from "../src/meta/booster";
import { changeDoor } from "../src/engine/foundation-support";
import { runEffects } from "../src/engine/effects";
import { answerDefault } from "./helpers";
import type { Effect, GameState } from "../src/engine/types";
function effect(g: GameState, source: number, effects: Effect[]) {
  const f = runEffects(g, { source, controller: 0, targets: [] }, effects);
  let r = f.next();
  while (!r.done) r = f.next(answerDefault(g, r.value));
}
describe("FDN and DSK printed cards and mechanics", () => {
  it("contains the 512 FDN and 271 DSK unique nonbasic cards with printed characteristics", () => {
    expect(poolSize("FDN")).toBe(512);
    expect(poolSize("DSK")).toBe(271);
    for (const row of [...fdn, ...dsk]) {
      const c = CARDS.find((c) => c.id === slug(row.name));
      expect(c, row.name).toBeDefined();
      // Newer Oracle snapshots use 'this creature' in place of self names.
      const selfText=(text:string)=>text.replaceAll(row.name,'SELF').replace(/this (?:creature|enchantment|artifact|Vehicle|permanent|Aura|spell|land)/gi,'SELF').replace(/As it enters/g,'As SELF enters').replace(/\s+/g,' ');
      expect(selfText(c!.text), row.name).toBe(selfText(row.text));
      expect(c!.cost, row.name).toBe(row.cost);
      expect(c!.power, row.name).toBe(row.power);
      if (row.types.some((t) => t === "Instant" || t === "Sorcery"))
        expect(c!.spell, row.name).toBeDefined();
    }
  });
  it("Doubling Season doubles tokens and counters, including planeswalker entry but not loyalty costs", () => {
    const g = mk(),
      season = put(g, 0, "doubling-season"),
      elf = put(g, 0, "llanowar-elves");
    putCounters(g, elf, 2);
    expect(elf.counters).toBe(4);
    effect(g, season.id, [{ e: "token", token: "tok-g-cat-11-w", n: 2 }]);
    expect(
      g.battlefield.filter((id) => g.cards[id].def.id === "tok-g-cat-11-w"),
    ).toHaveLength(4);
    const pw = put(g, 0, "liliana-dreadhorde-general");
    expect(pw.loyalty).toBe(12);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: pw.id,
        ability: 0,
        targets: [],
      }),
    ).toBeNull();
    expect(pw.loyalty).toBe(13);
  });
  it("Bloodthirsty Conqueror and Marauding Blight-Priest form the printed life loop", () => {
    const g = mk();
    put(g, 0, "bloodthirsty-conqueror");
    put(g, 0, "marauding-blight-priest");
    loseLife(g, 1, 1);
    expect(() => settleAll(g)).toThrow("game over");
    expect(g.winner).toBe(0);
  });
  it("Ajani Pridemate gains one counter per life-gain event, not per life point", () => {
    const g = mk(),
      c = put(g, 0, "ajanis-pridemate");
    gainLife(g, 0, 5);
    settleAll(g);
    expect(c.counters).toBe(1);
  });
  it("Enduring Innocence returns as an enchantment and cannot return twice", () => {
    const g = mk(),
      c = put(g, 0, "enduring-innocence");
    putIntoGraveyard(g, [c]);
    settleAll(g);
    expect(c.zone).toBe("battlefield");
    expect(isCreature(c)).toBe(false);
    putIntoGraveyard(g, [c]);
    settleAll(g);
    expect(c.zone).toBe("graveyard");
  });
  it("an impending Overlord enters without creature type, triggers, and becomes a creature after its last end-step counter", () => {
    const g = mk(),
      c = inHand(g, 0, "overlord-of-the-mistmoors");
    lands(g, 0, "plains", 4);
    expect(
      performAction(g, 0, {
        type: "cast",
        card: c.id,
        alt: "impending",
        targets: [],
      }),
    ).toBeNull();
    resolve(g);
    settleAll(g);
    expect(isCreature(c)).toBe(false);
    expect(c.impendingTime).toBe(4);
    expect(
      g.battlefield.filter(
        (id) => g.cards[id].def.id === "tok-g-insect-21-w-flying",
      ),
    ).toHaveLength(2);
    for (let i = 0; i < 4; i++) {
      emit(g, { type: "step", step: "endStep", player: 0 });
      settleAll(g);
    }
    expect(isCreature(c)).toBe(true);
  });
  it("a Room cast unlocks only its chosen door, with the chosen mana value", () => {
    const g = mk(),
      c = inHand(g, 0, "dollmakers-shop-porcelain-gallery");
    lands(g, 0, "plains", 2);
    expect(
      performAction(g, 0, {
        type: "cast",
        card: c.id,
        alt: "roomLeft",
        targets: [],
      }),
    ).toBeNull();
    resolve(g);
    expect(c.roomUnlocked).toBe(1);
    expect(c.def.name).toBe("Dollmaker's Shop");
    expect(manaValue(c.def)).toBe(2);
    expect(
      c.def.abilities?.some(
        (a) => a.kind === "static" && a.frontier === "dsk:porcelainBase",
      ),
    ).toBe(false);
  });
  it("a Room put into play enters locked and unlocking is a sorcery-speed special action", () => {
    const g = mk(),
      c = put(g, 0, "dollmakers-shop-porcelain-gallery");
    expect(c.roomUnlocked).toBe(0);
    expect(manaValue(c.def)).toBe(0);
    lands(g, 0, "plains", 6);
    const ix = abilitiesFor(g, c).findIndex((a) => a.roomDoor === 1);
    expect(canActivate(g, 0, c, ix)).toBe(true);
    const n = g.stack.length;
    expect(
      performAction(g, 0, {
        type: "activate",
        card: c.id,
        ability: ix,
        targets: [],
      }),
    ).toBeNull();
    expect(g.stack.length).toBe(n);
    expect(c.roomUnlocked).toBe(2);
  });
  it("Survival triggers in second main only when tapped", () => {
    const g = mk(),
      c = put(g, 0, "defiant-survivor");
    g.pending = [];
    emit(g, { type: "step", step: "endStep", player: 0 });
    expect(g.pending).toHaveLength(0);
    c.tapped = true;
    emit(g, { type: "step", step: "main2", player: 0 });
    expect(g.pending.some((t) => t.source === c.id)).toBe(true);
  });
  it("fully unlocking a Room triggers eerie, locking a door does not", () => {
    const g = mk(),
      c = put(g, 0, "dollmakers-shop-porcelain-gallery"),
      gremlin = put(g, 0, "gremlin-tamer");
    g.pending = [];
    changeDoor(g, c, 0);
    expect(g.pending.some((t) => t.source === gremlin.id)).toBe(false);
    changeDoor(g, c, 1);
    expect(g.pending.some((t) => t.source === gremlin.id)).toBe(true);
    g.pending = [];
    changeDoor(g, c, 1, false);
    expect(g.pending.some((t) => t.source === gremlin.id)).toBe(false);
  });
});

describe("FDN / DSK costs and combinations", () => {
  it("Arahbo triggers on itself and does not loop on its Cat token", () => {
    const g = mk(),
      c = inHand(g, 0, "arahbo-the-first-fang");
    lands(g, 0, "plains", 3);
    expect(
      performAction(g, 0, { type: "cast", card: c.id, targets: [] }),
    ).toBeNull();
    resolve(g);
    settleAll(g);
    expect(
      g.battlefield.filter((id) => g.cards[id].def.id === "tok-g-cat-11-w"),
    ).toHaveLength(1);
  });
  it("Hare Apparent makes Rabbits, not Cats", () => {
    const g = mk();
    put(g, 0, "hare-apparent");
    const c = inHand(g, 0, "hare-apparent");
    lands(g, 0, "plains", 2);
    expect(
      performAction(g, 0, { type: "cast", card: c.id, targets: [] }),
    ).toBeNull();
    resolve(g);
    settleAll(g);
    expect(
      g.battlefield.filter(
        (id) =>
          g.cards[id].def.subtypes?.includes("Rabbit") && g.cards[id].token,
      ),
    ).toHaveLength(1);
  });
  it("Ghalta discounts the sum of creature powers", () => {
    const g = mk();
    put(g, 0, "topiary-panther");
    put(g, 0, "topiary-panther");
    const c = inHand(g, 0, "ghalta-primal-hunger");
    lands(g, 0, "forest", 2);
    expect(
      performAction(g, 0, { type: "cast", card: c.id, targets: [] }),
    ).toBeNull();
  });
  it("Kaito ninjutsu returns an unblocked attacker as a cost and enters attacking as a 3/4", () => {
    const g = mk(),
      attacker = put(g, 0, "llanowar-elves"),
      c = inHand(g, 0, "kaito-bane-of-nightmares");
    attacker.attacking = true;
    g.phase = "combat_blockers";
    g.blockersDeclared = true;
    lands(g, 0, "island", 2);
    lands(g, 0, "swamp", 1);
    const ix = abilitiesFor(g, c).findIndex((a) => a.foundationNinjutsu);
    expect(ix).toBeGreaterThanOrEqual(0);
    expect(
      performAction(g, 0, {
        type: "activate",
        card: c.id,
        ability: ix,
        targets: [],
        costCards: [attacker.id],
      }),
    ).toBeNull();
    expect(attacker.zone).toBe("hand");
    expect(c.zone).toBe("hand");
    resolve(g);
    settleAll(g);
    expect(c.zone).toBe("battlefield");
    expect(c.attacking).toBe(true);
    expect(c.def.types).toEqual(["Creature"]);
    expect(stats(g, c).p).toBe(3);
    expect(stats(g, c).t).toBe(4);
  });
  it("an Overlord returned normally does not retain impending", () => {
    const g = mk(),
      c = inHand(g, 0, "overlord-of-the-mistmoors");
    lands(g, 0, "plains", 4);
    expect(
      performAction(g, 0, {
        type: "cast",
        card: c.id,
        alt: "impending",
        targets: [],
      }),
    ).toBeNull();
    resolve(g);
    settleAll(g);
    putIntoGraveyard(g, [c]);
    enterBattlefield(g, c, 0);
    expect(isCreature(c)).toBe(true);
    expect(c.impendingTime).toBeUndefined();
  });
  it("Leyline of the Void replaces death and stops Enduring return", () => {
    const g = mk();
    put(g, 1, "leyline-of-the-void");
    const c = put(g, 0, "enduring-innocence");
    putIntoGraveyard(g, [c]);
    settleAll(g);
    expect(c.zone).toBe("exile");
  });
  it("Grimoire prevents losing for zero life but not an empty-library draw", () => {
    const g = mk();
    put(g, 0, "marina-vendrells-grimoire");
    g.players[0].life = 0;
    expect(() => checkSBA(g)).not.toThrow();
    g.players[0].drewFromEmpty = true;
    expect(() => checkSBA(g)).toThrow("game over");
  });
  it("Gilded Lotus can pay three mana of one color automatically", () => {
    const g = mk();
    put(g, 0, "gilded-lotus");
    expect(canPayCost(g, 0, parseCost("{U}{U}{U}"))).toBe(true);
    expect(canPayCost(g, 0, parseCost("{U}{B}{R}"))).toBe(false);
  });
  it("a Verge provides its second color only with the required basic land type", () => {
    const g = mk(),
      c = put(g, 0, "gloomlake-verge");
    expect(manaSources(g, 0).find((s) => s.id === c.id)?.produces).toEqual([
      "U",
    ]);
    put(g, 0, "swamp");
    expect(manaSources(g, 0).find((s) => s.id === c.id)?.produces).toEqual([
      "U",
      "B",
    ]);
  });
  it("Fear of Abduction exiles a friendly creature as a cost and returns it when Abduction leaves", () => {
    const g = mk(),
      food = put(g, 0, "llanowar-elves"),
      victim = put(g, 1, "topiary-panther"),
      c = inHand(g, 0, "fear-of-abduction");
    lands(g, 0, "plains", 6);
    expect(
      performAction(g, 0, {
        type: "cast",
        card: c.id,
        targets: [],
        foundationCosts: [food.id],
      }),
    ).toBeNull();
    expect(food.zone).toBe("exile");
    resolve(g);
    settleAll(g);
    expect(victim.zone).toBe("exile");
    moveCard(g, c, "hand");
    settleAll(g);
    expect(food.zone).toBe("hand");
    expect(victim.zone).toBe("hand");
  });
  it("Chandra divides all eight damage among the chosen targets", () => {
    const g = mk(),
      c = put(g, 0, "chandra-flameshaper"),
      a = put(g, 1, "topiary-panther"),
      b = put(g, 1, "topiary-panther");
    const ix = abilitiesFor(g, c).findIndex(
      (ab) => ab.foundationDistribution === 8 && ab.targets?.length === 2,
    );
    expect(
      performAction(g, 0, {
        type: "activate",
        card: c.id,
        ability: ix,
        targets: [{ c: a.id }, { c: b.id }],
        distribution: [3, 5],
      }),
    ).toBeNull();
    resolve(g);
    expect(a.damage).toBe(3);
    expect(b.damage).toBe(5);
  });
  it("Twinflame Tyrant and Gratuitous Violence each double creature damage", () => {
    const g = mk();
    put(g, 0, "twinflame-tyrant");
    put(g, 0, "gratuitous-violence");
    const elf = put(g, 0, "llanowar-elves");
    expect(dealDamage(g, elf, 0, { p: 1 }, 2)).toBe(8);
  });
  it("The Mindskinner mills without damage, life loss or lifelink", () => {
    const g = mk(),
      c = put(g, 0, "the-mindskinner"),
      n = g.players[1].library.length;
    expect(dealDamage(g, c, 0, { p: 1 }, 4)).toBe(0);
    expect(g.players[1].life).toBe(20);
    expect(g.players[1].library).toHaveLength(n - 4);
  });
  it("Muldrotha permits only one permanent of each type per own turn", () => {
    const g = mk();
    put(g, 0, "muldrotha-the-gravetide");
    const a = inGy(g, 0, "llanowar-elves"),
      b = inGy(g, 0, "llanowar-elves");
    lands(g, 0, "forest", 2);
    expect(castAlts(g, 0, a)).toContain(undefined);
    expect(
      performAction(g, 0, { type: "cast", card: a.id, targets: [] }),
    ).toBeNull();
    resolve(g);
    expect(castAlts(g, 0, b)).toEqual([]);
  });
  it("Nowhere to Run permits targeting hexproof creatures and skips their ward", () => {
    const g = mk();
    put(g, 0, "nowhere-to-run");
    const c = put(g, 1, "valgavoth-terror-eater");
    c.hexproofCounters = 1;
    const spell = inHand(g, 0, "murder");
    lands(g, 0, "swamp", 3);
    expect(
      performAction(g, 0, {
        type: "cast",
        card: spell.id,
        targets: [{ c: c.id }],
      }),
    ).toBeNull();
    expect(
      g.pending.some((t) =>
        t.ability.effects.some(
          (e) => e.e === "frontier" && e.action === "fdn:wardSpecial",
        ),
      ),
    ).toBe(false);
    resolve(g);
    expect(c.zone).toBe("graveyard");
  });
  it("Nine-Lives Familiar returns at the next end step with one fewer counter", () => {
    const g = mk(),
      c = inHand(g, 0, "nine-lives-familiar");
    lands(g, 0, "swamp", 3);
    expect(
      performAction(g, 0, { type: "cast", card: c.id, targets: [] }),
    ).toBeNull();
    resolve(g);
    expect(c.charge).toBe(8);
    putIntoGraveyard(g, [c]);
    settleAll(g);
    expect(c.zone).toBe("graveyard");
    emit(g, { type: "step", step: "endStep", player: 0 });
    settleAll(g);
    expect(c.zone).toBe("battlefield");
    expect(c.charge).toBe(7);
  });
});

describe("printed named tokens", () => {
  it("Kiora creates legendary blue 8/8 Scion of the Deep", () => {
    const g = mk(),
      c = put(g, 0, "kiora-the-rising-tide");
    for (let i = 0; i < 7; i++) inGy(g, 0, "plains");
    emit(g, { type: "attacks", card: c.id });
    settleAll(g);
    const scion = g.battlefield
      .map((id) => g.cards[id])
      .find((c) => c.def.name === "Scion of the Deep")!;
    expect(stats(g, scion)).toMatchObject({ p: 8, t: 8 });
    expect(scion.def.subtypes).toEqual(["Octopus"]);
    expect(scion.def.supertypes).toContain("Legendary");
  });
  it("Everywhere is a tapped land with all five basic types", () => {
    const g = mk(),
      c = put(g, 0, "overlord-of-the-hauntwoods");
    emit(g, { type: "attacks", card: c.id });
    settleAll(g);
    const land = g.battlefield
      .map((id) => g.cards[id])
      .find((c) => c.def.name === "Everywhere")!;
    expect(land.tapped).toBe(true);
    expect(land.def.types).toEqual(["Land"]);
    expect(land.def.subtypes).toHaveLength(5);
    expect(land.def.produces).toHaveLength(5);
  });
  it("Niko Shards are noncreature enchantments with their sacrifice ability", () => {
    const g = mk(),
      c = put(g, 0, "niko-light-of-hope");
    effect(g, c.id, [{ e: "token", token: "tok-dsk-shard", n: 2 }]);
    const shards = g.battlefield
      .map((id) => g.cards[id])
      .filter((c) => c.def.subtypes?.includes("Shard"));
    expect(shards).toHaveLength(2);
    expect(
      shards.every(
        (c) => !isCreature(c) && abilitiesFor(g, c).some((a) => a.cost.sacSelf),
      ),
    ).toBe(true);
  });
});

it("Say Its Name exiles itself and two other copies before its ability resolves", () => {
  const g = mk();
  inGy(g, 0, "say-its-name");
  inGy(g, 0, "say-its-name");
  inGy(g, 0, "say-its-name");
  const c = inGy(g, 0, "say-its-name");
  expect(
    performAction(g, 0, {
      type: "activate",
      card: c.id,
      ability: 0,
      targets: [],
    }),
  ).toBeNull();
  expect(c.zone).toBe("exile");
  expect(
    g.players[0].exile.filter((id) => g.cards[id].def.id === "say-its-name"),
  ).toHaveLength(3);
  expect(g.stack).toHaveLength(1);
});

it("Undead Sprinter has graveyard permission during the opponent turn when High Fae Trickster grants flash", () => {
  const g = mk();
  put(g, 0, "high-fae-trickster");
  const victim = put(g, 1, "llanowar-elves");
  g.active = 1;
  g.phase = "main1";
  putIntoGraveyard(g, [victim]);
  const c = inGy(g, 0, "undead-sprinter");
  lands(g, 0, "swamp", 1);
  lands(g, 0, "mountain", 1);
  expect(castAlts(g, 0, c)).toContain(undefined);
  expect(
    performAction(g, 0, { type: "cast", card: c.id, targets: [] }),
  ).toBeNull();
  resolve(g);
  expect(c.counters).toBe(1);
});

it("Fog Bank cannot deal combat damage to players even after a power boost", () => {
  const g = mk(),
    c = put(g, 0, "fog-bank");
  g.eot.push({ card: c.id, p: 4, t: 0, kw: [] });
  expect(stats(g, c).p).toBe(4);
  expect(dealDamage(g, c, 0, { p: 1 }, 4, { combat: true })).toBe(0);
  expect(g.players[1].life).toBe(20);
  expect(dealDamage(g, c, 0, { p: 1 }, 1)).toBe(1);
});
