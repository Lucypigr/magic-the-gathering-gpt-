// TMT 001–190；來源與規則差異見 docs/tmt.md。
import catalog from './tmt-catalog.json';
import type { Ability, ActivatedAbility, CardDef, Cond, Effect, Filter, Grant, Ref, TargetSpec } from '../../engine/types';
import { defs as registered, add, slug, etb, trig, act, CR, MY_CR, OPP_CR, OPP } from '../dsl';
const mine: Ref = { all: { type: 'Creature', ctrl: 'you' } };
const allCreatures: Ref = { all: { type: 'Creature' } };
const food: Effect = { e: 'token', token: 'tok-food' };
const mutagen: Effect = { e: 'token', token: 'tok-mutagen' };
const draw: Effect = { e: 'draw', n: 1 };
const counter: Effect = { e: 'counters', what: 'self', n: 1 };
const disappear: Cond = { c: 'disappeared' };
const spec = (kind: TargetSpec['kind'], filter?: Filter, optional = false): TargetSpec => ({ kind, filter, optional });
const myArtifact = spec('permanent', { type: 'Artifact', ctrl: 'you' });
const myGy = spec('gyCard', { type: 'Creature', ctrl: 'you' });
const special = (action: string, n?: number, what?: Ref): Effect => ({
  e: 'tmt',
  action,
  n,
  what,
});
const pump = (what: Ref, p = 0, t = 0, kw: Grant['kw'] = []): Effect => ({
  e: 'pump',
  what,
  p,
  t,
  kw,
});
const count = (what: Ref, n = 1): Effect => ({ e: 'counters', what, n });
const ab = (abilities: Ability[]): Partial<CardDef> => ({ abilities });
const spell = (effects: Effect[], targets?: TargetSpec[]): Partial<CardDef> => ({ spell: { effects, targets } });
const st = (grant: Grant, cond?: Cond): Ability => ({
  kind: 'static',
  self: { grant, cond },
});
const level = (n: number): Cond => ({ c: 'classLevel', n });
const upgrade = (from: number, mana: string, effects: Effect[] = []): ActivatedAbility =>
  act({ mana }, [special('level', from + 1)], `升至等級${from + 1}`, {
    sorcery: true,
    levelUp: { from, to: from + 1 },
  });
const defs = new Map<string, Partial<CardDef>>();
function d(name: string, text: string, patch: Partial<CardDef>) {
  defs.set(name, { text, ...patch });
}

