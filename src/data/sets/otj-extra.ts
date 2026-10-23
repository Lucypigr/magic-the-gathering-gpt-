import catalog from "./otj-catalog.json";
import auto from "./otj-auto.json";
import { act, etb, trig, CR, MY_CR, OPP_CR, ANY, OPP } from "../dsl";
import {
  setBuilder,
  spec,
  gy,
  mine,
  draw,
  treasure,
  token,
  pump,
  cnt,
  dmg,
  destroy,
  gain,
  lose,
  subsets,
} from "./frontier-dsl";
import type { Ability, Effect, Mode } from "../../engine/types";
const { d, a, s, modes, E, C, N, F, event, complete } = setBuilder(
  "OTJ",
  catalog,
  auto,
);
const merc = (n: any = 1) => token("tok-otj-mercenary", n),
  zombie = () => token("tok-otj-zombie");
const saddle = (n: number): Ability =>
  act({ crew: n }, [{ e: "saddle" }], "騎乘" + n, { sorcery: true });
const saddled = (
  effects: Effect[],
  targets?: import("../../engine/types").TargetSpec[],
) => trig("attacks", effects, { when: { c: "saddled" }, targets });
const spree = (n: number, options: Mode[]) => {
  const base = catalog.find((c) => c.number === n)!.cost;
  modes(
    n,
    subsets(options).map((m) => ({ ...m, cost: base + (m.cost ?? "") })),
  );
};
s(1, [E(1)]);
a(2, [F("archangelTax")]);
a(3, [
  act({ mana: "{3}{W}" }, [pump("self", N("sourceToughness"))], "依防禦力強化"),
]);
a(4, [etb([E(4)], { targets: [spec("spell")] }), F("avenTax")]);
a(5, [
  saddled([
    cnt({ all: { ctrl: "you", type: "Creature", other: true } }),
    gain({ count: { ctrl: "you", type: "Creature", other: true } }),
  ]),
  saddle(2),
]);
s(6, [E(6)], [spec("permanent", { type: ["Artifact", "Creature"] })]);
a(7, [saddled([token("tok-otj-sheep")]), saddle(2)]);
a(8, [etb([E(8)], { cond: C("oppMoreLands") })]);
d(9, { frontier: { dustAnimus: true } });
spree(11, [
  {
    text: "生物失去異能",
    cost: "{1}",
    effects: [{ e: "loseAbilitiesEot", what: { all: { type: "Creature" } } }],
  },
  {
    text: "一個己方生物不滅",
    cost: "{1}",
    effects: [E("chooseIndestructible")],
  },
  {
    text: "消滅所有生物",
    cost: "{3}{W}{W}",
    effects: [{ e: "destroy", what: { all: { type: "Creature" } } }],
  },
]);
a(12, [etb([{ e: "scry", n: 2 }]), saddled([E(12)]), saddle(1)]);
a(13, [
  etb([
    {
      e: "dig",
      n: 5,
      take: 1,
      optional: true,
      rest: "bottom",
      randomBottom: true,
      filter: {
        or: [
          { type: "Creature", sub: "Mount" },
          { type: "Land", sub: "Plains" },
        ],
      },
    },
  ]),
]);
spree(14, [
  {
    text: "閃爍非衍生生物",
    cost: "{1}",
    targets: [spec("creature", { token: false })],
    effects: [E("swiftSpiral")],
  },
  {
    text: "消滅最大力量生物",
    cost: "{2}",
    targets: [CR],
    effects: [E("destroyLargest")],
  },
]);
a(15, [
  F("highNoon"),
  act({ mana: "{4}{R}", sacSelf: true }, [dmg(5)], "犧牲：造成5傷害", {
    targets: [ANY],
  }),
]);
a(17, [trig("endStep", [E("flyingCounter")], { cond: C("noHandSpell") })]);
a(18, [
  etb([{ e: "exileLinked", what: "T0" }], {
    targets: [spec("permanent", { ctrl: "opp", nonType: "Land" })],
  }),
  etb([merc()]),
]);
a(19, [
  etb([{ e: "exileLinked", what: "T0" }], {
    targets: [
      spec("permanent", { ctrl: "opp", type: ["Artifact", "Creature"] }),
    ],
  }),
]);
d(19, { frontier: { flashExtra: 2 } });
a(20, [
  etb([E(20)], {
    targets: [
      {
        ...spec(
          "permanent",
          { ctrl: "you", nonType: "Land", nonSub: "Faerie" },
          true,
        ),
        notSelf: true,
      },
    ],
  }),
]);
a(21, [
  {
    kind: "static",
    self: { cond: C("crime"), grant: { kw: ["double_strike"] } },
  },
]);
spree(22, [
  {
    text: "生物返場",
    cost: "{2}",
    effects: [{ e: "reanimate", what: "T0" }],
    targets: [gy({ type: "Creature" })],
  },
  {
    text: "坐騎或載具返場",
    cost: "{1}",
    effects: [{ e: "reanimate", what: "T0" }],
    targets: [gy({ sub: ["Mount", "Vehicle"] })],
  },
  {
    text: "光環或武具返場並結附",
    cost: "{1}",
    effects: [E(22)],
    targets: [gy({ sub: ["Aura", "Equipment"] })],
  },
]);
a(24, [
  trig("endStep", [cnt("self")], { cond: C("noHandSpell") }),
  act({ mana: "{4}{W}" }, [E(24)], "本回合多放一個+1/+1指示物"),
]);
a(25, [
  etb([merc()]),
  act(
    { mana: "{2}", sacOther: { token: true } },
    [pump("self", 0, 0, ["indestructible"]), { e: "tap", what: "self" }],
    "犧牲衍生物：不滅",
  ),
]);
spree(26, [
  {
    text: "消滅神器",
    cost: "{1}",
    effects: [destroy],
    targets: [spec("permanent", { type: "Artifact" })],
  },
  {
    text: "消滅結界",
    cost: "{1}",
    effects: [destroy],
    targets: [spec("permanent", { type: "Enchantment" })],
  },
  {
    text: "全體指示物",
    cost: "{1}",
    effects: [{ e: "countersEachOf", who: "T0", n: 1 }],
    targets: [spec("player")],
  },
]);
spree(27, [
  {
    text: "重置全體生物",
    cost: "{1}",
    effects: [E("untapPlayer")],
    targets: [spec("player")],
  },
  {
    text: "連擊",
    cost: "{1}",
    effects: [pump("T0", 0, 0, ["double_strike"])],
    targets: [CR],
  },
]);
a(28, [
  etb([E(28)], {
    targets: [
      gy({
        type: [
          "Creature",
          "Artifact",
          "Enchantment",
          "Planeswalker",
          "Land",
          "Kindred",
        ],
        mvMax: 3,
      }),
    ],
  }),
]);
d(29, { frontier: { sheriffCounters: true } });
a(30, [etb([pump(mine, 1, 1, ["vigilance"])])]);
s(31, [dmg(N("steerClear"))], [spec("creature", { inCombat: true })]);
a(32, [
  act(
    { mana: "{2}", tap: true },
    [{ e: "tap", what: "T0" }],
    "橫置非坐騎生物",
    { targets: [spec("creature", { nonSub: "Mount" })] },
  ),
]);
a(33, [etb([cnt("T0")], { targets: [{ ...MY_CR, notSelf: true }] })]);
d(35, {
  equip: {
    cost: "{2}",
    grant: { p: 1, t: 1 },
    trigger: trig("attacks", [{ e: "tap", what: "T0" }], {
      targets: [OPP_CR],
    }) as import("../../engine/types").TriggeredAbility,
  },
  abilities: [etb([{ e: "attach", what: "T0" }], { targets: [MY_CR] })],
});
a(36, [
  saddled([pump("self", 0, 0, ["first_strike"]), { e: "scry", n: 1 }]),
  saddle(2),
]);
a(37, [event("otherOwnDiesBatch", [cnt("self")])]);
a(38, [trig("dies", [merc()])]);
a(39, [
  trig("combatDamagePlayer", [E(39)], {
    targets: [gy({ type: ["Instant", "Sorcery"] })],
  }),
  saddle(3),
]);
a(40, [
  act({ mana: "{1}{U}" }, [pump("self", 2, -2)], "+2/-2"),
  trig("endStep", [draw, { e: "discard", who: "you", n: 1 }], {
    cond: C("noHandSpell"),
  }),
]);
a(42, [
  event("crime", [{ e: "mill", who: "opp", n: 3 }], { oncePerTurn: true }),
]);
a(44, [event("outlawCast", [{ e: "copySpell" }])]);
a(45, [
  F("duelistPower"),
  event(
    "crime",
    [
      {
        e: "may",
        prompt: "抓一棄一？",
        effects: [draw, { e: "discard", who: "you", n: 1 }],
      },
    ],
    { oncePerTurn: true },
  ),
]);
a(46, [
  trig("endStep", [E(46)], { cond: C("noHandSpell") }),
  act({ mana: "{2}{U}" }, [{ e: "surveil", n: 1 }], "刺探1"),
]);
a(48, [F("fblthpPlot")]);
s(
  49,
  [pump("T0", 0, 0, ["hexproof"]), { e: "untap", what: "T0" }, E(49)],
  [MY_CR, { ...CR, notSelf: true, optional: true }],
);
a(50, [
  event("notFirstOwnTurnSpell", [zombie()]),
  trig("allyEtb", [cnt("evCard", N("otherZombiesEntered"))], {
    filter: { sub: "Zombie" },
  }),
]);
a(51, [F("geyserDiscount")]);
a(52, [
  etb([{ e: "tap", what: "T0" }], { targets: [spec("permanent")] }),
  act(
    { mana: "{2}{U}" },
    [draw, { e: "discard", who: "you", n: 1 }],
    "抓一棄一",
  ),
]);
spree(53, [
  {
    text: "指示物並不能阻擋",
    cost: "{3}",
    effects: [cnt("T0"), pump("T0", 0, 0, ["unblockable"])],
    targets: [CR],
  },
  {
    text: "放頂或底",
    cost: "{2}",
    effects: [{ e: "topOrBottom", what: "T0" }],
    targets: [spec("permanent", { type: ["Artifact", "Creature"] })],
  },
]);
d(54, {
  equip: {
    cost: "{2}{U}",
    grant: {},
    trigger: trig("combatDamagePlayer", [
      E(54),
    ]) as import("../../engine/types").TriggeredAbility,
  },
});
a(55, [etb([draw], { cond: { c: "spellsCast", n: 2 } })]);
a(56, [event("crime", [{ e: "surveil", n: 2 }], { oncePerTurn: true })]);
spree(57, [
  { text: "變0/1白兔", cost: "{1}", effects: [E("rabbit")], targets: [CR] },
  {
    text: "抓兩張",
    cost: "{3}",
    effects: [{ e: "draw", who: "T0", n: 2 }],
    targets: [spec("player")],
  },
]);
a(58, [
  {
    kind: "static",
    self: { cond: C("crime"), grant: { kw: ["unblockable"] } },
  },
  trig("combatDamagePlayer", [draw]),
]);
a(59, [etb([zombie(), cnt("created", N("twiceExtraSpells"))])]);
a(60, [
  etb([{ e: "bounce", what: "T0" }], {
    targets: [spec("creature", { tapped: true }, true)],
  }),
]);
spree(61, [
  { text: "2/2飛行精靈", cost: "{3}", effects: [token("tok-otj-spirit")] },
  {
    text: "反擊除非支付2",
    cost: "{1}",
    effects: [{ e: "counterUnless", what: "T0", pay: 2 }],
    targets: [spec("spell")],
  },
]);
s(62, [
  {
    e: "if",
    cond: { c: "handLte", who: "any", n: 0 },
    then: [E("surveilIfEmpty")],
  },
  { e: "draw", n: 3 },
]);
a(63, [
  trig("castAny", [cnt("self"), pump("self", 0, 0, ["unblockable"])], {
    cond: { c: "secondSpell" },
  }),
]);
s(64, [{ e: "draw", n: 2 }]);
d(64, { costReduce: { cond: C("crime"), mana: "{1}" } });
a(65, [
  trig("castAny", [E(65)], { cond: { c: "secondSpell" }, targets: [OPP_CR] }),
]);
spree(66, [
  {
    text: "交換生物",
    cost: "{2}",
    effects: [E("exchange")],
    targets: [CR, { ...CR, differentFrom: 0 }],
  },
  {
    text: "交換神器",
    cost: "{1}",
    effects: [E("exchange")],
    targets: [
      spec("permanent", { type: "Artifact" }),
      { ...spec("permanent", { type: "Artifact" }), differentFrom: 0 },
    ],
  },
  {
    text: "交換結界",
    cost: "{1}",
    effects: [E("exchange")],
    targets: [
      spec("permanent", { type: "Enchantment" }),
      { ...spec("permanent", { type: "Enchantment" }), differentFrom: 0 },
    ],
  },
]);
a(67, [
  etb([{ e: "grantFlashback", what: "T0" }], {
    targets: [gy({ type: ["Instant", "Sorcery"] })],
  }),
]);
a(68, [{ kind: "static", self: { cond: C("crime"), grant: { p: 2 } } }]);
a(69, [trig("attacks", [pump("T0", -3)], { targets: [OPP_CR] })]);
s(70, [E(70), { e: "exile", what: "selfAny" }]);

