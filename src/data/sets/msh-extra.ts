// Complete MSH main set. Sources and verification: docs/msh.md.
import catalog from './msh-catalog.json';
import { add, defs, slug, act, etb, trig, CR, MY_CR, OPP_CR, OPP, ANY } from '../dsl';
import { REPRINTS } from '../reprints';
import type {
  Ability,
  ActivatedAbility,
  TriggeredAbility,
  CardDef,
  Effect,
  Filter,
  Ref,
  TargetSpec,
  Grant,
  Mode,
  Amt,
  SpellSpec,
} from '../../engine/types';
const patches = new Map<number, Partial<CardDef>>();
const d = (n: number, p: Partial<CardDef>) => patches.set(n, { ...patches.get(n), ...p });
const a = (n: number, abilities: Ability[]) => d(n, { abilities });
const s = (n: number, effects: Effect[], targets?: TargetSpec[]) => d(n, { spell: { effects, targets } });
const E = (action: number | string, what?: Ref, n?: number): Effect => ({ e: 'msh', action: String(action), what, n });
const C = (action: string, n?: number) => ({ c: 'msh' as const, action, n });
const F = (msh: string): Ability => ({ kind: 'static', msh });
const N = (msh: string): Amt => ({ msh });
const event = (mshEvent: string, effects: Effect[], extra: Partial<TriggeredAbility> = {}): TriggeredAbility => ({
  kind: 'trigger',
  on: 'mshEvent',
  mshEvent,
  effects,
  ...extra,
});
const spec = (kind: TargetSpec['kind'], filter?: Filter, optional = false): TargetSpec => ({ kind, filter, optional });
const gy = (filter: Filter = {}, optional = false) => spec('gyCard', { ctrl: 'you', ...filter }, optional);
const mine: Ref = { all: { ctrl: 'you', type: 'Creature' } },
  otherHeroes: Ref = { all: { ctrl: 'you', type: 'Creature', sub: 'Hero', other: true } };
const draw: Effect = { e: 'draw', n: 1 },
  clue: Effect = { e: 'token', token: 'tok-clue' },
  connive: Effect = { e: 'connive', what: 'self' };
const pump = (what: Ref, p: Amt = 0, t: Amt = 0, kw: import('../../engine/types').Keyword[] = []): Effect => ({
  e: 'pump',
  what,
  p,
  t,
  kw,
});
const cnt = (what: Ref, n: Amt = 1): Effect => ({ e: 'counters', what, n });
const dmg = (n: Amt, to: Ref = 'T0', from?: Ref): Effect => ({ e: 'damage', n, to, from });
const destroy: Effect = { e: 'destroy', what: 'T0' },
  exile: Effect = { e: 'exile', what: 'T0' };
const gain = (n: Amt, who: Ref = 'you'): Effect => ({ e: 'gain', n, who }),
  lose = (n: Amt, who: Ref = 'opp'): Effect => ({ e: 'lose', n, who });
const tok = (name: string, n: Amt = 1): Effect => ({ e: 'token', token: 'tok-msh-' + name, n });
const modes = (n: number, modes: Mode[]) => d(n, { spell: { modes } });
const worthy = spec('creature', { ctrl: 'you', mshWorthy: true });
const power = (mana: string, effects: Effect[], extra: Partial<ActivatedAbility> = {}): ActivatedAbility =>
  act({ mana }, effects, '強化 ' + mana, { powerUp: true, oncePerGame: true, ...extra }) as ActivatedAbility;
const crew = (n: number, p: number, t: number) => act({ crew: n }, [{ e: 'animate', what: 'self', p, t }], `駕駛${n}`);
const equip = (n: number, cost: string, grant: Grant, abilities: Ability[] = [], trigger?: Ability) =>
  d(n, { equip: { cost, grant, trigger: trigger as TriggeredAbility }, abilities });
const chapter = (effects: Effect[], targets?: TargetSpec[]) => ({ effects, targets });
const saga = (n: number, chapters: NonNullable<CardDef['saga']>['chapters']) => d(n, { saga: { chapters } });
const back = (n: number, p: Partial<CardDef>) =>
  d(n, { mdfc: true, back: { ...catalog.find((c) => c.number === n)!.back, ...p } as CardDef });
const transform = (mana: string) => act({ mana }, [{ e: 'transform', what: 'self' }], '轉化', { sorcery: true });
const withTeam = (n: number, power: number, normal: SpellSpec, both?: SpellSpec) =>
  d(n, { msh: { teamwork: power, teamworkSpell: both }, spell: normal });
