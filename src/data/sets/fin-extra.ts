// Complete FIN card definitions; source and verification scope: docs/fin.md.
import catalog from './fin-catalog.json';
import { add, defs, slug, act, etb, trig, CR, MY_CR, OPP_CR, OPP, ANY } from '../dsl';
import type { Ability, Amt, CardDef, Cond, Effect, Filter, Grant, Mode, Ref, TargetSpec, TriggeredAbility } from '../../engine/types';
const patches = new Map<number, Partial<CardDef>>();
const d = (n: number, p: Partial<CardDef>) => patches.set(n, { ...patches.get(n), ...p });
const a = (n: number, abilities: Ability[]) => d(n, { abilities });
const s = (n: number, effects: Effect[], targets?: TargetSpec[]) => d(n, { spell: { effects, targets } });
const E = (action: string, what?: Ref, n?: number): Effect => ({ e: 'fin', action, what, n });
const C = (action: string, n?: number): Cond => ({ c: 'fin', action, n });
const N = (fin: string): Amt => ({ fin });
const F = (fin: string): Ability => ({ kind: 'static', fin });
const event = (name: string, effects: Effect[], extra: Partial<TriggeredAbility> = {}): TriggeredAbility => ({
  kind: 'trigger',
  on: 'finEvent',
  finEvent: name,
  effects,
  ...extra,
});
const spec = (kind: TargetSpec['kind'], filter?: Filter, optional = false): TargetSpec => ({ kind, filter, optional });
const gy = (filter: Filter = {}, optional = false) => spec('gyCard', { ctrl: 'you', ...filter }, optional);
const per: Filter = { nonType: ['Instant', 'Sorcery'] },
  mine: Ref = { all: { ctrl: 'you', type: 'Creature' } },
  others: Ref = { all: { ctrl: 'you', type: 'Creature', other: true } };
const draw: Effect = { e: 'draw', n: 1 },
  gain = (n: Amt): Effect => ({ e: 'gain', n }),
  lose = (n: Amt, who: Ref = 'you'): Effect => ({ e: 'lose', who, n });