a(71, [
  {
    kind: "static",
    self: {
      cond: { c: "not", cond: { c: "spellsCast", n: 1 } },
      grant: { kw: ["hexproof"] },
    },
  },
]);
d(72, {
  aura: {
    target: spec("permanent", { type: ["Artifact", "Creature"] }),
    grant: { loseAbilities: true, noUntap: true },
  },
  abilities: [etb([{ e: "tap", what: "attached" }])],
});
s(
  73,
  [
    {
      e: "if",
      cond: { c: "controls", filter: { outlaw: true } },
      then: [pump("T0", -4)],
      else: [pump("T0", -1)],
    },
    draw,
  ],
  [CR],
);
s(
  74,
  [
    { e: "bounce", what: "T0" },
    { e: "bounce", what: "T1" },
  ],
  [
    spec("permanent", { nonType: "Land" }, true),
    spec("permanent", { nonType: "Land" }, true),
  ],
);
d(74, { frontier: { ownTargetDiscount: 3 } });
spree(75, [
  {
    text: "反擊",
    cost: "{1}{U}",
    effects: [{ e: "counter", what: "T0" }],
    targets: [spec("spell")],
  },
  {
    text: "複製己方神器或生物",
    cost: "{3}",
    effects: [E("copyToken")],
    targets: [
      spec("permanent", { ctrl: "you", type: ["Artifact", "Creature"] }),
    ],
  },
  {
    text: "抓二棄一",
    cost: "{2}",
    effects: [
      { e: "draw", n: 2 },
      { e: "discard", who: "you", n: 1 },
    ],
  },
]);
d(76, { ecl: { asEnters: "otjClone" } });
s(78, [E(78)], [OPP]);
d(79, { frontier: { morbidCounter: true } });
a(80, [
  event("crime", [cnt("self")], { oncePerTurn: true }),
  act({ mana: "{3}{B}" }, [lose(1, "T0"), gain(1)], "對手失去1生命", {
    targets: [OPP],
  }),
]);
a(81, [
  act(
    { mana: "{1}{B}", sacOther: { type: "Creature" } },
    [cnt("self"), E(81)],
    "犧牲另一生物",
  ),
]);
a(82, [trig("attacks", [E(82)]), saddle(3)]);
s(83, [E(83)], [CR]);
s(85, [pump("T0", N("negativeDeserts2"), N("negativeDeserts2"))], [CR]);
a(86, [etb([{ e: "mill", n: 2, who: "T0" }], { targets: [spec("player")] })]);
s(87, [pump("T0", 2), E(87)], [CR]);
a(88, [
  F("cantBlock"),
  event(
    "crime",
    [
      {
        e: "costThen",
        prompt: "支付{B}返場？",
        cost: { mana: "{B}" },
        then: [{ e: "reanimate", what: "selfAny" }],
      },
    ],
    { fromGraveyard: true },
  ),
]);
d(89, { ward: 2, wardLife: 2 });
a(89, [
  {
    kind: "static",
    anthem: {
      filter: { ctrl: "you", sub: ["Skeleton", "Zombie"] },
      grant: { p: 1, t: 1, kw: ["menace"] },
    },
  },
  event("crime", [E("gisaZombies")], { oncePerTurn: true }),
]);
d(90, { costReduce: { perGy: { type: "Creature" } } });
a(90, [etb([E(90)], { targets: [spec("opponent", {}, true)] })]);
spree(91, [
  { text: "搜尋牌置頂", cost: "{2}", effects: [E("tutorTop")] },
  {
    text: "抓三失去3生命",
    cost: "{B}{B}",
    effects: [{ e: "draw", n: 3, who: "T0" }, lose(3, "T0")],
    targets: [spec("player")],
  },
]);
a(92, [event("crime", [E(92)], { targets: [gy({ color: "B" }, true)] })]);
spree(93, [
  { text: "搜尋牌入墳墓場", cost: "{1}", effects: [E("tutorGrave")] },
  { text: "返場總法力值至多4的生物", cost: "{2}", effects: [E(93)] },
]);
s(94, [{ e: "toHand", what: "T0" }, merc()], [gy({ type: "Creature" }, true)]);
s(95, [E(95), { e: "surveil", n: 2 }], [OPP]);
a(96, [trig("dies", [merc()])]);
a(97, [
  event("crime", [pump("self", 0, 0, ["indestructible"])], {
    cond: { c: "yourTurn" },
  }),
]);
s(98, [E(98)]);
a(99, [
  etb([merc()]),
  trig("allyDies", [lose(1), gain(1)], { filter: { outlaw: true } }),
]);
a(100, [
  event(
    "crime",
    [{ e: "pumpChoice", what: "T0", kws: ["menace", "lifelink"] }],
    { targets: [MY_CR] },
  ),
]);
a(101, [event("crime", [lose(1), gain(1)], { oncePerTurn: true })]);
a(102, [etb([zombie()], { cond: { c: "morbid" } })]);
a(103, [
  etb([destroy], {
    targets: [spec("creature", { ctrl: "opp", damaged: true })],
  }),
]);
spree(104, [
  {
    text: "對手犧牲半數生物",
    cost: "{1}",
    effects: [E("halfCreatures")],
    targets: [OPP],
  },
  {
    text: "對手棄半數手牌",
    cost: "{2}",
    effects: [E("halfHand")],
    targets: [OPP],
  },
  {
    text: "對手失去半數生命",
    cost: "{2}",
    effects: [E("halfLife")],
    targets: [OPP],
  },
]);
a(105, [trig("combatDamagePlayer", [E(105)], { cond: C("crime") })]);
s(106, [destroy], [spec("creature", { notOutlaw: true })]);
a(108, [
  etb([E("tinyDiscard")], { frontierDynamic: "players" }),
  trig("allyEtb", [E("tinyMill")], {
    filter: { legendary: true },
    frontierDynamic: "players",
  }),
]);
a(109, [
  trig("combatDamagePlayer", [E(109)], {
    targets: [spec("gyCard", { ctrl: "opp", nonType: "Land" })],
  }),
]);
spree(111, [
  { text: "消滅生物", cost: "{2}{B}", effects: [destroy], targets: [CR] },
  { text: "派傭兵", cost: "{1}", effects: [merc()] },
]);
a(112, [
  etb([
    {
      e: "costThen",
      prompt: "犧牲生物？",
      cost: { sac: { type: "Creature" } },
      then: [
        {
          e: "reflexive",
          targets: [spec("player")],
          effects: [{ e: "draw", n: 2, who: "T0" }, lose(2, "T0")],
        },
      ],
    },
  ]),
]);
a(113, [
  event("crime", [cnt("self")], { oncePerTurn: true }),
  {
    kind: "static",
    self: { cond: C("fourCounters"), grant: { kw: ["menace", "lifelink"] } },
  },
]);
a(114, [
  etb([{ e: "draw", n: 1, who: "T0" }, lose(1, "T0")], {
    targets: [spec("player")],
  }),
]);
a(115, [trig("castAny", [merc()], { cond: { c: "secondSpell" } })]);
a(116, [saddled([E(116)]), saddle(1)]);
spree(117, [
  {
    text: "對法外生物造成2傷害",
    cost: "{1}",
    effects: [dmg(2, { all: { type: "Creature", outlaw: true } })],
  },
  {
    text: "對非非法者生物造成2傷害",
    cost: "{1}",
    effects: [dmg(2, { all: { type: "Creature", notOutlaw: true } })],
  },
]);
a(118, [
  etb([pump("T0", 1, 1, ["haste"])], {
    targets: [{ ...MY_CR, notSelf: true }],
  }),
]);
a(119, [
  act({ mana: "{1}", tap: true }, [dmg(1)], "對手1傷害", { targets: [OPP] }),
]);
d(120, {
  aura: { target: CR, grant: { p: 1, t: 1, kw: ["menace", "trample"] } },
  abilities: [event("selfToGrave", [draw])],
});
spree(122, [
  { text: "生物4傷害", cost: "{2}", effects: [dmg(4)], targets: [CR] },
  {
    text: "消滅神器",
    cost: "{2}",
    effects: [destroy],
    targets: [spec("permanent", { type: "Artifact" })],
  },
]);
a(123, [
  trig("combatStart", [], {
    modes: [
      { text: "+2/+0", targets: [MY_CR], effects: [pump("T0", 2)] },
      {
        text: "威懾敏捷",
        targets: [MY_CR],
        effects: [pump("T0", 0, 0, ["menace", "haste"])],
      },
    ],
  }),
]);
a(124, [saddled([E("gilaImpulse")]), saddle(1)]);
spree(125, [
  {
    text: "重置與額外戰鬥",
    cost: "{2}{R}",
    effects: [{ e: "untap", what: mine }, E("extraCombat")],
  },
  {
    text: "+1/+0先攻",
    cost: "{2}",
    effects: [pump(mine, 1, 0, ["first_strike"])],
  },
  {
    text: "造成戰傷派珍寶",
    cost: "{R}",
    effects: [E("combatTreasure")],
    targets: [OPP],
  },
]);
s(126, [E(126)], [CR]);
d(127, { costReduce: { perCount: { ctrl: "you", outlaw: true } } });
a(128, [
  {
    kind: "static",
    anthem: {
      filter: { ctrl: "you", outlaw: true, other: true },
      grant: { kw: ["haste"] },
    },
  },
  etb([merc(2)]),
]);
s(129, [E(129)]);
a(130, [etb([{ e: "impulse", n: 1 }])]);
a(131, [
  trig("castAny", [dmg(2), { e: "scry", n: 1 }], {
    cond: { c: "secondSpell" },
    targets: [OPP],
  }),
]);
a(132, [event("selfPlotted", [dmg(2)], { targets: [ANY] })]);
a(133, [
  event("crime", [E("tappedTreasure")], { oncePerTurn: true }),
  act({}, [token("tok-otj-scorpion-dragon")], "犧牲三珍寶", {
    sorcery: true,
    sacN: { n: 3, filter: { sub: "Treasure" } },
  }),
]);
a(134, [
  event("anyNoncreatureSpell", [dmg(N("noncreatureSpells"), "evPlayer")]),
]);
a(135, [
  etb([treasure], {
    cond: { c: "controls", filter: { outlaw: true, other: true } },
  }),
]);
s(136, [
  pump(mine, 2),
  {
    e: "if",
    cond: { c: "controls", filter: { outlaw: true } },
    then: [E("gilaImpulse")],
  },
]);
a(137, [etb([merc()])]);
s(138, [pump("T0", 1, 1, ["first_strike"]), E(138, "T1")], [MY_CR, OPP]);
a(139, [saddled([pump("self", 1, 2, ["menace"])]), saddle(2)]);
a(140, [
  act({ mana: "{2}{R}", sacSelf: true }, [draw, treasure], "犧牲抓牌派珍寶"),
]);
a(141, [
  F("coyoteProtection"),
  act({ mana: "{3}" }, [E("hasteBlockers", "self")], "僅敏捷生物可阻擋"),
]);
spree(142, [
  {
    text: "複製咒語或異能",
    frontierStackTargets: ["copy"],
    cost: "{1}",
    effects: [E("copyStack")],
  },
  {
    text: "改變單一目標",
    frontierStackTargets: ["retarget"],
    cost: "{1}",
    effects: [E("retargetStack")],
  },
]);
a(143, [
  trig("castAny", [{ e: "addMana", mana: ["R", "R"] }], {
    when: C("firstSpell"),
  }),
]);
a(144, [
  trig("attacks", [
    {
      e: "if",
      cond: { c: "controls", filter: { type: "Creature", powMin: 4 } },
      then: [token("tok-otj-dinosaur")],
    },
  ]),
]);
s(145, [dmg(5)], [CR]);
a(147, [F("stingerPenalty")]);
s(148, [E("steal")], [CR]);
d(148, { flashCond: C("crime") });
a(149, [
  F("terrorCost"),
  trig("allyEtb", [dmg({ power: "evCard" })], {
    filter: { other: true },
    targets: [ANY],
  }),
]);
s(150, [dmg(N("spellsPlus1"))], [CR]);
s(
  151,
  [dmg(6), dmg(2, "T1")],
  [CR, { ...spec("creature", { token: true }, true), differentFrom: 0 }],
);
a(152, [
  event("selfPlotted", [pump("T0", 3, 2, ["trample"])], { targets: [CR] }),
]);
a(154, [
  etb([draw], {
    cond: { c: "controls", filter: { type: "Creature", powMin: 4 } },
  }),
]);
s(
  155,
  [
    { e: "bite", a: "T0", b: "T1" },
    { e: "bite", a: "T0", b: "T2" },
  ],
  [MY_CR, { ...CR, differentFrom: 0 }, { ...CR, differentFrom: 0 }],
);
a(156, [
  {
    kind: "static",
    self: {
      cond: { c: "controls", filter: { type: "Creature", powMin: 4 } },
      grant: { ignoreDefender: true },
    },
  },
]);
a(157, [
  trig("landfall", [cnt("T0")], { targets: [CR] }),
  act({ mana: "{3}{G}{G}" }, [E("doubleCounters")], "加倍指示物"),
]);
d(158, {
  costReduce: {
    cond: { c: "controls", filter: { sub: "Desert" } },
    mana: "{1}",
  },
});
a(158, [
  trig("targeted", [{ e: "may", prompt: "抓一張牌？", effects: [draw] }]),
]);
d(159, { flashCond: { c: "controls", filter: { sub: "Desert" } } });
a(159, [
  act(
    { mana: "{1}{G}", exileSelf: true },
    [
      {
        e: "tutorMany",
        filter: { type: "Land", sub: "Desert" },
        n: 1,
        to: "battlefield",
        tapped: true,
      },
    ],
    "從墳墓場放逐搜尋沙漠",
    { fromGraveyard: true },
  ),
]);
spree(160, [
  {
    text: "搜尋基本地或沙漠",
    cost: "{1}",
    effects: [
      {
        e: "tutor",
        filter: { type: "Land", or: [{ basic: true }, { sub: "Desert" }] },
        to: "battlefield",
      },
    ],
  },
  { text: "依地數派元素", cost: "{3}", effects: [E("landElemental")] },
]);
a(161, [saddled([pump(mine, 0, 0, ["trample"])]), saddle(1)]);
d(162, { frontier: { freeCounters: 2 } });
a(163, [event("crime", [E(163)], { oncePerTurn: true })]);
s(164, [
  {
    e: "grant",
    what: mine,
    grant: { p: 2, t: 2, kw: ["trample"], onlyOneBlocker: true },
  },
]);
a(165, [
  saddled([cnt("T0")], [spec("creature", { crewedSourceThisTurn: true })]),
  saddle(3),
]);
s(
  166,
  [treasure, pump("T0", N("twiceTreasures"), N("twiceTreasures"))],
  [{ ...CR, optional: true }],
);
d(167, { etbCountersX: true });
a(167, [trig("dies", [E("hydraTreasures")])]);
d(168, { produces: ["W", "U", "B", "R", "G"] });
a(168, [event("crime", [{ e: "untap", what: "self" }], { oncePerTurn: true })]);
d(169, { produces: ["G"] });
a(169, [F("stablemasterMana")]);
s(170, [
  {
    e: "tutorMany",
    filter: { type: "Land", or: [{ basic: true }, { sub: "Desert" }] },
    n: 2,
    to: "battlefield",
    tapped: true,
  },
]);
a(171, [
  trig("combatStart", [cnt("T0")], { targets: [CR] }),
  saddled([E("doubleTargetCounters")], [CR]),
  saddle(2),
]);
a(172, [
  etb([
    {
      e: "tutor",
      filter: { type: "Land", or: [{ basic: true }, { sub: "Desert" }] },
    },
  ]),
  F("greenblade"),
]);
a(173, [
  etb([{ e: "addManaOfChoice", n: 1 }]),
  trig("allyEtb", [draw], { filter: { powMin: 4, other: true } }),
]);
a(174, [etb([E(174)])]);
a(175, [
  trig("allyEtb", [cnt("evCard", { power: "evCard" })], {
    filter: { other: true },
  }),
]);
a(176, [saddled([pump("self", 1, 2), E(176)]), saddle(1)]);
a(177, [
  act(
    { mana: "{1}", tap: true },
    [cnt({ all: { ctrl: "you", type: "Creature", enteredThisTurn: true } })],
    "本回合進場生物放指示物",
  ),
]);
d(178, {
  aura: { target: CR, grant: { p: 3, t: 2, kw: ["reach"] } },
  abilities: [event("selfToGrave", [draw])],
});
s(179, [token("tok-otj-varmint", { gy: { type: "Creature" } })]);
spree(180, [
  { text: "磨四拿至多兩張生物或地", cost: "{2}", effects: [E("surpriseMill")] },
  {
    text: "至多兩張手牌生物進場",
    cost: "{4}{G}",
    effects: [E("surpriseCreatures")],
  },
  {
    text: "大型生物護咒不滅",
    cost: "{1}",
    effects: [
      pump({ all: { ctrl: "you", type: "Creature", powMin: 4 } }, 0, 0, [
        "hexproof",
        "indestructible",
      ]),
    ],
  },
]);
a(182, [
  act(
    { mana: "{1}{G}", discardSelf: true },
    [
      {
        e: "tutor",
        filter: { type: "Land", or: [{ basic: true }, { sub: "Desert" }] },
      },
      gain(3),
    ],
    "棄牌搜尋地",
    { fromHand: true },
  ),
]);
a(184, [
  event("firstSaddled", [
    { e: "mill", n: 2 },
    pump("self", { gy: { type: "Creature" } }, { gy: { type: "Creature" } }),
  ]),
  saddle(2),
]);
s(
  185,
  [
    {
      e: "if",
      cond: { c: "targetIs", t: 0, filter: { sub: "Mount" } },
      then: [cnt("T0")],
      else: [pump("T0", 1, 1)],
    },
    { e: "bite", a: "T0", b: "T1" },
  ],
  [MY_CR, OPP_CR],
);
spree(186, [
  { text: "兩個指示物", cost: "{2}", effects: [cnt("T0", 2)], targets: [CR] },
  {
    text: "踐踏",
    cost: "{1}",
    effects: [pump("T0", 0, 0, ["trample"])],
    targets: [CR],
  },
  {
    text: "戰傷抓兩張",
    cost: "{1}",
    effects: [E("combatDraw2")],
    targets: [CR],
  },
]);
s(187, [E("powerElemental")]);
a(188, [
  act({ mana: "{1}", sacSelf: true }, [destroy], "犧牲消滅神器或結界", {
    targets: [spec("permanent", { type: ["Artifact", "Enchantment"] })],
  }),
]);
a(189, [
  act({}, [E("handCreature")], "犧牲三個其他生物", {
    sorcery: true,
    oncePerTurn: true,
    sacN: { n: 3, filter: { type: "Creature" } },
  }),
]);
a(190, [
  etb([{ e: "reanimate", what: "T0", tapped: true }], {
    cond: { c: "selfWasCast" },
    targets: [
      gy({
        type: [
          "Creature",
          "Artifact",
          "Enchantment",
          "Land",
          "Planeswalker",
          "Kindred",
        ],
        mvMax: 3,
      }),
    ],
  }),
  event("selfTapped", [{ e: "impulse", n: 2 }]),
]);
a(191, [
  etb([dmg(5)], {
    targets: [
      spec("permanent", { ctrl: "opp", type: ["Creature", "Planeswalker"] }),
    ],
  }),
  F("annieDouble"),
]);
d(192, {
  equip: { cost: "{2}", grant: {} },
  abilities: [
    etb([{ e: "exileLinked", what: "T0" }], {
      targets: [{ ...CR, optional: true }],
    }),
    event("selfAttached", [E(192)]),
  ],
});
a(193, [F("outlawFirst"), event("crime", [merc()], { oncePerTurn: true })]);
s(
  194,
  [
    { e: "reanimate", what: "T0" },
    { e: "toHand", what: "T1" },
  ],
  [
    gy({ type: "Creature" }, true),
    gy(
      {
        type: [
          "Creature",
          "Artifact",
          "Enchantment",
          "Land",
          "Planeswalker",
          "Kindred",
        ],
      },
      true,
    ),
  ],
);
a(195, [
  event("ownTokensBatch", [token("tok-otj-vampire")], { oncePerTurn: true }),
  act(
    { mana: "{1}{B}", sacOther: { type: ["Creature", "Artifact"] } },
    [draw],
    "犧牲另一生物或神器",
  ),
]);
a(196, [etb([token("tok-otj-beau")]), trig("youAttack", [draw, E(196)])]);
a(197, [trig("castAny", [E(197)], { cond: { c: "secondSpell" } })]);
a(198, [
  {
    kind: "static",
    anthem: {
      filter: { ctrl: "you", sub: "Ox" },
      grant: { kw: ["double_strike"] },
    },
  },
  etb([E(198)]),
  trig("attacks", [E(198)]),
]);
a(199, [
  trig("combatStart", [
    pump(
      { all: { ctrl: "you", type: "Creature", other: true, powMin: 4 } },
      0,
      0,
      ["trample", "haste"],
    ),
  ]),
]);
a(200, [
  saddled([
    pump(
      "self",
      { count: { ctrl: "you", sub: "Mount" } },
      { count: { ctrl: "you", sub: "Mount" } },
    ),
  ]),
  saddle(3),
]);
a(201, [F("aurlockDiscount")]);
a(202, [event("auraAttached", [E(202)])]);
a(203, [etb([merc()]), event("activatedTargets", [E("copyActivated")])]);
s(204, [merc({ x: true })]);
a(205, [F("ghiredAbilities")]);
a(206, [trig("combatDamagePlayer", [E(206)]), saddle(1)]);
a(207, [
  etb([{ e: "toHand", what: "T0" }], { targets: [gy({ type: "Creature" })] }),
  { kind: "static", spellCostLess: { filter: { type: "Creature" }, n: 1 } },
]);
a(208, [
  etb([lose(1), gain(1), draw]),
  event("crime", [
    { e: "may", prompt: "回手？", effects: [{ e: "bounce", what: "self" }] },
  ]),
]);
a(209, [trig("endStep", [draw], { cond: C("noHandSpell") })]);
a(210, [
  event("power4Attack", [treasure]),
  act(
    { mana: "{1}{R}", sacOther: { sub: "Treasure" } },
    [dmg(1)],
    "犧牲珍寶：1傷害",
    { targets: [ANY] },
  ),
]);
a(211, [
  event("oppTokensBatch", [E(211)], { oncePerTurn: true }),
  event("ownTokensBatch", [lose(1), gain(1)]),
]);
a(212, [
  etb([E(212)]),
  trig("allyEtb", [cnt(mine)], { filter: { legendary: true } }),
]);
a(213, [event("castNotHand", [E(213)])]);
a(214, [trig("castAny", [cnt("self"), draw], { cond: { c: "secondSpell" } })]);
a(215, [F("jasperMercenaries"), trig("upkeep", [E(215)], { targets: [OPP] })]);
a(216, [event("crime", [cnt("self"), E(216)], { oncePerTurn: true })]);
a(217, [F("lilahPlot")]);
s(218, [E(218)]);
a(219, [trig("castAny", [token("tok-clue")], { cond: { c: "secondSpell" } })]);
a(220, [
  event("crime", [
    {
      e: "costThen",
      prompt: "支付{1}看兩張拿一張？",
      cost: { mana: "{1}" },
      then: [{ e: "dig", n: 2, take: 1, rest: "graveyard" }],
    },
  ]),
]);
a(221, [F("mountHexproof"), event("mountAttack", [cnt("evCard")])]);
a(222, [trig("combatDamagePlayer", [E(222)])]);
a(223, [
  trig("combatStart", [E("okoCopy")], {
    targets: [{ ...MY_CR, optional: true }],
  }),
  act(
    { loyalty: 1 },
    [
      { e: "draw", n: 2 },
      {
        e: "if",
        cond: C("crime"),
        then: [{ e: "discard", who: "you", n: 1 }],
        else: [{ e: "discard", who: "you", n: 2 }],
      },
    ],
    "+1",
  ),
  act({ loyalty: -1 }, [token("tok-otj-elk")], "-1"),
  act({ loyalty: -5 }, [E(223)], "-5"),
]);
s(224, [
  { e: "dig", n: N("twiceLands"), take: 1, rest: "bottom", randomBottom: true },
]);
a(225, [
  etb([{ e: "reanimate", what: "T0", counters: 2 }], {
    targets: [gy({ type: "Creature" })],
  }),
  trig("allyDies", [dmg({ ev: true })], {
    filter: { legendary: true },
    targets: [OPP],
  }),
]);
a(226, [
  trig("sacrifice", [E(226)], {
    filter: { type: "Creature", other: true },
    targets: [spec("player")],
  }),
  act(
    { sacOther: { type: "Creature" } },
    [pump("self", 0, 0, ["indestructible"]), { e: "tap", what: "self" }],
    "犧牲生物：不滅",
    { oncePerTurn: true },
  ),
]);
a(227, [event("modalSpell", [E(227)])]);
a(228, [
  etb([E("meteorite")]),
  trig("attacks", [E("meteorite")]),
  F("artifactTokenManaBonus"),
]);
a(229, [
  etb([
    {
      e: "costThen",
      prompt: "犧牲另一生物？",
      cost: { sac: { type: "Creature", other: true } },
      then: [
        {
          e: "reflexive",
          targets: [spec("permanent", { nonType: "Land" })],
          effects: [destroy],
        },
      ],
    },
  ]),
]);
a(230, [event("freeCreatureEntry", [draw])]);
a(231, [
  trig("castAny", [merc()], { filter: { type: "Creature" } }),
  act(
    { tap: true },
    [{ e: "addManaOfChoice", n: { distinctPowers: true } }],
    "依不同力量產生法力",
  ),
]);
a(232, [saddled([token("tok-otj-angel")]), saddle(4)]);
s(
  233,
  [dmg(2), { e: "if", cond: { c: "spellsCast", n: 2 }, then: [draw] }],
  [ANY],
);
a(234, [
  event("exactNoncombat", [draw]),
  act({ tap: true }, [E(234)], "本回合非戰鬥傷害+X", { xMana: 1 }),
]);
a(235, [
  trig("allyEtb", [dmg(1)], {
    filter: { outlaw: true, other: true },
    targets: [OPP],
  }),
]);
a(236, [etb([E("deathtouchCounters")]), event("legendCombat", [draw])]);
a(237, [
  trig("otherDies", [E(237)], { filter: { ctrl: "opp", token: false } }),
]);
a(238, [
  trig("endStep", [token("tok-otj-spirit")], { cond: C("noHandSpell") }),
]);
a(239, [event("selfTapped", [gain(1), draw])]);
d(240, { produces: ["W", "U", "B", "R", "G"] });
a(240, [
  event("crime", [E("lootCounter")], { oncePerTurn: true }),
  act({ mana: "{2}", tap: true }, [draw], "移除兩個戰利品指示物", {
    frontierRemoveLoot: 2,
  }),
]);
a(241, [
  act(
    { mana: "{6}", tap: true, sacSelf: true },
    [destroy, { e: "destroy", what: "T1" }, { e: "destroy", what: "T2" }],
    "消滅至多神器、生物與地",
    {
      targets: [
        spec("permanent", { type: "Artifact" }, true),
        { ...CR, optional: true },
        spec("permanent", { type: "Land" }, true),
      ],
    },
  ),
]);
d(242, {
  equip: { cost: "{1}", grant: { p: 1, t: 1 } },
  abilities: [etb([treasure])],
});
d(243, {
  equip: { cost: "{1}", grant: { p: 1, kw: ["haste"] }, abilities: [] },
  abilities: [F("equipWard1")],
});
const vehicle = (n: number, crew: number, abilities: Ability[], once = false) =>
  d(n, {
    abilities: [
      act(
        { crew },
        [
          {
            e: "animate",
            what: "self",
            p: catalog.find((c) => c.number === n)!.power!,
            t: catalog.find((c) => c.number === n)!.toughness!,
          },
        ],
        "駕駛" + crew,
        { oncePerTurn: once },
      ),
      ...abilities,
    ],
  });
