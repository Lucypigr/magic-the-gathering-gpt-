import { uncounterableSpells } from './state';
import { payCost } from './actions';
import { choose, freeCast } from './tla';
import { resolveRef, runEffects, type Ctx } from './effects';
import { manaValue, parseCost } from './mana';
import { hasKw, isCreature, isLand, other, shuffleArr, stats } from './state';
import type { Card, Color, Effect, GameState, PID, Ref, Response, SubFlow } from './types';
import {
  createToken,
  destroyCards,
  discard,
  drawCards,
  emit,
  enterBattlefield,
  gainLife,
  loseLife,
  moveCard,
  putCounters,
  sacrifice,
} from './zones';

export function* tmtEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, { e: 'tmt' }>): SubFlow {
  const me = ctx.controller,
    opp = other(me),
    src = g.cards[ctx.source],
    p = g.players[me];
  const card = (ref: Ref = ef.what ?? 'T0') => resolveRef(g, ctx, ref).cards[0];
  const evKinds = ctx.ev && 'counterKinds' in ctx.ev ? ctx.ev.counterKinds : undefined;
  const evCard = ctx.ev && 'card' in ctx.ev ? g.cards[ctx.ev.card] : undefined;
  const run = (effects: Effect[]) => runEffects(g, ctx, effects);
  const linkKey = ctx.sourceLinkKey ?? src.tmtLinkKey ?? src.id;
  const linked = (c: Card) => {
    moveCard(g, c, 'exile');
    c.tmtLinked = linkKey;
  };
  switch (ef.action) {
    case 'sacrificeSelf':
      if (src.zone === 'battlefield') sacrifice(g, src);
      break;
    case 'ward': {
      const item = g.stack.find((s) => s.sid === ef.n);
      if (!item) break;
      const r: Response = yield {
        type: 'yesno',
        player: item.controller,
        prompt: `支付{${ef.amount ?? 0}}守護費用？`,
      };
      if (r.type === 'yesno' && r.yes && payCost(g, item.controller, parseCost(`{${ef.amount ?? 0}}`))) break;
      const c = g.cards[item.cardId];
      if (item.kind === 'spell') {
        if (!uncounterableSpells(g,c.controller)&&!c.def.uncounterable && !item.uncounterable)
          moveCard(g, c, item.alt === 'flashback' || item.alt === 'harmonize' ? 'exile' : 'graveyard');
      } else g.stack = g.stack.filter((s) => s.sid !== item.sid);
      break;
    }
    case 'level':
      if (src.zone === 'battlefield') {
        src.classLevel = ef.n ?? 1;
        emit(g, {
          type: 'classLevel',
          card: src.id,
          controller: me,
          level: src.classLevel,
        });
      }
      break;
    case 'allianceExile': {
      const c = g.cards[src.lastAttachedTo ?? -1];
      if (c?.zone === 'battlefield') moveCard(g, c, 'exile');
      break;
    }
    case 'southLife':
      gainLife(g, me, Math.max(0, (ctx.ev?.type === 'dies' ? ctx.ev.toughness : undefined) ?? evCard?.lastToughness ?? 0));
      break;
    case 'missileLoot': {
      const [id] = yield* choose(g, me, '可將手牌置底，然後抓牌', p.hand.slice());
      if (id !== undefined) {
        moveCard(g, g.cards[id], 'library', true);
        drawCards(g, me, 1);
      }
      break;
    }
    case 'roninAlone':
      (g.delayed ??= []).push({
        source: src.id,
        controller: me,
        on: 'youAttack',
        alone: true,
        once: false,
        effects: [
          { e: 'counters', what: 'trig', n: 3 },
          {
            e: 'pump',
            what: 'trig',
            p: 0,
            t: 0,
            kw: ['trample', 'lifelink', 'indestructible'],
          },
        ],
      });
      break;
    case 'mindTransfer': {
      const c = card();
      if (c?.zone === 'battlefield') {
        c.baseDef ??= c.def;
        c.def = {
          ...c.def,
          types: [...new Set([...c.def.types, 'Artifact' as const, 'Creature' as const])],
          power: 4,
          toughness: 5,
        };
      }
      break;
    }
    case 'donLeo': {
      const cs = [...new Set(ctx.targets.flatMap((t) => (t && 'c' in t ? [t.c] : [])))]
        .map((id) => g.cards[id])
        .filter((c) => c.zone === 'battlefield');
      for (const c of cs) moveCard(g, c, 'exile');
      for (const c of cs) if (!c.token && c.zone === 'exile') enterBattlefield(g, c, c.owner);
      break;
    }
    case 'leaderLife':
      if ((evKinds ?? evCard?.lastCounterKinds) && Object.values((evKinds ?? evCard!.lastCounterKinds)!).some((n) => Number(n) > 0))
        gainLife(g, me, 2);
      break;
    case 'koya': {
      const c = card();
      if (c) {
        const key = -g.nextSid++;
        moveCard(g, c, 'exile');
        c.tmtLinked = key;
        (g.delayed ??= []).push({
          source: src.id,
          controller: me,
          on: 'eachEndStep',
          once: true,
          persistent: true,
          effects: [{ e: 'tmt', action: 'koyaReturn', n: key }],
        });
      }
      break;
    }
    case 'koyaReturn': {
      const options = g.players.flatMap((q) => q.exile).filter((id) => g.cards[id].tmtLinked === ef.n);
      if (options.length)
        yield* run([
          {
            e: 'costThen',
            prompt: '支付{3}{B}使放逐持續？',
            cost: { mana: '{3}{B}' },
            then: [{ e: 'tmt', action: 'koyaKeep', n: ef.n }],
          },
        ]);
      for (const id of options) {
        const c = g.cards[id];
        if (c.tmtLinked === ef.n) enterBattlefield(g, c, c.owner);
      }
      break;
    }
    case 'koyaKeep':
      for (const pl of g.players) for (const id of pl.exile) if (g.cards[id].tmtLinked === ef.n) g.cards[id].tmtLinked = undefined;
      break;
    case 'aprilDraw':
      drawCards(g,me,p.spellTypesThisTurn?.length??0);
      break;
    case 'robot': {
      const c = card();
      if (c && c.zone === 'battlefield') {
        putCounters(g, c, ef.n ?? 3);
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
      }
      break;
    }
    case 'inheritArtifact': {
      const c = card(),
        kinds = evKinds ?? evCard?.lastCounterKinds;
      if (c && kinds) {
        putCounters(g, c, kinds.plus);
        c.charge = (c.charge ?? 0) + kinds.charge;
        c.stun += kinds.stun;
        c.hexproofCounters = (c.hexproofCounters ?? 0) + kinds.hexproof;
        if (kinds.finality) c.finality = true;
        if (kinds.lore) c.lore = (c.lore ?? 0) + kinds.lore;
      }
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
        for (const c of [a, b]) {
          c.sick = true;
          c.attacking = false;
          c.blocking = null;
          c.blockedBy = [];
          for (const id of g.battlefield) {
            const x = g.cards[id];
            x.blockedBy = x.blockedBy.filter((id) => id !== c.id);
            if (x.blocking === c.id) x.blocking = null;
          }
        }
      }
      break;
    }
    case 'halfMill':
      yield* run([
        {
          e: 'mill',
          who: 'opp',
          n: Math.ceil(g.players[opp].library.length / 2),
        },
      ]);
      break;
    case 'refillFour':
      drawCards(g, me, Math.max(0, 4 - p.hand.length));
      break;
    case 'mondo': {
      const colors = ['W', 'U', 'B', 'R', 'G'] as const;
      const r: Response = yield {
        type: 'mode',
        player: me,
        prompt: '選擇顏色',
        options: [...colors],
        count: 1,
        purpose: 'color',
      };
      const color: Color = colors[r.type === 'modes' ? (r.picks[0] ?? 0) : 0] ?? 'W';
      src.baseDef ??= src.def;
      src.def = { ...src.def, colors: [color] };
      (src.colorProtections ??= []).push({ color, turn: g.turn });
      break;
    }
    case 'cam': {
      const c = card();
      if (c) {
        const r: Response = yield {
          type: 'yesno',
          player: me,
          prompt: '橫置此生物？（否則重置）',
        };
        yield* run([{ e: r.type === 'yesno' && r.yes ? 'tap' : 'untap', what: 'T0' }]);
      }
      break;
    }
    case 'resetHands': {
      const chosen: PID[] = [];
      for (const pid of [g.active, other(g.active)]) {
        const r: Response = yield {
          type: 'yesno',
          player: pid,
          prompt: '將手牌與墳墓場洗回並抓七張？',
        };
        if (r.type === 'yesno' && r.yes) chosen.push(pid);
      }
      for (const pid of chosen) {
        const q = g.players[pid];
        for (const id of [...q.hand, ...q.graveyard]) moveCard(g, g.cards[id], 'library');
        shuffleArr(g, q.library);
      }
      for (const pid of chosen) drawCards(g, pid, 7);
      break;
    }
    case 'cloneExile': {
      const c = card();
      if (c) {
        linked(c);
        yield* run([{ e: 'copyCreature', what: 'T0', nonLegendary: true, sub: 'Mutant' }]);
      }
      break;
    }
    case 'cloneAgain': {
      const options = p.exile.filter((id) => g.cards[id].tmtLinked === linkKey);
      const [id] = yield* choose(g, me, '複製以此傳紀放逐的生物', options, 1);
      if (id !== undefined)
        yield* runEffects(g, { ...ctx, targets: [{ c: id }] }, [{ e: 'copyCreature', what: 'T0', nonLegendary: true, sub: 'Mutant' }]);
      break;
    }
    case 'null': {
      const c = evCard;
      if (c && c.zone === 'battlefield') {
        const n = Math.max(0, stats(g, c).p);
        const r: Response = yield {
          type: 'yesno',
          player: me,
          prompt: `支付${n}生命，放${n}個指示物？`,
        };
        if (r.type === 'yesno' && r.yes && p.life >= n) {
          loseLife(g, me, n);
          putCounters(g, c, n);
        }
      }
      break;
    }
    case 'returnOnDeath': {
      const c = card();
      if (c) {
        const abilities = c.temporaryAbilities?.turn === g.turn ? c.temporaryAbilities.abilities : [];
        c.temporaryAbilities = {
          turn: g.turn,
          abilities: [
            ...abilities,
            {
              kind: 'trigger',
              on: 'dies',
              effects: [{ e: 'reanimate', what: 'selfAny', owner: true, tapped: true }],
            },
          ],
        };
      }
      break;
    }
    case 'paramecia': {
      const r: Response = yield {
        type: 'yesno',
        player: me,
        prompt: '放逐此牌將生物牌放牌庫頂？',
      };
      if (r.type === 'yesno' && r.yes && src.zone === 'graveyard') {
        moveCard(g, src, 'exile');
        yield* run([
          {
            e: 'reflexive',
            targets: [{ kind: 'gyCard', filter: { ctrl: 'you', type: 'Creature' } }],
            effects: [{ e: 'tmt', action: 'parameciaTop' }],
          },
        ]);
      }
      break;
    }
    case 'parameciaTop': {
      const c = card();
      if (c?.zone === 'graveyard') moveCard(g, c, 'library');
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
    case 'tainted': {
      const c = card();
      if (c) {
        const small = manaValue(c.def) <= 4;
        destroyCards(g, [c]);
        if (small) createToken(g, 'tok-food', me);
      }
      break;
    }
    case 'shredderDestroy': {
      const c = card();
      if (c) {
        const ench = c.def.types.includes('Enchantment') && !hasKw(g, c, 'indestructible');
        destroyCards(g, [c]);
        if (ench) loseLife(g, me, 2);
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
      (g.delayed ??= []).push({
        source: t.id,
        controller: me,
        on: 'eachEndStep',
        once: true,
        effects: [{ e: 'destroy', what: 'self' }],
      });
      break;
    }
    case 'raphExile':
      if (p.library.length) linked(g.cards[p.library[0]]);
      break;
    case 'raphPlay': {
      const key = g.nextSid++;
      for (const id of p.exile)
        if (g.cards[id].tmtLinked === linkKey) {
          const c = g.cards[id];
          c.playableBy = me;
          c.playableTurn = g.turn;
          (c.raphaelPermissions ??= []).push({ source: key, turn: g.turn });
        }
      break;
    }
    case 'keepRed':
      if (ctx.ev?.type === 'damaged') (p.retainedRed ??= []).push(...Array(ctx.ev.amount).fill('R'));
      break;
    case 'courier': {
      const r: Response = yield {
        type: 'yesno',
        player: me,
        prompt: '搜尋牌庫中的食物牌？',
      };
      let found = false;
      if (r.type === 'yesno' && r.yes) {
        const [id] = yield* choose(
          g,
          me,
          '可展示一張食物牌放手上',
          p.library.filter((id) => g.cards[id].def.subtypes?.includes('Food')),
        );
        if (id !== undefined) {
          moveCard(g, g.cards[id], 'hand');
          found = true;
        }
        shuffleArr(g, p.library);
        emit(g, { type: 'search', player: me });
      }
      if (!found) createToken(g, 'tok-food', me);
      break;
    }
    case 'leatherhead': {
      if (src.zone !== 'battlefield') break;
      const kinds = [
        ...(src.counters > 0 ? ['+1/+1'] : []),
        ...(src.hexproofCounters ? ['辟邪'] : []),
        ...(src.stun ? ['暈眩'] : []),
        ...(src.charge ? ['充能'] : []),
        ...(src.finality ? ['終結'] : []),
      ];
      if (!kinds.length) break;
      const r: Response = yield {
        type: 'mode',
        player: me,
        prompt: '選擇移除的指示物，或略過',
        options: [...kinds, '略過'],
        count: 1,
        purpose: 'trigger',
      };
      const kind = kinds[r.type === 'modes' ? r.picks[0] : kinds.length];
      if (!kind) break;
      if (kind === '+1/+1') src.counters--;
      if (kind === '辟邪') src.hexproofCounters!--;
      if (kind === '暈眩') src.stun--;
      if (kind === '充能') src.charge!--;
      if (kind === '終結') src.finality = false;
      yield* run([
        {
          e: 'reflexive',
          targets: [
            {
              kind: 'permanent',
              filter: { ctrl: 'opp', type: ['Artifact', 'Enchantment'] },
            },
          ],
          effects: [{ e: 'destroy', what: 'T0' }],
        },
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
      let total = 0;
      const put: number[] = [];
      for (let i = 0; i < 2; i++) {
        const [id] = yield* choose(
          g,
          me,
          '選擇生物，總法術力值至多6',
          options.filter((id) => !put.includes(id) && manaValue(g.cards[id].def) <= 6 - total),
        );
        if (id === undefined) break;
        total += manaValue(g.cards[id].def);
        put.push(id);
      }
      // Both choices are made before either creature enters.
      for (const id of put) enterBattlefield(g, g.cards[id], me);
      const rest = top.filter((id) => !put.includes(id));
      shuffleArr(g, rest);
      for (const id of rest) moveCard(g, g.cards[id], 'library', true);
      break;
    }
    case 'nunchaku': {
      const host = g.cards[src.attachedTo ?? -1],
        opponent = card();
      if (host?.zone === 'battlefield' && opponent?.zone === 'battlefield')
        yield* runEffects(g, { ...ctx, targets: [{ c: host.id }, { c: opponent.id }] }, [{ e: 'fight', a: 'T0', b: 'T1' }]);
      break;
    }
    case 'bebop': {
      const [id] = yield* choose(g, me, '棄一張牌，否則犧牲永久物', p.hand.slice());
      if (id !== undefined) discard(g, g.cards[id]);
      else {
        const [victim] = yield* choose(
          g,
          me,
          '犧牲一個永久物',
          g.battlefield.filter((id) => g.cards[id].controller === me),
          1,
        );
        if (victim !== undefined) sacrifice(g, g.cards[victim]);
      }
      break;
    }
    case 'brilliance': {
      const c = card();
      if (c) {
        const def = isCreature(c)
          ? undefined
          : {
              ...c.def,
              types: [...c.def.types, 'Creature' as const],
              subtypes: [...(c.def.subtypes ?? []), 'Robot'],
              power: 3,
              toughness: 3,
              keywords: [...(c.def.keywords ?? []), 'flying' as const],
            };
        enterBattlefield(g, c, me, false, def);
      }
      break;
    }
    case 'darkLeo':
      if (g.battlefield.filter((id) => g.cards[id].controller === me && g.cards[id].def.subtypes?.includes('Ninja')).length >= 5)
        loseLife(g, opp, Math.ceil(g.players[opp].life / 2));
      break;
    case 'nextAffinity':
      p.nextAffinity = (p.nextAffinity ?? 0) + 1;
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
      const options = g.players.flatMap((p) => p.exile).filter((id) => g.cards[id].tmtLinked === linkKey && !isLand(g.cards[id]));
      const [id] = yield* choose(g, me, '免費施放放逐的牌', options);
      if (id !== undefined) yield* freeCast(g, ctx, g.cards[id]);
      break;
    }
    case 'neutrinos': {
      const c = card();
      if (c?.zone === 'battlefield') {
        moveCard(g, c, 'exile');
        if (!c.token) {
          enterBattlefield(g, c, me, true);
          c.attacking = true;
        }
      }
      break;
    }
    case 'sibling':
      for (const c of ctx.targets.flatMap((t) => (t && 'c' in t ? [g.cards[t.c]] : [])))
        if (c.zone === 'battlefield') {
          if (c.stun) c.stun--;
          else c.tapped = false;
        }
      g.extraCombat = {
        player: me,
        landOnly: false,
        count: (g.extraCombat?.count ?? (g.extraCombat ? 1 : 0)) + 1,
      };
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
        const stackX = g.stack.find((s) => s.kind === 'spell' && s.cardId === c.id)?.x ?? 0;
        const mv = manaValue(c.def) + (c.def.cost?.match(/\{X\}/g)?.length ?? 0) * stackX;
        if ((c.manaSpent ?? mv) < mv) yield* runEffects(g, { ...ctx, targets: [{ p: ctx.ev.player }] }, [{ e: 'damage', n: 3, to: 'T0' }]);
      }
      break;
    case 'ooze':
      for (let i = 0; i < (evKinds?.plus ?? evCard?.countersBeforeLeaving ?? 0); i++) createToken(g, 'tok-mutagen', me);
      break;
    case 'van': {
      const c = card();
      if (c?.zone === 'battlefield') {
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
      const options = p.exile.filter((id) => g.cards[id].tmtLinked === linkKey);
      const [id] = yield* choose(g, me, '選一個放逐生物回場，其餘回手', options, 1);
      for (const cid of options)
        if (cid === id) enterBattlefield(g, g.cards[cid], me);
        else moveCard(g, g.cards[cid], 'hand');
      break;
    }
    case 'wish':
    case 'forever': {
      const wish = ef.action === 'wish';
      const options = [...(wish ? [] : p.library), ...p.outside].filter(
        (id) => wish || (isCreature(g.cards[id]) && g.cards[id].def.supertypes?.includes('Legendary')),
      );
      if (!wish && new Set(options.map((id) => g.cards[id].def.name)).size < 4) break;
      const chosen: number[] = [];
      for (let i = 0; i < (wish ? 1 : 4); i++) {
        const candidates = options.filter((id) => !chosen.some((cid) => g.cards[cid].def.name === g.cards[id].def.name));
        const [id] = yield* choose(g, me, wish ? '選一張你持有的局外牌' : `選第${i + 1}張不同名傳奇生物`, candidates, wish ? 0 : 1, 1);
        if (id !== undefined) chosen.push(id);
      }
      const hand = wish ? chosen : yield* choose(g, opp, '選兩張讓對手加入手上', chosen, 2, 2);
      for (const id of chosen) moveCard(g, g.cards[id], hand.includes(id) ? 'hand' : 'library');
      if (!wish) shuffleArr(g, p.library);
      break;
    }
    default:
      throw new Error(`未知TMT效果：${ef.action}`);
  }
  g.version++;
}
