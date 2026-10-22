// ECL base set 001–268. Full source text is kept beside executable definitions.
import catalog from './ecl-catalog.json';
import type { Ability, ActivatedAbility, CardDef, Cond, Effect, Filter, Mode, Ref, TargetSpec } from '../../engine/types';
import { add, defs as registered, slug, act, etb, trig, CR, MY_CR, OPP_CR, OPP, ANY } from '../dsl';
const patches = new Map<number, Partial<CardDef>>();
const d = (n: number, patch: Partial<CardDef>) => patches.set(n, patch);
const a = (n: number, abilities: Ability[]) => d(n, { abilities });
const s = (n: number, effects: Effect[], targets?: TargetSpec[]) => d(n, { spell: { effects, targets } });
const E = (action: string, what?: Ref, n?: number): Effect => ({ e: 'ecl', action, what, n });
const C = (action: string, n?: number): Cond => ({ c: 'ecl', action, n });
const spec = (kind: TargetSpec['kind'], filter?: Filter, optional = false): TargetSpec => ({ kind, filter, optional });
const gy = (filter: Filter = {}, optional = false) => spec('gyCard', { ctrl: 'you', ...filter }, optional);
const creatureGy = gy({ type: 'Creature' }),
  mine: Ref = { all: { type: 'Creature', ctrl: 'you' } };
const tok = (name: string, n?: import('../../engine/types').Amt): Effect => ({ e: 'token', token: `tok-ecl-${name}`, n });
const draw: Effect = { e: 'draw', n: 1 };
const minus = (what: Ref, n = 1): Effect => ({ e: 'counters', what, n: -n });
const pump = (what: Ref, p = 0, t = 0, kw: import('../../engine/types').Keyword[] = []): Effect => ({ e: 'pump', what, p, t, kw });
const blight = (n: number, then: Effect[]): Effect => ({ e: 'costThen', prompt: `枯萎${n}？`, cost: { blight: n }, then });
const remove = (mana: string, n: number, effects: Effect[], targets?: TargetSpec[], sorcery = false): ActivatedAbility =>
  act({ mana }, effects, `移除${n}個指示物`, { targets, sorcery, removeCounter: { n, any: true } });
const transformAt = (mana: string): Ability =>
  trig('firstMain', [{ e: 'costThen', prompt: `支付${mana}轉化？`, cost: { mana }, then: [{ e: 'transform', what: 'self' }] }]);