vehicle(
  244,
  1,
  [trig("attacks", [token("tok-treasure", N("crewCount"))])],
  true,
);
vehicle(245, 2, [
  {
    kind: "static",
    self: {
      cond: { c: "controls", filter: { sub: "Mount" } },
      grant: { kw: ["haste"] },
    },
  },
  trig("attacks", [E(245)]),
]);
d(246, { produces: ["W", "U", "B", "R", "G"] });
a(246, [etb([gain(2)])]);
a(247, [
  act(
    { mana: "{2}", tap: true, sacOther: { type: "Land" } },
    [draw, treasure],
    "犧牲地抓牌派珍寶",
  ),
]);
a(248, [
  etb([E(248)]),
  act({ tap: true }, [pump("T0", 1)], "生物+1/+0", {
    sorcery: true,
    targets: [MY_CR],
  }),
]);
a(250, [
  act(
    { mana: "{2}" },
    [{ e: "toLibraryBottom", what: "T0" }],
    "將墳墓場牌置底",
    { targets: [gy()] },
  ),
]);
for (const n of [251, 253, 255, 256, 257, 258, 259, 260, 261, 264])
  a(n, [etb([dmg(1)], { targets: [OPP] })]);
d(252, { produces: ["C"], etbTapped: true });
a(252, [etb([E(252)])]);
d(254, { produces: ["C"], filterMana: true });
a(254, [etb([{ e: "surveil", n: 1 }])]);
d(262, {
  etbTapped: true,
  ecl: { asEnters: "color" },
  chosenColorMana: true,
  produces: ["W", "U", "B", "R", "G"],
});
d(263, { produces: ["C"] });
a(263, [
  act(
    { mana: "{3}", tap: true },
    [{ e: "grant", what: "T0", grant: { cantBlock: true } }],
    "不能阻擋",
    { sorcery: true, targets: [CR] },
  ),
]);
d(265, { produces: ["C"] });
a(265, [
  F("mountMana"),
  act({ mana: "{3}", tap: true }, [E(265)], "看牌庫頂坐騎"),
]);
for (const n of [266, 267, 268, 269, 270])
  d(n, { etbTappedUnless: { c: "landsLte", n: 2 } });
d(271, { castCond: { c: "not", cond: { c: "myTurnLte", n: 3 } } });
a(271, [
  act({ loyalty: 1 }, [draw, { e: "discard", who: "you", n: 1 }], "+1"),
  act({ loyalty: 1 }, [E(212)], "+1"),
  act({ loyalty: -6 }, [E(271)], "-6"),
]);
export const completeOtj = complete;
s(
  47,
  [
    { e: "bounce", what: "T0" },
    {
      e: "if",
      cond: { c: "controls", filter: { sub: "Desert" } },
      then: [{ e: "surveil", n: 1 }],
    },
  ],
  [spec("permanent", { nonType: "Land" })],
);
s(84, [{ e: "draw", n: 2 }]);
d(84, { addCost: { sac: { type: "Creature" } } });
s(107, [pump("T0", 1, 1), pump("T1", -1, -1)], [MY_CR, OPP_CR]);
a(121, [
  etb([
    { e: "costThen", prompt: "棄一抓一？", cost: { discard: 1 }, then: [draw] },
  ]),
]);
