import generated from "./frontier-tokens.json";
import type { CardDef, Effect, TriggeredAbility } from "../../engine/types";
const event = (
  frontierEvent: string,
  effects: Effect[],
  extra: Partial<TriggeredAbility> = {},
): TriggeredAbility => ({
  kind: "trigger",
  on: "frontierEvent",
  frontierEvent,
  effects,
  ...extra,
});
const body = (
  id: string,
  name: string,
  power: number,
  toughness: number,
  subtypes: string[],
  colors: CardDef["colors"],
  keywords: CardDef["keywords"] = [],
  abilities: CardDef["abilities"] = [],
): CardDef => ({
  id,
  name,
  power,
  toughness,
  subtypes,
  colors,
  keywords,
  abilities,
  set: "TOK",
  rarity: "T",
  types: ["Creature"],
  text: "",
});
export function completeFrontierTokens(tokens: CardDef[]) {
  const entries: CardDef[] = [
    ...generated.map(
      (d) => ({ ...d, set: "TOK" as const, rarity: "T" as const }) as CardDef,
    ),
    body(
      "tok-woe-rat",
      "Rat",
      1,
      1,
      ["Rat"],
      ["B"],
      [],
      [{ kind: "static", self: { grant: { cantBlock: true } } }],
    ),
    body("tok-woe-bird", "Bird", 1, 1, ["Bird"], ["W"], ["flying"]),
    body("tok-woe-mouse", "Mouse", 1, 1, ["Mouse"], ["W"]),
    body("tok-woe-human", "Human", 1, 1, ["Human"], ["W"]),
    body("tok-woe-beast", "Beast", 3, 3, ["Beast"], ["G"]),
    body("tok-woe-elemental", "Elemental", 4, 4, ["Elemental"], ["W", "U"]),
    body("tok-woe-fae-court", "Faerie", 1, 1, ["Faerie"], ["U"], ["flying"]),
    body(
      "tok-woe-nightmare",
      "Nightmare",
      1,
      1,
      ["Nightmare"],
      ["B"],
      [],
      [
        {
          kind: "trigger",
          on: "combatStart",
          cond: { c: "frontier", action: "exiledThisTurn" },
          effects: [{ e: "counters", what: "self", n: 1 }],
        },
      ],
    ),
    body(
      "tok-otj-mercenary",
      "Mercenary",
      1,
      1,
      ["Mercenary"],
      ["R"],
      [],
      [
        {
          kind: "activated",
          cost: { tap: true },
          sorcery: true,
          targets: [{ kind: "creature", filter: { ctrl: "you" } }],
          effects: [{ e: "pump", what: "T0", p: 1, t: 0 }],
          label: "己方生物+1/+0",
        },
      ],
    ),
    body(
      "tok-otj-zombie",
      "Zombie Rogue",
      2,
      2,
      ["Zombie", "Rogue"],
      ["U", "B"],
    ),
    body("tok-otj-sheep", "Sheep", 1, 1, ["Sheep"], ["W"]),
    body("tok-otj-ox", "Ox", 2, 2, ["Ox"], ["W"]),
    body("tok-otj-spirit", "Spirit", 2, 2, ["Spirit"], ["W"], ["flying"]),
    body(
      "tok-otj-scorpion-dragon",
      "Scorpion Dragon",
      4,
      4,
      ["Scorpion", "Dragon"],
      ["R"],
      ["flying", "haste"],
    ),
    body("tok-otj-dinosaur", "Dinosaur", 3, 1, ["Dinosaur"], ["R"]),
    body("tok-otj-varmint", "Varmint", 2, 1, ["Varmint"], ["G"]),
    body(
      "tok-otj-vampire",
      "Vampire Rogue",
      1,
      1,
      ["Vampire", "Rogue"],
      ["B"],
      ["lifelink"],
    ),
    {
      ...body("tok-otj-beau", "Beau", 0, 0, ["Ox"], ["U"]),
      supertypes: ["Legendary"],
    },
    body("tok-otj-angel", "Angel", 3, 3, ["Angel"], ["W"], ["flying"]),
    body("tok-otj-elk", "Elk", 3, 3, ["Elk"], ["G"]),
    body("tok-otj-bird", "Bird", 1, 1, ["Bird"], ["U"], ["flying"]),
    {
      id: "tok-otj-meteorite",
      name: "Meteorite",
      set: "TOK",
      rarity: "T",
      types: ["Artifact"],
      colors: [],
      text: "",
      produces: ["W", "U", "B", "R", "G"],
      abilities: [
        {
          kind: "trigger",
          on: "etb",
          targets: [{ kind: "any" }],
          effects: [{ e: "damage", to: "T0", n: 2 }],
        },
      ],
    },
    ...["royal", "sorcerer", "young-hero", "wicked", "cursed", "monster"].map(
      (kind): CardDef => ({
        id: "tok-" + kind + "-role",
        name: kind + " Role",
        set: "TOK",
        rarity: "T",
        types: ["Enchantment"],
        subtypes: ["Aura", "Role"],
        colors: [],
        text: "",
        aura: {
          target: { kind: "creature" },
          grant:
            kind === "cursed"
              ? {}
              : kind === "young-hero"
                ? {}
                : {
                    p: 1,
                    t: 1,
                    ...(kind === "monster" ? { kw: ["trample" as const] } : {}),
                  },
        },
        abilities:
          kind === "royal"
            ? [{ kind: "static", frontier: "royalWard" }]
            : kind === "wicked"
              ? [
                  event("selfToGrave", [{ e: "lose", who: "opp", n: 1 }], {
                    fromGraveyard: true,
                  }),
                ]
              : kind === "sorcerer"
                ? [event("attachedAttack", [{ e: "scry", n: 1 }])]
                : kind === "young-hero"
                  ? [
                      event("attachedAttack", [
                        { e: "frontier", action: "woe:youngHero" },
                      ]),
                    ]
                  : [],
      }),
    ),
  ];
  for (const d of entries) {
    const old = tokens.find((t) => t.id === d.id);
    if (old) Object.assign(old, d);
    else tokens.push(d);
  }
}