const staticE = (ecl: string): Ability => ({ kind: 'static', ecl });
const enteredBlight = (n: number, abilities: Ability[] = []): Partial<CardDef> => ({ etbCounters: -n, abilities });
const behold = (sub: string, exile = false): Partial<CardDef> => ({
  ecl: { behold: { sub, n: 1, ...(exile ? { exile: true } : { tax: 2 }) } },
});
const tribalLord = (sub: string, p = 1, t = 1, kw: import('../../engine/types').Keyword[] = []): Ability => ({
  kind: 'static',
  anthem: { filter: { type: 'Creature', ctrl: 'you', sub, other: true }, grant: { p, t, kw } },
});
const chosen = () => ({ ecl: { asEnters: 'tribe' as const } });
const damage = (n: import('../../engine/types').Amt, to: Ref = 'T0'): Effect => ({ e: 'damage', n, to });
const modes = (n: number, ms: Mode[]) => d(n, { spell: { modes: ms } });
function shift<T>(v: T, offset: number): T {
  if (Array.isArray(v)) return v.map((x) => shift(x, offset)) as T;
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v))
      out[k] = typeof x === 'string' && /^T\d$/.test(x) ? 'T' + (Number(x[1]) + offset) : shift(x, offset);
    return out as T;
  }
  return v;
}
function command(n: number, ms: Mode[]) {
  const combinations: Mode[] = [];
  for (let i = 0; i < ms.length; i++)
    for (let j = i + 1; j < ms.length; j++) {
      const first = ms[i],
        second = shift(ms[j], first.targets?.length ?? 0);
      combinations.push({
        text: first.text + '；' + second.text,
        targets: [...(first.targets ?? []), ...(second.targets ?? []).map((t) => ({ ...t, allowRepeat: true }))],
        effects: [...first.effects, ...second.effects],
      });
    }
  modes(n, combinations);
}
// White and colorless creatures.
a(2, [
  etb(
    [
      { e: 'exileGy', what: 'T0' },
      { e: 'exileGy', what: 'T1' },
      { e: 'gain', n: 3 },
    ],
    { targets: [spec('gyCard', {}, true), spec('gyCard', {}, true)] },
  ),
]);
a(4, [
  act({ loyalty: 1 }, [tok('kithkin')], '+1：派出奇斯金'),
  act({ loyalty: -2 }, [damage(4)], '−2：4傷害', { targets: [spec('creature', { tapped: true })] }),
  act({ loyalty: -8 }, [E('ajani')], '−8：依生命檢視牌庫'),
]);
s(5, [pump('T0', 2, 1), pump('T1', 2, 1)], [CR, { ...CR, optional: true }]);
d(6, { equip: { cost: '{1}', grant: { t: 1, damageByToughness: true } } });
d(7, {
  abilities: [etb([tok('kithkin')]), trig('transformed', [tok('kithkin')]), transformAt('{G}')],
  back: {
    ...(catalog.find((c) => c.number === 7) as unknown as CardDef).back!,
    abilities: [act({ tap: true }, [E('brigidMana')], '依其他生物數加綠或白'), transformAt('{W}')],
  },
});
d(8, enteredBlight(2, [remove('{1}{W}', 1, [pump('T0', 0, 0, ['indestructible'])], [CR], true)]));
d(9, { ...behold('Kithkin', true), abilities: [tribalLord('Kithkin'), trig('leaves', [E('championReturn')])] });
a(10, [etb([tok('kithkin', 2)]), act({ mana: '{4}{W}' }, [tok('kithkin')], '派出奇斯金')]);
s(11, [E('cribSwap')], [CR]);
a(12, [etb([E('colossus')], { targets: [OPP] })]);
d(13, {
  abilities: [staticE('creatureConvoke'), transformAt('{B}')],
  back: {
    ...(catalog.find((c) => c.number === 13) as unknown as CardDef).back!,
    abilities: [
      { kind: 'static', anthem: { filter: { type: 'Creature', ctrl: 'you', other: true, token: false }, grant: { kw: ['persist'] } } },
      transformAt('{W}'),
    ],
  },
});
d(14, enteredBlight(3, [trig('becomesTapped', [{ e: 'removeCounters', what: 'self', n: 1 }], { when: C('hasMinus') })]));
d(15, {
  aura: { target: CR, grant: { p: 1, kw: ['flying'] } },
  abilities: [
    act({ mana: '{1}{W}', blight: 2 }, [{ e: 'toHand', what: 'selfAny' }], '墳墓場枯萎2：回手', {
      fromGraveyard: true,
      keepSelf: true,
      sorcery: true,
    }),
  ],
});
a(16, [etb([{ e: 'bounce', what: 'T0' }], { targets: [{ ...MY_CR, notSelf: true, optional: true }] })]);
a(17, [etb([pump(mine, 1, 0), pump({ all: { type: 'Creature', ctrl: 'you', sub: 'Kithkin' } }, 0, 0, ['first_strike'])])]);
a(20, [staticE('kinbinding'), trig('combatStart', [tok('kithkin')])]);
d(21, { ...behold('Kithkin'), abilities: [trig('allyEtb', [pump('self', 1, 1)])] });
a(22, [trig('attacks', [E('kinscaer')])]);
a(23, [
  etb([tok('kithkin', { colors: true })]),
  act({ tapN: { filter: { type: 'Creature' }, n: 3 } }, [pump('self', 3, 0, ['flying'])], '橫置三個生物：+3/+0且飛行'),
]);
a(25, [trig('attacks', [E('meanders')])]);
d(26, enteredBlight(1, [remove('{1}{W}', 1, [draw], undefined, true)]));
d(27, { ecl: { variableTargets: 'creature' }, spell: { effects: [E('morningtide')] } });
s(28, [{ e: 'flicker', what: 'T0' }, tok('shapeshifter')], [MY_CR]);
modes(30, [
  { text: '消滅神器或結界', targets: [spec('permanent', { type: ['Artifact', 'Enchantment'] })], effects: [{ e: 'destroy', what: 'T0' }] },
  { text: '消滅費用至少3生物', targets: [spec('creature', { mvMin: 3 })], effects: [{ e: 'destroy', what: 'T0' }] },
  {
    text: '枯萎2：兩項',
    blight: 2,
    targets: [spec('permanent', { type: ['Artifact', 'Enchantment'] }), spec('creature', { mvMin: 3 })],
    effects: [
      { e: 'destroy', what: 'T0' },
      { e: 'destroy', what: 'T1' },
    ],
  },
]);
a(31, [trig('allyEtb', [{ e: 'removeCounters', what: 'self', n: 1 }], { when: C('hasMinus') })]);
d(31, { ...patches.get(31), etbCounters: -2 });
a(32, [
  etb([pump('T0', 0, 0, ['persist'])], { targets: [{ ...MY_CR, notSelf: true }] }),
  act({ mana: '{W}', tap: true }, [E('removeAny')], '移除任意數量指示物', { sorcery: true, targets: [MY_CR] }),
]);
d(35, enteredBlight(2, [trig('endStep', [E('slumbering')])]));
d(36, {
  aura: { target: CR, grant: { cantAttack: true, cantBlock: true } },
  abilities: [act({ mana: '{1}{W}', blight: 1, sacSelf: true }, [E('auraExile')], '枯萎1並犧牲：放逐所結附生物')],
});
a(38, [
  trig(
    'youAttack',
    [
      pump(
        'trig',
        { count: { type: 'Creature', ctrl: 'you', sub: 'Kithkin' } } as never,
        { count: { type: 'Creature', ctrl: 'you', sub: 'Kithkin' } } as never,
      ),
    ],
    { alone: true },
  ),
]);
a(40, [trig('becomesTapped', [pump('T0', 2, 0)], { targets: [spec('creature', { ctrl: 'you', sub: 'Merfolk', other: true })] })]);
a(41, [trig('becomesTapped', [{ e: 'gain', n: 2 }])]);
a(42, [
  act(
    { mana: '{1}', tap: true, tapN: { filter: { type: 'Creature', other: true }, n: 1 } },
    [{ e: 'tap', what: 'T0' }],
    '橫置另一生物：橫置對手生物',
    { targets: [OPP_CR] },
  ),
]);
s(43, [E('winnowing')]);
// Blue.
d(44, { aura: { target: MY_CR, grant: { p: 1, t: 2 } }, abilities: [etb([pump('attached', 0, 0, ['hexproof'])])] });
d(45, { aura: { target: CR, grant: { noUntap: true } }, abilities: [etb([{ e: 'tap', what: 'attached' }]), staticE('noCountersAura')] });
d(46, {
  ...behold('Merfolk', true),
  abilities: [
    etb([{ e: 'stun', what: 'T0' }], { targets: [{ ...CR, optional: true }] }),
    trig('becomesTapped', [{ e: 'stun', what: 'T0' }], { targets: [{ ...CR, optional: true }] }),
    trig('leaves', [E('championReturn')]),
  ],
});
a(47, [etb([{ e: 'bounce', what: 'T0' }], { targets: [spec('permanent', { nonType: 'Land', other: true }, true)] })]);
d(48, enteredBlight(1, [remove('{2}{U}', 1, [E('flitterwing')])]));
a(49, [etb([E('glamer')], { targets: [{ ...CR, notSelf: true, optional: true }] })]);
a(50, [
  etb([], {
    modes: [
      { text: '橫置', targets: [CR], effects: [{ e: 'tap', what: 'T0' }] },
      { text: '重置', targets: [CR], effects: [{ e: 'untap', what: 'T0' }] },
    ],
  }),
]);
d(51, enteredBlight(1, [remove('{1}{U}', 1, [E('guardianCounter')], [spec('spell', { nonType: 'Creature' })])]));
d(52, { uncounterable: true, spell: { effects: [E('answer')] } });
a(53, [trig('attacks', [E('gravelgill')])]);
s(54, [E('crescendo')]);
d(55, {
  flashCond: { c: 'controls', filter: { sub: 'Faerie' } },
  abilities: [{ kind: 'static', self: { cond: { c: 'not', cond: { c: 'selfTapped' } }, grant: { kw: ['hexproof'] } } }],
});
d(57, enteredBlight(3, [remove('{1}{U}', 1, [draw]), remove('{2}{U}', 2, [{ e: 'stun', what: 'T0' }], [CR])]));
s(59, [E('mirrorform')], [spec('permanent', { nonSub: 'Aura' })]);
d(60, {
  aura: { target: CR, grant: { loseAbilities: true, animate: { p: 1, t: 1, subtype: 'Noggle', replaceCreatureTypes: true } } },
  abilities: [staticE('noggleColorless')],
});
d(61, {
  abilities: [
    transformAt('{G}'),
    act({ loyalty: 2 }, [E('allTypes')], '+2：獲得所有生物類別', { targets: [{ ...CR, optional: true }] }),
    act({ loyalty: 1 }, [{ e: 'pump', what: 'T0', p: -2, t: 0, untilNext: true }], '+1：−2/−0至下回合', { targets: [CR] }),
  ],
  back: {
    ...(catalog.find((c) => c.number === 61) as unknown as CardDef).back!,
    abilities: [
      transformAt('{U}'),
      act({ loyalty: -1 }, [{ e: 'mill', n: 3 }, E('takeMilledPermanent')], '−1：磨三取永久物'),
      act({ loyalty: -3 }, [tok('elk', 2)], '−3：派出兩個麋鹿'),
      act({ loyalty: -6 }, [E('okoEmblem')], '−6：生物類別徽記'),
    ],
  },
});
d(62, { ecl: { asEnters: 'clone' } });
a(63, [trig('becomesTapped', [tok('faerie')])]);
d(64, {
  spell: {
    targets: [
      { ...CR, optional: true },
      { ...CR, optional: true },
    ],
    effects: [{ e: 'stun', what: 'T0' }, { e: 'stun', what: 'T1' }, draw],
  },
});
d(65, {
  ...chosen(),
  abilities: [staticE('torque'), act({ tap: true }, [E('torqueNextCopy')], '移除3充能：複製下個瞬間或法術', { removeCounter: { n: 3 } })],
});
s(
  67,
  [
    { e: 'bounce', what: 'T0' },
    { e: 'bounce', what: 'T1' },
  ],
  [CR, { ...CR, differentControllerFrom: 0 }],
);
a(68, [etb([{ e: 'draw', n: { colors: true } }])]);
d(69, { ...behold('Merfolk'), abilities: [etb([tok('merfolk')])] });
a(70, [trig('becomesTapped', [draw, { e: 'discard', n: 1, who: 'you' }])]);
s(71, [{ e: 'counter', what: 'T0' }], [spec('spell', { mvMin: 2, mvMax: 2 })]);
a(74, [etb([{ e: 'bounce', what: { all: { type: 'Creature', nonSub: 'Elemental' } } }], { cond: { c: 'selfWasCast' } })]);
d(75, { spell: { targets: [{ kind: 'spellOrCreature' }], effects: [{ e: 'topOrBottom', what: 'T0' }] } });
d(76, {
  keywords: ['unblockable'],
  abilities: [etb([E('syggDraw')], { targets: [CR] }), trig('transformed', [E('syggDraw')], { targets: [CR] }), transformAt('{W}')],
  back: {
    ...(catalog.find((c) => c.number === 76) as unknown as CardDef).back!,
    keywords: ['unblockable'],
    abilities: [
      trig('transformed', [{ e: 'pump', what: 'T0', p: 0, t: 0, kw: ['protection_colors'], untilNext: true }], { targets: [MY_CR] }),
      transformAt('{U}'),
    ],
  },
});
s(78, [E('temporal')], [spec('permanent', { nonType: 'Land' })]);
s(79, [{ e: 'draw', n: 3 }, E('thirst')]);
a(82, [trig('becomesTapped', [pump('T0', -3, 0)], { targets: [OPP_CR] })]);
s(83, [E('farewell')], [spec('permanent', { nonType: 'Land' }), spec('permanent', { nonType: 'Land' }, true)]);
modes(84, [
  { text: '另付{1}', cost: '{1}{U}{U}', targets: [{ kind: 'spell' }], effects: [{ e: 'counter', what: 'T0' }] },
  { text: '枯萎2', blight: 2, targets: [{ kind: 'spell' }], effects: [{ e: 'counter', what: 'T0' }] },
]);
// Black.
modes(85, [
  {
    text: '揭示手牌並棄非地永久物',
    targets: [OPP],
    effects: [{ e: 'discardChosen', who: 'T0', filter: { nonType: ['Land', 'Instant', 'Sorcery'] } }],
  },
  { text: '−2/−2', targets: [CR], effects: [pump('T0', -2, -2)] },
]);
d(86, {
  equip: { cost: '{2}', grant: { p: 1, t: 2 } },
  abilities: [etb([{ e: 'attach', what: 'T0' }, pump('T0', 0, 0, ['wither'])], { targets: [MY_CR] })],
});
a(90, [etb([blight(2, [draw, { e: 'lose', who: 'you', n: 1 }])]), trig('attacks', [blight(2, [draw, { e: 'lose', who: 'you', n: 1 }])])]);
s(91, [E('bidding')]);
a(92, [
  etb([blight(1, [tok('goblin', 2)])]),
  trig(
    'allyDies',
    [
      { e: 'lose', who: 'opp', n: 1 },
      { e: 'gain', n: 1 },
    ],
    { includeSelf: true, filter: { sub: 'Goblin' } },
  ),
]);
a(93, [trig('youAttack', [pump('T0', 1, 0)], { targets: [spec('creature', { ctrl: 'you', sub: 'Goblin', attacking: true })] })]);
modes(94, [
  { text: '另付{3}', cost: '{4}{B}', targets: [CR], effects: [{ e: 'exile', what: 'T0' }] },
  { text: '枯萎1', blight: 1, targets: [CR], effects: [{ e: 'exile', what: 'T0' }] },
]);
d(95, {
  ...behold('Goblin', true),
  abilities: [
    act({ life: 1, blight: 2 }, [E('opponentBlight', undefined, 2)], '對手枯萎2', { sorcery: true }),
    trig('leaves', [E('championReturn')]),
  ],
});
d(
  96,
  enteredBlight(3, [
    trig('endStep', [{ e: 'removeCounters', what: 'self', n: 1 }], {
      cond: { c: 'and', conds: [C('hasMinus'), { c: 'gyCount', filter: { sub: 'Elf' }, n: 1 }] } as Cond,
    }),
  ]),
);
a(98, [
  act({ tap: true, blight: 1 }, [{ e: 'surveil', n: 1 }], '枯萎1：刺探'),
  act({ tap: true, blight: 2 }, [E('dissidentExile')], '枯萎2：放逐', { targets: [{ kind: 'gyCard' }] }),
  staticE('dissidentCast'),
]);
a(99, [
  etb([
    { e: 'mill', n: 3 },
    {
      e: 'if',
      cond: { c: 'gyCount', filter: { sub: 'Elf' }, n: 1 },
      then: [
        { e: 'lose', who: 'opp', n: 2 },
        { e: 'gain', n: 2 },
      ],
    },
  ]),
]);
s(100, [{ e: 'reanimate', what: 'T0' }, E('doseBlight')], [creatureGy]);
a(102, [etb([E('gloomRipper')], { targets: [MY_CR, { ...OPP_CR, optional: true }] })]);
d(103, enteredBlight(2, [remove('{2}{B}', 2, [pump('T0', -2, -2)], [CR], true)]));
d(105, {
  abilities: [
    etb([{ e: 'toHand', what: 'T0' }], { targets: [gy({ sub: 'Goblin' }, true)] }),
    trig('transformed', [{ e: 'toHand', what: 'T0' }], { targets: [gy({ sub: 'Goblin' }, true)] }),
    transformAt('{R}'),
  ],
  back: {
    ...(catalog.find((c) => c.number === 105) as unknown as CardDef).back!,
    abilities: [trig('attacks', [E('grubCopy')]), transformAt('{B}')],
  },
});
a(106, [trig('firstMain', [E('gutsplitter')])]);
d(
  107,
  enteredBlight(2, [
    trig('allyDies', [
      { e: 'surveil', n: 1 },
      { e: 'removeCounters', what: 'self', n: 1 },
    ]),
  ]),
);
a(108, [act({ discard: 1 }, [pump('self', 0, 0, ['indestructible']), { e: 'tap', what: 'self' }], '棄牌：不滅並橫置')]);
d(110, enteredBlight(6, [trig('permanentToGy', [{ e: 'removeCounters', what: 'self', n: 1 }], { when: C('hasMinus') })]));
a(111, [staticE('noDrawGain'), trig('eachDrawStep', [E('mornsong')])]);
d(112, {
  ...behold('Goblin'),
  abilities: [
    { kind: 'static', self: { grant: { cantBlock: true } } },
    trig('dies', [{ e: 'destroy', what: 'T0' }], { targets: [spec('creature', { ctrl: 'opp', powMax: 2 })] }),
  ],
});
s(113, [pump('T0', 3, -3), E('noTypes')], [CR]);
modes(115, [
  { text: '對手放逐兩張手牌', targets: [OPP], effects: [E('exileHand', undefined, 2)] },
  { text: '移除所有指示物', targets: [CR], effects: [E('removeAll')] },
  { text: '兩項', targets: [OPP, CR], effects: [E('exileHand', undefined, 2), E('removeAll', 'T1')] },
]);
modes(116, [
  { text: '消滅費用至多2生物', targets: [spec('creature', { mvMax: 2 })], effects: [{ e: 'destroy', what: 'T0' }] },
  {
    text: '枯萎1：消滅並獲得2生命',
    blight: 1,
    targets: [spec('creature', { mvMax: 2 })],
    effects: [
      { e: 'destroy', what: 'T0' },
      { e: 'gain', n: 2 },
    ],
  },
]);
a(117, [trig('dies', [E('retched')], { when: C('hasMinus') })]);
s(119, [pump('T0', 0, 0, ['deathtouch', 'lifelink']), E('malice')], [MY_CR]);
a(121, [etb([E('taster')], { targets: [OPP] })]);
a(122, [
  etb([{ e: 'surveil', n: 2 }]),
  trig('allyEtb', [{ e: 'copyCreature', what: 'trig' }], { when: C('graveEntry'), oncePerTurn: true }),
]);
modes(123, [
  { text: '取回一張生物', targets: [creatureGy], effects: [{ e: 'toHand', what: 'T0' }] },
  {
    text: '取回兩張共用生物類別',
    targets: [creatureGy, { ...creatureGy, sharesTypeWith: 0 } as TargetSpec],
    effects: [
      { e: 'toHand', what: 'T0' },
      { e: 'toHand', what: 'T1' },
    ],
  },
]);
// Red.
d(124, {
  abilities: [
    etb([{ e: 'costThen', prompt: '棄一抓一？', cost: { discard: 1 }, then: [draw] }]),
    trig('transformed', [{ e: 'costThen', prompt: '棄一抓一？', cost: { discard: 1 }, then: [draw] }]),
    transformAt('{U}'),
  ],
  back: {
    ...(catalog.find((c) => c.number === 124) as unknown as CardDef).back!,
    abilities: [trig('transformed', [E('ashlingMana')]), trig('firstMain', [E('ashlingMana')]), transformAt('{R}')],
  },
});
a(125, [tribalLord('Giant', 0, 0, ['double_strike'])]);
a(126, [staticE('boneclub')]);
d(128, enteredBlight(2, [remove('{1}{R}', 1, [{ e: 'grant', what: 'T0', grant: { cantBlock: true } }], [CR], true)]));
modes(129, [
  { text: '放逐兩張', effects: [E('burningCuriosity', undefined, 2)] },
  { text: '枯萎1：放逐三張', blight: 1, effects: [E('burningCuriosity', undefined, 3)] },
]);
d(130, {
  ...behold('Elemental', true),
  abilities: [
    trig('allyEtb', [{ e: 'damage', n: { power: 'trig' }, from: 'trig', to: 'opp' }], { filter: { sub: 'Elemental' } }),
    trig('leaves', [E('championReturn')]),
  ],
});
modes(131, [
  { text: '2傷害', targets: [CR], effects: [damage(2)] },
  { text: '枯萎1：4傷害', blight: 1, targets: [CR], effects: [damage(4)] },
]);
d(132, { ...chosen(), abilities: [staticE('tribeDoubleDamage')] });
a(133, [etb([tok('goblin')])]);
s(134, [E('endBlazeWatch'), damage({ x: true })], [CR]);
a(135, [trig('castAny', [damage(2, 'opp')], { filter: { mvMin: 4 } })]);
s(137, [{ e: 'exileIfDies', what: 'T0' }, damage(5)], [CR]);
a(139, [act({ tap: true }, [E('flamebraiderMana')], '加兩點元素專用法術力')]);
s(142, [E('steal'), E('goatBonus')], [CR]);
a(143, [staticE('dreamSpells'), trig('attacks', [E('dreamCast')])]);
a(144, [act({ tap: true, blight: 1 }, [E('discardDraw')], '枯萎1：棄一抓一')]);
d(145, { uncounterable: true, wardLife: 2, abilities: [staticE('squelcher')] });
d(147, {
  flashback: '{1}{R}',
  ecl: { behold: { sub: 'Elemental', n: 3, flashbackOnly: true } },
  spell: { targets: [MY_CR], effects: [{ e: 'copyCreature', what: 'T0', temp: true }, pump('created', 0, 0, ['haste'])] },
});
a(148, [etb([E('burningCuriosity', undefined, 1)])]);
a(149, [trig('eachEndStep', [damage(2, 'opp')], { cond: C('counterPlaced') })]);
a(150, [{ kind: 'static', anthem: { filter: { type: 'Creature' }, grant: { kw: ['haste'] } } }, staticE('basicManaBonus')]);
a(151, [act({ mana: '{1}{R}' }, [E('meek')], '放總力量防禦力至多5生物')]);
a(153, [trig('firstMain', [blight(1, [{ e: 'token', token: 'tok-treasure' }])])]);
s(154, [damage(4)], [{ kind: 'creatureOrPlaneswalker' }]);
a(155, [trig('dies', [E('burningCuriosity', undefined, 1)])]);
d(156, { ecl: { blightX: true }, spell: { effects: [E('soulImmolation')] } });
d(157, {
  ...behold('Elemental'),
  abilities: [act({ mana: '{R}' }, [pump('T0', 0, 0, ['trample']), E('soulbright')], '賦予踐踏；第三次加四紅', { targets: [MY_CR] })],
});
a(158, [etb([blight(2, [tok('goblin', 2)])])]);
a(159, [trig('castInstSorc', [E('spinerock')])]);
a(160, [staticE('vividPower')]);
a(161, [act({ mana: '{1}{R}', tap: true, blight: 1 }, [damage(2, 'opp')], '枯萎1：對手2傷害')]);
a(163, [trig('combatStart', [blight(1, [{ e: 'reflexive', targets: [CR], effects: [pump('T0', 0, 0, ['haste'])] }])])]);
// Green.
s(164, [pump('T0', 1, 0), { e: 'bite', a: 'T0', b: 'T1' }], [MY_CR, { ...OPP_CR, optional: true }]);
a(165, [etb([E('aurora')])]);
a(166, [act({ tap: true }, [E('bloomMana')], '依永久物顏色加法術力')]);
a(169, [{ kind: 'static', self: { cond: C('otherEntry'), grant: { p: 2 } } }]);
d(169, { ...patches.get(169), evadePowLte: 2 });
d(170, { ecl: { behold: { n: 2, optional: true } }, spell: { effects: [E('celestial')] } });
d(171, {
  ...behold('Elf', true),
  abilities: [trig('castAny', [draw], { filter: { type: 'Creature' } }), trig('leaves', [E('championReturn')])],
});
a(175, [
  etb([{ e: 'toHand', what: 'T0' }], {
    cond: { c: 'controls', filter: { type: 'Creature' }, n: 3 },
    targets: [gy({ nonType: ['Instant', 'Sorcery'] })],
  }),
]);
a(176, [
  etb([{ e: 'costThen', prompt: '棄牌搜尋生物？', cost: { discard: 1 }, then: [{ e: 'tutor', filter: { type: 'Creature' } }] }]),
  act({ mana: '{1}', tap: true }, [{ e: 'untap', what: 'T0' }], '重置另一永久物', { targets: [spec('permanent', { other: true })] }),
]);
d(177, { aura: { target: CR, grant: { p: 2 } }, abilities: [etb([pump('attached', 0, 0, ['trample', 'indestructible'])])] });
d(180, {
  ...behold('Elf'),
  abilities: [act({ tap: true }, [{ e: 'addMana', mana: ['G', 'G'] }], '加兩綠', { cond: { c: 'gyCount', filter: { sub: 'Elf' }, n: 1 } })],
});
s(182, [{ e: 'mill', n: 4 }, E('takeMilledPermanent')]);
d(183, { costReduce: { cond: { c: 'controls', filter: { sub: 'Kithkin' } }, mana: '{1}' }, abilities: [etb([draw])] });
a(184, [staticE('moonVigil')]);
a(185, [
  trig('upkeep', [{ e: 'surveil', n: 1 }]),
  act({ mana: '{4}{G}{G}', sacSelf: true }, [tok('elf', { gy: { sub: 'Elf' } })], '依墳墓場精靈派出衍生物', { sorcery: true }),
]);
a(186, [etb([{ e: 'token', token: 'tok-ecl-mutavault', tapped: true }])]);
d(187, {
  aura: { target: MY_CR, grant: { p: 2, t: 2 } },
  abilities: [etb([{ e: 'fight', a: 'attached', b: 'T0' }], { targets: [{ ...OPP_CR, optional: true }] })],
});
a(188, [etb([E('prismabasher')], { variableVividTargets: true })]);
d(189, {
  abilities: [
    etb([{ e: 'tutorMany', filter: { type: 'Land', basic: true }, n: { colors: true }, to: 'hand' }]),
    { kind: 'static', extraLand: 1 },
  ],
});
a(190, [etb([{ e: 'gain', n: { maxPower: { type: 'Creature', ctrl: 'you', sub: 'Giant' } } }])]);
a(191, [
  { kind: 'static', self: { grant: { onlyOneBlocker: true } } },
  act({ mana: '{5}' }, [pump('T0', 2, 2)], '精靈+2/+2', { targets: [spec('creature', { ctrl: 'you', sub: 'Elf' })] }),
]);
d(192, {
  costReduce: { perCount: { sub: 'Forest' } },
  abilities: [
    trig('landfall', [tok('treefolk')]),
    act(
      { mana: '{1}{G}', exileSelf: true },
      [pump({ all: { ctrl: 'you', or: [{ sub: 'Treefolk' }, { sub: 'Forest' }] } }, 0, 0, ['indestructible'])],
      '保護樹妖與樹林',
    ),
  ],
});
a(193, [etb([E('selfless')])]);
d(194, {
  ecl: { asEnters: 'color' },
  aura: { target: spec('permanent', { type: 'Land' }), grant: {} },
  abilities: [staticE('landAuraMana')],
});
s(195, [E('spry')]);
s(197, [
  { e: 'searchLand', to: 'battlefield', tapped: true },
  { e: 'if', cond: { c: 'controls', filter: { or: [{ type: 'Land' }, { sub: 'Treefolk' }] }, n: 7 }, then: [tok('treefolk')] },
]);
s(198, [pump('T0', 3, 3), { e: 'if', cond: C('creatureEntered'), then: [draw] }], [CR]);
d(199, {
  abilities: [etb([E('trystanFront')]), trig('transformed', [E('trystanFront')]), transformAt('{B}')],
  back: {
    ...(catalog.find((c) => c.number === 199) as unknown as CardDef).back!,
    abilities: [trig('transformed', [E('trystanBack')]), transformAt('{G}')],
  },
});
a(201, [trig('attacks', [pump('T0', 2, 1)], { targets: [spec('creature', { ctrl: 'you', sub: 'Elf', other: true })] })]);
d(203, {});
// Multicolor.
a(204, [etb([E('abigale')], { targets: [{ ...CR, notSelf: true, optional: true }] })]);
command(205, [
  { text: '複製元素', targets: [spec('creature', { ctrl: 'you', sub: 'Elemental' })], effects: [{ e: 'copyCreature', what: 'T0' }] },
  { text: '玩家抓二', targets: [{ kind: 'player' }], effects: [{ e: 'draw', who: 'T0', n: 2 }] },
  { text: '對玩家全軍2傷害', targets: [{ kind: 'player' }], effects: [E('armyDamage', 'T0', 2)] },
  { text: '玩家派出兩珍寶', targets: [{ kind: 'player' }], effects: [{ e: 'token', token: 'tok-treasure', n: 2, who: 'T0' }] },
]);
a(207, [
  act({ mana: '{1}{W}', tap: true }, [pump('T0', 0, 0, ['flying', 'lifelink'])], '賦予飛行繫命', {
    targets: [{ ...MY_CR, notSelf: true }],
  }),
  trig('endStep', [E('bre')], { cond: { c: 'gainedLifeGte', n: 1 } }),
]);
command(208, [
  { text: '複製奇斯金', targets: [spec('creature', { ctrl: 'you', sub: 'Kithkin' })], effects: [{ e: 'copyCreature', what: 'T0' }] },
  { text: '玩家派出奇斯金', targets: [{ kind: 'player' }], effects: [{ ...tok('kithkin'), who: 'T0' } as Effect] },
  { text: '你的生物+3/+3', targets: [MY_CR], effects: [pump('T0', 3, 3)] },
  { text: '互鬥', targets: [MY_CR, OPP_CR], effects: [{ e: 'fight', a: 'T0', b: 'T1' }] },
]);
a(209, [etb([tok('kithkin', 2)], { cond: C('paidW', 2) }), etb([pump(mine, 1, 1, ['haste'])], { cond: C('paidR', 2) })]);
a(210, [etb([E('chaos')])]);
a(212, [
  etb([{ e: 'bounce', what: 'T0' }], { cond: C('paidU', 2), targets: [spec('permanent', { nonType: 'Land', other: true }, true)] }),
  etb([{ e: 'discardChosen', who: 'T0', filter: { nonType: 'Land' } }], { cond: C('paidB', 2), targets: [OPP] }),
]);
a(213, [
  trig('endStep', [{ e: 'untap', what: 'T0' }], { targets: [spec('creature', { ctrl: 'you', sub: 'Merfolk' })] }),
  tribalLord('Merfolk'),
]);
a(214, [
  etb([{ e: 'untap', what: { all: { ctrl: 'you', type: 'Creature', sub: 'Merfolk', other: true } } }]),
  {
    kind: 'static',
    condition: C('attackedMerfolk', 3),
    anthem: { filter: { type: 'Creature', ctrl: 'you', sub: 'Merfolk' }, grant: { p: 1 } },
  },
]);
a(215, [staticE('doranCost'), trig('youAttack', [E('doranAttack')]), trig('allyBlocks', [E('doranBlock')])]);
s(216, [E('dreamHarvest')]);
for (const [n, sub, lands] of [
  [217, 'Goblin', ['Swamp', 'Mountain']],
  [218, 'Elf', ['Swamp', 'Forest']],
  [219, 'Elemental', ['Island', 'Mountain']],
  [220, 'Kithkin', ['Forest', 'Plains']],
  [221, 'Merfolk', ['Plains', 'Island']],
] as const)
  a(n, [etb([{ e: 'dig', n: 4, take: 1, rest: 'bottom', optional: true, randomBottom: true, filter: { sub: [sub, ...lands] } }])]);