d("April O'Neil, Kunoichi Trainee", '進場占卜2。不能被力量至少3的生物阻擋。', {
  evadePowGte: 3,
  abilities: [etb([{ e: 'scry', n: 2 }])],
});
d('Dimensional Exile', '結附你的基本地。進場放逐對手生物直到此光環離場。', {
  aura: {
    target: spec('permanent', { type: 'Land', basic: true, ctrl: 'you' }),
    grant: {},
  },
  abilities: [etb([{ e: 'exileLinked', what: 'T0' }], { targets: [OPP_CR] })],
});
d('Featherbrained Filcher', '飛行。離場時派出食物。', ab([trig('leaves', [food])]));
d(
  'Koya, Death from Above',
  '飛行。進場可放逐另一個生物；下一個結束步驟支付{3}{B}，否則讓它回場。',
  ab([
    etb([special('koya')], {
      targets: [{ ...CR, notSelf: true, optional: true }],
    }),
  ]),
);
d(
  "The Last Ronin's Technique",
  '潛行{1}{W}。派出三個1/1白色忍者龜精靈；潛行時它們橫置且攻擊。',
  spell([
    {
      e: 'if',
      cond: { c: 'sneaked' },
      then: [
        {
          e: 'token',
          token: 'tok-tmt-turtle-spirit',
          n: 3,
          tapped: true,
          attacking: true,
        },
      ],
      else: [{ e: 'token', token: 'tok-tmt-turtle-spirit', n: 3 }],
    },
  ]),
);
d(
  "Leader's Talent",
  '攻擊時在一個攻擊生物上放指示物。{2}{W}升2：你的有指示物生物離場時獲得2生命。{3}{W}升3：施放咒語時全軍放指示物。',
  ab([
    trig('youAttack', [count('T0')], {
      targets: [spec('creature', { attacking: true })],
    }),
    upgrade(1, '{2}{W}'),
    trig('allyLeaves', [special('leaderLife')], {
      filter: { type: 'Creature', hasCounters: true },
      includeSelf: true,
      when: level(2),
    }),
    upgrade(2, '{3}{W}'),
    trig('castAny', [count(mine)], { when: level(3) }),
  ]),
);
d(
  'Leonardo, Big Brother',
  '潛行{W}。每個你的其他生物使其力量+1。',
  ab([
    {
      kind: 'static',
      selfPowerCount: { type: 'Creature', ctrl: 'you', other: true },
    },
  ]),
);
d('Leonardo, Cutting Edge', '潛行{W}，繫命。獲得生命時放指示物。', ab([trig('lifegain', [counter])]));
d(
  'Leonardo, Leader in Blue',
  '潛行{3}{W}{W}。以潛行進場時全軍本回合+2/+0。{1}{W}：本回合先攻。',
  ab([
    etb([{ e: 'if', cond: { c: 'sneaked' }, then: [pump(mine, 2, 0)] }]),
    act({ mana: '{1}{W}' }, [pump('self', 0, 0, ['first_strike'])], '獲得先攻'),
  ]),
);
d(
  'Leonardo, Sewer Samurai',
  '潛行{2}{W}{W}，連擊。你的回合可從墳墓場施放力量或防禦力至多1的生物，帶終結指示物進場。',
  ab([
    {
      kind: 'static',
      graveCast: { type: 'Creature', or: [{ powMax: 1 }, { toughMax: 1 }] },
    },
  ]),
);
d(
  "Leonardo's Technique",
  '潛行{1}{W}。復活一至兩個你的費用至多3生物牌。',
  spell(
    [
      { e: 'reanimate', what: 'T0' },
      { e: 'reanimate', what: 'T1' },
    ],
    [spec('gyCard', { type: 'Creature', ctrl: 'you', mvMax: 3 }), spec('gyCard', { type: 'Creature', ctrl: 'you', mvMax: 3 }, true)],
  ),
);
d(
  'Lita, Little Orphan Amphibian',
  '',
  ab([
    trig('allyEtb', [], {
      modesOncePerTurn: true,
      modes: [
        { text: '放指示物', effects: [counter] },
        { text: '派出食物', effects: [food] },
        { text: '占卜1', effects: [{ e: 'scry', n: 1 }] },
      ],
    }),
  ]),
);
d('Prehistoric Pet', '不能被力量比自己大的生物阻擋。你的回合{1}{W}，{T}：收回另一個你的生物。', {
  evadeGreaterPower: true,
  abilities: [
    act({ mana: '{1}{W}', tap: true }, [{ e: 'bounce', what: 'T0' }], '收回生物', {
      duringYourTurn: true,
      targets: [{ ...MY_CR, notSelf: true }],
    }),
  ],
});
d('Quintessential Katana', '佩帶者+1/+1；造成戰鬥傷害時重置並獲得2生命。你的忍者進場時可裝備它。裝備{2}。', {
  equip: {
    cost: '{2}',
    grant: { p: 1, t: 1 },
    trigger: {
      kind: 'trigger',
      on: 'combatDamageAny',
      effects: [
        { e: 'untap', what: 'self' },
        { e: 'gain', n: 2 },
      ],
    },
  },
  abilities: [
    trig('allyEtb', [{ e: 'attach', what: 'trig' }], {
      filter: { sub: 'Ninja' },
      may: '裝備進場的忍者？',
    }),
  ],
});
d(
  'Triceraton Commander',
  '飛行。進場派出X個2/2白色恐龍士兵。攻擊時其他恐龍本回合+1/+1且飛行。',
  ab([
    etb([{ e: 'token', token: 'tok-tmt-dinosaur', n: { x: true } }]),
    trig('attacks', [
      pump(
        {
          all: { type: 'Creature', ctrl: 'you', sub: 'Dinosaur', other: true },
        },
        1,
        1,
        ['flying'],
      ),
    ]),
  ]),
);
d(
  'Turncoat Kunoichi',
  '潛行{2}{W}{B}。進場放逐對手生物直到此生物離場；若以潛行進場則永久放逐。',
  ab([
    etb(
      [
        {
          e: 'if',
          cond: { c: 'sneaked' },
          then: [{ e: 'exile', what: 'T0' }],
          else: [{ e: 'exileLinked', what: 'T0' }],
        },
      ],
      {
        targets: [OPP_CR],
      },
    ),
  ]),
);
d('Turtles Forever', '找四張不同名傳奇生物，對手選兩張到你的手上，其餘洗回牌庫。局外牌以本機卡表為候選。', spell([special('forever')]));
d("April O'Neil, Hacktivist", '結束步驟依你本回合施放過的咒語類別數抓牌。', ab([trig('endStep', [special('aprilDraw')])]));
d('Bespoke Bō', '進場彈回至多一個其他非地永久物。佩帶者+2/+1且警戒。裝備{3}。', {
  equip: { cost: '{3}', grant: { p: 2, t: 1, kw: ['vigilance'] } },
  abilities: [
    etb([{ e: 'bounce', what: 'T0' }], {
      targets: [
        {
          kind: 'permanent',
          filter: { nonType: 'Land' },
          notSelf: true,
          optional: true,
        },
      ],
    }),
  ],
});
d('Crustacean Commando', '進場派出突變劑。', ab([etb([mutagen])]));
d(
  'Does Machines',
  '進場磨兩張、抓兩張、棄兩張。{1}{U}升2：取回至多兩張神器。{4}{U}升3：戰鬥開始在你的神器放三個指示物，使其成為0/0機器人。',
  ab([
    etb([
      { e: 'mill', n: 2 },
      { e: 'draw', n: 2 },
      { e: 'discard', who: 'you', n: 2 },
    ]),
    upgrade(1, '{1}{U}'),
    trig(
      'classLevel',
      [
        { e: 'toHand', what: 'T0' },
        { e: 'toHand', what: 'T1' },
      ],
      {
        level: 2,
        targets: [spec('gyCard', { type: 'Artifact', ctrl: 'you' }, true), spec('gyCard', { type: 'Artifact', ctrl: 'you' }, true)],
      },
    ),
    upgrade(2, '{4}{U}'),
    trig('combatStart', [special('robot', 3)], {
      when: level(3),
      targets: [myArtifact],
    }),
  ]),
);
d(
  'Donatello, Gadget Master',
  '潛行{1}{U}。造成戰鬥傷害時複製你的神器。',
  ab([
    trig('combatDamagePlayer', [{ e: 'copyCreature', what: 'T0' }], {
      targets: [myArtifact],
    }),
  ]),
);
d(
  'Donatello, Mutant Mechanic',
  '法術時機{T}：你的神器放三個指示物，非生物成為0/0機器人。有指示物的你的神器死去時，將那些指示物移到至多一個神器或生物。',
  ab([
    act({ tap: true }, [special('robot', 3)], '使神器成為機器人', {
      sorcery: true,
      targets: [myArtifact],
    }),
    trig('allyPermanentDies', [special('inheritArtifact')], {
      includeSelf: true,
      filter: { type: 'Artifact', hasCounters: true },
      targets: [spec('permanent', { ctrl: 'you', type: ['Artifact', 'Creature'] }, true)],
    }),
  ]),
);
d('Donatello, Way with Machines', '飛行。你的神器進場時放指示物。', ab([trig('allyPermEtb', [counter], { filter: { type: 'Artifact' } })]));
d("Donatello's Technique", '潛行{U}。抓兩張牌。', spell([{ e: 'draw', n: 2 }]));
d(
  'Fugitive Droid',
  '本回合你的神器進場過時不能被阻擋。{U}並犧牲：反擊以你的生物或神器為目標的咒語。',
  ab([
    st({ kw: ['unblockable'] }, { c: 'artifactEntered' }),
    act({ mana: '{U}', sacSelf: true }, [special('protectCounter')], '保護神器或生物', {
      targets: [{ kind: 'spell', targetsOwnArtifactOrCreature: true }],
    }),
  ]),
);
const exchange = trig('combatDamagePlayer', [special('exchange')], {
  targets: [
    { ...CR, notSelf: true },
    { ...CR, notSelf: true, differentControllerFrom: 0 },
  ],
  may: '交換兩個不同玩家的生物？',
});
d(
  "Kitsune, Dragon's Daughter",
  '警戒。進場或造成戰鬥傷害時可交換不同玩家的兩個其他生物。',
  ab([
    etb([special('exchange')], {
      targets: [
        { ...CR, notSelf: true },
        { ...CR, notSelf: true, differentControllerFrom: 0 },
      ],
      may: '交換生物？',
    }),
    exchange,
  ]),
);
d("Kitsune's Technique", '潛行{1}{U}。對手磨掉一半牌庫，向上取整。', spell([special('halfMill')], [OPP]));
d(
  'Krang, Master Mind',
  '神器共鳴。進場時將手牌補到四張。其他每個神器使其力量+1。',
  ab([
    etb([special('refillFour')], {
      cond: { c: 'not', cond: { c: 'handGte', n: 4 } },
    }),
    {
      kind: 'static',
      selfPowerCount: { type: 'Artifact', ctrl: 'you', other: true },
    },
  ]),
);
d(
  'Metalhead',
  '進場可彈回另一神器或生物。{R}並犧牲另一神器：放指示物，本回合威懾、敏捷。',
  ab([
    etb([{ e: 'bounce', what: 'T0' }], {
      targets: [
        {
          kind: 'permanent',
          filter: { type: ['Artifact', 'Creature'] },
          notSelf: true,
          optional: true,
        },
      ],
    }),
    act({ mana: '{R}', sacOther: { type: 'Artifact', other: true } }, [counter, pump('self', 0, 0, ['menace', 'haste'])], '犧牲神器強化'),
  ]),
);
d(
  'Mind Transfer Protocol',
  '目標神器或生物本回合成為4/5神器生物。抓牌。',
  spell([special('mindTransfer'), draw], [spec('permanent', { type: ['Artifact', 'Creature'] })]),
);
d(
  'Mondo Gecko',
  '{1}並棄牌：選擇顏色，本回合成為該色且具有反該色辟邪。造成戰鬥傷害時依你的永久物顏色數抓牌。',
  ab([
    act({ mana: '{1}', discard: 1 }, [special('mondo')], '選擇顏色並保護'),
    trig('combatDamagePlayer', [{ e: 'draw', n: { colors: true } }]),
  ]),
);
d(
  'Ray Fillet, Man Ray',
  '飛行。進場派出突變劑。{2}並移除你的生物上一個指示物：抓牌。',
  ab([
    etb([mutagen]),
    act({ mana: '{2}' }, [draw], '移除指示物抓牌', {
      removeCounter: { n: 1, fromCreature: true },
    }),
  ]),
);
d(
  'Renet, Temporal Apprentice',
  '閃現。進場時收回所有本回合進場的其他非地永久物。',
  ab([
    etb([
      {
        e: 'bounce',
        what: { all: { nonType: 'Land', enteredThisTurn: true, other: true } },
      },
    ]),
  ]),
);
d('Retro-Mutation', '閃現光環。結附生物成為0/1龜，不能攻擊且失去異能。', {
  aura: {
    target: CR,
    grant: {
      cantAttack: true,
      loseAbilities: true,
      animate: { p: 0, t: 1, subtype: 'Turtle', replaceCreatureTypes: true },
    },
  },
});
d('Return to the Sewers', '生物擁有者選擇將它放牌庫頂或底。派出突變劑。', spell([{ e: 'topOrBottom', what: 'T0' }, mutagen], [CR]));
d(
  'Sewer-veillance Cam',
  '閃現。進場或離場時可橫置或重置生物。{3}{U}並犧牲：抓兩張。',
  ab([
    etb([special('cam')], { targets: [CR], may: '橫置或重置？' }),
    trig('leaves', [special('cam')], { targets: [CR], may: '橫置或重置？' }),
    act({ mana: '{3}{U}', sacSelf: true }, [{ e: 'draw', n: 2 }], '犧牲抓兩張'),
  ]),
);
d(
  'Turtles in Time',
  '收回所有生物。各玩家可將手牌與墳墓場洗入牌庫並抓七張。放逐此牌。',
  spell([{ e: 'bounce', what: allCreatures }, special('resetHands'), { e: 'exile', what: 'selfAny' }]),
);
d(
  'Bebop, Warthog Warrior',
  '威懾。你的犀牛具有威懾。沼澤循環{2}。',
  ab([
    {
      kind: 'static',
      anthem: {
        filter: { type: 'Creature', ctrl: 'you', sub: 'Rhino' },
        grant: { kw: ['menace'] },
      },
    },
  ]),
);
d('The Cloning of Shredder', '第一章：放逐你墳墓場的生物並派出其非傳奇變種人複製。第二、三章：再派出一個複製。', {
  saga: {
    chapters: [
      { effects: [special('cloneExile')], targets: [myGy] },
      { effects: [special('cloneAgain')] },
      { effects: [special('cloneAgain')] },
    ],
  },
});
d(
  'Insectoid Exterminator',
  '飛行。消逝—結束步驟若本回合你的永久物離場過，占卜1。',
  ab([trig('endStep', [{ e: 'scry', n: 1 }], { cond: disappear })]),
);
d(
  'Lord Dregg, Insect Invader',
  '飛行。消逝—結束步驟派出1/1黑色飛行昆蟲戰士。{3}{G}並犧牲衍生物：抓牌。',
  ab([
    trig('endStep', [{ e: 'token', token: 'tok-tmt-insect' }], {
      cond: disappear,
    }),
    act({ mana: '{3}{G}', sacOther: { token: true } }, [draw], '犧牲衍生物抓牌'),
  ]),
);
d(
  'Madame Null, Power Broker',
  '死觸。結盟：可支付等同進場生物力量的生命，在它上面放等量指示物。',
  ab([trig('allyEtb', [special('null')])]),
);
d(
  'Ninja Teen',
  '你的生物離場時對手失去1生命。{1}{B}升2：全軍+1/+0且威懾。{B}升3：墳墓場生物可用潛行{3}{B}施放。',
  ab([
    trig('allyLeaves', [{ e: 'lose', who: 'opp', n: 1 }], {
      filter: { type: 'Creature' },
      includeSelf: true,
    }),
    upgrade(1, '{1}{B}'),
    {
      kind: 'static',
      condition: level(2),
      anthem: {
        filter: { type: 'Creature', ctrl: 'you' },
        grant: { p: 1, kw: ['menace'] },
      },
    },
    upgrade(2, '{B}'),
  ]),
);
d(
  'Oroku Saki, Shredder Rising',
  '潛行{1}{B}。造成戰鬥傷害時抓牌並失去1生命。',
  ab([trig('combatDamagePlayer', [draw, { e: 'lose', who: 'you', n: 1 }])]),
);
d(
  'Pain 101',
  '目標生物本回合獲得死觸；若本回合死去，在擁有者控制下橫置回場。',
  spell([pump('T0', 0, 0, ['deathtouch']), special('returnOnDeath')], [CR]),
);
d(
  'Paramecia Coloniex',
  '進場磨三張。死去時可放逐自己，將你墳墓場的生物牌放牌庫頂。',
  ab([etb([{ e: 'mill', n: 3 }]), trig('dies', [special('paramecia')])]),
);
d(
  'Rat King, Verminister',
  '消逝—結束步驟派出老鼠並在此生物上放指示物。{T}，犧牲三隻老鼠：將你墳墓場中目標生物及所有同名牌橫置復活。',
  ab([
    trig('endStep', [{ e: 'token', token: 'tok-tmt-rat' }, counter], {
      cond: disappear,
    }),
    act({ tap: true }, [special('rats')], '犧牲三隻老鼠復活', {
      sacN: { n: 3, filter: { type: 'Creature', sub: 'Rat' } },
      targets: [myGy],
    }),
  ]),
);
d(
  'Shark Shredder, Killer Clone',
  '潛行{3}{B}{B}，先攻。造成戰鬥傷害時，可從該玩家墳墓場復活生物，橫置且攻擊。',
  ab([
    trig('combatDamagePlayer', [special('shark')], {
      targets: [spec('gyCard', { ctrl: 'opp', type: 'Creature' }, true)],
    }),
  ]),
);
d(
  'Shredder, Unrelenting',
  '潛行{3}{B}，死觸。進場或攻擊時你的另一生物本回合獲得死觸。',
  ab([
    etb([pump('T0', 0, 0, ['deathtouch'])], {
      targets: [{ ...MY_CR, notSelf: true }],
    }),
    trig('attacks', [pump('T0', 0, 0, ['deathtouch'])], {
      targets: [{ ...MY_CR, notSelf: true }],
    }),
  ]),
);
d("Shredder's Armor", '進場時裝備你的生物。佩帶者+2/+1。裝備—犧牲另一非地永久物，每回合一次。', {
  equip: { cost: '', manual: true, grant: { p: 2, t: 1 } },
  abilities: [
    etb([{ e: 'attach', what: 'T0' }], { targets: [MY_CR] }),
    act({ sacOther: { nonType: 'Land', other: true } }, [{ e: 'attach', what: 'T0' }], '裝備：犧牲非地永久物', {
      sorcery: true,
      oncePerTurn: true,
      isEquip: true,
      targets: [MY_CR],
    }),
  ],
});
d(
  "Shredder's Technique",
  '潛行{B}。消滅生物或結界；若消滅的是結界，你失去2生命。',
  spell([special('shredderDestroy')], [spec('permanent', { type: ['Creature', 'Enchantment'] })]),
);
d(
  'Splinter, Hamato Yoshi',
  '潛行{B}，威懾。你的其他忍者+1/+1。',
  ab([
    {
      kind: 'static',
      anthem: {
        filter: { type: 'Creature', ctrl: 'you', sub: 'Ninja', other: true },
        grant: { p: 1, t: 1 },
      },
    },
  ]),
);
d("Splinter's Technique", '潛行{1}{B}。搜尋任意牌到手上並洗牌。', spell([{ e: 'tutor', filter: {} }]));
d('Stomped by the Foot', '生物本回合-2/-2。增幅—犧牲神器或生物：改為-5/-5。', {
  spell: {
    modes: [
      { text: '-2/-2', targets: [CR], effects: [pump('T0', -2, -2)] },
      {
        text: '增幅：-5/-5',
        sac: { type: ['Artifact', 'Creature'] },
        targets: [CR],
        effects: [pump('T0', -5, -5)],
      },
    ],
  },
});
d('Broadcast Takeover', '本回合取得對手所有神器，重置它們並賦予敏捷。', spell([special('takeover')]));
d('Casey Jones, Vigilante', '進場抓三張。你的下一個維持隨機棄三張。', ab([etb([{ e: 'draw', n: 3 }, special('casey')])]));
d(
  'Cool but Rude',
  '攻擊時可棄一抓一。{1}{R}升2：你棄牌時對手受2傷害。{1}{R}升3：搜尋任意牌到手上，隨機棄一張。',
  ab([
    trig('youAttack', [
      {
        e: 'costThen',
        prompt: '棄一張抓一張？',
        cost: { discard: 1 },
        then: [draw],
      },
    ]),
    upgrade(1, '{1}{R}'),
    trig('anyDiscard', [special('discardDamage')], {
      when: level(2),
      ownDiscard: true,
      eachDiscard: true,
    }),
    upgrade(2, '{1}{R}'),
    trig(
      'classLevel',
      [
        { e: 'tutor', filter: {} },
        { e: 'discard', who: 'you', n: 1, random: true },
      ],
      { level: 3 },
    ),
  ]),
);
d(
  'General Traag, Heart of Stone',
  '踐踏。進場可犧牲另一神器，對生物造成4傷害。',
  ab([
    etb([
      {
        e: 'costThen',
        cost: { sac: { type: 'Artifact', other: true } },
        prompt: '犧牲神器造成4傷害？',
        then: [
          {
            e: 'reflexive',
            targets: [CR],
            effects: [{ e: 'damage', n: 4, to: 'T0' }],
          },
        ],
      },
    ]),
  ]),
);
d('Improvised Arsenal', '佩帶者依你的神器數+1/+0。{4}{R}：複製此武具。裝備{R}。', {
  equip: { cost: '{R}', grant: {}, powerPerArtifact: true },
  abilities: [act({ mana: '{4}{R}' }, [{ e: 'copyOfSelf' }], '複製武具')],
});
d("Jennika's Technique", '潛行{R}。對每個生物造成2傷害。', spell([{ e: 'damage', n: 2, to: allCreatures }]));
d(
  'Null Group Biological Assets',
  '你的回合具有先攻。攻擊時可棄一張抓一張。',
  ab([
    st({ kw: ['first_strike'] }, { c: 'yourTurn' }),
    trig('attacks', [
      {
        e: 'costThen',
        cost: { discard: 1 },
        prompt: '棄牌來抓牌？',
        then: [draw],
      },
    ]),
  ]),
);
d(
  'Old Hob, Alleycat Blues',
  '戰鬥開始派出2/2敏捷變種人，下個結束步驟消滅。{1}{W}：攻擊中的衍生生物本回合獲得不滅。',
  ab([
    trig('combatStart', [special('hob')]),
    act({ mana: '{1}{W}' }, [pump('T0', 0, 0, ['indestructible'])], '保護攻擊衍生物', {
      targets: [spec('creature', { token: true, attacking: true })],
    }),
  ]),
);
d('Purple Dragon Punks', '{T}：加{R}，只能施放神器或支付起動式異能。', {
  produces: ['R'],
  manaOnly: 'artifactOrAbility',
});
d(
  'Raphael, Most Attitude',
  '威懾。結盟時可放逐頂牌。攻擊時本回合可使用以此牌放逐的一張牌。',
  ab([trig('allyEtb', [special('raphExile')], { may: '放逐頂牌？' }), trig('attacks', [special('raphPlay')])]),
);
d(
  'Raphael, Ninja Destroyer',
  '若能阻擋則必須阻擋此生物。激怒：受到傷害時加入等量{R}，保留到回合結束。',
  ab([trig('dealtDamage', [special('keepRed')])]),
);
d(
  'Raphael, the Nightwatcher',
  '潛行{1}{R}{R}。你的攻擊生物具有連擊。',
  ab([
    {
      kind: 'static',
      anthem: {
        filter: { type: 'Creature', ctrl: 'you', attacking: true },
        grant: { kw: ['double_strike'] },
      },
    },
  ]),
);
d("Raphael's Technique", '潛行{2}{R}。各玩家可棄掉手牌並抓七張。', spell([{ e: 'wheel' }]));
d(
  'Ravenous Robots',
  '施放神器時派出1/1機器人。{R}，{T}：你的衍生生物本回合獲得敏捷。',
  ab([
    trig('castAny', [{ e: 'token', token: 'tok-robot' }], {
      filter: { type: 'Artifact' },
    }),
    act({ mana: '{R}', tap: true }, [pump({ all: { type: 'Creature', ctrl: 'you', token: true } }, 0, 0, ['haste'])], '衍生生物獲得敏捷'),
  ]),
);
d(
  'Wingnut, Bat on the Belfry',
  '結盟：本回合獲得飛行、威懾或敏捷。攻擊時你的其他攻擊生物+1/+0。',
  ab([
    trig('allyEtb', [{ e: 'pumpChoice', what: 'self', kws: ['flying', 'menace', 'haste'] }]),
    trig('attacks', [
      pump(
        {
          all: { type: 'Creature', ctrl: 'you', attacking: true, other: true },
        },
        1,
        0,
      ),
    ]),
  ]),
);
d(
  'Zog, Triceraton Castaway',
  '延勢，踐踏。進場使生物本回合不能阻擋。山脈循環{2}。',
  ab([
    etb([{ e: 'grant', what: 'T0', grant: { cantBlock: true } }], {
      targets: [CR],
    }),
  ]),
);
d('Courier of Comestibles', '進場可搜尋食物到手上；若沒有取牌，派出食物。', ab([etb([special('courier')])]));
d(
  'Cowabunga!',
  '檢視頂四張，可取一張變種人、忍者、龜或地到手上。',
  spell([
    {
      e: 'dig',
      n: 4,
      optional: true,
      randomBottom: true,
      filter: {
        or: [{ sub: ['Mutant', 'Ninja', 'Turtle'] }, { type: 'Land' }],
      },
      rest: 'bottom',
    },
  ]),
);
d('Groundchuck & Dirtbag', '踐踏。每次你橫置地產法術力時，額外加{G}。', ab([{ kind: 'static', landManaBonus: 'G' }]));
d(
  'Leatherhead, Swamp Stalker',
  '踐踏。進場帶辟邪指示物。造成戰鬥傷害時可移除一個指示物，消滅受傷玩家的神器或結界。',
  ab([trig('combatDamagePlayer', [special('leatherhead')])]),
);
d('Michelangelo, Game Master', '消逝—結束步驟放一個指示物。', ab([trig('endStep', [counter], { cond: disappear })]));
d(
  'Michelangelo, Improviser',
  '潛行{2}{G}{G}。造成戰鬥傷害時可從手上放一個生物及／或地進場。',
  ab([trig('combatDamagePlayer', [special('improviser')])]),
);
d(
  'Michelangelo, Mutant BFF',
  '你的有指示物生物至多被一個生物阻擋。進場或攻擊時派出突變劑。',
  ab([
    {
      kind: 'static',
      anthem: {
        filter: { type: 'Creature', ctrl: 'you', hasCounters: true },
        grant: { onlyOneBlocker: true },
      },
    },
    etb([mutagen]),
    trig('attacks', [mutagen]),
  ]),
);
d(
  'Michelangelo, Weirdness to 11',
  '進場派出突變劑。在你的生物上放+1/+1指示物時多放一個。',
  ab([etb([mutagen]), { kind: 'static', counterPlus: 1 }]),
);
d(
  "Michelangelo's Technique",
  '潛行{3}{G}。檢視頂八張，將至多兩張總費用至多6的生物放進戰場，其餘置底。',
  spell([special('mikeyTechnique')]),
);
d(
  'Mona Lisa, Science Geek',
  '延勢。{T}：加入等同自身力量的任意一色法術力。',
  ab([act({ tap: true }, [{ e: 'addManaOfChoice', n: { power: 'self' } }], '依力量加入法術力')]),
);
d(
  'Mutagen Man, Living Ooze',
  '踐踏。你的神器衍生物異能少付{1}。進場派出X個突變劑。',
  ab([{ kind: 'static', artifactTokenCostLess: 1 }, etb([{ e: 'token', token: 'tok-mutagen', n: { x: true } }])]),
);
d(
  'Mutant Chain Reaction',
  '消滅至多一個神器、結界或飛行生物。派出突變劑。',
  spell(
    [{ e: 'destroy', what: 'T0' }, mutagen],
    [
      spec(
        'permanent',
        {
          or: [{ type: ['Artifact', 'Enchantment'] }, { type: 'Creature', kw: 'flying' }],
        },
        true,
      ),
    ],
  ),
);
d(
  "New Generation's Technique",
  '潛行{2}{G}。搜尋至多兩張基本地橫置進場並洗牌。',
  spell([
    {
      e: 'tutorMany',
      filter: { type: 'Land', basic: true },
      n: 2,
      to: 'battlefield',
      tapped: true,
    },
  ]),
);
d('Novel Nunchaku', '進場裝備你的生物，然後可與對手生物互鬥。佩帶者+1/+1且踐踏。裝備{3}。', {
  equip: { cost: '{3}', grant: { p: 1, t: 1, kw: ['trample'] } },
  abilities: [
    etb(
      [
        { e: 'attach', what: 'T0' },
        {
          e: 'reflexive',
          targets: [spec('creature', { ctrl: 'opp' }, true)],
          effects: [special('nunchaku')],
        },
      ],
      { targets: [MY_CR] },
    ),
  ],
});
d(
  'Party Dude',
  '進場雙方各派出食物。{1}{G}升2：對手神器死去時抓牌。{4}{G}升3：攻擊時一個攻擊生物依手牌數得+X/+X。',
  ab([
    etb([{ e: 'token', token: 'tok-food', who: 'players' }]),
    upgrade(1, '{1}{G}'),
    trig('otherPermanentDies', [draw], {
      when: level(2),
      filter: { ctrl: 'opp', type: 'Artifact' },
    }),
    upgrade(2, '{4}{G}'),
    trig('youAttack', [{ e: 'pump', what: 'T0', p: { hand: true }, t: { hand: true } }], {
      when: level(3),
      targets: [spec('creature', { attacking: true }, true)],
    }),
  ]),
);
d(
  'Ragamuffin Raptor',
  '進場可將你墳墓場的生物或食物移回手上。',
  ab([
    etb([{ e: 'toHand', what: 'T0' }], {
      targets: [spec('gyCard', { ctrl: 'you', or: [{ type: 'Creature' }, { sub: 'Food' }] }, true)],
    }),
  ]),
);
d(
  'Rocksteady, Crash Courser',
  '此生物與你的野豬至多被一個生物阻擋。樹林循環{2}。',
  ab([
    st({ onlyOneBlocker: true }),
    {
      kind: 'static',
      anthem: {
        filter: { type: 'Creature', ctrl: 'you', sub: 'Boar' },
        grant: { onlyOneBlocker: true },
      },
    },
  ]),
);
d(
  'Transdimensional Bovine',
  '飛行。{T}：加入兩點任意一色法術力。',
  ab([act({ tap: true }, [{ e: 'addManaOfChoice', n: 2 }], '加入兩點法術力')]),
);
d(
  'Turtle Power!',
  '閃現。你的龜+2/+2。',
  ab([
    {
      kind: 'static',
      anthem: {
        filter: { type: 'Creature', ctrl: 'you', sub: 'Turtle' },
        grant: { p: 2, t: 2 },
      },
    },
  ]),
);
d(
  'Venus, Torn Between Worlds',
  '受到傷害時放等量指示物。你的有指示物生物造成戰鬥傷害時，可支付{U}抓牌。',
  ab([
    trig('dealtDamage', [{ e: 'counters', what: 'self', n: { ev: true } }]),
    trig(
      'allyCombatDamagePlayer',
      [
        {
          e: 'costThen',
          prompt: '支付{U}抓牌？',
          cost: { mana: '{U}' },
          then: [draw],
        },
      ],
      {
        filter: { hasCounters: true },
      },
    ),
  ]),
);
const westCost: Effect = {
  e: 'costThen',
  prompt: '犧牲衍生物或地獲得3生命？',
  cost: { sac: { or: [{ token: true }, { type: 'Land' }] } },
  then: [{ e: 'gain', n: 3 }],
};
d(
  'West Wind Avatar',
  '踐踏。進場或攻擊時可犧牲地或衍生物獲得3生命。消逝—結束步驟抓牌。',
  ab([etb([westCost]), trig('attacks', [westCost]), trig('endStep', [draw], { cond: disappear })]),
);
d('Zoo Escapees', '離場時派出突變劑。', ab([trig('leaves', [mutagen])]));
d(
  'Baxter Stockman',
  '進場派出機器人。你的戰鬥開始時，一個神器生物本回合+3/+0且先攻、警戒。',
  ab([
    etb([{ e: 'token', token: 'tok-robot' }]),
    trig('combatStart', [pump('T0', 3, 0, ['first_strike', 'vigilance'])], {
      targets: [
        spec('permanent', {
          type: 'Artifact',
          or: [{ type: 'Creature' }],
          ctrl: 'you',
        }),
      ],
    }),
  ]),
);
d(
  'Bebop & Rocksteady',
  '攻擊或阻擋時，犧牲一個永久物，除非棄一張牌。',
  ab([trig('attacks', [special('bebop')]), trig('blocks', [special('bebop')])]),
);
d('Brilliance Unleashed', '選一項或兩項：對生物造成5傷害；復活你的神器，非生物神器改為3/3飛行機器人。', {
  spell: {
    modes: [
      {
        text: '5傷害',
        targets: [CR],
        effects: [{ e: 'damage', n: 5, to: 'T0' }],
      },
      {
        text: '復活神器',
        targets: [spec('gyCard', { ctrl: 'you', type: 'Artifact' })],
        effects: [special('brilliance', undefined, 'T0')],
      },
      {
        text: '兩項',
        targets: [CR, spec('gyCard', { ctrl: 'you', type: 'Artifact' })],
        effects: [{ e: 'damage', n: 5, to: 'T0' }, special('brilliance', undefined, 'T1')],
      },
    ],
  },
});
d(
  'Dark Leo & Shredder',
  '潛行{W}{B}。你的攻擊忍者具有死觸。造成戰鬥傷害時派出忍者；若你有至少五個忍者，對手失去一半生命，向上取整。',
  ab([
    {
      kind: 'static',
      anthem: {
        filter: {
          type: 'Creature',
          sub: 'Ninja',
          ctrl: 'you',
          attacking: true,
        },
        grant: { kw: ['deathtouch'] },
      },
    },
    trig('combatDamagePlayer', [{ e: 'token', token: 'tok-tmt-ninja' }, special('darkLeo')]),
  ]),
);
d(
  'Don & Leo, Problem Solvers',
  '警戒。結束步驟可閃現你的一個神器與一個生物。',
  ab([
    trig('endStep', [special('donLeo')], {
      targets: [
        { ...myArtifact, optional: true },
        { ...MY_CR, optional: true, allowRepeat: true },
      ],
    }),
  ]),
);
d('Don & Raph, Hard Science', '威懾。攻擊時，本回合下一個非生物咒語獲得神器共鳴。', ab([trig('attacks', [special('nextAffinity')])]));
d('Foot Ninjas', '潛行{3}{W/B}。進場獲得3生命。', ab([etb([{ e: 'gain', n: 3 }])]));
d(
  'Genghis Frog',
  '踐踏。此生物或你的另一變種人進場時派出突變劑。',
  ab([etb([mutagen]), trig('allyEtb', [mutagen], { filter: { sub: 'Mutant' } })]),
);
d('Go Ninja Go', '選一項或兩項：閃現你的生物；對對手生物造成等同你的最大生物力量的傷害。', {
  spell: {
    modes: [
      {
        text: '閃現',
        targets: [MY_CR],
        effects: [{ e: 'flicker', what: 'T0' }],
      },
      {
        text: '造成傷害',
        targets: [OPP_CR],
        effects: [
          {
            e: 'damage',
            n: { maxPower: { type: 'Creature', ctrl: 'you' } },
            to: 'T0',
          },
        ],
      },
      {
        text: '兩項',
        targets: [MY_CR, OPP_CR],
        effects: [
          { e: 'flicker', what: 'T0' },
          {
            e: 'damage',
            n: { maxPower: { type: 'Creature', ctrl: 'you' } },
            to: 'T1',
          },
        ],
      },
    ],
  },
});
d(
  'Ice Cream Kitty',
  '法術時機{2}並犧牲另一生物或衍生物：抓牌。{2}，{T}並犧牲：獲得3生命。',
  ab([
    act(
      {
        mana: '{2}',
        sacOther: { other: true, or: [{ type: 'Creature' }, { token: true }] },
      },
      [draw],
      '犧牲抓牌',
      { sorcery: true },
    ),
    act({ mana: '{2}', tap: true, sacSelf: true }, [{ e: 'gain', n: 3 }], '吃掉食物'),
  ]),
);
d(
  'Karai, Future of the Foot',
  '潛行{2}{W}{B}。造成戰鬥傷害時取回墳墓場生物；若本回合使用潛行則改為復活。',
  ab([
    trig(
      'combatDamagePlayer',
      [
        {
          e: 'if',
          cond: { c: 'sneaked' },
          then: [{ e: 'reanimate', what: 'T0' }],
          else: [{ e: 'toHand', what: 'T0' }],
        },
      ],
      { targets: [myGy] },
    ),
  ]),
);
d("Karai's Technique", '潛行{W}{B}。選一項或兩項：生物本回合+3/+3；生物本回合-3/-3。', {
  spell: {
    modes: [
      { text: '+3/+3', targets: [CR], effects: [pump('T0', 3, 3)] },
      { text: '-3/-3', targets: [CR], effects: [pump('T0', -3, -3)] },
      {
        text: '兩項',
        targets: [CR, { ...CR, allowRepeat: true }],
        effects: [pump('T0', 3, 3), pump('T1', -3, -3)],
      },
    ],
  },
});
d(
  'Krang & Shredder',
  '進場或攻擊時，對手放逐頂牌直到非地。消逝—結束步驟可免費施放其中一張。',
  ab([
    etb([special('krangExile')]),
    trig('attacks', [special('krangExile')]),
    trig('endStep', [special('krangCast')], { cond: disappear }),
  ]),
);
d(
  'Mikey & Don, Party Planners',
  '守護{2}。可使用牌庫頂的地，或施放變種人、忍者、龜；以此方式施放的生物多一個指示物。',
  ab([
    {
      kind: 'static',
      topCast: {
        or: [{ type: 'Land' }, { sub: ['Mutant', 'Ninja', 'Turtle'] }],
      },
    },
  ]),
);
d(
  'Mikey & Leo, Chaos & Order',
  '在你的生物上放指示物時抓牌，每回合一次。',
  ab([
    trig('allyCounters', [draw], {
      oncePerTurn: true,
      filter: { type: 'Creature' },
    }),
  ]),
);
d(
  'Mouser Mark III',
  '除非你操控另一個神器，否則不能攻擊。',
  ab([
    st(
      { cantAttack: true },
      {
        c: 'not',
        cond: { c: 'controls', filter: { type: 'Artifact', other: true } },
      },
    ),
  ]),
);
d(
  'The Neutrinos',
  '飛行。結盟時本回合+1/+0。攻擊時可閃現你擁有的生物，使其橫置且攻擊。',
  ab([
    trig('allyEtb', [pump('self', 1, 0)]),
    trig('attacks', [special('neutrinos')], {
      targets: [spec('creature', { owner: 'you' }, true)],
    }),
  ]),
);
d(
  'Nobody',
  '進場可收回另一個你的神器。占卜1。',
  ab([
    etb(
      [
        { e: 'bounce', what: 'T0' },
        { e: 'scry', n: 1 },
      ],
      {
        targets: [spec('permanent', { type: 'Artifact', ctrl: 'you', other: true }, true)],
      },
    ),
  ]),
);
d(
  'North Wind Avatar',
  '飛行。施放進場時可將一張局外牌放手上；局外牌以本機卡表為候選。',
  ab([etb([special('wish')], { cond: { c: 'selfWasCast' } })]),
);
d(
  'Pizza Face, Gastromancer',
  '進場派出食物。消逝—結束步驟在另一個神器或生物上放三個指示物，若非生物則成為0/0變種人。{10}，{T}並犧牲：獲得15生命。',
  ab([
    etb([food]),
    trig('endStep', [special('robot', 3)], {
      cond: disappear,
      targets: [spec('permanent', { type: ['Artifact', 'Creature'], other: true }, true)],
    }),
    act({ mana: '{10}', tap: true, sacSelf: true }, [{ e: 'gain', n: 15 }], '吃掉：獲得15生命'),
  ]),
);
d(
  'Raph & Leo, Sibling Rivals',
  '第一個戰鬥中攻擊時，重置一至兩個攻擊生物，並增加一個戰鬥階段。',
  ab([
    trig('attacks', [special('sibling')], {
      cond: { c: 'firstCombat' },
      targets: [spec('creature', { attacking: true }), spec('creature', { attacking: true }, true)],
    }),
  ]),
);
d(
  'Raph & Mikey, Troublemakers',
  '踐踏，敏捷。攻擊時翻到生物，將它橫置且攻擊放進戰場，其餘隨機置底。',
  ab([trig('attacks', [special('troublemakers')])]),
);
d('Slithering Cryptid', '進場派出突變劑。', ab([etb([mutagen])]));
d(
  'Splinter, Radical Rat',
  '你的忍者生物的觸發式異能額外觸發一次。{1}{U}：目標忍者本回合不能被阻擋。',
  ab([
    { kind: 'static', triggerDouble: { type: 'Creature', sub: 'Ninja' } },
    act({ mana: '{1}{U}' }, [pump('T0', 0, 0, ['unblockable'])], '忍者不能被阻擋', { targets: [spec('creature', { sub: 'Ninja' })] }),
  ]),
);
d(
  'Tainted Treats',
  '消滅目標神器或生物。若其費用至多4，派出食物。',
  spell([special('tainted')], [spec('permanent', { type: ['Artifact', 'Creature'] })]),
);
d('Tokka & Rahzar, Terrible Twos', '不能被反擊，威懾。任一玩家以少於咒語法術力值的法術力施放咒語時，對其造成3傷害。', {
  uncounterable: true,
  abilities: [trig('castAny', [special('discountPunish')], { anyPlayer: true })],
});
d(
  'Chrome Dome',
  '你的其他神器生物+1/+0。{5}：複製你的另一神器，賦予敏捷，在下個結束步驟犧牲。',
  ab([
    {
      kind: 'static',
      anthem: {
        filter: {
          type: 'Artifact',
          ctrl: 'you',
          other: true,
          or: [{ type: 'Creature' }],
        },
        grant: { p: 1 },
      },
    },
    act({ mana: '{5}' }, [{ e: 'copyCreature', what: 'T0', temp: true }, pump('created', 0, 0, ['haste'])], '暫時複製神器', {
      targets: [{ ...myArtifact, notSelf: true }],
    }),
  ]),
);
d(
  'Everything Pizza',
  '進場搜尋基本地到手上。{2}{W}{U}{B}{R}{G}，{T}並犧牲：目標玩家獲得3生命並抓牌、對手棄牌、任意目標受3傷害、至多一個生物放三個指示物。',
  ab([
    etb([{ e: 'searchLand', to: 'hand' }]),
    act(
      { mana: '{2}{W}{U}{B}{R}{G}', tap: true, sacSelf: true },
      [
        { e: 'gain', who: 'T0', n: 3 },
        { e: 'draw', who: 'T0', n: 1 },
        { e: 'discard', who: 'opp', n: 1 },
        { e: 'damage', n: 3, to: 'T1' },
        count('T2', 3),
      ],
      '吃掉全口味披薩',
      {
        targets: [{ kind: 'player' }, { kind: 'any' }, { ...CR, optional: true }],
      },
    ),
  ]),
);
d(
  'Henchbots',
  '進場放逐對手已橫置的生物，直到此生物離場。',
  ab([
    etb([{ e: 'exileLinked', what: 'T0' }], {
      targets: [spec('creature', { ctrl: 'opp', tapped: true })],
    }),
  ]),
);
d(
  'Krang, Utrom Warlord',
  '飛行，踐踏，不滅，敏捷。你的其他神器生物也具有這些異能。',
  ab([
    {
      kind: 'static',
      anthem: {
        filter: {
          type: 'Artifact',
          ctrl: 'you',
          other: true,
          or: [{ type: 'Creature' }],
        },
        grant: { kw: ['flying', 'trample', 'indestructible', 'haste'] },
      },
    },
  ]),
);
d(
  'Omni-Cheese Pizza',
  '進場抓牌。{1}，{T}並犧牲：加任意色法術力。{2}，{T}並犧牲：獲得3生命。',
  ab([
    etb([draw]),
    act({ mana: '{1}', tap: true, sacSelf: true }, [{ e: 'addManaOfChoice', n: 1 }], '轉換法術力'),
    act({ mana: '{2}', tap: true, sacSelf: true }, [{ e: 'gain', n: 3 }], '吃掉食物'),
  ]),
);
d(
  'The Ooze',
  '你的有指示物生物離場時，依其+1/+1指示物數派出突變劑。{T}：放逐墳墓場牌並派出突變劑。',
  ab([
    trig('allyLeaves', [special('ooze')], {
      filter: { type: 'Creature', plusCounters: true },
      includeSelf: true,
    }),
    act({ tap: true }, [{ e: 'exileGy', what: 'T0' }, mutagen], '放逐並派出突變劑', { targets: [{ kind: 'gyCard' }] }),
  ]),
);
d('Technodrome', '延勢，踐踏。力量小於6時不能攻擊或阻擋。{T}並犧牲另一神器：抓牌並放指示物。', {
  combatPowerMin: 6,
  abilities: [act({ tap: true, sacOther: { type: 'Artifact', other: true } }, [draw, counter], '犧牲神器強化')],
});
d(
  'Turtle Van',
  '攻擊時在本回合駕駛它的一個生物上放指示物；若該生物是變種人、忍者或龜，加倍其指示物。駕駛1。',
  ab([
    trig('attacks', [special('van')], {
      targets: [spec('creature', { crewedSourceThisTurn: true })],
    }),
  ]),
);
d('Weather Maker', '地落放充能指示物。{T}：加任意色；或移除兩個充能加{C}{C}；或移除三個充能造成3傷害。', {
  produces: ['W', 'U', 'B', 'R', 'G'],
  abilities: [
    trig('landfall', [{ e: 'chargeCounter', what: 'self', n: 1 }]),
    act({ tap: true }, [{ e: 'addMana', mana: ['C', 'C'] }], '移除兩個充能：兩點無色', { removeCounter: { n: 2 } }),
    act({ tap: true }, [{ e: 'damage', n: 3, to: 'T0' }], '移除三個充能：3傷害', { removeCounter: { n: 3 }, targets: [{ kind: 'any' }] }),
  ],
});
d('Northampton Farm', '{T}：加{C}。{1}，{T}：放逐你擁有的生物。{2}，{T}並犧牲：其中一個放逐生物回場，其餘回手。', {
  produces: ['C'],
  abilities: [
    act({ mana: '{1}', tap: true }, [special('farmExile')], '放逐生物', {
      targets: [spec('creature', { owner: 'you' })],
    }),
    act({ mana: '{2}', tap: true, sacSelf: true }, [special('farmReturn')], '取回放逐牌'),
  ],
});
d('Turtle Lair', '{T}：加{C}或僅供忍者／龜的任意色。{3}，{T}：忍者或龜本回合不能被阻擋。', {
  produces: ['C'],
  abilities: [
    act({ mana: '{3}', tap: true }, [pump('T0', 0, 0, ['unblockable'])], '不能被阻擋', {
      targets: [spec('creature', { sub: ['Ninja', 'Turtle'] })],
    }),
  ],
});

