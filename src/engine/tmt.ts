import { allDefs } from './registry';
import { choose, freeCast, target } from './tla';
import { resolveRef, runEffects, type Ctx } from './effects';
import { manaValue } from './mana';
import { isCreature, isLand, matches, newCard, other, shuffleArr, stats } from './state';
import { legalTargets } from './targets';
import type { Card, Color, Effect, Filter, GameState, Ref, Response, SubFlow } from './types';
import { createToken, destroyCards, discard, drawCards, emit, enterBattlefield, gainLife, loseLife, moveCard, putCounters } from './zones';

export function* tmtEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, { e: 'tmt' }>): SubFlow {
  const me = ctx.controller,
    opp = other(me),
    src = g.cards[ctx.source],
    p = g.players[me];
  const card = (ref: Ref = ef.what ?? 'T0') => resolveRef(g, ctx, ref).cards[0];
  const evCard = ctx.ev && 'card' in ctx.ev ? g.cards[ctx.ev.card] : undefined;
  const run = (effects: Effect[]) => runEffects(g, ctx, effects);
  const linked = (c: Card) => {
    moveCard(g, c, 'exile');
    c.tmtLinked = src.id;
  };
  switch (ef.action) {
    case 'level':
      if (src.zone === 'battlefield') src.classLevel = ef.n ?? 1;
      break;
    case 'leaderLife':
      if ((evCard?.countersBeforeLeaving ?? 0) > 0) gainLife(g, me, 2);
      break;
    case 'koya': {
      const c = card();
      if (c) {
        linked(c);
        (g.delayed ??= []).push({
          source: src.id,
          controller: me,
          on: 'eachEndStep',
          once: true,
          effects: [{ e: 'tmt', action: 'koyaReturn' }],
        });
      }
      break;
    }
    case 'koyaReturn': {
      const options = g.players.flatMap((p) => p.exile).filter((id) => g.cards[id].tmtLinked === src.id);
      if (options.length)
        yield* run([
          { e: 'costThen', prompt: '支付{3}{B}使放逐持續？', cost: { mana: '{3}{B}' }, then: [{ e: 'tmt', action: 'koyaKeep' }] },
        ]);
      for (const id of options) {
        const c = g.cards[id];
        if (c.tmtLinked === src.id) enterBattlefield(g, c, c.owner);
      }
      break;
    }
    case 'koyaKeep':
      for (const pl of g.players) for (const id of pl.exile) if (g.cards[id].tmtLinked === src.id) g.cards[id].tmtLinked = undefined;
      break;
    case 'lita': {
      const used = src.classModesTurn?.turn === g.turn ? src.classModesTurn.modes : [];
      const modes = [0, 1, 2].filter((i) => !used.includes(i));
      if (!modes.length) break;
      const r: Response = yield {
        type: 'mode',
        player: me,
        source: src.id,
        prompt: '選擇本回合未選過的項目',
        options: modes.map((i) => ['放指示物', '派出食物', '占卜1'][i]),
        count: 1,
        purpose: 'trigger',
      };
      const pick = modes[r.type === 'modes' ? (r.picks[0] ?? 0) : 0];
      if (pick === undefined) break;
      src.classModesTurn = { turn: g.turn, modes: [...used, pick] };
      if (pick === 0) putCounters(g, src, 1);
      if (pick === 1) createToken(g, 'tok-food', me);
      if (pick === 2) yield* run([{ e: 'scry', n: 1 }]);
      break;
    }
    case 'aprilDraw':
      drawCards(g, me, p.spellTypesThisTurn?.length ?? 0);
      break;
    case 'recoverArtifacts': {
      const ids = yield* choose(
        g,
        me,
        '取回至多兩張神器',
        p.graveyard.filter((id) => g.cards[id].def.types.includes('Artifact')),
        0,
        2,
      );
      for (const id of ids) moveCard(g, g.cards[id], 'hand');
      break;
    }
    case 'robot': {
      const c = card();
      if (c && c.zone === 'battlefield') {
        if (!isCreature(c)) {
          c.tlaOriginalDef ??= c.def;
          c.def = {
            ...c.def,
            types: [...c.def.types, 'Creature'],
            subtypes: [...(c.def.subtypes ?? []), src.def.id === 'pizza-face-gastromancer' ? 'Mutant' : 'Robot'],
            power: 0,
            toughness: 0,
          };
        }
        putCounters(g, c, ef.n ?? 3);
      }
      break;
    }
    case 'inheritArtifact': {
      const c = card();
      if (c) putCounters(g, c, evCard?.countersBeforeLeaving ?? evCard?.lastCounters ?? 0);
      break;
    }
    case 'protectCounter': {
      const c = card();
      const item = g.stack.find((s) => s.cardId === c?.id && s.kind === 'spell');
      if (
        item?.targets.some(
          (t) =>
            t && 'c' in t && g.cards[t.c]?.controller === me && (isCreature(g.cards[t.c]) || g.cards[t.c].def.types.includes('Artifact')),
        )
      )
        yield* run([{ e: 'counter', what: 'T0' }]);
      break;
    }
    case 'exchange': {
      const a = card('T0'),
        b = card('T1');
      if (a && b && a.zone === 'battlefield' && b.zone === 'battlefield' && a.controller !== b.controller) {
        const old = a.controller;
        a.controller = b.controller;
        b.controller = old;
      }
      break;
    }
    case 'halfMill':
      yield* run([{ e: 'mill', who: 'opp', n: Math.ceil(g.players[opp].library.length / 2) }]);
      break;
    case 'refillFour':
      drawCards(g, me, Math.max(0, 4 - p.hand.length));
      break;
    case 'mondo': {
      const colors = ['W', 'U', 'B', 'R', 'G'] as const;
      const r: Response = yield { type: 'mode', player: me, prompt: '選擇顏色', options: [...colors], count: 1, purpose: 'color' };
      const color: Color = colors[r.type === 'modes' ? (r.picks[0] ?? 0) : 0] ?? 'W';
      src.baseDef ??= src.def;
      src.def = { ...src.def, colors: [color] };
      src.colorProtection = { color, turn: g.turn };
      break;
    }
    case 'retro': {
      const host = src.attachedTo != null ? g.cards[src.attachedTo] : undefined;
      if (host) {
        host.auraBaseDef ??= host.def;
        host.def = { ...host.def, subtypes: ['Turtle'], power: 0, toughness: 1 };
      }
      break;
    }
    case 'cam': {
      const c = card();
      if (c) {
        const r: Response = yield { type: 'yesno', player: me, prompt: '橫置此生物？（否則重置）' };
        yield* run([{ e: r.type === 'yesno' && r.yes ? 'tap' : 'untap', what: 'T0' }]);
      }
      break;
    }
    case 'resetHands':
      for (const pid of [me, opp]) {
        const q = g.players[pid];
        const r: Response = yield { type: 'yesno', player: pid, prompt: '將手牌與墳墓場洗回並抓七張？' };
        if (r.type === 'yesno' && r.yes) {
          for (const id of [...q.hand, ...q.graveyard]) moveCard(g, g.cards[id], 'library');
          shuffleArr(g, q.library);
          drawCards(g, pid, 7);
        }
      }
      break;
    case 'cloneExile': {
      const c = card();
      if (c) {
        linked(c);
        yield* run([{ e: 'copyCreature', what: 'T0', nonLegendary: true, sub: 'Mutant' }]);
      }
      break;
    }
    case 'cloneAgain': {
      const options = p.exile.filter((id) => g.cards[id].tmtLinked === src.id);
      const [id] = yield* choose(g, me, '複製以此傳紀放逐的生物', options, 1);
      if (id !== undefined)
        yield* runEffects(g, { ...ctx, targets: [{ c: id }] }, [{ e: 'copyCreature', what: 'T0', nonLegendary: true, sub: 'Mutant' }]);
      break;
    }
    case 'null': {
      const c = evCard;
      if (c && c.zone === 'battlefield') {
        const n = Math.max(0, stats(g, c).p);
        const r: Response = yield { type: 'yesno', player: me, prompt: `支付${n}生命，放${n}個指示物？` };
        if (r.type === 'yesno' && r.yes && p.life >= n) {
          loseLife(g, me, n);
          putCounters(g, c, n);
        }
      }
      break;
    }
    case 'returnOnDeath': {
      const c = card();
      if (c)
        (g.delayed ??= []).push({
          source: c.id,
          controller: c.owner,
          on: 'dies',
          effects: [{ e: 'reanimate', what: 'selfAny', owner: true, tapped: true }],
          once: true,
        });
      break;
    }
    case 'paramecia': {
      const r: Response = yield { type: 'yesno', player: me, prompt: '放逐此牌將生物牌放牌庫頂？' };
      const c = card();
      if (r.type === 'yesno' && r.yes && src.zone === 'graveyard' && c?.zone === 'graveyard') {
        moveCard(g, src, 'exile');
        moveCard(g, c, 'library');
      }
      break;
    }
    case 'rats': {
      const c = card();
      if (c) for (const id of p.graveyard.slice()) if (g.cards[id].def.name === c.def.name) enterBattlefield(g, g.cards[id], me, true);
      break;
    }
    case 'shark': {
      const c = card();
      if (c && c.owner === opp) {
        enterBattlefield(g, c, me, true);
        c.attacking = true;
      }
      break;
    }
    case 'shredderDestroy': {
      const c = card();
      if (c) {
        const ench = c.def.types.includes('Enchantment');
        destroyCards(g, [c]);
        if (ench && c.zone === 'graveyard') loseLife(g, me, 2);
      }
      break;
    }
    case 'takeover':
      for (const id of g.battlefield) {
        const c = g.cards[id];
        if (c.controller === opp && c.def.types.includes('Artifact')) {
          c.returnControl = { player: opp, turn: g.turn };
          c.controller = me;
          c.tapped = false;
          yield* runEffects(g, { ...ctx, targets: [{ c: id }] }, [{ e: 'pump', what: 'T0', p: 0, t: 0, kw: ['haste'] }]);
        }
      }
      break;
    case 'casey':
      (g.delayed ??= []).push({
        source: src.id,
        controller: me,
        on: 'upkeep',
        once: true,
        persistent: true,
        effects: [{ e: 'discard', who: 'you', n: 3, random: true }],
      });
      break;
    case 'discardDamage':
      if (ctx.ev?.type === 'discard' && ctx.ev.player === me) yield* run([{ e: 'damage', n: 2, to: 'opp' }]);
      break;
    case 'hob': {
      const t = createToken(g, 'tok-mutant', me);
      yield* runEffects(g, { ...ctx, targets: [{ c: t.id }] }, [{ e: 'pump', what: 'T0', p: 0, t: 0, kw: ['haste'] }]);
      (g.delayed ??= []).push({ source: t.id, controller: me, on: 'eachEndStep', once: true, effects: [{ e: 'destroy', what: 'self' }] });
      break;
    }
    case 'raphExile':
      if (p.library.length) linked(g.cards[p.library[0]]);
      break;
    case 'raphPlay': {
      const options = p.exile.filter((id) => g.cards[id].tmtLinked === src.id);
      const [id] = yield* choose(g, me, '本回合可使用其中一張牌', options);
      if (id !== undefined) {
        g.cards[id].playableBy = me;
        g.cards[id].playableTurn = g.turn;
      }
      break;
    }
    case 'keepRed':
      p.keepRedTurn = g.turn;
      break;
    case 'courier': {
      const options = p.library.filter((id) => g.cards[id].def.subtypes?.includes('Food'));
      const [id] = yield* choose(g, me, '搜尋食物牌（可略過以派出食物）', options);
      if (id !== undefined) {
        moveCard(g, g.cards[id], 'hand');
        shuffleArr(g, p.library);
        emit(g, { type: 'search', player: me });
      } else createToken(g, 'tok-food', me);
      break;
    }
    case 'leatherhead': {
      const hex = src.permanentGrants?.findIndex((gr) => gr.kw?.includes('hexproof')) ?? -1;
      const r: Response = yield { type: 'yesno', player: me, prompt: '移除指示物以消滅神器或結界？' };
      if (r.type !== 'yesno' || !r.yes) break;
      if (src.counters > 0) src.counters--;
      else if (hex >= 0) src.permanentGrants!.splice(hex, 1);
      else break;
      yield* target(g, ctx, { kind: 'permanent', filter: { ctrl: 'opp', type: ['Artifact', 'Enchantment'] } }, [
        { e: 'destroy', what: 'T0' },
      ]);
      break;
    }
    case 'improviser': {
      const [cid] = yield* choose(
        g,
        me,
        '放一個生物進場',
        p.hand.filter((id) => isCreature(g.cards[id])),
      );
      if (cid !== undefined) enterBattlefield(g, g.cards[cid], me);
      const [lid] = yield* choose(
        g,
        me,
        '放一個地進場',
        p.hand.filter((id) => isLand(g.cards[id])),
      );
      if (lid !== undefined) enterBattlefield(g, g.cards[lid], me);
      break;
    }
    case 'mikeyTechnique': {
      const top = p.library.slice(0, 8);
      const options = top.filter((id) => isCreature(g.cards[id]));
      const selected = yield* choose(g, me, '選至多兩個總費用不超過6的生物', options, 0, 2);
      let total = 0;
      const put: number[] = [];
      for (const id of selected) {
        const n = manaValue(g.cards[id].def);
        if (total + n <= 6) {
          total += n;
          put.push(id);
          enterBattlefield(g, g.cards[id], me);
        }
      }
      const rest = top.filter((id) => !put.includes(id));
      shuffleArr(g, rest);
      for (const id of rest) moveCard(g, g.cards[id], 'library', true);
      break;
    }
    case 'nunchaku': {
      const host = card();
      if (host) {
        const options = legalTargets(g, { kind: 'creature', filter: { ctrl: 'opp' } }, me, src.id);
        const [id] = yield* choose(
          g,
          me,
          '選擇互鬥的對手生物',
          options.flatMap((t) => ('c' in t ? [t.c] : [])),
        );
        if (id !== undefined) yield* runEffects(g, { ...ctx, targets: [{ c: host.id }, { c: id }] }, [{ e: 'fight', a: 'T0', b: 'T1' }]);
      }
      break;
    }
    case 'bebop': {
      const [id] = yield* choose(g, me, '棄一張牌，否則犧牲永久物', p.hand.slice());
      if (id !== undefined) discard(g, g.cards[id]);
      else yield* run([{ e: 'edict', who: 'you' }]);
      break;
    }
    case 'brilliance': {
      const c = card();
      if (c) {
        enterBattlefield(g, c, me);
        if (!isCreature(c)) {
          c.tlaOriginalDef ??= c.def;
          c.def = {
            ...c.def,
            types: [...c.def.types, 'Creature'],
            subtypes: [...(c.def.subtypes ?? []), 'Robot'],
            power: 3,
            toughness: 3,
            keywords: [...(c.def.keywords ?? []), 'flying'],
          };
        }
      }
      break;
    }
    case 'darkLeo':
      if (g.battlefield.filter((id) => g.cards[id].controller === me && g.cards[id].def.subtypes?.includes('Ninja')).length >= 5)
        loseLife(g, opp, Math.ceil(g.players[opp].life / 2));
      break;
    case 'nextAffinity':
      p.nextAffinity = true;
      break;
    case 'krangExile': {
      const q = g.players[opp];
      while (q.library.length) {
        const c = g.cards[q.library[0]];
        linked(c);
        if (!isLand(c)) break;
      }
      break;
    }
    case 'krangCast': {
      const options = g.players.flatMap((p) => p.exile).filter((id) => g.cards[id].tmtLinked === src.id && !isLand(g.cards[id]));
      const [id] = yield* choose(g, me, '免費施放放逐的牌', options);
      if (id !== undefined) yield* freeCast(g, ctx, g.cards[id]);
      break;
    }
    case 'neutrinos': {
      const options = legalTargets(g, { kind: 'creature' }, me, src.id).flatMap((t) =>
        'c' in t && g.cards[t.c].owner === me ? [t.c] : [],
      );
      const [id] = yield* choose(g, me, '閃現你擁有的生物並使其攻擊', options);
      if (id !== undefined) {
        const c = g.cards[id];
        moveCard(g, c, 'exile');
        enterBattlefield(g, c, me, true);
        c.attacking = true;
      }
      break;
    }
    case 'sibling':
      if (g.combatCount === 1) {
        const options = g.battlefield.filter((id) => g.cards[id].controller === me && g.cards[id].attacking);
        for (const id of yield* choose(g, me, '重置一至兩個攻擊者', options, 1, 2)) g.cards[id].tapped = false;
        g.extraCombat = { player: me, landOnly: false };
      }
      break;
    case 'troublemakers': {
      const skipped: number[] = [];
      while (p.library.length) {
        const c = g.cards[p.library[0]];
        if (isCreature(c)) {
          enterBattlefield(g, c, me, true);
          c.attacking = true;
          break;
        }
        moveCard(g, c, 'exile');
        skipped.push(c.id);
      }
      shuffleArr(g, skipped);
      for (const id of skipped) moveCard(g, g.cards[id], 'library', true);
      break;
    }
    case 'discountPunish':
      if (ctx.ev?.type === 'cast') {
        const c = g.cards[ctx.ev.card];
        if ((c.manaSpent ?? manaValue(c.def)) < manaValue(c.def))
          yield* runEffects(g, { ...ctx, targets: [{ p: ctx.ev.player }] }, [{ e: 'damage', n: 3, to: 'T0' }]);
      }
      break;
    case 'ooze':
      for (let i = 0; i < (evCard?.countersBeforeLeaving ?? 0); i++) createToken(g, 'tok-mutagen', me);
      break;
    case 'van': {
      if (src.crewedTurn !== g.turn) break;
      const options = (src.crewedBy ?? []).filter((id) => g.cards[id].zone === 'battlefield');
      const [id] = yield* choose(g, me, '在本回合駕駛此載具的生物上放指示物', options, 1);
      if (id !== undefined) {
        const c = g.cards[id];
        putCounters(g, c, 1);
        if (c.def.subtypes?.some((s) => ['Mutant', 'Ninja', 'Turtle'].includes(s))) putCounters(g, c, c.counters);
      }
      break;
    }
    case 'farmExile': {
      const c = card();
      if (c?.owner === me) linked(c);
      break;
    }
    case 'farmReturn': {
      const options = p.exile.filter((id) => g.cards[id].tmtLinked === src.id);
      const [id] = yield* choose(g, me, '選一個放逐生物回場，其餘回手', options, 1);
      for (const cid of options)
        if (cid === id) enterBattlefield(g, g.cards[cid], me);
        else moveCard(g, g.cards[cid], 'hand');
      break;
    }
    case 'wish':
    case 'forever': {
      const wish = ef.action === 'wish';
      const filter: Filter = wish ? {} : { type: 'Creature', legendary: true };
      const temp = allDefs()
        .filter((d) => !d.token && d.set !== 'BAS' && (wish || (d.types.includes('Creature') && d.supertypes?.includes('Legendary'))))
        .map((d) => newCard(g, d, me));
      const offeredNames = new Set<string>();
      const options = [...(wish ? [] : p.library.filter((id) => matches(g, filter, g.cards[id], me))), ...temp.map((c) => c.id)].filter(
        (id) => {
          const name = g.cards[id].def.name;
          if (offeredNames.has(name)) return false;
          offeredNames.add(name);
          return true;
        },
      );
      const chosen = yield* choose(
        g,
        me,
        wish ? '選一張局外牌' : '找四張不同名傳奇生物',
        options,
        wish ? 0 : Math.min(4, options.length),
        wish ? 1 : 4,
      );
      const ids: number[] = [];
      const names = new Set<string>();
      for (const id of chosen) {
        const name = g.cards[id].def.name;
        if (!names.has(name)) {
          ids.push(id);
          names.add(name);
        }
      }
      const hand = wish ? ids : yield* choose(g, opp, '選兩張讓對手加入手上', ids, Math.min(2, ids.length), 2);
      for (const c of temp) if (!ids.includes(c.id)) delete g.cards[c.id];
      for (const id of ids) moveCard(g, g.cards[id], hand.includes(id) ? 'hand' : 'library');
      if (!wish) shuffleArr(g, p.library);
      break;
    }
    default:
      throw new Error(`未知TMT效果：${ef.action}`);
  }
  g.version++;
}
