import catalog from "./woe-catalog.json";
import auto from "./woe-auto.json";
import { act, etb, trig, CR, MY_CR, OPP_CR, ANY, OPP } from "../dsl";
import {
  setBuilder,
  spec,
  gy,
  mine,
  opp,
  draw,
  food,
  treasure,
  token,
  pump,
  cnt,
  dmg,
  destroy,
  exile,
  gain,
  lose,
  role,
  rolePay,
  chapter,
  subsets,
  barFilter,
} from "./frontier-dsl";
import type { Effect, Ability } from "../../engine/types";
const { d, a, s, adv, modes, saga, E, C, N, F, event, complete } = setBuilder(
  "WOE",
  catalog,
  auto,
);
const rat = (n: any = 1) => token("tok-woe-rat", n),
  bird = token("tok-woe-bird"),
  knight = token("tok-knight");
const bar = (n: number, normal: Effect[], paid: Effect[], targets: any[]) =>
  modes(n, [
    { text: "不交易", effects: normal, targets },
    { text: "交易", sac: barFilter, effects: paid, targets },
  ]);
const enchanted = (p: number, t: number): Ability => ({
  kind: "static",
  frontier: "enchantedAnthem",
  anthem: {
    filter: { ctrl: "you", type: "Creature", enchanted: true },
    grant: { p, t },
  },
});
a(1, [F("roseBase")]);
bar(2, [pump("T0", 2, 2)], [pump("T0", 2, 2, ["flying", "lifelink"])], [CR]);
adv(4, [role("royal")], [MY_CR]);
s(5, [E(5)], [spec("permanent", { type: "Enchantment" })]);
a(6, [etb([role("royal")], { targets: [{ ...MY_CR, notSelf: true }] })]);
adv(7, [pump("T0", 1, 1), E("smallBlockers", "T0", 3)], [MY_CR]);
d(8, {
  aura: { target: CR, grant: { cantAttack: true, cantBlock: true } },
  abilities: [
    act(
      { mana: "{2}{W}" },
      [{ e: "exile", what: "attached" }],
      "放逐所結附生物",
    ),
  ],
});
a(9, [etb([role("cursed", "self")])]);
a(10, [
  trig("upkeep", [treasure], { cond: C("oppMoreLands") }),
  act({ mana: "{2}{W}" }, [E(10), draw], "贈送珍寶並抓牌", {
    targets: [spec("permanent", { ctrl: "you", sub: "Treasure" })],
  }),
]);
a(11, [
  act(
    { mana: "{2}{W}" },
    [{ e: "toHand", what: "selfAny" }],
    "犧牲兩個結界：從墳墓場回手",
    { fromGraveyard: true, sacN: { n: 2, filter: { type: "Enchantment" } } },
  ),
]);
s(12, [E(12)]);
s(13, [E(13)]);
a(14, [
  act({ mana: "{2}{W}", tap: true }, [{ e: "tap", what: "T0" }], "橫置生物", {
    targets: [CR],
  }),
]);
a(15, [
  {
    kind: "static",
    self: { cond: { c: "celebration" }, grant: { kw: ["double_strike"] } },
  },
]);
a(16, [
  etb([{ e: "exileLinked", what: "T0" }], {
    targets: [spec("creature", { ctrl: "opp", mvMax: 3 })],
  }),
]);
a(17, [
  etb([knight]),
  event("selfToGrave", [{ e: "scry", n: 2 }]),
  act({ mana: "{2}{W}" }, [{ e: "sac", what: "self" }], "犧牲"),
]);
bar(18, [dmg(3)], [destroy], [spec("creature", { inCombat: true })]);
a(19, [event("enchantGy", [bird])]);
a(20, []);
modes(20, [
  {
    text: "重置並強化",
    effects: [{ e: "untap", what: "T0" }, pump("T0", 1, 0, ["indestructible"])],
    targets: [CR],
  },
  {
    text: "消滅大生物",
    effects: [destroy],
    targets: [spec("creature", { powMin: 4 })],
  },
]);
a(21, [
  etb([
    pump(
      mine,
      { count: { ctrl: "you", type: "Creature" } },
      { count: { ctrl: "you", type: "Creature" } },
      ["flying"],
    ),
  ]),
]);
saga(23, [
  chapter([E("princessExile")], [{ ...CR, optional: true }]),
  chapter([pump("T0", 2, 2, ["flying"])], [MY_CR]),
  chapter([E("returnLinked")]),
]);
a(24, [
  trig("dies", [role("young-hero")], {
    targets: [{ ...MY_CR, optional: true }],
  }),
]);
a(25, [F("bunnicorn")]);
s(
  26,
  [{ e: "reanimate", what: "T0" }, role("young-hero")],
  [gy({ type: "Creature", mvMax: 3 })],
);
a(27, [
  trig("allyPermEtb", [{ e: "tap", what: "T0" }], {
    filter: { type: "Enchantment" },
    targets: [OPP_CR],
  }),
]);
a(28, [event("enchantGy", [cnt("self")])]);
a(29, [
  trig("allyPermEtb", [{ e: "scry", n: 1 }], {
    filter: { type: "Enchantment" },
  }),
  act(
    { mana: "{2}{W}" },
    [
      pump(
        "self",
        { count: { ctrl: "you", type: "Enchantment" } },
        { count: { ctrl: "you", type: "Enchantment" } },
      ),
    ],
    "依結界數強化",
  ),
]);
a(30, [
  etb([{ e: "stun", what: "T0" }], { targets: [OPP_CR] }),
  event("tapOpp", [cnt("T0")], { targets: [MY_CR] }),
]);
a(31, [trig("combatStart", [rolePay("{1}", "sorcerer", [MY_CR])])]);
a(32, [
  etb([E(32)], {
    targets: [
      {
        ...spec("permanent", { ctrl: "you", nonType: "Land" }, true),
        notSelf: true,
      },
    ],
  }),
]);
s(33, [E(33)], [spec("permanent", { nonType: "Land" })]);
a(34, [enchanted(2, 2)]);
saga(35, [
  chapter([token("tok-woe-mouse")]),
  chapter([E("copyToken")], [spec("permanent", { ctrl: "you", token: true })]),
  chapter([E("copyToken")], [spec("permanent", { ctrl: "you", token: true })]),
  chapter([pump(mine, 1, 1, ["vigilance"])]),
]);
a(37, [
  etb([
    {
      e: "costThen",
      prompt: "支付{2}派角色？",
      cost: { mana: "{2}" },
      then: [role("sorcerer", "self")],
    },
  ]),
]);
a(38, [trig("endStep", [cnt(mine), { e: "untap", what: mine }])]);
a(39, [
  etb([{ e: "exileLinked", what: "T0" }], {
    targets: [{ ...spec("creature", { nonSub: "Fox" }, true), notSelf: true }],
  }),
  act({ mana: "{1}{W}", sacSelf: true }, [gain(2)], "犧牲：獲得2生命"),
]);
a(40, [event("firstInstSorc", [pump("self", 2)])]);
adv(40, [E("topLibrary")], [gy({ type: ["Instant", "Sorcery"] })]);
modes(42, [
  { text: "派詛咒角色", effects: [role("cursed", opp)] },
  {
    text: "閃現施放（另付{2}）",
    cost: "{4}{U}{U}",
    effects: [role("cursed", opp)],
  },
]);
d(42, { frontier: { flashMode: 1 } });
d(44, {
  aura: { target: CR, grant: { noUntap: true } },
  abilities: [
    etb([{ e: "tap", what: "attached" }]),
    event("selfToGrave", [
      {
        e: "costThen",
        prompt: "支付{1}占卜並抓牌？",
        cost: { mana: "{1}" },
        then: [{ e: "scry", n: 1 }, draw],
      },
    ]),
  ],
});
a(45, [
  event("adventureCast", [
    { e: "may", prompt: "複製冒險咒語？", effects: [{ e: "copySpell" }] },
  ]),
]);
a(46, [etb([role("cursed")], { cond: C("bargained"), targets: [OPP_CR] })]);
s(47, [{ e: "counter", what: "T0" }], [spec("spell", { mvMin: 4 })]);
a(48, [
  etb([E(48)], { frontierDynamic: "creaturesX" }),
  event("creatureFromExile", [draw], { oncePerTurn: true }),
]);
bar(
  49,
  [{ e: "dig", n: 4, take: 2, rest: "bottom", randomBottom: true }],
  [{ e: "dig", n: 8, take: 2, rest: "bottom", randomBottom: true }],
  [],
);
saga(51, [
  chapter([role("cursed")], [{ ...CR, optional: true }]),
  chapter([{ e: "scry", n: 2 }]),
  chapter([E(51)]),
]);
a(52, [
  trig("castAny", [{ e: "stun", what: "T0" }], {
    filter: { mvMin: 5 },
    targets: [OPP_CR],
  }),
]);
d(53, { etbTappedUnless: { c: "yourTurn" } });
adv(
  53,
  [{ e: "topOrBottom", what: "T0" }],
  [spec("creature", { ctrl: "opp", attacking: true })],
);
modes(54, [
  {
    text: "不交易",
    effects: [{ e: "counter", what: "T0" }],
    targets: [spec("spell")],
  },
  {
    text: "交易",
    sac: barFilter,
    cost: "{U}{U}",
    effects: [{ e: "counter", what: "T0" }],
    targets: [spec("spell")],
  },
]);
a(55, [
  trig("attacks", [
    {
      e: "costThen",
      prompt: "支付{1}{U}橫置生物？",
      cost: { mana: "{1}{U}" },
      then: [
        {
          e: "reflexive",
          targets: [OPP_CR],
          effects: [{ e: "tap", what: "T0" }],
        },
      ],
    },
  ]),
  event("tapOpp", [pump("self", 2, 1)]),
]);
d(56, { etbCountersX: true });
a(56, [F("skulk"), trig("upkeep", [E(56)])]);
s(57, [{ e: "draw", n: 3 }, token("tok-woe-fae-court")]);
modes(58, [
  {
    text: "不交易",
    effects: [{ e: "bounce", what: "T0" }, draw],
    targets: [spec("permanent", { nonType: "Land" })],
  },
  {
    text: "交易",
    sac: barFilter,
    cost: "{1}{U}",
    effects: [{ e: "bounce", what: "T0" }, draw],
    targets: [spec("permanent", { nonType: "Land" })],
  },
]);
a(59, [
  act(
    { mana: "{1}", sacSelf: true },
    [draw, role("sorcerer")],
    "犧牲：抓牌與角色",
    { sorcery: true, targets: [{ ...MY_CR, notSelf: true, optional: true }] },
  ),
]);
s(61, [{ e: "topOrBottom", what: "T0" }], [CR]);
a(62, [
  {
    kind: "static",
    spellCostLess: { filter: { type: ["Instant", "Sorcery"] }, n: 1 },
  },
]);
adv(64, [
  { e: "mill", n: 4 },
  {
    e: "retrieveMilled",
    filter: { or: [{ type: ["Instant", "Sorcery"] }, { sub: "Faerie" }] },
  },
]);
d(66, { etbTapped: true, frontier: { enterStun: 3 } });
a(66, [act({ mana: "{1}{U}" }, [{ e: "untap", what: "self" }], "重置")]);
s(67, [{ e: "dig", n: 2, take: 1, rest: "bottom" }]);
a(68, [etb([rolePay("{2}", "", [])])]);
a(68, [
  etb([
    {
      e: "costThen",
      prompt: "支付{2}？",
      cost: { mana: "{2}" },
      then: [
        {
          e: "reflexive",
          targets: [OPP_CR],
          effects: [{ e: "stun", what: "T0" }],
        },
      ],
    },
  ]),
]);
s(69, [E(69)], [spec("spell")]);
a(70, [
  trig("castInstSorc", [role("sorcerer")], {
    targets: [{ ...MY_CR, notSelf: true, optional: true }],
  }),
]);
a(71, [trig("castAny", [cnt("self", 2)], { filter: { mvMin: 5 } })]);
s(
  72,
  [
    { e: "stun", what: "T0" },
    { e: "stun", what: "T1" },
  ],
  [OPP_CR, { ...OPP_CR, optional: true }],
);
a(73, [event("faerieAttack", [E(73)])]);
a(74, [
  etb([{ e: "toHand", what: "T0" }], {
    cond: C("bargained"),
    targets: [gy({ type: ["Instant", "Sorcery"] })],
  }),
]);
adv(75, [{ e: "tap", what: "T0" }, role("cursed")], [CR]);
a(76, [F("knowledgeDouble")]);
adv(76, [E("copyAbility")]);
d(76, {
  adventure: {
    ...catalog.find((c) => c.number === 76)!.adventure,
    spell: { effects: [E("copyAbility")] },
    frontierStack: "ownAbility",
  },
} as any);
s(
  77,
  [
    { e: "setBase", what: "T0", p: 4, t: 4 },
    pump("T0", 0, 0, ["flying", "hexproof"]),
  ],
  [MY_CR],
);
a(78, [
  F("ashiokLife"),
  act({ loyalty: 1 }, [E(78)], "+1"),
  act({ loyalty: -2 }, [token("tok-woe-nightmare", 2)], "-2"),
  act({ loyalty: -7 }, [E("ashiokExile")], "-7", { targets: [spec("player")] }),
]);
a(79, [event("enchantGy", [draw])]);
bar(
  80,
  [
    { e: "toHand", what: "T0" },
    { e: "toHand", what: "T1" },
  ],
  [E(80)],
  [gy({ type: "Creature" }, true), gy({ type: "Creature" }, true)],
);
a(81, [
  {
    kind: "static",
    self: {
      cond: { c: "controls", filter: { sub: "Faerie", other: true } },
      grant: { kw: ["lifelink"] },
    },
  },
  act({ mana: "{2}{B}" }, [pump("self", 1)], "+1/+0"),
]);
bar(82, [E(82)], [E(82)], []);
bar(83, [pump("T0", -3, -3)], [pump("T0", -5, -5)], [CR]);
a(85, [
  trig("castAny", [pump("T0", -1, -1)], {
    cond: { c: "notYourTurn" },
    targets: [{ ...OPP_CR, optional: true }],
  }),
]);
s(86, [E(86)], [OPP]);
s(87, [E(87)], [spec("permanent", { type: ["Creature", "Planeswalker"] })]);
d(87, { costReduce: { cond: { c: "lifeLte", n: 5 }, mana: "{2}" } });
s(
  88,
  [{ e: "discard", who: "opp", n: 2 }, role("wicked")],
  [{ ...MY_CR, optional: true }],
);
a(89, [
  etb([{ e: "surveil", n: 1 }]),
  act(
    { mana: "{2}{B}", exileSelf: true },
    [draw, lose(1, "you")],
    "從墳墓場放逐：抓牌",
    { fromGraveyard: true },
  ),
]);
s(90, [E(90)], [CR]);
s(
  91,
  [destroy, { e: "if", cond: { c: "yourTurn" }, then: [food] }],
  [spec("creature", { mvMax: 3 })],
);
a(92, [trig("dies", [{ e: "toLibraryBottom", what: "selfAny" }])]);
a(93, [
  etb(
    [
      pump(
        "T0",
        { negOf: { lifeGained: true } },
        { negOf: { lifeGained: true } },
      ),
    ],
    { targets: [{ ...CR, optional: true }] },
  ),
]);
a(94, [etb([lose(3), gain(3)], { cond: C("bargained") })]);
a(95, [
  etb([{ e: "discard", who: "opp", n: 1 }, lose(2)]),
  event("selfToGrave", [{ e: "scry", n: 2 }]),
  act({ mana: "{2}{B}" }, [{ e: "sac", what: "self" }], "犧牲"),
]);
s(96, [E(96)]);
a(97, [
  trig("allyEtb", [exile], {
    filter: { sub: "Rat", other: true },
    targets: [spec("gyCard", { ctrl: "opp" }, true)],
  }),
  trig("combatStart", [rat()]),
]);
a(98, [
  etb([role("wicked")], { targets: [MY_CR] }),
  event("drawStep", [lose(1, "you"), draw], { cond: C("enchantedOwn") }),
]);
a(99, [
  etb([], {
    modes: [
      { text: "派老鼠", effects: [rat()] },
      {
        text: "犧牲另個生物",
        effects: [
          {
            e: "costThen",
            prompt: "犧牲另一生物？",
            cost: { sac: { type: "Creature", other: true } },
            then: [{ e: "scry", n: 2 }, draw],
          },
        ],
      },
      { text: "賦予威懾", effects: [pump(mine, 0, 0, ["menace"])] },
    ],
  }),
]);
s(101, [E(101)], [MY_CR]);
modes(
  102,
  subsets([
    { text: "每人棄兩張", effects: [{ e: "discard", who: "players", n: 2 }] },
    { text: "每人失去4生命", effects: [lose(4, "players")] },
    {
      text: "每人犧牲兩個生物",
      effects: [
        { e: "edict", who: "players", filter: { type: "Creature" } },
        { e: "edict", who: "players", filter: { type: "Creature" } },
      ],
    },
  ]),
);
s(103, [pump("T0", -1, -1), rat()], [{ ...CR, optional: true }]);
bar(
  104,
  [{ e: "draw", n: 2 }, lose(2, "you")],
  [E(104), { e: "draw", n: 2 }, lose(2, "you")],
  [],
);
s(
  106,
  [destroy, role("wicked", "T1")],
  [
    spec("permanent", { type: ["Creature", "Enchantment"] }),
    { ...MY_CR, optional: true },
  ],
);
a(107, [etb([E(107)])]);
a(108, [etb([role("cursed")], { targets: [MY_CR] })]);
a(109, [
  etb([destroy], {
    targets: [spec("creature", { ctrl: "opp", damaged: true })],
  }),
]);
a(111, [
  etb([food]),
  act(
    { mana: "{2}", sacOther: { sub: "Food" } },
    [lose(2, "T0")],
    "犧牲食物：失去2生命",
    { targets: [spec("player")] },
  ),
]);
s(
  112,
  [
    exile,
    {
      e: "if",
      cond: { c: "controls", filter: { type: "Enchantment" } },
      then: [{ e: "scry", n: 2 }],
    },
  ],
  [CR],
);
a(113, [F("cantBlock"), trig("dies", [rat(N("damageTaken"))])]);
a(114, [etb([rat(), role("wicked", { all: { ctrl: "you", sub: "Rat" } })])]);
a(115, [
  trig("upkeep", [{ e: "reanimate", what: "T0" }], {
    targets: [spec("gyCard", { type: "Creature" })],
  }),
]);
a(116, [
  etb([rat()]),
  trig("allyDies", [cnt("self")], { filter: { other: true } }),
]);
a(117, [
  event("enchantGy", [rat()]),
  act({ mana: "{1}{B}" }, [pump("self", 0, 0, ["deathtouch"])], "獲得死觸"),
]);
a(118, [event("enchantGy", [lose(1)])]);
saga(119, [
  chapter([destroy], [spec("creature", { ctrl: "opp", mvMax: 2 })]),
  chapter([food]),
  chapter([role("wicked")], [MY_CR]),
]);

