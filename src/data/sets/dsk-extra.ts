import catalog from "./dsk-catalog.json";
import auto from "./dsk-auto.json";
import { act, etb, trig, CR, MY_CR, OPP_CR, ANY, OPP } from "../dsl";
import { foundationBuilder } from "./foundation-dsl";
import {
  spec,
  gy,
  mine,
  opp,
  draw,
  token,
  pump,
  cnt,
  dmg,
  destroy,
  exile,
  gain,
  lose,
  subsets,
} from "./frontier-dsl";
import type {
  Ability,
  Effect,
  Filter,
  TargetSpec,
  TriggeredAbility,
} from "../../engine/types";
const { d, a, s, modes, E, C, N, F, event, room, complete } = foundationBuilder(
  "DSK",
  catalog,
  auto,
);
const eerie = (effects: Effect[], x: Partial<TriggeredAbility> = {}) =>
  event("eerie", effects, x);
const survival = (effects: Effect[], x: Partial<TriggeredAbility> = {}) =>
  trig("main2", effects, { cond: { c: "selfTapped" }, ...x });
const door = (i: 0 | 1, effects: Effect[], targets?: TargetSpec[]) =>
  event("door", effects, { foundationDoor: i, targets });
const glimmer = (n: any = 1) => token("tok-glimmer", n);
const enduring = (n: number, abs: Ability[]) =>
  a(n, [...abs, trig("dies", [E("enduring")])]);
const lord = (n: number, effects: Effect[]) =>
  a(n, [etb(effects), trig("attacks", effects)]);