const pump = (what: Ref, p: Amt = 0, t: Amt = 0, kw: import('../../engine/types').Keyword[] = []): Effect => ({
  e: 'pump',
  what,
  p,
  t,
  kw,
});
const dmg = (n: Amt, to: Ref = 'T0', from?: Ref): Effect => ({ e: 'damage', n, to, from });
const count = (what: Ref, n: Amt = 1): Effect => ({ e: 'counters', what, n });
const tok = (name: string, n?: Amt): Effect => ({ e: 'token', token: 'tok-fin-' + name, n });
const modes = (n: number, modes: Mode[]) => d(n, { spell: { modes } });
const chapter = (effects: Effect[], targets?: TargetSpec[]) => ({ effects, targets });
const saga = (n: number, chapters: NonNullable<CardDef['saga']>['chapters']) => d(n, { saga: { chapters } });
const back = (n: number, patch: Partial<CardDef>) => d(n, { back: { ...catalog.find((c) => c.number === n)!.back, ...patch } as CardDef });
const xform = (mana: string, tap = true) => act({ mana, tap }, [E('exileBack')], '放逐後以背面進場', { sorcery: true });
const loot: Effect = { e: 'costThen', prompt: '可棄一抓一', cost: { discard: 1 }, then: [draw] };
const lord = (filter: Filter, grant: Grant): Ability => ({ kind: 'static', anthem: { filter: { ctrl: 'you', ...filter }, grant } });
const crew = (n: number, p: number, t: number) => act({ crew: n }, [{ e: 'animate', what: 'self', p, t }], `駕駛${n}`);
function job(n: number, sub: string, cost: string, grant: Grant = {}, trigger?: Ability, abilities?: Ability[]) {
  d(n, {
    fin: { job: sub },
    equip: { cost, grant, trigger: trigger as TriggeredAbility },
    abilities: [etb([E('jobSelect')]), ...(abilities ?? [])],
  });
}
const untap = (what: Ref): Effect => ({ e: 'untap', what });
const reanimate = (what: Ref): Effect => ({ e: 'reanimate', what });
// Colorless and white.
saga(1, [
  chapter([{ e: 'destroy', what: 'T0' }], [spec('permanent', { nonType: 'Land' }, true)]),
  chapter([{ e: 'destroy', what: 'T0' }], [spec('permanent', { nonType: 'Land' }, true)]),
  chapter([{ e: 'draw', n: 2 }]),
  chapter([dmg(N('otherPermanentMV'), 'opp')]),
]);
a(2, [trig('attacks', [E('blightLand')], { targets: [spec('permanent', { type: 'Land' })] }), F('colorlessManaBonus')]);
a(3, [F('steiner')]);
a(4, [
  trig('lifegain', [count('self')]),
  trig('dies', [count({ all: { ctrl: 'you', legendary: true, type: 'Creature' } }, { lkiCounters: true })]),
]);
modes(5, [
  { text: '三個英雄', effects: [tok('hero', 3)] },
  {
    text: '橫置至多三個生物，暈眩其中一個',
    targets: [
      { ...CR, optional: true },
      { ...CR, optional: true },
      { ...CR, optional: true },
    ],
    effects: [E('rescue')],
  },
]);
a(6, [etb([E('ambrosia')]), trig('landfall', [pump('self', 1)])]);
a(7, [trig('attacks', [{ e: 'dig', n: 5, take: 1, rest: 'bottom', filter: { type: 'Artifact' }, optional: true, randomBottom: true }])]);
modes(9, [
  { text: '騎士', effects: [tok('knight')] },
  { text: '+0/+4', targets: [CR], effects: [pump('T0', 0, 4)] },
  { text: '消滅力量4以上', targets: [spec('creature', { powMin: 4 })], effects: [{ e: 'destroy', what: 'T0' }] },
  { text: '獲得4生命', effects: [gain(4)] },
]);
a(10, [etb([{ e: 'tutor', filter: { sub: 'Equipment' } }]), F('cloudDouble')]);
a(12, [
  act({ mana: '{1}{W}', tap: true }, [{ e: 'tap', what: 'T0' }], '橫置非結界生物', {
    targets: [spec('creature', { nonType: 'Enchantment' })],
  }),
]);
d(13, { equip: { cost: '{1}', grant: { p: 1, t: 1 } }, abilities: [xform('{5}{W}{W}', false)] });
back(13, {
  saga: {
    chapters: [
      chapter([E('creatureFog')]),
      chapter([E('creatureFog')]),
      chapter([{ e: 'tap', what: { all: { ctrl: 'opp', type: 'Creature' } } }]),
    ],
  },
});
a(15, [etb([E('delivery')])]);
a(16, [etb([tok('knight')]), lord({ type: 'Creature', sub: 'Knight' }, { kw: ['flying'] }), xform('{4}{W}{W}')]);
d(16, {
  abilities: [
    etb([tok('knight')]),
    {
      kind: 'static',
      condition: { c: 'yourTurn' },
      anthem: { filter: { ctrl: 'you', sub: 'Knight', type: 'Creature' }, grant: { kw: ['flying'] } },
    },
    xform('{4}{W}{W}'),
  ],
});
back(16, {
  saga: {
    chapters: [
      chapter([count(others), pump(others, 0, 0, ['flying'])]),
      chapter([count(others), pump(others, 0, 0, ['flying'])]),
      chapter([{ e: 'destroy', what: 'T0' }, E('returnFront')], [spec('permanent')]),
    ],
  },
});
job(17, 'Knight', '{4}', { p: 1 }, undefined, [F('lanceFlying')]);
s(19, [{ e: 'destroy', what: 'T0' }], [spec('permanent', { nonType: 'Land' })]);
s(20, [E('father')]);
a(21, [trig('allyPermanentDies', [draw], { filter: { type: ['Creature', 'Artifact'] }, oncePerTurn: true })]);
job(23, 'Artificer', '{4}', {}, undefined, [F('arsenal')]);
a(25, [
  { kind: 'static', self: { cond: C('otherArtifact'), grant: { p: 1 } } },
  act(
    { mana: '{2}{W}' },
    [{ e: 'tutor', filter: { name: 'Magitek Infantry' }, to: 'battlefield' }, E('tapTutoredInfantry')],
    '搜尋同名步兵橫置進場',
  ),
]);
job(28, 'Knight', '{4}', { p: 2, t: 1 }, undefined, [F('paladinWard')]);
a(29, [
  act({ mana: '{1}{W}', tap: true, exileSelf: true }, [E('phoenixDownReanimate')], '復活費用4以下生物', {
    targets: [gy({ type: 'Creature', mvMax: 4 })],
  }),
  act({ mana: '{1}{W}', tap: true, exileSelf: true }, [{ e: 'exile', what: 'T0' }], '放逐骷髏、精靈或殭屍', {
    targets: [spec('permanent', { sub: ['Skeleton', 'Spirit', 'Zombie'] })],
  }),
]);
modes(30, [
  { text: 'Cure', targets: [spec('permanent')], effects: [pump('T0', 0, 0, ['hexproof', 'indestructible'])] },
  { text: 'Cura', cost: '{1}{W}', targets: [spec('permanent')], effects: [pump('T0', 0, 0, ['hexproof', 'indestructible']), gain(3)] },
  { text: 'Curaga', cost: '{3}{W}{W}', effects: [pump({ all: { ctrl: 'you' } }, 0, 0, ['hexproof', 'indestructible']), gain(6)] },
]);
a(31, [trig('upkeep', [E('catchFish')])]);
back(31, {
  produces: ['W'],
  abilities: [act({ mana: '{3}', tap: true, sacOther: { type: 'Artifact' } }, [count(mine)], '犧牲神器：全軍指示物', { sorcery: true })],
});
s(32, [dmg(N('creaturesPlusEquipment'))], [CR]);
a(33, [F('snow')]);
a(34, [
  act({ mana: '{2}', tap: true }, [E('donate')], '交予對手後抓牌', { targets: [OPP, spec('permanent', { ctrl: 'you', other: true })] }),
]);
saga(
  35,
  Array.from({ length: 4 }, () => chapter([pump(others, 1)])),
);
saga(36, [...Array.from({ length: 4 }, () => chapter([tok('knight', 3)])), chapter([pump(others, 2, 2), E('indestructibleCounters')])]);
s(38, [{ e: 'destroy', what: { all: { type: ['Artifact', 'Creature'] } } }, E('endTurn')]);
a(39, [
  trig('castAny', [draw], { filter: { legendary: true }, oncePerTurn: true }),
  act(
    { mana: '{7}', tap: true },
    [
      { e: 'exile', what: 'T0' },
      { e: 'transform', what: 'self' },
    ],
    '放逐並轉化',
    { sorcery: true, targets: [spec('permanent', { nonType: 'Land' })] },
  ),
]);
back(39, {
  abilities: [
    trig(
      'combatStart',
      [
        count('T0'),
        { e: 'pump', what: 'T0', p: 0, t: 0, kw: ['indestructible'], untilNext: true },
        { e: 'if', cond: { c: 'targetIs', t: 0, filter: { legendary: true } }, then: [draw] },
      ],
      { targets: [{ ...MY_CR, notSelf: true }] },
    ),
  ],
});
a(40, [
  etb([draw]),
  trig(
    'combatStart',
    [
      {
        e: 'costThen',
        prompt: '支付{1}裝備？',
        cost: { mana: '{1}' },
        then: [{ e: 'reflexive', targets: [spec('permanent', { ctrl: 'you', sub: 'Equipment' }), MY_CR], effects: [E('attachPair')] }],
      },
    ],
    { cond: { c: 'controls', filter: { sub: 'Equipment' } } },
  ),
]);
job(42, 'Cleric', '{3}', { p: 1, t: 1 }, trig('attacks', [gain(1)]));
a(43, [
  { kind: 'static', spellCostLess: { filter: { color: 'W' }, n: 1 } },
  F('doubleLife'),
  act({ mana: '{4}{W}{W}', tap: true }, [pump(mine, 0, 0, ['flying', 'lifelink'])], '全軍飛行繫命'),
]);
d(45, {
  etbCounters: 1,
  abilities: [
    act({ mana: '{1}', sacSelf: true }, [pump('T0', 0, 0, ['indestructible']), E('zackTransfer')], '犧牲：轉移指示物與武具', {
      targets: [MY_CR],
    }),
  ],
});
// Blue.
job(46, 'Wizard', '{2}', {}, event('planisphere', [count('self')]));
d(47, { produces: ['C'], manaOnly: 'artifactOrAbility', abilities: [crew(1, 2, 2)] });
s(48, [{ e: 'draw', n: 2, who: 'T0' }, count('T1')], [spec('player'), { ...MY_CR, optional: true }]);
a(51, [etb([{ e: 'draw', n: { count: { ctrl: 'you', type: 'Artifact' } } }]), F('coinHeads')]);
d(52, { uncounterable: true });
a(53, [act({ tap: true, exileSelf: true }, [{ e: 'addMana', mana: ['U'] }, E('nextCopy', undefined, 1)], '放逐：加藍並複製下個咒語')]);
a(54, [act({ mana: '{X}{X}', tap: true }, [E('copyAbility')], '複製你的起動或觸發異能X次', { xMana: 2, xMin: 1, finStack: 'ownAbility' })]);
a(55, [etb([{ e: 'stun', what: 'T0' }], { targets: [spec('permanent', { ctrl: 'opp', type: ['Artifact', 'Creature'] })] })]);
modes(56, [
  { text: 'Blizzard', targets: [CR], effects: [{ e: 'bounce', what: 'T0' }] },
  { text: 'Blizzara', cost: '{3}{U}', targets: [CR], effects: [{ e: 'topOrBottom', what: 'T0' }] },
  { text: 'Blizzaga', cost: '{6}{U}{U}', targets: [CR], effects: [E('shuffleTarget')] },
]);
a(58, [etb([{ e: 'bounce', what: 'T0' }], { targets: [spec('permanent', { nonType: 'Land', other: true }, true)] }), xform('{3}{U}{U}')]);
back(58, {
  saga: {
    chapters: [
      chapter([pump('T0', 0, 0, ['unblockable'])], [CR]),
      chapter([pump('T0', 0, 0, ['unblockable'])], [CR]),
      chapter([{ e: 'tap', what: { all: { ctrl: 'opp', type: 'Land' } } }, E('returnFront')]),
    ],
  },
});
modes(59, [
  { text: '另付{2}', cost: '{2}{U}', effects: [E('counterStack')] },
  { text: '犧牲傳奇生物', sac: { type: 'Creature', legendary: true }, effects: [E('counterStack')] },
]);
d(59, { fin: { stackTarget: 'nonCreatureSpellOrAbility' } });
a(60, [crew(1, 3, 3), F('whaleTop')]);
a(62, [trig('scry', [draw])]);
s(63, [E('memories')]);
a(64, [crew(2, 3, 4), trig('castNoncreature', [{ e: 'animate', what: 'self', p: 3, t: 4 }], { cond: C('manaSpent', 4) })]);
a(65, [
  act({ mana: '{1}', tap: true }, [draw, { e: 'discard', who: 'you', n: 1 }], '抓一棄一'),
  act({ mana: '{7}', tap: true, sacSelf: true }, [{ e: 'draw', n: 3 }], '犧牲：抓三', { costLessPer: { sub: 'Town' } }),
]);
a(66, [etb([E('quistis')], { targets: [spec('gyCard', { type: ['Instant', 'Sorcery'] })] })]);
s(67, [{ e: 'copyCreature', what: 'T0' }], [spec('permanent', { type: ['Artifact', 'Creature', 'Land'] })]);
s(68, [tok('robot'), { e: 'if', cond: C('fromGraveyard'), then: [count('created', 2)] }]);
a(69, [trig('allyPermEtb', [loot], { filter: { type: 'Artifact' } })]);
job(70, 'Cleric', '{3}', { p: 1 }, trig('attacks', [untap('T0')], { targets: [spec('creature', { attacking: true })] }));
a(71, [trig('castNoncreature', [count('self'), pump('self', 0, 0, ['unblockable'])], { cond: C('manaSpent', 4) })]);
a(72, [{ kind: 'static', self: { cond: { c: 'controls', filter: { type: 'Land' }, n: 7 }, grant: { p: 3 } } }]);
d(74, {
  aura: { target: CR, grant: { noUntap: true } },
  abilities: [etb([{ e: 'tap', what: 'attached' }]), event('enchantedDamaged', [E('sacSelf')])],
});
s(75, [E('stolenUniform')], [MY_CR, spec('permanent', { sub: 'Equipment' })]);
d(76, {
  aura: { target: spec('permanent', { type: ['Artifact', 'Creature'] }), grant: { noUntap: true } },
  abilities: [etb([{ e: 'tap', what: 'attached' }]), F('disableAttached')],
});
saga(77, [chapter([E('leviathanBounce')]), chapter([E('seaDraw')]), chapter([E('seaDraw')])]);
saga(78, [
  chapter([{ e: 'stun', what: 'T0' }], [OPP_CR]),
  chapter([{ e: 'stun', what: 'T0' }], [OPP_CR]),
  chapter([{ e: 'draw', n: { count: { ctrl: 'opp', type: 'Creature', tapped: true } } }]),
]);
s(79, [{ e: 'surveil', n: 2 }, E('swallowed')], [spec('spell')]);
s(80, [E('syncopate')], [spec('spell')]);
job(81, 'Rogue', '{4}', { p: 1, t: 1 }, trig('combatDamagePlayer', [draw]));
d(82, { costReduce: { perCount: { sub: 'Town' } }, spell: { effects: [{ e: 'draw', n: 4 }] } });
a(83, [
  trig('castNoncreature', [{ e: 'stun', what: 'T0' }], { cond: C('manaSpent', 4), targets: [OPP_CR] }),
  trig('castNoncreature', [count('self', 8)], { cond: C('manaSpent', 8) }),
]);
a(85, [
  { kind: 'static', spellCostLess: { filter: { color: 'U' }, n: 1 } },
  F('millBonus'),
  act({ mana: '{4}{U}{U}', tap: true }, [{ e: 'mill', n: { hand: true }, who: 'opp' }], '對手磨手牌數量'),
]);
a(86, [trig('endStep', [{ e: 'flicker', what: 'T0' }, E('extraEnd')], { targets: [MY_CR] })]);
// Black.
a(88, [
  trig('allyPermanentDies', [lose(1, 'T0'), gain(1)], { filter: { type: ['Creature', 'Artifact'] }, includeSelf: true, targets: [OPP] }),
]);
a(89, [
  lord({ sub: 'Demon', type: 'Creature' }, { kw: ['menace', 'lifelink', 'haste'] }),
  trig('combatStart', [E('ardyn')], { targets: [spec('gyCard', { type: 'Creature' }, true)] }),
]);
job(90, 'Wizard', '{3}', { p: 1 }, trig('castNoncreature', [dmg(1, 'opp')]));
a(91, [event('cecilDamage', [E('cecil')])]);
back(91, {
  abilities: [trig('attacks', [pump({ all: { ctrl: 'you', type: 'Creature', attacking: true, other: true } }, 0, 0, ['indestructible'])])],
});
s(92, [{ e: 'draw', n: 2 }, lose(2), tok('wizard'), pump({ all: { ctrl: 'you', type: 'Creature', sub: 'Wizard' } }, 1, 0, ['lifelink'])]);
job(95, 'Knight', '', { p: 3 });
d(95, {
  equip: { cost: '', manual: true, grant: { p: 3 } },
  abilities: [
    etb([E('jobSelect')]),
    act({ life: 3 }, [{ e: 'attach', what: 'T0' }], '支付3生命裝備', { sorcery: true, oncePerTurn: true, isEquip: true, targets: [MY_CR] }),
  ],
});
a(96, [
  { kind: 'static', spellCostLess: { filter: { color: 'B' }, n: 1 } },
  F('darkness'),
  act({ mana: '{4}{B}{B}', tap: true }, [E('darknessReturn')], '取回此水晶放逐的生物'),
]);
a(97, [
  { kind: 'static', self: { cond: { c: 'selfCounters', n: 1 }, grant: { ignoreDefender: true } } },
  act({ mana: '{5}{B}' }, [count('self', 2)], '兩個指示物'),
]);
a(99, [event('graveLeaves', [draw, lose(1)], { oncePerTurn: true })]);
s(101, [E('finalDays')]);
a(102, [
  etb([], {
    modes: [
      { text: '犧牲生物衍生物', effects: [E('edictEachToken')] },
      { text: '犧牲非衍生生物', effects: [E('edictEachNontoken')] },
      { text: '犧牲結界', effects: [E('edictEachEnchantment')] },
    ],
  }),
]);
a(104, [trig('combatDamagePlayer', [E('jecht')])]);
back(104, {
  saga: {
    chapters: [
      chapter([{ e: 'discard', who: 'opp', n: 1 }, draw]),
      chapter([{ e: 'discard', who: 'opp', n: 1 }, draw]),
      chapter([
        { e: 'edict', who: 'opp' },
        { e: 'edict', who: 'opp' },
      ]),
    ],
  },
});
a(105, [{ kind: 'static', self: { cond: { c: 'yourTurn' }, grant: { kw: ['flying'] } } }, trig('combatDamagePlayer', [E('kain')])]);
a(106, [etb([{ e: 'discard', who: 'opp', n: 1 }, lose(2, 'opp'), E('exileOpponentTop', undefined, 3)])]);
a(107, [
  etb([lose(1), { e: 'token', token: 'tok-treasure' }]),
  trig('attacks', [
    {
      e: 'costThen',
      prompt: '犧牲另一生物或神器刺探2？',
      cost: { sac: { other: true, type: ['Creature', 'Artifact'] } },
      then: [{ e: 'surveil', n: 2 }],
    },
  ]),
]);
job(108, 'Ninja', '{2}', { p: 1, t: 1 }, trig('combatDamagePlayer', [E('ninjaLoot')]));
a(110, [
  act(
    { sacOther: { type: ['Artifact', 'Creature'] } },
    [count('self'), { e: 'animate', what: 'self', p: 3, t: 3 }, E('spiritUntilEnd')],
    '犧牲：加指示物並變生物',
  ),
]);
modes(111, [
  { text: '全體−1/−1', effects: [pump({ all: { type: 'Creature' } }, -1, -1)] },
  {
    text: '棄神器或生物',
    targets: [spec('player')],
    effects: [{ e: 'discardChosen', who: 'T0', filter: { type: ['Artifact', 'Creature'] } }],
  },
]);
a(112, [
  etb([], {
    modes: [
      { text: '消滅受傷生物', targets: [spec('creature', { damaged: true })], effects: [{ e: 'destroy', what: 'T0' }] },
      {
        text: '放逐同墳墓場至多兩張',
        targets: [spec('gyCard', {}, true), { ...spec('gyCard', {}, true), sameGraveyardAs: 0 }],
        effects: [E('qutrubExile')],
      },
    ],
  }),
]);
a(113, [trig('combatDamagePlayer', [E('reno')])]);
s(114, [{ e: 'dig', n: 3, take: 1, rest: 'graveyard' }]);
a(115, [
  etb([{ e: 'costThen', prompt: '犧牲另一生物抓牌？', cost: { sac: { type: 'Creature', other: true } }, then: [draw] }]),
  trig('attacks', [{ e: 'costThen', prompt: '犧牲另一生物抓牌？', cost: { sac: { type: 'Creature', other: true } }, then: [draw] }]),
  event('otherCreatureDies', [lose(1, 'T0'), gain(1), E('sephirothCount')], { targets: [OPP] }),
]);
back(115, { abilities: [trig('transformed', [E('sephirothEmblem')]), trig('attacks', [E('sephirothSac')])] });
a(117, [
  trig(
    'castNoncreature',
    [{ e: 'costThen', prompt: '支付{B}取回此牌？', cost: { mana: '{B}' }, then: [{ e: 'toHand', what: 'selfAny' }] }],
    { fromGraveyard: true },
  ),
]);
a(118, [etb([{ e: 'mill', n: 3 }, gain(3)])]);
a(119, [
  etb([{ e: 'destroy', what: 'T0' }], { targets: [{ ...CR, optional: true }] }),
  trig(
    'endStep',
    [
      { e: 'token', token: 'tok-treasure' },
      { e: 'if', cond: { c: 'controls', filter: { sub: 'Treasure' }, n: 3 }, then: [{ e: 'transform', what: 'self' }] },
    ],
    { cond: C('opponentCreatureDied') },
  ),
]);
back(119, {
  abilities: [
    act(
      { mana: '{1}{B}', sacOther: { type: ['Creature', 'Artifact'] } },
      [pump('self', 0, 0, ['indestructible']), { e: 'tap', what: 'self' }],
      '犧牲：不滅並橫置',
    ),
  ],
});
saga(120, [...Array.from({ length: 3 }, () => chapter([draw, lose(1)])), chapter([{ e: 'edict', who: 'opp' }, lose(3, 'opp')])]);
saga(121, [
  chapter([{ e: 'destroy', what: 'T0' }], [OPP_CR]),
  chapter([E('odinGrant')]),
  chapter([{ e: 'draw', n: 2 }, lose(2, 'players')]),
]);
d(122, {
  etbTapped: true,
  abilities: [etb([E('stunSelf')]), { kind: 'static', self: { cond: { c: 'yourTurn' }, grant: { kw: ['first_strike', 'deathtouch'] } } }],
});
a(123, [trig('dies', [{ e: 'token', token: 'tok-treasure' }])]);
modes(124, [
  { text: '−2/−2', targets: [CR], effects: [pump('T0', -2, -2)] },
  { text: '犧牲神器或生物：−6/−6', sac: { type: ['Artifact', 'Creature'] }, targets: [CR], effects: [pump('T0', -6, -6)] },
]);
a(125, [
  event('opponentCreatureDies', [E('vincentCounters')]),
  trig('attacks', [{ e: 'may', prompt: '轉化Vincent？', effects: [{ e: 'transform', what: 'self' }] }]),
]);
back(125, { abilities: [trig('dies', [E('returnFrontTapped')])] });
modes(126, [
  ...[
    ['Galian Beast', 0, 3],
    ['Death Gigas', 1, 5],
    ['Hellmasker', 3, 7],
  ].map(([text, n, p]) => ({
    text: String(text),
    cost: n ? `{${n}}{1}{B}` : '{1}{B}',
    targets: [MY_CR],
    effects: [{ e: 'setBase', what: 'T0', p: Number(p), t: 2 }, E('vincentReturn')] as Effect[],
  })),
]);
a(127, [etb([E('zenos')]), event('chosenLeaves', [{ e: 'transform', what: 'self' }])]);
a(128, [etb([E('zodiark')]), event('otherSacrificeCreature', [count('self')])]);
// Red.
a(129, [trig('attacks', [dmg({ count: { ctrl: 'you', type: 'Creature', equipped: true } }, 'opp')])]);
a(130, [
  trig('castNoncreature', [count('self')], { cond: C('manaSpent', 4) }),
  act({ tap: true, sacSelf: true }, [dmg({ power: 'self' })], '犧牲：依力量傷害', { sorcery: true, targets: [CR] }),
]);
s(131, [{ e: 'tutor', filter: { type: 'Land', sub: 'Mountain' } }, tok('bird')]);
s(132, [dmg({ x: true }), tok('bird')], [ANY]);
a(133, [etb([E('cliveWheel')]), xform('{4}{R}{R}')]);
back(133, {
  saga: {
    chapters: [
      chapter([{ e: 'fight', a: 'self', b: 'T0' }], [{ ...CR, notSelf: true, optional: true }]),
      chapter([{ e: 'addMana', mana: ['R', 'R', 'R', 'R'] }, E('ifritReturn')]),
      chapter([{ e: 'addMana', mana: ['R', 'R', 'R', 'R'] }, E('returnFront')]),
    ],
  },
});
a(135, [
  { kind: 'static', spellCostLess: { filter: { color: 'R' }, n: 1 } },
  lord({ type: 'Creature' }, { kw: ['haste'] }),
  act({ mana: '{4}{R}{R}', tap: true }, [{ e: 'copyCreature', what: 'T0', temp: true }], '複製生物', { targets: [MY_CR] }),
]);
modes(
  136,
  [1, 2, 3].map((n, i) => ({
    text: ['Fire', 'Fira', 'Firaga'][i],
    cost: ['{R}', '{2}{R}', '{5}{R}'][i],
    effects: [dmg(n, { all: { type: 'Creature' } })],
  })),
);
a(137, [
  lord({ type: 'Creature', equipped: true }, { kw: ['haste'] }),
  trig('allyPermEtb', [E('firionCopy')], { filter: { sub: 'Equipment', token: false } }),
]);
d(138, { abilities: [{ kind: 'static', self: { cond: { c: 'yourTurn' }, grant: { kw: ['flying'] } } }, F('freyaMana')] });
a(139, [etb([E('gilgamesh')]), trig('attacks', [E('gilgamesh')])]);
s(140, [pump('T0', 3, 1, ['haste']), E('impulseNextEnd', undefined, 1)], [CR]);
a(142, [
  trig('youAttack', [pump('T0', 0, 0, ['menace'])], { targets: [spec('creature', { ctrl: 'you', attacking: true, equipped: true })] }),
]);
d(143, { addCost: { discard: 1 }, spell: { effects: [{ e: 'draw', n: 2 }] } });
s(144, [dmg(6), E('breakEquipment')], [CR]);
s(146, [E('nibelheim')], [MY_CR]);
modes(147, [
  { text: '放逐兩張，可使用至下個結束步驟', effects: [E('impulseNextEnd', undefined, 2)] },
  { text: '一至兩生物+2/+0', targets: [CR, { ...CR, optional: true }], effects: [pump('T0', 2), pump('T1', 2)] },
]);
a(148, [trig('castNoncreature', [{ e: 'token', token: 'tok-treasure' }], { cond: C('manaSpent', 4) })]);
a(149, [trig('attacks', [tok('wizard')])]);
s(150, [E('randomEncounter')]);
d(151, {
  fin: { wardPower: true },
  abilities: [
    trig('attacks', [E('attachPair')], {
      targets: [spec('permanent', { ctrl: 'you', sub: 'Equipment' }, true), spec('creature', { attacking: true })],
    }),
  ],
});
job(152, 'Wizard', '{3}', {}, trig('castNoncreature', [pump('self', 2)]));
job(154, 'Samurai', '{5}', { p: 2, t: 2, kw: ['trample', 'haste'] });
a(155, [
  etb(
    [
      { e: 'destroy', what: 'T0' },
      { e: 'searchLand', to: 'battlefield', tapped: true, who: 'T0ctrl', may: true },
    ],
    { targets: [spec('permanent', { type: 'Land' })] },
  ),
]);
a(156, [
  trig('youAttack', [pump('trig', 0, 0, ['double_strike'])], { alone: true }),
  trig('combatDamagePlayer', [E('seifer')], { targets: [gy({ type: ['Instant', 'Sorcery'], mvMax: 3 })] }),
]);
s(157, [E('selfDestruct')], [MY_CR, ANY]);
a(158, [
  trig('combatStart', [pump('T0', 2)], { targets: [MY_CR] }),
  event('endCombat', [E('blitzballTransform')], { cond: C('combatSix') }),
]);
back(158, { equip: { cost: '{3}', grant: { p: 2, kw: ['double_strike'] } } });
s(159, [E('sorceressSchemes'), { e: 'addMana', mana: ['R'] }]);
saga(160, [chapter([E('brynhildrExile')]), chapter([E('nextHaste')]), chapter([E('nextHaste')])]);
saga(161, [
  chapter([dmg(N('graveNonCreatureNonland'))], [OPP_CR]),
  chapter([pump({ all: { ctrl: 'you', sub: 'Wizard' } }, 1)]),
  chapter([pump({ all: { ctrl: 'you', sub: 'Wizard' } }, 1)]),
]);
saga(162, [chapter([{ e: 'surveil', n: 1 }]), chapter([E('nextCopy', undefined, 1)]), chapter([E('nextCopy', undefined, 2)])]);
saga(163, [chapter([loot]), chapter([loot]), chapter([{ e: 'addMana', mana: ['R'] }]), chapter([{ e: 'addMana', mana: ['R'] }])]);
modes(164, [
  { text: '3傷害，死去改放逐', targets: [CR], effects: [{ e: 'exileIfDies', what: 'T0' }, dmg(3)] },
  { text: '放逐神器', targets: [spec('permanent', { type: 'Artifact' })], effects: [{ e: 'exile', what: 'T0' }] },
]);
modes(
  165,
  [2, 4, 8].map((n, i) => ({
    text: ['Thunder', 'Thundara', 'Thundaga'][i],
    cost: ['{R}', '{3}{R}', '{5}{R}{R}'][i],
    targets: [CR],
    effects: [dmg(n)],
  })),
);
a(166, [trig('upkeep', [E('tripleTriad')])]);
s(167, [E('unexpected')], [CR]);
a(168, [event('vaanCombat', [E('vaan')]), event('castUnowned', [count({ all: { ctrl: 'you', sub: ['Scout', 'Pirate', 'Rogue'] } })])]);
job(169, 'Warrior', '{5}', { p: 3, t: 2 });
a(170, [{ kind: 'static', extraLand: 1 }, F('zell'), trig('endStep', [E('returnLand')])]);
// Green.
a(172, [F('adamantoise'), trig('dies', [E('adamantoiseDies')])]);
job(174, 'Bard', '{6}', { p: 2, t: 2, kw: ['reach'] });
d(175, { costReduce: { perCount: { sub: 'Bird' } }, abilities: [etb([E('bartz')], { targets: [OPP_CR] })] });
a(177, [trig('endStep', [{ e: 'bounce', what: 'self' }], { cond: C('notEntered') })]);
modes(178, [
  { text: '造成力量傷害', targets: [MY_CR, OPP_CR], effects: [{ e: 'bite', a: 'T0', b: 'T1' }] },
  { text: '收回一地：兩倍力量', targets: [MY_CR, OPP_CR], effects: [E('chocoboKick')] },
]);
d(178, { fin: { returnLandCost: true } });
a(179, [trig('landfall', [tok('bird')])]);
{
  const base: Mode[] = [
    { text: '互鬥', targets: [MY_CR, OPP_CR], effects: [{ e: 'fight', a: 'T0', b: 'T1' }] },
    { text: '移除傳紀指示物', targets: [spec('permanent', { ctrl: 'you', sub: 'Saga' })], effects: [E('removeLore')] },
    { text: '增加傳紀指示物', targets: [spec('permanent', { ctrl: 'you', sub: 'Saga' })], effects: [E('addLore')] },
  ];
  const out: Mode[] = [];
  for (let mask = 1; mask < 8; mask++) {
    const effects: Effect[] = [],
      targets: TargetSpec[] = [],
      texts: string[] = [];
    for (let i = 0; i < 3; i++)
      if (mask & (1 << i)) {
        const offset = targets.length;
        const shift = (x: unknown): unknown =>
          typeof x === 'string' && /^T\d$/.test(x)
            ? 'T' + (Number(x[1]) + offset)
            : Array.isArray(x)
              ? x.map(shift)
              : x && typeof x === 'object'
                ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shift(v)]))
                : x;
        effects.push(...(shift(base[i].effects) as Effect[]));
        targets.push(...(base[i].targets ?? []).map((t) => ({ ...t, allowRepeat: true })));
        texts.push(base[i].text);
      }
    out.push({ text: texts.join('；'), effects, targets });
  }
  modes(180, out);
}
a(181, [
  etb([], {
    modes: [
      {
        text: '消滅神器或結界',
        targets: [spec('permanent', { type: ['Artifact', 'Enchantment'] })],
        effects: [{ e: 'destroy', what: 'T0' }],
      },
      { text: '抓牌', effects: [draw] },
    ],
  }),
]);
s(182, [{ e: 'dig', n: 3, take: 1, rest: 'bottom', optional: true, filter: { type: ['Artifact', 'Creature', 'Land'] } }]);
d(183, { costReduce: { perGy: per }, abilities: [F('preventCombat')] });
a(184, [
  { kind: 'static', spellCostLess: { filter: { color: 'G' }, n: 1 } },
  F('doubleCounters'),
  act({ mana: '{4}{G}{G}', tap: true }, [E('earthDistribute')], '分配兩個指示物', { targets: [MY_CR, { ...MY_CR, optional: true }] }),
]);
d(185, { flashbackTransform: true, spell: { effects: [{ e: 'surveil', n: 2 }, gain(2), E('esperFinality')] } });
back(185, {
  saga: {
    chapters: [chapter([E('maduinReveal')]), chapter([{ e: 'addMana', mana: ['G', 'G'] }]), chapter([pump(others, 2, 2, ['trample'])])],
  },
});
s(186, [pump('T0', 1), E('galuf')], [CR]);
a(189, [act({ mana: '{8}' }, [pump('self', N('gravePermanents'), N('gravePermanents'))], '依永久物墳墓場加成')]);
s(190, [tok('bird')]);
s(193, [E('prishes')]);
a(194, [F('extraFrog'), act({ mana: '{2}', sacOther: { sub: 'Frog' } }, [count('self')], '犧牲青蛙：指示物')]);
s(195, [E('reachHorizon')]);
a(196, [{ kind: 'static', manaGrant: { filter: { ctrl: 'you', other: true }, colors: ['W', 'U', 'B', 'R', 'G'] } }]);
a(197, [
  trig('landfall', [count('T0')], { targets: [MY_CR] }),
  act({ mana: '{5}{G}{G}' }, [E('permanentAnimate', undefined, 7)], '成為7/7野獸'),
]);
modes(198, [
  { text: '全軍+3/+3', effects: [pump(mine, 3, 3)] },
  {
    text: '取回至多兩永久物',
    targets: [gy(per, true), gy(per, true)],
    effects: [
      { e: 'toHand', what: 'T0' },
      { e: 'toHand', what: 'T1' },
    ],
  },
]);
a(199, [
  etb([{ e: 'tutor', filter: { or: [{ sub: 'Bird' }, { type: 'Land', basic: true }] } }], { may: '可搜尋鳥或基本地？' }),
  trig('attacks', [count('T0'), { e: 'doubleCounters', what: 'T0' }], { targets: [CR] }),
]);
a(201, [
  etb([tok('bird')]),
  trig('firstMain', [{ e: 'transform', what: 'self' }], { cond: { c: 'controls', filter: { sub: 'Bird' }, n: 4 } }),
]);
back(201, {
  abilities: [
    trig('transformed', [{ e: 'tutor', filter: { type: 'Land' }, to: 'battlefield' }, E('tapLastLand')]),
    trig('landfall', [pump({ all: { ctrl: 'you', sub: 'Bird', type: 'Creature' } }, 1)]),
  ],
});
modes(207, [
  { text: 'Somersault', targets: [CR], effects: [pump('T0', 2, 2)] },
  { text: 'Meteor Strikes', cost: '{2}{G}', targets: [CR], effects: [E('multiplyPT', 'T0', 2)] },
  { text: 'Final Heaven', cost: '{6}{G}{G}', targets: [CR], effects: [E('multiplyPT', 'T0', 3)] },
]);
saga(202, [chapter([tok('bird')]), ...Array.from({ length: 3 }, () => chapter([pump(mine, 0, 0, ['trample'])]))]);
saga(203, [
  chapter([{ e: 'searchLand', to: 'battlefield', tapped: true }]),
  chapter([E('nextCounter')]),
  chapter([{ e: 'if', cond: C('greatestPower'), then: [draw] }]),
]);
saga(204, [
  chapter([{ e: 'mill', n: 5 }]),
  chapter([E('titanLands')]),
  chapter(
    [pump('T0', { count: { ctrl: 'you', type: 'Land' } }, { count: { ctrl: 'you', type: 'Land' } }, ['trample'])],
    [{ ...MY_CR, notSelf: true }],
  ),
]);
job(205, 'Shaman', '{4}', {}, trig('attacks', [E('grimoire')]));
a(206, [trig('landfall', [E('tifaDouble')])]);
d(208, {
  produces: ['W', 'U', 'B', 'R', 'G'],
  abilities: [trig('castAny', [E('torgalEnter')], { filter: { type: 'Creature', sub: 'Human' }, when: C('firstHuman') })],
});
a(209, [etb([{ e: 'mill', n: 4 }, E('townGreeter')])]);
a(210, [F('travelingTop'), F('travelingDouble')]);
a(211, [etb([{ e: 'mill', n: 2 }, E('vanilleReturn')]), trig('firstMain', [E('meld')])]);
back(211, {
  abilities: [
    trig('dies', [{ e: 'destroy', what: 'T0' }, reanimate('T1')], { targets: [spec('permanent'), gy({ ...per, legendary: false })] }),
  ],
});
d(211, { fin: { meld: true } });
// Multicolor.
d(212, { uncounterable: true, abilities: [F('playerProtection')] });
a(213, [lord({ sub: 'Vehicle' }, { p: 1, t: 1, kw: ['vigilance', 'reach'] }), event('balthierCombat', [E('balthier')])]);
a(215, [event('birdsAttack', [E('chocoDig')]), trig('landfall', [pump('self', 1)])]);
a(216, [F('cid')]);
d(216, { anyNumber: true });
a(217, [etb([pump('T0', { negOf: N('gravePermanents') }, { negOf: N('gravePermanents') })], { targets: [OPP_CR] })]);
a(218, [
  etb([draw, { e: 'discard', who: 'you', n: 1 }]),
  trig('attacks', [draw, { e: 'discard', who: 'you', n: 1 }]),
  trig('upkeep', [{ e: 'may', prompt: '轉化為Hades？', effects: [{ e: 'transform', what: 'self' }] }], {
    cond: { c: 'gyCount', filter: {}, n: 14 },
  }),
]);
back(218, { abilities: [F('hadesCast'), F('hadesExile')] });
a(219, [
  F('emperorMana'),
  trig('castNoncreature', [count('self'), { e: 'if', cond: { c: 'selfCounters', n: 3 }, then: [{ e: 'transform', what: 'self' }] }], {
    cond: C('manaSpent', 4),
  }),
]);
back(219, { abilities: [trig('attacks', [dmg(N('graveNonCreatureNonland'), 'opp')])] });
a(220, [etb([gain(3)]), trig('endStep', [{ e: 'transform', what: 'self' }], { cond: C('gravePermanents', 6) })]);
back(220, { abilities: [F('exdeathPower')] });
a(221, [
  trig('castNoncreature', [{ e: 'surveil', n: 1 }]),
  act({ mana: '{3}{B}{B}{R}{R}' }, [E('exileBack')], '墳墓場返回背面', { fromGraveyard: true, keepSelf: true, sorcery: true }),
]);
back(221, { abilities: [trig('dies', [E('chaosBottom')])] });
a(222, [trig('attacks', [E('garnet')])]);
a(223, [etb([loot]), trig('allyPermEtb', [loot], { filter: { sub: ['Dwarf', 'Equipment'] } })]);
a(224, [
  etb([{ e: 'tutor', filter: { type: 'Land' }, to: 'battlefield' }, E('tapLastLand')]),
  trig('landfall', [pump('T0', 2, 2, ['trample'])], { targets: [{ ...MY_CR, notSelf: true }] }),
]);
a(225, [
  trig('allyPermEtb', [{ e: 'surveil', n: 1 }], { filter: { type: 'Artifact' } }),
  trig('endStep', [E('golbez')], { cond: { c: 'controls', filter: { type: 'Artifact' }, n: 4 }, targets: [gy({ type: 'Creature' })] }),
]);
a(226, [trig('endStep', [{ e: 'mill', who: 'opp', n: { lifeGained: true } }])]);
a(227, [
  etb([E('ignisLand')]),
  act({ mana: '{1}{G}{U}', tap: true }, [E('ignisFood')], '放逐墳墓場牌，生物則派食物', { targets: [spec('gyCard')] }),
]);
a(228, [
  trig('combatStart', [count('T0', { power: 'self' }), E('makeMutant')], {
    targets: [{ ...CR, filter: { ctrl: 'you' }, notSelf: true, optional: true }],
  }),
  trig('allyDies', [{ e: 'draw', n: { ev: true } }], { filter: { sub: 'Mutant' }, includeSelf: true, cond: { c: 'yourTurn' } }),
]);
a(229, [etb([E('joshuaLoot')]), xform('{3}{R}{W}')]);
back(229, {
  saga: {
    chapters: [
      chapter([dmg(2, 'opp')]),
      chapter([dmg(2, 'opp')]),
      { effects: [E('phoenixMassReturn'), E('returnFront')], finDynamic: true },
    ],
  },
});
a(230, [trig('allyPermanentDies', [count('self')], { filter: { type: ['Creature', 'Artifact'] } })]);
a(231, [
  etb([E('kefkaDiscard')]),
  trig('attacks', [E('kefkaDiscard')]),
  act({ mana: '{8}' }, [E('opponentEdictPermanent'), { e: 'transform', what: 'self' }], '對手犧牲永久物並轉化', { sorcery: true }),
]);
back(231, { abilities: [event('opponentLifeLoss', [{ e: 'draw', n: { ev: true } }], { cond: { c: 'yourTurn' } })] });
a(232, [
  trig('endStep', [
    { e: 'token', token: 'tok-fin-wizard', tapped: true },
    { e: 'if', cond: { c: 'controls', filter: { sub: 'Wizard' }, n: 4 }, then: [{ e: 'transform', what: 'self' }] },
  ]),
]);
back(232, { abilities: [F('doubleWizardDamage')] });
a(233, [trig('combatDamagePlayer', [E('lightningDouble')])]);
a(235, [F('noctisCast')]);
a(236, [
  etb([{ e: 'stun', what: 'T0', n: N('nonbasicLands') }, gain(N('nonbasicLands'))], {
    targets: [spec('permanent', { ctrl: 'opp', nonType: 'Land' }, true)],
  }),
]);
a(237, [
  etb([tok('angelo')]),
  trig('attacks', [pump('T0', { count: { ctrl: 'you', type: 'Creature' } }, { count: { ctrl: 'you', type: 'Creature' } })], {
    targets: [{ ...MY_CR, notSelf: true }],
  }),
]);
a(238, [trig('attacks', [{ e: 'if', cond: C('noDarkstar'), then: [tok('darkstar')] }])]);
a(239, [
  trig('landfall', [loot]),
  act({ mana: '{X}', tap: true }, [E('rydiaReturn')], 'X費用傳紀返回並帶終命與敏捷', {
    sorcery: true,
    xMana: 1,
    targets: [gy({ sub: 'Saga' })],
  }),
]);
a(240, [
  F('firstLegendDiscount'),
  trig('combatStart', [{ e: 'may', prompt: '轉化Serah？', effects: [{ e: 'transform', what: 'self' }] }], { cond: C('otherLegends', 2) }),
]);
back(240, { abilities: [F('firstLegendDiscount'), lord({ type: 'Creature', legendary: true }, { p: 2, t: 2 })] });
a(241, [trig('castNoncreature', [pump('self', N('manaSpent')), { e: 'if', cond: C('manaSpent', 4), then: [draw] }])]);
a(242, [etb([E('sin')]), trig('attacks', [E('sin')])]);
a(243, [
  trig('youAttack', [pump('trig', 0, 0, ['double_strike'])], { alone: true }),
  trig('combatDamagePlayer', [reanimate('T0')], { targets: [gy({ ...per, mvMax: 3 })] }),
]);
a(244, [
  trig('castNoncreature', [
    tok('hero'),
    { e: 'if', cond: C('manaSpent', 4), then: [{ e: 'draw', n: 2 }] },
    { e: 'if', cond: C('manaSpent', 8), then: [E('tellahSac'), dmg(N('manaSpent'), 'opp')] },
  ]),
]);
a(245, [etb([{ e: 'mill', n: 5 }, E('terraMilled')]), xform('{4}{R}{G}')]);
back(245, {
  saga: {
    chapters: [
      ...Array.from({ length: 3 }, () =>
        chapter([E('terraCopy')], [spec('permanent', { ctrl: 'you', type: 'Enchantment', legendary: false })]),
      ),
      chapter([{ e: 'addMana', mana: ['W', 'W', 'U', 'U', 'B', 'B', 'R', 'R', 'G', 'G'] }, E('returnFront')]),
    ],
  },
});
a(246, [
  trig('allyPermEtb', [count('self')], { filter: { type: 'Artifact' } }),
  trig('attacks', [{ e: 'tap', what: 'T0' }], { targets: [OPP_CR] }),
]);
a(247, [etb([{ e: 'surveil', n: 2 }]), trig('attacks', [{ e: 'surveil', n: 2 }]), trig('endStep', [E('ultimeciaCost')])]);
back(247, { abilities: [trig('transformed', [E('extraTurn')])] });
a(248, [
  act({}, [E('viviMana')], '依力量加藍紅', { duringYourTurn: true, oncePerTurn: true }),
  trig('castNoncreature', [count('self'), dmg(1, 'opp')]),
]);
a(249, [
  F('landsUntapped'),
  trig('combatStart', [tok('elemental')], { cond: { c: 'controls', filter: { sub: 'Town' }, n: 5 } }),
  act(
    { mana: '{3}{W}{U}{B}{R}{G}' },
    [pump(others, { count: { ctrl: 'you', sub: 'Town' } }, { count: { ctrl: 'you', sub: 'Town' } })],
    '其他生物依城鎮數加成',
  ),
]);
a(250, [F('yunaKeywords'), trig('endStep', [E('yunaReturn')], { targets: [gy({ type: 'Enchantment' }, true)] })]);
a(251, [etb([E('zidaneSteal')], { targets: [OPP_CR] }), event('opponentTakesControl', [{ e: 'token', token: 'tok-treasure' }])]);
// Artifacts and lands.
a(252, [trig('attacks', [draw, { e: 'discard', who: 'you', n: 1 }]), crew(2, 3, 3)]);
d(253, { equip: { cost: '{5}', grant: {} }, abilities: [F('lifeBase')] });
d(254, {
  produces: ['W', 'U', 'B', 'R', 'G'],
  abilities: [act({ tap: true, sacSelf: true }, [{ e: 'draw', n: 2 }], '犧牲：抓二', { cond: C('legendCombat') })],
});
d(255, { equip: { cost: '{3}', grant: { p: 3, t: 2 }, trigger: trig('combatDamagePlayer', [draw, E('busterCast')]) as TriggeredAbility } });
d(256, { etbTapped: true, abilities: [act({ mana: '{5}', tap: true, exileSelf: true }, [E('elixir')], '洗回非地並獲得生命')] });
d(257, { equip: { cost: '{3}', grant: {} }, abilities: [trig('lifegain', [{ e: 'chargeCounter', what: 'self', n: 1 }]), F('excalibur')] });
d(258, { equip: { cost: '{3}', grant: { kw: ['double_strike'] }, trigger: trig('attacks', [E('genjiCombat')]) as TriggeredAbility } });
a(262, [
  act({ mana: '{2}', tap: true }, [{ e: 'surveil', n: 1 }], '刺探1'),
  act({ mana: '{6}', tap: true, sacSelf: true }, [{ e: 'destroy', what: 'T0' }], '犧牲：消滅非地永久物', {
    targets: [spec('permanent', { nonType: 'Land' })],
  }),
]);
a(263, [
  trig('dies', [{ e: 'token', token: 'tok-treasure' }]),
  act({ mana: '{2}', tap: true }, [{ e: 'exileGy', what: 'T0' }], '放逐墳墓場牌', { targets: [spec('gyCard')] }),
]);
d(264, { equip: { cost: '{2}', grant: {} }, abilities: [F('masamune')] });
job(265, 'Monk', '{2}', { p: 1 });
a(266, [act({ tap: true }, [{ e: 'landFromHand' }], '可放一地進場'), act({ mana: '{3}' }, [E('pupuPower')], '基礎力量等於城鎮數')]);
a(267, [crew(1, 4, 4), trig('attacks', [E('regaliaLand')])]);
a(268, [F('threeBlockers'), act({ mana: '{8}' }, [E('xatmReturn')], '墳墓場返回橫置且終命', { fromGraveyard: true, keepSelf: true })]);
a(269, [
  act({ tap: true }, [{ e: 'addMana', mana: ['C', 'C'] }], '加兩無色'),
  act({ mana: '{2}', tap: true, life: 1 }, [{ e: 'tap', what: 'T0' }], '支付1生命橫置非地', {
    targets: [spec('permanent', { nonType: 'Land' })],
  }),
]);
a(270, [
  act({ mana: '{1}', tap: true, sacSelf: true }, [{ e: 'tutor', filter: { type: 'Land', basic: true } }], '搜尋基本地'),
  act({ mana: '{3}', tap: true, sacSelf: true }, [{ e: 'tutor', filter: { type: 'Land' } }], '搜尋任意地'),
]);
d(272, {
  produces: ['G', 'U'],
  etbTapped: true,
  abilities: [
    act({ mana: '{5}{G}{U}', tap: true }, [{ e: 'transform', what: 'self' }], '轉化', { costLessPer: { sub: 'Town', other: true } }),
  ],
});
back(272, { abilities: [crew(1, 5, 5), trig('attacks', [draw])] });
a(275, [etb([E('hideaway')]), act({ mana: '{2}', tap: true }, [E('hideawayPlay')], '可免費使用藏匿牌', { cond: C('legends', 4) })]);
d(275, { produces: ['C'] });
d(274, { produces: ['C'], filterMana: true });
d(276, { produces: ['W', 'U', 'B', 'R', 'G'], chosenColorMana: true, ecl: { asEnters: 'color' }, etbTapped: true });
a(277, [act({ mana: '{5}', tap: true }, [{ e: 'mill', n: 2 }, E('eden')], '磨二，可犧牲取回另一永久物')]);
a(279, [
  act({ mana: '{2}', tap: true }, [E('coin')], '擲硬幣'),
  act({ mana: '{3}', tap: true }, [draw], '犧牲兩神器抓牌', { sacN: { n: 2, filter: { type: 'Artifact' } } }),
]);
d(289, { produces: ['C', 'W', 'U', 'B', 'R', 'G'], painMana: true, etbTappedUnless: { c: 'myTurnLte', n: 3 } });
// Adventure lands use the same engine path as other Adventures; back is their spell, not a transform face.
for (const n of [283, 284, 285, 286, 293]) {
  const row = catalog.find((c) => c.number === n)!,
    spell = row.back!;
  const effects: Effect[] =
    n === 283
      ? [
          { e: 'toHand', what: 'T0' },
          { e: 'toHand', what: 'T1' },
        ]
      : n === 284
        ? [{ e: 'mill', who: 'T0', n: N('opponentHalfLibrary') }]
        : n === 285
          ? [tok('wizard')]
          : n === 286
            ? [
                {
                  e: 'costThen',
                  prompt: '犧牲生物或神器抓二？',
                  cost: { sac: { type: ['Artifact', 'Creature'] } },
                  then: [{ e: 'draw', n: 2 }],
                },
              ]
            : [E('lastingFayth')];
  const targets =
    n === 283
      ? [gy({ type: ['Artifact', 'Enchantment'] }, true), gy({ type: ['Artifact', 'Enchantment'] }, true)]
      : n === 284
        ? [OPP]
        : undefined;
  d(n, {
    back: undefined,
    adventure: {
      name: spell.name,
      cost: spell.cost,
      types: spell.types as CardDef['types'],
      text: spell.text,
      spell: { effects, targets },
    },
  });
}
// Starter exclusive cards; catalog retains their first printed collector number.
const starter = (name: string, abilities: Ability[], patch: Partial<CardDef> = {}) => {
  const row = catalog.find((c) => c.name === name)!;
  d(row.number, { abilities, ...patch });
};
starter('Beatrix, Loyal General', [trig('combatStart', [E('beatrix')], { targets: [MY_CR] })]);
starter('Rosa, Resolute White Mage', [trig('combatStart', [count('T0'), pump('T0', 0, 0, ['lifelink'])], { targets: [MY_CR] })]);
starter('Ultimecia, Temporal Threat', [
  etb([{ e: 'tap', what: { all: { ctrl: 'opp', type: 'Creature' } } }]),
  trig('allyCombatDamagePlayer', [draw]),
]);
starter('Seymour Flux', [trig('upkeep', [{ e: 'costThen', prompt: '支付1生命？', cost: { life: 1 }, then: [draw, count('self')] }])]);
starter('Lightning, Security Sergeant', [trig('combatDamagePlayer', [E('lightningImpulse')])]);
starter("Cloud, Planet's Champion", [F('cloudChampion')], { equipDiscount: 2 });
starter("Sephiroth, Planet's Heir", [
  etb([pump({ all: { ctrl: 'opp', type: 'Creature' } }, -2, -2)]),
  event('opponentCreatureDies', [count('self')]),
]);
starter('Xande, Dark Mage', [F('xande')]);
const byName = (name: string) => catalog.find((c) => c.name === name)!.number;
s(
  byName('Deadly Embrace'),
  [
    { e: 'destroy', what: 'T0' },
    { e: 'draw', n: N('creaturesDied') },
  ],
  [OPP_CR],
);
s(byName('Judgment Bolt'), [dmg(5), E('judgmentPlayer')], [CR]);
d(byName('Magitek Scythe'), {
  equip: { cost: '{2}', grant: { p: 2, t: 1 } },
  abilities: [etb([E('scythe')], { targets: [{ ...MY_CR, optional: true }] })],
});
d(byName('Ultima Weapon'), {
  equip: {
    cost: '{7}',
    grant: { p: 7, t: 7 },
    trigger: trig('attacks', [{ e: 'destroy', what: 'T0' }], { targets: [OPP_CR] }) as TriggeredAbility,
  },
});
d(309, { produces: ['C'] });
export function completeFin() {
  for (const row of catalog) {
    const old = defs.find((c) => c.id === slug(row.name)),
      patch = patches.get(row.number);
    if (!old && !patch) throw new Error(`FIN missing ${row.number} ${row.name}`);
    const c = { ...old, ...row, ...patch, id: slug(row.name), text: row.text } as unknown as CardDef;
    if (old) Object.assign(old, c);
    else add(c);
  }
}