// Corrections found by comparing every base-set card with its full rules text.
d(
  'Casey Jones, Jury-Rig Justiciar',
  '',
  ab([
    etb([
      {
        e: 'dig',
        n: 4,
        take: 1,
        filter: { type: 'Artifact' },
        rest: 'bottom',
        optional: true,
        randomBottom: true,
      },
    ]),
  ]),
);
d(
  'Action News Crew',
  '',
  ab([act({ mana: '{6}', discardSelf: true }, [count(mine), draw], '通魂：全軍放指示物並抓牌', { fromHand: true })]),
);
d(
  'High-Flying Ace',
  '',
  ab([
    act({ mana: '{3}{W}' }, [pump('T0', 0, 0, ['flying'])], '賦予飛行', {
      sorcery: true,
      targets: [spec('creature', { nonKw: 'flying' })],
    }),
  ]),
);
d(
  'Agent Bishop, Man in Black',
  '',
  ab([
    trig('combatStart', [count('T0'), count('T1')], {
      targets: [
        { ...CR, optional: true },
        { ...CR, optional: true },
      ],
    }),
  ]),
);
d(
  'Armaggon, Future Shark',
  '',
  ab([
    etb(
      [
        { e: 'destroy', what: 'T0' },
        { e: 'destroy', what: 'T1' },
        { e: 'destroy', what: 'T2' },
      ],
      { targets: [0, 1, 2].map(() => ({ ...CR, optional: true })) },
    ),
  ]),
);
d('Uneasy Alliance', '', {
  aura: { target: CR, grant: { cantAttack: true, cantBlock: true } },
  abilities: [
    act({ mana: '{5}', sacSelf: true }, [special('allianceExile'), { e: 'token', token: 'tok-tmt-ninja' }], '放逐所結附生物', {
      sorcery: true,
    }),
  ],
});
d('Ooze Spill', '', spell([{ e: 'counter', what: 'T0' }, mutagen], [{ kind: 'spell' }]));
d('Foot Mystic', '', ab([etb([{ e: 'token', token: 'tok-tmt-ninja' }], { cond: disappear })]));
d('South Wind Avatar', '', ab([trig('allyDies', [special('southLife')]), trig('lifegain', [{ e: 'lose', n: 1, who: 'opp' }])]));
d('Super Shredder', '', ab([trig('otherLeaves', [counter])]));
d(
  'Tunnel Rats',
  '',
  ab([
    act({ mana: '{4}{B}' }, [{ e: 'reanimate', what: 'selfAny', tapped: true }], '從墳墓場回場', { fromGraveyard: true, keepSelf: true }),
  ]),
);
d("Shredder's Revenge", '', {
  spell: {
    modes: [
      {
        text: '目標玩家棄兩張牌',
        targets: [{ kind: 'player' }],
        effects: [{ e: 'discard', who: 'T0', n: 2 }],
      },
      {
        text: '目標玩家抓兩張牌並失去2生命',
        targets: [{ kind: 'player' }],
        effects: [
          { e: 'draw', who: 'T0', n: 2 },
          { e: 'lose', who: 'T0', n: 2 },
        ],
      },
    ],
  },
});
d(
  'Bot Bashing Time',
  '',
  spell(
    [
      { e: 'exileIfDies', what: 'T0' },
      { e: 'damage', n: 6, to: 'T0' },
    ],
    [CR],
  ),
);
d('Manhole Missile', '', spell([{ e: 'damage', n: 3, to: 'T0' }, special('missileLoot')], [CR]));
d(
  'Mouser Foundry',
  '',
  ab([
    etb([{ e: 'token', token: 'tok-robot' }]),
    trig('leaves', [{ e: 'token', token: 'tok-robot' }]),
    act({ mana: '{4}{R}', sacSelf: true }, [{ e: 'damage', n: 3, to: 'T0' }], '犧牲：3點傷害', { targets: [CR] }),
  ]),
);
d(
  'Escape Tunnel',
  '',
  ab([
    act({ tap: true, sacSelf: true }, [{ e: 'searchLand', to: 'battlefield', tapped: true }], '搜尋基本地'),
    act({ tap: true, sacSelf: true }, [pump('T0', 0, 0, ['unblockable'])], '小型生物不能被阻擋', {
      targets: [spec('creature', { powMax: 2 })],
    }),
  ]),
);
d(
  'Lessons from Life',
  '',
  spell([
    { e: 'draw', n: 3 },
    { e: 'landFromHand', tapped: true },
  ]),
);
d('Saved by the Shell', '', {
  costReduce: {
    cond: { c: 'controls', filter: { sub: 'Turtle' } },
    mana: '{1}',
  },
  spell: {
    targets: [MY_CR],
    effects: [count('T0'), pump('T0', 0, 0, ['trample', 'hexproof', 'indestructible'])],
  },
});
d('The Last Ronin', '', {
  saga: {
    chapters: [
      { effects: [{ e: 'destroy', what: allCreatures }] },
      {
        effects: [
          { e: 'mill', n: 4 },
          {
            e: 'reflexive',
            targets: [myGy],
            effects: [{ e: 'toHand', what: 'T0' }],
          },
        ],
      },
      { effects: [special('roninAlone')] },
    ],
  },
});

export function completeTmt() {
  for (const row of catalog) {
    const old = registered.find((c) => c.id === slug(row.name));
    // Negate is a reprint shared with other sets.
    if (old && old.set !== 'TMT') continue;
    const patch = defs.get(row.name);
    if (!old && !patch) throw new Error(`TMT缺少機制定義：${row.number} ${row.name}`);
    const def = {
      ...old,
      ...row,
      ...patch,
      text: row.text,
    } as unknown as CardDef;
    const crew = /Crew (\d+)/.exec(row.text);
    if (crew && !def.abilities?.some((a) => a.kind === 'activated' && a.cost.crew !== undefined))
      def.abilities = [
        ...(def.abilities ?? []),
        act(
          { crew: Number(crew[1]) },
          [
            {
              e: 'animate',
              what: 'self',
              p: def.power ?? 0,
              t: def.toughness ?? 0,
            },
          ],
          `駕駛${crew[1]}`,
        ),
      ];
    if (old) Object.assign(old, def);
    else add(def);
  }
}
