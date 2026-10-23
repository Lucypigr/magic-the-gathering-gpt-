// MKM main set 001–271. Printed text: mkm-catalog.json; audit: docs/mkm.md.
import catalog from './mkm-catalog.json';
import { add, defs, slug, act, etb, trig, CR, MY_CR, OPP_CR, OPP, ANY } from '../dsl';
import type { Ability, CardDef, Effect, Filter, Ref, TargetSpec, TriggeredAbility, Grant, Mode, Amt } from '../../engine/types';
const patches = new Map<number, Partial<CardDef>>();
const d = (n: number, p: Partial<CardDef>) => patches.set(n, { ...patches.get(n), ...p });
const a = (n: number, abilities: Ability[]) => d(n, { abilities });
const s = (n: number, effects: Effect[], targets?: TargetSpec[]) => d(n, { spell: { effects, targets } });
const E = (action: string | number, what?: Ref, n?: number): Effect => ({ e: 'mkm', action: String(action), what, n });
const C = (action: string, n?: number) => ({ c: 'mkm' as const, action, n });
const F = (mkm: string): Ability => ({ kind: 'static', mkm });
const N = (mkm: string): Amt => ({ mkm });
const event = (mkmEvent: string, effects: Effect[], extra: Partial<TriggeredAbility> = {}): TriggeredAbility => ({
  kind: 'trigger',
  on: 'mkmEvent',
  mkmEvent,
  effects,
  ...extra,
});
const spec = (kind: TargetSpec['kind'], filter?: Filter, optional = false): TargetSpec => ({ kind, filter, optional });
const gy = (filter: Filter = {}, optional = false) => spec('gyCard', { ctrl: 'you', ...filter }, optional);
const mine: Ref = { all: { ctrl: 'you', type: 'Creature' } },
  opp: Ref = { all: { ctrl: 'opp', type: 'Creature' } };
const draw: Effect = { e: 'draw', n: 1 },
  clue: Effect = { e: 'token', token: 'tok-clue' };
const tok = (token: string, n = 1): Effect => ({ e: 'token', token: 'tok-mkm-' + token, n });
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
const gain = (n: Amt): Effect => ({ e: 'gain', n }),
  lose = (n: Amt): Effect => ({ e: 'lose', n, who: 'opp' });
const up = (effects: Effect[], targets?: TargetSpec[]) => trig('turnedFaceUp', effects, { targets });
const both = (effects: Effect[], targets?: TargetSpec[]) => [etb(effects, { targets }), up(effects, targets)];
const sac = (filter: Filter): Effect => ({ e: 'edict', who: 'opp', filter });
const modes = (n: number, modes: Mode[]) => d(n, { spell: { modes } });
const equip = (n: number, cost: string, grant: Grant, trigger?: Ability) =>
  d(n, {
    equip: { cost, grant, trigger: trigger as TriggeredAbility },
    abilities: [act({ mana: '{2}', sacSelf: true }, [draw], '犧牲：抓一張牌')],
  });
function caseCard(n: number, abilities: Ability[] = [], extra: Partial<CardDef> = {}) {
  a(n, [...abilities, event('solve', [E('solve')], { cond: C('solve') })]);
  d(n, extra);
}
const solved = (on: import('../../engine/types').TriggerOn, effects: Effect[], extra: Partial<TriggeredAbility> = {}) =>
  trig(on, effects, { cond: C('solved'), ...extra });