a(222, [
  etb([{ e: 'reanimate', what: 'T0' }], { cond: C('paidW', 2), targets: [gy({ type: 'Creature', mvMax: 3 })] }),
  etb([minus('T0', 3)], { cond: C('paidB', 2), targets: [{ ...CR, optional: true }] }),
]);
a(224, [
  act({ mana: '{G/W}' }, [E('figure', undefined, 1)], '成為2/3奇斯金斥候'),
  act({ mana: '{1}{G/W}{G/W}' }, [E('figure', undefined, 2)], '斥候成為4/5士兵'),
  act({ mana: '{3}{G/W}{G/W}{G/W}' }, [E('figure', undefined, 3)], '士兵成為7/8且保護免於對手'),
]);
a(225, [
  etb([{ e: 'costThen', prompt: '棄一抓一？', cost: { discard: 1 }, then: [draw] }]),
  trig('castAny', [{ e: 'costThen', prompt: '棄一抓一？', cost: { discard: 1 }, then: [draw] }], { filter: { mvMin: 4 } }),
]);
a(227, [
  trig('combatStart', [pump('T0', { colors: true } as never, { colors: true } as never)], { targets: [{ ...MY_CR, notSelf: true }] }),
]);
command(228, [
  { text: '複製鬼怪', targets: [spec('creature', { ctrl: 'you', sub: 'Goblin' })], effects: [{ e: 'copyCreature', what: 'T0' }] },
  { text: '玩家全軍+1/+1且敏捷', targets: [{ kind: 'player' }], effects: [E('armyPump', 'T0', 1)] },
  { text: '消滅神器或生物', targets: [spec('permanent', { type: ['Artifact', 'Creature'] })], effects: [{ e: 'destroy', what: 'T0' }] },
  { text: '磨五並取回鬼怪', targets: [{ kind: 'player' }], effects: [E('grubMill')] },
]);
a(229, [
  etb([E('opponentBlight', undefined, 1)]),
  trig('allyEtb', [E('opponentBlight', undefined, 1)], { filter: { sub: 'Elf' } }),
  act({ tapN: { filter: { type: 'Creature', sub: 'Elf' }, n: 3 } }, [{ e: 'proliferate', times: 1 }], '橫置三精靈：增殖', {
    sorcery: true,
  }),
]);
d(230, enteredBlight(2, [remove('{R/W}{R/W}', 1, [pump('T0', 1, 0, ['flying'])], [{ ...MY_CR, notSelf: true }], true)]));
a(231, [act({ tapN: { filter: { type: 'Creature' }, n: 2 } }, [E('kirol')], '複製你的觸發異能', { oncePerTurn: true })]);
a(232, [
  etb([{ e: 'mill', n: 4 }, E('lluwenTop')]),
  act(
    { mana: '{2}{B/G}{B/G}{B/G}', tap: true, discard: 1, discardFilter: { type: 'Land' } },
    [tok('worm', { gy: { type: 'Land' } })],
    '棄地派出蠕蟲',
  ),
]);
a(233, [
  etb([E('maralenExile')], { targets: [OPP] }),
  trig('allyEtb', [E('maralenExile')], { filter: { sub: ['Elf', 'Faerie'] }, targets: [OPP] }),
]);
a(236, [tribalLord('Elf'), trig('dies', [{ e: 'toHand', what: 'T0' }], { targets: [gy({ sub: 'Elf', other: true })] })]);
a(239, [staticE('conspire')]);
d(240, enteredBlight(2, [remove('{1}{W/B}', 2, [{ e: 'reanimate', what: 'T0' }], [gy({ type: 'Creature', mvMax: 3 })], true)]));
a(241, [trig('firstMain', [E('sanar')])]);
a(242, [
  trig('attacks', [E('blightSelfPlayer', undefined, 1)]),
  trig('allyDies', [E('urchin')], { includeSelf: true, filter: { hasCounters: true } }),
]);
command(244, [
  { text: '複製人魚', targets: [spec('creature', { ctrl: 'you', sub: 'Merfolk' })], effects: [{ e: 'copyCreature', what: 'T0' }] },
  { text: '玩家全軍繫命', targets: [{ kind: 'player' }], effects: [E('armyLifelink')] },
  { text: '玩家抓牌', targets: [{ kind: 'player' }], effects: [{ e: 'draw', who: 'T0', n: 1 }] },
  { text: '橫置暈眩', targets: [CR], effects: [{ e: 'stun', what: 'T0' }] },
]);
a(245, [staticE('tam'), act({ tap: true }, [E('allColors')], '生物成為全色', { targets: [MY_CR] })]);
a(246, [
  etb([pump('T0', 1, 1, ['trample'])], { targets: [MY_CR] }),
  trig('allyEtb', [pump('T0', 1, 1, ['trample'])], { filter: { sub: 'Kithkin' }, targets: [MY_CR] }),
]);
command(247, [
  { text: '複製精靈', targets: [spec('creature', { ctrl: 'you', sub: 'Elf' })], effects: [{ e: 'copyCreature', what: 'T0' }] },
  {
    text: '取回一至二永久物',
    targets: [gy({ nonType: ['Instant', 'Sorcery'] }), gy({ nonType: ['Instant', 'Sorcery'] }, true)],
    effects: [
      { e: 'toHand', what: 'T0' },
      { e: 'toHand', what: 'T1' },
    ],
  },
  { text: '消滅生物或結界', targets: [spec('permanent', { type: ['Creature', 'Enchantment'] })], effects: [{ e: 'destroy', what: 'T0' }] },
  { text: '玩家全軍+3/+3並重置', targets: [{ kind: 'player' }], effects: [E('armyPump', 'T0', 3)] },
]);
a(248, [{ kind: 'static', triggerDouble: { type: 'Creature', sub: 'Elemental', other: true } }]);
a(249, [
  etb([damage(3)], { cond: C('paidR', 2), targets: [ANY] }),
  etb(
    [
      { e: 'tutor', filter: { type: 'Land' } },
      { e: 'gain', n: 2 },
    ],
    { cond: C('paidG', 2) },
  ),
]);
a(251, [trig('endStep', [{ e: 'surveil', n: 1 }], { cond: C('otherEntry') })]);
a(252, [
  etb([{ e: 'exile', what: 'T0' }], {
    cond: C('paidG', 2),
    targets: [spec('permanent', { ctrl: 'opp', type: ['Artifact', 'Enchantment'] })],
  }),
  etb(
    [
      { e: 'draw', n: 2 },
      { e: 'discard', who: 'you', n: 1 },
    ],
    { cond: C('paidU', 2) },
  ),
]);
// Artifacts and land.
d(253, { ...chosen(), abilities: [staticE('chronicle'), trig('castAny', [E('chosenDraw')])] });
d(254, {
  ecl: { asEnters: 'tribe8' },
  abilities: [
    staticE('pennant'),
    act({ mana: '{2}', tap: true, sacSelf: true }, [{ e: 'toHand', what: 'T0' }], '取回所選類別', { targets: [gy({ chosenTribe: true })] }),
  ],
});
d(255, {
  produces: ['W', 'U', 'B', 'R', 'G'],
  abilities: [act({ mana: '{4}' }, [{ e: 'animate', what: 'self', p: 4, t: 4 }], '成為4/4生物')],
});
a(256, [etb([{ e: 'surveil', n: 1 }]), act({ mana: '{1}' }, [E('wickermawMana')], '加入一色並成為該色', { oncePerTurn: true })]);
d(257, { ...chosen(), abilities: [staticE('gatheringCost'), etb([E('gathering')]), trig('upkeep', [E('gathering')])] });
d(258, { equip: { cost: '{2}', grant: {} }, abilities: [staticE('crown')] });
a(259, [etb([draw, E('pucaColor')]), act({ mana: '{3}', tap: true }, [draw], '抓牌', { cond: C('vividFive') })]);
a(260, [act({ tap: true, tapN: { filter: { type: 'Creature' }, n: 1 } }, [{ e: 'addManaOfChoice', n: 1 }], '橫置一生物：加任意色')]);
d(261, { equip: { cost: '{2}', grant: { p: 1, t: 1 } }, abilities: [etb([tok('shapeshifter')]), staticE('equippedChangeling')] });
d(263, { ecl: { asEnters: 'tribe8' }, produces: ['C'] });

