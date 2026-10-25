import {innkeeperMultiplier} from './meadow-support';
import { canPayCost, castDuringResolution, payCost } from './actions';
import { copiableDefinition, isCreature, isLand, matches, newCard, other, shuffleArr, stats } from './state';
import { manaValue, parseCost } from './mana';
import { resolveRef, runEffects, type Ctx } from './effects';
import { makeEclTokenBatch } from './ecl';
import { canEvidence, evidenceChoices, mkmFlags, mkmCondition } from './mkm-support';
import { putFaceDown, turnFaceUp } from './facedown';
import {
  dealDamage,
  discard,
  discardMany,
  drawCards,
  emit,
  enterBattlefield,
  gainLife,
  loseLife,
  moveCard,
  putCounters,
  sacrifice,
  tapCard,
  destroyCards,
} from './zones';
import { choose, freeCast } from './tla';
import type { Card, CardDef, Effect, Filter, GameState, PID, Response, SubFlow } from './types';
const own = (g: GameState, pid: PID, f: Filter = {}) =>
  g.battlefield.filter((id) => g.cards[id].controller === pid && matches(g, f, g.cards[id], pid));
function* yes(pid: PID, prompt: string): SubFlow<boolean> {
  const r: Response = yield { type: 'yesno', player: pid, prompt };
  return r.type === 'yesno' && r.yes;
}
function* mode(pid: PID, prompt: string, options: string[]): SubFlow<number> {
  const r: Response = yield { type: 'mode', player: pid, prompt, options, count: 1, purpose: 'trigger' };
  return r.type === 'modes' ? (r.picks[0] ?? 0) : 0;
}
function change(c: Card, p: Partial<CardDef>, temp = false) {
  if (temp) c.baseDef ??= c.def;
  else c.tlaOriginalDef ??= c.def;
  c.def = { ...c.def, ...p };
}
function delay(g: GameState, c: Card, pid: PID, effects: Effect[]) {
  (g.delayed ??= []).push({ source: c.id, controller: pid, on: 'eachEndStep', effects, once: true, persistent: true });
}
export function evidencePayment(g: GameState, pid: PID, n: number, ids?: number[], exclude?: number): number[] | null {
  const opts = evidenceChoices(g, pid, exclude);
  if (ids) {
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !opts.includes(id)) ||
      ids.reduce((v, id) => v + manaValue(g.cards[id].def), 0) < n
    )
      return null;
    return ids;
  }
  const out: number[] = [];
  let v = 0;
  for (const id of opts.slice().sort((a, b) => manaValue(g.cards[b].def) - manaValue(g.cards[a].def))) {
    if (v >= n) break;
    out.push(id);
    v += manaValue(g.cards[id].def);
  }
  return v >= n ? out : null;
}
export function payEvidence(g: GameState, pid: PID, source: Card, ids: number[]) {
  const group = g.mkmCollecting;
  g.mkmCollecting = g.nextSid++;
  for (const id of ids) moveCard(g, g.cards[id], 'exile');
  g.mkmCollecting = group;
  if (source.def.id === 'kyloxs-voltstrider') (source.mkmLinked ??= []).push(...ids);
  source.mkmEvidence = true;
  emit(g, { type: 'mkm', action: 'evidence', card: source.id, player: pid, n: ids.length });
}
function* collect(g: GameState, pid: PID, c: Card, n: number): SubFlow<boolean> {
  if (!canEvidence(g, pid, n, c.zone === 'graveyard' ? c.id : undefined) || !(yield* yes(pid, `蒐證${n}？`))) return false;
  const options = evidenceChoices(g, pid, c.zone === 'graveyard' ? c.id : undefined);
  const r: Response = yield {
    type: 'choose',
    player: pid,
    prompt: `選擇法力值合計至少${n}的墳墓場牌`,
    options,
    min: 0,
    max: options.length,
    purpose: 'dig',
  };
  const ids = evidencePayment(
    g,
    pid,
    n,
    r.type === 'choose' && r.ids.length ? r.ids : undefined,
    c.zone === 'graveyard' ? c.id : undefined,
  );
  if (!ids) return false;
  payEvidence(g, pid, c, ids);
  return true;
}
export function* mkmEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, { e: 'mkm' }>): SubFlow {
  const pid = ctx.controller,
    opp = other(pid),
    src = g.cards[ctx.source],
    p = g.players[pid],
    ev = ctx.ev;
  const targets = resolveRef(g, ctx, ef.what ?? 'T0').cards,
    c = targets[0];
  const ec = ev && 'card' in ev ? g.cards[ev.card] : undefined;
  const run = (es: Effect[]) => runEffects(g, ctx, es);
  const clue = (n = 1) => makeEclTokenBatch(g, pid, 'tok-clue', n);
  const token = (id: string, n = 1) => makeEclTokenBatch(g, pid, 'tok-mkm-' + id, n);
  const pick = (options: number[], prompt: string, min = 0, max = 1, player = pid) => choose(g, player, prompt, options, min, max);
  const tutor = function* (f: Filter, to: 'hand' | 'battlefield' = 'hand', tapped = false): SubFlow<Card | undefined> {
    const ids = p.library.filter((id) => matches(g, f, g.cards[id], pid));
    const id = (yield* pick(ids, '搜尋牌', 0))[0];
    if (id !== undefined) {
      const x = g.cards[id];
      if (to === 'battlefield') enterBattlefield(g, x, pid, tapped);
      else moveCard(g, x, 'hand');
      shuffleArr(g, p.library);
      return x;
    }
    shuffleArr(g, p.library);
  };

  switch (ef.action) {
    case 'extraCombat':
      g.extraCombat = { player: pid, landOnly: false, count: (g.extraCombat?.count ?? 0) + 1 };
      break;
    case 'ward': {
      const item = g.stack.find((it) => it.sid === ef.n);
      if (!item) break;
      let paid = false;
      if (src.def.id === 'axebane-ferox') paid = yield* collect(g, item.controller, src, 4);
      else {
        const ids = own(g, item.controller, { type: 'Creature' });
        if (ids.length && (yield* yes(item.controller, '犧牲一個生物支付守護？'))) {
          const id = (yield* pick(ids, '犧牲生物', 1, 1, item.controller))[0];
          sacrifice(g, g.cards[id]);
          paid = true;
        }
      }
      if (!paid && !(item.kind === 'spell' && g.cards[item.cardId].def.uncounterable)) {
        g.stack = g.stack.filter((it) => it.sid !== item.sid);
        if (item.kind === 'spell' && !g.cards[item.cardId].def.uncounterable) moveCard(g, g.cards[item.cardId], 'graveyard');
      }
      break;
    }
    case 'solve':
      if (src.zone === 'battlefield' && mkmCondition(g, { c: 'mkm', action: 'solve' }, pid, src.id)) {
        src.mkmSolved = true;
        if (src.def.id === 'case-of-the-gorgons-kiss')
          change(src, {
            types: [...src.def.types, 'Creature'],
            subtypes: [...(src.def.subtypes ?? []), 'Gorgon'],
            power: 4,
            toughness: 4,
            keywords: ['deathtouch', 'lifelink'],
          });
        emit(g, { type: 'mkm', action: 'solved', card: src.id, player: pid });
      }
      break;
    case 'collect':
      yield* collect(g, pid, src, ef.n ?? 0);
      break;
    case 'clearSuspects':
    case 'clearOppSuspects':
      for (const id of g.battlefield) if (ef.action === 'clearSuspects' || g.cards[id].controller === opp) g.cards[id].suspected = false;
      break;
    case 'unsuspect':
      if (c) c.suspected = false;
      break;
    case 'mayUnsuspect':
      if (c && (yield* yes(pid, '不再懷疑此生物？'))) c.suspected = false;
      break;
    case 'faceUp':
      if (c) turnFaceUp(g, c);
      break;
    case 'discardHand':
      discardMany(
        g,
        p.hand.slice().map((id) => g.cards[id]),
      );
      break;
    case 'manaAny':
    case 'cryptexMana': {
      const col = ['W', 'U', 'B', 'R', 'G'] as const;
      const i = yield* mode(pid, '選擇法力顏色', [...col]);
      (p.pool ??= []).push(col[i] ?? 'W');
      if (ef.action === 'cryptexMana') (src.mkmMarks ??= {}).unlock = (src.mkmMarks?.unlock ?? 0) + 1;
      break;
    }
    case 'mustBlock':
      if (c) (c.finMarks ??= {}).mustBlock = g.turn;
      break;
    case 'mustAttackBlock':
      if (c) (c.mkmMarks ??= {}).mustAttackBlock = g.turn;
      break;
    case 'gainOwned':
      if (c) {
        const before = c.controller;
        c.controller = pid;
        c.sick = true;
        emit(g, { type: 'fin', action: 'controlChange', card: c.id, player: pid, amount: before });
      }
      break;
    case 'returnSuspect': {
      const dead = ec ?? src;
      if (dead.zone === 'graveyard' && !dead.token) {
        enterBattlefield(g, dead, dead.owner);
        dead.suspected = true;
      }
      break;
    }
    case '4':
      for (const target of ctx.targets) {
        if (target && 'c' in target) {
          const x = g.cards[target.c];
          moveCard(g, x, 'exile');
          (src.mkmLinked ??= []).push(x.id);
        }
      }
      break;
    case '6':
      if (c) {
        enterBattlefield(g, c, pid);
        (c.permanentGrants ??= []).push({ kw: ['flying'] });
        change(c, { subtypes: [...new Set([...(c.def.subtypes ?? []), 'Spirit'])] });
      }
      break;
    case '8':
      if (c) for (const id of own(g, pid, { type: 'Creature' })) dealDamage(g, g.cards[id], pid, { c: c.id }, 1);
      break;
    case '10':
      mkmFlags(g, pid).graveCast = g.turn;
      break;
    case '27': {
      const counts = g.players.map((pl) => own(g, pl.id, { type: 'Creature' }).length),
        most = Math.max(...counts);
      for (const pl of g.players) if (counts[pl.id] === most) yield* makeEclTokenBatch(g, pl.id, 'tok-clue', 1);
      destroyCards(g, g.battlefield.map((id) => g.cards[id]).filter(isCreature));
      break;
    }
    case '32':
      if (c && (yield* yes(pid, '雙方生物各放一個暈眩指示物？'))) {
        c.stun++;
        src.stun++;
      }
      break;
    case 'hero1':
      change(src, { subtypes: ['Human', 'Detective'], power: 4, toughness: 4, keywords: [...(src.def.keywords ?? []), 'vigilance'] });
      break;
    case 'hero2':
      if (matches(g, { sub: 'Detective' }, src, pid))
        change(src, {
          name: 'Mileva, the Stalwart',
          power: 5,
          toughness: 5,
          supertypes: ['Legendary'],
          abilities: [
            { kind: 'static', anthem: { filter: { ctrl: 'you', type: 'Creature', other: true }, grant: { kw: ['indestructible'] } } },
          ],
        });
      break;
    case '35':
      if (c) {
        const controller = c.controller;
        moveCard(g, c, 'exile');
        if (controller === pid) enterBattlefield(g, c, pid, true);
        else yield* makeEclTokenBatch(g, controller, 'tok-detective', 1);
      }
      break;
    case '36':
      if (g.players[opp].hand.length > p.hand.length) yield* clue();
      break;
    case '38':
      for (const name of ['magnifying-glass', 'thinking-cap']) {
        const id = (yield* pick(
          [...p.graveyard, ...p.hand, ...p.library].filter((id) => g.cards[id].def.id === name),
          '可找出 ' + name,
          0,
        ))[0];
        if (id !== undefined) enterBattlefield(g, g.cards[id], pid);
      }
      shuffleArr(g, p.library);
      break;
    case '39':
      if (c) {
        yield* run([{ e: 'setBase', what: 'T0', p: src.mkmEvidence ? 1 : 4, t: src.mkmEvidence ? 1 : 3 }]);
        change(c, { types: [...new Set([...c.def.types, 'Artifact', 'Creature'] as CardDef['types'])] }, true);
      }
      break;
    case '44':
      if (c) {
        change(c, {
          types: [...new Set([...c.def.types, 'Creature'] as CardDef['types'])],
          subtypes: [...(c.def.subtypes ?? []), 'Bird'],
          power: 0,
          toughness: 0,
          keywords: [...(c.def.keywords ?? []), 'flying'],
        });
        putCounters(g, c, 4);
      }
      break;
    case '48': {
      let n = 0;
      for (const t of ctx.targets)
        if (t && 'c' in t) {
          const x = g.cards[t.c];
          if (x.zone === 'battlefield' && x.controller === pid) {
            x.controller = opp;
            x.sick = true;
            n++;
          }
        }
      drawCards(g, pid, n);
      break;
    }
    case '50': {
      const x = g.cards[p.library[0]];
      if (x) {
        putFaceDown(g, x, pid, true);
        src.attachedTo = x.id;
      }
      break;
    }
    case '53': {
      const x = g.cards[src.attachedTo ?? -1];
      if (x) {
        moveCard(g, x, 'library');
        shuffleArr(g, g.players[x.owner].library);
      }
      break;
    }
    case '60':
      if (c) {
        const controlled = c.controller === pid;
        moveCard(g, c, 'hand');
        if (controlled) yield* clue();
      }
      break;
    case '61': {
      const top = p.library.slice(0, 5),
        pile = yield* pick(top, '分成兩堆：選第一堆', 0, top.length);
      const rest = top.filter((id) => !pile.includes(id));
      const chosen = yield* mode(opp, '選擇給對手的一堆', [`第一堆（${pile.length}張）`, `第二堆（${rest.length}張）`]);
      const hand = chosen === 0 ? pile : rest,
        gy = chosen === 0 ? rest : pile;
      for (const id of hand) moveCard(g, g.cards[id], 'hand');
      for (const id of gy) moveCard(g, g.cards[id], 'graveyard');
      const def: CardDef = {
        id: 'tok-mkm-zero-thopter',
        name: 'Thopter',
        set: 'TOK',
        rarity: 'T',
        types: ['Artifact', 'Creature'],
        subtypes: ['Thopter'],
        power: 0,
        toughness: 0,
        keywords: ['flying'],
        text: '',
      };
      for (const t of yield* makeEclTokenBatch(g, pid, def, 1)) putCounters(g, t, gy.length);
      break;
    }
    case '64':
      for (const t of ctx.targets)
        if (t && 'c' in t) {
          const c = g.cards[t.c];
          tapCard(g, c);
          if (c.controller !== pid) c.stun++;
        }
      break;
    case '65':
      (g.delayed ??= []).push({
        source: src.id,
        controller: pid,
        on: 'allyCombatDamagePlayer',
        effects: [{ e: 'token', token: 'tok-clue' }],
        once: false,
      });
      break;
    case '70':
      if (c && c.zone === 'graveyard') {
        moveCard(g, c, 'exile');
        const cp = newCard(g, c.def, pid, true);
        cp.zone = 'exile';
        yield* freeCast(g, ctx, cp);
      }
      break;
    case '71': {
      const ids = yield* pick(p.hand, '棄一張瞬間、巫術或飛行生物，否則棄兩張', Math.min(1, p.hand.length), Math.min(2, p.hand.length));
      const one =
        ids.length === 1 &&
        matches(g, { or: [{ type: ['Instant', 'Sorcery'] }, { type: 'Creature', kw: 'flying' }] }, g.cards[ids[0]], pid);
      const chosen = one ? ids : [...new Set([...ids, ...p.hand])].slice(0, 2);
      discardMany(
        g,
        chosen.map((id) => g.cards[id]),
      );
      break;
    }
    case '72':
      if (c) {
        const top = yield* yes(c.owner, '放在牌庫頂？（否則放牌庫底）');
        g.stack = g.stack.filter((it) => it.cardId !== c.id || it.kind !== 'spell');
        moveCard(g, c, 'library', !top);
      }
      break;
    case '75':
      drawCards(g, pid, ctx.ev?.type === 'sacrifice' && g.cards[ctx.ev.card].suspected ? 2 : src.mkmMarks?.sacSuspect === g.turn ? 2 : 1);
      break;
    case '83':
      if (src.mkmEvidence) {
        const id = (yield* pick(g.players[opp].graveyard, '放逐一張牌並搜尋同名牌', 0))[0];
        if (id === undefined) break;
        const name = g.cards[id].def.name,
          ids = [...g.players[opp].graveyard, ...g.players[opp].hand, ...g.players[opp].library].filter(
            (id) => g.cards[id].def.name === name,
          ),
          chosen = yield* pick(ids, '選擇放逐任意數量同名牌', 0, ids.length);
        if (!chosen.includes(id)) chosen.push(id);
        let count = 0;
        for (const cid of chosen) {
          if (g.cards[cid].zone === 'hand') count++;
          moveCard(g, g.cards[cid], 'exile');
        }
        shuffleArr(g, g.players[opp].library);
        drawCards(g, opp, count);
      }
      break;
    case '84': {
      let ids = own(g, opp, { type: 'Creature' });
      if (src.mkmEvidence) {
        const max = Math.max(...ids.map((id) => stats(g, g.cards[id]).p));
        ids = ids.filter((id) => stats(g, g.cards[id]).p === max);
      }
      const id = (yield* pick(ids, '犧牲生物', Math.min(1, ids.length), 1, opp))[0];
      if (id !== undefined) sacrifice(g, g.cards[id]);
      break;
    }
    case '88':
      for (const id of own(g, pid, { type: 'Creature' })) (g.cards[id].mkmMarks ??= {}).impostor = 1;
      break;
    case 'impostor':
      if (ec && ec.zone === 'graveyard') moveCard(g, ec, 'exile');
      if (c && c.id !== ec?.id) enterBattlefield(g, c, pid);
      break;
    case '97': {
      for (const id of g.players[opp].library.slice(0, ctx.x ?? 0)) {
        const x = g.cards[id];
        moveCard(g, x, 'exile');
        x.eclCast = { by: pid, mode: 'finAnyMana' };
      }
      break;
    }
    case 'poison':
      g.players[opp].poison = (g.players[opp].poison ?? 0) + 2*innkeeperMultiplier(g,ctx.controller);
      break;
    case '99': {
      const which = yield* mode(opp, '選擇支付或失去3生命', ['棄一張牌', '犧牲生物', '失去3生命']);
      if (which === 0 && g.players[opp].hand.length) {
        const id = (yield* pick(g.players[opp].hand, '棄牌', 1, 1, opp))[0];
        discard(g, g.cards[id]);
      } else if (which === 1 && own(g, opp, { type: 'Creature' }).length) {
        const id = (yield* pick(own(g, opp, { type: 'Creature' }), '犧牲', 1, 1, opp))[0];
        sacrifice(g, g.cards[id]);
      } else loseLife(g, opp, 3);
      break;
    }
    case '101':
      if (src.suspected) putCounters(g, src, 1);
      else yield* run([{ e: 'suspect', what: 'self' }]);
      break;
    case '108':
    case '120': {
      const ids = own(g, pid, { type: ef.action === '108' ? ['Artifact', 'Creature'] : 'Artifact' });
      const id = (yield* pick(ids, '可犧牲神器' + (ef.action === '108' ? '或生物' : ''), 0))[0];
      if (id === undefined) break;
      sacrifice(g, g.cards[id]);
      yield* run([
        {
          e: 'reflexive',
          targets: [ef.action === '108' ? { kind: 'creature', filter: { ctrl: 'opp' } } : { kind: 'any' }],
          effects: [ef.action === '108' ? { e: 'exile', what: 'T0' } : { e: 'damage', n: 3, to: 'T0' }],
        },
      ]);
      break;
    }
    case '109': {
      const ids = g.players[opp].hand;
      if (ids.length) {
        const id = (yield* pick(ids, '選擇放逐一張手牌', 1, 1, opp))[0];
        moveCard(g, g.cards[id], 'exile');
      }
      break;
    }
    case '111': {
      destroyCards(
        g,
        own(g, opp, { type: 'Artifact' }).map((id) => g.cards[id]),
      );
      const ids = p.library.slice(0, mkmFlags(g, pid).artifactGy ?? 0);
      for (const id of ids) moveCard(g, g.cards[id], 'exile');
      const id = (yield* pick(
        ids.filter((id) => isCreature(g.cards[id])),
        '可放入生物',
        0,
      ))[0];
      if (id !== undefined) {
        const x = g.cards[id];
        enterBattlefield(g, x, pid);
        g.eot.push({ card: id, p: 0, t: 0, kw: ['haste'] });
        delay(g, x, pid, [{ e: 'bounce', what: 'self' }]);
      }
      break;
    }
    case '113': {
      const ids = p.library.slice(0, 3);
      for (const id of ids) moveCard(g, g.cards[id], 'exile');
      const id = (yield* pick(ids, '選擇本回合可使用的牌', Math.min(1, ids.length)))[0];
      if (id !== undefined) {
        g.cards[id].playableTurn = g.turn;
        g.cards[id].playableBy = pid;
      }
      break;
    }
    case '115':
      if (c) {
        c.returnControl = { player: c.controller, turn: g.turn };
        c.controller = pid;
        c.tapped = false;
        c.sick = false;
        g.eot.push({ card: c.id, p: 0, t: 0, kw: ['haste'] });
      }
      break;
    case '118': {
      const x = g.cards[p.library[0]];
      if (x) {
        moveCard(g, x, 'exile');
        (src.mkmLinked ??= []).push(x.id);
      }
      break;
    }
    case 'dotsReturn':
      discardMany(
        g,
        p.hand.slice().map((id) => g.cards[id]),
      );
      for (const id of src.mkmLinked ?? []) if (g.cards[id].zone === 'exile') moveCard(g, g.cards[id], 'hand');
      src.mkmLinked = [];
      break;
    case '123':
      if (ev?.type === 'damaged') {
        const victim = g.cards[ev.card];
        if (yield* yes(victim.controller, '放逐牌庫頂並於你的下一回合結束前使用？')) {
          const pl = g.players[victim.controller];
          for (const id of pl.library.slice(0, ev.amount)) {
            const x = g.cards[id];
            moveCard(g, x, 'exile');
            x.playableBy = victim.controller;
            x.playableUntil = g.turn + (g.active === victim.controller ? 2 : 1);
          }
        }
      }
      break;
    case '124': {
      const ids = yield* pick(
        own(g, pid).filter((id) => !g.cards[id].hidden && !!g.cards[id].def.disguise),
        '任意數量重新斗篷',
        0,
        g.battlefield.length,
      );
      for (const id of ids) moveCard(g, g.cards[id], 'exile');
      shuffleArr(g, ids);
      for (const id of ids) putFaceDown(g, g.cards[id], pid, true);
      break;
    }
    case '126':
      if (src.suspected && ec && (yield* yes(pid, '將懷疑轉移給新生物？'))) {
        yield* run([{ e: 'suspect', what: 'evCard' }]);
        if (ec.suspected) src.suspected = false;
      }
      break;
    case '129': {
      const i = yield* mode(pid, '選擇效果', ['消滅至多一個神器', '犧牲神器放兩個指示物']);
      if (i === 0) {
        const id = (yield* pick(
          g.battlefield.filter((id) => g.cards[id].def.types.includes('Artifact')),
          '消滅神器',
          0,
        ))[0];
        if (id !== undefined) destroyCards(g, [g.cards[id]]);
      } else {
        const id = (yield* pick(own(g, pid, { type: 'Artifact' }), '犧牲神器', Math.min(1, own(g, pid, { type: 'Artifact' }).length)))[0];
        if (id !== undefined) {
          sacrifice(g, g.cards[id]);
          putCounters(g, src, 2);
        }
      }
      break;
    }
    case '130':
      mkmFlags(g, pid).faceDownDiscount = (mkmFlags(g, pid).faceDownDiscount ?? 0) + 1;
      break;
    case '132': {
      const n = ev?.type === 'combatDamage' ? ev.amount : 0;
      if (yield* collect(g, pid, src, n))
        for (const id of own(g, opp, { type: ['Creature', 'Planeswalker'] })) dealDamage(g, src, pid, { c: id }, n);
      break;
    }
    case '136':
      for (const pl of g.players) {
        const id = (yield* pick(own(g, pl.id, { type: 'Land', basic: false }), '至多消滅一張非基本地', 0))[0];
        if (id !== undefined) {
          const x = g.cards[id];
          destroyCards(g, [x]);
          if (x.zone === 'graveyard') {
            yield* runEffects(g, { ...ctx, controller: pl.id }, [{ e: 'searchLand', to: 'battlefield', tapped: true }]);
          }
        }
      }
      break;
    case '137':
      if (src.zone === 'graveyard' && (yield* collect(g, pid, src, 4))) {
        moveCard(g, src, 'exile');
        enterBattlefield(g, src, pid, true);
      }
      break;
    case '141': {
      const opts = own(g, pid, { type: 'Artifact' }),
        has = p.hand.length > 0;
      const i = yield* mode(pid, '可支付費用', ['不支付', ...(opts.length ? ['犧牲神器'] : []), ...(has ? ['棄牌'] : [])]);
      if (i === 0) break;
      if (opts.length && i === 1) {
        const id = (yield* pick(opts, '犧牲神器', 1))[0];
        sacrifice(g, g.cards[id]);
      } else {
        const id = (yield* pick(p.hand, '棄一張', 1))[0];
        discard(g, g.cards[id]);
      }
      yield* run([
        { e: 'draw', n: 1 },
        { e: 'pump', what: 'self', p: 2, t: 0 },
      ]);
      break;
    }
    case '143':
      if (!src.suspected && (yield* yes(pid, '懷疑此生物？'))) yield* run([{ e: 'suspect', what: 'self' }]);
      break;
    case '146':
      if ((ctx.excess ?? 0) > 0) yield* clue();
      break;
    case '148':
      for (const id of p.graveyard.slice().filter((id) => isLand(g.cards[id]))) enterBattlefield(g, g.cards[id], pid, true);
      break;
    case '150':
      yield* tutor(src.mkmEvidence ? { type: ['Creature', 'Land'] } : { type: 'Land', basic: true });
      break;
    case '151': {
      const x = yield* tutor({ type: ['Creature', 'Land'] });
      if (x && isLand(x)) enterBattlefield(g, x, pid, true);
      break;
    }
    case 'distribute': {
      let left = ef.n ?? 0;
      const options = ef.n === 3 ? g.battlefield.filter((id) => isCreature(g.cards[id])) : own(g, pid, { type: 'Creature' });
      while (left > 0 && options.length) {
        const id = (yield* pick(options, `分配指示物，剩${left}個`, 1))[0];
        putCounters(g, g.cards[id], 1);
        left--;
      }
      break;
    }
    case '160': {
      const a = yield* tutor({ type: 'Land', sub: 'Forest' }, 'battlefield', true);
      void a;
      yield* tutor({ type: 'Land', sub: 'Forest' });
      break;
    }
    case '165':
      if (c) {
        change(c, {
          types: [...new Set([...c.def.types, 'Creature'] as CardDef['types'])],
          subtypes: [...(c.def.subtypes ?? []), 'Plant', 'Boar'],
          colors: ['G'],
          power: 5,
          toughness: 5,
          keywords: ['haste'],
        });
        (c.mkmMarks ??= {}).hedge = src.id;
      }
      break;
    case '166': {
      const ids = p.library.slice(0, 5),
        chosen = yield* pick(ids, '斗篷兩張', Math.min(2, ids.length), 2);
      for (const id of chosen) putFaceDown(g, g.cards[id], pid, true);
      const rest = ids.filter((id) => !chosen.includes(id));
      shuffleArr(g, rest);
      for (const id of rest) moveCard(g, g.cards[id], 'library', true);
      break;
    }
    case '167':
      (src.mkmMarks ??= {}).killer = yield* mode(pid, '秘密選擇生物類別', ['Human', 'Merfolk', 'Goblin']);
      break;
    case 'killer':
      if (c && matches(g, { sub: ['Human', 'Merfolk', 'Goblin'][src.mkmMarks?.killer ?? 0] }, c, pid)) {
        putCounters(g, c, 3);
        g.eot.push({ card: c.id, p: 0, t: 0, kw: ['deathtouch'] });
      }
      break;
    case '175':
      if (yield* collect(g, pid, src, 3))
        yield* run([
          { e: 'reflexive', targets: [{ kind: 'creature', filter: { ctrl: 'you' } }], effects: [{ e: 'counters', what: 'T0', n: 1 }] },
        ]);
      break;
    case '176':
      if (ec && (stats(g, ec).p > stats(g, src).p || stats(g, ec).t > stats(g, src).t)) {
        putCounters(g, src, 1);
        yield* clue();
      }
      break;
    case '177': {
      const n =
        2 +
        [...p.graveyard, ...p.exile].filter(
          (id) => matches(g, { sub: 'Ooze' }, g.cards[id], pid) || g.cards[id].def.id === 'slime-against-humanity',
        ).length;
      for (const t of yield* token('ooze')) putCounters(g, t, n);
      break;
    }
    case '184':
      if (c) {
        if (c.suspected) moveCard(g, c, 'exile');
        else yield* run([{ e: 'suspect', what: 'T0' }]);
      }
      break;
    case '189': {
      const marks = (src.mkmMarks ??= {});
      marks.blood = (marks.blood ?? 0) + 1;
      if (marks.blood >= 5) {
        sacrifice(g, src);
        yield* run([
          {
            e: 'reflexive',
            targets: [{ kind: 'gyCard', filter: { ctrl: 'you', type: 'Creature' } }],
            effects: [{ e: 'toHand', what: 'T0' }],
          },
        ]);
      }
      break;
    }
    case '190': {
      const top = p.library.slice(0, 6),
        id = (yield* pick(
          top.filter((id) => isCreature(g.cards[id])),
          '可揭示一張生物',
          0,
        ))[0];
      if (id !== undefined) {
        const x = g.cards[id];
        if (manaValue(x.def) <= 2 && (yield* yes(pid, '放進戰場並獲得敏捷？'))) {
          enterBattlefield(g, x, pid);
          g.eot.push({ card: id, p: 0, t: 0, kw: ['haste'] });
        } else moveCard(g, x, 'hand');
      }
      for (const x of top.filter((x) => x !== id)) moveCard(g, g.cards[x], 'library', true);
      break;
    }
    case '192': {
      const x = g.cards[src.attachedTo ?? -1];
      if (x) {
        (src.mkmMarks ??= {}).controlled = x.id;
        src.mkmMarks.previous = x.controller;
        x.controller = pid;
        x.sick = true;
        change(x, { power: 1, toughness: 1, subtypes: [...(x.def.subtypes ?? []), 'Assassin'] });
      }
      break;
    }
    case '198': {
      const x = ctx.x ?? 0;
      const ids = ctx.targets.filter((t): t is { c: number } => !!t && 'c' in t).map((t) => t.c);
      for (const id of ids) yield* makeEclTokenBatch(g, pid, copiableDefinition(g.cards[id]), x);
      break;
    }
    case '200': {
      const x = g.cards[g.players[opp].library[0]];
      if (x) putFaceDown(g, x, pid, true);
      break;
    }
    case 'etrataUp':
      if (src.hidden) {
        if (src.hidden.types.some((t) => !['Instant', 'Sorcery'].includes(t))) turnFaceUp(g, src);
        else {
          const def = src.hidden;
          moveCard(g, src, 'exile');
          src.def = def;
          yield* freeCast(g, ctx, src);
        }
      }
      break;
    case '202': {
      const i = yield* mode(pid, '選擇異能', ['警戒', '繫命', '辟邪']);
      g.eot.push({ card: src.id, p: 0, t: 0, kw: [(['vigilance', 'lifelink', 'hexproof'] as const)[i] ?? 'vigilance'] });
      break;
    }
    case '206':
      if (c) {
        if (yield* yes(pid, '橫置？（否則重置）')) tapCard(g, c);
        else c.tapped = false;
      }
      break;
    case '207':
      if (p.hand.length >= 2 && (yield* yes(pid, '棄兩張並造成傷害？'))) {
        const ids = yield* pick(p.hand, '棄兩張', 2, 2);
        const n = Math.max(...ids.map((id) => manaValue(g.cards[id].def)));
        discardMany(
          g,
          ids.map((id) => g.cards[id]),
        );
        for (const id of g.battlefield.filter((id) => isCreature(g.cards[id]))) dealDamage(g, src, pid, { c: id }, n);
      }
      break;
    case '209':
      if (yield* collect(g, pid, src, 4)) yield* token('spider', 2);
      break;
    case '210': {
      const i = yield* mode(pid, '選擇效果', ['此咒語獲得死觸與繫命', '派出Imp']);
      if (i === 1) yield* token('imp');
      else if (ec) (ec.mkmMarks ??= {}).judith = g.turn;
      break;
    }
    case 'kayaExile': {
      const opts = g.players.flatMap((pl) => pl.graveyard);
      const id = (yield* pick(opts, '放逐墳墓場牌', Math.min(1, opts.length)))[0];
      if (id !== undefined) moveCard(g, g.cards[id], 'exile');
      break;
    }
    case 'kayaCopy':
      if (ec && (yield* yes(pid, '讓衍生物成為其複製品？'))) {
        const id = (yield* pick(own(g, pid, { token: true }), '選擇衍生物', Math.min(1, own(g, pid, { token: true }).length)))[0];
        if (id !== undefined) {
          const t = g.cards[id],
            def = { ...copiableDefinition(ec), keywords: [...(ec.def.keywords ?? []), 'flying' as const] };
          change(t, def, true);
          t.copyLayer = def;
        }
      }
      break;
    case '212':
      if (c) {
        const yours = c.controller === pid;
        destroyCards(g, [c]);
        if (yours) drawCards(g, pid, 1);
      }
      break;
    case '214': {
      const ids = yield* pick(
        own(g, pid, { type: 'Creature', other: true }).filter((id) => id !== src.id),
        '犧牲任意數量其他生物',
        0,
        g.battlefield.length,
      );
      const n = ids.reduce((v, id) => v + Math.max(0, stats(g, g.cards[id]).p), 0);
      for (const id of ids) sacrifice(g, g.cards[id]);
      const ex = p.library.slice(0, n);
      for (const id of ex) moveCard(g, g.cards[id], 'exile');
      for (const id of ex.filter((id) => g.cards[id].def.types.some((t) => t === 'Instant' || t === 'Sorcery')))
        if (yield* yes(pid, '免費施放 ' + g.cards[id].def.name + '？')) yield* freeCast(g, ctx, g.cards[id]);
      break;
    }
    case '215':
      change(src, { types: ['Artifact', 'Creature'], subtypes: src.def.subtypes, power: 8, toughness: 3 }, true);
      break;
    case 'voltCast': {
      const ids = (src.mkmLinked ?? []).filter(
        (id) => g.cards[id].zone === 'exile' && g.cards[id].def.types.some((t) => t === 'Instant' || t === 'Sorcery'),
      );
      const id = (yield* pick(ids, '施放放逐的瞬間或法術（需支付費用）', 0))[0];
      if (id !== undefined) {
        const x = g.cards[id];
        (x.mkmMarks ??= {}).voltBottom = 1;
        castDuringResolution(g, pid, x.id, [], false);
      }
      break;
    }
    case '216':
      if (c) {
        moveCard(g, c, 'exile');
        (src.mkmLinked ??= []).push(c.id);
      }
      break;
    case 'lazavCopy': {
      const ids = (src.mkmLinked ?? []).filter((id) => g.cards[id].zone === 'exile' && isCreature(g.cards[id]));
      const id = (yield* pick(ids, '可複製放逐的生物牌', 0))[0];
      if (id !== undefined) {
        const def = copiableDefinition(g.cards[id]);
        change(src, def, true);
        src.copyLayer = def;
      }
      break;
    }
    case '221':
    case '227': {
      const t = ctx.targets[ef.action === '221' ? 0 : 1],
        it = t && 'c' in t ? g.stack.find((s) => s.kind === 'spell' && s.cardId === t.c) : undefined;
      if (!it) break;
      const cost = ef.action === '221' ? 3 : Math.max(0, ...own(g, pid, { type: 'Creature' }).map((id) => stats(g, g.cards[id]).p));
      if (canPayCost(g, it.controller, parseCost(`{${cost}}`)) && (yield* yes(it.controller, `支付{${cost}}避免反擊？`))) {
        payCost(g, it.controller, parseCost(`{${cost}}`));
        break;
      }
      const x = g.cards[it.cardId];
      if (x.def.uncounterable) break;
      g.stack = g.stack.filter((s) => s.sid !== it.sid);
      moveCard(g, x, ef.action === '221' ? 'exile' : 'graveyard');
      break;
    }
    case 'interrogateSelf':
    case 'interrogateOpp':
    case 'interrogateBoth': {
      const n =
        (ef.action !== 'interrogateOpp' ? own(g, pid, { type: 'Creature' }).length : 0) +
        (ef.action !== 'interrogateSelf' ? own(g, opp, { type: 'Creature' }).length : 0);
      yield* clue(n);
      break;
    }
    case '224': {
      const ids = own(g, opp, { nonType: 'Land', token: false });
      if (ids.length >= 2 && (yield* yes(opp, '犧牲兩個非地非衍生永久物？'))) {
        for (const id of yield* pick(ids, '犧牲兩個', 2, 2, opp)) sacrifice(g, g.cards[id]);
      } else drawCards(g, pid, 2);
      break;
    }
    case '232': {
      const ids = g.players[opp].hand.filter((id) => !isLand(g.cards[id]));
      const id = (yield* pick(ids, '放逐對手一張非地牌', Math.min(1, ids.length)))[0];
      if (id !== undefined) {
        const x = g.cards[id],
          n = manaValue(x.def);
        moveCard(g, x, 'exile');
        if (n <= 1) yield* token('spirit');
      }
      break;
    }
    case '235':
      (p.mkmGossip ??= []).push('R', 'G');
      break;
    case '236': {
      const wolf = ec;
      if (wolf) {
        const id = (yield* pick(
          own(g, opp, { type: 'Creature' }),
          '選擇必須阻擋此狼的生物',
          Math.min(1, own(g, opp, { type: 'Creature' }).length),
        ))[0];
        if (id !== undefined) (g.cards[id].mkmMarks ??= {}).blockWolf = wolf.id;
      }
      break;
    }
    case 'destroyFourth': {
      const t = ctx.targets[3];
      if (t && 'c' in t) destroyCards(g, [g.cards[t.c]]);
      break;
    }
    case '241': {
      if ((yield* mode(pid, '選擇模式', ['斗篷手牌', '無色生物各放指示物'])) === 0) {
        const id = (yield* pick(p.hand, '選擇手牌', Math.min(1, p.hand.length)))[0];
        if (id !== undefined) putFaceDown(g, g.cards[id], pid, true);
      } else
        for (const id of own(g, pid, { type: 'Creature' }))
          if (!g.cards[id].def.cost && !g.cards[id].def.colors?.length) putCounters(g, g.cards[id], 1);
      break;
    }
    case '244': {
      const ids = [...p.hand, ...p.graveyard].filter((id) => isLand(g.cards[id]));
      for (const id of yield* pick(ids, '至多X張地進戰場', 0, ctx.x ?? 0)) enterBattlefield(g, g.cards[id], pid, true);
      break;
    }
    case '245':
      if (ec && ec.zone === 'graveyard' && ec.def.types.some((t) => !['Instant', 'Sorcery'].includes(t))) {
        putFaceDown(g, ec, ec.owner, true);
        turnFaceUp(g, ec);
      }
      break;
    case 'ceasePlayer': {
      const i = yield* mode(pid, '選擇獲得生命與抓牌的玩家', ['自己', '對手']);
      gainLife(g, i === 0 ? pid : opp, 2);
      drawCards(g, i === 0 ? pid : opp, 1);
      break;
    }
    case 'split246':
      destroyCards(
        g,
        g.battlefield.map((id) => g.cards[id]).filter((c) => c.def.types.some((t) => t === 'Artifact' || t === 'Enchantment')),
      );
      break;
    case 'split247': {
      yield* run([{ e: 'mill', who: 'opp', n: 3 }]);
      const id = (yield* pick(
        g.players[opp].graveyard.filter((id) => !isLand(g.cards[id])),
        '可免費施放對手墳墓場咒語',
        0,
      ))[0];
      if (id !== undefined) {
        g.cards[id].finExileOnResolve = true;
        yield* freeCast(g, ctx, g.cards[id]);
      }
      break;
    }
    case 'split248':
      yield* makeEclTokenBatch(g, pid, 'tok-thopter', 3);
      yield* run([{ e: 'surveil', n: 2 }]);
      break;
    case 'split249':
      yield* run([{ e: 'pump', what: { all: { ctrl: 'you', type: 'Creature' } }, p: 2, t: 2, kw: ['trample'] }]);
      {
        const id = (yield* pick(own(g, pid, { faceDown: true }), '可翻正面一個生物', 0))[0];
        if (id !== undefined) turnFaceUp(g, g.cards[id]);
      }
      break;
    case 'split250': {
      const ids = g.players.flatMap((pl) => pl.graveyard).filter((id) => isCreature(g.cards[id]));
      const first = yield* pick(ids, '可返場至多兩隻同一墳墓場生物', 0, 2);
      if (first.length && first.every((id) => g.cards[id].owner === g.cards[first[0]].owner))
        for (const id of first) {
          const x = g.cards[id];
          enterBattlefield(g, x, pid);
          g.eot.push({ card: id, p: 0, t: 0, kw: ['haste'] });
          delay(g, x, pid, [{ e: 'sac', what: 'self' }]);
        }
      break;
    }
    case 'lookHidden':
      mkmFlags(g, pid).lookHidden = g.turn;
      break;
    case '254':
      if (c) {
        enterBattlefield(g, c, pid);
        c.attachedTo = src.id;
      }
      break;
    case '258': {
      const col = ['W', 'U', 'B', 'R', 'G'] as const,
        i = yield* mode(pid, '選擇兩點法力顏色', [...col]);
      (p.retainedRed ??= []).push(col[i] ?? 'W', col[i] ?? 'W');
      break;
    }
    case '265': {
      const ids = own(g, pid, { type: ['Artifact', 'Land'], tapped: false });
      const id = (yield* pick(ids, '橫置一個神器或地，否則犧牲', 0))[0];
      if (id !== undefined) tapCard(g, g.cards[id]);
      else sacrifice(g, src);
      break;
    }
    default:
      throw new Error('Unknown MKM effect ' + ef.action);
  }
}
