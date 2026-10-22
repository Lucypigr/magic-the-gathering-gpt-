import { canPayCost, castDuringResolution, castTargetSpecs, payCost, spellEffects } from './actions';
import { choose, freeCast } from './tla';
import { makeEclTokenBatch } from './ecl';
import { FIN_SEA, finStatic, permanent } from './fin-support';
import { resolveRef, runEffects, type Ctx } from './effects';
import { manaValue, parseCost } from './mana';
import { GameOver, isCreature, isLand, matches, newCard, other, randInt, shuffleArr, stats, uncounterableSpells } from './state';
import { validateTargets } from './targets';
import {
  addLore,
  dealDamage,
  discard,
  drawCards,
  emit,
  enterBattlefield,
  enterBattlefieldBack,
  gainLife,
  loseLife,
  moveCard,
  putCounters,
  putIntoGraveyard,
  sacrifice,
  tapCard,
  transformCard,
} from './zones';
import type { Card, CardDef, Color, Effect, Filter, GameState, PID, Ref, Response, SubFlow, TargetRef } from './types';
const E = (action: string, n?: number, what?: Ref): Effect => ({ e: 'fin', action, n, what });
const token = (name: string, n = 1): Effect => ({ e: 'token', token: 'tok-fin-' + name, n });
const own = (g: GameState, pid: PID, filter: Filter = {}) =>
  g.battlefield.filter((id) => g.cards[id].controller === pid && matches(g, filter, g.cards[id], pid));