// Rechecked existing cards against source: counter guards and exact token identities.
d(168, enteredBlight(5, [trig('allyEtb', [{ e: 'removeCounters', what: 'self', n: 1 }], { when: C('hasMinus') })]));
a(18, [act({ mana: '{W}' }, [tok('kithkin')], '放逐此牌：派出奇斯金', { fromGraveyard: true, sorcery: true })]);
a(88, [trig('upkeep', [{ e: 'lose', who: 'you', n: 1 }, tok('faerie')])]);
a(234, [etb([tok('merfolk')])]);
a(243, [act({ mana: '{1}{B/G}' }, [tok('elf')], '放逐此牌：派出精靈', { fromGraveyard: true, sorcery: true })]);
modes(200, [
  { text: '消滅飛行生物', targets: [spec('creature', { kw: 'flying' })], effects: [{ e: 'destroy', what: 'T0' }] },
  { text: '消滅結界', targets: [spec('permanent', { type: 'Enchantment' })], effects: [{ e: 'destroy', what: 'T0' }] },
  { text: '派出精靈', effects: [tok('elf')] },
]);

export function completeEcl() {
  for (const row of catalog) {
    const old = registered.find((c) => c.id === slug(row.name));
    if (old && old.set !== 'ECL') continue;
    const patch = patches.get(row.number);
    if (!old && !patch) throw new Error(`ECL missing ${row.number} ${row.name}`);
    const def = { ...old, ...row, ...patch, id: slug(row.name), text: row.text } as unknown as CardDef;
    if (row.types.includes('Land') && /pay 2 life/.test(row.text)) {
      def.shock = true;
      def.ecl = { asEnters: 'shock' };
      def.produces = (
        {
          'Blood Crypt': ['B', 'R'],
          'Hallowed Fountain': ['W', 'U'],
          'Overgrown Tomb': ['B', 'G'],
          'Steam Vents': ['U', 'R'],
          'Temple Garden': ['G', 'W'],
        } as Record<string, CardDef['produces']>
      )[row.name];
    }
    if (old) Object.assign(old, def);
    else add(def);
  }
}
