import { canPayCost, payCost } from './actions';
import { copiableDefinition, isCreature, isLand, matches, newCard, other, shuffleArr, stats } from './state';
import { manaValue, parseCost } from './mana';
import { resolveRef, runEffects, type Ctx } from './effects';
import { counterKinds, removeCounterKind, canReceiveCounters } from './ecl-support';
import { makeEclTokenBatch } from './ecl';
import { mshStatic, mshFlags, planLimit } from './msh-support';
import { choose, freeCast } from './tla';
import { validateTargets } from './targets';
import {
  dealDamage,
  discard,
  discardMany,
  drawCards,
  emit,
  enterBattlefield,
  enterBattlefieldBack,
  addLore,
  gainLife,
  moveCard,
  putCounters,
  sacrifice,
  tapCard,
  destroyCards,
} from './zones';
import type { Card, CardDef, Effect, Filter, GameState, PID, Ref, Response, SubFlow, Keyword } from './types';
const E = (action: string, what?: Ref, n?: number): Effect => ({ e: 'msh', action, what, n });
const own = (g: GameState, pid: PID, filter: Filter = {}) =>
  g.battlefield.filter((id) => g.cards[id].controller === pid && matches(g, filter, g.cards[id], pid));
function* yes(pid: PID, prompt: string): SubFlow<boolean> {
  const r: Response = yield { type: 'yesno', player: pid, prompt };
  return r.type === 'yesno' && r.yes;
}
function* mode(pid: PID, prompt: string, options: string[]): SubFlow<number> {
  const r: Response = yield { type: 'mode', player: pid, prompt, options, count: 1, purpose: 'trigger' };
  return r.type === 'modes' ? (r.picks[0] ?? 0) : 0;
}
function change(c: Card, patch: Partial<CardDef>, temp = false) {
  if (temp) c.baseDef ??= c.def;
  else c.tlaOriginalDef ??= c.def;
  c.def = { ...c.def, ...patch };
}
function delay(g: GameState, c: Card, pid: PID, effects: Effect[]) {
  (g.delayed ??= []).push({ source: c.id, controller: pid, on: 'eachEndStep', once: true, persistent: true, effects });
}
export function mshCounter(g: GameState, c: Card, kind: string, n = 1) {
  if (n <= 0 || !canReceiveCounters(g, c)) return 0;
  const amount = n + mshStatic(g, c.controller, 'extraCounters').length;
  (c.eclCounters ??= {})[kind] = (c.eclCounters?.[kind] ?? 0) + amount;
  emit(g, { type: 'counterPlaced', card: c.id, controller: c.controller, counterKind: kind, amount });
  return amount;
}
function permission(g: GameState, c: Card, pid: PID, next = false, any = false) {
  c.playableBy = pid;
  c.playableUntil = g.turn + (next ? (g.active === pid ? 2 : 1) : 0);
  if (any) c.finMarks = { ...c.finMarks, anyMana: 1 };
}
export function* mshEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, { e: 'msh' }>): SubFlow {
  const pid = ctx.controller,
    opp = other(pid),
    p = g.players[pid],
    src = g.cards[ctx.source],
    ev = ctx.ev,
    ec = ev && 'card' in ev ? g.cards[ev.card] : undefined;
  const cards = resolveRef(g, ctx, ef.what ?? 'T0').cards,
    c = cards[0];
  const run = (effects: Effect[]) => runEffects(g, ctx, effects);
  const token = (name: string, n = 1) => makeEclTokenBatch(g, pid, 'tok-msh-' + name, n);
  const pick = (options: number[], prompt: string, min = 0, max = 1, player = pid) => choose(g, player, prompt, options, min, max);
  const impulse = function* (n: number, next = false): SubFlow<number[]> {
    const ids = p.library.slice(0, n);
    for (const id of ids) {
      moveCard(g, g.cards[id], 'exile');
      permission(g, g.cards[id], pid, next);
    }
    return ids;
  };
  const nextMana = function* (n: number, rule?: string): SubFlow {
    const colors = ['W', 'U', 'B', 'R', 'G'] as const,
      i = yield* mode(pid, '選擇法力顏色', [...colors]);
    const mana = colors[i] ?? 'W';
    if (rule) for (let j = 0; j < n; j++) (p.mshRestricted ??= []).push({ mana, rule });
    else for (let j = 0; j < n; j++) (p.pool ??= []).push(mana);
  };
  switch (ef.action) {
    case 'sheHulkDamage':
      if (src.mshMarks?.sheHulkUsedTurn !== g.turn && (yield* yes(pid, '讓She-Hulk造成等量傷害？'))) {
        (src.mshMarks ??= {}).sheHulkUsedTurn = g.turn;
        yield* run([{ e: 'damage', n: { ev: true }, to: 'T0' }]);
      }
      break;
    case 'photonCopies':
      for (let i = 0; i < (ef.n ?? 0); i++) yield* run([{ e: 'copySpell' }]);
      break;
    case 'harness':
      src.mshHarnessed = true;
      break;
    case 'keyword':
      mshCounter(g, c ?? src, ef.n === 2 ? 'double_strike' : 'indestructible');
      break;
    case 'extraCombat':
      g.extraCombat = { player: pid, landOnly: false, count: (g.extraCombat?.count ?? 0) + 1 };
      break;
    case 'plan': {
      const before = src.eclCounters?.plan ?? 0;
      mshCounter(g, src, 'plan');
      const limit = planLimit(src);
      if (limit && before < limit && (src.eclCounters?.plan ?? 0) >= limit)
        emit(g, { type: 'msh', action: 'planReady', player: pid, card: src.id });
      break;
    }
    case 'finishPlan': {
      if (src.zone !== 'battlefield') break;
      const name = src.def.id;
      sacrifice(g, src);
      if (name === 'political-triumph')
        yield* run([
          { e: 'draw', n: 1 },
          { e: 'counters', what: { all: { ctrl: 'you', type: 'Creature' } }, n: 1 },
        ]);
      else if (name === 'rewrite-history')
        yield* run([
          {
            e: 'reflexive',
            targets: [
              { kind: 'gyCard', filter: { ctrl: 'you', type: ['Instant', 'Sorcery'] }, optional: true },
              { kind: 'gyCard', filter: { ctrl: 'you', type: ['Instant', 'Sorcery'] }, optional: true },
            ],
            effects: [
              { e: 'toHand', what: 'T0' },
              { e: 'toHand', what: 'T1' },
            ],
          },
        ]);
      else if (name === 'construct-a-cosmic-cube')
        yield* run([{ e: 'reflexive', targets: [{ kind: 'opponent' }], effects: [E('controlNextTurn')] }]);
      else if (name === 'doom-reigns-supreme') {
        const ids = g.players[opp].library.slice(0, 5);
        for (const id of ids) moveCard(g, g.cards[id], 'exile');
        const choices = yield* pick(
          ids.filter((id) => !isLand(g.cards[id])),
          '免費施放至多兩個咒語',
          0,
          2,
        );
        for (const id of choices) yield* freeCast(g, ctx, g.cards[id]);
      } else if (name === 'robot-domination') yield* token('robot', 3);
      else if (name === 'death-to-our-enemies')
        yield* run([{ e: 'reflexive', targets: [{ kind: 'any' }, { kind: 'any', optional: true }], effects: [E('splitSeven')] }]);
      else if (name === 'claim-the-kingdom')
        yield* run([{ e: 'reflexive', targets: [{ kind: 'creature', filter: { ctrl: 'you' } }], effects: [E('keyword', 'T0')] }]);
      break;
    }
    case 'controlNextTurn': {
      const t = ctx.targets[0],
        player = t && 'p' in t ? t.p : opp;
      g.playerControl = { controller: pid, player, whole: true, starts: g.turn + 1, ends: g.turn + 2 };
      break;
    }
    case 'splitSeven': {
      const first = ctx.targets[0],
        second = ctx.targets[1];
      if (!first) break;
      let n = 7;
      if (second) n = 1 + (yield* mode(pid, '第一目標的傷害（其餘給第二目標）', ['1', '2', '3', '4', '5', '6']));
      dealDamage(g, src, pid, first, n);
      if (second) dealDamage(g, src, pid, second, 7 - n);
      break;
    }
    case '25': {
      const top = p.library.slice(0, 7),
        ids = top.filter((id) =>
          matches(g, { or: [{ type: 'Creature', sub: 'Hero' }, { sub: ['Equipment', 'Vehicle'] }] }, g.cards[id], pid),
        ),
        id = (yield* pick(ids, '可放入Hero、Equipment或Vehicle', 0))[0];
      if (id !== undefined) {
        const x = g.cards[id];
        if (x.def.back && (yield* yes(pid, '以轉化的一面進場？'))) enterBattlefieldBack(g, x, pid);
        else enterBattlefield(g, x, pid);
      }
      const rest = top.filter((x) => x !== id);
      shuffleArr(g, rest);
      for (const x of rest) moveCard(g, g.cards[x], 'library', true);
      break;
    }
    case '28': {
      const id = (yield* pick(
        p.hand.filter((id) => matches(g, { type: 'Creature', sub: 'Hero', mvMax: 3 }, g.cards[id], pid)),
        '可放入小英雄',
        0,
      ))[0];
      if (id !== undefined) enterBattlefield(g, g.cards[id], pid);
      else drawCards(g, pid, 1);
      break;
    }
    case 'serumEquip': {
      const host = g.cards[src.attachedTo ?? -1];
      if (host) for (const t of ctx.targets) if (t && 'c' in t) g.cards[t.c].attachedTo = host.id;
      break;
    }
    case '58':
      if (c) {
        change(c, { types: [...new Set([...c.def.types, 'Artifact', 'Creature'] as CardDef['types'])] }, true);
        yield* run([
          { e: 'setBase', what: 'T0', p: 4, t: 4 },
          { e: 'pump', what: 'T0', p: 0, t: 0, kw: ['flying'] },
        ]);
      }
      break;
    case '59': {
      const top = g.cards[p.library[0]];
      if (top?.def.types.includes('Artifact')) drawCards(g, pid, 1);
      break;
    }
    case '62':
      (g.extraTurns ??= []).unshift(pid);
      p.mshNoPowerTurn = g.turn + 1;
      break;
    case '67':
      (src.mshMarks ??= {}).sizeHand = g.turn;
      break;
    case '72': {
      const host = g.cards[src.attachedTo ?? -1];
      if (c && host && c.id !== host.id) {
        const def = copiableDefinition(c);
        moveCard(g, c, 'exile');
        c.exiledBy = src.id;
        host.mshMarks = { ...host.mshMarks, invasion: src.id };
        change(host, def);
        host.copyLayer = def;
      }
      break;
    }
    case '75': {
      const second = ctx.targets[1];
      if (c && second && 'c' in second) {
        const def = {
          ...copiableDefinition(g.cards[second.c]),
          supertypes: g.cards[second.c].def.supertypes?.filter((s) => s !== 'Legendary'),
        };
        change(c, def, true);
        c.copyLayer = def;
      }
      break;
    }
    case 'discardArtifactOrTwo': {
      const ids = yield* pick(p.hand, '棄一張神器，否則棄兩張', Math.min(1, p.hand.length), Math.min(2, p.hand.length));
      const chosen =
        ids.length === 1 && g.cards[ids[0]].def.types.includes('Artifact') ? ids : [...new Set([...ids, ...p.hand])].slice(0, 2);
      discardMany(
        g,
        chosen.map((id) => g.cards[id]),
      );
      break;
    }
    case 'ironManHand': {
      const id = (yield* pick(
        p.hand.filter((id) => g.cards[id].def.types.includes('Artifact')),
        '可放入神器',
        0,
      ))[0];
      if (id !== undefined) {
        const x = g.cards[id];
        enterBattlefield(g, x, pid);
        if (x.def.subtypes?.includes('Equipment')) x.attachedTo = src.id;
      }
      break;
    }
    case '81':
      if (c) {
        const second = yield* yes(c.owner, '放在牌庫第二張？（否則牌庫底）');
        moveCard(g, c, 'library', !second);
        if (second) {
          const lib = g.players[c.owner].library;
          lib.splice(lib.indexOf(c.id), 1);
          lib.splice(Math.min(1, lib.length), 0, c.id);
        }
      }
      break;
    case 'delayedFlicker':
      if (c) {
        const owner = c.owner;
        moveCard(g, c, 'exile');
        delay(g, c, owner, [{ e: 'msh', action: 'returnExiled' }]);
      }
      break;
    case 'returnExiled':
      if (src.zone === 'exile') enterBattlefield(g, src, src.owner);
      break;
    case 'immediateFlickerTapped':
      if (c) {
        moveCard(g, c, 'exile');
        enterBattlefield(g, c, c.owner, true);
      }
      break;
    case '84':
      if (c) {
        tapCard(g, c);
        (c.mshMarks ??= {}).waspSource = src.tmtLinkKey ?? src.id;
      }
      break;
    case '87': {
      const ids = (ef.ids ?? []).filter((id) => g.cards[id]?.zone === 'exile');
      const chosen = yield* pick(ids, '免費施放至多三張複製', 0, 3);
      for (const id of chosen) {
        const cp = newCard(g, g.cards[id].def, pid, true);
        cp.zone = 'exile';
        yield* freeCast(g, ctx, cp);
      }
      break;
    }
    case '89': {
      const ids: number[] = [];
      for (const id of g.players[opp].library.slice()) {
        ids.push(id);
        moveCard(g, g.cards[id], 'exile');
        if (!isLand(g.cards[id])) break;
      }
      const card = g.cards[ids[ids.length - 1]];
      if (yield* yes(pid, '放置一個+1/+1指示物？')) putCounters(g, src, 1);
      else if (card && !isLand(card) && (yield* yes(pid, '取得本回合施放權限？'))) permission(g, card, pid, false, true);
      break;
    }
    case '98':
      if (c) {
        enterBattlefield(g, c, pid, true);
        c.attacking = true;
        c.attackTarget = null;
        c.finality = true;
      }
      break;
    case '103': {
      const t = ctx.targets[0],
        player = t && 'p' in t ? t.p : opp,
        pl = g.players[player],
        n = 1 + p.graveyard.filter((id) => isCreature(g.cards[id])).length;
      const ids = yield* pick(pl.hand, '選擇要展示的手牌', Math.min(n, pl.hand.length), Math.min(n, pl.hand.length), player);
      const id = (yield* pick(ids, '選擇其中一張棄掉', Math.min(1, ids.length)))[0];
      if (id !== undefined) discard(g, g.cards[id]);
      break;
    }
    case '107':
      if (ec && ec.zone === 'graveyard' && (yield* yes(pid, '放逐棄掉的牌以於下一回合結束前使用？'))) {
        moveCard(g, ec, 'exile');
        permission(g, ec, pid, true);
      }
      break;
    case '112':
      yield* nextMana(2, 'equipment');
      break;
    case '116': {
      const t = ctx.targets[1];
      if (c && t && 'c' in t) c.attachedTo = t.c;
      break;
    }
    case '117':
      if (ec && ec.zone === 'graveyard' && !ec.token) {
        enterBattlefield(g, ec, ec.owner);
        ec.finality = true;
        change(ec, { subtypes: [...new Set([...(ec.def.subtypes ?? []), 'Hero'])] });
      }
      break;
    case '128':
      if (c) {
        const extended = own(g, pid, { sub: 'Villain' }).some((id) => manaValue(g.cards[id].def) > manaValue(c.def));
        c.returnControl = { player: c.controller, turn: g.turn + (extended ? (g.active === pid ? 2 : 1) : 0) };
        c.controller = pid;
        c.tapped = false;
        g.eot.push({ card: c.id, p: 0, t: 0, kw: ['haste'], ...(extended ? { until: pid } : {}) });
      }
      break;
    case 'destroyLandSearch': {
      const player = c?.controller;
      if (c) {
        destroyCards(g, [c]);
        if (player !== undefined)
          yield* runEffects(g, { ...ctx, controller: player }, [{ e: 'searchLand', to: 'battlefield', tapped: true }]);
      }
      break;
    }
    case 'impulseNext':
      yield* impulse(1, true);
      break;
    case '130': {
      let n = 0;
      while (n < 3 && canPayCost(g, pid, parseCost('{1}')) && (yield* yes(pid, '支付{1}增加一個箭矢選項？'))) {
        payCost(g, pid, parseCost('{1}'));
        n++;
      }
      if (n) {
        yield* run([{ e: 'reflexive', targets: [], effects: [E('arrows', undefined, n)] }]);
      }
      break;
    }
    case 'arrows': {
      const options = ['不能阻擋', '對玩家2傷害', '棄一抓一'];
      const r: Response = yield { type: 'mode', player: pid, prompt: '選擇不重複的箭矢', options, count: ef.n ?? 0, purpose: 'trigger' };
      const picks = r.type === 'modes' ? [...new Set(r.picks)].slice(0, ef.n) : [];
      for (const i of picks) {
        if (i === 0)
          yield* run([
            { e: 'reflexive', targets: [{ kind: 'creature' }], effects: [{ e: 'grant', what: 'T0', grant: { cantBlock: true } }] },
          ]);
        else if (i === 1) yield* run([{ e: 'reflexive', targets: [{ kind: 'player' }], effects: [{ e: 'damage', n: 2, to: 'T0' }] }]);
        else
          yield* run([
            { e: 'discard', who: 'you', n: 1 },
            { e: 'draw', n: 1 },
          ]);
      }
      break;
    }
    case '133': {
      const ids = p.hand.slice();
      for (const id of ids) {
        moveCard(g, g.cards[id], 'exile');
        permission(g, g.cards[id], pid, true);
      }
      drawCards(g, pid, ids.length);
      break;
    }
    case 'sacArtifactOrDiscard':
    case 'bullseyeCost': {
      const nonland = ef.action === 'bullseyeCost';
      const artifacts = own(g, pid, { type: 'Artifact' }),
        hand = p.hand.filter((id) => !nonland || !isLand(g.cards[id]));
      const i = yield* mode(pid, '可支付一種費用', ['不支付', ...(artifacts.length ? ['犧牲神器'] : []), ...(hand.length ? ['棄牌'] : [])]);
      if (i === 0) break;
      if (artifacts.length && i === 1) {
        const id = (yield* pick(artifacts, '犧牲神器', 1))[0];
        sacrifice(g, g.cards[id]);
      } else {
        const id = (yield* pick(hand, '棄牌', 1))[0];
        discard(g, g.cards[id]);
      }
      if (nonland) yield* run([{ e: 'reflexive', targets: [{ kind: 'any' }], effects: [{ e: 'damage', n: 2, to: 'T0' }] }]);
      else drawCards(g, pid, ef.n ?? 1);
      break;
    }
    case '138':
      src.temporaryAbilities = {
        turn: g.turn,
        abilities: [
          ...(src.temporaryAbilities?.turn === g.turn ? src.temporaryAbilities.abilities : []),
          {
            kind: 'activated',
            cost: { tap: true },
            label: '造成等同力量的傷害',
            effects: [{ e: 'damage', n: { power: 'self' }, to: 'T0' }],
            targets: [{ kind: 'any', notSelf: true }],
          },
        ],
      };
      break;
    case '139':
      yield* impulse(Math.max(0, stats(g, src).p));
      break;
    case '143':
      (g.delayed ??= []).push({
        source: src.id,
        controller: pid,
        on: 'mshEvent',
        mshEvent: 'nextSmallSpell',
        effects: [{ e: 'copySpell' }],
        once: true,
      });
      (src.mshMarks ??= {}).lokiPower = Math.max(0, stats(g, src).p);
      break;
    case '152':
      if (c) (c.mshMarks ??= {}).hasteBlock = g.turn;
      break;
    case '156':
      if (c) {
        moveCard(g, c, 'exile');
        permission(g, c, pid, true);
      }
      break;
    case '161':
      if ((yield* mode(pid, '選擇Food或Treasure', ['Food', 'Treasure'])) === 0) yield* makeEclTokenBatch(g, pid, 'tok-food', 1);
      else yield* makeEclTokenBatch(g, pid, 'tok-treasure', 1);
      break;
    case '165': {
      const top = p.library.slice(0, 8),
        options = top.filter((id) => isCreature(g.cards[id]));
      const chosen = yield* pick(options, '選擇放入戰場的生物', 0, src.mshTeamwork ? options.length : 1);
      for (const id of chosen) enterBattlefield(g, g.cards[id], pid);
      for (const id of top.filter((id) => !chosen.includes(id))) moveCard(g, g.cards[id], 'graveyard');
      break;
    }
    case 'doubleStats':
      if (c) {
        const st = stats(g, c);
        g.eot.push({ card: c.id, p: st.p, t: st.t, kw: [] });
      }
      break;
    case '170':
      if (src.zone === 'graveyard' && !src.token) {
        enterBattlefield(g, src, src.owner);
        putCounters(g, src, 1);
        src.permanentGrants = [{ loseAbilities: true, kw: ['haste'] }];
      }
      break;
    case 'lifeCounters':
      for (const t of ctx.targets) if (t && 'c' in t) putCounters(g, g.cards[t.c], 1);
      break;
    case '173':
      if (ec && (stats(g, ec).p > stats(g, src).p || stats(g, ec).t > stats(g, src).t)) putCounters(g, src, 1);
      break;
    case '176': {
      const i = yield* mode(pid, '選擇效果', ['放一個+1/+1指示物', '移除一個生物上的指示物並抓牌']);
      if (i === 0) putCounters(g, src, 1);
      else {
        const ids = own(g, pid, { type: 'Creature' }).filter((id) => Object.values(counterKinds(g.cards[id])).some((n) => n > 0));
        const id = (yield* pick(ids, '選擇生物', Math.min(1, ids.length)))[0];
        if (id !== undefined) {
          const kinds = Object.entries(counterKinds(g.cards[id]))
            .filter(([, n]) => n > 0)
            .map(([k]) => k);
          const k = yield* mode(pid, '移除哪一種指示物？', kinds);
          removeCounterKind(g.cards[id], kinds[k] ?? kinds[0]);
          drawCards(g, pid, 1);
        }
      }
      break;
    }
    case '179': {
      const t = ctx.targets[0];
      if (t && 'p' in t) {
        const pl = g.players[t.p];
        if (pl.poison) pl.poison++;
      } else if (c) {
        const kinds = Object.entries(counterKinds(c)).filter(([, n]) => n > 0);
        for (const [kind] of kinds) {
          if (kind === '+1/+1') putCounters(g, c, 1);
          else if (kind === '-1/-1') yield* run([{ e: 'ecl', action: 'blight', what: 'T0', n: 1 }]);
          else if (kind === 'stun') c.stun += 1 + mshStatic(g, c.controller, 'extraCounters').length;
          else if (kind === 'lore') addLore(g, c, 1);
          else if (kind === 'loyalty') c.loyalty = (c.loyalty ?? 0) + 1;
          else if (kind === 'charge') c.charge = (c.charge ?? 0) + 1;
          else if (kind === 'finality') c.finality = true;
          else mshCounter(g, c, kind);
        }
      }
      break;
    }
    case '180': {
      const other = ctx.targets[1];
      if (c && other && 'c' in other) dealDamage(g, c, pid, other, 2 * stats(g, c).p);
      break;
    }
    case '181':
    case '184': {
      const ids = p.library.slice(0, ef.action === '181' ? 2 : 4);
      for (const id of ids) moveCard(g, g.cards[id], 'graveyard');
      const options = ids.filter((id) =>
        ef.action === '181'
          ? g.cards[id].def.types.some((t) => !['Instant', 'Sorcery'].includes(t))
          : matches(g, { or: [{ sub: 'Hero' }, { type: 'Enchantment' }] }, g.cards[id], pid),
      );
      const id = (yield* pick(options, '可取回一張牌', 0))[0];
      if (id !== undefined) moveCard(g, g.cards[id], 'hand');
      if (ef.action === '181') gainLife(g, pid, 2);
      break;
    }
    case 'dinosaur3':
    case 'dinosaur6': {
      const large = ef.action === 'dinosaur6';
      change(src, { subtypes: ['Dinosaur', 'Hero'] }, true);
      yield* run([
        { e: 'setBase', what: 'self', p: large ? 6 : 3, t: large ? 6 : 5 },
        { e: 'pump', what: 'self', p: 0, t: 0, kw: large ? ['trample'] : ['vigilance', 'reach'] },
      ]);
      break;
    }
    case '187':
      yield* nextMana(2, 'creatureAbility');
      break;
    case '195':
      if (c) putCounters(g, c, c.id !== src.id && matches(g, { sub: 'Hero' }, c, pid) ? 2 : 1);
      break;
    case 'freeNextRG':
      mshFlags(g, pid).freeRG = 1;
      break;
    case '199':
    case '232':
      if (c) {
        const base = copiableDefinition(c);
        const def: CardDef = {
          ...base,
          name: src.def.name,
          supertypes: ['Legendary'],
          types: [...new Set([...base.types, 'Creature'] as CardDef['types'])],
          subtypes: ef.action === '199' ? ['Human', 'Villain'] : ['Human', 'Mercenary', 'Villain'],
          ...(ef.action === '199' ? { power: 4, toughness: 4, keywords: [...(base.keywords ?? []), 'vigilance' as const] } : {}),
        };
        change(src, def, true);
        src.copyLayer = def;
        src.mshCopyUntil = g.turn + 1;
      }
      break;
    case '200': {
      const n = src.eclCounters?.invasion ?? 0;
      const [t] = yield* token('alien');
      if (t) putCounters(g, t, n);
      mshCounter(g, src, 'invasion');
      break;
    }
    case 'armorDraw':
      if (yield* yes(pid, '依神器數抓牌並讓對手抓一張？')) {
        drawCards(g, pid, own(g, pid, { type: 'Artifact' }).length);
        drawCards(g, opp, 1);
      }
      break;
    case 'artifactDiscountTurn':
      mshFlags(g, pid).artifactDiscount = (mshFlags(g, pid).artifactDiscount ?? 0) + 1;
      break;
    case '204': {
      const n = src.counters;
      const k = yield* mode(
        pid,
        '移除多少+1/+1指示物？',
        Array.from({ length: n + 1 }, (_, i) => String(i)),
      );
      removeCounterKind(src, '+1/+1', k);
      yield* token('insect', k);
      break;
    }
    case '211': {
      const t = ctx.targets[0],
        player = t && 'p' in t ? t.p : opp,
        creature = ctx.targets[1];
      const options = g.players[player].hand.filter((id) => !isLand(g.cards[id]));
      if (creature && 'c' in creature) options.push(creature.c);
      const id = (yield* pick(options, '可放逐一張非地手牌或所選生物', 0))[0];
      if (id !== undefined) {
        const x = g.cards[id];
        moveCard(g, x, 'exile');
        (src.mshLinked ??= []).push(id);
      }
      break;
    }
    case '213':
      if (yield* yes(pid, '放逐牌庫頂供本回合使用？')) {
        const ids = yield* impulse(1);
        if (ids[0] !== undefined && matches(g, { sub: 'Hero' }, g.cards[ids[0]], pid)) g.eot.push({ card: src.id, p: 2, t: 1, kw: [] });
      }
      break;
    case '227': {
      const sid = ev?.type === 'targeted' ? ev.stackSid : undefined,
        item = g.stack.find((s) => s.sid === sid && s.kind === 'spell');
      if (item && (yield* yes(pid, '更改咒語的目標？'))) {
        const r: Response = yield {
          type: 'targets',
          player: pid,
          source: item.cardId,
          specs: item.targetSpecs,
          text: item.text,
          effects: item.effects,
        };
        if (r.type === 'targets' && !validateTargets(g, item.targetSpecs, r.targets, item.controller, item.cardId)) {
          item.targets = r.targets;
          item.targetVersions = r.targets.map((t) => (t && 'c' in t ? (g.cards[t.c].objectVersion ?? 0) : undefined));
        }
      }
      break;
    }
    case '228':
      if (!src.tapped && (yield* yes(pid, '橫置Spider-Man以保護另一生物？'))) {
        tapCard(g, src);
        yield* run([
          {
            e: 'reflexive',
            targets: [{ kind: 'creature', filter: { ctrl: 'you', attacking: false, other: true } }],
            effects: [{ e: 'pump', what: 'T0', p: 0, t: 0, kw: ['indestructible'] }],
          },
        ]);
      }
      break;
    case '229':
      if (c) {
        tapCard(g, c);
        Object.assign((c.mshMarks ??= {}), { freezeBy: src.id, freezeVersion: src.objectVersion ?? 0, freezeController: pid });
      }
      break;
    case '230': {
      const item = ev?.type === 'cast' ? g.stack.find((s) => s.kind === 'spell' && s.cardId === ev.card) : undefined;
      for (const t of item?.targets ?? [])
        if (t && 'c' in t && isCreature(g.cards[t.c])) g.eot.push({ card: t.c, p: 0, t: 0, kw: ['flying'] });
      break;
    }
    case '231':
      for (const t of ctx.targets)
        if (t && 'c' in t) {
          const x = g.cards[t.c];
          (x.mshMarks ??= {}).controlSource = src.id;
          x.mshMarks.controlPlayer = x.controller;
          x.controller = pid;
          x.sick = true;
        }
      break;
    case '233': {
      const odd = (yield* mode(pid, '選奇數或偶數', ['奇數', '偶數'])) === 0;
      destroyCards(
        g,
        g.battlefield.map((id) => g.cards[id]).filter((x) => x.id !== src.id && isCreature(x) && !!(manaValue(x.def) % 2) === odd),
      );
      break;
    }
    case '237': {
      const x = ctx.x ?? 0,
        ids = [...p.library, ...p.graveyard].filter(
          (id) => matches(g, { type: 'Creature', mvMax: x }, g.cards[id], pid) && g.cards[id].def.types.includes('Artifact'),
        ),
        id = (yield* pick(ids, '搜尋神器生物', 0))[0];
      if (id !== undefined) {
        const cr = g.cards[id];
        enterBattlefield(g, cr, pid);
        putCounters(g, cr, x);
        if (x >= 4) g.eot.push({ card: id, p: 0, t: 0, kw: ['haste'] });
      }
      shuffleArr(g, p.library);
      break;
    }
    case '239':
      if (src.zone === 'graveyard') {
        enterBattlefield(g, src, pid);
        src.finality = true;
        const id = (yield* pick(own(g, pid, { sub: 'Equipment' }), '可結附武具', 0))[0];
        if (id !== undefined) g.cards[id].attachedTo = src.id;
      }
      break;
    case '241': {
      const ids = g.battlefield.filter((id) => isCreature(g.cards[id]));
      for (const id of ids) moveCard(g, g.cards[id], 'exile');
      for (const pl of g.players) {
        const choices = yield* pick(
          pl.hand.filter((id) => isCreature(g.cards[id])),
          '可放入任意數量生物',
          0,
          pl.hand.length,
          pl.id,
        );
        for (const id of choices) enterBattlefield(g, g.cards[id], pl.id);
      }
      for (const id of ids) if (g.cards[id].zone === 'exile') moveCard(g, g.cards[id], 'hand');
      moveCard(g, src, 'exile');
      break;
    }
    case '245': {
      const top = p.library.slice(0, 6),
        max = Math.max(0, ...own(g, pid, { attacking: true, type: 'Creature' }).map((id) => stats(g, g.cards[id]).p));
      const id = (yield* pick(
        top.filter((id) => !isLand(g.cards[id]) && manaValue(g.cards[id].def) <= max),
        '可免費施放咒語',
        0,
      ))[0];
      if (id !== undefined) yield* freeCast(g, ctx, g.cards[id]);
      const rest = top.filter((x) => x !== id || g.cards[x].zone === 'library');
      shuffleArr(g, rest);
      for (const x of rest) moveCard(g, g.cards[x], 'library', true);
      break;
    }
    case '248':
      if (!isCreature(src))
        change(
          src,
          { types: ['Artifact', 'Creature'], subtypes: ['Construct', 'Hero'], power: 0, toughness: 0, keywords: ['flying'] },
          true,
        );
      break;
    case '250':
      if (c) {
        const kws = stats(g, c).kw,
          ownKws = stats(g, src).kw;
        for (const kw of [
          'haste',
          'flying',
          'first_strike',
          'double_strike',
          'deathtouch',
          'indestructible',
          'lifelink',
          'menace',
          'reach',
          'trample',
          'vigilance',
        ] as Keyword[])
          if (kws.has(kw) && !ownKws.has(kw)) mshCounter(g, src, kw);
      }
      break;
    case '252':
      if (ec && ec.zone === 'battlefield' && canPayCost(g, pid, parseCost('{2}')) && (yield* yes(pid, '支付{2}複製神器？'))) {
        payCost(g, pid, parseCost('{2}'));
        const def = { ...copiableDefinition(ec) },
          [t] = yield* makeEclTokenBatch(g, pid, def, 1);
        if (t && !isCreature(t)) {
          change(t, {
            types: [...new Set([...t.def.types, 'Creature'] as CardDef['types'])],
            subtypes: [...(t.def.subtypes ?? []), 'Robot', 'Villain'],
            power: 2,
            toughness: 2,
          });
        }
      }
      break;
    case 'baxterMana':
      for (let i = 0; i < 4; i++) yield* nextMana(1);
      break;
    case 'copyAbility': {
      const item = g.stack.find((it) => it.sid === ef.n);
      if (!item) break;
      let targets = item.targets.slice();
      if (item.targetSpecs.length && (yield* yes(pid, '為異能複製選擇新目標？'))) {
        const r: Response = yield {
          type: 'targets',
          player: pid,
          source: item.cardId,
          specs: item.targetSpecs,
          text: item.text,
          effects: item.effects,
        };
        if (r.type === 'targets' && !validateTargets(g, item.targetSpecs, r.targets, pid, item.cardId)) targets = r.targets;
      }
      g.stack.push({
        ...item,
        sid: g.nextSid++,
        controller: pid,
        targets,
        targetVersions: targets.map((t) => (t && 'c' in t ? (g.cards[t.c].objectVersion ?? 0) : undefined)),
      });
      break;
    }
    case 'ward': {
      const item = g.stack.find((it) => it.sid === ef.n);
      if (!item) break;
      let paid = false;
      if (src.def.id === 'the-serpent-society') {
        if (yield* yes(item.controller, '獲得五個毒指示物支付守護？')) {
          g.players[item.controller].poison = (g.players[item.controller].poison ?? 0) + 5;
          paid = true;
        }
      } else {
        const pl = g.players[item.controller];
        const which = yield* mode(item.controller, '支付守護', ['不支付', '棄一張牌', '支付{2}']);
        if (which === 1 && pl.hand.length) {
          const id = (yield* pick(pl.hand, '棄一張牌', 1, 1, item.controller))[0];
          discard(g, g.cards[id]);
          paid = true;
        } else if (which === 2) paid = payCost(g, item.controller, parseCost('{2}'));
      }
      if (!paid && !(item.kind === 'spell' && g.cards[item.cardId].def.uncounterable)) {
        g.stack = g.stack.filter((it) => it.sid !== item.sid);
        if (item.kind === 'spell') moveCard(g, g.cards[item.cardId], 'graveyard');
      }
      break;
    }
    default:
      throw new Error('Unknown MSH effect ' + ef.action);
  }
}
