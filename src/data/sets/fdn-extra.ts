import catalog from "./fdn-catalog.json";
import auto from "./fdn-auto.json";
import { act, etb, trig, CR, MY_CR, OPP_CR, ANY, OPP } from "../dsl";
import { foundationBuilder } from "./foundation-dsl";
import {
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
} from "./frontier-dsl";
import type { Ability, CardDef, Filter, TargetSpec } from "../../engine/types";
const { d, a, s, modes, E, C, N, F, event, complete } = foundationBuilder(
  "FDN",
  catalog,
  auto,
);
const an = (
  filter: Filter,
  p = 1,
  t = 1,
  kw: import("../../engine/types").Keyword[] = [],
): Ability => ({
  kind: "static",
  anthem: {
    filter: { ctrl: "you", type: "Creature", ...filter },
    grant: { p, t, kw },
  },
});
const cat = (n: any = 1) => token("tok-g-cat-11-w", n),
  fae = (n: any = 1) => token("tok-g-faerie-11-u-flying", n),
  elf = (n: any = 1) => token("tok-g-elf-warrior-11-g", n),
  gob = (n: any = 1) => token("tok-g-goblin-11-r", n);
const pair = (f: Filter = {}, other = false): TargetSpec[] => [
  {
    kind: "creature",
    filter: { ctrl: "you", ...f },
    optional: true,
    notSelf: other,
  },
  {
    kind: "creature",
    filter: { ctrl: "you", ...f },
    optional: true,
    notSelf: other,
  },
];
const ra = { c: "attacked" } as const,
  th = C("threshold"),
  fer = {
    c: "controls",
    filter: { ctrl: "you", type: "Creature", powMin: 4 },
  } as const;