function teamModes(n: number, power: number, first: Mode, second: Mode, all: Mode) {
  withTeam(n, power, { modes: [first, second] }, { modes: [all] });
}
const plan = (n: number, trigger: Ability) => a(n, [trigger, event('planReady', [E('finishPlan')])]);
a(1, [event('aloneAttack', [clue])]);
a(2, [event('teamworkTap', [cnt('self'), draw])]);
a(3, []);
a(4, [act({ tap: true }, [cnt(otherHeroes)], '其他英雄各放指示物')]);
a(5, [event('aloneAttack', [pump('evAttackers', 1, 1)])]);
a(6, [
  { kind: 'static', anthem: { filter: { ctrl: 'you', sub: 'Hero' }, grant: { p: 2, t: 2 } } },
  trig('eachEndStep', [draw], { cond: C('heroThisTurn') }),
]);
s(7, [{ e: 'token', token: 'tok-hero', n: 2 }]);
a(8, [power('{4}{W}', [cnt('self', 2)])]);
a(9, [F('shieldHexproof')]);
d(9, { etbCounters: undefined });
a(10, [trig('attacks', [pump(otherHeroes, N('selfToughness'), N('selfToughness'))])]);
a(11, [power('{5}{W}{W}', [cnt('self'), E('keyword', 'self', 1)])]);
a(12, [F('cosmicFlash')]);
a(13, [event('castTargetsOwnCreature', [cnt('self'), { e: 'scry', n: 1 }])]);
a(14, [
  act({ tap: true }, [pump('T0', 1), gain(1)], '攻擊單一生物+1/+0', {
    targets: [spec('creature', { ctrl: 'you', attacking: true })],
    cond: C('oneAttacker'),
  }),
]);
withTeam(15, 2, {
  targets: [spec('creature', { inCombat: true })],
  effects: [{ e: 'if', cond: C('teamwork'), then: [dmg(4)], else: [dmg(2)] }],
});
a(16, [etb([draw, { e: 'if', cond: { c: 'controls', filter: { type: 'Creature', sub: 'Hero', other: true } }, then: [gain(2)] }])]);
a(17, [event('otherHeroCounters', [{ e: 'may', prompt: '派出Wall？', effects: [tok('wall')] }])]);
a(18, [F('ownTurnSilence'), transform('{3}{G}{W}{W}')]);
back(18, {
  abilities: [
    F('ownTurnSilence'),
    event('allyDamaged', [dmg({ ev: true })], { targets: [ANY], may: '讓She-Hulk造成等量傷害？', oncePerTurn: true }),
  ],
});
a(19, []);
a(20, [trig('attacks', [pump('self', 2, 0, ['indestructible'])], { alone: true })]);
a(21, [
  act({ mana: '{5}{W}', tap: true }, [E('harness')], '駕馭Mind Stone'),
  trig('endStep', [{ e: 'flicker', what: 'T0' }], {
    when: C('harnessed'),
    targets: [spec('permanent', { ctrl: 'you', nonType: 'Land', other: true }, true)],
  }),
]);
d(21, { produces: ['W'] });
a(22, [event('castTargetsOwnCreature', [cnt('self')])]);
a(23, [transform('{2}{R}{W}{W}')]);
back(23, { abilities: [trig('castNoncreature', [cnt({ all: { ctrl: 'you', type: 'Creature', other: true } })])] });
teamModes(
  24,
  4,
  { text: '放逐防禦力4以上生物', targets: [spec('creature', { toughMin: 4 })], effects: [exile] },
  { text: '放逐法力值4以上結界', targets: [spec('permanent', { type: 'Enchantment', mvMin: 4 })], effects: [exile] },
  {
    text: '兩項',
    targets: [spec('creature', { toughMin: 4 }), spec('permanent', { type: 'Enchantment', mvMin: 4 })],
    effects: [exile, { e: 'exile', what: 'T1' }],
  },
);
a(25, [power('{W}{U}{B}{R}{G}', [cnt('self', 2), E(25)])]);
a(26, [etb([{ e: 'toHand', what: 'T0' }], { targets: [gy({ nonType: ['Instant', 'Sorcery'], gyThisTurn: true })] })]);
a(27, [
  etb([{ e: 'token', token: 'tok-soldier', n: 2 }]),
  { kind: 'static', anthem: { filter: { ctrl: 'you', token: true, attacking: true, type: 'Creature' }, grant: { kw: ['first_strike'] } } },
]);
saga(28, [chapter([{ e: 'scry', n: 2 }]), chapter([E(28)]), chapter([cnt(mine)])]);
s(29, [{ e: 'token', token: 'tok-clue', who: 'T0' }, pump('T1', 1, 0, ['flying']), { e: 'untap', what: 'T1' }], [spec('player'), CR]);
a(30, [
  act({ mana: '{2}', tap: true }, [pump('T0', 2, 0, ['hexproof'])], '強化另一個生物', {
    targets: [spec('creature', { ctrl: 'you', other: true })],
  }),
]);
plan(31, trig('allyEtb', [{ e: 'scry', n: 1 }, E('plan')]));
a(32, [trig('castNoncreature', [{ e: 'tap', what: 'T0' }], { targets: [spec('permanent', { type: ['Creature', 'Land'] })] })]);
a(33, [act({ mana: '{2}', tap: true }, [{ e: 'tap', what: 'T0' }], '橫置生物', { targets: [CR] })]);
a(34, [etb([destroy], { targets: [spec('creature', { ctrl: 'opp', dealtDamage: true })] })]);
a(35, [etb([{ e: 'token', token: 'tok-msh-void', who: 'T0' }], { targets: [OPP] })]);
equip(
  36,
  '{1}',
  { p: 1, t: 1 },
  [],
  trig(
    'attacks',
    [
      { e: 'untap', what: 'self' },
      { e: 'scry', n: 1 },
    ],
    { alone: true },
  ),
);
a(37, [etb([{ e: 'exileLinked', what: 'T0' }], { targets: [spec('creature', { ctrl: 'opp', tapped: true })] })]);
d(38, {
  aura: { grant: { p: 2, t: 2, kw: ['first_strike', 'vigilance'] } },
  abilities: [etb([E('serumType')]), event('enchantedAttackBlock', [E('serumEquip')], { mshDynamic: 'equipment' })],
});
s(39, [cnt('T0'), pump('T0', 0, 0, ['lifelink', 'indestructible'])], [CR]);
a(40, [etb([{ e: 'scry', n: 2 }])]);
a(41, [etb([{ e: 'exileLinked', what: 'T0' }], { targets: [spec('permanent', { ctrl: 'opp', nonType: 'Land' })] })]);
a(42, [
  {
    kind: 'trigger',
    on: 'etb',
    effects: [],
    modes: [
      {
        text: '兩個指示物',
        targets: [
          { ...CR, optional: true },
          { ...CR, optional: true },
        ],
        effects: [cnt('T0'), cnt('T1')],
      },
      { text: '返手神器或結界', targets: [gy({ type: ['Artifact', 'Enchantment'] })], effects: [{ e: 'toHand', what: 'T0' }] },
    ],
  },
]);
a(43, [power('{5}{U}', [cnt('self', 3)])]);
a(44, [etb([connive])]);
a(45, [trig('drawSecond', [cnt('self')])]);
teamModes(
  46,
  4,
  { text: 'Leviathan', targets: [spec('player')], effects: [{ e: 'token', token: 'tok-msh-leviathan', who: 'T0' }] },
  {
    text: '回手一至兩個永久物',
    targets: [spec('permanent', { nonType: 'Land' }), spec('permanent', { nonType: 'Land' }, true)],
    effects: [
      { e: 'bounce', what: 'T0' },
      { e: 'bounce', what: 'T1' },
    ],
  },
  {
    text: '兩項',
    targets: [spec('player'), spec('permanent', { nonType: 'Land' }), spec('permanent', { nonType: 'Land' }, true)],
    effects: [
      { e: 'token', token: 'tok-msh-leviathan', who: 'T0' },
      { e: 'bounce', what: 'T1' },
      { e: 'bounce', what: 'T2' },
    ],
  },
);
a(47, [
  { kind: 'static', anthem: { filter: { ctrl: 'you', sub: 'Merfolk', other: true }, grant: { p: 1, t: 1 } } },
  event('merfolkAttack', [draw]),
]);
a(48, [power('{5}{U}', [cnt('self'), { e: 'draw', n: 2 }])]);
a(49, [act({ tap: true }, [{ e: 'draw', n: { x: true } }], '抓X張牌', { xMana: 2, sorcery: true }), transform('{2}{R}{R}{G}{G}')]);
back(49, {
  abilities: [
    trig('dealtDamage', [cnt('self'), { e: 'if', cond: { c: 'selfAttacking' }, then: [{ e: 'untap', what: 'self' }, E('extraCombat')] }]),
  ],
});
s(50, [pump('T0', -4), draw], [CR]);
a(51, [act({ mana: '{1}', tap: true }, [E('copyAbility')], '複製生物異能', { mshStack: 'creature' })]);
a(52, [etb([tok('redwing')])]);
equip(53, '{2}{U}', { p: 1, t: 1, kw: ['flying'] }, [etb([{ e: 'attach', what: 'T0' }], { targets: [MY_CR] }), F('equipWard1')]);
d(54, { aura: { grant: { loseAbilities: true, noUntap: true } }, abilities: [etb([{ e: 'tap', what: 'attached' }]), F('freeze')] });
a(55, [etb([draw]), act({ mana: '{3}{U}', sacSelf: true }, [{ e: 'draw', n: 2 }], '犧牲抓兩張')]);
a(56, [
  {
    kind: 'trigger',
    on: 'etb',
    effects: [],
    modes: [
      { text: '橫置', targets: [spec('permanent', { nonType: 'Land' })], effects: [{ e: 'tap', what: 'T0' }] },
      { text: '重置', targets: [spec('permanent', { nonType: 'Land' })], effects: [{ e: 'untap', what: 'T0' }] },
    ],
  },
]);
d(57, { produces: ['U'], manaOnly: 'notNonartifactSpell' });
s(58, [E(58), draw], [spec('permanent', { type: ['Artifact', 'Creature'] })]);
a(59, [act({ mana: '', tap: true }, [E(59)], '揭示牌庫頂')]);
d(60, { msh: { improvise: true }, abilities: [F('noncreatureImprovise')] });
a(61, [
  etb([{ e: 'bounce', what: 'T0' }], { targets: [spec('permanent', { nonType: 'Land', token: false }, true)] }),
  event('otherBounced', [cnt('self')]),
]);
a(62, [power('{5}{U}{U}{U}', [cnt('self'), E(62)])]);
a(63, [F('counterHexproof'), trig('drawSecond', [cnt('self')])]);
a(64, [F('extraConniveDraw'), trig('combatStart', [{ e: 'connive', what: 'T0' }], { targets: [MY_CR] })]);
a(65, [event('abilityTargets', [draw], { oncePerTurn: true })]);
a(66, [event('tokensEntered', [{ e: 'may', prompt: '抓一張牌？', effects: [draw] }])]);
a(67, [F('noMaxHand'), event('castTargetsOwnCreature', [draw, E(67)])]);
s(68, [{ e: 'copyCreature', what: { all: { ctrl: 'you', type: 'Creature', token: false } }, nonLegendary: true }]);
a(69, [F('namorPower'), event('blueNoncreature', [tok('merfolk', N('blueSymbols'))])]);
s(70, [pump('T0', 0, 0, ['vigilance', 'unblockable']), draw], [CR]);
plan(71, event('allyTapped', [draw, { e: 'discard', who: 'you', n: 1 }, E('plan')]));
d(72, { aura: { target: MY_CR, grant: {} }, abilities: [etb([E(72)], { targets: [spec('creature', {}, true)] }), F('equipWard2')] });
a(73, [etb([{ e: 'token', token: 'tok-soldier' }])]);
a(74, [
  etb([E('delayedFlicker')], { targets: [{ ...MY_CR, optional: true }] }),
  crew(1, catalog.find((c) => c.number === 74)!.power!, catalog.find((c) => c.number === 74)!.toughness!),
]);
a(75, [
  { kind: 'static', spellCostLess: { filter: { type: 'Artifact' }, n: 1 } },
  act({ mana: '{1}', tap: true }, [E(75)], '暫時複製另一神器', {
    sorcery: true,
    targets: [spec('permanent', { ctrl: 'you', type: 'Artifact' }), spec('permanent', { ctrl: 'you', type: 'Artifact' })],
  }),
]);
a(76, [power('{U}{U}', [cnt('self', { x: true })], { xMana: 1 }), F('smallUnblockable')]);
d(77, { aura: { grant: {} }, abilities: [event('enchantedUpkeep', [{ e: 'draw', who: 'T0ctrl', n: 1 }])] });
equip(78, '{2}', { p: 1, t: 2 }, [
  etb(
    [
      { e: 'attach', what: 'T0' },
      { e: 'untap', what: 'T0' },
    ],
    { targets: [MY_CR] },
  ),
]);
s(79, [{ e: 'draw', n: 3 }, E('discardArtifactOrTwo')]);
a(80, [
  act(
    { mana: '{1}', tap: true },
    [{ e: 'dig', n: 4, take: 1, rest: 'bottom', filter: { type: 'Artifact' }, optional: true, randomBottom: true }],
    '尋找神器',
  ),
  transform('{4}{U}{R}'),
]);
back(80, { abilities: [trig('combatStart', [E('ironManHand')])] });
s(81, [E(81), { e: 'connive', what: 'T1' }], [OPP_CR, { ...MY_CR, optional: true }]);
withTeam(82, 2, {
  targets: [spec('spell')],
  effects: [
    {
      e: 'if',
      cond: C('teamwork'),
      then: [{ e: 'counterUnless', what: 'T0', pay: 4 }],
      else: [{ e: 'counterUnless', what: 'T0', pay: 2 }],
    },
  ],
});
a(83, [trig('castNoncreature', [E('delayedFlicker')], { targets: [spec('permanent', { nonType: 'Land', token: false, other: true })] })]);
a(84, [etb([E(84)], { targets: [{ ...CR, optional: true }] })]);
a(85, [trig('dies', [tok('villain')])]);
a(86, [
  act({ mana: '{3}', tap: true }, [{ e: 'token', token: 'tok-msh-villain', tapped: true }], '派出Villain', {
    cond: { c: 'gyCount', filter: { type: 'Creature' }, n: 2 },
  }),
]);
a(87, [
  event('blackFromHand', [connive]),
  act({}, [E(87)], '誇耀：放逐十五個黑色符號的牌', { cond: C('attackedSelf'), oncePerTurn: true, mshBoast: true }),
]);
a(88, [
  { kind: 'static', spellCostLess: { filter: { sub: 'Villain' }, n: 1 } },
  trig('allyEtb', [{ e: 'connive', what: 'evCard' }], { filter: { sub: 'Villain', other: true }, may: '使其密謀？', oncePerTurn: true }),
]);
a(89, [trig('combatDamagePlayer', [E(89)])]);
plan(90, trig('drawSecond', [tok('villain'), E('plan')]));
a(91, [trig('allyEtb', [cnt('self'), dmg(2, 'opp')], { filter: { sub: 'Villain', other: true }, oncePerTurn: true })]);
withTeam(92, 2, { targets: [CR], effects: [exile, { e: 'if', cond: C('teamwork'), then: [gain(3)] }] });
s(93, [pump('T0', -4, -4)], [CR]);
modes(94, [
  { text: 'Villain回手', targets: [gy({ sub: 'Villain' })], effects: [{ e: 'toHand', what: 'T0' }] },
  { text: 'Hero回手', targets: [gy({ sub: 'Hero' })], effects: [{ e: 'toHand', what: 'T0' }] },
  {
    text: '兩項',
    targets: [gy({ sub: 'Villain' }), gy({ sub: 'Hero' })],
    effects: [
      { e: 'toHand', what: 'T0' },
      { e: 'toHand', what: 'T1' },
    ],
  },
]);
a(95, [
  etb([tok('doombot', 2)]),
  { kind: 'static', self: { cond: C('doomIndestructible'), grant: { kw: ['indestructible'] } } },
  trig('endStep', [draw, lose(1, 'you')]),
]);
plan(96, trig('allyEtb', [lose(1), gain(1), E('plan')], { filter: { sub: 'Villain' } }));
d(97, { sneak: '{1}{B}{B}', abilities: [etb([destroy], { targets: [spec('creature', { ctrl: 'opp', powMax: 3 })] })] });
a(98, [
  trig('attacks', [
    {
      e: 'costThen',
      prompt: '支付{3}{B}返場生物？',
      cost: { mana: '{3}{B}' },
      then: [{ e: 'reflexive', targets: [gy({ type: 'Creature' })], effects: [E(98)] }],
    },
  ]),
]);
s(99, [destroy, { e: 'surveil', n: 1 }], [CR]);
a(100, [etb([{ e: 'discard', who: 'T0', n: 2 }], { targets: [OPP] }), event('aloneAttack', [lose(1), gain(1)])]);
a(101, [
  etb([
    {
      e: 'if',
      cond: { c: 'gyCount', filter: { type: 'Creature' }, n: 2 },
      then: [{ e: 'token', token: 'tok-msh-villain', tapped: true }],
      else: [{ e: 'mill', n: 2 }],
    },
  ]),
]);
a(102, [act({ mana: '{2}{B}', sacOther: { type: ['Artifact', 'Creature'] } }, [draw], '犧牲神器或生物')]);
a(103, [etb([E(103)], { targets: [spec('player')] })]);
a(104, [etb([connive]), trig('drawSecond', [tok('villain')])]);
a(105, [
  { kind: 'static', anthem: { filter: { ctrl: 'you', sub: 'Villain', other: true }, grant: { p: 2, t: 1 } } },
  act({ mana: '{1}{B}', discardSelf: true }, [{ e: 'tutor', filter: { sub: 'Plan' } }], '從手牌找Plan', { fromHand: true }),
]);
a(106, [
  act({ life: 3 }, [connive], '支付3生命密謀', { duringYourTurn: true }),
  { kind: 'static', anthem: { filter: { ctrl: 'opp', type: 'Creature' }, grant: { p: -1, t: -1 } } },
]);
a(107, [trig('anyDiscard', [E(107)], { ownDiscard: true, eachDiscard: true })]);
a(108, [power('{4}{B}', [{ e: 'discard', who: 'opp', n: 1 }, cnt('self')])]);
a(109, [act({ mana: '{2}{B}' }, [{ e: 'toHand', what: 'selfAny' }], '從墳墓場回手', { fromGraveyard: true, keepSelf: true })]);
a(110, [etb([connive])]);
plan(111, event('creatureToGrave', [draw, lose(1, 'you'), E('plan')]));
a(112, [
  act({ life: 2 }, [E(112)], '產兩點武具專用法力', { oncePerTurn: true }),
  act({ tap: true, sacOther: { sub: 'Equipment' } }, [pump('T0', -4, -4)], '犧牲結附的武具', { sorcery: true, targets: [CR] }),
]);
a(113, [trig('drawSecond', [cnt('T0')], { targets: [CR] })]);
equip(114, '{1}', { p: 1 }, [etb([{ e: 'attach', what: 'T0' }, pump('T0', 0, 0, ['indestructible'])], { targets: [MY_CR] })]);
a(115, [
  act({ mana: '{2}{W}' }, [tok('wall')], 'Wall'),
  act({ mana: '{3}{G}' }, [pump('self', 4, 4)], '+4/+4'),
  act({ mana: '{4}{R}' }, [dmg(4)], '4傷害', { targets: [CR] }),
  act({ mana: '{5}{U}' }, [{ e: 'draw', n: 4, who: 'T0' }], '抓四張', { targets: [spec('player')] }),
]);
a(116, [
  trig('allyEtb', [E(116)], {
    filter: { sub: 'Villain', other: true },
    targets: [spec('permanent', { ctrl: 'you', sub: 'Equipment' }, true), MY_CR],
  }),
  event('equippedAttack', [{ e: 'connive', what: 'evCard' }]),
]);
a(117, [trig('allyDies', [E(117)], { filter: { sub: 'Villain' }, includeSelf: false })]);
withTeam(118, 4, { targets: [gy({ type: 'Creature' })], effects: [{ e: 'reanimate', what: 'T0' }] });
a(119, [power('{5}{B}{B}', [{ e: 'toHand', what: 'T0' }, cnt('self', 2)], { targets: [gy({ type: 'Creature' }, true)] })]);
s(120, [{ e: 'draw', n: 2 }, lose(2, 'you')]);
d(120, { costReduce: { cond: { c: 'controls', filter: { sub: 'Villain' } }, mana: '{1}' } });
a(121, [
  trig('attacks', [lose(N('equipmentAttached')), gain(N('equipmentAttached'))], { cond: { c: 'controls', filter: { sub: 'Equipment' } } }),
]);
teamModes(
  122,
  3,
  { text: '死觸', targets: [CR], effects: [pump('T0', 0, 0, ['deathtouch'])] },
  { text: '-2/-2', targets: [CR], effects: [pump('T0', -2, -2)] },
  { text: '兩項', targets: [CR, { ...CR, allowRepeat: true }], effects: [pump('T0', 0, 0, ['deathtouch']), pump('T1', -2, -2)] },
);
a(123, [trig('allyEtb', [pump('self', 1, 0, ['lifelink'])], { filter: { sub: 'Villain', other: true } })]);
modes(124, [
  { text: '全部生物3傷害', effects: [dmg(3, { all: { type: 'Creature' } })] },
  { text: '消滅地', targets: [spec('permanent', { type: 'Land' })], effects: [E('destroyLandSearch')] },
  {
    text: '兩項',
    targets: [spec('permanent', { type: 'Land' })],
    effects: [dmg(3, { all: { type: 'Creature' } }), E('destroyLandSearch')],
  },
]);
s(125, [pump('T0', 3, 1), E('impulseNext')], [CR]);
a(126, [etb([E('impulseNext')])]);
plan(127, trig('castNoncreature', [{ e: 'token', token: 'tok-treasure', tapped: true }, E('plan')]));
s(128, [E(128)], [CR]);
a(129, [event('spellTargetsArtifactLand', [{ e: 'copySpell' }, cnt('self', 2)])]);
a(130, [trig('becomesTapped', [E(130)])]);
a(131, [F('hawkeyeDamage')]);
equip(132, '{1}', { p: 1, kw: ['reach'] }, [], trig('becomesTapped', [dmg(1, 'opp')]));
s(133, [E(133)]);
s(134, [tok('villain'), pump(mine, 1)]);
teamModes(
  135,
  4,
  { text: '消滅非生物神器', targets: [spec('permanent', { type: 'Artifact', nonType: 'Creature' })], effects: [destroy] },
  { text: '生物造成傷害', targets: [MY_CR, OPP_CR], effects: [{ e: 'bite', a: 'T0', b: 'T1' }] },
  {
    text: '兩項',
    targets: [spec('permanent', { type: 'Artifact', nonType: 'Creature' }), MY_CR, OPP_CR],
    effects: [destroy, { e: 'bite', a: 'T1', b: 'T2' }],
  },
);
a(136, [
  event('draw', [dmg(1, 'opp')], { cond: { c: 'controls', filter: { sub: 'Hero', other: true } }, targets: [OPP] }),
  power('{6}{R}', [cnt('self', 3)]),
]);
a(137, [event('villainOrArtifactEnters', [dmg(1, 'opp')], { targets: [OPP] })]);
a(138, [event('castTargetsOwnCreature', [E(138)])]);
a(139, [act({ tap: true }, [{ e: 'stun', what: 'self' }, E(139)], '暈眩自己並放逐牌庫頂')]);
a(140, [etb([E('sacArtifactOrDiscard', undefined, 1)])]);
a(141, []);
s(142, [dmg(3)], [ANY]);
a(143, [act({ mana: '{1}', tap: true }, [E(143)], '複製下一個小咒語'), power('{4}{R}', [cnt('self', 2)])]);
a(144, [trig('allyPermEtb', [cnt('self')], { filter: { type: 'Artifact', other: true } })]);
a(145, [act({ mana: '{2}', tap: true, discard: 1 }, [{ e: 'draw', n: { discardedThisTurn: true } }], '依本回合棄牌數抓牌')]);
equip(146, '{1}', {}, [
  etb([dmg(4)], { targets: [{ ...CR, optional: true }] }),
  act({ mana: '{2}{R}', discardSelf: true }, [dmg(2, { all: { type: 'Creature' } })], '從手牌棄掉：2傷害', { fromHand: true }),
]);
d(146, {
  equip: { cost: '{1}', manual: true, grant: {} },
  abilities: [
    ...patches.get(146)!.abilities!,
    act({ mana: '{1}' }, [{ e: 'attach', what: 'T0' }], '裝備值得者', { sorcery: true, targets: [worthy] }),
    F('doubleEquippedDamage'),
  ],
});
s(147, [dmg(1)], [CR]);
a(148, [power('{4}{R}', [cnt('self'), E('keyword', 'self', 2)])]);
d(148, { leyline: true });
a(149, [
  trig('dealtDamage', [cnt('self'), { e: 'reflexive', targets: [{ ...ANY, notSelf: true }], effects: [dmg({ selfCounters: true })] }]),
]);
withTeam(150, 2, { targets: [CR], effects: [dmg(5), { e: 'if', cond: C('teamwork'), then: [dmg(2, 'T0ctrl')] }] });
a(151, [F('scarletDiscount')]);
a(152, [
  trig('castNoncreature', [
    {
      e: 'costThen',
      prompt: '支付{1}限制阻擋？',
      cost: { mana: '{1}' },
      then: [{ e: 'reflexive', targets: [spec('creature', { kw: 'haste' })], effects: [E(152)] }],
    },
  ]),
]);
a(153, [act({ mana: '{2}', tap: true }, [{ e: 'token', token: 'tok-treasure' }], '珍寶')]);
d(154, { aura: { grant: { p: 1, kw: ['haste'] } }, abilities: [etb([pump('attached', 0, 0, ['first_strike'])])] });
withTeam(155, 1, {
  targets: [CR],
  effects: [pump('T0', 0, 0, ['double_strike']), { e: 'if', cond: C('teamwork'), then: [pump('T0', 0, 0, ['trample'])] }],
});
a(156, [
  etb([E(156)], { targets: [gy({ or: [{ sub: 'Equipment' }, { type: ['Instant', 'Sorcery'] }] })] }),
  trig('castNoncreature', [dmg(N('spellManaValue'))], { targets: [ANY] }),
]);
s(157, [dmg(4)], [ANY]);
d(157, { costReduce: { cond: { c: 'controls', filter: { sub: 'Vehicle' } }, mana: '{2}' } });
s(158, [E('sacArtifactOrDiscard', undefined, 2)]);
a(159, [power('{5}{R}', [cnt('self', 2)])]);
a(160, [F('extraPowerUp'), power('{5}{R}{R}', [cnt('self', 2)])]);
a(161, [etb([E(161)])]);
const returnModes: Mode[] = [
  ['神器', { type: 'Artifact' }],
  ['生物', { type: 'Creature' }],
  ['結界', { type: 'Enchantment' }],
  ['地', { type: 'Land' }],
].map(([text, filter]) => ({ text: String(text), targets: [gy(filter as Filter)], effects: [{ e: 'toHand', what: 'T0' }] }));
d(162, {
  spell: {
    modes: [
      ...returnModes,
      ...returnModes.flatMap((m, i) =>
        returnModes.slice(i + 1).map((n) => ({
          text: m.text + '與' + n.text,
          targets: [...m.targets!, ...n.targets!],
          effects: [
            { e: 'toHand' as const, what: 'T0' as const },
            { e: 'toHand' as const, what: 'T1' as const },
          ],
        })),
      ),
      { text: '不選', effects: [] },
    ],
  },
});
plan(163, trig('landfall', [cnt('T0'), E('plan')], { targets: [MY_CR] }));
a(164, [F('extraCounters'), act({ tap: true }, [{ e: 'addManaOfChoice', n: { power: 'self' } }], '依力量產法力')]);
withTeam(165, 5, { effects: [E(165)] });
modes(166, [
  { text: '身材加倍', targets: [CR], effects: [E('doubleStats', 'T0')] },
  { text: '互鬥', targets: [MY_CR, OPP_CR], effects: [{ e: 'fight', a: 'T0', b: 'T1' }] },
  { text: '兩項', targets: [CR, MY_CR, OPP_CR], effects: [E('doubleStats', 'T0'), { e: 'fight', a: 'T1', b: 'T2' }] },
]);
s(167, [pump('T0', 3, 3)], [CR]);
teamModes(
  168,
  3,
  { text: '指示物', targets: [CR], effects: [cnt('T0')] },
  { text: '互鬥', targets: [MY_CR, OPP_CR], effects: [{ e: 'fight', a: 'T0', b: 'T1' }] },
  { text: '兩項', targets: [CR, MY_CR, OPP_CR], effects: [cnt('T0'), { e: 'fight', a: 'T1', b: 'T2' }] },
);
a(169, [
  act({ sacSelf: true }, [destroy], '犧牲：消滅非生物神器或結界', {
    sorcery: true,
    targets: [spec('permanent', { type: ['Artifact', 'Enchantment'], nonType: 'Creature' })],
  }),
]);
a(170, [trig('dies', [E(170)])]);
a(171, [power('{4}{G}', [cnt('self'), pump('self', 0, 0, ['vigilance', 'indestructible', 'haste'])])]);
a(172, [etb([{ e: 'token', token: 'tok-food' }]), trig('lifegain', [E('lifeCounters')], { mshDynamic: 'lifeTargets' })]);
a(173, [trig('allyEtb', [E(173)], { filter: { type: 'Creature', other: true } })]);
a(174, [{ kind: 'static', topCast: { type: 'Land' } }, etb([tok('zabu')])]);
a(175, [event('otherCreatureCounter', [cnt('self')], { oncePerTurn: true })]);
a(176, [trig('upkeep', [E(176)])]);
a(177, [F('graveLands'), trig('landfall', [tok('moloid')])]);
a(178, [power('{6}{G}', [cnt('self'), { e: 'token', token: 'tok-hero' }])]);
a(179, [act({ tap: true }, [E(179)], '增加目標各類指示物', { sorcery: true, targets: [spec('permanentOrPlayer')] })]);
s(180, [E(180)], [MY_CR, OPP_CR]);
d(180, { costReduce: { cond: { c: 'gyCount', filter: { type: 'Creature' }, n: 2 }, mana: '{2}' } });
s(181, [E(181)]);
a(182, [act({ mana: '{3}' }, [E('dinosaur3')], '3/5 Dinosaur'), act({ mana: '{6}' }, [E('dinosaur6')], '6/6 Dinosaur')]);
s(
  183,
  [gain(2, 'T0'), { e: 'searchLand', who: 'T0', to: 'battlefield', tapped: true }, cnt('T1')],
  [spec('player'), { ...CR, optional: true }],
);
a(184, [act({ mana: '{3}', tap: true }, [E(184)], '磨四張並取回英雄或結界')]);
a(185, []);
a(186, [power('{3}{G}', [cnt('self', 2)])]);
a(187, [F('activateHaste'), act({ tap: true }, [E(187)], '生物異能專用法力')]);
a(188, [power('{4}{G}{G}', [destroy, cnt('self')], { targets: [spec('permanent', { type: ['Artifact', 'Enchantment'] }, true)] })]);
d(189, { aura: { grant: { p: 4, t: 4, kw: ['trample'] } }, abilities: [F('equipWard1')] });
a(190, [event('heroDamageBatch', [cnt('self', 2)])]);
a(191, [trig('lifegain', [cnt('self')])]);
a(192, [
  { kind: 'static', anthem: { filter: { ctrl: 'you', type: 'Creature', plusCounters: true }, grant: { kw: ['trample'] } } },
  trig('combatStart', [cnt('T0')], { targets: [MY_CR] }),
]);
a(193, [
  etb([tok('squirrel')]),
  trig('attacks', [tok('squirrel')]),
  act({ mana: '{1}{G}{G}{G}' }, [tok('squirrel', { count: { ctrl: 'you', sub: 'Squirrel' } })], '依松鼠數派松鼠'),
]);
a(194, [F('undercoverSkrull')]);
d(194, { produces: ['W', 'U', 'B', 'R', 'G'] });
a(195, [etb([E(195)], { targets: [CR] })]);
a(196, [power('{5}{G}', [cnt('self'), tok('tigerGod')])]);
saga(197, [
  chapter([E('freeNextRG')]),
  chapter([cnt('T0', 3)], [MY_CR]),
  chapter([E('doubleStats', 'T0'), pump('T0', 0, 0, ['trample'])], [MY_CR]),
]);
a(198, [power('{5}{R/G}{R/G}', [cnt('self'), { e: 'fight', a: 'self', b: 'T0' }], { targets: [{ ...OPP_CR, optional: true }] })]);
a(199, [
  trig('mainStart', [E(199)], {
    targets: [spec('permanent', { or: [{ type: 'Artifact' }, { type: 'Enchantment', nonSub: 'Aura' }, { type: 'Land' }] }, true)],
  }),
]);
a(200, [trig('combatStart', [E(200)])]);
a(201, [
  trig('attacks', [
    { e: 'costThen', prompt: '支付{1}放指示物？', cost: { mana: '{1}' }, then: [{ e: 'reflexive', targets: [CR], effects: [cnt('T0')] }] },
  ]),
  event('anyCreatureCounter', [tok('insect')], { oncePerTurn: true }),
]);
a(202, [F('mustAttack'), trig('allyDies', [{ e: 'toHand', what: 'evCard' }], { filter: { attacking: true }, includeSelf: true })]);
saga(203, [chapter([E('armorDraw')]), chapter([E('artifactDiscountTurn')]), chapter([dmg(N('maxArtifactMV'), 'T0')], [OPP])]);
a(204, [event('draw', [cnt('self')]), act({ mana: '{2}{G}', tap: true }, [E(204)], '移除任意指示物派昆蟲')]);
saga(205, [
  chapter([tok('villain', 2)]),
  chapter([dmg(2, { all: { type: 'Creature', nonSub: 'Villain' } }), dmg(2, 'opp')]),
  chapter([{ e: 'token', token: 'tok-treasure', n: { count: { ctrl: 'you', sub: 'Villain' } } }]),
]);
a(206, [F('beastFlying'), trig('combatDamagePlayer', [draw])]);
a(207, [
  {
    kind: 'trigger',
    on: 'allyEtb',
    filter: { other: true, token: false, sub: 'Hero' },
    effects: [],
    modes: [
      { text: 'Soldier', effects: [{ e: 'token', token: 'tok-soldier' }] },
      { text: '全體+1/+1', effects: [pump(mine, 1, 1)] },
    ],
  },
]);
a(208, [event('aloneAttack', [pump('evAttackers', 0, 0, ['first_strike', 'menace'])])]);
a(209, [
  etb([E('bullseyeCost')]),
  act({ mana: '{3}', tap: true, sacOther: { type: 'Artifact' } }, [dmg(2)], '犧牲神器：2傷害', { targets: [ANY] }),
  act({ mana: '{3}', tap: true, discard: 1, discardFilter: { nonType: 'Land' } }, [dmg(2)], '棄非地牌：2傷害', { targets: [ANY] }),
]);
a(210, [event('firstAllyTap', [{ e: 'untap', what: 'evCard' }])]);
a(211, [etb([E(211)], { targets: [OPP, { ...OPP_CR, optional: true }] })]);
saga(212, [
  chapter([destroy], [spec('permanent', { nonType: 'Land' }, true)]),
  chapter([lose(2)]),
  chapter([lose(2)]),
  chapter([tok('galactus')]),
]);
a(213, [trig('youAttack', [E(213)])]);
a(214, []);
a(215, [F('powerUpDiscount'), power('{6}{R}{G}', [cnt('self', 5)])]);
a(216, [F('ironManPower'), trig('attacks', [draw], { cond: { c: 'artifactEntered' } })]);
a(217, [trig('attacks', [connive]), trig('drawSecond', [lose(1), gain(1)])]);
a(218, [
  etb([
    {
      e: 'costThen',
      prompt: '犧牲另一生物？',
      cost: { sac: { type: 'Creature', other: true } },
      then: [{ e: 'reflexive', targets: [spec('permanent', { ctrl: 'opp', nonType: 'Land' })], effects: [destroy] }],
    },
  ]),
  F('killmonger'),
]);
a(219, [trig('drawSecond', [draw], { anyPlayer: true }), trig('oppDrawSecond', [draw]), transform('{4}{W}{U}')]);
back(219, { abilities: [F('preventSelfDamage'), trig('combatDamagePlayer', [draw])] });
a(220, [
  trig('castAny', [{ e: 'costThen', prompt: '勒索{W/B}？', cost: { mana: '{W/B}' }, then: [lose(1), gain(1)] }]),
  trig('youAttack', [
    {
      e: 'costThen',
      prompt: '支付2生命改以防禦力戰鬥？',
      cost: { life: 2 },
      then: [{ e: 'grant', what: mine, grant: { damageByToughness: true } }],
    },
  ]),
]);
a(221, [trig('castAny', [tok('villain')], { filter: { sub: 'Villain' } })]);
a(222, [
  trig('attacks', [E('immediateFlickerTapped')], { targets: [spec('permanent', { type: ['Artifact', 'Creature'], token: false }, true)] }),
  trig('allyPermEtb', [draw], { filter: { sub: 'Equipment' } }),
]);
a(223, [
  trig('drawSecond', [{ e: 'setBase', what: 'self', p: 6, t: 6 }, pump('self', 0, 0, ['trample'])]),
  trig('allyPermEtb', [draw], { filter: { type: 'Artifact' }, oncePerTurn: true }),
]);
d(224, {
  etbCountersX: true,
  abilities: [
    {
      kind: 'trigger',
      on: 'etb',
      effects: [],
      mshDynamic: 'wrecking',
      modes: [
        { text: '棄一抓一', effects: [{ e: 'discard', who: 'you', n: 1 }, draw] },
        { text: '對手失去2', targets: [OPP], effects: [lose(2)] },
        { text: '消滅衍生物', targets: [spec('permanent', { token: true })], effects: [destroy] },
        { text: '各自犧牲生物', effects: [{ e: 'edict', who: 'players', filter: { type: 'Creature' } }] },
      ],
    },
  ],
});
a(225, [act({ life: 2 }, [E('copyAbility')], '複製神器異能', { mshStack: 'artifact', duringYourTurn: true, oncePerTurn: true })]);
a(226, [
  F('poisonWard'),
  trig('allyDies', [{ e: 'edict', who: 'opp', filter: { type: 'Creature', token: false } }], { filter: { other: true, kw: 'deathtouch' } }),
]);
a(227, [event('targetedBySpell', [pump('self', 2, 2), E(227)])]);
a(228, [etb([E(228)])]);
a(229, [etb([E(229)], { targets: [OPP_CR] })]);
a(230, [F('stormFlying'), event('castTargetsCreatures', [E(230)])]);
saga(231, [
  chapter(
    [E(231)],
    [
      { ...CR, optional: true, totalMvMax: 6 },
      { ...CR, optional: true, totalMvMax: 6 },
    ],
  ),
  chapter([pump(mine, 1, 1, ['vigilance'])]),
  chapter([{ e: 'fight', a: 'T0', b: 'T1' }], [MY_CR, spec('creature', { other: true }, true)]),
]);
a(232, [trig('mainStart', [E(232)], { targets: [spec('creatureOrGy', {}, true)] })]);
a(233, [power('{C}{W}{U}{B}{R}{G}', [cnt('self', 2), E(233)])]);
a(234, [trig('castNoncreature', [pump('self', 1, 1)])]);
a(235, [F('titaniaWard')]);
d(235, { addCost: { discard: 1 } });
a(236, [etb([{ e: 'token', token: 'tok-sturdy-shield', attachTo: 'self' }])]);
s(237, [E(237)]);
a(238, [trig('combatStart', [pump('T0', { power: 'self' })], { targets: [spec('creature', { ctrl: 'you', other: true })] })]);
a(239, [F('winterPower'), act({ mana: '{3}{W}{B}' }, [E(239)], '墳墓場返場並裝備', { fromGraveyard: true, keepSelf: true })]);
a(240, [etb([{ e: 'fight', a: 'self', b: 'T0' }], { targets: [spec('creature', { other: true }, true)] }), F('wolverineHeal')]);
s(241, [E(241)]);
a(242, [etb([{ e: 'surveil', n: 2 }])]);
d(243, { msh: { improvise: true }, produces: ['C'] });
equip(244, '{2}', { t: 8, kw: ['vigilance'] }, [], trig('attacks', [{ e: 'tap', what: 'T0' }], { targets: [OPP_CR] }));
a(245, [trig('youAttack', [E(245)])]);
d(246, { produces: ['W', 'U', 'B', 'R', 'G'], abilities: [crew(4, 3, 3)] });
a(247, [etb([draw, { e: 'landFromHand', tapped: true }])]);
equip(248, '{2}', { p: 2, t: 1, kw: ['flying'] }, [
  etb([{ e: 'attach', what: 'T0' }], { targets: [MY_CR] }),
  act({ mana: '{2}' }, [E(248)], '武具變成生物'),
]);
a(249, [etb([{ e: 'token', token: 'tok-soldier', n: 2 }]), crew(6, 4, 5)]);
a(250, [
  F('adaptoidPower'),
  etb([E(250)], { targets: [spec('creature', { other: true })] }),
  trig('attacks', [E(250)], { targets: [spec('creature', { other: true })] }),
]);
a(251, [F('handTen'), trig('endStep', [{ e: 'draw', n: N('toTen') }])]);
a(252, [trig('allyPermEtb', [E(252)], { filter: { type: 'Artifact', token: false, other: true } })]);
a(253, [power('{6}', [cnt('self', 2), tok('robot')])]);
equip(254, '{3}', { p: 2, t: 2 });
a(255, [
  {
    kind: 'trigger',
    on: 'castNoncreature',
    effects: [],
    modesOncePerTurn: true,
    modes: [
      { text: '連擊', effects: [pump('self', 0, 0, ['double_strike'])] },
      { text: '不滅', effects: [pump('self', 0, 0, ['indestructible'])] },
      { text: '抓牌', effects: [draw] },
    ],
  },
]);
a(256, [trig('attacks', [draw], { cond: C('selfPower4') }), power('{7}', [cnt('self', 2)])]);
for (const n of [257, 258, 259, 262, 265, 268, 270, 271, 272, 273]) a(n, [etb([gain(1)])]);
d(260, {
  produces: ['C'],
  abilities: [
    act({ mana: '{4}', tap: true }, [{ e: 'dig', n: 3, take: 1, rest: 'bottom', filter: { sub: 'Hero' }, optional: true }], '尋找Hero'),
    F('heroMana'),
  ],
});
d(261, {
  produces: ['C'],
  abilities: [
    act({ mana: '{4}', tap: true }, [E('baxterMana')], '任意組合四法力'),
    act({ mana: '{4}', tap: true }, [draw], '抓牌', { cond: { c: 'controls', filter: { type: 'Creature', toughMin: 4 } } }),
  ],
});
d(263, {
  produces: ['C'],
  abilities: [
    F('artifactMana'),
    act({ mana: '{3}', tap: true, sacOther: { type: 'Artifact' } }, [tok('doombot')], '派Doombot', { sorcery: true }),
  ],
});
for (const n of [264, 266, 267, 269, 275]) a(n, [F('conditionalDual')]);
d(274, { produces: ['C'], filterMana: true, abilities: [etb([{ e: 'surveil', n: 1 }])] });
d(276, {
  produces: ['C'],
  abilities: [
    F('villainMana'),
    act({ mana: '{3}', tap: true }, [{ e: 'connive', what: 'T0' }], 'Villain密謀', {
      sorcery: true,
      targets: [spec('creature', { ctrl: 'you', sub: 'Villain' })],
    }),
  ],
});
export function completeMsh() {
  for (const row of catalog) {
    const patch = patches.get(row.number);
    if (!patch) throw new Error('MSH missing ' + row.name);
    const old = defs.find((c) => c.id === slug(row.name));
    const c = { ...row, ...patch, id: slug(row.name), text: row.text } as unknown as CardDef;
    if (old && old.set !== 'MSH') {
      c.set = old.set;
      const list = (REPRINTS.MSH ??= []);
      if (!list.some(([id]) => id === c.id)) list.push([c.id, c.rarity]);
    }
    if (old) {
      for (const key of Object.keys(old)) delete (old as unknown as Record<string, unknown>)[key];
      Object.assign(old, c);
    } else add(c);
  }
}
