// TLA 001–281；卡名、費用與 Oracle 來源：Card-Forge/forge（見 tla-catalog.json）。
// 沿用既有大地彎折的衍生物簡化；下列中文敘述對應實際遊戲效果。
import catalog from './tla-catalog.json';
import type { Ability, CardDef, Cond, Effect, Filter, Grant, Ref, TargetSpec } from '../../engine/types';
import { defs as registered, add, seen, slug, etb, trig, act, CR, MY_CR, OPP_CR, OPP } from '../dsl';

const mine: Ref = { all: { type: 'Creature', ctrl: 'you' } };
const creatures: Ref = { all: { type: 'Creature' } };
const shrine: Filter = { sub: 'Shrine', ctrl: 'you' };
const lesson = { c: 'gyCount', filter: { sub: 'Lesson' }, n: 1 } as const;
const gy: TargetSpec = { kind: 'gyCard' };
const nonland: TargetSpec = { kind: 'permanent', filter: { nonType: 'Land' } };
const myNonland: TargetSpec = { kind: 'permanent', filter: { nonType: 'Land', ctrl: 'you', other: true }, optional: true };
const any: TargetSpec = { kind: 'any' };
const selfCount: Effect = { e: 'counters', what: 'self', n: 1 };
const clue: Effect = { e: 'token', token: 'tok-clue' };
const ally: Effect = { e: 'token', token: 'tok-ally' };
const draw: Effect = { e: 'draw', n: 1 };
const earth = (n: (Effect & { e: 'earthbend' }) | number): Effect => (typeof n === 'number' ? { e: 'earthbend', n } : n);
const air = (what: Ref = 'T0'): Effect => ({ e: 'airbend', what });
const special = (action: string, what?: Ref): Effect => ({ e: 'tla', action, what });
const pump = (what: Ref, p = 0, t = 0, kw: Grant['kw'] = []): Effect => ({ e: 'pump', what, p, t, kw });
const counters = (what: Ref, n = 1): Effect => ({ e: 'counters', what, n });
const grant = (what: Ref, value: Grant, permanent = false): Effect => ({ e: 'grant', what, grant: value, permanent });
const wb = (n: number, effects: Effect[], label: string, x: Partial<Extract<Ability, { kind: 'activated' }>> = {}): Ability => ({
  kind: 'activated',
  cost: {},
  waterbend: n,
  effects,
  label,
  ...x,
});
const st = (grant: Grant, cond?: Cond): Ability => ({ kind: 'static', self: { grant, cond } });
const spell = (effects: Effect[], targets?: TargetSpec[]): Partial<CardDef> => ({ spell: { effects, targets } });
const defs = new Map<string, Partial<CardDef>>();
function d(name: string, text: string, patch: Partial<CardDef>) {
  defs.set(name, { text, ...patch });
}
const ab = (abilities: Ability[]): Partial<CardDef> => ({ abilities });
const exhaust = (mana: string, effects: Effect[], label: string, x = {}) => act({ mana }, effects, label, { oncePerGame: true, ...x });
const shrineAbilities = (first: Effect[], later: Effect[]): Partial<CardDef> =>
  ab([etb(first), trig('allyPermEtb', later, { filter: { sub: 'Shrine' } })]);
const drain: Effect[] = [
  { e: 'lose', who: 'opp', n: 1 },
  { e: 'gain', n: 1 },
];