a(2, [
  an({ sub: "Cat", other: true }),
  trig("allyEtb", [cat()], {
    includeSelf: true,
    filter: { sub: "Cat", token: false },
  }),
]);
a(3, [
  trig("youAttack", [cnt("T0")], { cond: C("attack3"), targets: [MY_CR] }),
]);
a(4, [etb([food]), event("firstLifeOwn", [cat()])]);
d(5, {
  equip: { cost: "{3}{W}", grant: { p: 2, kw: ["flying"] } },
  abilities: [
    etb(
      [
        { e: "attach", what: "T0" },
        pump("T0", 0, 0, ["hexproof", "indestructible"]),
      ],
      { targets: [MY_CR] },
    ),
  ],
});
s(6, [pump(mine, 2, 2)]);
d(6, { costReduce: { perCount: { ctrl: "you", sub: "Cat" } } });
a(7, [F("playerHexproof"), F("preventOtherNoncombat")]);
d(10, {
  kicker: "{2}{W}",
  frontier: { variableTargets: "own" },
  ecl: { variableTargets: "creature" },
});
s(10, [E(10)], [MY_CR]);
a(11, [
  trig("lifegain", [cnt("self")]),
  trig("counterPlacedSelf", [draw], { oncePerTurn: true }),
]);
a(12, [etb([cnt("T0"), cnt("T1")], { targets: pair({}, true) })]);
s(13, [cnt("T0"), pump("T0", 0, 0, ["flying"]), E("combatFog")], [CR]);
a(15, [
  etb([
    token("tok-fdn-rabbit", {
      count: { ctrl: "you", name: "Hare Apparent", other: true },
    }),
  ]),
]);
d(15, { anyNumber: true } as Partial<CardDef>);
a(17, [F("cantLose")]);
a(18, [
  {
    kind: "static",
    self: { cond: { c: "yourTurn" }, grant: { kw: ["first_strike"] } },
  },
  F("counterFirstStrike"),
]);
s(20, [destroy], [CR]);
d(20, { frontier: { tappedTargetDiscount: 3 } } as Partial<CardDef>);
s(22, [E(22)]);
a(23, [
  trig("allyEtb", [cnt("self")], { filter: { other: true } }),
  F("squireKnight"),
]);
a(24, [
  act(
    { mana: "{2}{W}" },
    [
      {
        e: "dig",
        n: 4,
        take: 1,
        optional: true,
        filter: { type: "Creature", powMax: 2 },
        rest: "bottom",
        randomBottom: true,
      },
    ],
    "找小生物",
  ),
]);
d(25, {
  kicker: "{1}{W}",
  abilities: [
    etb([{ e: "reanimate", what: "T0" }], {
      cond: C("kicked"),
      targets: [gy({ nonType: "Land", mvMax: 2 })],
    }),
  ],
});
a(27, [
  trig("allyDies", [E(27)], { filter: { token: false, nonSub: "Angel" } }),
]);
a(28, [event("firstLife", [{ e: "surveil", n: 1 }])]);
s(29, [{ e: "draw", n: 3 }]);
d(29, {
  costReduce: {
    cond: { c: "controls", filter: { sub: "Wizard", ctrl: "you" } },
    mana: "{1}",
  },
});
a(30, [
  {
    kind: "static",
    spellCostLess: { filter: { type: ["Instant", "Sorcery"] }, n: 1 },
  },
  trig("castInstSorc", [draw]),
]);
a(32, [
  etb([{ e: "surveil", n: 3 }]),
  { kind: "static", self: { cond: th, grant: { kw: ["unblockable"] } } },
]);
a(33, [trig("draw", [cnt("self")])]);
a(34, [etb([E(34)])]);
a(35, [
  trig("combatDamagePlayer", [
    { e: "chargeCounter", what: "self", n: { ev: true } },
  ]),
  act({}, [token("tok-fdn-drake")], "移除三個孵化指示物", {
    removeCounter: { n: 3 },
  }),
]);
s(38, [
  fae(2),
  { e: "reflexive", targets: [OPP_CR], effects: [{ e: "tap", what: "T0" }] },
]);
a(39, [trig("landfall", [{ e: "stun", what: "T0" }], { targets: [OPP_CR] })]);
a(40, [F("allFlash")]);
a(41, [event("secondDraw", [E("copySelf")])]);
s(43, [
  { e: "mill", n: 3 },
  {
    e: "reflexive",
    targets: [gy({ type: ["Instant", "Sorcery"] })],
    effects: [{ e: "toHand", what: "T0" }],
  },
]);
a(44, [
  trig("allyCombatDamagePlayer", [E("loyaltyOne")]),
  act(
    { loyalty: 1 },
    [
      { e: "grant", what: "T0", grant: { kw: ["unblockable"] } },
      draw,
      { e: "discard", who: "you", n: 1 },
    ],
    "+1",
    { targets: [{ ...MY_CR, optional: true }] },
  ),
  act({ loyalty: -2 }, [token("tok-fdn-ninja")], "-2"),
  act({ loyalty: -9 }, [E("kaitoEmblem")], "-9"),
]);
a(45, [
  etb([
    { e: "draw", n: 2 },
    { e: "discard", who: "you", n: 2 },
  ]),
  trig(
    "attacks",
    [{ e: "may", prompt: "派出深淵之裔？", effects: [token("tok-fdn-scion")] }],
    { cond: th },
  ),
]);
s(46, [{ e: "draw", n: N("distinctManaValues") }]);
a(47, [event("secondDraw", [fae()])]);
a(51, [
  trig("attacks", [E("flashback")], {
    targets: [gy({ type: ["Instant", "Sorcery"] })],
  }),
]);
s(
  53,
  [
    { e: "topOrBottom", what: "T0" },
    { e: "surveil", n: 1 },
  ],
  [CR],
);
a(54, [
  act({ tap: true }, [E(54)], "放逐並複製", {
    targets: [spec("gyCard", { type: "Creature", gyThisTurn: true })],
  }),
]);
d(55, {
  addCost: { sac: { type: "Creature" } },
  abilities: [
    etb([{ e: "discard", who: "opp", n: 1 }, lose(2), draw, gain(2)]),
  ],
});
modes(57, [
  { text: "正常", effects: [E(57)] },
  {
    text: "至少十三個生物（{B}）",
    cost: "{B}",
    effects: [E(57)],
    cond: C("creatures13"),
  },
]);
a(58, [event("opponentLifeLost", [gain({ ev: true })])]);
a(60, [etb([E(60)], { cond: ra })]);
a(61, [
  trig("attacks", [
    {
      e: "costThen",
      prompt: "犧牲另一生物？",
      cost: { sac: { type: "Creature", other: true } },
      then: [cnt("self")],
    },
  ]),
  trig("otherDies", [draw], { filter: { token: false } }),
]);
a(63, [trig("dies", [E(63)], { cond: C("notDemon") })]);
a(64, [trig("dies", [token("tok-g-insect-11-bg-flying")])]);
a(65, [
  trig("endStep", [food], { cond: ra }),
  act(
    { mana: "{2}{B}", sacSelf: true },
    [lose({ lifeGained: true }, "T0")],
    "失去等量生命",
    { targets: [OPP] },
  ),
]);
a(66, [trig("dies", [E(66)])]);
d(66, { foundation: { revival: 8 } });
s(67, [
  { ...token("tok-fdn-rat", { gy: { type: "Creature" } }), tapped: true },
]);
a(70, [
  etb([E(70)], {
    targets: [
      spec("gyCard", {}, true),
      { ...spec("gyCard", {}, true), sameGraveyardAs: 0 },
    ],
  }),
]);
a(72, [
  event("opponentDiscard", [E(72)]),
  F("stashPlay"),
  act(
    { mana: "{3}{B}", tap: true },
    [{ e: "discard", who: "opp", n: 1 }],
    "對手棄牌",
    { sorcery: true },
  ),
]);
a(73, [
  etb([pump("T0", N("morbidMinus"), N("morbidMinus"))], { targets: [OPP_CR] }),
]);
a(74, [
  trig("attacks", [
    {
      e: "costThen",
      prompt: "犧牲另一生物？",
      cost: { sac: { type: "Creature", other: true } },
      then: [draw, pump("self", 0, 0, ["unblockable"])],
    },
  ]),
]);
a(76, [trig("allyDies", [lose(1, "T0"), gain(1)], { targets: [OPP] })]);
a(77, [
  act({ tap: true }, [E("zombieCast")], "施放墳墓場殭屍", {
    targets: [gy({ type: "Creature", sub: "Zombie" })],
  }),
]);
s(80, [pump("T0", { power: "T0" }, 0)], [CR]);
a(81, [
  act({ loyalty: 2 }, [{ e: "addMana", mana: ["R"], n: 3 }, E(81)], "+2"),
  act({ loyalty: 1 }, [{ e: "copyCreature", what: "T0", temp: true }], "+1", {
    targets: [MY_CR],
  }),
  act({ loyalty: -4 }, [E("divide8")], "-4", {
    foundationDistribution: 8,
    targets: [{ kind: "creatureOrPlaneswalker" }],
  }),
]);
a(82, [trig("attacks", [pump("self", 1, 0, ["menace"])], { when: fer })]);
s(85, [{ e: "copyCreature", what: "T0", temp: true }], [MY_CR]);
s(86, [E(86)], [CR, spec("permanent", { sub: "Equipment" }, true)]);
d(87, { foundation: { raidCounter: true } });
s(88, [E(88)], [CR]);
a(91, [
  act({ mana: "{1}{R}" }, [E("kellan1")], "成為偵探"),
  act({ mana: "{2}{R}" }, [E("kellan2")], "成為盜賊"),
]);
a(94, [
  { kind: "static", self: { grant: { noUntap: true } } },
  trig("eachEndStep", [{ e: "untap", what: "self" }], {
    cond: { c: "morbid" },
  }),
]);
a(95, [
  act(
    { mana: "{2}{R}" },
    [{ e: "grant", what: "T0", grant: { cantBlock: true } }],
    "不能阻擋",
    { targets: [CR] },
  ),
]);
a(96, [etb([E(96)], { cond: ra })]);
a(97, [F("doubleDamage")]);
a(98, [etb([exile], { targets: [spec("gyCard", {}, true)] })]);
a(99, [
  etb([], {
    modes: [
      { text: "放指示物", effects: [cnt("T0", 2)], targets: [MY_CR] },
      { text: "獲得4生命", effects: [gain(4)] },
    ],
  }),
]);
a(104, [
  etb([{ e: "toHand", what: "T0" }], {
    targets: [
      gy({
        type: [
          "Artifact",
          "Creature",
          "Enchantment",
          "Planeswalker",
          "Land",
          "Kindred",
        ],
      }),
    ],
  }),
]);
s(
  105,
  [cnt("T0"), { e: "damage", to: "T1", from: "T0", n: { power: "T0" } }],
  [MY_CR, OPP_CR],
);
a(106, [
  { kind: "static", extraLand: 1 },
  act({ mana: "{4}{G}{G}", tap: true }, [E(106)], "看六張放生物"),
]);
a(107, [trig("landfall", [E("doublePlus")])]);
d(107, { etbCounters: 1 });
a(111, [event("ownCombatAny", [E(111)]), F("greatwurmCast")]);
a(112, [
  trig("allyDies", [{ e: "may", prompt: "找生物？", effects: [E(112)] }], {
    filter: { other: true, token: false },
  }),
]);
a(113, [
  trig("endStep", [], {
    modes: [
      { text: "指示物", effects: [cnt("T0")], targets: [MY_CR] },
      {
        text: "浣熊",
        effects: [{ e: "if", cond: fer, then: [token("tok-fdn-raccoon")] }],
      },
    ],
  }),
]);
a(115, [
  trig("attacks", [cnt("self")]),
  trig("endStep", [{ e: "reanimate", what: "T0" }], {
    cond: ra,
    targets: [gy({ type: "Creature", mvMaxSourcePower: true } as Filter)],
  }),
]);
a(117, [
  trig(
    "attacks",
    [pump("T0", { power: "self" }, { power: "self" }, ["trample"])],
    { targets: [{ ...MY_CR, notSelf: true }] },
  ),
]);
a(119, [F("elendaBoost"), F("hexproofInstants")]);
a(120, [
  trig("lifegain", [cnt("self")]),
  trig("dies", [{ e: "reanimate", what: "T0" }], {
    targets: [
      gy({
        type: "Creature",
        nonSub: "Bear",
        mvMaxSourcePower: true,
      } as Filter),
    ],
  }),
]);
a(121, [trig("combatDamagePlayer", [token("tok-fdn-coil", 4)])]);
a(122, [
  trig("castNoncreature", [], {
    modes: [
      {
        text: "閃爍另一生物",
        effects: [E("blinkEnd")],
        targets: [{ ...MY_CR, notSelf: true }],
      },
      { text: "精靈", effects: [token("tok-dsk-spirit")] },
    ],
  }),
]);
a(123, [
  F("noHandLimit"),
  event("ownNoncombatOpp", [{ e: "draw", n: { ev: true } }]),
]);
a(124, [trig("endStep", [E(124)], { cond: ra })]);
a(125, [
  trig("endStep", [], {
    cond: { c: "morbid" },
    modes: [
      { text: "生命", effects: [gain(2)] },
      { text: "抓牌", effects: [draw, lose(1, "you")] },
    ],
  }),
]);
a(126, [
  trig("combatStart", [cnt("T0"), cnt("T1")], { targets: pair() }),
  act(
    { mana: "{G}{U}", tap: true },
    [E("doubleAllTarget"), E("doubleAllTarget", "T1")],
    "倍增指示物",
    {
      targets: [
        spec(
          "permanent",
          { ctrl: "you", type: ["Creature", "Artifact"] },
          true,
        ),
        spec(
          "permanent",
          { ctrl: "you", type: ["Creature", "Artifact"] },
          true,
        ),
      ],
    },
  ),
]);
a(127, [F("bannerKinship")]);
d(127, { ecl: { asEnters: "tribe" } });
d(128, {
  equip: { cost: "{2}", grant: {} },
  abilities: [event("equippedUntap", [E(128)]), F("fishingAbility")],
});
d(130, { equip: { cost: "{2}", grant: {} }, abilities: [F("katana")] });
a(131, [
  act(
    { mana: "{1}", tap: true, sacOther: { type: "Creature" } },
    [draw, { e: "chargeCounter", what: "self", n: 1 }],
    "犧牲抽牌",
    { sorcery: true },
  ),
  act(
    { mana: "{4}", tap: true, sacSelf: true },
    [lose(N("charge"))],
    "每位對手失去生命",
  ),
]);
a(132, [
  trig("upkeep", [
    { e: "draw", n: 1, who: "you" },
    { e: "draw", n: 1, who: "opp" },
  ]),
  event("opponentDraw", [lose(1)]),
]);
a(134, [
  act({ loyalty: 1 }, [cnt("T0")], "+1", {
    targets: [{ ...CR, optional: true }],
  }),
  act({ loyalty: -3 }, [pump("T0", 0, 0, ["flying", "double_strike"])], "-3", {
    targets: [CR],
  }),
  act({ loyalty: -8 }, [token("tok-fdn-cat22", N("life"))], "-8"),
]);
a(136, [etb([E("exileGrave")], { targets: [spec("player")] })]);
a(137, [F("opponentCreaturesTapped"), trig("oppCreatureEtb", [gain(1)])]);
a(138, [
  etb([{ e: "exileLinked", what: "T0" }], {
    targets: [spec("permanent", { ctrl: "opp", nonType: "Land" })],
  }),
]);
a(141, [F("giadaCounters")]);
d(141, { produces: ["W"], manaOnly: "angel" });
s(
  143,
  [destroy],
  [
    spec("permanent", {
      or: [
        { type: ["Artifact", "Enchantment"] },
        { type: "Creature", powMin: 4 },
      ],
    }),
  ],
);
a(144, [
  etb([{ e: "bounce", what: "T0" }], {
    targets: [{ ...spec("permanent", { ctrl: "you" }, true), notSelf: true }],
  }),
]);
s(148, [E("strokeMidnight")], [spec("permanent", { nonType: "Land" })]);
a(149, [
  trig("allyEtb", [cnt("self")], { filter: { sub: "Angel", other: true } }),
]);
s(151, [{ e: "bounce", what: { all: { type: "Creature", attacking: true } } }]);
a(152, [trig("castAny", [cnt("self")], { cond: { c: "notYourTurn" } })]);
a(154, [
  trig("upkeep", [E("copyToken")], {
    targets: [
      { ...spec("permanent", { ctrl: "you", nonType: "Land" }), notSelf: true },
    ],
  }),
]);
d(156, {
  aura: {
    target: spec("permanent", { type: ["Creature", "Land", "Planeswalker"] }),
    grant: { loseAbilities: true },
  },
  abilities: [F("moonAura")],
});
a(158, [
  etb([
    {
      e: "tutor",
      filter: { type: ["Instant", "Sorcery"], mvMin: 1, mvMax: 1 },
      optional: true,
    },
  ]),
]);
a(159, [
  {
    kind: "static",
    spellCostLess: { filter: { type: ["Instant", "Sorcery"] }, n: 1 },
  },
]);
s(160, [E(160)], [spec("spell", { nonType: "Creature" })]);
a(161, [F("omniFree")]);
s(
  162,
  [
    { e: "bounce", what: "T0" },
    { e: "bounce", what: "T1" },
  ],
  [CR, { ...CR, differentControllerFrom: 0 }],
);
s(163, [E("copyToken")], [MY_CR]);
s(166, [E("endTurn")]);
d(167, { costReduce: { perGy: { type: ["Instant", "Sorcery"] } } });
d(168, {
  aura: { target: CR, grant: { loseAbilities: true } },
  abilities: [F("witnessAura")],
});
modes(172, [
  {
    text: "犧牲生物",
    sac: { type: "Creature" },
    effects: [exile],
    targets: [spec("creatureOrPlaneswalker")],
  },
  {
    text: "支付{3}{B}額外費用",
    cost: "{3}{B}{B}",
    effects: [exile],
    targets: [spec("creatureOrPlaneswalker")],
  },
]);
s(173, [E(173)]);
s(174, [pump("T0", 2), E("fakeDeath")], [CR]);
a(176, [
  trig("allyDies", [draw]),
  act({ loyalty: 1 }, [token("tok-g-zombie-22-b")], "+1"),
  act({ loyalty: -4 }, [E("sacrificeTwo")], "-4"),
  act({ loyalty: -9 }, [E(176)], "-9"),
]);
s(
  177,
  [
    { e: "toHand", what: "T0" },
    { e: "toHand", what: "T1" },
    { e: "discard", who: "you", n: 1 },
  ],
  [gy({ type: "Creature" }, true), gy({ type: "Creature" }, true)],
);
a(179, [trig("oppCast", [E("painfulQuandary")])]);
a(182, [
  act(
    { mana: "{1}{B}" },
    [{ e: "reanimate", what: "selfAny", tapped: true }],
    "從墳墓場回場",
    { fromGraveyard: true, keepSelf: true },
  ),
]);
s(183, [E("allGraves")]);
a(184, [etb([{ e: "tutor", filter: {} }])]);
a(185, [
  trig("endStep", [cnt("T0")], {
    cond: C("opponentLostLife"),
    targets: [spec("creature", { ctrl: "you", sub: "Vampire" })],
  }),
]);
s(190, [token("tok-treasure", { count: { ctrl: "you", type: "Land" } })]);
modes(192, [
  { text: "2傷害", effects: [dmg(2)], targets: [ANY] },
  { text: "增幅：4傷害", cost: "{4}{R}", effects: [dmg(4)], targets: [ANY] },
]);
a(193, [
  trig("attacks", [dmg(4), dmg(3, "T1"), dmg(3, "T2")], {
    targets: [ANY, { ...ANY, optional: true }, { ...ANY, optional: true }],
  }),
]);
a(194, [trig("attacks", [E(194)])]);
a(195, [
  act({ tap: true, sacSelf: true }, [dmg(1)], "造成1傷害", { targets: [ANY] }),
]);
a(197, [event("noncreatureOrDragon", [dmg(1, "opp")])]);
a(198, [
  F("mustAttack"),
  trig(
    "combatStart",
    [
      {
        e: "costThen",
        prompt: "支付{R}返場？",
        cost: { mana: "{R}" },
        then: [{ e: "reanimate", what: "selfAny" }],
      },
    ],
    { fromGraveyard: true, cond: fer },
  ),
]);
a(199, [
  trig(
    "attacks",
    [
      {
        e: "costThen",
        prompt: "支付{R}令其不能阻擋？",
        cost: { mana: "{R}" },
        then: [{ e: "grant", what: "T0", grant: { cantBlock: true } }],
      },
    ],
    { targets: [CR] },
  ),
]);
a(201, [
  act({ mana: "{R}", sacSelf: true }, [dmg(N("lastPower"))], "依力量造成傷害", {
    targets: [spec("creatureOrPlaneswalker")],
  }),
]);
s(202, [E(202)], [spec("player")]);
s(203, [E("steal"), treasure], [CR]);
a(204, [
  act(
    { tap: true },
    [gob({ count: { ctrl: "you", sub: "Goblin" } })],
    "依鬼怪數派衍生物",
  ),
]);
s(205, [dmg(2, { all: { type: "Creature", nonKw: "flying" } })]);
modes(207, [
  { text: "生物3傷害", effects: [dmg(3, { all: { type: "Creature" } })] },
  { text: "玩家3傷害", effects: [dmg(3, "you"), dmg(3, "opp")] },
]);
s(210, [{ e: "draw", n: 2 }]);
d(210, { addCost: { discard: 1 } });
a(211, [
  etb(
    [
      {
        e: "may",
        prompt: "互鬥？",
        effects: [{ e: "fight", a: "self", b: "T0" }],
      },
    ],
    { targets: [OPP_CR] },
  ),
]);
d(213, { aura: { target: CR, grant: {} }, abilities: [F("blanchwood")] });
s(
  214,
  [destroy],
  [
    spec("permanent", {
      or: [
        { type: ["Artifact", "Enchantment"] },
        { type: "Creature", kw: "flying" },
      ],
    }),
  ],
);
a(216, [F("doubleTokens"), F("doubleCounters")]);
a(217, [
  an({ sub: "Elf", other: true }),
  trig("attacks", [
    gain({ count: { ctrl: "you", sub: "Elf", attacking: true } }),
  ]),
]);
a(218, [
  etb([elf()], {
    cond: { c: "controls", filter: { ctrl: "you", sub: "Elf", other: true } },
  }),
]);
a(219, [
  an({ sub: "Elf", other: true }),
  act(
    { tap: true },
    [{ e: "addMana", mana: ["G"], n: { count: { ctrl: "you", sub: "Elf" } } }],
    "依法師數產綠",
  ),
]);
a(220, [
  etb([draw], { cond: fer }),
  an({}, 0, 0, ["trample"]),
  trig("allyEtb", [draw], { filter: { powMin: 4 } }),
]);
s(221, [E(221)]);
d(222, {
  foundation: { totalPowerDiscount: true },
});
d(224, { kicker: "{2}{G}", foundation: { kickerCounters: 2 } });
a(224, [an({ plusCounters: true }, 0, 0, ["trample"])]);
modes(225, [
  { text: "基本地", effects: [{ e: "searchLand", to: "battlefield" }] },
  {
    text: "增幅：兩個基本地",
    cost: "{4}{G}",
    effects: [
      { e: "searchLand", to: "battlefield" },
      { e: "searchLand", to: "battlefield" },
    ],
  },
]);
s(226, [E(226)]);
a(228, [
  act({ mana: "{3}{G}" }, [E(228)], "成為狼人並抓牌", { oncePerGame: true }),
]);
a(229, [
  trig("combatStart", [cnt("self")], {
    cond: {
      c: "controls",
      filter: { ctrl: "you", other: true, type: "Creature", powMin: 4 },
    },
  }),
]);
a(232, [
  act({ mana: "{G}" }, [E(232)], "放逐墳墓場牌", { targets: [spec("gyCard")] }),
]);
a(234, [
  act(
    { loyalty: 1 },
    [
      {
        e: "dig",
        n: 4,
        take: 1,
        optional: true,
        filter: { type: ["Creature", "Land"] },
        rest: "bottom",
        randomBottom: true,
      },
    ],
    "+1",
  ),
  act({ loyalty: -3 }, [destroy], "-3", {
    targets: [
      spec("permanent", {
        or: [
          { type: ["Artifact", "Enchantment"] },
          { type: "Creature", kw: "flying" },
        ],
      }),
    ],
  }),
  act({ loyalty: -8 }, [E("vivienEmblem")], "-8"),
]);
d(236, { etbCountersX: true });
a(236, [event("otherNonHydraPlus", [cnt("self")])]);
a(238, [F("aberrationSize"), trig("castAny", [E(238)])]);
a(239, [an({ kw: "flying", other: true })]);
a(240, [trig("allyEtb", [cnt("evCard")], { filter: { other: true } })]);
s(241, [token("tok-g-soldier-11-w", 2), pump(mine, 1, 1, ["haste"])]);
a(242, [
  trig("combatDamagePlayer", [elf({ ev: true })]),
  act(
    { tap: true, tapN: { filter: { sub: "Elf" }, n: 10 } },
    [lose(10), gain(10)],
    "橫置十個精靈吸血",
  ),
]);
a(243, [F("muldrotha")]);
a(244, [F("protectionEverything"), F("shuffleInstead")]);
a(245, [trig("attacks", [pump("self", 2, 2)], { when: fer })]);
d(245, { produces: ["R", "G"] });
a(248, [trig("castInstSorc", [E(248)])]);
d(249, {
  equip: { cost: "{1}", grant: {} },
  abilities: [trig("landfall", [pump("attached", 2, 2)])],
});
a(250, [
  act(
    { mana: "{3}", sacSelf: true },
    [
      {
        e: "tutorMany",
        filter: { type: "Land", basic: true },
        n: 2,
        to: "battlefield",
        tapped: true,
      },
    ],
    "找兩個基本地",
  ),
]);
a(251, [etb([E(251)])]);
d(253, {
  equip: {
    cost: "{1}",
    grant: { p: 1, t: 1 },
    trigger: trig("combatDamagePlayer", [treasure]),
  },
});
d(254, {
  ecl: { asEnters: "color" },
  chosenColorMana: true,
  produces: ["W", "U", "B", "R", "G"],
  abilities: [F("bannerColor")],
});
a(255, [F("mustAttack"), F("cantBlockedWalls")]);
d(258, { equip: { cost: "{1}", grant: { kw: ["hexproof", "haste"] } } });
d(267, {
  ecl: { asEnters: "tribe" },
  produces: ["C"],
  abilities: [F("courtyardMana")],
});
a(257, [
  etb([
    {
      e: "tutorMany",
      filter: { type: "Land", basic: true },
      to: "battlefield",
      n: 1,
      tapped: true,
    },
  ]),
  trig("dies", [{ e: "may", prompt: "抓牌？", effects: [draw] }]),
]);
a(489, [trig("youAttack", [gain(N("eventAttackers"))])]);
s(492, [dmg(3), gain(2)], [spec("creature", { tapped: true })]);
s(493, [E("exileDeath"), dmg(3)], [spec("creature", { inCombat: true })]);
a(495, [
  act(
    { mana: "{3}{W}" },
    [
      cnt("T0"),
      {
        e: "if",
        cond: { c: "targetIs", t: 0, filter: { sub: "Cat" } },
        then: [pump("T0", 0, 0, ["first_strike"])],
      },
    ],
    "攻擊生物指示物",
    {
      targets: [
        {
          ...spec("creature", { ctrl: "you", attacking: true }),
          notSelf: true,
        },
      ],
    },
  ),
]);
a(497, [
  act(
    { mana: "{3}{W}{W}" },
    [
      pump(
        { all: { ctrl: "you", type: "Creature", attacking: true } },
        N("attackers"),
        N("attackers"),
      ),
    ],
    "強化攻擊生物",
  ),
]);
a(502, [
  etb([{ e: "exileLinked", what: "T0" }, gain(2)], {
    targets: [spec("permanent", { ctrl: "opp", nonType: "Land" }, true)],
  }),
]);
a(503, [
  trig("lifegain", [cnt("self")]),
  {
    kind: "static",
    self: { cond: { c: "lifeGte", n: 25 }, grant: { kw: ["double_strike"] } },
  },
]);
a(506, [etb([treasure]), an({ sub: "Pirate", other: true })]);
d(507, {
  aura: { target: CR, grant: { loseAbilities: true } },
  abilities: [F("piranhaAura")],
});
a(510, [
  {
    kind: "static",
    self: { cond: { c: "selfAttacking" }, grant: { kw: ["flying"] } },
  },
]);
d(514, {
  aura: { target: CR, grant: { noUntap: true } },
  abilities: [etb([{ e: "tap", what: "attached" }])],
});
s(517, [E(517)], [gy({ type: "Creature" })]);
a(518, [
  an({ sub: "Vampire", attacking: true }, 0, 0, ["deathtouch", "lifelink"]),
  trig(
    "allyDies",
    [{ e: "costThen", prompt: "支付2生命？", cost: { life: 2 }, then: [draw] }],
    { filter: { sub: "Vampire" } },
  ),
]);
modes(520, [
  {
    text: "消滅",
    effects: [destroy],
    targets: [spec("creatureOrPlaneswalker")],
  },
  {
    text: "殭屍返場",
    effects: [{ e: "reanimate", what: "T0", tapped: true }],
    targets: [gy({ type: "Creature", sub: "Zombie" })],
  },
]);
a(521, [
  an({ sub: "Skeleton" }, 1, 1, ["deathtouch"]),
  an({ sub: "Zombie", other: true, nonSub: "Skeleton" }, 1, 1, ["deathtouch"]),
]);
a(527, [
  act(
    { mana: "{4}{B}{B}", exileSelf: true },
    [token("tok-g-zombie-22-b", 2)],
    "從墳墓場放逐派殭屍",
    { fromGraveyard: true, sorcery: true },
  ),
]);
s(528, [E("undyingMalice")], [CR]);
a(533, [
  trig(
    "combatStart",
    [{ e: "may", prompt: "+2/+0？", effects: [pump("T0", 2)] }],
    { targets: [CR] },
  ),
]);
d(534, { produces: ["R"], abilities: [F("orbMana")] });
a(536, [
  { kind: "static", spellCostLess: { filter: { sub: "Dragon" }, n: 1 } },
]);
a(537, [
  an({ sub: "Goblin", other: true }),
  act(
    { mana: "{R}" },
    [pump("T0", 0, 0, ["flying"]), E("goblinCombatSac")],
    "鬼怪飛行",
    {
      targets: [
        { ...spec("creature", { ctrl: "you", sub: "Goblin" }), notSelf: true },
      ],
    },
  ),
]);
a(539, [an({ attacking: true }, 1, 0)]);
a(540, [
  act({ tap: true }, [pump("T0", 0, 0, ["unblockable"])], "小生物不能被阻擋", {
    targets: [{ ...spec("creature", { powMax: 2 }), notSelf: true }],
  }),
]);
a(541, [
  {
    kind: "static",
    self: {
      cond: { c: "controls", filter: { ctrl: "you", sub: "Dragon" } },
      grant: { kw: ["flying"] },
    },
  },
]);
s(545, [E("exileDeath"), dmg(3)], [spec("creatureOrPlaneswalker")]);
s(546, [{ e: "draw", n: 2 }, treasure]);
d(546, { addCost: { discard: 1 } });
a(550, [
  etb([dmg({ count: { ctrl: "you", sub: "Goblin" } })], { targets: [OPP_CR] }),
]);
d(553, {
  frontier: { variableTargets: "own", distribute: 3 },
  ecl: { variableTargets: "creature" },
});
s(553, [E("distributeThenDouble")]);
s(555, [pump(mine, 3, 3), E("mustBlocked")]);
d(557, {
  aura: { target: spec("permanent", { type: "Land" }), grant: {} },
  abilities: [etb([cnt("T0")], { targets: [MY_CR] }), F("horizonsMana")],
});
d(563, {
  equip: { cost: "{2}", grant: { p: 2, t: 1 } },
  abilities: [
    etb([{ e: "attach", what: "T0" }], {
      targets: [spec("creature", { ctrl: "you", sub: "Pirate" })],
    }),
  ],
});
d(565, {
  aura: { target: CR, grant: { p: 4, t: 4, kw: ["flying", "first_strike"] } },
  abilities: [
    F("angelAura"),
    trig("attachedDies", [{ e: "toHand", what: "selfAny" }]),
  ],
});
a(566, [etb([gain(N("twiceGates"))])]);
a(567, [
  {
    kind: "static",
    spellCostLess: { filter: { sub: ["Kithkin", "Soldier"] }, n: 1 },
  },
]);
a(568, [
  etb([], {
    modes: [
      { text: "占卜", effects: [{ e: "scry", n: 2 }] },
      { text: "生命", effects: [gain(3)] },
      {
        text: "閃爍",
        effects: [E("princeBlink")],
        targets: [
          { ...spec("creature", { owner: "you" } as Filter), notSelf: true },
        ],
      },
    ],
  }),
]);
a(569, [F("crusaderSize")]);
s(
  571,
  [exile, { e: "scry", n: 1 }],
  [spec("creatureOrPlaneswalker", { color: ["B", "R"] })],
);
a(574, [
  trig("landfall", [], {
    modes: [
      { text: "貓獸", effects: [token("tok-fdn-cat-beast")] },
      {
        text: "指示物與警戒",
        effects: [cnt(mine), pump(mine, 0, 0, ["vigilance"])],
      },
    ],
  }),
]);
s(575, [
  { e: "destroy", what: { all: { type: "Creature" } } },
  gain({ last: true }),
]);
a(576, [F("hexproofBlack"), F("blackPower")]);
a(577, [trig("allyAttacks", [gain(1)], { filter: { color: "W" } })]);
a(578, [
  trig(
    "allyEtb",
    [
      {
        e: "costThen",
        prompt: "支付{1}抽牌？",
        cost: { mana: "{1}" },
        then: [draw],
      },
    ],
    { filter: { powMax: 2, other: true } },
  ),
]);
a(579, [
  an({ sub: "Cat", other: true }, 1, 1, ["lifelink"]),
  etb([token("tok-g-cat-11-w-lifelink", 2)]),
]);
a(581, [etb([{ e: "exileLinked", what: "T0" }], { targets: [OPP_CR] })]);
modes(583, [
  {
    text: "不滅",
    effects: [pump("T0", 0, 0, ["indestructible"])],
    targets: [CR],
  },
  {
    text: "消滅大生物",
    effects: [destroy],
    targets: [spec("creature", { toughMin: 4 })],
  },
]);
a(585, [
  act({ tap: true }, [{ e: "draw", n: 3 }], "抽三張"),
  act({ mana: "{2}{U}{U}" }, [{ e: "bounce", what: "self" }], "回手"),
]);
s(586, [
  { e: "draw", n: 2 },
  { e: "if", cond: ra, then: [], else: [{ e: "discard", who: "you", n: 1 }] },
]);
a(587, [trig("eachDrawStep", [E("activeDraw")])]);
s(589, [E(589)]);
s(590, [{ e: "counter", what: "T0" }], [spec("spell", { color: ["R", "G"] })]);
a(591, [F("preventCombatBoth")]);
a(592, [
  trig("landfall", [pump("self", 0, 0, ["unblockable"])], {
    filter: { sub: "Gate" },
  }),
  trig("combatDamagePlayer", [draw]),
]);
d(593, { frontier: { flashExtra: 2 } });
a(593, [
  etb(
    [{ e: "may", prompt: "回手？", effects: [{ e: "bounce", what: "T0" }] }],
    { targets: [spec("creature", { ctrl: "opp", tapped: true })] },
  ),
]);
s(594, [
  { e: "tutor", filter: { or: [{ type: "Instant" }, { kw: "flash" }] } },
]);
s(595, [E(595)], [spec("player")]);
a(596, [
  etb([{ e: "toHand", what: "T0" }], {
    targets: [gy({ type: ["Instant", "Sorcery"] })],
  }),
]);
a(597, [F("spellUncounterable")]);
a(598, [F("tempest")]);
a(600, [
  etb([{ e: "counter", what: "T0" }], {
    targets: [spec("spell", { type: ["Artifact", "Creature"] })],
  }),
]);
s(601, [destroy], [spec("creature", { color: ["G", "W"] })]);
a(602, [trig("upkeep", [E(602)], { foundationModes: "pact" })]);
a(603, [event("eachCombat", [E(603)])]);
s(604, [E(604)]);
a(605, [
  trig("dies", [{ e: "reanimate", what: "T0" }], {
    targets: [gy({ type: "Creature", mvMax: 2 })],
  }),
]);
a(607, [
  trig(
    "allyDies",
    [
      {
        e: "costThen",
        prompt: "支付{B}吸血？",
        cost: { mana: "{B}" },
        then: [lose(2, "T0"), gain(2)],
      },
    ],
    { filter: { sub: "Vampire" }, targets: [spec("player")] },
  ),
]);
a(608, [F("hexproofWhite"), F("whitePower")]);
d(610, { foundation: { divinity: true } });
a(610, [
  F("divinityIndestructible"),
  act({}, [E("discardOpponentHand")], "移除神性指示物", {
    removeCounter: { n: 1 },
  }),
]);
d(611, { kicker: "{3}{B}" });
a(611, [
  etb([{ e: "reanimate", what: "T0" }], {
    cond: C("kicked"),
    targets: [gy({ type: "Creature" })],
  }),
]);
s(
  613,
  [
    { e: "toHand", what: "T0" },
    { e: "toHand", what: "T1" },
  ],
  [gy({ type: "Creature" }, true), gy({ type: "Creature" }, true)],
);
d(613, { costReduce: { cond: { c: "gainedLifeGte", n: 3 }, mana: "{3}" } });
s(614, [E(614)], [OPP]);
a(616, [etb([{ e: "tutor", filter: {}, to: "graveyard" }])]);
d(617, { foundation: { charge: 3 } });
a(617, [
  act(
    { mana: "{1}", tap: true },
    [{ e: "tutor", filter: {} }, E("giveTalisman")],
    "搜尋牌並交給對手",
    { duringYourTurn: true, removeCounter: { n: 1 } },
  ),
]);
a(618, [trig("eachEndStep", [{ e: "sac", what: "self" }])]);
d(619, { frontierStack: "retarget", costReduce: { cond: fer, mana: "{3}" } });
s(619, [E("retargetStack")]);
a(621, [trig("combatDamagePlayer", [E(621)])]);
a(622, [
  trig("upkeep", [token("tok-g-dragon-55-r-flying")], {
    cond: C("lands6"),
  }),
]);
a(623, [F("lavarunner")]);
a(624, [F("noLifeGain")]);
s(625, [E(625)], [OPP, spec("permanent", { ctrl: "you" })]);
a(626, [etb([E("hoardDragon")]), trig("dies", [E("hoardReturn")])]);
a(627, [
  trig("allyEtb", [token("tok-g-dragon-55-r-flying")], {
    filter: { sub: "Dragon", token: false, other: true },
  }),
  act(
    { mana: "{1}{R}" },
    [pump({ all: { ctrl: "you", sub: "Dragon", type: "Creature" } }, 1)],
    "龍+1/+0",
  ),
]);
a(628, [event("oppWhiteBlueSpell", [dmg(2, "opp")])]);
s(629, [E("exileDeath"), dmg(4)], [spec("creatureOrPlaneswalker")]);
a(630, [trig("upkeep", [dmg(1, "you")])]);
a(631, [
  etb([token("tok-woe-rat", 2)]),
  trig("upkeep", [
    {
      e: "costThen",
      prompt: "犧牲另一生物？",
      cost: { sac: { type: "Creature", other: true } },
      then: [cnt("self"), E("impulse1")],
    },
  ]),
]);
a(632, [F("cantBlockedHumans"), trig("combatDamagePlayer", [cnt("self")])]);
a(633, [
  trig("castOpp", [{ e: "may", prompt: "放指示物？", effects: [cnt("self")] }]),
]);
s(635, [
  {
    e: "tutorMany",
    filter: { type: "Land", or: [{ basic: true }, { sub: "Gate" }] },
    n: 2,
    to: "battlefield",
    tapped: true,
  },
]);
a(636, [etb([{ e: "tutor", filter: { type: "Creature", mvMin: 6 } }])]);
a(637, [event("deathtouchHit", [E("poison2")])]);
a(638, [event("ownSpellSelfTarget", [draw])]);
d(639, { etbCounters: 4 });
a(639, [
  act(
    { mana: "{2}{G}{G}" },
    [cnt("self", { power: "self" })],
    "依力量放指示物",
  ),
]);
a(640, [
  event("oppBlueBlack", [
    { e: "may", prompt: "指示物？", effects: [cnt("self")] },
  ]),
]);
d(641, {
  aura: { target: CR, grant: {} },
  abilities: [
    event("attachedAttack", [E(641)]),
    trig(
      "sacrifice",
      [
        {
          e: "tutorMany",
          filter: { type: "Land", basic: true },
          n: 2,
          to: "battlefield",
          tapped: true,
        },
      ],
      { fromGraveyard: true },
    ),
  ],
});
a(642, [
  trig("attacks", [cnt("self")]),
  event("damagedBySelfDies", [cnt("self")]),
]);
s(
  643,
  [pump("T0", { x: true }, { x: true }), { e: "fight", a: "T0", b: "T1" }],
  [MY_CR, { ...OPP_CR, optional: true }],
);
a(646, [
  etb([
    {
      e: "costThen",
      prompt: "犧牲地找兩基本地？",
      cost: { sac: { type: "Land" } },
      then: [
        {
          e: "tutorMany",
          filter: { type: "Land", basic: true },
          n: 2,
          to: "battlefield",
          tapped: true,
        },
      ],
    },
  ]),
]);
a(647, [
  trig("combatStart", [pump("T0", 0, 0, ["haste"])], {
    cond: C("totalPower8"),
    targets: [MY_CR],
  }),
]);
a(648, [trig("allyEtb", [E(648)], { filter: { other: true } })]);
a(649, [F("vizierCast")]);
a(650, [
  trig("allyEtb", [E(650)], { filter: { nonSub: "Human", other: true } }),
]);
a(651, [
  trig("attacks", [{ e: "untap", what: mine }, E("extraCombat")], {
    oncePerTurn: true,
  }),
]);
a(652, [
  act(
    { mana: "{1}", sacOther: { type: "Creature" } },
    [E("sacToughLife")],
    "犧牲獲得生命",
  ),
  act(
    { mana: "{1}{W}{B}", sacOther: { type: "Creature" } },
    [exile],
    "放逐永久物",
    {
      cond: { c: "lifeGte", n: 30 },
      targets: [spec("permanent", { nonType: "Land" })],
    },
  ),
]);
s(654, [E(654)]);
a(656, [F("exileSpellsGrave")]);
a(657, [F("drakePower")]);
a(658, [trig("allyDies", [E(658)], { filter: { other: true } })]);
a(659, [
  trig(
    "combatStart",
    [cnt("T0", { power: "self" }), pump("T0", 0, 0, ["haste"])],
    { targets: [{ ...MY_CR, notSelf: true }] },
  ),
]);
a(660, [
  trig("becomesTapped", [exile, cnt("self")], {
    targets: [spec("gyCard", {}, true)],
  }),
  act(
    { sacOther: { type: "Creature" } },
    [pump("self", 0, 0, ["indestructible"]), { e: "tap", what: "self" }],
    "犧牲：不滅",
  ),
]);
s(661, [E(661)], [spec("permanent", { nonType: "Land" })]);
a(663, [trig("castNoncreature", [E(663)])]);
d(663, { ward: 3, wardLife: 3 });
d(664, { foundation: { zegana: true } });
a(664, [etb([{ e: "draw", n: { power: "self" } }])]);
a(665, [trig("attacks", [E("ventmawMana")])]);
s(666, [
  {
    e: "delayed",
    on: "castInstSorc",
    once: true,
    effects: [{ e: "copySpell" }],
  },
]);
a(667, [
  trig(
    "combatDamagePlayer",
    [{ e: "may", prompt: "消滅神器或結界？", effects: [destroy] }],
    {
      targets: [
        spec("permanent", { ctrl: "opp", type: ["Artifact", "Enchantment"] }),
      ],
    },
  ),
]);
a(668, [
  an({ color: "G", other: true }),
  an({ color: "W", other: true }),
  event("opponentDiscardSelf", [E("liegeDiscard")]),
]);
d(669, { equip: { cost: "{2}", grant: { kw: ["deathtouch", "lifelink"] } } });
a(671, [F("shuffleInstead")]);
d(672, { ecl: { asEnters: "color" } });
a(672, [event("castChosenColor", [gain(1)])]);
a(673, [
  act({ tap: true, exileSelf: true }, [E("shuffleGrave")], "洗回墳墓場"),
]);
d(674, { equip: { cost: "{2}", grant: { kw: ["double_strike"] } } });
d(675, { costReduce: { perCount: { ctrl: "you", sub: "Gate" } } });
a(675, [
  F("cantBlockedSmall"),
  trig(
    "landfall",
    [{ e: "may", prompt: "放回牌庫頂？", effects: [E("selfTop")] }],
    { fromGraveyard: true, filter: { sub: "Gate" } },
  ),
]);
a(676, [
  act(
    { tap: true },
    [
      { e: "chargeCounter", what: "self", n: 1 },
      { e: "scry", n: 1 },
      E("tomeCheck"),
    ],
    "翻頁占卜",
  ),
  act(
    { mana: "{2}", tap: true },
    [{ e: "chargeCounter", what: "self", n: 1 }, draw, E("tomeCheck")],
    "翻頁抓牌",
  ),
]);
d(677, { produces: ["R"], abilities: [F("gogglesMana")] });
a(678, [
  trig("castAny", [cnt("self", N("eventColors"))]),
  act(
    {},
    [
      {
        e: "addMana",
        mana: ["W", "W", "U", "U", "B", "B", "R", "R", "G", "G"],
      },
    ],
    "移除五個指示物加法力",
    { removeCounter: { n: 5 }, oncePerTurn: true },
  ),
]);
a(679, [F("spyglass")]);
a(680, [
  etb([exile], { targets: [spec("gyCard")] }),
  act(
    { tap: true, sacSelf: true },
    [E("exileOpponentGrave")],
    "放逐對手墳墓場",
  ),
  act({ mana: "{1}", tap: true, sacSelf: true }, [draw], "抓牌"),
]);
a(681, [
  act({ mana: "{2}" }, [pump("self", 1)], "+1/+0"),
  act({}, [E(681)], "依X消滅", { xMana: 1, oncePerTurn: true }),
  trig("combatDamagePlayer", [E("hellkiteHit")]),
]);
a(682, [
  act({ mana: "{1}" }, [{ e: "addManaOfChoice", n: 1 }], "加法力", {
    oncePerTurn: true,
  }),
]);
a(685, [
  act(
    { mana: "{4}" },
    [
      cnt("self", 2),
      {
        e: "may",
        prompt: "成為生物？",
        effects: [
          {
            e: "animate",
            permanent: true,
            what: "self",
            p: 0,
            t: 0,
            subtypes: ["Elemental"],
          },
        ],
      },
    ],
    "指示物與化生",
  ),
]);
a(686, [
  act({ mana: "{1}", tap: true, sacSelf: true }, [draw], "抓牌", {
    cond: C("lands5"),
  }),
]);
a(687, [
  act({ mana: "{2}", tap: true, sacSelf: true }, [E(687)], "消滅非基本地", {
    targets: [spec("permanent", { type: "Land", basic: false, ctrl: "opp" })],
  }),
]);
a(706, [
  { kind: "static", lifegainPlus: 1 },
  {
    kind: "static",
    self: { cond: { c: "lifeGte", n: 25 }, grant: { p: 2, t: 2 } },
  },
]);
a(707, [an({ sub: "Angel", other: true }, 1, 1, ["lifelink"])]);
d(709, {
  aura: { target: spec("permanent"), grant: {} },
  abilities: [F("controlAura")],
});
d(711, { kicker: "{5}" });
s(711, [E(711)], [CR]);
s(
  712,
  [E(712)],
  [spec("permanent", { ctrl: "opp", type: ["Creature", "Enchantment"] })],
);
d(713, { kicker: "{B}" });
a(713, [
  etb([E("sacCreature")], { cond: C("kicked"), targets: [spec("player")] }),
]);
a(714, [etb([pump(opp, -2, -2)]), trig("oppDies", [lose(2)])]);
a(715, [F("doubleCreatureDamage")]);
a(717, [trig("allyEtb", [dmg(1, "opp")])]);
a(719, [
  an({ sub: "Elf", other: true }),
  act({ mana: "{G}", tap: true }, [elf()], "派精靈"),
]);
modes(721, [
  {
    text: "4傷害",
    effects: [dmg(4)],
    targets: [spec("permanentOrPlayer", { nonType: "Creature" })],
  },
  {
    text: "永久物不滅",
    effects: [pump({ all: { ctrl: "you" } }, 0, 0, ["indestructible"])],
  },
  {
    text: "連擊",
    effects: [pump("T0", 0, 0, ["double_strike"])],
    targets: [CR],
  },
]);
d(723, { ecl: { asEnters: "tribe" } });
a(723, [
  F("automaton"),
  {
    kind: "static",
    anthem: {
      filter: { ctrl: "you", chosenTribe: true, other: true, type: "Creature" },
      grant: { p: 1, t: 1 },
    },
  },
]);
a(724, [
  act(
    { mana: "{2}", tap: true, sacSelf: true },
    [{ e: "tutor", filter: { type: "Land" } }],
    "搜地",
  ),
]);
a(725, [act({ tap: true }, [E("lotusMana")], "同色三點")]);
a(726, [
  act({ tap: true }, [{ e: "addMana", mana: ["C", "C"] }], "兩點無色"),
  act(
    { mana: "{2}", tap: true, sacSelf: true },
    [{ e: "draw", n: 2 }],
    "抓兩張",
  ),
]);
a(727, [act({ mana: "{3}", tap: true }, [E(727)], "回手找門並檢查勝利")]);
export const completeFdn = complete;
a(609, [trig("allyDies", [dmg(1, "you"), draw], { filter: { token: false } })]);

d(219, { produces: ["G"] });
d(725, { produces: ["W", "U", "B", "R", "G"] });
d(726, { produces: ["C"] });

d(679, { ecl: { asEnters: "cardName" } });