const delirium = { c: "delirium" } as const;
const aff = (grant: import("../../engine/types").Grant): Ability => ({
  kind: "static",
  self: { cond: delirium, grant },
});
a(1, [survival([E("flyingCounter")], { oncePerGame: true })]);
a(2, [eerie([pump("self", 0, 0, ["lifelink"])])]);
room(3, [F("creatureConvoke")], [F("otherUntap")]);
room(4, [event("nonToyAttack", [token("tok-dsk-toy")])], [F("porcelainBase")]);
enduring(6, [event("smallEtbBatch", [draw], { oncePerTurn: true })]);
d(7, {
  aura: { target: CR, grant: { kw: ["first_strike"] } },
  abilities: [F("etherealArmor")],
});
s(
  8,
  [exile],
  [
    spec("permanent", {
      or: [
        { type: ["Artifact", "Enchantment"] },
        { type: "Creature", powMin: 4 },
      ],
    }),
  ],
);
d(9, { foundation: { exileCreatureCost: true } });
a(9, [
  etb([E("abduction")], { targets: [OPP_CR] }),
  trig("leaves", [E("abductionReturn")]),
]);
a(10, [
  etb(
    [
      { e: "tap", what: "T0" },
      {
        e: "if",
        cond: { c: "targetIs", t: 0, filter: { ctrl: "opp" } },
        then: [{ e: "stun", what: "T0" }],
      },
    ],
    { targets: [{ ...CR, optional: true }] },
  ),
]);
a(12, [etb([pump("T0", 2, 4)], { targets: [CR] })]);
a(13, [etb([E(13)]), eerie([token("tok-dsk-spirit")])]);
a(14, [
  survival([
    {
      e: "if",
      cond: { c: "controls", filter: { type: "Creature", sub: "Glimmer" } },
      then: [draw],
      else: [glimmer()],
    },
  ]),
]);
room(
  15,
  [door(0, [glimmer()])],
  [
    door(
      1,
      [cnt("T0"), cnt("T1")],
      [
        { ...CR, optional: true },
        { ...CR, optional: true },
      ],
    ),
  ],
);
s(17, [pump("T0", 2, 2, ["flying"]), E("horrorEnchantment")], [CR]);
a(18, [{ kind: "static", lifegainPlus: 1 }, F("hopeAnthem")]);
d(18, { foundation: { leyline: true } });
a(20, [
  trig("dies", [
    {
      e: "dig",
      n: 5,
      take: 1,
      optional: true,
      filter: { type: "Creature", powMax: 2 },
      rest: "bottom",
      randomBottom: true,
    },
  ]),
]);
a(21, [eerie([cnt("T0")], { targets: [CR] })]);
a(22, [trig("attacks", [E(22)])]);
lord(23, [token("tok-g-insect-21-w-flying", 2)]);
d(24, { foundation: { plaything: true } });
a(25, [
  act(
    { mana: "{3}", discard: 1 },
    [cnt("self", 3), E("goatDemon")],
    "成為惡魔",
    { oncePerGame: true },
  ),
]);
a(26, [
  survival([E("chooseCounter")]),
  trig("allyDies", [E(26)], { targets: [{ ...CR, optional: true }] }),
]);
a(27, [
  survival([{ e: "toHand", what: "T0" }], {
    targets: [gy({ type: "Creature", mvMax: 3 })],
  }),
]);
s(28, [destroy], [CR]);
d(28, { frontier: { tappedTargetDiscount: 3 } });
d(29, {
  aura: { target: MY_CR, grant: { p: 1, t: 1 } },
  abilities: [F("rescueHexproof")],
});
d(30, {
  aura: { target: MY_CR, grant: { p: 1, kw: ["lifelink"] } },
  abilities: [
    etb([{ e: "exileLinked", what: "T0" }], {
      targets: [spec("permanent", { ctrl: "opp", nonType: "Land" })],
    }),
    F("auraWard2"),
  ],
});
modes(32, [
  {
    text: "消滅已橫置生物",
    effects: [
      { e: "destroy", what: { all: { type: "Creature", tapped: true } } },
    ],
  },
  {
    text: "消滅未橫置生物",
    effects: [
      { e: "destroy", what: { all: { type: "Creature", tapped: false } } },
    ],
  },
]);
a(33, [
  etb([
    draw,
    {
      e: "if",
      cond: {
        c: "controls",
        filter: { type: "Creature", ctrl: "you", other: true, powMax: 2 },
      },
      then: [],
      else: [{ e: "discard", who: "you", n: 1 }],
    },
  ]),
]);
room(
  34,
  [
    door(
      0,
      [{ e: "reanimate", what: "T0" }],
      [gy({ type: "Creature", mvMax: 3 })],
    ),
  ],
  [
    trig("youAttack", [cnt("T0")], {
      targets: [spec("creature", { attacking: true })],
    }),
  ],
);
a(35, [etb([token("tok-dsk-beast")]), F("tobyFlying")]);
a(36, [
  etb([{ e: "exileLinked", what: "T0" }], {
    targets: [
      spec("permanent", {
        ctrl: "opp",
        type: ["Artifact", "Creature", "Enchantment"],
      }),
    ],
  }),
]);
a(37, [
  etb([E("hovershipExile")], {
    targets: [spec("creature", { toughMax: 5 }, true)],
  }),
  trig("leaves", [E("hovershipManifest")]),
  act({ crew: 1 }, [], "搭載1"),
]);
s(39, [E(39)], [CR]);
a(40, [
  survival([E("survivorExile")], { targets: [spec("gyCard", {}, true)] }),
  F("veteranBoost"),
]);
a(41, [F("tappedOtherHexproof")]);
d(42, { foundation: { exileGraveCost: 6 } });
a(42, [trig("oppUpkeep", [{ e: "manifestDread" }])]);
room(
  43,
  [door(0, [{ e: "bounce", what: "T0" }], [{ ...CR, optional: true }])],
  [trig("oppCombatDamaged", [draw])],
);
room(
  44,
  [door(0, [E("tutorRoom")])],
  [trig("upkeep", [{ e: "surveil", n: 1 }, E("eightDoorsWin")])],
);
a(45, [
  trig("attacks", [pump("T0", 0, 0, ["unblockable"])], {
    targets: [{ ...spec("creature", { attacking: true }), notSelf: true }],
  }),
]);
d(46, { produces: ["U"], manaOnly: "enchantOrSpecial" });
d(47, {
  equip: { cost: "{3}", grant: { kw: ["flying"] } },
  abilities: [etb([E(47)])],
});
s(49, [E("counterSurveil")], [spec("spell")]);
d(50, {
  aura: { target: CR, grant: { p: -3, loseAbilities: true } },
  abilities: [F("controlAura")],
});
enduring(51, [trig("allyCombatDamagePlayer", [draw])]);
a(53, [eerie([draw])]);
a(54, [eerie([pump("self", 1, 1)])]);
a(55, [trig("combatDamagePlayer", [{ e: "draw", n: { ev: true } }])]);
a(56, [
  trig(
    "attacks",
    [
      {
        e: "grant",
        what: "T0",
        grant: { p: -2, removeKw: ["flying"] },
        untilNext: true,
      },
    ],
    { targets: [OPP_CR] },
  ),
]);
a(57, [etb([E("counterManifest")], { targets: [spec("spell")] })]);
d(58, { foundation: { returnPermanentCost: true } });
a(59, [
  etb([{ e: "stun", what: "T0" }], { targets: [OPP_CR] }),
  act({ mana: "{1}{U}", tap: true }, [E(59)], "將自己與暈眩生物洗回", {
    targets: [spec("creature", { stunned: true })],
  }),
]);
modes(60, [
  {
    text: "反擊",
    effects: [{ e: "counter", what: "T0" }],
    targets: [spec("spell", { type: ["Creature", "Enchantment"] })],
  },
  {
    text: "回手",
    effects: [
      { e: "bounce", what: "T0" },
      { e: "bounce", what: "T1" },
    ],
    targets: [
      spec("permanent", {
        owner: "you",
        type: ["Creature", "Enchantment"],
      } as Filter),
      spec(
        "permanent",
        { owner: "you", type: ["Creature", "Enchantment"] } as Filter,
        true,
      ),
    ],
  },
]);
a(61, [
  trig("combatDamagePlayer", [E("unlockTarget")], {
    targets: [spec("permanent", { ctrl: "you", sub: "Room" }, true)],
  }),
]);
s(62, [{ e: "draw", n: 2 }, glimmer()]);
d(63, { ecl: { asEnters: "tribe" }, foundation: { leyline: true } });
a(63, [F("allTribe")]);
a(64, [
  etb([{ e: "draw", n: 5 }], { cond: { c: "selfWasCast" } }),
  F("grimoire"),
  trig("lifegain", [{ e: "draw", n: { ev: true } }]),
  event("selfLifeLost", [E(64)]),
]);
room(
  65,
  [door(0, [{ e: "stun", what: "T0", n: 2 }], [{ ...CR, optional: true }])],
  [
    door(1, [
      { e: "draw", n: 3 },
      { e: "discard", who: "you", n: 1 },
    ]),
  ],
);
a(66, [F("mindskinner")]);
room(67, [door(0, [E("reflectionCopy")], [MY_CR])], [F("doubleTriggers")]);
lord(68, [
  { e: "draw", n: 2 },
  { e: "discard", who: "you", n: 1 },
]);
a(69, [event("manifestDread", [E("manifestGraveReturn")])]);
a(71, [eerie([{ e: "mill", n: 2, who: "T0" }], { targets: [spec("player")] })]);
a(72, [
  trig("combatDamagePlayer", [E(72)], {
    foundationModes: "hallcreeper",
  }),
]);
a(73, [eerie([{ e: "grant", what: "self", grant: { ignoreDefender: true } }])]);
d(74, {
  aura: { target: CR, grant: { noUntap: true } },
  abilities: [
    etb([{ e: "tap", what: "attached" }]),
    act({ mana: "{4}{U}{U}" }, [E(74)], "洗回並顯化", { sorcery: true }),
  ],
});
d(75, {
  saga: {
    chapters: [
      { effects: [E("tamiyoMill")] },
      { effects: [E("tamiyoMill")] },
      { effects: [E("tamiyoMill")] },
      { effects: [E("tamiyoCopies")] },
    ],
  },
});
a(76, [etb([glimmer()])]);
d(78, {
  aura: { target: CR, grant: { loseAbilities: true } },
  abilities: [F("unableAura")],
});
room(
  79,
  [door(0, [{ e: "surveil", n: 2 }])],
  [door(1, [E("manifestCounter")])],
);
a(81, [
  eerie([{ e: "chargeCounter", what: "self", n: 1 }]),
  trig("dies", [E(81)]),
]);
s(
  82,
  [
    { e: "topOrBottom", what: "T0" },
    { e: "surveil", n: 1 },
  ],
  [spec("permanent", { nonType: "Land" })],
);
a(84, [eerie([lose(1)])]);
d(85, { foundation: { morbidCounter: true } });
s(86, [E(86)], [CR]);
d(88, {
  aura: { target: CR, grant: {} },
  abilities: [
    etb(
      [
        {
          e: "discardChosen",
          who: "T0",
          filter: { nonType: "Land" },
          optional: true,
        },
      ],
      { targets: [spec("player")] },
    ),
    F("destroyDamagedHost"),
  ],
});
a(89, [
  F("cantBlockedGlimmers"),
  survival([{ e: "tutor", filter: {}, to: "graveyard" }]),
]);
a(90, [eerie([pump("self", 2, 0, ["lifelink"])])]);
room(
  91,
  [event("ownGraveLeaves", [token("tok-dsk-horror")], { oncePerTurn: true })],
  [door(1, [{ e: "toHand", what: "T0" }], [gy({ type: "Creature" })])],
);
s(92, [
  {
    e: "if",
    cond: delirium,
    then: [{ e: "tutor", filter: {} }],
    else: [{ e: "tutor", filter: { sub: "Demon" } }],
  },
]);
room(
  93,
  [door(0, [{ e: "draw", n: 2 }, lose(2, "you")])],
  [trig("youAttack", [E("aloneDeathtouch")], { alone: true })],
);
a(94, [etb([E(94)], { cond: { c: "selfWasCast" } }), trig("upkeep", [draw])]);
enduring(95, [
  trig("lifegain", [lose({ ev: true }, "T0")], { targets: [OPP] }),
]);
a(96, [etb([E(96)])]);
a(97, [trig("dies", [dmg(1), gain(1)], { targets: [ANY] })]);
a(98, [
  trig("attacks", [pump("self", 0, 0, ["menace", "deathtouch"])], {
    cond: C("opponentNoGlimmer"),
  }),
]);
d(99, { addCost: { sac: { type: ["Creature", "Enchantment"] } } });
s(99, [exile], [CR]);
room(
  100,
  [trig("allyDies", [lose(1), gain(1)])],
  [door(1, [E("ownGraveCreatures")])],
);
d(102, {
  aura: { target: spec("player"), grant: {} },
  abilities: [
    F("woundNoLife"),
    event("enchantedPlayerDamage", [E("halfLife")]),
  ],
});
d(104, {
  equip: { cost: "{2}", grant: { kw: ["menace"] } },
  abilities: [etb([E(47)])],
});
modes(
  105,
  subsets([
    { text: "生物-1/-1", effects: [pump(opp, -1, -1)] },
    { text: "棄二", effects: [{ e: "discard", who: "opp", n: 2 }] },
    { text: "吸三", effects: [lose(3), gain(3)] },
  ]).map((m) => ({
    ...m,
    foundationRequireDelirium: (m.frontierChoices ?? 0) > 1,
  })),
);
d(106, { foundation: { leyline: true } });
a(106, [F("opponentGraveExile")]);
a(108, [
  etb([E("meathookSac")]),
  trig("allyDies", [E("meathookOwn")]),
  trig("oppDies", [E("meathookOpponent")]),
]);
a(109, [etb([E(109)])]);
a(111, [
  etb([pump("T0", -3, -3)], { targets: [OPP_CR] }),
  F("ignoreHexproofWard"),
]);
a(112, [trig("endStep", [E(112)], { cond: delirium })]);
lord(113, [{ e: "mill", n: 4 }, E(113)]);
a(114, [
  act(
    { mana: "{1}{B}", sacOther: { type: ["Creature", "Enchantment"] } },
    [pump("self", 0, 0, ["indestructible"]), { e: "tap", what: "self" }],
    "犧牲並不滅",
  ),
  trig("sacrifice", [lose(1, "T0"), gain(1)], { targets: [OPP] }),
]);
a(115, [
  act(
    { mana: "{2}{B}{B}" },
    [{ e: "reanimate", what: "selfAny", finality: true }],
    "譫妄返場",
    { fromGraveyard: true, keepSelf: true, sorcery: true, cond: delirium },
  ),
]);
d(116, {
  wardDiscard: true,
  cycling: { cost: "{2}", search: { type: "Land", sub: "Swamp" } },
});
d(117, {
  aura: { target: CR, grant: {} },
  abilities: [
    etb([E(117)], { targets: [spec("player")] }),
    F("destroyDamagedHost"),
  ],
});
room(
  118,
  [
    trig("endStep", [
      draw,
      {
        e: "if",
        cond: {
          c: "controls",
          filter: { ctrl: "you", sub: "Demon", type: "Creature" },
        },
        then: [lose(2), gain(2)],
        else: [lose(2, "you")],
      },
    ]),
  ],
  [door(1, [token("tok-dsk-demon")])],
);
a(119, [trig("combatDamagePlayer", [E("halfLife")]), trig("dies", [E(119)])]);
a(120, [F("valgavothExile"), F("valgavothPlay"), F("wardThreePermanents")]);
d(122, { addCost: { sac: { type: ["Creature", "Enchantment"] } } });
a(122, [
  etb([
    {
      e: "sacPlayer",
      who: "opp",
      filter: { type: "Enchantment", token: false },
      n: 1,
    },
    {
      e: "sacPlayer",
      who: "opp",
      filter: { type: "Creature", token: false },
      n: 1,
    },
  ]),
]);
modes(126, [
  {
    text: "犧牲",
    sac: { type: ["Creature", "Enchantment"] },
    effects: [E("exileDeath"), dmg(5)],
    targets: [CR],
  },
  {
    text: "加付{2}",
    cost: "{3}{R}",
    effects: [E("exileDeath"), dmg(5)],
    targets: [CR],
  },
]);
a(127, [
  etb([
    {
      e: "costThen",
      prompt: "犧牲另一生物或結界？",
      cost: { sac: { type: ["Creature", "Enchantment"], other: true } },
      then: [{ e: "reflexive", targets: [ANY], effects: [dmg(2)] }],
    },
  ]),
]);
d(128, {
  equip: { cost: "{3}", grant: {} },
  abilities: [
    etb([dmg(3)], { targets: [{ ...CR, optional: true }] }),
    event("creaturesDieBatch", [{ e: "chargeCounter", what: "self", n: 1 }]),
    F("chainsaw"),
  ],
});
room(129, [trig("upkeep", [E("impulse1")])], [F("warpedFree")]);
a(130, [trig("dies", [E("impulseNext")])]);
a(131, [
  trig("castInstSorc", [E(131)]),
  act(
    { tap: true },
    [
      {
        e: "delayed",
        on: "castInstSorc",
        once: true,
        effects: [{ e: "copySpell" }],
      },
    ],
    "複製下一咒語",
  ),
]);
a(132, [
  act(
    { mana: "{1}", sacOther: { type: ["Creature", "Enchantment"] } },
    [E("impulse1")],
    "犧牲放逐使用",
  ),
]);
enduring(133, [
  trig("allyEtb", [pump("evCard", 2, 0, ["haste"])], {
    filter: { other: true },
  }),
]);
a(134, [F("mustBlocked")]);
a(135, [
  etb([dmg(4, "opp")]),
  event("ownNoncombatOpp", [dmg({ ev: true })], {
    cond: delirium,
    targets: [OPP_CR],
  }),
]);
a(136, [
  etb([{ e: "discard", who: "you", n: 1 }, draw]),
  trig("attacks", [{ e: "untap", what: "T0" }, E("extraCombat")], {
    cond: delirium,
    oncePerTurn: true,
    targets: [CR],
  }),
]);
room(137, [door(0, [dmg(4)], [OPP_CR])], [trig("endStep", [dmg(1, "opp")])]);
d(138, { addCost: { discard: 1 } });
s(138, [
  { e: "draw", n: 2 },
  { e: "if", cond: C("discardedNonland"), then: [dmg(2, "opp")] },
]);
a(139, [trig("attacks", [pump("self", 2, 0, ["menace"])], { cond: delirium })]);
s(140, [dmg(6), { e: "if", cond: delirium, then: [E("impulseNext")] }], [CR]);
a(141, [
  eerie([pump("self", 2)]),
  trig("dies", [dmg(N("lastPower"))], { targets: [ANY] }),
]);
a(142, [
  trig(
    "allyEtb",
    [
      {
        e: "costThen",
        prompt: "棄牌抓牌？",
        cost: { discard: 1 },
        then: [draw],
      },
    ],
    {
      filter: { powMax: 2, other: true },
      oncePerTurn: true,
      onceOnResolve: true,
    },
  ),
]);
d(143, { foundation: { leyline: true } });
a(143, [event("ownSingleTargetCreature", [{ e: "copySpell" }])]);
a(145, [F("cantBlock"), event("ownBlocked", [E(145)])]);
a(146, [
  etb([dmg(4)], { targets: [ANY] }),
  trig("attacks", [dmg(4)], { targets: [ANY] }),
]);
room(
  147,
  [door(0, [E("impulseTwoNext")])],
  [
    trig("youAttack", [
      pump({ all: { ctrl: "you", type: "Creature", attacking: true } }, 1),
    ]),
  ],
);
a(151, [F("twoDoorsPower")]);
a(153, [
  {
    kind: "static",
    self: { cond: { c: "yourTurn" }, grant: { kw: ["first_strike"] } },
  },
  event("opponentDraw", [dmg(1, "opp")]),
]);
a(155, [
  F("deliriumDoubleDamage"),
  etb([E(155)], { frontierDynamic: "creaturesX" }),
]);
s(156, [E("exileDeath"), dmg(3)], [spec("creatureOrPlaneswalker")]);
a(157, [
  trig("dealtDamage", [E(157)], { targets: [{ ...ANY, notSelf: true }] }),
]);
room(
  158,
  [door(0, [{ e: "manifestDread" }])],
  [
    trig("youAttack", [pump("T0", 0, 0, ["double_strike"])], {
      targets: [spec("creature", { attacking: true })],
    }),
  ],
);
s(159, [E(159)], [OPP_CR, OPP_CR]);
s(160, [pump("T0", 3), E("dieManifest")], [CR]);
modes(161, [
  {
    text: "消滅神器",
    effects: [destroy],
    targets: [spec("permanent", { type: "Artifact" })],
  },
  {
    text: "改目標",
    effects: [E("retargetStack")],
    frontierStackTargets: ["retarget"],
  },
  {
    text: "不能阻擋",
    effects: [
      { e: "grant", what: "T0", grant: { cantBlock: true } },
      { e: "grant", what: "T1", grant: { cantBlock: true } },
    ],
    targets: [CR, { ...CR, optional: true }],
  },
]);
s(
  162,
  [
    E("steal"),
    { e: "costThen", prompt: "棄牌抽牌？", cost: { discard: 1 }, then: [draw] },
  ],
  [CR],
);
a(163, [
  trig("allyEtb", [pump("self", 2)], { filter: { powMax: 2, other: true } }),
]);
s(
  164,
  [
    pump("T0", 1, 0, ["first_strike"]),
    { e: "if", cond: delirium, then: [pump("T0", 0, 0, ["double_strike"])] },
  ],
  [CR],
);
s(165, [E(165)], [MY_CR]);
a(166, [
  trig("targetedByOpp", [draw]),
  act(
    { mana: "{1}{G}", discardSelf: true },
    [{ e: "reanimate", what: "T0", tapped: true }],
    "棄牌返地",
    { fromHand: true, targets: [gy({ type: "Land" })] },
  ),
]);
a(167, [etb([E(167)])]);
a(168, [
  act(
    { mana: "{2}{G}{G}" },
    [{ e: "reanimate", what: "selfAny", finality: true }],
    "譫妄返場",
    { fromGraveyard: true, keepSelf: true, sorcery: true, cond: delirium },
  ),
]);
s(
  171,
  [E(171)],
  [
    spec("permanent", { ctrl: "opp", type: ["Artifact", "Enchantment"] }),
    ...Array.from({ length: 4 }, () => gy({}, true)),
  ],
);
a(172, [survival([gain(2)])]);
s(
  173,
  [E(173)],
  [
    spec("creature", { ctrl: "you", tapped: false }),
    spec("creature", { ctrl: "you", tapped: false }, true),
    OPP_CR,
  ],
);
a(174, [
  event("ownFaceDownEtb", [cnt("self")]),
  trig("turnedFaceUp", [cnt("self")]),
  event("otherFaceUp", [cnt("self")]),
]);
a(175, [survival([{ e: "manifestDread" }])]);
enduring(176, [
  {
    kind: "static",
    manaGrant: {
      filter: { type: "Creature", ctrl: "you" },
      colors: ["W", "U", "B", "R", "G"],
    },
  },
]);
d(177, { foundation: { tapCastCost: 2 } });
a(178, [
  trig("attacks", [pump("T0", 0, 0, ["deathtouch"])], {
    targets: [{ ...MY_CR, notSelf: true }],
  }),
]);
room(
  181,
  [
    {
      kind: "static",
      manaGrant: {
        filter: { type: "Land", ctrl: "you" },
        colors: ["W", "U", "B", "R", "G"],
      },
    },
  ],
  [door(1, [E(181)])],
);
a(182, [
  trig("attacks", [{ e: "manifestDread" }]),
  act({ mana: "{1}{G}" }, [E("revealFaceUp")], "翻正面", {
    targets: [spec("permanent", { ctrl: "you", faceDown: true })],
  }),
]);
a(183, [
  trig("attacks", [
    { e: "may", prompt: "磨兩張？", effects: [{ e: "mill", n: 2 }] },
  ]),
  event("landMilled", [E("milledLandReturn")]),
  act({ crew: 1 }, [], "搭載1"),
]);
a(185, [survival([E("revealLand")])]);
a(186, [
  ...[
    {
      text: "神器",
      effects: [destroy],
      targets: [spec("permanent", { type: "Artifact" })],
    },
    {
      text: "結界",
      effects: [destroy],
      targets: [spec("permanent", { type: "Enchantment" })],
    },
    { text: "抓牌放地", effects: [draw, E("landHandTapped")] },
  ].map((m) =>
    act({ mana: "{2}", sacSelf: true }, m.effects, m.text, {
      targets: m.targets,
    }),
  ),
]);
a(187, [survival([E("handPermanent")])]);
d(188, { foundation: { leyline: true } });
a(188, [F("mutationCost")]);
room(
  190,
  [door(0, [{ e: "searchLand", to: "battlefield", tapped: true }])],
  [door(1, [E("manifestThree")])],
);
d(191, { foundation: { revealCreaturePower: true } });
s(191, [dmg(N("chosenCreaturePower"))], [CR]);
a(192, [
  etb([E(192)], {
    cond: delirium,
    foundationDistribution: 2,
    foundationVariableTargets: 2,
  }),
  trig("attacks", [E(192)], {
    cond: delirium,
    foundationDistribution: 2,
    foundationVariableTargets: 2,
  }),
]);
d(193, { produces: ["W", "U", "B", "R", "G"], abilities: [F("faceUpMana")] });
lord(194, [token("tok-dsk-everywhere")]);
a(195, [
  aff({}),
  F("beastieDelirium"),
  trig("upkeep", [
    { e: "may", prompt: "磨一張？", effects: [{ e: "mill", n: 1 }] },
  ]),
]);
a(196, [
  survival(
    [
      cnt("T0", 3),
      {
        e: "animate",
        untilNext: true,
        what: "T0",
        p: 0,
        t: 0,
        subtypes: ["Elemental"],
      },
      { e: "grant", what: "T0", grant: { kw: ["haste"] }, untilNext: true },
    ],
    { targets: [spec("permanent", { ctrl: "you", type: "Land" }, true)] },
  ),
]);
s(197, [{ e: "mill", n: 3 }, E("returnCreatureLand")]);
a(197, [
  act({}, [E(197)], "放逐三張呼喚Altanak", {
    fromGraveyard: true,
    keepSelf: true,
    sorcery: true,
    cond: C("threeNames"),
  }),
]);
a(200, [
  etb([{ e: "manifestDread" }]),
  event("ownFaceDownEtb", [
    { e: "searchLand", to: "battlefield", tapped: true },
  ]),
]);
d(201, {
  produces: ["W", "U", "B", "R", "G"],
  abilities: [
    F("nestMana"),
    act(
      { tap: true, sacSelf: true },
      [token("tok-dsk-spider", N("lastCounterTotal"))],
      "犧牲巢穴產蜘蛛",
      { sorcery: true },
    ),
  ],
});
a(202, [
  act(
    { tapN: { filter: { ctrl: "you", type: "Creature", other: true }, n: 1 } },
    [pump("self", 0, 0, ["indestructible"]), { e: "tap", what: "self" }],
    "橫置另一生物不滅",
  ),
  act(
    { mana: "{3}{G}{G}" },
    [
      pump(
        mine,
        { maxPower: { ctrl: "you", type: "Creature" } },
        { maxPower: { ctrl: "you", type: "Creature" } },
      ),
    ],
    "全部依最大力量強化",
  ),
]);
s(203, [{ e: "manifestDread" }, E("returnPermanent")]);
s(204, [E(204)]);
room(205, [F("graveLands")], [door(1, [E("graveCastTurn")])]);
a(207, [trig("attacks", [E(207)], { cond: delirium })]);
a(208, [
  trig("attacks", [
    dmg({ count: { ctrl: "you", type: "Creature", powMax: 2 } }, "opp"),
    gain({ count: { ctrl: "you", type: "Creature", powMax: 2 } }),
  ]),
]);
d(209, {
  equip: {
    cost: "{3}",
    grant: { p: 1, t: 1 },
    trigger: trig("attacks", [{ e: "tap", what: "T0" }], {
      targets: [{ ...CR, optional: true }],
    }),
  },
  abilities: [etb([{ e: "attach", what: "T0" }], { targets: [MY_CR] })],
});
s(
  210,
  [
    { e: "if", cond: delirium, then: [cnt("T0", 2)] },
    dmg({ power: "T0" }, "T1", "T0"),
  ],
  [MY_CR, OPP_CR],
);
a(211, [
  etb([{ e: "surveil", n: 2 }]),
  act(
    { mana: "{4}{B}{G}", tap: true, sacSelf: true },
    [token("tok-g-insect-11-bg-flying", N("graveTypes"))],
    "依類別產昆蟲",
  ),
]);
a(212, [
  etb([
    {
      e: "costThen",
      prompt: "犧牲另一生物或結界抽二？",
      cost: { sac: { type: ["Creature", "Enchantment"], other: true } },
      then: [{ e: "draw", n: 2 }],
    },
  ]),
  event("selfSacrifice", [{ e: "manifestDread" }], { fromGraveyard: true }),
]);
s(213, [destroy], [spec("permanent", { nonType: "Land" })]);
d(213, { costReduce: { cond: delirium, mana: "{2}" } });
a(214, [
  F("cantBlock"),
  eerie(
    [
      {
        e: "may",
        prompt: "回手？",
        effects: [{ e: "toHand", what: "selfAny" }],
      },
    ],
    { fromGraveyard: true },
  ),
]);
a(215, [eerie([token("tok-g-gremlin-11-r")])]);
a(216, [etb([{ e: "manifestDread" }]), event("ownFaceUp", [cnt("evCard")])]);
a(217, [
  { kind: "static", spellCostLess: { filter: { type: "Enchantment" }, n: 1 } },
  F("unlockDiscount"),
]);
a(218, [
  act(
    { tap: true, sacOther: { sub: "Room" } },
    [dmg(2, "opp"), draw],
    "犧牲房間造成傷害",
  ),
]);
a(219, [
  act({ mana: "{1}", tap: true }, [E(219)], "氣球複製", {
    sorcery: true,
    targets: [{ ...MY_CR, notSelf: true }],
  }),
]);
a(220, [
  F("kaitoCreature"),
  act({ loyalty: 1 }, [E("ninjaEmblem")], "+1"),
  act(
    { loyalty: 0 },
    [
      { e: "surveil", n: 2 },
      { e: "if", cond: { c: "oppLostLife" }, then: [draw] },
    ],
    "0",
  ),
  act({ loyalty: -2 }, [{ e: "stun", what: "T0", n: 2 }], "-2", {
    targets: [CR],
  }),
]);
d(220, { foundation: { ninjutsu: "{1}{U}{B}" } });
a(221, [
  etb([
    {
      e: "dig",
      n: 7,
      all: true,
      filter: { type: "Enchantment" },
      rest: "bottom",
      randomBottom: true,
    },
  ]),
  act({ tap: true }, [E("lockUnlock")], "鎖定或解鎖", {
    sorcery: true,
    targets: [spec("permanent", { ctrl: "you", sub: "Room" })],
  }),
]);
s(222, [
  token("tok-g-gremlin-11-r", 3),
  pump({ all: { ctrl: "you", sub: "Gremlin", type: "Creature" } }, 0, 0, [
    "menace",
    "lifelink",
    "haste",
  ]),
]);
a(223, [trig("combatDamagePlayer", [E(223)])]);
a(224, [
  etb([token("tok-dsk-shard", 2)]),
  act({ mana: "{2}", tap: true }, [E(224)], "碎片化複製", {
    targets: [spec("creature", { ctrl: "you", legendary: false })],
  }),
]);
a(225, [trig("endStep", [E(225)])]);
s(226, [E("discardHand"), { e: "draw", n: N("graveTypes") }]);
room(
  227,
  [door(0, [{ e: "destroy", what: { all: { type: "Creature", powMin: 3 } } }])],
  [F("otherPermanentHexproof")],
);
a(228, [survival([E(228)])]);
s(
  229,
  [{ e: "reanimate", what: "T0", finality: true }],
  [gy({ type: "Creature" })],
);
room(
  230,
  [door(0, [dmg({ hand: true })], [OPP_CR])],
  [F("noHandLimit"), trig("endStep", [draw])],
);
a(231, [
  act(
    { mana: "{2}", sacOther: { type: ["Creature", "Enchantment"] } },
    [cnt("self")],
    "犧牲放指示物",
  ),
  trig("endStep", [dmg(N("sacrifices"))], {
    cond: C("sacrificed"),
    targets: [ANY],
  }),
]);
a(232, [survival([cnt("T0")], { targets: [CR] })]);
a(234, [eerie([{ e: "surveil", n: 1 }])]);
room(235, [trig("firstMain", [E("roomMana")])], [door(1, [E("doorSpirit")])]);
a(236, [etb([token("tok-g-insect-11-bg-flying", 2)]), F("deliriumInsects")]);
a(237, [F("sprinterCast")]);
a(238, [eerie([E(238)])]);
a(240, [
  trig("upkeep", [
    { e: "draw", n: 2, who: "you" },
    { e: "draw", n: 2, who: "opp" },
  ]),
  F("winterHand"),
]);
a(241, [trig("endStep", [E(241)], { cond: C("primeLands") })]);
a(242, [
  trig("attacks", [
    {
      e: "may",
      prompt: "+4/+0並於結束犧牲？",
      effects: [pump("self", 4), E("sacEnd")],
    },
  ]),
]);
a(243, [
  act({ mana: "{3}", tap: true, sacSelf: true }, [dmg(3)], "造成3傷害", {
    targets: [CR],
  }),
]);
d(245, {
  equip: {
    manual: true,
    cost: "",
    grant: { p: 2, t: 2, kw: ["deathtouch", "lifelink"] },
  },
  abilities: [
    etb([E(47)]),
    act(
      { sacOther: { type: "Creature" } },
      [{ e: "attach", what: "T0" }],
      "犧牲生物佩帶",
      { sorcery: true, targets: [MY_CR], isEquip: true },
    ),
  ],
});
a(246, [
  F("seeFaceDown"),
  act(
    { mana: "{2}", sacSelf: true },
    [{ e: "surveil", n: 2 }, draw],
    "刺探並抓牌",
  ),
]);
a(247, [trig("dies", [draw, { e: "draw", who: "opp", n: 1 }])]);
a(248, [
  act({ tap: true }, [E("vacuumExile")], "放逐墳墓場牌", {
    targets: [spec("gyCard")],
  }),
  act(
    { mana: "{6}", tap: true, sacSelf: true },
    [E("vacuumReturn")],
    "放回小精靈",
    { sorcery: true },
  ),
]);
d(249, {
  equip: { cost: "{1}", grant: { p: 1, t: 1 } },
  abilities: [etb([glimmer()])],
});
d(250, {
  produces: ["W", "B"],
  abilities: [
    F("screenMana"),
    act(
      { mana: "{7}" },
      [
        cnt("self", 7),
        {
          e: "animate",
          permanent: true,
          what: "self",
          p: 0,
          t: 0,
          subtypes: ["Spirit"],
        },
      ],
      "成為精靈",
      { oncePerGame: true },
    ),
  ],
});
a(251, [
  act(
    { mana: "{1}", tap: true, sacSelf: true },
    [{ e: "tutor", filter: { type: "Land", basic: true } }],
    "找基本地",
  ),
  act(
    { mana: "{3}", tap: true, sacSelf: true },
    [E("lockUnlock")],
    "鎖定或解鎖",
    {
      sorcery: true,
      targets: [spec("permanent", { ctrl: "you", sub: "Room" })],
    },
  ),
]);
a(252, [
  act({ mana: "{2}" }, [{ e: "toLibraryBottom", what: "T0" }], "放回牌庫底", {
    sorcery: true,
    targets: [spec("gyCard")],
  }),
]);
a(253, [F("marvinAbilities")]);
d(254, {
  equip: {
    cost: "{2}",
    grant: { p: 2 },
    trigger: trig("attacks", [E(254)]),
  },
});
for (const [n, first, second, types] of [
  [256, "B", "R", ["Swamp", "Mountain"]],
  [259, "W", "U", ["Plains", "Island"]],
  [260, "U", "B", ["Island", "Swamp"]],
  [261, "G", "W", ["Forest", "Plains"]],
  [270, "R", "G", ["Mountain", "Forest"]],
] as const)
  d(n, { produces: [first, second], foundation: { verge: types } });
export const completeDsk = complete;