d("Aang's Journey", '從牌庫搜尋基本地到手上，獲得2點生命。增幅{2}：另搜尋一張祭祠。', {
  spell: {
    modes: [
      {
        text: '搜尋基本地',
        effects: [
          { e: 'searchLand', to: 'hand' },
          { e: 'gain', n: 2 },
        ],
      },
      {
        text: '增幅：搜尋基本地與祭祠',
        cost: '{4}',
        effects: [
          { e: 'searchLand', to: 'hand' },
          { e: 'tutor', filter: { sub: 'Shrine' } },
          { e: 'gain', n: 2 },
        ],
      },
    ],
  },
});
d('Energybending', '你的地本回合具有所有基本地類別。抓一張牌。', spell([special('energy'), draw]));
d(
  "Zuko's Exile",
  '放逐目標神器、生物或結界，其操控者派出線索。',
  spell(
    [
      { e: 'token', token: 'tok-clue', who: 'T0ctrl' },
      { e: 'exile', what: 'T0' },
    ],
    [{ kind: 'permanent', filter: { type: ['Artifact', 'Creature', 'Enchantment'] } }],
  ),
);
d(
  'Aang, the Last Airbender',
  '飛行。進場時御氣至多一個其他非地永久物。施放課程時，本回合獲得繫命。',
  ab([
    etb([air()], { targets: [{ ...nonland, notSelf: true, optional: true }] }),
    trig('castAny', [pump('self', 0, 0, ['lifelink'])], { filter: { sub: 'Lesson' } }),
  ]),
);
d(
  "Aang's Iceberg",
  '閃現。進場時放逐至多一個其他非地永久物直到此結界離場。御水3：犧牲它並占卜2。',
  ab([
    etb([{ e: 'exileLinked', what: 'T0' }], { targets: [{ ...nonland, notSelf: true, optional: true }] }),
    wb(
      3,
      [
        { e: 'sac', what: 'self' },
        { e: 'scry', n: 2 },
      ],
      '御水3：犧牲並占卜2',
    ),
  ]),
);
d(
  'Airbender Ascension',
  '進場時御氣至多一個生物。你的生物進場時放置任務指示物。結束步驟若有至少四個，閃現至多一個你的生物。',
  ab([
    etb([air()], { targets: [{ ...CR, optional: true }] }),
    trig('anyEtb', [{ e: 'chargeCounter', what: 'self', n: 1 }], { filter: { ctrl: 'you' } }),
    trig('endStep', [{ e: 'flicker', what: 'T0' }], { cond: { c: 'charge', n: 4 }, targets: [{ ...MY_CR, optional: true }] }),
  ]),
);
d("Airbender's Reversal", '選擇消滅攻擊生物，或御氣你的生物。', {
  spell: {
    modes: [
      { text: '消滅攻擊生物', targets: [{ kind: 'creature', filter: { attacking: true } }], effects: [{ e: 'destroy', what: 'T0' }] },
      { text: '御氣你的生物', targets: [MY_CR], effects: [air()] },
    ],
  },
});
d('Airbending Lesson', '御氣目標非地永久物。抓一張牌。', spell([air(), draw], [nonland]));
const appaModes = [
  { text: '你的生物獲得飛行', targets: [MY_CR], effects: [pump('T0', 0, 0, ['flying'])] },
  { text: '御氣你的其他非地永久物', targets: [myNonland], effects: [air()] },
];
d(
  'Appa, Loyal Sky Bison',
  '飛行。進場或攻擊時，選擇讓你的生物本回合飛行，或御氣你的其他非地永久物。',
  ab([etb([], { modes: appaModes }), trig('attacks', [], { modes: appaModes })]),
);
d(
  'Appa, Steadfast Guardian',
  '閃現，飛行。進場時可御氣任意數量你的其他非地永久物。從放逐區施放咒語時，派出盟友。',
  ab([etb([special('appa')]), trig('castAny', [special('exileAlly')])]),
);
d(
  "Avatar's Wrath",
  '保留至多一個目標生物，御氣其餘生物。直到你的下回合對手不能從放逐區施放咒語。放逐此咒語。',
  spell([special('wrath'), { e: 'exile', what: 'selfAny' }], [{ ...CR, optional: true }]),
);
d(
  'Compassionate Healer',
  '橫置時獲得1點生命並占卜1。',
  ab([
    trig('becomesTapped', [
      { e: 'gain', n: 1 },
      { e: 'scry', n: 1 },
    ]),
  ]),
);
d('Destined Confrontation', '各玩家選擇總力量至多4的生物，犧牲其餘生物。', spell([special('confrontation')]));
d(
  'Earth Kingdom Protectors',
  '警戒。犧牲：你的另一個盟友本回合獲得不滅。',
  ab([
    act({ sacSelf: true }, [pump('T0', 0, 0, ['indestructible'])], '保護盟友', {
      targets: [{ kind: 'creature', filter: { ctrl: 'you', sub: 'Ally', other: true } }],
    }),
  ]),
);
d(
  'Enter the Avatar State',
  '你的生物本回合成為神通並獲得飛行、先攻、繫命與辟邪。',
  spell([special('avatarType', 'T0'), pump('T0', 0, 0, ['flying', 'first_strike', 'lifelink', 'hexproof'])], [MY_CR]),
);
d(
  'Fancy Footwork',
  '重置一至兩個不同目標生物，各得+2/+2直到回合結束。',
  spell([{ e: 'untap', what: 'T0' }, { e: 'untap', what: 'T1' }, pump('T0', 2, 2), pump('T1', 2, 2)], [CR, { ...CR, optional: true }]),
);
d(
  'Gather the White Lotus',
  '每個平原派出一個盟友，然後占卜2。',
  spell([
    { e: 'token', token: 'tok-ally', n: { count: { type: 'Land', sub: 'Plains', ctrl: 'you' } } },
    { e: 'scry', n: 2 },
  ]),
);
d('Glider Staff', '進場時御氣至多一個生物。佩帶者+1/+1且飛行。裝備{2}。', {
  equip: { cost: '{2}', grant: { p: 1, t: 1, kw: ['flying'] } },
  abilities: [etb([air()], { targets: [{ ...CR, optional: true }] })],
});
d(
  'Hakoda, Selfless Commander',
  '警戒。可以從牌庫頂施放盟友。犧牲：你的生物本回合+0/+5並獲得不滅。',
  ab([{ kind: 'static', topCast: { sub: 'Ally' } }, act({ sacSelf: true }, [pump(mine, 0, 5, ['indestructible'])], '保護全軍')]),
);
d(
  'Master Piandao',
  '先攻。攻擊時檢視頂四張，可取一張盟友、武具或課程。',
  ab([trig('attacks', [{ e: 'dig', n: 4, filter: { sub: ['Ally', 'Equipment', 'Lesson'] }, rest: 'bottom' }])]),
);
d(
  'Momo, Playful Pet',
  '飛行，警戒。離場時選擇派出食物、在你的生物上放一個指示物，或占卜2。',
  ab([
    trig('leaves', [], {
      modes: [
        { text: '食物', effects: [{ e: 'token', token: 'tok-food' }] },
        { text: '+1/+1指示物', targets: [MY_CR], effects: [counters('T0')] },
        { text: '占卜2', effects: [{ e: 'scry', n: 2 }] },
      ],
    }),
  ]),
);
d('Path to Redemption', '結附生物不能攻擊或阻擋。你的回合中{5}並犧牲：放逐它並派出盟友。', {
  aura: { grant: { cantAttack: true, cantBlock: true } },
  abilities: [act({ mana: '{5}', sacSelf: true }, [special('redemption')], '放逐並派出盟友', { duringYourTurn: true })],
});
d(
  'Southern Air Temple',
  '進場時在你的每個生物上放置等同祭祠數的指示物。另一個祭祠進場時各放一個。',
  shrineAbilities([{ e: 'counters', what: mine, n: { count: shrine } }], [counters(mine)]),
);
d(
  'Team Avatar',
  '單獨攻擊的生物本回合得+X/+X，X是你的生物數。{2}{W}，棄掉此牌：對生物造成等同你的生物數的傷害。',
  ab([
    trig(
      'youAttack',
      [{ e: 'pump', what: 'trig', p: { count: { type: 'Creature', ctrl: 'you' } }, t: { count: { type: 'Creature', ctrl: 'you' } } }],
      { alone: true },
    ),
    act(
      { mana: '{2}{W}', discardSelf: true },
      [{ e: 'damage', n: { count: { type: 'Creature', ctrl: 'you' } }, to: 'T0' }],
      '棄掉：造成傷害',
      { fromHand: true, targets: [CR] },
    ),
  ]),
);
d(
  'United Front',
  '派出X個盟友，然後在你的每個生物上放一個指示物。',
  spell([{ e: 'token', token: 'tok-ally', n: { x: true } }, counters(mine)]),
);
d(
  'Vengeful Villagers',
  '攻擊時橫置對手的生物，可犧牲神器或生物來在它上面放暈眩指示物。',
  ab([
    trig(
      'attacks',
      [
        { e: 'tap', what: 'T0' },
        {
          e: 'costThen',
          cost: { sac: { type: ['Artifact', 'Creature'] } },
          prompt: '犧牲來放暈眩指示物？',
          then: [{ e: 'stun', what: 'T0' }],
        },
      ],
      { targets: [OPP_CR] },
    ),
  ]),
);
d(
  'Water Tribe Rallier',
  '御水5：檢視頂四張，可取一張力量至多3的生物。',
  ab([wb(5, [{ e: 'dig', n: 4, filter: { type: 'Creature', powMax: 3 }, rest: 'bottom' }], '御水5：尋找生物')]),
);
d('Benevolent River Spirit', '額外費用御水5。飛行，守護{2}。進場時占卜2。', { waterbend: 5, abilities: [etb([{ e: 'scry', n: 2 }])] });
d('Crashing Wave', '御水X：橫置至多X個對手生物，將三個暈眩指示物分配給對手已橫置的生物。', spell([special('wave')]));
d('Ember Island Production', '複製你的生物為非傳奇4/4英雄，或對手生物為非傳奇2/2懦夫。', {
  spell: {
    modes: [
      { text: '4/4英雄', targets: [MY_CR], effects: [{ e: 'copyCreature', what: 'T0', p: 4, t: 4, sub: 'Hero' }] },
      { text: '2/2懦夫', targets: [OPP_CR], effects: [{ e: 'copyCreature', what: 'T0', p: 2, t: 2, sub: 'Coward' }] },
    ],
  },
});
d('First-Time Flyer', '飛行。墳墓場有課程時+1/+1。', ab([st({ p: 1, t: 1 }, lesson)]));
d(
  'Flexible Waterbender',
  '警戒。御水3：本回合基礎力量與防禦力為5/2。',
  ab([wb(3, [{ e: 'setBase', what: 'self', p: 5, t: 2 }], '御水3：成為5/2')]),
);
d('Geyser Leaper', '飛行。御水4：抓一張，棄一張。', ab([wb(4, [draw, { e: 'discard', who: 'you', n: 1 }], '御水4：抓一棄一')]));
d('Giant Koi', '御水3：本回合不能被阻擋。海島循環{2}。', {
  cycling: { cost: '{2}', search: { type: 'Land', sub: 'Island' } },
  abilities: [wb(3, [pump('self', 0, 0, ['unblockable'])], '御水3：不能被阻擋')],
});
d(
  'Gran-Gran',
  '橫置時抓一張，棄一張。墳墓場有至少三張課程時，你的非生物咒語少付{1}。',
  ab([
    trig('becomesTapped', [draw, { e: 'discard', who: 'you', n: 1 }]),
    {
      kind: 'static',
      spellCostLess: { filter: { nonType: 'Creature' }, n: 1 },
      condition: { c: 'gyCount', filter: { sub: 'Lesson' }, n: 3 },
    } as Ability,
  ]),
);
d('Honest Work', '結附對手生物。進場時橫置它並移除指示物；它失去異能並成為1/1市民，具有「{T}：加{C}」。', {
  aura: { target: OPP_CR, grant: { loseAbilities: true } },
  abilities: [etb([special('honest')])],
});
d(
  'Invasion Submersible',
  '進場時可彈回另一個非地永久物。竭力—御水3：永久成為神器生物，放三個指示物。',
  ab([
    etb([{ e: 'bounce', what: 'T0' }], { targets: [{ ...nonland, notSelf: true, optional: true }] }),
    wb(3, [special('submersible'), counters('self', 3)], '竭力—御水3：成為生物', { oncePerGame: true }),
  ]),
);
d(
  'Katara, Bending Prodigy',
  '結束步驟若已橫置，在卡塔拉上放一個指示物。御水6：抓一張牌。',
  ab([trig('endStep', [selfCount], { cond: { c: 'selfTapped' } }), wb(6, [draw], '御水6：抓牌')]),
);
d(
  'Lost Days',
  '目標生物或結界的擁有者選擇放到牌庫第二張或底部。派出線索。',
  spell([special('lost', 'T0'), clue], [{ kind: 'permanent', filter: { type: ['Creature', 'Enchantment'] } }]),
);
d(
  'Master Pakku',
  '勇行。橫置時目標玩家磨X張，X為你墳墓場的課程數。',
  ab([trig('becomesTapped', [{ e: 'mill', n: { gy: { sub: 'Lesson' } }, who: 'T0' }], { targets: [{ kind: 'player' }] })]),
);
d(
  'The Mechanist, Aerial Artisan',
  '施放非生物咒語時派出線索。{T}：你的神器衍生物本回合成為3/1飛行組構體。',
  ab([
    trig('castNoncreature', [clue]),
    act({ tap: true }, [{ e: 'animate', what: 'T0', p: 3, t: 1, kw: ['flying'], subtypes: ['Construct'] }], '變成飛行組構體', {
      targets: [{ kind: 'permanent', filter: { ctrl: 'you', type: 'Artifact', token: true } }],
    }),
  ]),
);
d(
  'North Pole Patrol',
  '{T}：重置你的另一個永久物。御水3，{T}：橫置對手的生物。',
  ab([
    act({ tap: true }, [{ e: 'untap', what: 'T0' }], '重置永久物', {
      targets: [{ kind: 'permanent', filter: { ctrl: 'you', other: true } }],
    }),
    wb(3, [{ e: 'tap', what: 'T0' }], '御水3：橫置生物', { cost: { tap: true }, targets: [OPP_CR] }),
  ]),
);
d('Otter-Penguin', '你抓第二張牌時，本回合+1/+2且不能被阻擋。', ab([trig('drawSecond', [pump('self', 1, 2, ['unblockable'])])]));
d(
  'Secret of Bloodbending',
  '操控對手的下一個戰鬥階段；可額外御水10改為操控其下一回合。放逐此牌。',
  spell([special('bloodbend'), { e: 'exile', what: 'selfAny' }], [OPP]),
);
d('Serpent of the Pass', '墳墓場至少三張課程時可瞬間施放。墳墓場每張非生物非地牌使費用少{1}。', {
  flashCond: { c: 'gyCount', filter: { sub: 'Lesson' }, n: 3 },
  costReduce: { perGy: { nonType: ['Creature', 'Land'] } },
});
d('The Spirit Oasis', '進場時每個祭祠抓一張。另一個祭祠進場時抓一張。', shrineAbilities([{ e: 'draw', n: { count: shrine } }], [draw]));
d(
  'Spirit Water Revival',
  '抓兩張。可額外御水6：改為將墳墓場洗回牌庫、抓七張，永久沒有手牌上限。放逐此牌。',
  spell([
    { e: 'waterbend', n: 6, then: [special('revival')], else: [{ e: 'draw', n: 2 }] },
    { e: 'exile', what: 'selfAny' },
  ]),
);
d(
  'Teo, Spirited Glider',
  '飛行。你以飛行生物攻擊時，抓一棄一；若棄掉非地牌，在你的生物上放指示物。',
  ab([trig('youAttack', [special('teo')], { filter: { kw: 'flying' } })]),
);
d(
  'Tiger-Seal',
  '警戒。你的維持開始橫置此生物。抓第二張牌時重置它。',
  ab([trig('upkeep', [{ e: 'tap', what: 'self' }]), trig('drawSecond', [{ e: 'untap', what: 'self' }])]),
);
d(
  'Ty Lee, Chi Blocker',
  '閃現，勇行。進場時橫置至多一個生物；只要你操控泰莉，它便不會在重置步驟重置。',
  ab([etb([special('chiBlock')], { targets: [{ ...CR, optional: true }] })]),
);
d('The Unagi of Kyoshi Island', '閃現。守護—御水4（本遊戲以{4}支付）。對手抓第二張牌時你抓兩張。', {
  ward: 4,
  abilities: [trig('oppDrawSecond', [{ e: 'draw', n: 2 }])],
});
d('Wan Shi Tong, Librarian', '閃現，飛行，警戒。進場放X個指示物並抓X的一半（向下取整）。對手搜尋牌庫時放一個指示物並抓牌。', {
  etbCountersX: true,
  abilities: [etb([special('wan')]), trig('oppSearch', [selfCount, draw])],
});
d(
  'Waterbender Ascension',
  '你的生物造成戰鬥傷害時放任務指示物；若至少四個則抓牌。御水4：生物本回合不能被阻擋。',
  ab([
    trig('allyCombatDamagePlayer', [
      { e: 'chargeCounter', what: 'self', n: 1 },
      { e: 'if', cond: { c: 'charge', n: 4 }, then: [draw] },
    ]),
    wb(4, [pump('T0', 0, 0, ['unblockable'])], '御水4：不能被阻擋', { targets: [CR] }),
  ]),
);
d(
  'Waterbending Lesson',
  '抓三張牌，然後棄一張，除非你御水2。',
  spell([
    { e: 'draw', n: 3 },
    { e: 'waterbend', n: 2, then: [], else: [{ e: 'discard', who: 'you', n: 1 }] },
  ]),
);
d(
  'Waterbending Scroll',
  '{6}，{T}：抓牌；每個海島少付{1}。',
  ab([act({ mana: '{6}', tap: true }, [draw], '抓一張牌', { costLessPer: { type: 'Land', sub: 'Island', ctrl: 'you' } })]),
);
d('Watery Grasp', '結附生物不會在重置步驟重置。御水5：將它洗回擁有者牌庫。', {
  aura: { grant: { noUntap: true } },
  abilities: [wb(5, [{ e: 'shuffleIn', what: 'attached' }], '御水5：洗回牌庫')],
});
d(
  'Yue, the Moon Spirit',
  '飛行，警戒。御水5，{T}：可免費施放手上一個非生物咒語。',
  ab([wb(5, [special('yue')], '御水5：免費施放非生物', { cost: { tap: true } })]),
);
d('Azula, On the Hunt', '御火2。攻擊時你失去1點生命並派出線索。', ab([trig('attacks', [{ e: 'lose', who: 'you', n: 1 }, clue])]));
d(
  'Boiling Rock Rioter',
  '御火1。橫置你的盟友：放逐墳墓場一張牌。攻擊時可施放以此牌放逐的盟友。',
  ab([
    act({ tapN: { filter: { sub: 'Ally' }, n: 1 } }, [special('rioterExile', 'T0')], '放逐墳墓場牌', { targets: [gy] }),
    trig('attacks', [special('rioterCast')]),
  ]),
);
d(
  'Buzzard-Wasp Colony',
  '飛行。進場可犧牲神器或生物來抓牌。另一個你的生物死去時，將它的+1/+1指示物放到此生物。',
  ab([
    etb([{ e: 'costThen', cost: { sac: { type: ['Creature', 'Artifact'] } }, prompt: '犧牲來抓牌？', then: [draw] }]),
    trig('allyDies', [special('inherit')]),
  ]),
);
d('Callous Inspector', '威懾。死去時對你造成1點傷害並派出線索。', ab([trig('dies', [{ e: 'damage', n: 1, to: 'you' }, clue])]));
d(
  'Cat-Gator',
  '繫命。進場時對任意目標造成等同你沼澤數的傷害。',
  ab([etb([{ e: 'damage', n: { count: { type: 'Land', sub: 'Swamp', ctrl: 'you' } }, to: 'T0' }], { targets: [any] })]),
);
d('Dai Li Indoctrination', '選擇令對手棄掉你選擇的非地永久物，或大地彎折2。', {
  spell: {
    modes: [
      {
        text: '棄非地永久物',
        targets: [OPP],
        effects: [{ e: 'discardChosen', who: 'T0', filter: { nonType: ['Land', 'Instant', 'Sorcery'] } }],
      },
      { text: '大地彎折2', effects: [earth(2)] },
    ],
  },
});
d('Deadly Precision', '消滅生物。額外支付{4}或犧牲神器或生物。', {
  spell: {
    modes: [
      { text: '支付{4}', cost: '{4}{B}', targets: [CR], effects: [{ e: 'destroy', what: 'T0' }] },
      { text: '犧牲神器或生物', sac: { type: ['Artifact', 'Creature'] }, targets: [CR], effects: [{ e: 'destroy', what: 'T0' }] },
    ],
  },
});
d('Fatal Fissure', '當目標生物本回合死去時，你大地彎折4。', spell([special('fatal', 'T0')], [CR]));
d(
  'The Fire Nation Drill',
  '踐踏。進場可橫置它來消滅力量至多4的生物。{1}：對手永久物本回合失去辟邪與不滅。駕駛2。',
  ab([
    etb([
      {
        e: 'may',
        prompt: '橫置來消滅生物？',
        effects: [
          { e: 'tap', what: 'self' },
          { e: 'reflexive', targets: [{ kind: 'creature', filter: { powMax: 4 } }], effects: [{ e: 'destroy', what: 'T0' }] },
        ],
      },
    ]),
    act({ mana: '{1}' }, [grant({ all: { ctrl: 'opp' } }, { removeKw: ['hexproof', 'indestructible'] })], '移除辟邪與不滅'),
  ]),
);
d(
  'Fire Nation Engineer',
  '襲擊—結束步驟在你的另一個生物或載具上放一個指示物。',
  ab([
    trig('endStep', [counters('T0')], {
      cond: { c: 'attacked' },
      targets: [{ kind: 'permanent', filter: { ctrl: 'you', other: true, or: [{ type: 'Creature' }, { sub: 'Vehicle' }] } }],
    }),
  ]),
);
d(
  'Fire Navy Trebuchet',
  '守軍，延勢。你攻擊時派出橫置且攻擊的2/1飛行神器組構體，結束步驟犧牲。',
  ab([trig('youAttack', [{ e: 'token', token: 'tok-ballistic-boulder', tapped: true, attacking: true, temp: true }])]),
);
d('Foggy Swamp Visions', '御水X：從墳墓場放逐至多X張生物牌，各派出其複製，在結束步驟犧牲。', spell([special('visions')]));
d(
  'Hog-Monkey',
  '戰鬥開始時，你有指示物的生物本回合獲得威懾。竭力{5}：放兩個指示物。',
  ab([
    trig('combatStart', [pump('T0', 0, 0, ['menace'])], { targets: [{ kind: 'creature', filter: { ctrl: 'you', plusCounters: true } }] }),
    exhaust('{5}', [counters('self', 2)], '竭力：兩個指示物'),
  ]),
);
d(
  'Joo Dee, One of Many',
  '{B}，{T}：刺探1，複製自己，然後犧牲一個神器或生物。限法術時機。',
  ab([
    act(
      { mana: '{B}', tap: true },
      [{ e: 'surveil', n: 1 }, { e: 'copyOfSelf' }, { e: 'edict', who: 'you', filter: { type: ['Artifact', 'Creature'] } }],
      '刺探、複製並犧牲',
      { sorcery: true },
    ),
  ]),
);
d(
  'June, Bounty Hunter',
  '本回合抓至少兩張牌時不能被阻擋。你的回合{1}並犧牲另一生物：派出線索。',
  ab([
    st({ kw: ['unblockable'] }, { c: 'drawsGte', n: 2 }),
    act({ mana: '{1}', sacOther: { type: 'Creature', other: true } }, [clue], '犧牲：線索', { duringYourTurn: true }),
  ]),
);
d(
  'Koh, the Face Stealer',
  '進場時可放逐另一個生物。另一非衍生生物死去時可放逐它。支付1點生命：選擇以寇放逐的生物，獲得它的觸發與起動式異能。',
  ab([
    etb([special('kohExile', 'T0')], { targets: [{ ...CR, notSelf: true, optional: true }] }),
    trig('otherDies', [{ e: 'may', prompt: '放逐死去的生物？', effects: [special('kohDead')] }], { filter: { token: false } }),
    act({ life: 1 }, [special('kohChoose')], '取得放逐生物的異能'),
  ]),
);
d(
  'Lo and Li, Twin Tutors',
  '進場時搜尋課程或貴族到手上。你的貴族生物與課程咒語具有繫命。',
  ab([
    etb([{ e: 'tutor', filter: { sub: ['Lesson', 'Noble'] } }]),
    { kind: 'static', anthem: { filter: { ctrl: 'you', sub: ['Noble', 'Lesson'] }, grant: { kw: ['lifelink'] } } },
  ]),
);
d(
  'Merchant of Many Hats',
  '{2}{B}：從墳墓場移回手上。',
  ab([act({ mana: '{2}{B}' }, [{ e: 'toHand', what: 'selfAny' }], '從墳墓場移回手上', { fromGraveyard: true, keepSelf: true })]),
);
d(
  'Northern Air Temple',
  '進場時吸取等同祭祠數的生命。另一祭祠進場時吸取1點生命。',
  shrineAbilities(
    [
      { e: 'lose', who: 'opp', n: { count: shrine } },
      { e: 'gain', n: { count: shrine } },
    ],
    drain,
  ),
);
d(
  'Phoenix Fleet Airship',
  '飛行。若本回合犧牲過永久物，結束步驟複製此載具。控制八艘時永久成為生物。駕駛1。',
  ab([
    trig('endStep', [{ e: 'copyOfSelf' }], { cond: { c: 'sacrificed' } }),
    trig('allyPermEtb', [special('fleet')]),
    etb([special('fleet')]),
  ]),
);
d('Pirate Peddlers', '死觸。你犧牲另一永久物時放一個指示物。', ab([trig('sacrifice', [selfCount], { filter: { other: true } })]));
d(
  'Raven Eagle',
  '飛行。進場或攻擊時可放逐墳墓場牌，若是生物則派出線索。抓第二張牌時吸取1點生命。',
  ab([
    etb([special('raven', 'T0')], { targets: [{ ...gy, optional: true }] }),
    trig('attacks', [special('raven', 'T0')], { targets: [{ ...gy, optional: true }] }),
    trig('drawSecond', drain),
  ]),
);
d(
  'Ruinous Waterbending',
  '所有生物本回合-2/-2。可額外御水4，使本回合每次生物死亡時你獲得1點生命。',
  spell([{ e: 'waterbend', n: 4, then: [special('ruinous')] }, pump(creatures, -2, -2)]),
);
d(
  'Sold Out',
  '放逐目標生物；若它本回合受過傷害，派出線索。',
  spell(
    [
      { e: 'if', cond: { c: 'targetIs', t: 0, filter: { damaged: true } }, then: [clue] },
      { e: 'exile', what: 'T0' },
    ],
    [CR],
  ),
);
d('Tundra Tank', '御火1。進場時你的生物本回合獲得不滅。駕駛1。', ab([etb([pump('T0', 0, 0, ['indestructible'])], { targets: [MY_CR] })]));
d(
  'Wolfbat',
  '飛行。你抓第二張牌時可支付{B}，將墳墓場中的此牌帶終結指示物放進戰場。',
  ab([
    trig(
      'drawSecond',
      [
        {
          e: 'costThen',
          cost: { mana: '{B}' },
          prompt: '支付{B}使狼蝠回場？',
          then: [{ e: 'reanimate', what: 'selfAny', finality: true }],
        },
      ],
      { fromGraveyard: true },
    ),
  ]),
);
d('Bumi Bash', '選擇對生物造成等同你的地數的傷害，或消滅地生物／非基本地。', {
  spell: {
    modes: [
      { text: '對生物造成傷害', targets: [CR], effects: [{ e: 'damage', n: { count: { type: 'Land', ctrl: 'you' } }, to: 'T0' }] },
      {
        text: '消滅地',
        targets: [{ kind: 'permanent', filter: { type: 'Land', or: [{ type: 'Creature' }, { basic: false }] } }],
        effects: [{ e: 'destroy', what: 'T0' }],
      },
    ],
  },
});
d(
  'Combustion Man',
  '攻擊時消滅目標永久物，除非操控者選擇讓你對其造成等同此生物力量的傷害。',
  ab([trig('attacks', [special('combustion', 'T0')], { targets: [{ kind: 'permanent' }] })]),
);
d(
  'Crescent Island Temple',
  '進場時每個祭祠派出一個1/1紅色勇行修行僧。另一祭祠進場時派出一個。',
  shrineAbilities([{ e: 'token', token: 'tok-tla-monk', n: { count: shrine } }], [{ e: 'token', token: 'tok-tla-monk' }]),
);
d(
  "Deserter's Disciple",
  '橫置：你的另一個力量至多2的生物本回合不能被阻擋。',
  ab([
    act({ tap: true }, [pump('T0', 0, 0, ['unblockable'])], '小生物不能被阻擋', {
      targets: [{ kind: 'creature', filter: { ctrl: 'you', other: true, powMax: 2 } }],
    }),
  ]),
);
d('Fated Firepower', '閃現。進場帶X個烈火指示物。你的來源對對手或其永久物造成的傷害額外增加烈火指示物數。', ab([etb([special('fated')])]));
d('Fire Nation Attacks', '派出兩個2/2紅色御火1士兵。返照{8}{R}。', spell([{ e: 'token', token: 'tok-fire-soldier', n: 2 }]));
d('Fire Nation Cadets', '墳墓場有課程時具有御火2。{2}：本回合+1/+0。', {
  firebending: undefined,
  abilities: [trig('attacks', [{ e: 'firebend', n: 2 }], { cond: lesson }), act({ mana: '{2}' }, [pump('self', 1, 0)], '+1/+0')],
});
d('Fire Sages', '御火1。{1}{R}{R}：放一個指示物。', ab([act({ mana: '{1}{R}{R}' }, [selfCount], '放指示物')]));
d(
  'Firebender Ascension',
  '進場派出御火1士兵。你的攻擊生物觸發攻擊異能時放任務指示物，若至少四個可複製該異能。',
  ab([etb([{ e: 'token', token: 'tok-fire-soldier' }])]),
);
d('Firebending Student', '勇行。御火X，X為此生物力量。', {});
d(
  'How to Start a Riot',
  '目標生物本回合獲得威懾。目標玩家的生物本回合+2/+0。',
  spell([pump('T0', 0, 0, ['menace']), special('riot')], [CR, { kind: 'player' }]),
);
d(
  'Jeong Jeong, the Deserter',
  '御火1。竭力{3}：放一個指示物，並複製本回合下一個課程咒語。',
  ab([exhaust('{3}', [selfCount, special('nextLesson')], '竭力：複製下個課程')]),
);
d("Jet's Brainwashing", '目標生物本回合不能阻擋。增幅{3}：暫時奪取它、重置並獲得敏捷。派出線索。', {
  spell: {
    modes: [
      { text: '不能阻擋', targets: [CR], effects: [grant('T0', { cantBlock: true }), clue] },
      { text: '增幅：暫時奪取', cost: '{3}{R}', targets: [CR], effects: [special('steal', 'T0'), clue] },
    ],
  },
});
d(
  'The Last Agni Kai',
  '你的生物與對手生物互鬥。過量傷害加入等量紅色法術力，紅色法術力保留到回合結束。',
  spell([special('agni')], [MY_CR, OPP_CR]),
);
d(
  'Mai, Jaded Edge',
  '勇行。竭力{3}：永久獲得連擊。',
  ab([exhaust('{3}', [grant('self', { kw: ['double_strike'] }, true)], '竭力：連擊指示物')]),
);
d(
  'Price of Freedom',
  '消滅對手的神器或地，對手可搜尋基本地橫置進場。抓牌。',
  spell(
    [{ e: 'destroy', what: 'T0' }, { e: 'searchLand', to: 'battlefield', tapped: true, who: 'T0ctrl', may: true }, draw],
    [{ kind: 'permanent', filter: { ctrl: 'opp', type: ['Artifact', 'Land'] } }],
  ),
);
d(
  'Ran and Shaw',
  '飛行，御火2。施放進場且墳墓場至少三張龍或課程時，派出非傳奇複製。{3}{R}：你的龍本回合+2/+0。',
  ab([etb([special('ran')]), act({ mana: '{3}{R}' }, [pump({ all: { type: 'Creature', ctrl: 'you', sub: 'Dragon' } }, 2, 0)], '龍+2/+0')]),
);
d('Redirect Lightning', '額外支付{2}或5點生命：更改具有單一目標之咒語或異能的目標。', {
  spell: {
    modes: [
      { text: '額外支付{2}', cost: '{2}{R}', effects: [special('redirect')] },
      { text: '支付5點生命', life: 5, effects: [special('redirect')] },
    ],
  },
});
d(
  'Rough Rhino Cavalry',
  '御火2。竭力{8}：放兩個指示物，本回合獲得踐踏。',
  ab([exhaust('{8}', [counters('self', 2), pump('self', 0, 0, ['trample'])], '竭力：強化')]),
);
d('Solstice Revelations', '放逐頂牌直到非地。若其費用小於你的山脈數，可免費施放；否則置於手上。返照{6}{R}。', spell([special('solstice')]));
d("Sozin's Comet", '你的每個生物本回合獲得御火5。預示{2}{R}。', { foretell: '{2}{R}', ...spell([special('comet')]) });
d(
  'Tiger-Dillo',
  '除非你操控另一個力量至少4的生物，否則不能攻擊或阻擋。',
  ab([
    st({ cantAttack: true, cantBlock: true }, { c: 'not', cond: { c: 'controls', filter: { type: 'Creature', powMin: 4, other: true } } }),
  ]),
);
d('Twin Blades', '閃現。進場裝備你的生物，使它本回合獲得連擊。佩帶者+1/+1。裝備{2}。', {
  equip: { cost: '{2}', grant: { p: 1, t: 1 } },
  abilities: [etb([{ e: 'attach', what: 'T0' }, pump('T0', 0, 0, ['double_strike'])], { targets: [MY_CR] })],
});
d(
  'Ty Lee, Artful Acrobat',
  '勇行。攻擊時可支付{1}使目標生物本回合不能阻擋。',
  ab([
    trig('attacks', [
      {
        e: 'costThen',
        cost: { mana: '{1}' },
        prompt: '支付{1}阻止阻擋？',
        then: [{ e: 'reflexive', targets: [CR], effects: [grant('T0', { cantBlock: true })] }],
      },
    ]),
  ]),
);
d(
  'War Balloon',
  '飛行。{1}：放烈火指示物。至少三個時永久成為生物。駕駛3。',
  ab([act({ mana: '{1}' }, [{ e: 'chargeCounter', what: 'self', n: 1 }, special('balloon')], '放烈火指示物')]),
);
d(
  'Zhao, the Moon Slayer',
  '威懾。非基本地橫置進場。{7}：放征服指示物；此後非基本地成為山脈。',
  ab([{ kind: 'static', allNonbasicTapped: true }, act({ mana: '{7}' }, [{ e: 'chargeCounter', what: 'self', n: 1 }], '征服非基本地')]),
);
d('Zuko, Exiled Prince', '御火3。{3}：放逐頂牌，本回合可使用它。', ab([act({ mana: '{3}' }, [{ e: 'impulse', n: 1 }], '放逐並使用頂牌')]));
d(
  'Avatar Destiny',
  '結附你的生物：每張墳墓場生物牌使它+1/+1並成為神通。它死去時磨等同力量的牌，將此結界移回手上，可從磨牌中復活一個生物。',
  { aura: { target: MY_CR, grant: {} }, abilities: [trig('attachedDies', [special('destiny')])] },
);
d(
  'Badgermole',
  '進場大地彎折2。你的有指示物生物具有踐踏。',
  ab([
    etb([earth(2)]),
    { kind: 'static', anthem: { filter: { type: 'Creature', ctrl: 'you', plusCounters: true }, grant: { kw: ['trample'] } } },
  ]),
);
d(
  'The Boulder, Ready to Rumble',
  '攻擊時大地彎折X，X為你的力量至少4生物數。',
  ab([trig('attacks', [{ e: 'earthbend', n: { count: { type: 'Creature', ctrl: 'you', powMin: 4 } } }])]),
);
d('Bumi, King of Three Trials', '進場可選至多X項（X為墳墓場課程數）：放三個指示物、占卜3、大地彎折3。', ab([etb([special('trials')])]));
d(
  'Cycle of Renewal',
  '犧牲一個地。搜尋至多兩個基本地橫置進場。',
  spell([
    { e: 'edict', who: 'you', filter: { type: 'Land' } },
    { e: 'tutorMany', filter: { type: 'Land', basic: true }, n: 2, to: 'battlefield', tapped: true },
  ]),
);
d('Diligent Zookeeper', '你的每個非人類生物依其生物類別數得到+1/+1，最多+10/+10。', ab([{ kind: 'static', zookeeper: true }]));
d(
  'Earth Kingdom General',
  '進場大地彎折2。每回合第一次你在生物上放指示物時，可獲得等量生命。',
  ab([etb([earth(2)]), trig('allyCounters', [{ e: 'gain', n: { ev: true } }], { oncePerTurn: true, may: '獲得生命？' })]),
);
d(
  'Earth Rumble',
  '大地彎折2，然後可讓你的生物與對手生物互鬥。',
  spell([earth(2), { e: 'reflexive', targets: [{ ...MY_CR, optional: true }, OPP_CR], effects: [{ e: 'fight', a: 'T0', b: 'T1' }] }]),
);
d(
  'Earthen Ally',
  '依你的盟友顏色數獲得+1/+0。{2}{W}{U}{B}{R}{G}：大地彎折5。',
  ab([etb([]), act({ mana: '{2}{W}{U}{B}{R}{G}' }, [earth(5)], '大地彎折5')]),
);
d('Elemental Teachings', '搜尋至多四張不同名地；對手選兩張放入墳墓場，其餘橫置進場。', spell([special('teachings')]));
d(
  "Flopsie, Bumi's Buddy",
  '進場時你的每個生物放一個指示物。你的力量至少4生物不能被多於一個生物阻擋。',
  ab([etb([counters(mine)]), { kind: 'static', oneBlockerPower4: true }]),
);
d('Foggy Swamp Vinebender', '不能被力量至多2生物阻擋。你的回合御水5：放一個指示物。', {
  evadePowLte: 2,
  abilities: [wb(5, [selfCount], '御水5：放指示物', { duringYourTurn: true })],
});
d(
  'Great Divide Guide',
  '你的地與盟友具有「{T}：加任意顏色法術力」。',
  ab([{ kind: 'static', manaGrant: { filter: { or: [{ type: 'Land' }, { sub: 'Ally' }] }, colors: ['W', 'U', 'B', 'R', 'G'] } }]),
);
d('Haru, Hidden Talent', '另一個你的盟友進場時大地彎折1。', ab([trig('allyEtb', [earth(1)], { filter: { sub: 'Ally' } })]));
d(
  'Invasion Tactics',
  '進場時你的生物本回合+2/+2。你的盟友造成戰鬥傷害時抓一張（每個傷害步驟一次）。',
  ab([etb([pump(mine, 2, 2)]), trig('oppCombatDamaged', [special('invasionDraw')])]),
);
d(
  'Kyoshi Island Plaza',
  '進場時搜尋至多X張基本地橫置進場，X為祭祠數。另一祭祠進場時搜尋一張。',
  shrineAbilities(
    [{ e: 'tutorMany', filter: { type: 'Land', basic: true }, n: { count: shrine }, to: 'battlefield', tapped: true }],
    [{ e: 'searchLand', to: 'battlefield', tapped: true }],
  ),
);
d('Ostrich-Horse', '進場磨三張，可取其中一個地；若沒有取地，放一個指示物。', ab([etb([special('ostrich')])]));
d(
  'Rebellious Captives',
  '竭力{6}：放兩個指示物，然後大地彎折2。',
  ab([exhaust('{6}', [counters('self', 2), earth(2)], '竭力：強化並大地彎折')]),
);
d(
  'Rockalanche',
  '大地彎折X，X為你的樹林數。返照{5}{G}。',
  spell([{ e: 'earthbend', n: { count: { type: 'Land', sub: 'Forest', ctrl: 'you' } } }]),
);
d(
  'Seismic Sense',
  '檢視等同你的地數的頂牌，可取一張生物或地到手上。',
  spell([{ e: 'dig', n: { count: { type: 'Land', ctrl: 'you' } }, filter: { type: ['Creature', 'Land'] }, rest: 'bottom' }]),
);
d(
  'Sparring Dummy',
  '守軍。{T}：磨一張，可取磨到的地；若磨到課程則獲得2點生命。',
  ab([act({ tap: true }, [special('dummy')], '磨牌並尋地')]),
);
d(
  'Toph, the Blind Bandit',
  '進場大地彎折2。力量等同你地上的+1/+1指示物數（簡化版大地元素也計入）。',
  ab([etb([earth(2)]), { kind: 'static', selfLandCounters: true }]),
);
d(
  'True Ancestry',
  '墳墓場至多一張永久物移回手上。派出線索。',
  spell(
    [{ e: 'toHand', what: 'T0' }, clue],
    [{ kind: 'gyCard', optional: true, filter: { ctrl: 'you', nonType: ['Instant', 'Sorcery'] } }],
  ),
);
d(
  'Turtle-Duck',
  '{3}：本回合基礎力量為4並獲得踐踏。',
  ab([act({ mana: '{3}' }, [{ e: 'setBase', what: 'self', p: 4, t: 4 }, pump('self', 0, 0, ['trample'])], '力量4並踐踏')]),
);
d(
  'Unlucky Cabbage Merchant',
  '進場派出食物。犧牲食物時可搜尋基本地橫置進場，然後將此生物放牌庫底並洗牌。',
  ab([
    etb([{ e: 'token', token: 'tok-food' }]),
    trig(
      'sacrifice',
      [
        {
          e: 'may',
          prompt: '搜尋基本地？',
          effects: [
            { e: 'searchLand', to: 'battlefield', tapped: true },
            { e: 'shuffleIn', what: 'self' },
          ],
        },
      ],
      { filter: { sub: 'Food' } },
    ),
  ]),
);
d('Walltop Sentries', '延勢，死觸。死去時若墳墓場有課程，獲得2點生命。', ab([trig('dies', [{ e: 'gain', n: 2 }], { cond: lesson })]));
d(
  'Air Nomad Legacy',
  '進場派出線索。你的飛行生物+1/+1。',
  ab([etb([clue]), { kind: 'static', anthem: { filter: { type: 'Creature', ctrl: 'you', kw: 'flying' }, grant: { p: 1, t: 1 } } }]),
);
d(
  'Azula, Cunning Usurper',
  '御火2。進場時對手放逐一個非衍生生物及墳墓場一張非地牌。你的回合可用任意法術力施放它們。',
  ab([etb([special('usurper')], { targets: [OPP] })]),
);
d(
  "Beifong's Bounty Hunters",
  '你的非地生物死去時，大地彎折等同其力量的數量。',
  ab([trig('allyDies', [special('bounty')], { includeSelf: true, filter: { nonType: 'Land' } })]),
);
d(
  'Bitter Work',
  '以力量至少4生物攻擊時抓牌。你的回合竭力{4}：大地彎折4。',
  ab([trig('youAttack', [draw], { filter: { powMin: 4 } }), exhaust('{4}', [earth(4)], '竭力：大地彎折4', { duringYourTurn: true })]),
);
d(
  'Bumi, Unleashed',
  '踐踏。進場大地彎折4。造成戰鬥傷害時重置你的地，增加一個只有地生物可攻擊的戰鬥（簡化版大地元素也可攻擊）。',
  ab([etb([earth(4)]), trig('combatDamagePlayer', [{ e: 'untap', what: { all: { type: 'Land', ctrl: 'you' } } }, special('bumiCombat')])]),
);
d(
  'Cruel Administrator',
  '襲擊—進場時若本回合攻擊過，放一個指示物。攻擊時派出2/2御火1士兵。',
  ab([etb([{ e: 'if', cond: { c: 'attacked' }, then: [selfCount] }]), trig('attacks', [{ e: 'token', token: 'tok-fire-soldier' }])]),
);
d(
  'Dai Li Agents',
  '進場大地彎折1兩次。攻擊時依你的有指示物生物數吸取生命。',
  ab([
    etb([earth(1), earth(1)]),
    trig('attacks', [
      { e: 'lose', who: 'opp', n: { count: { type: 'Creature', ctrl: 'you', plusCounters: true } } },
      { e: 'gain', n: { count: { type: 'Creature', ctrl: 'you', plusCounters: true } } },
    ]),
  ]),
);
d(
  'Dragonfly Swarm',
  '飛行，守護{1}。力量等同墳墓場非生物非地牌數。死去時若墳墓場有課程則抓牌。',
  ab([{ kind: 'static', selfPumpPerGy: { filter: { nonType: ['Creature', 'Land'] }, p: 1 } }, trig('dies', [draw], { cond: lesson })]),
);
d(
  'Earth Rumble Wrestlers',
  '延勢。你有地生物或本回合有地進場時，+1/+0且踐踏（大地元素也計入）。',
  ab([
    st(
      { p: 1, kw: ['trample'] },
      {
        c: 'or',
        conds: [
          { c: 'controls', filter: { type: 'Land', enteredThisTurn: true } },
          { c: 'controls', filter: { type: 'Land', or: [{ type: 'Creature' }] } },
          { c: 'controls', filter: { sub: 'Elemental', token: true } },
        ],
      },
    ),
  ]),
);
d(
  'Fire Lord Azula',
  '御火2。阿祖拉正在攻擊時，每次你施放咒語都複製它。',
  ab([trig('castAny', [{ e: 'copySpell' }], { cond: { c: 'selfAttacking' } })]),
);
d(
  'Fire Lord Zuko',
  '御火X，X為祖寇力量。從放逐區施放咒語或你的永久物從放逐區進場時，全軍放一個指示物。',
  ab([trig('castAny', [special('zukoCast')]), trig('allyPermEtb', [special('zukoEtb')]), etb([special('zukoEtb')])]),
);
d(
  'Foggy Swamp Spirit Keeper',
  '繫命。抓第二張牌時派出1/1無色精靈；它只能阻擋精靈，也只能被精靈阻擋。',
  ab([trig('drawSecond', [{ e: 'token', token: 'tok-tla-spirit' }])]),
);
d(
  'Guru Pathik',
  '進場檢視頂五張，可取課程、傳紀或祭祠。施放這些咒語時在你的另一生物上放指示物。',
  ab([
    etb([{ e: 'dig', n: 5, filter: { sub: ['Lesson', 'Saga', 'Shrine'] }, rest: 'bottom' }]),
    trig('castAny', [counters('T0')], {
      filter: { sub: ['Lesson', 'Saga', 'Shrine'] },
      targets: [{ kind: 'creature', filter: { ctrl: 'you', other: true } }],
    }),
  ]),
);
d(
  'Hama, the Bloodbender',
  '進場時對手磨三張，可放逐其墳墓場一張非生物非地牌。只要你操控哈瑪，你的回合可御水等同其費用來施放。',
  ab([etb([{ e: 'mill', who: 'opp', n: 3 }, special('hama')], { targets: [OPP] })]),
);
d(
  'Hei Bai, Spirit of Balance',
  '進場或攻擊時可犧牲另一生物或神器來放兩個指示物。離場時將指示物放到你的生物上。',
  ab([
    etb([
      {
        e: 'costThen',
        cost: { sac: { type: ['Artifact', 'Creature'], other: true } },
        prompt: '犧牲來放指示物？',
        then: [counters('self', 2)],
      },
    ]),
    trig('attacks', [
      {
        e: 'costThen',
        cost: { sac: { type: ['Artifact', 'Creature'], other: true } },
        prompt: '犧牲來放指示物？',
        then: [counters('self', 2)],
      },
    ]),
    trig('leaves', [{ e: 'counters', what: 'T0', n: { lkiCounters: true } }], { targets: [MY_CR] }),
  ]),
);
d('Hermitic Herbalist', '{T}：任意色法術力。或{T}：加入兩點任意色法術力，只能施放課程。', {
  produces: ['W', 'U', 'B', 'R', 'G'],
  abilities: [act({ tap: true }, [special('herbalist')], '加入兩點課程專用法術力')],
});
d(
  'Iroh, Grand Lotus',
  '御火2。你的回合可返照墳墓場瞬間與法術；課程返照費用{1}，其他牌等同原費用。',
  ab([{ kind: 'static', flashbackAll: true }]),
);
d(
  'Iroh, Tea Master',
  '進場派出食物。戰鬥開始可把你的永久物送給對手，派出盟友，並依對手控制的你的永久物數放指示物。',
  ab([etb([{ e: 'token', token: 'tok-food' }]), trig('combatStart', [special('tea')])]),
);
d('Katara, the Fearless', '你的盟友觸發式異能額外觸發一次。', ab([{ kind: 'static', allyTriggerDouble: true }]));
d(
  "Katara, Water Tribe's Hope",
  '警戒。進場派出盟友。你的回合御水X（X至少1）：你的生物本回合基礎力量與防禦力為X/X。',
  ab([etb([ally]), act({}, [special('kataraX')], '御水X：全軍成為X/X', { duringYourTurn: true })]),
);
d('The Lion-Turtle', '警戒，延勢。進場獲得3點生命。除非墳墓場至少三張課程，否則不能攻擊或阻擋。{T}：任意色法術力。', {
  produces: ['W', 'U', 'B', 'R', 'G'],
  abilities: [
    etb([{ e: 'gain', n: 3 }]),
    st({ cantAttack: true, cantBlock: true }, { c: 'not', cond: { c: 'gyCount', filter: { sub: 'Lesson' }, n: 3 } }),
  ],
});
d(
  'Long Feng, Grand Secretariat',
  '你的另一生物或地從戰場進墳墓場時，在你的生物上放指示物。',
  ab([trig('allyPermanentDies', [counters('T0')], { filter: { type: ['Creature', 'Land'] }, targets: [MY_CR] })]),
);
d(
  'Ozai, the Phoenix King',
  '踐踏，敏捷，御火4。未用法術力保留並成為紅色。有至少六點未用法術力時獲得飛行與不滅。',
  ab([st({ kw: ['flying', 'indestructible'] }, { c: 'poolGte', n: 6 })]),
);
d(
  'Platypus-Bear',
  '守軍。進場磨兩張。墳墓場有課程時可以如同沒有守軍一樣攻擊。',
  ab([etb([{ e: 'mill', n: 2 }]), st({ ignoreDefender: true }, lesson)]),
);
d(
  'Professor Zei, Anthropologist',
  '{T}，棄牌：抓牌。你的回合{1}，{T}並犧牲：從墳墓場取回瞬間或法術。',
  ab([
    act({ tap: true, discard: 1 }, [draw], '棄一抓一'),
    act({ mana: '{1}', tap: true, sacSelf: true }, [{ e: 'toHand', what: 'T0' }], '取回瞬間或法術', {
      duringYourTurn: true,
      targets: [{ kind: 'gyCard', filter: { ctrl: 'you', type: ['Instant', 'Sorcery'] } }],
    }),
  ]),
);
d(
  'Sandbender Scavengers',
  '犧牲另一個永久物時放指示物。死去時可放逐自己，復活費用至多其力量的生物。',
  ab([trig('sacrifice', [selfCount], { filter: { other: true } }), trig('dies', [special('scavengers')])]),
);
d(
  'Sokka, Bold Boomeranger',
  '進場可棄至多兩張牌並抓等量牌。施放神器或課程時放指示物。',
  ab([etb([special('sokkaLoot')]), trig('castAny', [selfCount], { filter: { or: [{ type: 'Artifact' }, { sub: 'Lesson' }] } })]),
);
d(
  'Sokka, Tenacious Tactician',
  '威懾，勇行。你的其他盟友具有威懾與勇行。施放非生物咒語時派出盟友。',
  ab([
    { kind: 'static', anthem: { filter: { sub: 'Ally', ctrl: 'you', other: true }, grant: { kw: ['menace', 'prowess'] } } },
    trig('castNoncreature', [ally]),
  ]),
);
d(
  'Suki, Kyoshi Warrior',
  '力量等同你的生物數。攻擊時派出橫置且攻擊的盟友。',
  ab([
    { kind: 'static', selfPowerCount: { type: 'Creature', ctrl: 'you' } },
    trig('attacks', [{ e: 'token', token: 'tok-ally', tapped: true, attacking: true }]),
  ]),
);
d('Sun Warriors', '御火X，X為你的生物數。{5}：派出盟友。', {
  firebending: { count: { type: 'Creature', ctrl: 'you' } },
  abilities: [act({ mana: '{5}' }, [ally], '派出盟友')],
});
d(
  'Tolls of War',
  '進場派出線索。你的回合犧牲永久物時派出盟友，每回合一次。',
  ab([etb([clue]), trig('sacrifice', [ally], { cond: { c: 'yourTurn' }, oncePerTurn: true })]),
);
d(
  'Toph, Hardheaded Teacher',
  '進場可棄牌取回瞬間或法術。施放咒語時大地彎折1；若是課程，改為大地彎折2。',
  ab([
    etb([{ e: 'costThen', cost: { discard: 1 }, prompt: '棄牌來取回瞬間或法術？', then: [{ e: 'toHand', what: 'T0' }] }], {
      targets: [{ kind: 'gyCard', optional: true, filter: { ctrl: 'you', type: ['Instant', 'Sorcery'] } }],
    }),
    trig('castAny', [{ e: 'if', cond: { c: 'evCardIs', filter: { sub: 'Lesson' } }, then: [earth(2)], else: [earth(1)] }]),
  ]),
);
d('Toph, the First Metalbender', '你的非衍生神器也是地（不自帶產法術力）。結束步驟大地彎折2。', ab([trig('endStep', [earth(2)])]));
d('Uncle Iroh', '御火1。你的課程咒語少付{1}。', ab([{ kind: 'static', spellCostLess: { filter: { sub: 'Lesson' }, n: 1 } }]));
d(
  'Vindictive Warden',
  '威懾，御火1。{3}：對對手造成1點傷害。',
  ab([act({ mana: '{3}' }, [{ e: 'damage', to: 'opp', n: 1 }], '對手1點傷害')]),
);
d(
  'Zhao, Ruthless Admiral',
  '御火2。犧牲另一永久物時，全軍本回合+1/+0。',
  ab([trig('sacrifice', [pump(mine, 1, 0)], { filter: { other: true } })]),
);
d(
  'Zuko, Conflicted',
  '第一主要階段選擇未選過的一項並失去2點生命：抓牌、放指示物、加{R}、放逐並在對手控制下回場。',
  ab([trig('mainStart', [special('conflicted')])]),
);
d(
  'Barrels of Blasting Jelly',
  '{1}：加任意色，每回合一次。{5}，{T}並犧牲：對生物造成5點傷害。',
  ab([
    act({ mana: '{1}' }, [{ e: 'addManaOfChoice', n: 1 }], '過濾法術力', { oncePerTurn: true }),
    act({ mana: '{5}', tap: true, sacSelf: true }, [{ e: 'damage', n: 5, to: 'T0' }], '造成5點傷害', { targets: [CR] }),
  ]),
);
d("Bender's Waterskin", '每位玩家重置步驟重置。{T}：加任意色。', { produces: ['W', 'U', 'B', 'R', 'G'] });
d('Kyoshi Battle Fan', '進場派出盟友並裝備它。佩帶者+1/+0。裝備{2}。', {
  equip: { cost: '{2}', grant: { p: 1 } },
  abilities: [etb([ally, { e: 'attach', what: 'created' }])],
});
d(
  'Planetarium of Wan Shi Tong',
  '{1}，{T}：占卜2。每回合第一次占卜或刺探後，可免費施放牌庫頂牌。',
  ab([act({ mana: '{1}', tap: true }, [{ e: 'scry', n: 2 }], '占卜2'), trig('scry', [special('planetarium')], { oncePerTurn: true })]),
);
d('Trusty Boomerang', '佩帶者具有「{1}，{T}：橫置生物，將此武具移回手上」。裝備{1}。', {
  equip: {
    cost: '{1}',
    grant: {},
    abilities: [act({ mana: '{1}', tap: true }, [{ e: 'tap', what: 'T0' }, special('boomerangReturn')], '使用迴旋鏢', { targets: [CR] })],
  },
});
d(
  'The Walls of Ba Sing Se',
  '守軍。你的其他永久物具有不滅。',
  ab([{ kind: 'static', anthem: { filter: { ctrl: 'you', other: true }, grant: { kw: ['indestructible'] } } }]),
);
d('White Lotus Tile', '橫置進場。{T}：加X點任一色，X為具有共同生物類別的最大生物數。', {
  etbTapped: true,
  abilities: [act({ tap: true }, [special('tile')], '加入共同類別數量的法術力')],
});
d('Fire Nation Palace', '除非操控基本地，否則橫置進場。{T}：加{R}。{1}{R}，{T}：你的生物本回合御火4。', {
  produces: ['R'],
  etbTappedUnless: { c: 'controls', filter: { type: 'Land', basic: true } },
  abilities: [act({ mana: '{1}{R}', tap: true }, [special('palace', 'T0')], '賦予御火4', { targets: [MY_CR] })],
});
d('Jasmine Dragon Tea Shop', '{T}：加{C}，或僅供盟友的任意色法術力。{5}，{T}：派出盟友。', {
  produces: ['C'],
  abilities: [act({ mana: '{5}', tap: true }, [ally], '派出盟友')],
});
d('Realm of Koh', '除非操控基本地，否則橫置進場。{T}：加{B}。{3}{B}，{T}：派出只能與精靈交戰的1/1精靈。', {
  produces: ['B'],
  etbTappedUnless: { c: 'controls', filter: { type: 'Land', basic: true } },
  abilities: [act({ mana: '{3}{B}', tap: true }, [{ e: 'token', token: 'tok-tla-spirit' }], '派出精靈')],
});
d('Secret Tunnel', '不能被阻擋。{T}：加{C}。{4}，{T}：你的兩個同類別生物本回合不能被阻擋。', {
  produces: ['C'],
  keywords: ['unblockable'],
  abilities: [act({ mana: '{4}', tap: true }, [special('tunnel')], '同類別生物不能被阻擋', { targets: [MY_CR, MY_CR] })],
});
d('White Lotus Hideout', '{T}：加{C}，或僅供課程／祭祠的任意色法術力。{1}，{T}：加任意色。', { produces: ['C'], filterMana: true });
// 雙面牌與傳紀：背面沿用引擎既有的 transform / returnTransformed。
const backPatches: Record<string, Partial<CardDef>> = {
  'Avatar Yangchen': ab([
    trig('castAny', [air()], { cond: { c: 'secondSpell' }, targets: [{ ...nonland, optional: true, notSelf: true }] }),
  ]),
  'Avatar Kuruk': ab([
    trig('castAny', [{ e: 'token', token: 'tok-tla-spirit' }]),
    wb(20, [special('extraTurn')], '竭力—御水20：額外回合', { oncePerGame: true }),
  ]),
  'Fire Lord Sozin': ab([trig('combatDamagePlayer', [special('sozin')])]),
  'Avatar Roku': ab([act({ mana: '{8}' }, [{ e: 'token', token: 'tok-tla-dragon' }], '派出御火4飛龍')]),
  'Avatar Kyoshi': ab([
    { kind: 'static', anthem: { filter: { ctrl: 'you', type: 'Land' }, grant: { kw: ['trample', 'hexproof'] } } },
    act({ tap: true }, [{ e: 'addManaOfChoice', n: { maxPower: { type: 'Creature', ctrl: 'you' } } }], '依最大力量加入法術力'),
  ]),
  'Aang, Destined Savior': ab([
    { kind: 'static', anthem: { filter: { ctrl: 'you', type: 'Land' }, grant: { kw: ['vigilance'] } } },
    trig('combatStart', [earth(2)]),
  ]),
  "Aang and La, Ocean's Fury": ab([
    trig('attacks', [{ e: 'counters', what: { all: { type: 'Creature', ctrl: 'you', tapped: true } }, n: 1 }]),
  ]),
  'Aang, Master of Elements': ab([
    { kind: 'static', spellCostColorsLess: '{W}{U}{B}{R}{G}' },
    trig(
      'eachUpkeep',
      [{ e: 'transform', what: 'self' }, { e: 'gain', n: 4 }, { e: 'draw', n: 4 }, counters('self', 4), { e: 'damage', n: 4, to: 'opp' }],
      { may: '轉化並使用四元素？' },
    ),
  ]),
};
const backText: Record<string, string> = {
  'Avatar Yangchen': '飛行。每回合施放第二個咒語時，御氣至多一個其他非地永久物。',
  'Avatar Kuruk': '施放咒語時派出1/1精靈，只能與精靈交戰。竭力—御水20：獲得額外回合。',
  'Fire Lord Sozin': '威懾，御火3。造成戰鬥傷害時，可支付復活對手墳墓場生物的總法術力費用，將它們放進你的戰場。',
  'Avatar Roku': '御火4。{8}：派出4/4紅色飛行、御火4龍。',
  'Avatar Kyoshi': '你的地具有踐踏與辟邪。{T}：依你的最大生物力量加入等量任一色法術力。',
  'Aang, Destined Savior': '飛行。你的地生物具有警戒。你的戰鬥開始時大地彎折2。',
  "Aang and La, Ocean's Fury": '延勢，踐踏。攻擊時在你的每個已橫置生物上放一個指示物。',
  'Aang, Master of Elements': '飛行。你的咒語少付{W}{U}{B}{R}{G}。每個維持可轉化：獲得4生命、抓四張、放四個指示物，並對對手造成4點傷害。',
};
const transformChapter = { effects: [{ e: 'returnTransformed' } as Effect] };
function saga(name: string, text: string, chapters: NonNullable<CardDef['saga']>['chapters']) {
  d(name, text, { saga: { chapters: [...chapters, transformChapter] } });
}
saga(
  'The Legend of Yangchen',
  '第一章：各玩家選對手一個費用至少3的永久物放逐。第二章：可使對手和你各抓三張。第三章：放逐並以神通揚塵回場。',
  [
    { effects: [special('yangchen')] },
    {
      targets: [OPP],
      effects: [
        {
          e: 'may',
          prompt: '雙方各抓三張？',
          effects: [
            { e: 'draw', n: 3, who: 'T0' },
            { e: 'draw', n: 3 },
          ],
        },
      ],
    },
  ],
);
saga('The Legend of Kuruk', '第一、二章：占卜2並抓牌。第三章：放逐並以神通庫魯克回場。', [
  { effects: [{ e: 'scry', n: 2 }, draw] },
  { effects: [{ e: 'scry', n: 2 }, draw] },
]);
saga(
  'The Rise of Sozin',
  '第一章：消滅所有生物。第二章：選對手一張牌名，放逐其手牌、墳墓場和牌庫至多四張同名牌。第三章：以烈火王蘇進回場。',
  [{ effects: [{ e: 'destroy', what: creatures }] }, { effects: [special('sozinName')], targets: [OPP] }],
);
saga('The Legend of Roku', '第一章：放逐頂三張，到你的下回合結束前可使用。第二章：加任意色法術力。第三章：以神通羅古回場。', [
  { effects: [special('roku')] },
  { effects: [{ e: 'addManaOfChoice', n: 1 }] },
]);
saga('The Legend of Kyoshi', '第一章：依你的最大生物力量抓牌。第二章：大地彎折等同手牌數（沿用衍生物簡化）。第三章：以神通虛子回場。', [
  { effects: [{ e: 'draw', n: { maxPower: { type: 'Creature', ctrl: 'you' } } }] },
  { effects: [{ e: 'earthbend', n: { hand: true } }] },
]);
d(
  'Aang, at the Crossroads',
  '飛行。進場檢視頂五張，可放一個費用至多4生物進場。你的另一生物離場時，下個維持轉化。',
  ab([
    etb([{ e: 'dig', n: 5, filter: { type: 'Creature', mvMax: 4 }, rest: 'bottom', to: 'battlefield' }]),
    trig('allyLeaves', [special('crossroads')], {
      filter: { type: 'Creature' },
    }),
  ]),
);
d(
  'Aang, Swift Savior',
  '閃現，飛行。進場御氣至多一個其他生物或咒語。御水8：轉化。',
  ab([
    etb([air()], { targets: [{ kind: 'spellOrCreature', notSelf: true, optional: true }] }),
    wb(8, [{ e: 'transform', what: 'self' }], '御水8：轉化'),
  ]),
);
d(
  'Avatar Aang',
  '飛行，御火2。每次御水、御土、御火或御氣時抓牌；本回合使用過四種時轉化。',
  ab([trig('bend', [draw, special('fourElements')])]),
);