function change(c: Card, patch: Partial<CardDef>, temporary = false) {
  if (temporary) c.baseDef ??= c.def;
  else c.tlaOriginalDef ??= c.def;
  c.def = { ...c.def, ...patch };
}
const copiable = (c: Card) => c.baseDef ?? c.tlaOriginalDef ?? c.auraBaseDef ?? c.def;
function* yes(g: GameState, pid: PID, prompt: string): SubFlow<boolean> {
  const r: Response = yield { type: 'yesno', player: pid, prompt };
  return r.type === 'yesno' && r.yes;
}
function delay(
  g: GameState,
  source: number,
  pid: PID,
  effects: Effect[],
  on: 'eachEndStep' | 'upkeep' | 'dies' = 'eachEndStep',
  until?: PID,
) {
  (g.delayed ??= []).push({ source, controller: pid, on, effects, once: true, persistent: on === 'eachEndStep', until });
}
function* chooseMana(g: GameState, pid: PID, n: number, colors: Color[] = ['W', 'U', 'B', 'R', 'G']): SubFlow<Color[]> {
  const out: Color[] = [];
  for (let i = 0; i < n; i++) {
    const r: Response = yield { type: 'mode', player: pid, prompt: '選擇加入法力的顏色', options: colors, count: 1, purpose: 'color' };
    out.push(colors[r.type === 'modes' ? (r.picks[0] ?? 0) : 0] ?? colors[0]);
  }
  return out;
}
function control(g: GameState, c: Card, pid: PID) {
  const before = c.controller;
  if (before === pid) return;
  c.controller = pid;
  c.sick = true;
  c.attacking = false;
  c.blocking = null;
  emit(g, { type: 'fin', action: 'controlChange', card: c.id, player: pid, amount: before });
}
export function* finEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, { e: 'fin' }>): SubFlow {
  const me = ctx.controller,
    opp = other(me),
    p = g.players[me],
    src = g.cards[ctx.source];
  if (!src) return;
  const card = (ref: Ref = ef.what ?? 'T0') => resolveRef(g, ctx, ref).cards[0];
  const run = (effects: Effect[]) => runEffects(g, ctx, effects);
  const opts = (filter: Filter = {}) => own(g, me, filter);
  const gy = (filter: Filter = {}) => p.graveyard.filter((id) => matches(g, filter, g.cards[id], me, src.id));
  const make = (name: string, n = 1) => run([token(name, n)]);
  const setMarker = (name: string, n: number) => {
    (src.finMarks ??= {})[name] = n;
  };
  const impulse = (c: Card, mode = 'nextEnd', free = false, source?: number) => {
    c.eclCast = { by: me, mode, free, source, until: mode === 'nextEnd' ? g.turn + 1 : undefined };
  };
  const attach = (eq: Card | undefined, c: Card | undefined) => {
    if (eq?.zone === 'battlefield' && eq.def.equip && c?.zone === 'battlefield' && isCreature(c)) eq.attachedTo = c.id;
  };
  const linked = (c: Card) => {
    moveCard(g, c, 'exile');
    (src.finLinked ??= []).push(c.id);
  };
  const copyToken = (c: Card, patch: Partial<CardDef> = {}, tapped = false) =>
    makeEclTokenBatch(g, me, { ...copiable(c), ...patch }, 1, { tapped });
  const fromGy = src.castOrigin === 'graveyard';
  switch (ef.action) {
    case 'vincentCounters':
      if (ctx.ev?.type === 'dies') putCounters(g, src, Math.max(0, ctx.ev.power));
      break;
    case 'torgalEnter':
      if (ctx.ev?.type === 'cast') {
        const c = g.cards[ctx.ev.card];
        (c.finMarks ??= {}).enterCounters = (c.finMarks?.enterCounters ?? 0) + opts({ sub: ['Dog', 'Wolf'] }).length;
      }
      break;
    case 'jobSelect': {
      yield* make('hero');
      attach(src, g.cards[ctx.created ?? -1]);
      break;
    }
    case 'sacSelf':
      if (src.zone === 'battlefield') sacrifice(g, src);
      break;
    case 'exileBack': {
      const pid = src.zone === 'battlefield' ? src.controller : src.owner;
      moveCard(g, src, 'exile');
      enterBattlefieldBack(g, src, pid);
      break;
    }
    case 'returnFront':
    case 'returnFrontTapped': {
      if (ef.action === 'returnFrontTapped' && src.zone !== 'graveyard') break;
      moveCard(g, src, 'exile');
      enterBattlefield(g, src, src.owner, ef.action === 'returnFrontTapped');
      break;
    }
    case 'blightLand': {
      const c = card();
      if (c) {
        (c.eclCounters ??= {}).blight = (c.eclCounters?.blight ?? 0) + 1;
        (c.finMarks ??= {}).blightedLand = 1;
        change(c, { subtypes: [], produces: ['C'], abilities: [] });
        emit(g, { type: 'counterPlaced', card: c.id, controller: c.controller, amount: 1, counterKind: 'blight' });
      }
      break;
    }
    case 'rescue': {
      const targets = ctx.targets.flatMap((t) => (t && 'c' in t ? [t.c] : []));
      for (const id of targets) tapCard(g, g.cards[id]);
      const [id] = yield* choose(g, me, '選擇其中一個放暈眩指示物', targets, targets.length ? 1 : 0);
      if (id !== undefined) g.cards[id].stun++;
      break;
    }
    case 'ambrosia': {
      const [id] = yield* choose(
        g,
        me,
        '可將另一個自己的永久物回手',
        opts().filter((id) => id !== src.id),
      );
      if (id !== undefined) moveCard(g, g.cards[id], 'hand');
      break;
    }
    case 'delivery': {
      const [id] = yield* choose(
        g,
        me,
        '可從牌庫或墳墓場取費用2以下神器',
        [...p.library, ...p.graveyard].filter((id) => matches(g, { type: 'Artifact', mvMax: 2 }, g.cards[id], me)),
      );
      if (id !== undefined) {
        const searched = g.cards[id].zone === 'library';
        moveCard(g, g.cards[id], 'hand');
        if (searched) {
          shuffleArr(g, p.library);
          emit(g, { type: 'search', player: me });
        }
      }
      break;
    }
    case 'father': {
      const [id] = yield* choose(
        g,
        me,
        '可搜尋載具',
        p.library.filter((id) => matches(g, { sub: 'Vehicle' }, g.cards[id], me)),
      );
      if (id !== undefined) {
        if (fromGy) enterBattlefield(g, g.cards[id], me);
        else moveCard(g, g.cards[id], 'hand');
      }
      shuffleArr(g, p.library);
      emit(g, { type: 'search', player: me });
      break;
    }
    case 'tapTutoredInfantry':
    case 'tapLastLand': {
      const id = g.battlefield.at(-1);
      if (id !== undefined) tapCard(g, g.cards[id]);
      break;
    }
    case 'phoenixDownReanimate': {
      const c = card();
      if (c) {
        enterBattlefield(g, c, me, true);
      }
      break;
    }
    case 'catchFish': {
      const c = g.cards[p.library[0]];
      if (c && (c.def.types.includes('Artifact') || isCreature(c)) && (yield* yes(g, me, '揭示頂牌取到手上，派食物並轉化？'))) {
        moveCard(g, c, 'hand');
        yield* run([{ e: 'token', token: 'tok-food' }]);
        transformCard(g, src);
      }
      break;
    }
    case 'donate': {
      const c = card('T1'),
        pid = resolveRef(g, ctx, 'T0').players[0];
      if (c && pid !== undefined) {
        control(g, c, pid);
        drawCards(g, me, 1);
      }
      break;
    }
    case 'indestructibleCounters':
      for (const id of opts({ type: 'Creature' }).filter((id) => id !== src.id)) {
        const c = g.cards[id];
        (c.eclCounters ??= {}).indestructible = ((c.eclCounters ?? {}).indestructible ?? 0) + 1;
        emit(g, { type: 'counterPlaced', card: id, controller: me, amount: 1 });
      }
      break;
    case 'creatureFog':
      (p.finFlags ??= {}).creatureFog = g.turn;
      break;
    case 'endTurn':
      g.finEndTurn = true;
      g.stack = [];
      for (const c of Object.values(g.cards)) if (c.zone === 'stack') moveCard(g, c, 'exile');
      g.pending = [];
      for (const id of g.battlefield) {
        const c = g.cards[id];
        c.attacking = false;
        c.blocking = null;
        c.blockedBy = [];
      }
      break;
    case 'attachPair':
      attach(card('T0'), card('T1'));
      break;
    case 'zackTransfer': {
      const c = card();
      if (c) {
        for (const [kind, n] of Object.entries(src.lastCounterKinds ?? {})) {
          if (kind === 'plus' && typeof n === 'number' && n > 0) putCounters(g, c, n);
          else if (kind === 'stun') c.stun += Number(n);
          else if (kind === 'charge') c.charge = (c.charge ?? 0) + Number(n);
          else if (kind === 'hexproof') c.hexproofCounters = (c.hexproofCounters ?? 0) + Number(n);
        }
        const ids = Object.values(g.cards)
          .filter((eq) => eq.lastAttachedTo === src.id && eq.zone === 'battlefield' && eq.def.equip)
          .map((eq) => eq.id);
        const [id] = yield* choose(g, me, '可將原本的一個武具裝上', ids);
        if (id !== undefined) attach(g.cards[id], c);
      }
      break;
    }
    case 'nextCopy':
      (g.delayed ??= []).push({
        source: src.id,
        controller: me,
        on: 'castInstSorc',
        once: true,
        effects: Array.from({ length: ef.n ?? 1 }, () => ({ e: 'copySpell' })),
      });
      break;
    case 'copyAbility': {
      const item = g.stack.find((s) => s.sid === ef.n && s.controller === me && (s.kind === 'activated' || s.kind === 'trigger'));
      if (!item || item.effects.some((e) => e.e === 'fin' && e.action === 'copyAbility')) break;
      for (let i = 0; i < (ctx.x ?? 0); i++) {
        let targets = item.targets.slice();
        if (item.targetSpecs.length) {
          const r: Response = yield {
            type: 'targets',
            player: me,
            source: item.cardId,
            specs: item.targetSpecs,
            text: item.text,
            effects: item.effects,
          };
          if (r.type === 'targets' && !validateTargets(g, item.targetSpecs, r.targets, me, item.cardId)) targets = r.targets;
        }
        g.stack.push({
          ...item,
          sid: g.nextSid++,
          targets,
          targetVersions: targets.map((t) => (t && 'c' in t ? (g.cards[t.c]?.objectVersion ?? 0) : undefined)),
        });
      }
      break;
    }
    case 'shuffleTarget': {
      const c = card();
      if (c) {
        moveCard(g, c, 'library');
        shuffleArr(g, g.players[c.owner].library);
      }
      break;
    }
    case 'counterStack': {
      const item = g.stack.find((s) => s.sid === ef.n);
      if (item) {
        if (item.kind === 'spell') {
          const c = g.cards[item.cardId];
          if (!c.def.uncounterable && !item.uncounterable && !uncounterableSpells(g, item.controller))
            moveCard(g, c, item.alt === 'flashback' ? 'exile' : 'graveyard');
        } else g.stack = g.stack.filter((s) => s.sid !== item.sid);
      }
      break;
    }
    case 'memories': {
      const ids = p.library.slice(0, 5);
      for (let i = 0; ids.length; i++) {
        const pid = i % 2 === 0 ? me : opp;
        const [id] = yield* choose(g, pid, i % 2 === 0 ? '選一張放手上' : '選一張放牌庫底', ids, 1);
        if (id === undefined) break;
        ids.splice(ids.indexOf(id), 1);
        moveCard(g, g.cards[id], i % 2 === 0 ? 'hand' : 'library', i % 2 !== 0);
      }
      break;
    }
    case 'quistis':
    case 'seifer': {
      const c = card();
      if (c && (yield* yes(g, me, '可施放這張墳墓場咒語？'))) {
        c.finExileOnResolve = true;
        let cast = false;
        if (ef.action === 'quistis') {
          (c.finMarks ??= {}).anyMana = 1;
          cast = yield* castSelected(g, ctx, c, false);
          if (c.finMarks) delete c.finMarks.anyMana;
        } else cast = yield* freeCast(g, ctx, c);
        if (!cast) c.finExileOnResolve = undefined;
      }
      break;
    }
    case 'stolenUniform': {
      const c = card('T0'),
        eq = card('T1');
      if (c && eq) {
        eq.returnControl = { player: eq.controller, turn: g.turn };
        control(g, eq, me);
        attach(eq, c);
        (eq.finMarks ??= {}).uniformTurn = g.turn;
      }
      break;
    }
    case 'leviathanBounce':
      for (const id of g.battlefield.slice()) {
        const c = g.cards[id];
        if (isCreature(c) && !FIN_SEA.some((sub) => matches(g, { sub }, c, me))) moveCard(g, c, 'hand');
      }
      break;
    case 'seaDraw': {
      (g.delayed ??= []).push({
        source: src.id,
        controller: me,
        on: 'finEvent',
        effects: [{ e: 'draw', n: 1 }],
        once: false,
        finEvent: 'seaAttack',
      } as import('./types').DelayedTrigger);
      break;
    }
    case 'swallowed':
    case 'syncopate': {
      const c = card(),
        item = c ? g.stack.find((s) => s.kind === 'spell' && s.cardId === c.id) : undefined;
      if (!c || !item) break;
      const n = ef.action === 'syncopate' ? (ctx.x ?? 0) : p.graveyard.length;
      const paid =
        canPayCost(g, item.controller, parseCost(`{${n}}`)) &&
        (yield* yes(g, item.controller, `支付{${n}}以免被反擊？`)) &&
        payCost(g, item.controller, parseCost(`{${n}}`));
      if (!paid && !c.def.uncounterable && !item.uncounterable && !uncounterableSpells(g, item.controller))
        moveCard(g, c, ef.action === 'syncopate' || item.alt === 'flashback' ? 'exile' : 'graveyard');
      break;
    }
    case 'extraEnd':
      if ((g.finEndNumber ?? 1) === 1) g.finExtraEnd = true;
      break;
    case 'ardyn': {
      const c = card();
      if (c?.zone === 'graveyard') {
        linked(c);
        yield* copyToken(c, { power: 5, toughness: 5, colors: ['B'], subtypes: ['Demon'] });
      }
      break;
    }
    case 'cecil': {
      const n = ctx.ev && 'amount' in ctx.ev ? ctx.ev.amount : 0;
      loseLife(g, me, n);
      if (p.life <= 10) {
        src.tapped = false;
        transformCard(g, src);
      }
      break;
    }
    case 'darknessReturn': {
      const ids = (src.finLinked ?? []).filter((id) => g.cards[id]?.zone === 'exile' && isCreature(g.cards[id]));
      const [id] = yield* choose(g, me, '選擇此水晶放逐的生物', ids, 1);
      if (id !== undefined) {
        enterBattlefield(g, g.cards[id], me, true);
        putCounters(g, g.cards[id], 2);
      }
      break;
    }
    case 'finalDays':
      yield* run([{ e: 'token', token: 'tok-fin-horror', n: fromGy ? gy({ type: 'Creature' }).length : 2, tapped: true }]);
      break;
    case 'edictEachToken':
    case 'edictEachNontoken':
    case 'edictEachEnchantment':
      for (const pid of [g.active, other(g.active)]) {
        const filter: Filter =
          ef.action === 'edictEachEnchantment' ? { type: 'Enchantment' } : { type: 'Creature', token: ef.action === 'edictEachToken' };
        const ids = own(g, pid, filter);
        const [id] = yield* choose(g, pid, '選擇犧牲的永久物', ids, ids.length ? 1 : 0);
        if (id !== undefined) sacrifice(g, g.cards[id]);
      }
      break;
    case 'jecht':
      if (yield* yes(g, me, '放逐Jecht並轉化進場？')) {
        moveCard(g, src, 'exile');
        enterBattlefieldBack(g, src, me);
      }
      break;
    case 'kain': {
      if (ctx.ev?.type !== 'combatDamage') break;
      const n = ctx.ev.amount;
      control(g, src, ctx.ev.player);
      drawCards(g, me, n);
      yield* run([{ e: 'token', token: 'tok-treasure', n, tapped: true }]);
      loseLife(g, me, n);
      break;
    }
    case 'exileOpponentTop':
      for (let i = 0; i < (ef.n ?? 1) && g.players[opp].library.length; i++) moveCard(g, g.cards[g.players[opp].library[0]], 'exile');
      break;
    case 'ninjaLoot': {
      drawCards(g, me, 1);
      const [id] = yield* choose(g, me, '棄一牌，該玩家失去其法力值生命', p.hand.slice(), 1);
      if (id !== undefined) {
        const n = manaValue(g.cards[id].def);
        discard(g, g.cards[id]);
        const pid = ctx.ev?.type === 'combatDamage' ? ctx.ev.player : opp;
        loseLife(g, pid, n);
      }
      break;
    }
    case 'spiritUntilEnd':
      change(src, { subtypes: [...(src.def.subtypes ?? []), 'Spirit'] }, true);
      break;
    case 'qutrubExile': {
      const cards = ctx.targets.flatMap((t) => (t && 'c' in t ? [g.cards[t.c]] : []));
      if (new Set(cards.map((c) => c.owner)).size <= 1) for (const c of cards) if (c.zone === 'graveyard') moveCard(g, c, 'exile');
      break;
    }
    case 'reno': {
      const pid = ctx.ev?.type === 'combatDamage' ? ctx.ev.player : opp,
        c = g.cards[g.players[pid].library[0]];
      if (!c) break;
      moveCard(g, c, 'exile');
      const [id] = yield* choose(
        g,
        me,
        '可犧牲另一生物或神器以使用放逐牌',
        opts({ type: ['Creature', 'Artifact'] }).filter((id) => id !== src.id),
      );
      if (id !== undefined) {
        sacrifice(g, g.cards[id]);
        c.eclCast = { by: me, until: g.turn, mode: 'finAnyMana' };
      }
      break;
    }
    case 'sephirothCount': {
      const turn = src.finMarks?.sephTurn === g.turn,
        n = turn ? (src.finMarks?.sephCount ?? 0) + 1 : 1;
      setMarker('sephTurn', g.turn);
      setMarker('sephCount', n);
      if (n === 4 && src.zone === 'battlefield') transformCard(g, src);
      break;
    }
    case 'sephirothEmblem': {
      const def: CardDef = {
        id: 'fin-sephiroth-emblem',
        name: 'Sephiroth Emblem',
        set: 'TOK',
        rarity: 'T',
        cost: '',
        types: ['Emblem'],
        text: 'Whenever a creature dies, target opponent loses 1 life and you gain 1 life.',
        abilities: [
          eventAbility(
            'anyCreatureDies',
            [
              { e: 'lose', who: 'T0', n: 1 },
              { e: 'gain', n: 1 },
            ],
            [{ kind: 'opponent' }],
          ),
        ],
      };
      const c = newCard(g, def, me, true);
      c.zone = 'exile';
      enterBattlefield(g, c, me);
      break;
    }
    case 'sephirothSac': {
      const ids = yield* choose(
        g,
        me,
        '可犧牲任意數量其他生物',
        opts({ type: 'Creature' }).filter((id) => id !== src.id),
        0,
        opts({ type: 'Creature' }).length,
      );
      for (const id of ids) emit(g, { type: 'sacrifice', card: id, player: me });
      putIntoGraveyard(
        g,
        ids.map((id) => g.cards[id]),
      );
      drawCards(g, me, ids.length);
      break;
    }
    case 'odinGrant':
      src.permanentGrants ??= [];
      src.copiedAbilities = [
        ...(src.copiedAbilities ?? []),
        { kind: 'trigger', on: 'combatDamagePlayer', effects: [E('opponentLoseGame')] },
      ];
      break;
    case 'opponentLoseGame':
      g.winner = me;
      throw new GameOver();
    case 'stunSelf':
      src.stun++;
      break;
    case 'vincentReturn': {
      const c = card();
      if (c) delay(g, c.id, me, [E('returnFrontTapped')], 'dies');
      break;
    }
    case 'zenos': {
      const ids = own(g, opp, { type: 'Creature' });
      const [id] = yield* choose(g, me, '選擇對手生物（不指定目標）', ids, ids.length ? 1 : 0);
      if (id !== undefined) setMarker('chosen', id);
      for (const cid of g.battlefield)
        if (cid !== src.id && cid !== id && isCreature(g.cards[cid])) g.eot.push({ card: cid, p: -2, t: -2, kw: [] });
      break;
    }
    case 'zodiark': {
      const victims: Card[] = [];
      for (const pid of [g.active, other(g.active)]) {
        const ids = own(g, pid, { type: 'Creature', nonSub: 'God' });
        const n = Math.floor(ids.length / 2);
        const chosen = yield* choose(g, pid, '犧牲一半非神生物', ids, n, n);
        for (const id of chosen) {
          emit(g, { type: 'sacrifice', card: id, player: pid });
          victims.push(g.cards[id]);
        }
      }
      putIntoGraveyard(g, victims);
      break;
    }
    case 'cliveWheel':
      if (yield* yes(g, me, '棄手牌並依紅色獻力抓牌？')) {
        const n = g.battlefield
          .filter((id) => g.cards[id].controller === me)
          .reduce((n, id) => n + (g.cards[id].def.cost?.match(/\{(?:R|[WUBG]\/R|R\/[WUBG])\}/g)?.length ?? 0), 0);
        for (const id of p.hand.slice()) discard(g, g.cards[id]);
        drawCards(g, me, n);
      }
      break;
    case 'ifritReturn':
      if ((src.lore ?? 0) >= 3) {
        moveCard(g, src, 'exile');
        enterBattlefield(g, src, src.owner);
      }
      break;
    case 'firionCopy': {
      const c = ctx.ev?.type === 'etb' ? g.cards[ctx.ev.card] : undefined;
      if (c) {
        const [cp] = yield* copyToken(c);
        if (cp) {
          cp.finCopyEquipDiscount = true;
          delay(g, cp.id, me, [E('sacSelf')], 'upkeep');
        }
      }
      break;
    }
    case 'gilgamesh': {
      const top = p.library.slice(0, 6),
        ids = yield* choose(
          g,
          me,
          '可放任意數量武具進場',
          top.filter((id) => matches(g, { sub: 'Equipment' }, g.cards[id], me)),
          0,
          top.length,
        );
      for (const id of ids) enterBattlefield(g, g.cards[id], me);
      const rest = top.filter((id) => !ids.includes(id));
      shuffleArr(g, rest);
      for (const id of rest) moveCard(g, g.cards[id], 'library', true);
      if (ids.length) {
        const [eq] = yield* choose(g, me, '可選一個新武具裝上武士', ids);
        if (eq !== undefined) {
          const ids2 = opts({ type: 'Creature', sub: 'Samurai' });
          const [host] = yield* choose(g, me, '選武士', ids2, ids2.length ? 1 : 0);
          attach(g.cards[eq], g.cards[host]);
        }
      }
      break;
    }
    case 'impulseNextEnd':
      for (let i = 0; i < (ef.n ?? 1) && p.library.length; i++) {
        const c = g.cards[p.library[0]];
        moveCard(g, c, 'exile');
        impulse(c);
      }
      break;
    case 'breakEquipment': {
      const c = card();
      if (c) {
        const ids = g.battlefield.filter((id) => g.cards[id].attachedTo === c.id && g.cards[id].def.equip);
        const [id] = yield* choose(g, me, '可消滅所結附的一個武具', ids);
        if (id !== undefined) yield* runEffects(g, { ...ctx, targets: [{ c: id }] }, [{ e: 'destroy', what: 'T0' }]);
      }
      break;
    }
    case 'nibelheim': {
      const c = card();
      if (c) {
        const n = stats(g, c).p;
        for (const id of g.battlefield.slice()) if (id !== c.id && isCreature(g.cards[id])) dealDamage(g, c, me, { c: id }, n);
      }
      if (fromGy) {
        for (const id of p.hand.slice()) discard(g, g.cards[id]);
        drawCards(g, me, 4);
      }
      break;
    }
    case 'randomEncounter': {
      shuffleArr(g, p.library);
      const ids = p.library.slice(0, 4);
      for (const id of ids) moveCard(g, g.cards[id], 'graveyard');
      for (const id of ids) {
        const c = g.cards[id];
        if (c.zone === 'graveyard' && isCreature(c)) {
          enterBattlefield(g, c, me);
          g.eot.push({ card: id, p: 0, t: 0, kw: ['haste'] });
          delay(g, id, me, [{ e: 'bounce', what: 'self' }]);
        }
      }
      break;
    }
    case 'selfDestruct': {
      const c = card('T0'),
        target = ctx.targets[1];
      if (c && target) {
        const n = stats(g, c).p;
        dealDamage(g, c, me, target, n);
        dealDamage(g, c, me, { c: c.id }, n);
      }
      break;
    }
    case 'blitzballTransform':
      transformCard(g, src);
      {
        const [id] = yield* choose(g, me, '裝到你的一個生物', opts({ type: 'Creature' }), 1);
        attach(src, g.cards[id]);
      }
      break;
    case 'sorceressSchemes': {
      const ids = [...gy({ type: ['Instant', 'Sorcery'] }), ...p.exile.filter((id) => !!g.cards[id].def.flashback)];
      const [id] = yield* choose(g, me, '選一張瞬間法術或有返照放逐牌回手', ids, 1);
      if (id !== undefined) moveCard(g, g.cards[id], 'hand');
      break;
    }
    case 'brynhildrExile': {
      const c = g.cards[p.library[0]];
      if (c) {
        moveCard(g, c, 'exile');
        (src.finLinked ??= []).push(c.id);
        c.eclCast = { by: me, mode: 'brynhildr', source: src.tmtLinkKey };
        (src.finMarks ??= {}).loreTurn = g.turn;
        (c.finMarks ??= {}).brynhildrTurn = g.turn;
      }
      break;
    }
    case 'nextHaste':
      (g.delayed ??= []).push({
        source: src.id,
        controller: me,
        on: 'castAny',
        filter: { type: 'Creature' },
        once: true,
        effects: [E('spellHaste')],
      });
      break;
    case 'spellHaste':
      if (ctx.ev?.type === 'cast') {
        const c = g.cards[ctx.ev.card];
        (c.finMarks ??= {}).hasteTurn = g.turn;
      }
      break;
    case 'tripleTriad': {
      const top = g.players.map((pl) => g.cards[pl.library[0]]);
      for (const c of top) if (c) moveCard(g, c, 'exile');
      const mine = top[me];
      if (mine)
        for (const c of top)
          if (c && (c.owner === me || manaValue(c.def) < manaValue(mine.def))) c.eclCast = { by: me, until: g.turn, free: true };
      break;
    }
    case 'unexpected':
    case 'zidaneSteal': {
      const c = card();
      if (c) {
        c.returnControl = { player: c.controller, turn: g.turn };
        control(g, c, me);
        c.tapped = false;
        g.eot.push({ card: c.id, p: 0, t: 0, kw: ef.action === 'zidaneSteal' ? ['lifelink', 'haste'] : ['haste'] });
        if (ef.action === 'unexpected') {
          const [id] = yield* choose(g, me, '可將一個武具裝到該生物', opts({ sub: 'Equipment' }));
          if (id !== undefined) {
            attach(g.cards[id], c);
            delay(g, id, me, [E('unattach')]);
          }
        }
      }
      break;
    }
    case 'unattach':
      src.attachedTo = null;
      break;
    case 'vaan': {
      setMarker('vaanHit', 0);
      const pid = ctx.ev?.type === 'combatBatch' ? ctx.ev.damaged : opp,
        c = g.cards[g.players[pid].library[0]];
      if (c) {
        moveCard(g, c, 'exile');
        let cast = false;
        if (!isLand(c) && (yield* yes(g, me, '立刻施放放逐牌？'))) cast = yield* castSelected(g, ctx, c, false);
        if (!cast) yield* run([{ e: 'token', token: 'tok-treasure' }]);
      }
      break;
    }
    case 'returnLand': {
      const ids = opts({ type: 'Land' });
      const [id] = yield* choose(g, me, '將你的一個地回手', ids, ids.length ? 1 : 0);
      if (id !== undefined) moveCard(g, g.cards[id], 'hand');
      break;
    }
    case 'adamantoiseDies':
      if (src.zone === 'graveyard') {
        moveCard(g, src, 'exile');
        yield* run([{ e: 'token', token: 'tok-treasure', n: 10, tapped: true }]);
      }
      break;
    case 'bartz': {
      const target = ctx.targets[0];
      if (target)
        for (const id of opts({ sub: 'Bird' }).filter((id) => id !== src.id)) {
          const c = g.cards[id];
          dealDamage(g, c, me, target, stats(g, c).p);
        }
      break;
    }
    case 'chocoboKick': {
      const c = card('T0'),
        target = ctx.targets[1];
      if (c && target) dealDamage(g, c, me, target, 2 * stats(g, c).p);
      break;
    }
    case 'removeLore': {
      const c = card();
      if (c) c.lore = Math.max(0, (c.lore ?? 0) - 1);
      break;
    }
    case 'addLore': {
      const c = card();
      if (c) addLore(g, c, 1);
      break;
    }
    case 'earthDistribute': {
      const first = card('T0'),
        second = card('T1');
      if (first) {
        if (second) {
          putCounters(g, first, 1);
          putCounters(g, second, 1);
        } else putCounters(g, first, 2);
      }
      break;
    }
    case 'esperFinality':
      if (fromGy) (src.finMarks ??= {}).enterFinality = 1;
      break;
    case 'maduinReveal': {
      const c = g.cards[p.library[0]];
      if (c && permanent(c)) moveCard(g, c, 'hand');
      break;
    }
    case 'galuf': {
      const c = card();
      if (c)
        delay(
          g,
          c.id,
          me,
          [{ e: 'reflexive', targets: [{ kind: 'creature', optional: true }], effects: [{ e: 'counters', what: 'T0', n: { ev: true } }] }],
          'dies',
        );
      break;
    }
    case 'prishes': {
      const ids = p.library.filter((id) => matches(g, { or: [{ type: 'Land', basic: true }, { sub: 'Town' }] }, g.cards[id], me));
      const [id] = yield* choose(g, me, '可搜基本地或城鎮橫置進場', ids);
      if (id !== undefined) enterBattlefield(g, g.cards[id], me, true);
      shuffleArr(g, p.library);
      emit(g, { type: 'search', player: me });
      yield* run([
        { e: 'reflexive', targets: [{ kind: 'creature', filter: { ctrl: 'you' } }], effects: [{ e: 'counters', what: 'T0', n: 1 }] },
      ]);
      break;
    }
    case 'reachHorizon': {
      const ids = p.library.filter((id) => matches(g, { or: [{ type: 'Land', basic: true }, { sub: 'Town' }] }, g.cards[id], me));
      const [first] = yield* choose(g, me, '可選第一個基本地或城鎮', ids);
      const selected: number[] = [];
      if (first !== undefined) {
        selected.push(first);
        const [second] = yield* choose(
          g,
          me,
          '可選另一張不同名地',
          ids.filter((id) => g.cards[id].def.name !== g.cards[first].def.name),
        );
        if (second !== undefined) selected.push(second);
      }
      for (const id of selected) enterBattlefield(g, g.cards[id], me, true);
      shuffleArr(g, p.library);
      emit(g, { type: 'search', player: me });
      break;
    }
    case 'permanentAnimate':
      change(src, {
        types: [...new Set([...src.def.types, 'Creature' as const])],
        subtypes: [...(src.def.subtypes ?? []), 'Beast'],
        power: ef.n ?? 7,
        toughness: ef.n ?? 7,
      });
      break;
    case 'nextCounter':
      (g.delayed ??= []).push({
        source: src.id,
        controller: me,
        on: 'castAny',
        filter: { type: 'Creature' },
        once: true,
        effects: [E('spellCounter')],
      });
      break;
    case 'spellCounter':
      if (ctx.ev?.type === 'cast') {
        const c = g.cards[ctx.ev.card];
        (c.finMarks ??= {}).enterCounters = (c.finMarks?.enterCounters ?? 0) + 1;
      }
      break;
    case 'titanLands':
      for (const id of gy({ type: 'Land' })) enterBattlefield(g, g.cards[id], me, true);
      break;
    case 'grimoire': {
      const [id] = yield* choose(
        g,
        me,
        '可放一生物手牌進場',
        p.hand.filter((id) => isCreature(g.cards[id])),
      );
      if (id !== undefined) {
        const c = g.cards[id],
          enchantment = c.def.types.includes('Enchantment');
        enterBattlefield(g, c, me, enchantment);
        if (enchantment) c.attacking = true;
      }
      break;
    }
    case 'tifaDouble': {
      const n = stats(g, src).p;
      g.eot.push({ card: src.id, p: n, t: 0, kw: [] });
      break;
    }
    case 'multiplyPT': {
      const c = card();
      if (c) {
        const st = stats(g, c),
          mult = (ef.n ?? 2) - 1;
        g.eot.push({ card: c.id, p: mult * st.p, t: mult * st.t, kw: [] });
      }
      break;
    }
    case 'townGreeter': {
      const ids = (ctx.milled ?? []).filter((id) => g.cards[id].zone === 'graveyard' && isLand(g.cards[id]));
      const [id] = yield* choose(g, me, '可取一張磨掉的地', ids);
      if (id !== undefined) {
        if (matches(g, { sub: 'Town' }, g.cards[id], me)) gainLife(g, me, 2);
        moveCard(g, g.cards[id], 'hand');
      }
      break;
    }
    case 'vanilleReturn': {
      const [id] = yield* choose(
        g,
        me,
        '可取回一張永久物',
        gy().filter((id) => permanent(g.cards[id])),
      );
      if (id !== undefined) moveCard(g, g.cards[id], 'hand');
      break;
    }
    case 'meld': {
      const fang = opts({ name: "Fang, Fearless l'Cie" })
        .map((id) => g.cards[id])
        .find((c) => c.owner === me);
      if (
        src.owner !== me ||
        !fang ||
        !canPayCost(g, me, parseCost('{3}{B}{G}')) ||
        !(yield* yes(g, me, '支付{3}{B}{G}融合成Ragnarok？')) ||
        !payCost(g, me, parseCost('{3}{B}{G}'))
      )
        break;
      moveCard(g, src, 'exile');
      moveCard(g, fang, 'exile');
      src.finPartner = fang.id;
      fang.finPartner = src.id;
      enterBattlefieldBack(g, src, me);
      break;
    }
    case 'balthier':
      if (
        (g.finCombatNumber ?? 1) === 1 &&
        canPayCost(g, me, parseCost('{1}{R}{G}')) &&
        (yield* yes(g, me, '支付{1}{R}{G}獲得額外戰鬥？')) &&
        payCost(g, me, parseCost('{1}{R}{G}'))
      )
        g.extraCombat = { player: me, landOnly: false, count: (g.extraCombat?.count ?? 0) + 1 };
      break;
    case 'chocoDig': {
      const n = ctx.ev?.type === 'youAttack' ? ctx.ev.attackers.filter((id) => matches(g, { sub: 'Bird' }, g.cards[id], me)).length : 0;
      const top = p.library.slice(0, n),
        [take] = yield* choose(g, me, '可取一張牌到手上', top);
      if (take !== undefined) moveCard(g, g.cards[take], 'hand');
      const lands = yield* choose(
        g,
        me,
        '可放任意數量其餘地進場',
        top.filter((id) => id !== take && isLand(g.cards[id])),
        0,
        top.length,
      );
      for (const id of lands) enterBattlefield(g, g.cards[id], me, true);
      for (const id of top) if (id !== take && !lands.includes(id)) moveCard(g, g.cards[id], 'graveyard');
      break;
    }
    case 'chaosBottom':
      if (src.zone === 'graveyard') moveCard(g, src, 'library', true);
      break;
    case 'garnet': {
      const ids = yield* choose(
        g,
        me,
        '選擇任意傳紀各移除一個傳紀指示物',
        opts({ sub: 'Saga' }).filter((id) => (g.cards[id].lore ?? 0) > 0),
        0,
        g.battlefield.length,
      );
      for (const id of ids) g.cards[id].lore!--;
      putCounters(g, src, ids.length);
      break;
    }
    case 'golbez': {
      const c = card();
      if (c) {
        moveCard(g, c, 'hand');
        if (opts({ type: 'Artifact' }).length >= 8) loseLife(g, opp, Math.max(0, c.def.power ?? 0));
      }
      break;
    }
    case 'ignisLand': {
      const top = p.library.slice(0, 6),
        [id] = yield* choose(
          g,
          me,
          '可放一張地橫置進場',
          top.filter((id) => isLand(g.cards[id])),
        );
      if (id !== undefined) enterBattlefield(g, g.cards[id], me, true);
      const rest = top.filter((n) => n !== id);
      shuffleArr(g, rest);
      for (const id of rest) moveCard(g, g.cards[id], 'library', true);
      break;
    }
    case 'ignisFood': {
      const c = card();
      if (c) {
        const creature = isCreature(c);
        moveCard(g, c, 'exile');
        if (creature) yield* run([{ e: 'token', token: 'tok-food' }]);
      }
      break;
    }
    case 'makeMutant': {
      const c = card();
      if (c) change(c, { subtypes: [...(c.def.subtypes ?? []), 'Mutant'] });
      break;
    }
    case 'joshuaLoot': {
      const ids = yield* choose(g, me, '可棄至多兩張，然後抓同數量', p.hand.slice(), 0, Math.min(2, p.hand.length));
      for (const id of ids) discard(g, g.cards[id]);
      drawCards(g, me, ids.length);
      break;
    }
    case 'phoenixMassReturn': {
      const ids = ctx.targets.flatMap((t) => (t && 'c' in t ? [t.c] : []));
      for (const id of ids) {
        const c = g.cards[id];
        if (c.zone === 'graveyard' && c.owner === me) enterBattlefield(g, c, me);
      }
      break;
    }
    case 'kefkaDiscard': {
      const cards: Card[] = [];
      for (const pid of [g.active, other(g.active)]) {
        const pl = g.players[pid];
        const [id] = yield* choose(g, pid, '棄一張牌', pl.hand.slice(), Math.min(1, pl.hand.length));
        if (id !== undefined) {
          cards.push(g.cards[id]);
          discard(g, g.cards[id]);
        }
      }
      drawCards(g, me, new Set(cards.flatMap((c) => c.def.types)).size);
      break;
    }
    case 'opponentEdictPermanent': {
      const ids = own(g, opp);
      const [id] = yield* choose(g, opp, '犧牲一永久物', ids, ids.length ? 1 : 0);
      if (id !== undefined) sacrifice(g, g.cards[id]);
      break;
    }
    case 'lightningDouble': {
      if (ctx.ev?.type === 'combatDamage') (g.players[ctx.ev.player].finFlags ??= {}).lightningUntil = me + 1;
      break;
    }
    case 'rydiaReturn': {
      const c = card();
      if (c && manaValue(c.def) === (ctx.x ?? 0)) {
        enterBattlefield(g, c, me);
        c.finality = true;
        g.eot.push({ card: c.id, p: 0, t: 0, kw: ['haste'] });
      }
      break;
    }
    case 'sin': {
      while (true) {
        const ids = gy().filter((id) => permanent(g.cards[id]));
        if (!ids.length) break;
        const c = g.cards[ids[randInt(g, ids.length)]];
        linked(c);
        yield* copyToken(c, {}, true);
        if (!isLand(c)) break;
      }
      break;
    }
    case 'tellahSac':
      if (src.zone === 'battlefield') sacrifice(g, src);
      break;
    case 'terraMilled': {
      const ids = (ctx.milled ?? []).filter((id) => g.cards[id].zone === 'graveyard' && g.cards[id].def.types.includes('Enchantment'));
      const [id] = yield* choose(g, me, '可取一張磨掉的結界', ids);
      if (id !== undefined) moveCard(g, g.cards[id], 'hand');
      break;
    }
    case 'terraCopy': {
      const c = card();
      if (c) {
        const [copy] = yield* copyToken(c);
        if (copy) {
          g.eot.push({ card: copy.id, p: 0, t: 0, kw: ['haste'] });
          if (copy.def.saga) {
            const r: Response = yield {
              type: 'mode',
              player: me,
              prompt: '額外放至多3個傳紀指示物',
              options: ['0', '1', '2', '3'],
              count: 1,
              purpose: 'count',
            };
            addLore(g, copy, r.type === 'modes' ? (r.picks[0] ?? 0) : 0);
          }
          delay(g, copy.id, me, [E('sacSelf')]);
        }
      }
      break;
    }
    case 'ultimeciaCost': {
      if (
        p.graveyard.length < 8 ||
        !canPayCost(g, me, parseCost('{4}{U}{U}{B}{B}')) ||
        !(yield* yes(g, me, '支付法力並放逐墳墓場八張來轉化？'))
      )
        break;
      const ids = yield* choose(g, me, '放逐墳墓場八張', p.graveyard.slice(), 8, 8);
      if (ids.length === 8 && payCost(g, me, parseCost('{4}{U}{U}{B}{B}'))) {
        for (const id of ids) moveCard(g, g.cards[id], 'exile');
        transformCard(g, src);
      }
      break;
    }
    case 'extraTurn':
      (g.extraTurns ??= []).unshift(me);
      break;
    case 'viviMana':
      (p.pool ??= []).push(...(yield* chooseMana(g, me, Math.max(0, stats(g, src).p), ['U', 'R'])));
      break;
    case 'yunaReturn': {
      const c = card();
      if (c) {
        enterBattlefield(g, c, me);
        c.finality = true;
      }
      break;
    }
    case 'busterCast': {
      const n = ctx.ev?.type === 'combatDamage' ? ctx.ev.amount : 0,
        ids = p.hand.filter((id) => !isLand(g.cards[id]) && manaValue(g.cards[id].def) <= n);
      const [id] = yield* choose(g, me, '可免費施放傷害值以下手牌', ids);
      if (id !== undefined) yield* freeCast(g, ctx, g.cards[id]);
      break;
    }
    case 'elixir': {
      const ids = p.graveyard.filter((id) => !isLand(g.cards[id]));
      for (const id of ids) moveCard(g, g.cards[id], 'library');
      shuffleArr(g, p.library);
      gainLife(g, me, ids.length);
      break;
    }
    case 'genjiCombat':
      if ((g.finCombatNumber ?? 1) === 1) {
        src.tapped = false;
        g.extraCombat = { player: me, landOnly: false, count: (g.extraCombat?.count ?? 0) + 1 };
      }
      break;
    case 'pupuPower':
      change(src, { power: opts({ sub: 'Town' }).length }, true);
      break;
    case 'regaliaLand': {
      const revealed: number[] = [];
      for (const id of p.library) {
        revealed.push(id);
        if (isLand(g.cards[id])) break;
      }
      const land = revealed.find((id) => isLand(g.cards[id]));
      if (land !== undefined) enterBattlefield(g, g.cards[land], me, true);
      const rest = revealed.filter((id) => id !== land);
      shuffleArr(g, rest);
      for (const id of rest) moveCard(g, g.cards[id], 'library', true);
      break;
    }
    case 'xatmReturn':
      if (src.zone === 'graveyard') {
        enterBattlefield(g, src, me, true);
        src.finality = true;
      }
      break;
    case 'hideaway': {
      const top = p.library.slice(0, 4),
        [id] = yield* choose(g, me, '藏匿一張頂牌', top, top.length ? 1 : 0);
      if (id !== undefined) linked(g.cards[id]);
      const rest = top.filter((n) => n !== id);
      shuffleArr(g, rest);
      for (const id of rest) moveCard(g, g.cards[id], 'library', true);
      break;
    }
    case 'hideawayPlay': {
      const id = (src.finLinked ?? []).find((id) => g.cards[id]?.zone === 'exile');
      if (id !== undefined) {
        const c = g.cards[id];
        if (isLand(c)) {
          if (g.active === me && ['main1', 'main2'].includes(g.phase) && !g.stack.length && p.landsPlayed < 1) {
            enterBattlefield(g, c, me);
            p.landsPlayed++;
          }
        } else if (yield* yes(g, me, '免費施放藏匿牌？')) yield* freeCast(g, ctx, c);
      }
      break;
    }
    case 'eden':
      if (src.zone === 'battlefield' && (yield* yes(g, me, '犧牲此地取回另一永久物？'))) {
        sacrifice(g, src);
        yield* run([
          {
            e: 'reflexive',
            targets: [{ kind: 'gyCard', filter: { ctrl: 'you', nonType: ['Instant', 'Sorcery'], other: true } }],
            effects: [{ e: 'toHand', what: 'T0' }],
          },
        ]);
      }
      break;
    case 'coin': {
      let win = randInt(g, 2) === 1;
      const edgar = finStatic(g, me, 'coinHeads')[0];
      if (edgar && p.finFlags?.coinTurn !== g.turn) {
        (p.finFlags ??= {}).coinTurn = g.turn;
        win = true;
      }
      if (win) yield* run([{ e: 'token', token: 'tok-treasure' }]);
      break;
    }
    case 'lastingFayth':
      yield* make('hero');
      {
        const c = g.cards[ctx.created ?? -1];
        if (c) putCounters(g, c, opts({ type: 'Land' }).length);
      }
      break;
    case 'beatrix': {
      const c = card();
      if (c) {
        const ids = yield* choose(g, me, '可將任意武具裝到此生物', opts({ sub: 'Equipment' }), 0, g.battlefield.length);
        for (const id of ids) attach(g.cards[id], c);
      }
      break;
    }
    case 'lightningImpulse': {
      const c = g.cards[p.library[0]];
      if (c) {
        moveCard(g, c, 'exile');
        c.eclCast = { by: me, source: src.tmtLinkKey };
      }
      break;
    }
    case 'judgmentPlayer': {
      const c = card();
      if (c) dealDamage(g, src, me, { p: c.controller }, opts({ sub: 'Equipment' }).length);
      break;
    }
    case 'scythe': {
      const c = card();
      if (c && (yield* yes(g, me, '裝上並賦予先攻、必須被阻擋？'))) {
        attach(src, c);
        g.eot.push({ card: c.id, p: 0, t: 0, kw: ['first_strike'] });
        (c.finMarks ??= {}).mustBlock = g.turn;
      }
      break;
    }
    default:
      throw new Error('Unknown FIN effect ' + ef.action);
  }
  g.version++;
}
const eventAbility = (
  finEvent: string,
  effects: Effect[],
  targets?: import('./types').TargetSpec[],
): import('./types').TriggeredAbility => ({ kind: 'trigger', on: 'finEvent', finEvent, effects, targets });
/** Cast now using the usual stack, targets and additional-cost validation. */
function* castSelected(g: GameState, ctx: Ctx, c: Card, free: boolean): SubFlow<boolean> {
  if (free) return yield* freeCast(g, ctx, c);
  let mode: number | undefined;
  if (c.def.spell?.modes) {
    const r: Response = yield {
      type: 'mode',
      player: ctx.controller,
      prompt: '施放模式',
      options: c.def.spell.modes.map((m) => m.text),
      count: 1,
      purpose: 'trigger',
    };
    mode = r.type === 'modes' ? (r.picks[0] ?? 0) : 0;
  }
  const specs = castTargetSpecs(c.def, mode);
  let targets: (TargetRef | null)[] = [];
  if (specs.length) {
    const r: Response = yield {
      type: 'targets',
      player: ctx.controller,
      source: c.id,
      specs,
      text: c.def.text,
      effects: spellEffects(c.def, mode),
    };
    if (r.type !== 'targets') return false;
    targets = r.targets;
  }
  return castDuringResolution(g, ctx.controller, c.id, targets, false, mode) === null;
}