a(120, [
  trig("combatStart", [pump("T0", 1, 0, ["menace"])], {
    cond: { c: "celebration" },
    targets: [MY_CR],
  }),
]);
d(122, {
  equip: { cost: "{2}", grant: { p: 2 } },
  abilities: [
    trig("combatStart", [{ e: "attach", what: "T0" }], {
      cond: { c: "celebration" },
      targets: [{ ...MY_CR, optional: true }],
    }),
  ],
});
a(123, [
  trig(
    "combatStart",
    [
      {
        e: "costThen",
        prompt: "棄一張抓一張？",
        cost: { discard: 1 },
        then: [draw],
      },
    ],
    { cond: { c: "controls", filter: { type: "Creature", powMin: 4 } } },
  ),
]);
a(124, [
  etb([], {
    modes: [
      { text: "棄一抓一", effects: [{ e: "discard", who: "you", n: 1 }, draw] },
      { text: "珍寶", effects: [treasure] },
      { text: "邪惡角色", targets: [MY_CR], effects: [role("wicked")] },
    ],
  }),
]);
s(125, [dmg(4), role("young-hero", "T1")], [CR, { ...MY_CR, optional: true }]);
a(126, [etb([rat()])]);
a(127, [
  act({ mana: "{1}", sacSelf: true }, [role("young-hero")], "犧牲派角色", {
    targets: [{ ...CR, notSelf: true }],
  }),
]);
a(129, [F("foodFight")]);
s(130, [dmg(N("graveSpellsPlus2"))], [CR]);
s(131, [pump(mine, 2), E(131)]);
a(132, [F("goddric")]);
a(133, [
  act(
    { mana: "{2}{R}", sacOther: { type: ["Artifact", "Land"] } },
    [draw],
    "犧牲神器或地：抓牌",
  ),
]);
a(135, [trig("dies", [rat()])]);
d(136, { costReduce: { perGy: { frontierSpellOrAdventure: true } } });
adv(136, [E("discardHand"), { e: "draw", n: 2 }]);
a(137, [event("imodaneHit", [dmg({ ev: true }, "opp")])]);
saga(139, [chapter([treasure]), chapter([treasure]), chapter([E(139)], [OPP])]);
a(140, [etb([rolePay("{1}", "young-hero", [MY_CR])])]);
s(142, [pump("T0", 2), role("monster")], [CR]);
a(143, [
  F("secondDiscount"),
  trig("combatStart", [pump("T0", 1, 1)], {
    cond: { c: "celebration" },
    targets: [MY_CR],
  }),
]);
a(145, [
  etb([E(145)], { cond: C("bargained") }),
  act({ mana: "{1}{R}" }, [dmg(1)], "造成1傷害", { targets: [ANY] }),
]);
a(146, [
  etb([rat(2)]),
  trig("upkeep", [
    {
      e: "costThen",
      prompt: "犧牲另一生物？",
      cost: { sac: { type: "Creature", other: true } },
      then: [cnt("self"), { e: "impulse", n: 1 }],
    },
  ]),
]);
a(148, [trig("combatDamagePlayer", [E(148)])]);
a(149, [event("slingerBlock", [E(149)])]);
s(150, [rat({ x: true }), pump(mine, 0, 0, ["haste"])]);
bar(
  151,
  [dmg({ x: true })],
  [dmg(N("twiceX"))],
  [spec("permanent", { type: ["Creature", "Planeswalker"] })],
);
a(152, [event("ratBlocked", [pump("evCard", 2)])]);
bar(
  153,
  [dmg(2), { e: "exileIfDies", what: "T0" }],
  [dmg(3), { e: "scry", n: 1 }, { e: "exileIfDies", what: "T0" }],
  [spec("permanent", { type: ["Creature", "Planeswalker"] })],
);
s(154, [E("steal"), role("wicked", "T1")], [CR, { ...CR, optional: true }]);
a(157, [
  event("noncombatOpp", [
    { e: "may", prompt: "放逐牌庫頂並可使用？", effects: [E(157)] },
  ]),
]);
s(
  158,
  [
    {
      e: "costThen",
      prompt: "棄一張牌抓兩張？",
      cost: { discard: 1 },
      then: [{ e: "draw", n: 2 }],
    },
    role("wicked"),
  ],
  [{ ...MY_CR, optional: true }],
);
s(159, [dmg(5)], [CR]);
d(159, { frontier: { attackerDiscount: true } });
a(160, [
  etb([{ e: "fight", a: "self", b: "T0" }], {
    cond: C("bargained"),
    targets: [{ ...OPP_CR, optional: true }],
  }),
]);
adv(161, [{ e: "extraLandThisTurn" }]);
d(162, {
  aura: { target: CR, grant: { p: 2, t: 2 } },
  abilities: [
    act(
      { mana: "{4}{G}" },
      [{ e: "toHand", what: "selfAny" }],
      "從墳墓場回手",
      { fromGraveyard: true },
    ),
  ],
});
a(163, [
  etb([E(163)]),
  trig("attacks", [E(163)]),
  F("landAbilityDiscount"),
  {
    kind: "static",
    anthem: {
      filter: { ctrl: "you", type: "Creature", alsoType: "Land" },
      grant: { p: 1, t: 1 },
    },
  },
]);
d(164, { produces: ["G"] });
a(164, [
  act(
    { mana: "{1}{G}", tap: true, discard: 1 },
    [{ e: "bounce", what: "self" }],
    "回手",
  ),
]);
adv(164, [E("fetchQuest")]);
modes(165, [
  { text: "不交易", effects: [{ e: "searchLand", to: "hand" }] },
  {
    text: "交易",
    sac: barFilter,
    targets: [spec("permanent", { ctrl: "you", type: "Land" })],
    effects: [
      {
        e: "animate",
        what: "T0",
        p: 3,
        t: 3,
        subtypes: ["Elemental"],
        kw: ["haste"],
      },
      { e: "searchLand", to: "hand" },
    ],
  },
]);
s(166, [
  {
    e: "dig",
    n: 5,
    take: 1,
    optional: true,
    filter: { type: "Creature" },
    rest: "bottom",
  },
]);
s(167, [role("monster"), E(167)], [MY_CR]);
a(168, [
  trig("allyPermEtb", [cnt("self", 2)], {
    filter: { type: "Artifact" },
    oncePerTurn: true,
  }),
  trig("allyPermEtb", [draw], {
    filter: { type: "Enchantment" },
    oncePerTurn: true,
  }),
]);
s(169, [E(169)]);
s(171, [E(171)]);
a(172, [etb([E("tripletCopies")]), trig("dies", [E("tripletCounters")])]);
d(173, { frontier: { bargain: true, bargainDiscount: 2 } });
a(173, [etb([gain(3)])]);
a(174, [
  act(
    { mana: "{1}", sacOther: { sub: "Food" } },
    [pump("self", 2, 2)],
    "犧牲食物：+2/+2",
    { oncePerTurn: true },
  ),
]);
a(175, [
  {
    kind: "static",
    self: { cond: C("adventureExiled"), grant: { kw: ["haste"] } },
  },
]);
saga(176, [
  chapter([token("tok-woe-beast")]),
  chapter([
    {
      e: "costThen",
      prompt: "犧牲生物搜尋牌？",
      cost: { sac: { type: "Creature" } },
      then: [
        {
          e: "tutor",
          filter: { or: [{ type: "Creature" }, { type: "Land", basic: true }] },
        },
      ],
    },
  ]),
  chapter(
    [pump("T0", 2, 2, ["trample"]), pump("T1", 2, 2, ["trample"])],
    [
      { ...CR, optional: true },
      { ...CR, optional: true },
    ],
  ),
]);
a(178, [
  etb([food]),
  F("foodMana"),
  act(
    { mana: "{5}{G}{G}", sacSelf: true },
    [
      pump(
        mine,
        { count: { ctrl: "you", sub: "Food" } },
        { count: { ctrl: "you", sub: "Food" } },
      ),
    ],
    "食物數量強化",
    { sorcery: true },
  ),
]);
a(179, [etb([role("royal")], { targets: [{ ...MY_CR, notSelf: true }] })]);
a(180, [
  event("enchantEtbFromGrave", [
    {
      e: "costThen",
      prompt: "支付{2}回手？",
      cost: { mana: "{2}" },
      then: [{ e: "toHand", what: "selfAny" }],
    },
  ]),
]);
modes(
  181,
  subsets(
    [
      {
        text: "基本地",
        effects: [{ e: "searchLand", to: "battlefield", tapped: true }],
      },
      { text: "人類", effects: [token("tok-woe-human")] },
      { text: "食物", effects: [food] },
    ],
    2,
  ),
);
d(182, { produces: ["G"], filterMana: true });
s(183, [pump("T0", 0, 0, ["hexproof"]), role("royal")], [MY_CR]);
a(184, [
  etb([], {
    modes: subsets([
      {
        text: "收回自己的冒險",
        targets: [spec("exileCard", { ctrl: "you", frontierAdventure: true })],
        effects: [{ e: "toHand", what: "T0" }],
      },
      {
        text: "放回對手的冒險",
        targets: [spec("exileCard", { ctrl: "opp", frontierAdventure: true })],
        effects: [{ e: "toLibraryBottom", what: "T0" }],
      },
      {
        text: "放逐墳墓場",
        targets: [spec("player")],
        effects: [E("exileGrave")],
      },
    ]),
  }),
]);
a(185, [trig("castAny", [food], { filter: { mvMin: 5 } })]);
s(
  186,
  [destroy, food],
  [
    spec(
      "permanent",
      {
        or: [
          { type: ["Artifact", "Enchantment"] },
          { type: "Creature", kw: "flying" },
        ],
      },
      true,
    ),
  ],
);
d(187, { evadePowLte: 2 });
a(188, [trig("allyPermEtb", [draw], { filter: { sub: "Aura" } })]);
a(189, [
  trig(
    "combatStart",
    [
      pump("self", 1),
      { e: "grant", what: "self", grant: { ignoreDefender: true } },
    ],
    { cond: { c: "controls", filter: { type: "Creature", powMin: 4 } } },
  ),
]);
bar(190, [E(190)], [E(190)], []);
a(192, [act({ mana: "{3}{G}" }, [cnt("self")], "放指示物")]);
a(193, [
  etb([food]),
  act(
    { mana: "{2}{G}" },
    [{ e: "animate", what: "T0", p: 4, t: 4 }],
    "神器成4/4",
    {
      targets: [
        spec("permanent", {
          ctrl: "you",
          type: "Artifact",
          nonType: "Creature",
        }),
      ],
    },
  ),
  act({ mana: "{2}", tap: true, sacSelf: true }, [gain(3)], "犧牲食物"),
]);
a(194, [
  etb([exile], {
    cond: C("bargained"),
    targets: [
      spec("permanent", { ctrl: "opp", type: ["Artifact", "Enchantment"] }),
    ],
  }),
]);
a(195, [etb([draw]), trig("castAny", [draw], { filter: { mvMin: 5 } })]);
a(196, [
  act(
    { mana: "{1}{G}" },
    [E("largeBlockers", "self", 2)],
    "不能被力量2以下阻擋",
  ),
]);
a(197, [F("tripleBasicMana")]);
saga(198, [
  chapter([token("tok-woe-human")]),
  chapter([food]),
  chapter([cnt("T0", N("foodsPlus1"))], [MY_CR]),
]);
a(199, [
  F("agathaDiscount"),
  act(
    { mana: "{4}{R}{G}" },
    [
      pump({ all: { ctrl: "you", type: "Creature", other: true } }, 1, 1, [
        "trample",
        "haste",
      ]),
    ],
    "其他生物強化",
  ),
]);
const reflection = chapter(
  [E("reflectionCopy")],
  [spec("creature", { ctrl: "you", token: false, frontierNoTokenName: true })],
);
saga(200, [
  reflection,
  reflection,
  chapter([{ e: "sac", what: { all: { ctrl: "you", sub: "Reflection" } } }]),
]);
a(202, [
  F("erietteAttack"),
  trig("endStep", [
    lose({ count: { ctrl: "you", sub: "Aura" } }),
    gain({ count: { ctrl: "you", sub: "Aura" } }),
  ]),
]);
a(203, [
  etb([role("monster", "self")]),
  act(
    { mana: "{1}", sacOther: { sub: "Aura", attachedToSource: true } },
    [
      { e: "exileIfDies", what: "T0" },
      { e: "fight", a: "self", b: "T0" },
    ],
    "犧牲所附光環並互鬥",
    { sorcery: true, targets: [OPP_CR] },
  ),
]);
d(204, { etbCountersX: true });
a(204, [
  etb([token("tok-food", N("halfXUp"))]),
  trig("attacks", [
    {
      e: "costThen",
      prompt: "犧牲食物抓牌？",
      cost: { sac: { sub: "Food" } },
      then: [draw],
    },
  ]),
]);
a(205, [
  etb([food]),
  act({ mana: "{G}", sacOther: { sub: "Food" } }, [cnt("T0")], "食物換指示物", {
    sorcery: true,
    targets: [CR],
  }),
  act(
    { mana: "{1}{B}", sacOther: { sub: "Food" } },
    [draw, lose(1, "you")],
    "食物換牌",
  ),
]);
a(206, [event("tapOpp", [E(206)])]);
a(207, [
  { kind: "static", topCast: { type: ["Instant", "Sorcery"] } },
  F("johannTopOnce"),
]);
a(208, [
  act({ tap: true }, [draw, { e: "discard", who: "you", n: 1 }], "抓一棄一"),
  act({}, [E(208)], "複製墳墓場生物", {
    xMana: 1,
    sorcery: true,
    targets: [gy({ type: "Creature" })],
  }),
]);
a(209, [
  etb([{ e: "toHand", what: "T0" }], {
    targets: [gy({ type: ["Creature", "Enchantment"] })],
  }),
  event("enchantGy", [cnt("self"), { e: "scry", n: 1 }]),
]);
a(210, [
  trig("allyEtb", [lose(1)], { filter: { sub: "Faerie", other: true } }),
]);
a(211, [
  act({ tap: true }, [E("rowanDiscount")], "依失去生命減費", { sorcery: true }),
]);
a(212, [
  trig("attacks", [pump("self", 2, 2)], {
    when: { c: "controls", filter: { type: "Creature", powMin: 4 } },
  }),
]);
d(212, { produces: ["R", "G"] });
a(213, [
  etb([{ e: "stun", what: "T0" }], { targets: [OPP_CR] }),
  event("tapOpp", [draw], { oncePerTurn: true }),
]);
a(214, [
  etb([role("monster")], { targets: [{ ...MY_CR, notSelf: true }] }),
  enchanted(1, 1),
]);
d(215, { ecl: { asEnters: "talion" } });
a(215, [F("talionChoice"), event("talionSpell", [lose(2, "evPlayer"), draw])]);
a(216, [
  event("nontokenOwnDies", [rat()]),
  act(
    { mana: "{1}{B}" },
    [pump("T0", 0, 0, ["deathtouch"])],
    "攻擊老鼠獲得死觸",
    {
      targets: [spec("creature", { ctrl: "you", sub: "Rat", attacking: true })],
    },
  ),
]);
d(217, { produces: ["G"] });
a(217, [
  F("troyanMana"),
  act(
    { mana: "{U}", tap: true },
    [draw, { e: "discard", who: "you", n: 1 }],
    "抓一棄一",
  ),
]);
a(218, [
  act({ tap: true }, [E("willDiscount")], "依獲得生命減費", { sorcery: true }),
]);
a(219, [
  act({ mana: "{2}", tap: true }, [E(219)], "複製結界", {
    sorcery: true,
    targets: [
      spec("permanent", {
        ctrl: "you",
        type: "Enchantment",
        frontierUniqueName: true,
      }),
    ],
  }),
]);
a(220, [F("belunaDiscount")]);
adv(220, [E("seekThrills")]);
d(221, { frontier: { enterDeaths: true } });
adv(
  221,
  [
    { e: "bite", a: "T0", b: "T1" },
    { e: "sac", what: "T0" },
  ],
  [MY_CR, ANY],
);
a(222, [F("somnophage")]);
adv(223, [E("expensiveTaste")], [OPP]);
a(224, [trig("upkeep", [E(224)])]);
a(225, [F("otterBlock")]);
adv(225, [E("distributeX")]);
adv(226, [dmg(1)], [ANY]);
a(228, [F("spellLifelink")]);
adv(228, [dmg(3)], [ANY]);
a(230, [F("kellanAnthem")]);
adv(230, [{ e: "tutor", filter: { sub: ["Aura", "Equipment"] } }]);
a(231, [trig("dies", [E(231)])]);
adv(
  233,
  [
    pump(
      "T0",
      { count: { ctrl: "you", type: "Creature" } },
      { count: { ctrl: "you", type: "Creature" } },
      ["vigilance"],
    ),
  ],
  [MY_CR],
);
a(234, [
  trig("castAny", [cnt("self")], { filter: { color: ["W", "U", "B", "R"] } }),
]);
adv(234, [E("seekBeast")]);
a(235, [event("oppSmallSpell", [dmg(1, "evPlayer")])]);
adv(237, [{ e: "bounce", what: "T0" }], [spec("spell")]);
adv(240, [E("swiftSpiral")], [spec("creature", { token: false })]);
adv(
  241,
  [E("topLibrary")],
  [
    gy({
      type: [
        "Artifact",
        "Creature",
        "Enchantment",
        "Land",
        "Planeswalker",
        "Kindred",
      ],
    }),
  ],
);
a(242, [
  F("cauldronMana"),
  F("cauldronAbilities"),
  act({ tap: true }, [E(242)], "放逐墳墓場牌", { targets: [spec("gyCard")] }),
]);
a(243, [
  etb([{ e: "scry", n: 2 }]),
  act(
    { mana: "{2}", tap: true, sacSelf: true },
    [gain(3), draw],
    "犧牲：獲生命與抓牌",
  ),
]);
a(245, [
  etb([E("steal")], { targets: [CR] }),
  act({ mana: "{2}", tap: true, sacSelf: true }, [gain(3)], "獲得生命"),
  act(
    { mana: "{2}", tap: true, sacSelf: true },
    [lose(3, "T0")],
    "對手失去生命",
    { targets: [OPP] },
  ),
]);
a(246, [
  act({ mana: "{1}" }, [E("hasteBlockers")], "只可被敏捷阻擋"),
  act({ mana: "{2}", tap: true, sacSelf: true }, [gain(3)], "犧牲食物"),
]);
a(247, [
  act({ mana: "{1}", tap: true }, [{ e: "tap", what: "T0" }], "橫置生物", {
    targets: [CR],
    frontierOwnTurnDiscount: 1,
  }),
  act(
    { mana: "{3}", sacSelf: true },
    [
      {
        e: "draw",
        n: { count: { ctrl: "opp", type: "Creature", tapped: true } },
      },
    ],
    "依對手橫置生物抓牌",
  ),
]);
d(248, { produces: ["C"] });
a(248, [trig("allyEtb", [E(248)], { filter: { legendary: true } })]);
d(249, { produces: [], filterMana: true });
a(249, [etb([draw])]);
a(250, [
  act({ mana: "{1}" }, [{ e: "addManaOfChoice", n: 1 }], "任意色法力", {
    oncePerTurn: true,
  }),
]);
a(251, [
  etb([exile], { targets: [spec("gyCard")] }),
  act({ tap: true, sacSelf: true }, [E("exileOppGrave")], "放逐對手墳墓場"),
  act({ mana: "{1}", tap: true, sacSelf: true }, [draw], "抓牌"),
]);
a(252, [
  {
    kind: "static",
    self: {
      cond: { c: "controls", filter: { ctrl: "opp", type: "Planeswalker" } },
      grant: { kw: ["trample", "hexproof", "haste"] },
    },
  },
  event("otherArtifactGy", [cnt("self"), { e: "scry", n: 1 }]),
  act(
    { mana: "{2}", tap: true, sacSelf: true },
    [gain(N("lastPower"))],
    "依力量獲得生命",
  ),
]);
a(253, [
  act({ mana: "{2}", tap: true }, [dmg(2)], "造成2傷害", {
    targets: [CR],
    frontierMode: 0,
  }),
  act({ mana: "{2}", tap: true }, [{ e: "tap", what: "T0" }], "橫置生物", {
    targets: [CR],
    frontierMode: 1,
  }),
  act(
    { mana: "{2}", tap: true },
    [{ e: "sac", what: "self" }, gain(3)],
    "犧牲並獲得3生命",
    { frontierMode: 2 },
  ),
]);
d(254, { produces: ["C"], filterMana: true });
a(254, [etb([{ e: "scry", n: 1 }])]);
d(255, {
  etbTapped: true,
  produces: ["W", "U", "B", "R", "G"],
  chosenColorMana: true,
  ecl: { asEnters: "color" },
});
a(255, [
  act(
    { mana: "{3}", tap: true, sacSelf: true },
    [{ e: "toHand", what: "T0" }],
    "收回冒險牌",
    { targets: [gy({ frontierAdventure: true })] },
  ),
]);
for (const [n, cost, p, t, sub, col, kw] of [
  [257, "{1}{R}{W}", 2, 2, "Ox", ["R", "W"], []],
  [258, "{2}{B}{G}", 4, 4, "Horror", ["B", "G"], []],
  [259, "{2}{W}{B}", 1, 4, "Nightmare", ["W", "B"], []],
  [260, "{U}{R}", 2, 1, "Elemental", ["U", "R"], []],
  [261, "{3}{G}{U}", 5, 5, "Plant", ["G", "U"], ["trample"]],
] as const) {
  d(n, {
    etbTapped: true,
    produces: [...col],
    abilities: [
      act(
        { mana: cost },
        [
          {
            e: "animate",
            what: "self",
            p,
            t,
            subtypes: [sub],
            colors: [...col],
            kw: [...kw],
          },
        ],
        "地變生物",
      ),
      ...(n === 257
        ? [trig("attacks", [cnt("T0")], { targets: [MY_CR] })]
        : n === 258
          ? [
              trig("attacks", [food, exile], {
                targets: [spec("gyCard", {}, true)],
              }),
            ]
          : n === 259
            ? [trig("attacks", [lose(2), gain(2)])]
            : n === 260
              ? [trig("attacks", [{ e: "scry", n: 1 }]), F("spireFirst")]
              : [
                  trig("attacks", [{ e: "setBase", what: "T0", p: 3, t: 3 }], {
                    targets: [{ ...CR, notSelf: true, optional: true }],
                  }),
                ]),
    ],
  });
}
a(308, [etb([{ e: "exileLinked", what: "T0" }, food], { targets: [OPP_CR] })]);
a(309, [trig("endStep", [draw], { cond: { c: "celebration" } })]);
a(310, [trig("combatStart", [cnt("self")], { cond: { c: "celebration" } })]);
s(311, [E(311)]);
s(312, [{ e: "draw", n: 3 }]);
d(312, { frontier: { attackerDiscount: true } });
a(313, [event("adventureCast", [draw])]);
a(314, [etb([food]), trig("sacrifice", [rat()], { filter: { sub: "Food" } })]);
a(315, [etb([E(315)])]);
a(316, [
  trig("eachEndStep", [food], { cond: { c: "morbid" } }),
  act(
    { mana: "{2}{B}", sacOther: { type: ["Creature", "Artifact"] } },
    [pump("self", 2, 2)],
    "犧牲另一生物或神器",
  ),
]);
s(
  317,
  [
    pump("T0", 0, 0, ["haste"]),
    role("monster"),
    pump("T1", 0, 0, ["haste"]),
    role("monster", "T1"),
  ],
  [CR, { ...CR, optional: true }],
);
a(318, [
  trig("attacks", [
    pump("self", { count: { type: "Creature", attacking: true } }),
    {
      e: "if",
      cond: { c: "controls", filter: { sub: "Rat", attacking: true } },
      then: [pump("self", 0, 0, ["trample"])],
    },
  ]),
]);
const chitter = [
  rat(2),
  {
    e: "if" as const,
    cond: { c: "controls" as const, filter: { sub: "Rat" }, n: 5 },
    then: [pump({ all: { ctrl: "you", sub: "Rat" } }, 2)],
  },
];
a(319, [etb(chitter), trig("attacks", chitter)]);
a(321, [
  etb([food]),
  trig("attacks", [
    {
      e: "costThen",
      prompt: "犧牲食物強化攻擊生物？",
      cost: { sac: { sub: "Food" } },
      then: [
        pump(
          { all: { ctrl: "you", type: "Creature", attacking: true } },
          1,
          1,
          ["trample"],
        ),
      ],
    },
  ]),
]);
a(322, [
  trig("allyPermEtb", [cnt("self")], { filter: { token: true } }),
  trig("attacks", [pump("T0", { power: "self" }, { power: "self" })], {
    targets: [spec("creature", { attacking: true, other: true })],
  }),
]);
export const completeWoe = complete;
s(
  50,
  [
    { e: "stun", what: "T0", n: 3 },
    { e: "scry", n: 2 },
  ],
  [OPP_CR],
);
adv(38, [knight]);
adv(52, [
  { e: "draw", n: 4 },
  { e: "discard", who: "you", n: 2 },
]);
adv(84, [role("wicked")], [MY_CR]);
adv(92, [{ e: "toHand", what: "T0" }], [gy({ type: "Creature" })]);
adv(93, [food]);
adv(115, [pump("T0", -3, -3), gain(2)], [CR]);
adv(
  121,
  [
    { e: "grant", what: "T0", grant: { cantBlock: true } },
    { e: "grant", what: "T1", grant: { cantBlock: true } },
  ],
  [
    { ...CR, optional: true },
    { ...CR, optional: true },
  ],
);
s(128, [dmg(1), treasure, draw], [ANY]);
adv(133, [treasure]);
a(144, [
  {
    kind: "static",
    self: { cond: { c: "yourTurn" }, grant: { kw: ["first_strike"] } },
  },
]);
adv(144, [rat(2)]);
adv(157, [dmg(2)], [ANY]);
adv(174, [food]);
s(177, [pump("T0", 1, 3, ["reach"]), { e: "untap", what: "T0" }], [CR]);
adv(187, [destroy], [spec("permanent", { type: ["Artifact", "Enchantment"] })]);
adv(197, [{ e: "toHand", what: "T0" }], [gy({ type: ["Creature", "Land"] })]);
adv(222, [{ e: "mill", n: 4, who: "T0" }], [spec("player")]);
adv(224, [token("tok-woe-human"), food]);
adv(231, [draw, lose(1, "you")]);
a(232, [
  trig("attacks", [pump("self", 0, 0, ["double_strike"])], {
    when: { c: "controls", filter: { type: "Creature", powMin: 4 } },
  }),
]);
adv(232, [E("distributeThree")]);
adv(
  235,
  [{ e: "bounce", what: "T0" }],
  [spec("permanent", { nonType: "Land" })],
);
a(238, [trig("castAny", [cnt("self")], { filter: { mvMin: 5 } })]);
adv(238, [
  { e: "draw", n: 2 },
  { e: "discard", who: "you", n: 2 },
]);
a(320, [trig("attacks", [food], { alone: true })]);
adv(320, [pump("T0", 2, 2)], [CR]);

d(171, {
  ecl: { variableTargets: "creature" },
  frontier: { variableTargets: "graceful" },
});
for (const [n, total] of [
  [225, "X"],
  [232, 3],
] as const)
  d(n, {
    adventure: {
      ...catalog.find((c) => c.number === n)!.adventure,
      frontier: { variableTargets: "own", distribute: total },
      ecl: { variableTargets: "creature" },
      spell: {
        effects: [E(total === "X" ? "distributeX" : "distributeThree")],
      },
    },
  } as any);