caseCard(1, [
  etb([{ e: 'searchLand', to: 'hand' }]),
  solved('combatStart', [pump('T0', 0, 0, ['flying', 'double_strike', 'vigilance'])], { targets: [MY_CR] }),
]);
a(2, [etb([E('clearSuspects')]), trig('dies', [gain(3), { e: 'suspect', what: 'T0' }], { targets: [{ ...OPP_CR, optional: true }] })]);
a(3, [F('assemble')]);
a(4, [{ ...(up([E(4)]) as TriggeredAbility), mkmDynamic: 'vindicator' }]);
s(5, [pump('T0', 2, 2), clue], [CR]);
s(6, [E(6)], [gy({ type: 'Creature', mvMax: 3 })]);
a(7, [
  etb([{ e: 'dig', n: 6, take: 1, rest: 'bottom', filter: { type: 'Enchantment' }, optional: true, randomBottom: true }]),
  event('solved', [{ e: 'dig', n: 6, take: 1, rest: 'bottom', filter: { type: 'Enchantment' }, optional: true, randomBottom: true }]),
  F('caseMana'),
]);
d(8, {
  abilities: [
    etb([E(8)], { targets: [OPP_CR] }),
    event('solve', [E('solve')], { cond: C('solve') }),
    { kind: 'static', condition: C('solved'), anthem: { filter: { ctrl: 'you', type: 'Creature' }, grant: { p: 1 } } },
  ],
});
caseCard(9, [event('detectiveEntersUp', [cnt('evCard')]), F('extraClue')]);
caseCard(10, [trig('allyEtb', [gain(1)]), act({ sacSelf: true }, [E(10)], '破解：本回合從墳墓場施放生物', { cond: C('solved') })]);
a(11, []);
a(12, [F('delney')]);
a(13, [F('noEtb')]);
d(14, {
  aura: { target: CR, grant: { p: 2, t: 2, kw: ['vigilance'] } },
  abilities: [etb([pump('T0', 2, 2, ['vigilance'])], { targets: [MY_CR] })],
});
a(15, [up([pump(mine, 0, 0, ['hexproof']), { e: 'untap', what: mine }])]);
a(16, [up([{ e: 'bounce', what: 'T0' }, cnt('self')], [spec('permanent', { ctrl: 'you', other: true })])]);
a(17, [
  etb([exile, { e: 'exile', what: 'T1' }], { targets: [spec('gyCard', {}, true), { ...spec('gyCard', {}, true), sameGraveyardAs: 0 }] }),
]);
a(18, [
  etb([cnt('T0')], { targets: [spec('creature', { ctrl: 'you', powMax: 2 })] }),
  trig('attacks', [cnt('T0')], { targets: [spec('creature', { ctrl: 'you', powMax: 2 })] }),
]);
a(19, [
  etb([{ e: 'token', token: 'tok-detective' }]),
  act({ mana: '{3}', tap: true }, [pump('T0', 2, 0, ['vigilance'])], '偵探強化', {
    sorcery: true,
    targets: [spec('creature', { ctrl: 'you', sub: 'Detective' })],
  }),
]);
a(20, [F('watchdog'), event('attackThree', [pump(mine, 1, 1)])]);
d(21, {
  equip: { cost: '{2}', grant: { p: 2 } },
  abilities: [
    act({ mana: '{2}', tap: true, sacSelf: true }, [gain(3)], '犧牲食物'),
    trig('leaves', [{ e: 'costThen', prompt: '支付{1}{W}派出兩隻狗？', cost: { mana: '{1}{W}' }, then: [tok('dog', 2)] }], {
      when: C('sourceToGy'),
    }),
  ],
});
s(22, [destroy], [spec('permanent', { or: [{ type: 'Artifact' }, { type: 'Enchantment' }, { type: 'Creature', powMin: 4 }] })]);
a(23, [etb([{ e: 'exileLinked', what: 'T0' }, gain(2)], { targets: [OPP_CR] })]);
a(24, [trig('allyEtb', [pump('self', 0, 0, ['flying'])], { filter: { powMax: 2, other: true } })]);
a(25, [trig('dies', [{ e: 'token', token: 'tok-detective' }])]);
a(26, [trig('allyEtb', [pump('T0', 1, 1)], { filter: { powMax: 2, other: true }, targets: [MY_CR] })]);
s(27, [E(27)]);
s(28, [exile], [spec('creature', { attacking: true })]);
a(29, [etb([clue])]);
s(30, [pump(mine, 2, 1), clue]);
a(31, [event('otherDetectiveEntersUp', [pump('self', 1, 1)])]);
a(32, [act({ mana: '{2}{W}', tap: true }, [{ e: 'tap', what: 'T0' }, E(32)], '橫置與暈眩', { targets: [CR] })]);
a(33, [event('attackThree', [pump('self', 2)])]);
a(34, [
  act({ mana: '{1}{W}' }, [E('hero1')], '蒐證2：成為4/4偵探', { evidence: 2 }),
  act({ mana: '{2}{W}' }, [E('hero2')], '蒐證4：成為Mileva', { evidence: 4 }),
]);
a(35, [up([E(35)], [spec('permanent', { nonType: 'Land', other: true })])]);
a(36, [trig('upkeep', [E(36)])]);
equip(37, '{2}', { p: 1, t: 1, kw: ['vigilance'] });
d(37, {
  equip: {
    cost: '{2}',
    grant: { p: 1, t: 1, kw: ['vigilance'] },
    abilities: [act({ mana: '{3}', tap: true }, [{ e: 'tap', what: 'T0' }], '橫置生物', { targets: [CR] })],
  },
});
a(38, [etb([E(38)])]);
s(39, [E(39)], [spec('permanent', { type: ['Artifact', 'Creature'] })]);
d(39, { mkm: { optionalEvidence: 6 } });
a(40, [
  etb([{ e: 'costThen', prompt: '犧牲神器抓牌？', cost: { sac: { type: 'Artifact' } }, then: [draw] }]),
  trig('attacks', [{ e: 'costThen', prompt: '犧牲神器抓牌？', cost: { sac: { type: 'Artifact' } }, then: [draw] }]),
]);
a(41, []);
d(42, { aura: { target: CR, grant: {} }, abilities: [F('burden')] });
equip(43, '{2}', { p: 1, t: 1 }, trig('attacks', [{ e: 'surveil', n: 2 }]));
caseCard(44, [
  etb([clue]),
  act({ mana: '{2}{U}', sacSelf: true }, [E(44)], '破解：神器變成鳥', {
    cond: C('solved'),
    targets: [spec('permanent', { type: 'Artifact', nonType: 'Creature' })],
  }),
]);
caseCard(45, [{ kind: 'static', spellCostLess: { filter: { type: ['Instant', 'Sorcery'] }, n: 1 } }, solved('castInstSorc', [draw])]);
a(46, [trig('dies', [clue])]);
a(47, [F('evidenceFree')]);
a(48, [
  trig('attacks', [E('gainOwned')], { targets: [spec('permanent', { owner: 'you', ctrl: 'opp' })] }),
  { ...(up([E(48)]) as TriggeredAbility), mkmDynamic: 'falcon' },
]);
a(49, [
  etb(
    [
      { e: 'tap', what: 'T0' },
      { e: 'if', cond: C('evidence'), then: [{ e: 'stun', what: 'T0' }] },
    ],
    { targets: [CR] },
  ),
]);
d(49, { mkm: { optionalEvidence: 6 } });
d(50, {
  equip: { cost: '', manual: true, grant: { p: 1, kw: ['unblockable'] } },
  abilities: [etb([E(50)]), act({ mana: '{1}{U}' }, [{ e: 'bounce', what: 'self' }], '回手')],
});
d(51, { aura: { target: CR, grant: { p: 1, t: 1 } }, abilities: [event('enchantedHit', [clue])] });
s(52, [draw, clue]);
d(53, {
  aura: { target: CR, grant: { noUntap: true } },
  abilities: [etb([{ e: 'tap', what: 'attached' }]), act({ mana: '{U}{U}' }, [E(53)], '洗回牌庫')],
});
s(54, [clue, pump(opp, -2), E('clearOppSuspects')]);
d(55, { evadePowGte: 3 });
a(55, [up([{ e: 'bounce', what: 'T0' }], [spec('creature', { other: true })])]);
d(56, { aura: { target: CR, grant: { p: 1, kw: ['flying'] } }, abilities: [etb([pump('attached', 0, 0, ['hexproof'])])] });
a(57, [trig('castAny', [clue], { filter: { type: 'Artifact' } }), F('gadgetDiscount')]);
a(58, [
  act({ tap: true }, [{ e: 'untap', what: 'T0' }], '重置另一永久物', { targets: [spec('permanent', { ctrl: 'you', other: true })] }),
  act({ tap: true }, [{ e: 'tap', what: 'T0' }], '蒐證3：橫置生物', { evidence: 3, targets: [OPP_CR] }),
]);
a(59, [trig('attacks', [draw, { e: 'discard', n: 1, who: 'you' }]), F('courier')]);
a(60, [etb([E(60)], { targets: [spec('creature', { other: true }, true)] })]);
s(61, [E(61)]);
a(62, [trig('drawSecond', [{ e: 'grant', what: 'self', grant: { removeKw: ['defender'], kw: ['vigilance'] } }])]);
a(63, [F('emptyLibrary')]);
a(64, [{ ...(etb([E(64)]) as TriggeredAbility), mkmDynamic: 'maze' }, F('tappedHexproof')]);
a(65, [up([E(65)])]);
s(
  66,
  [{ e: 'tap', what: 'T0' }, { e: 'tap', what: 'T1' }, { e: 'stun', what: 'T0' }, { e: 'stun', what: 'T1' }, clue],
  [
    { ...CR, optional: true },
    { ...CR, optional: true },
  ],
);
a(67, [
  etb([draw]),
  F('noMaxHand'),
  trig('combatStart', [cnt('T0', N('extraDraws'))], { cond: { c: 'drawsGte', n: 2 }, targets: [MY_CR] }),
]);
a(68, [event('detectiveEntersUp', [{ e: 'may', prompt: '抓一棄一？', effects: [draw, { e: 'discard', n: 1, who: 'you' }] }])]);
s(
  69,
  [
    { e: 'counterUnless', what: 'T0', pay: 2 },
    { e: 'suspect', what: 'T1' },
  ],
  [spec('spell'), { ...CR, optional: true }],
);
s(70, [E(70)], [spec('gyCard', { nonType: 'Land', gyThisTurn: true })]);
a(71, [etb([{ e: 'draw', n: 2 }, E(71)])]);
s(72, [E(72)], [spec('spellOrPermanent', { nonType: 'Land' })]);
a(73, [etb([E('collect', undefined, 4)]), event('evidence', [{ e: 'token', token: 'tok-thopter' }])]);
s(
  74,
  [
    { e: 'bounce', what: 'T0' },
    { e: 'surveil', n: 1 },
  ],
  [spec('permanent', { nonType: 'Land' })],
);
a(75, [act({ mana: '{2}{B}', sacOther: { type: 'Creature' } }, [E(75)], '犧牲另一生物：抓牌')]);
a(76, [up([lose(3), gain(3)], [OPP])]);
a(77, [
  etb([{ e: 'suspect', what: 'self' }]),
  trig('combatDamagePlayer', [draw, { e: 'lose', n: 1, who: 'you' }]),
  trig('dealtDamage', [lose({ ev: true })]),
]);
a(78, [trig('combatDamagePlayer', [gain(1), { e: 'surveil', n: 1 }])]);
caseCard(79, [etb([destroy], { targets: [spec('creature', { damaged: true }, true)] })]);
caseCard(80, [
  etb([tok('skeleton'), { e: 'suspect', what: 'created' }]),
  act({ mana: '{1}{B}', sacSelf: true }, [{ e: 'tutor', filter: {} }], '破解：搜尋牌', { cond: C('solved'), sorcery: true }),
]);
modes(81, [
  { text: '棄兩張', targets: [OPP], effects: [{ e: 'discard', who: 'T0', n: 2 }] },
  { text: '選擇非地牌', targets: [OPP], effects: [{ e: 'discardChosen', who: 'T0', filter: { nonType: 'Land' } }] },
]);
a(82, [
  etb([{ e: 'suspect', what: 'T0' }], { targets: [spec('creature', { ctrl: 'you', other: true }, true)] }),
  event('suspectAttack', [{ e: 'surveil', n: 1 }]),
]);
s(83, [{ e: 'destroy', what: { all: { type: 'Creature' } } }, E(83)]);
d(83, { mkm: { optionalEvidence: 6 } });
s(84, [E(84)]);
d(84, { mkm: { optionalEvidence: 6 } });
a(85, [
  trig('combatDamagePlayer', [{ e: 'mill', n: 2 }]),
  act({ mana: '{1}{B}' }, [pump('self', 2, 2)], '每回合一次：+2/+2', { oncePerTurn: true }),
]);
a(86, [event('nontokenDies', [clue], { oncePerTurn: true })]);
a(87, [etb([{ e: 'token', token: 'tok-mkm-dog', n: 2, who: 'opp' }], { targets: [OPP] }), trig('dies', [lose(3)])]);
a(88, [etb([E(88)]), event('impostorDies', [E('impostor')], { targets: [gy({ type: 'Creature' }, true)] })]);
s(
  89,
  [
    { e: 'reanimate', what: 'T0' },
    { e: 'suspect', what: 'T0' },
  ],
  [gy({ type: 'Creature' })],
);
equip(90, '{2}', { p: 2 }, trig('dies', [lose(1)]));
a(91, [
  act({ mana: '{2}{B}{B}', exileSelf: true }, [{ e: 'token', token: 'tok-mkm-bat', n: 2, tapped: true }], '從墳墓場放逐：兩隻蝙蝠', {
    fromGraveyard: true,
  }),
]);
s(92, [destroy], [spec('creatureOrPlaneswalker', { mvMax: 3 })]);
d(93, { costReduce: { cond: C('creatureGy'), mana: '{2}' } });
s(
  93,
  [
    { e: 'toHand', what: 'T0' },
    { e: 'toHand', what: 'T1' },
  ],
  [gy({ type: 'Creature' }, true), gy({ type: 'Creature' }, true)],
);
a(94, [
  { kind: 'static', anthem: { filter: { ctrl: 'you', type: 'Creature' }, grant: { kw: ['wither'] } } },
  event('zeroToughnessDies', [draw]),
]);
s(95, [destroy], [CR]);
a(96, [etb([{ e: 'lose', n: 3, who: 'you' }])]);
s(97, [E(97)], [OPP]);
a(98, [etb([clue]), event('clueSac', [E('poison')], { targets: [OPP] })]);
a(99, [
  etb([
    { e: 'dig', n: 4, take: 2, rest: 'graveyard' },
    { e: 'lose', n: 2, who: 'you' },
  ]),
  act({ mana: '{2}', tap: true }, [E(99)], '蒐證3：對手支付或失去3生命', { evidence: 3 }),
]);
s(100, [pump('T0', 2), { e: 'delayed', on: 'dies', what: 'T0', effects: [E('returnSuspect')], once: true }], [CR]);
a(101, [act({ mana: '{2}{B}' }, [E(101)], '懷疑或放置指示物')]);
a(102, [event('creatureGyLeaves', [pump('self', 1, 0, ['menace', 'lifelink'])])]);
s(103, [pump('T0', { negOf: { x: true } }, { negOf: { x: true } })], [CR]);
a(104, [trig('combatStart', [pump('T0', 1, 0, ['deathtouch'])], { targets: [spec('creature', { ctrl: 'you', powMax: 2 })] })]);
a(105, [trig('allyEtb', [{ e: 'surveil', n: 1 }], { filter: { powMax: 2, other: true } })]);
a(106, [etb([pump('T0', -4, -4)], { targets: [CR] }), event('creatureGyLeaves', [lose(1), gain(1)])]);
s(107, [pump('T0', 0, 0, ['deathtouch', 'lifelink']), clue], [CR]);
a(108, [etb([E(108)])]);
a(109, [etb([E(109)], { targets: [OPP] })]);
a(110, [event('anyDies', [lose(2), gain(2)], { targets: [OPP] }), F('sacWard')]);
s(111, [E(111)]);
a(112, []);
caseCard(113, [etb([dmg(3)], { targets: [OPP_CR] }), act({ sacSelf: true }, [E(113)], '破解：選擇放逐牌使用', { cond: C('solved') })]);
caseCard(114, [
  etb([
    { e: 'discard', n: 1, who: 'you' },
    { e: 'draw', n: 2 },
  ]),
  solved('upkeep', [E('discardHand'), { e: 'draw', n: 2 }]),
]);
s(115, [E(115), { e: 'suspect', what: 'T0' }], [CR]);
s(116, [pump('T0', 3, 0, ['first_strike']), clue], [CR]);
d(117, { equip: { cost: '{1}{R}', grant: { p: 3 } }, abilities: [up([{ e: 'attach', what: 'T0' }], [MY_CR])] });
a(118, [trig('allyAttacks', [E(118)]), act({ mana: '{1}{R}', sacSelf: true }, [E('dotsReturn')], '棄手牌並取回放逐牌')]);
d(119, {
  aura: { target: CR, grant: { p: 1, t: 1 } },
  abilities: [
    etb([{ e: 'suspect', what: 'attached' }]),
    act({ mana: '{2}{R}' }, [{ e: 'toHand', what: 'selfAny' }], '從墳墓場回手', { fromGraveyard: true }),
  ],
});
a(120, [etb([E(120)])]);
a(121, [event('artifactSac', [cnt('self'), { e: 'addMana', mana: ['R'] }])]);
modes(122, [
  { text: '棄一張牌：抓兩張', effects: [{ e: 'draw', n: 2 }] },
  { text: '犧牲神器：抓兩張', sac: { type: 'Artifact' }, effects: [{ e: 'draw', n: 2 }] },
]);
d(122, { addCost: undefined, mkm: {} });
a(123, [event('anyDamaged', [E(123)])]);
modes(124, [
  { text: '翻正面', targets: [spec('creature', { faceDown: true })], effects: [E('faceUp', 'T0')] },
  { text: '重新斗篷', effects: [E(124)] },
  { text: '兩項', targets: [spec('creature', { faceDown: true })], effects: [E('faceUp', 'T0'), E(124)] },
]);
s(
  125,
  [pump('T0', 2, 0, ['haste']), { e: 'delayed', on: 'dies', what: 'T0', effects: [{ e: 'token', token: 'tok-detective' }], once: true }],
  [MY_CR],
);
a(126, [etb([{ e: 'suspect', what: 'self' }]), event('otherCreatureEtb', [E(126)])]);
a(127, [up([E('discardHand'), { e: 'draw', n: 3 }])]);
s(128, [{ e: 'if', cond: { c: 'drawsGte', n: 2 }, then: [dmg(5)], else: [dmg(3)] }], [CR]);
a(129, [etb([E(129)])]);
a(130, [trig('attacks', [E(130)])]);
a(131, [trig('combatStart', [{ e: 'token', token: 'tok-thopter', temp: true }, pump('created', 0, 0, ['haste'])])]);
a(132, [trig('combatDamagePlayer', [E(132)])]);
a(133, [trig('dealtDamage', [clue], { when: C('damage3') })]);
equip(134, '{2}', {});
a(134, [act({ mana: '{2}', sacSelf: true }, [draw], '犧牲抓牌'), F('knife')]);
a(135, [
  act({ tap: true, sacOther: { type: 'Artifact' } }, [cnt({ all: { ctrl: 'you', sub: 'Goblin' } })], '犧牲神器：強化鬼怪'),
  event('artifactGy', [
    { e: 'costThen', prompt: '支付{R}派鬼怪？', cost: { mana: '{R}' }, then: [tok('goblin'), pump('created', 0, 0, ['haste'])] },
  ]),
]);
a(136, [etb([E(136)])]);
a(137, [trig('dies', [E(137)])]);
a(138, both([pump('T0', 2)], [{ ...CR, optional: true }]));
a(139, [
  etb([
    { e: 'suspect', what: 'self' },
    { e: 'token', token: 'tok-detective' },
  ]),
]);
a(140, [event('creatureUp', [dmg({ power: 'evCard' }, 'opp', 'evCard')])]);
a(141, [trig('attacks', [E(141)])]);
a(142, [F('mustAttack'), act({ mana: '{2}', sacSelf: true }, [draw], '犧牲抓牌')]);
a(143, [trig('attacks', [E(143)])]);
s(144, [dmg(2)], [ANY]);
s(145, [dmg(4)], [CR]);
d(145, { costReduce: { cond: C('artifactSac'), mana: '{3}' } });
s(146, [dmg(N('twiceX')), E(146)], [CR]);
a(147, [event('oppArtifactSac', [dmg(2, 'opp')])]);
a(148, [etb([{ e: 'mill', n: 3 }]), act({ mana: '{3}{G}', sacSelf: true }, [E(148)], '犧牲：返場所有地')]);
d(149, {
  aura: { target: CR, grant: { p: 2, t: 2 } },
  abilities: [etb([{ e: 'untap', what: 'attached' }, pump('attached', 0, 0, ['hexproof']), E('unsuspect', 'attached')]), F('noSuspect')],
});
s(150, [E(150)]);
d(150, { mkm: { optionalEvidence: 8 } });
modes(151, [
  { text: '搜尋生物或地', effects: [E(151)] },
  { text: '指示物與傷害', targets: [MY_CR, OPP_CR], effects: [cnt('T0'), { e: 'bite', a: 'T0', b: 'T1' }] },
  { text: '放逐神器或結界', targets: [spec('permanent', { type: ['Artifact', 'Enchantment'] })], effects: [exile] },
]);
s(152, [tok('plant'), { e: 'draw', n: N('tokenNames') }]);
a(153, [F('evidenceWard')]);
s(154, [pump('T0', 2), { e: 'bite', a: 'T0', b: 'T1' }], [MY_CR, OPP_CR]);
d(154, { mkm: { optionalEvidence: 6 } });
caseCard(155, [{ kind: 'static', extraLand: 1 }, F('hothouse')]);
caseCard(156, [
  { ...(etb([E('distribute', undefined, 2)]) as TriggeredAbility), mkmDynamic: 'distribute2' },
  solved('youAttack', [cnt('T0'), pump('T0', 0, 0, ['trample'])], { targets: [spec('creature', { attacking: true })] }),
]);
a(157, [event('creatureGyLeaves', [{ e: 'token', token: 'tok-detective' }, clue])]);
a(158, both([E('mustBlock', 'T0')], [CR]));
s(159, [pump('T0', 3, 3, ['trample'])], [CR]);
a(160, [{ kind: 'static', self: { grant: {} } } as Ability, up([E(160)])]);
s(161, [pump('T0', { count: { ctrl: 'you', type: 'Creature' } }, { count: { ctrl: 'you', type: 'Creature' } }, ['reach'])], [CR]);
a(162, [{ ...(etb([E('distribute', undefined, 3), gain(N('maxToughness'))]) as TriggeredAbility), mkmDynamic: 'distribute3' }]);
a(163, [up([cnt(mine), pump(mine, 0, 0, ['trample'])])]);
s(164, [{ e: 'bite', a: 'T0', b: 'T1' }], [MY_CR, spec('creatureOrPlaneswalker', { ctrl: 'opp' })]);
a(165, [
  F('mayStayTapped'),
  act({ mana: '{3}{G}', tap: true }, [E(165)], '蒐證4：地成為5/5', {
    evidence: 4,
    sorcery: true,
    targets: [spec('permanent', { ctrl: 'you', type: 'Land' })],
  }),
]);
s(166, [E(166)]);
a(167, [
  etb([tok('human'), tok('merfolk'), tok('goblin'), E(167)]),
  act({ sacSelf: true }, [E('killer')], '揭示類別：強化攻擊衍生物', { targets: [spec('creature', { attacking: true, token: true })] }),
]);
a(168, [etb([clue]), trig('drawSecond', [pump('self', 1, 1, ['vigilance'])])]);
a(169, [up([{ e: 'tutor', filter: { type: 'Land', sub: ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest'] } }])]);
modes(170, [
  { text: '犧牲神器', effects: [sac({ type: 'Artifact' })] },
  { text: '犧牲結界', effects: [sac({ type: 'Enchantment' })] },
  { text: '犧牲飛行生物', effects: [sac({ type: 'Creature', kw: 'flying' })] },
]);
a(171, [{ kind: 'static', self: { cond: { c: 'yourTurn' }, grant: { kw: ['hexproof'] } } }, F('namedOnly')]);
a(172, [
  F('prideDiscount'),
  act(
    { mana: '{2}{U}{U}' },
    [
      pump('T0', 1),
      { e: 'grant', what: 'T0', grant: { ignoreDefender: true } },
      { e: 'delayed', on: 'combatDamagePlayer', what: 'T0', effects: [{ e: 'draw', n: N('sourceToughness') }] },
    ],
    '依防禦力抓牌',
    { targets: [MY_CR] },
  ),
]);
equip(173, '{3}', { p: 1, t: 2, kw: ['reach'], onlyOneBlocker: true });
a(174, [
  etb([{ e: 'surveil', n: 2 }]),
  act({ mana: '{G}', exileSelf: true }, [cnt('T0')], '從墳墓場放逐：指示物', { fromGraveyard: true, sorcery: true, targets: [CR] }),
]);
a(175, [trig('attacks', [E(175)])]);
a(176, [trig('allyEtb', [E(176)])]);
s(177, [E(177)]);
d(177, { anyNumber: true } as Partial<CardDef>);
s(178, [{ e: 'searchLand', to: 'battlefield', tapped: true }, clue]);
a(179, []);
a(180, [trig('endStep', [cnt('self')], { cond: C('faceDownEntered') })]);
d(180, { produces: ['G'] });
a(181, [
  trig(
    'upkeep',
    [
      { e: 'reanimate', what: 'T0' },
      { e: 'tap', what: 'T0' },
    ],
    { targets: [gy({ type: 'Land' })] },
  ),
]);
a(182, [up([destroy], [spec('permanent', { ctrl: 'opp', type: ['Artifact', 'Enchantment'] })])]);
a(183, [etb([cnt('T0'), gain(2)], { cond: C('evidence'), targets: [CR] })]);
d(183, { mkm: { optionalEvidence: 6 } });
a(184, [etb([E(184)], { targets: [{ ...CR, optional: true }] }), trig('attacks', [E(184)], { targets: [{ ...CR, optional: true }] })]);
a(185, [
  etb([clue]),
  act({ mana: '{W}{U}{U}', tap: true, sacOther: { sub: 'Clue' } }, [{ e: 'draw', n: { x: true } }, gain({ x: true })], 'X抓牌與生命', {
    xMana: 1,
  }),
]);
a(186, [
  event('blocked', [{ e: 'untap', what: mine }, E('extraCombat')]),
  act({ mana: '{3}{R}{R}{G}{G}' }, [E('mustBlock', 'self')], '必須被阻擋'),
]);
s(187, [destroy, { e: 'searchLand', to: 'battlefield', who: 'T0ctrl' }], [spec('permanent', { ctrl: 'opp' })]);
a(188, [event('anyAttackThree', [draw]), event('anyAttackFive', [dmg(3, 'opp'), gain(3)])]);
a(189, [etb([dmg(3)], { targets: [OPP_CR] }), event('oneOrMoreDies', [{ e: 'mill', n: 1 }, E(189)])]);
s(190, [E(190)]);
d(191, {
  aura: { target: spec('permanent', { type: 'Land' }), grant: {} },
  abilities: [etb([{ e: 'exileLinked', what: 'T0' }], { targets: [spec('permanent', { ctrl: 'opp', nonType: 'Land' })] }), F('gardenMana')],
});
d(192, { aura: { target: CR, grant: { kw: ['deathtouch'] } }, abilities: [etb([E(192)])] });
a(193, [up([cnt('self', N('otherCreatures'))])]);
a(194, [event('clueSac', [{ e: 'toHand', what: 'selfAny' }], { fromGraveyard: true })]);
modes(195, [
  { text: '消滅', targets: [CR], effects: [destroy] },
  {
    text: '指示物及取消懷疑',
    targets: [spec('creature', { ctrl: 'you', suspected: true })],
    effects: [cnt('T0'), E('mayUnsuspect', 'T0')],
  },
  {
    text: '兩項',
    targets: [CR, spec('creature', { ctrl: 'you', suspected: true })],
    effects: [destroy, cnt('T1'), E('mayUnsuspect', 'T1')],
  },
]);
a(196, [etb([clue, clue]), act({ tap: true }, [{ e: 'token', token: 'tok-thopter' }], '派出機械鳥', { cond: C('artifactSac') })]);
a(197, [up([{ e: 'token', token: 'tok-mkm-dog', n: 2, tapped: true }])]);
s(198, [E(198)]);
d(198, { ecl: { variableTargets: 'creature' } });
a(199, []);
s(199, [
  { e: 'token', token: 'tok-detective' },
  { e: 'if', cond: { c: 'morbid' }, then: [gain(2), { e: 'surveil', n: 2 }, clue] },
]);
a(200, [F('etrata'), event('assassinHit', [E(200)])]);
a(201, [trig('combatStart', [E('collect', undefined, 4)]), event('evidence', [clue])]);
a(202, [etb([clue, clue]), act({ mana: '{1}', sacOther: { type: 'Artifact' } }, [E(202)], '選擇警戒、繫命或辟邪')]);
a(203, [up([{ e: 'dig', n: 2, take: 1, rest: 'graveyard' }])]);
a(204, both([{ e: 'token', token: 'tok-thopter' }]));
a(205, [etb([clue]), event('artifactSac', [cnt('self')])]);
a(206, [up([E(206)], [CR])]);
s(207, [{ e: 'draw', n: 2 }, E(207)]);
a(208, [
  { kind: 'static', manaGrant: { filter: { ctrl: 'you', type: 'Creature', token: true }, colors: ['W', 'U', 'B', 'R', 'G'] } },
  event('creatureGyLeaves', [tok('plant'), cnt({ all: { ctrl: 'you', sub: 'Plant' } })]),
]);
a(209, [
  etb([E(209)]),
  trig('attacks', [E(209)]),
  act({}, [{ e: 'surveil', n: 2 }, { e: 'draw', n: 2 }, gain(2)], '犧牲四衍生物', { sacN: { n: 4, filter: { token: true } } }),
]);
a(210, [trig('castInstSorc', [E(210)])]);
d(211, {
  loyalty: 3,
  abilities: [
    event('creatureExiled', [E('kayaCopy')]),
    act({ loyalty: 2 }, [{ e: 'surveil', n: 2 }, E('kayaExile')], '+2 刺探及放逐'),
    act({ loyalty: 1 }, [tok('spirit')], '+1 精靈'),
    act({ loyalty: -2 }, [exile, { e: 'exile', what: 'T1' }], '-2 放逐雙方生物', { targets: [MY_CR, { ...OPP_CR, optional: true }] }),
  ],
});
a(212, [trig('attacks', [E(212)], { targets: [spec('permanent', { type: 'Artifact' }, true)] })]);
d(212, {
  adventure: {
    name: 'Tail the Suspect',
    cost: '{G}{U}',
    types: ['Sorcery'],
    text: 'Investigate. You may play an additional land this turn.',
    spell: { effects: [clue, { e: 'extraLandThisTurn' }] },
  },
});
a(213, [etb([destroy], { targets: [spec('permanent', { ctrl: 'opp', token: true })] })]);
a(214, [trig('attacks', [E(214)])]);
a(215, [
  act({}, [E(215)], '蒐證6：載具成為生物', { evidence: 6 }),
  act({ crew: 2 }, [{ e: 'animate', what: 'self', p: 8, t: 3 }], '駕駛2'),
  trig('attacks', [E('voltCast')]),
]);
a(216, [trig('attacks', [E(216), clue], { targets: [spec('gyCard')] }), event('clueSac', [E('lazavCopy')])]);
a(217, [F('guildpact')]);
d(217, { leyline: true });
s(218, [dmg(3), gain(3)], [ANY]);
a(219, [event('attackThree', [clue])]);
a(220, [
  trig('combatDamagePlayer', [dmg(N('pairs')), { e: 'draw', who: 'T1', n: N('pairs') }, gain(N('pairs'))], {
    targets: [ANY, spec('player')],
  }),
  F('multicolorHexproof'),
]);
s(221, [E(221)], [spec('spell')]);
modes(222, [
  { text: '調查自己', effects: [E('interrogateSelf')] },
  { text: '調查對手', effects: [E('interrogateOpp')] },
  { text: '調查雙方（多付{W}{U}）', cost: '{W}{U}', effects: [E('interrogateBoth')] },
]);
a(223, [
  { kind: 'static', anthem: { filter: { ctrl: 'you', sub: 'Detective', other: true }, grant: { p: 1, t: 1 } } },
  trig('drawSecond', [pump('T0', 0, 0, ['unblockable'])], { targets: [spec('creature', { sub: 'Detective' })] }),
]);
a(224, [trig('endStep', [E(224)], { targets: [OPP] })]);
a(225, both([pump('T0', 0, 0, ['indestructible'])], [CR]));
s(
  226,
  [
    { e: 'reanimate', what: 'T0' },
    { e: 'reanimate', what: 'T1' },
    { e: 'reanimate', what: 'T2' },
  ],
  [gy({ type: 'Artifact' }, true), gy({ type: 'Land' }, true), gy({ type: 'Enchantment', nonSub: 'Aura' }, true)],
);
s(227, [cnt('T0', { x: true }), E(227)], [MY_CR, { ...spec('spell'), optional: true }]);
a(228, []);
a(229, [
  etb([{ e: 'suspect', what: 'T0' }], { targets: [{ ...MY_CR, optional: true }] }),
  act({ mana: '{3}{B}{R}', sacOther: { type: 'Creature', suspected: true } }, [pump('T0', -5, -5)], '犧牲嫌犯：-5/-5', { targets: [CR] }),
]);
a(230, [up([pump('T0', 0, 0, ['lifelink'])], [spec('creature', { ctrl: 'you', other: true })])]);
a(231, [trig('dies', [dmg(2)], { targets: [ANY] })]);
s(232, [E(232)], [OPP]);
a(233, [event('creatureUp', [cnt('evCard'), cnt('self')])]);
a(234, [trig('endStep', [{ e: 'if', cond: { c: 'oppLostLife' }, then: [clue] }]), event('clueGy', [tok('spirit')], { oncePerTurn: true })]);
d(235, { produces: undefined, abilities: [act({ tap: true }, [E(235)], '產{R}{G}，限面朝下咒語及翻正面')] });
a(236, [etb([tok('voja')]), event('wolfAttack', [E(236)])]);
s(237, [{ e: 'draw', n: 3 }, lose(3), gain(3)]);
d(237, { addCost: { sac: { type: 'Creature', dealtDamage: true } } });
a(238, [
  act({ mana: '{1}{G}' }, [pump('T0', 0, 0, ['deathtouch'])], '死觸', { targets: [CR] }),
  act({ mana: '{G/W}' }, [pump('T0', 0, 0, ['vigilance'])], '警戒', { targets: [CR] }),
  act({ mana: '{2}{W}' }, [pump('T0', 0, 0, ['double_strike'])], '連擊', { targets: [CR] }),
]);
a(239, [trig('combatDamagePlayer', [clue])]);
s(
  240,
  [{ e: 'destroy', what: 'T0' }, { e: 'destroy', what: 'T1' }, { e: 'destroy', what: 'T2' }, E('destroyFourth')],
  [
    spec('permanent', { type: 'Artifact' }, true),
    spec('creature', {}, true),
    spec('permanent', { type: 'Enchantment' }, true),
    spec('permanent', { type: 'Planeswalker' }, true),
  ],
);
d(240, { mkm: { evidence: -1 } });
a(241, [trig('combatStart', [E(241)])]);
a(242, [
  { kind: 'static', anthem: { filter: { ctrl: 'you', type: 'Creature' }, grant: { p: 1, t: 1 } } },
  trig('allyEtb', [dmg(1, 'opp')]),
]);
a(243, [
  trig('allyEtb', [lose(1), gain(1)], { filter: { other: true, powMax: 2 } }),
  act(
    { mana: '{5}{W}{B}' },
    [pump({ all: { ctrl: 'you', type: 'Creature', powMax: 2 } }, 0, 0, ['deathtouch', 'lifelink'])],
    '小生物死觸與繫命',
  ),
]);
s(244, [dmg({ x: true }), E(244)], [ANY]);
a(245, [
  { kind: 'static', anthem: { filter: { ctrl: 'you', type: 'Creature', other: true }, grant: { kw: ['haste'] } } },
  event('faceDownCombat', [draw]),
  event('faceDownDies', [E(245)]),
]);
// Split cards share a card but each half is a separate casting option.
s(
  246,
  [exile, { e: 'exile', what: 'T1' }, E('ceasePlayer')],
  [spec('gyCard', {}, true), { ...spec('gyCard', {}, true), sameGraveyardAs: 0 }],
);
s(247, [{ e: 'mill', n: 3 }, clue]);
s(248, [cnt({ all: { ctrl: 'you', attacking: true } })]);
s(249, [E('mustAttackBlock', 'T0')], [CR]);
s(250, [destroy], [spec('creature', { tapped: true })]);
a(251, [
  act({ tap: true }, [E('cryptexMana')], '蒐證3：產法力及解鎖', { evidence: 3 }),
  act(
    { sacSelf: true },
    [
      { e: 'surveil', n: 3 },
      { e: 'draw', n: 3 },
    ],
    '五個解鎖：犧牲',
    { cond: C('unlocked') },
  ),
]);
a(252, [
  act({ mana: '{1}' }, [E('manaAny')], '產任意色', { oncePerTurn: true }),
  act({ mana: '{2}', exileSelf: true }, [exile], '從墳墓場放逐', { fromGraveyard: true, targets: [spec('gyCard')] }),
]);
a(253, [act({ mana: '{2}' }, [E('lookHidden')], '本回合查看對手面朝下生物')]);
a(254, [etb([E(254)], { targets: [gy({ sub: 'Equipment' })] }), event('artifactSac', [cnt('self')])]);
a(255, [act({ mana: '{4}', tap: true }, [clue], '調查')]);
d(255, { produces: ['C'] });
a(256, [etb([{ e: 'surveil', n: 1 }])]);
d(257, {
  equip: { cost: '{3}', grant: { p: 1, t: 2 } },
  abilities: [
    act({ mana: '{1}' }, [{ e: 'attach', what: 'T0' }], '裝備偵探', {
      sorcery: true,
      targets: [spec('creature', { ctrl: 'you', sub: 'Detective' })],
    }),
  ],
});
a(258, [up([E(258)])]);
d(258, { produces: ['C'] });
for (const n of [259, 260, 262, 263, 264, 266, 268, 269, 270, 271]) a(n, [etb([{ e: 'surveil', n: 1 }])]);
a(261, [
  act({ tap: true, sacSelf: true }, [{ e: 'searchLand', to: 'battlefield', tapped: true }], '搜尋基本地'),
  act({ tap: true, sacSelf: true }, [pump('T0', 0, 0, ['unblockable'])], '力量2以下不能被阻擋', {
    targets: [spec('creature', { powMax: 2 })],
  }),
]);
d(261, { produces: undefined });
a(265, [etb([E(265)])]);
d(265, { produces: ['W', 'U', 'B', 'R', 'G'] });
a(267, [
  act({ tap: true, tapN: { n: 1, filter: { type: 'Creature' } } }, [E('manaAny')], '產任意色'),
  act({ mana: '{2}', sacSelf: true }, [draw], '犧牲抓牌'),
]);
d(267, { produces: ['C'] });
export function completeMkm() {
  for (const row of catalog) {
    const patch = patches.get(row.number);
    if (!patch) throw new Error('MKM missing ' + row.name);
    const old = defs.find((c) => c.id === slug(row.name));
    const c = { ...row, ...patch, id: slug(row.name), text: row.text } as unknown as CardDef;
    if (old && ['escape-tunnel', 'make-your-move', 'murder', 'shock', 'lightning-helix'].includes(c.id)) c.set = old.set;
    if (row.number >= 246 && row.number <= 250) {
      const b = row.back!;
      c.mkm = { split: true };
      c.back = undefined;
      c.adventure = { ...b, name: b.name, spell: { effects: [E('split' + row.number)] } } as CardDef['adventure'];
    }
    if (old) {
      for (const key of Object.keys(old)) delete (old as unknown as Record<string, unknown>)[key];
      Object.assign(old, c);
    } else add(c);
  }
}