// 已有卡牌不重複新增；所有缺卡必須有可執行的手寫定義，禁止白板補數。
export function completeTla() {
  for (const row of catalog) {
    if (seen.has(slug(row.name))) {
      const old = registered.find((c) => c.id === slug(row.name));
      if (old?.set === 'TLA' && row.subtypes.includes('Lesson')) old.subtypes = [...new Set([...(old.subtypes ?? []), 'Lesson'])];
      continue;
    }
    const patch = defs.get(row.name);
    if (!patch) throw new Error(`TLA 缺少機制定義：${row.number} ${row.name}`);
    const def = { ...row, ...patch } as unknown as Omit<CardDef, 'id'>;
    if (row.back)
      def.back = {
        ...row.back,
        id: slug(row.back.name),
        ...backPatches[row.back.name],
        text: backText[row.back.name] ?? row.back.text,
      } as unknown as CardDef;
    const source = catalog.find((c) => c.name === row.name)!;
    const fileCrew = /Crew (\d+)/.exec(source.text);
    if (fileCrew)
      def.abilities = [
        ...(def.abilities ?? []),
        act(
          { crew: Number(fileCrew[1]) },
          [{ e: 'animate', what: 'self', p: def.power ?? 0, t: def.toughness ?? 0 }],
          `駕駛${fileCrew[1]}`,
        ),
      ];
    add(def);
  }
}
