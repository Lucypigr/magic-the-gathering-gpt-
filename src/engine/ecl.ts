import {finalStatic} from './orbit-final-support';
import {orbitBeforeEntry} from './orbit-final';
import {campusBeforeEntry} from './campus-zones';
import {meadowBeforeEntry} from './meadow';
import {frontierStatic} from './frontier-support';
import {mkmStatic} from './mkm-support';
import { finStatic } from './fin-support';
import { validateTargets } from './targets';
import { canPayCost, payCost } from './actions';
import { allDefs, getDef } from './registry';
import { choose, freeCast } from './tla';
import { resolveRef, runEffects, type Ctx } from './effects';
import { colorsOf, manaValue, parseCost } from './mana';
import {
  uncounterableSpells,
  copiableDefinition,
  abilitiesOf,
  isCreature,
  isLand,
  matches,
  newCard,
  other,
  shuffleArr,
  stats,
} from './state';
import { counterKinds, ECL_TRIBES, removeCounterKind, vividColors } from './ecl-support';
import {
  dealDamage,
  discard,
  drawCards,
  emit,
  enterBattlefield,
  loseLife,
  moveCard,
  putIntoGraveyard,
  putMinusCounters,
  sacrifice,
  tapCard,
} from './zones';
import type { Card, CardDef, Color, Effect, Filter, GameState, PID, Ref, Response, SubFlow } from './types';
const permanent = (c: Card) => c.def.types.some((t) => ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Land'].includes(t));
const typeList = () =>
  [
    ...new Set([
      'Advisor',
      'Coward',
      ...ECL_TRIBES,
      ...allDefs()
        .filter((d) => d.types.includes('Creature'))
        .flatMap((d) => d.subtypes ?? []),
    ]),
  ].sort();
export function* chooseEclType(g: GameState, pid: PID, limited = false): SubFlow<string> {
  const options = limited ? ECL_TRIBES : typeList();
  const r: Response = yield { type: 'mode', player: pid, prompt: '選擇生物類別', options, count: 1, purpose: 'creatureType' };
  return options[r.type === 'modes' ? (r.picks[0] ?? 0) : 0] ?? options[0];
}
function* color(g: GameState, pid: PID, options: Color[] = ['W', 'U', 'B', 'R', 'G']): SubFlow<Color> {
  const r: Response = yield { type: 'mode', player: pid, prompt: '選擇顏色', options, count: 1, purpose: 'color' };
  return options[r.type === 'modes' ? (r.picks[0] ?? 0) : 0] ?? options[0];
}
function* yes(g: GameState, pid: PID, prompt: string): SubFlow<boolean> {
  const r: Response = yield { type: 'yesno', player: pid, prompt };
  return r.type === 'yesno' && r.yes;
}
function changeDef(c: Card, patch: Partial<CardDef>, temporary = false) {
  if (temporary) c.baseDef ??= c.def;
  else c.tlaOriginalDef ??= c.def;
  c.def = { ...c.def, ...patch };
}
function copiable(c: Card) {
  return copiableDefinition(c);
}
function schedule(g: GameState, c: Card, controller: PID, effects: Effect[], on: 'eachEndStep' | 'dies' = 'eachEndStep') {
  (g.delayed ??= []).push({ source: c.id, controller, on, effects, once: true, persistent: on === 'eachEndStep' });
}
function eligible(g: GameState, pid: PID, filter: Filter = {}) {
  return g.battlefield.filter((id) => g.cards[id].controller === pid && matches(g, filter, g.cards[id], pid));
}
function* blight(g: GameState, pid: PID, n: number, optional = false): SubFlow<Card | undefined> {
  const ids = eligible(g, pid, { type: 'Creature' });
  if (!ids.length) return;
  const [id] = yield* choose(g, pid, `選擇承受${n}個−1/−1指示物的生物`, ids, optional ? 0 : 1);
  if (id !== undefined) {
    const c = g.cards[id];
    putMinusCounters(g, c, n);
    return c;
  }
}
export function* resolveEclEntries(g: GameState): SubFlow {
  while (g.eclEntryQueue?.length) {
    const entry = g.eclEntryQueue.shift()!,
      c = g.cards[entry.card];
    if (!c) continue;
    let def = entry.enterAs,
      tapped = entry.tapped;
    let choice = c.def.ecl?.asEnters;
    if(choice==='orbit')def=yield*orbitBeforeEntry(g,c,entry.controller);
    if(choice==='campusLandCopy')def=yield*campusBeforeEntry(g,c,entry.controller);
    if(choice==='mockingbird'||choice==='waxen'||choice==='mimeoplasm'){def=yield*meadowBeforeEntry(g,{source:c.id,controller:entry.controller,targets:[],x:c.zone==='stack'?c.castX??0:0},c);if(def)choice=def.ecl?.asEnters;}
    if (choice === 'tribe' || choice === 'tribe8') c.eclType = yield* chooseEclType(g, entry.controller, choice === 'tribe8');
    if(choice==='talion'){const r:Response=yield{type:'mode',player:entry.controller,prompt:'選擇1至10',options:Array.from({length:10},(_,i)=>String(i+1)),count:1,purpose:'count'};(c.frontierMarks??={}).talion=1+(r.type==='modes'?r.picks[0]??0:0);}
    if(choice==='cardName'){const landsOnly=!!c.def.meadow?.campusNameLand;const defs=allDefs().filter(d=>d.set!=='TOK'&&(!landsOnly||d.types.includes('Land')));const answer:Response=yield{type:'mode',player:entry.controller,prompt:landsOnly?'選擇地牌名稱':'對手手牌：'+g.players[other(entry.controller)].hand.map(id=>g.cards[id].def.name).join('、')+'；選擇一張牌名',options:defs.map(d=>d.name),count:1,purpose:'trigger'};c.foundationNamed=defs[answer.type==='modes'?answer.picks[0]??0:0]?.name;}
    if (choice === 'color') c.chosenColor = yield* color(g, entry.controller);
    if (choice === 'shock') {
      if (g.players[entry.controller].life >= 2 && (yield* yes(g, entry.controller, '支付2生命使震地不橫置？')))
        loseLife(g, entry.controller, 2);
      else tapped = true;
    }
    if(choice==='otjClone'){const ids=g.battlefield.filter(id=>g.cards[id].controller===entry.controller&&isCreature(g.cards[id]));const [id]=yield*choose(g,entry.controller,'可複製一個己方生物',ids);if(id!==undefined){const base=copiable(g.cards[id]);def={...base,subtypes:[...(base.subtypes??[]),'Shapeshifter','Rogue'],ecl:undefined};}}
    if (choice === 'clone') {
      const [id] = yield* choose(
        g,
        entry.controller,
        '可選擇以某生物的複製進場',
        g.battlefield.filter((id) => isCreature(g.cards[id])),
      );
      if (id !== undefined) {
        const base = copiable(g.cards[id]);
        def = { ...base, changeling: true, ecl: undefined };
      }
    }
    c.eclPrepared = true;
    enterBattlefield(g, c, entry.controller, tapped, def);
    c.eclPrepared = false;
    if (c.def.id === 'shimmerwilds-growth') {
      const host = g.cards[c.attachedTo ?? -1];
      if (host && c.chosenColor) {
        host.auraBaseDef ??= host.def;
        host.def = { ...host.def, colors: [c.chosenColor] };
      }
    }
  }
}
export function* makeEclTokenBatch(
  g: GameState,
  pid: PID,
  token: string | CardDef,
  n: number,
  opts: { tapped?: boolean; attacking?: boolean; attachTo?: number; batch?:number } = {},
): SubFlow<Card[]> {
  if (n <= 0) return [];
  type Group = { def: CardDef; n: number; primary: boolean };
  const groups: Group[] = [{ def: typeof token === 'string' ? getDef(token) : token, n, primary: true }];
  const first = g.players[pid].tokensCreatedTurn !== g.turn;
  const crowns = first
    ? g.battlefield
        .map((id) => g.cards[id])
        .filter(
          (c) =>
            c.controller === pid &&
            c.def.id === 'mirrormind-crown' &&
            c.attachedTo != null &&
            g.cards[c.attachedTo]?.zone === 'battlefield' &&
            isCreature(g.cards[c.attachedTo]) &&
            abilitiesOf(g, c).length,
        )
    : [];
  // Every Crown observes the same first creation event, including those not selected first.
  for (const c of crowns) c.eclUsage = { turn: g.turn, n: 1 };
  const pending = [
    ...(first?finalStatic(g,pid,'meditationTokens'):[]).map(c=>({card:c,kind:'meditation' as const})),
    ...crowns.map((c) => ({ card: c, kind: 'crown' as const })),
    ...finStatic(g, pid, 'extraFrog').map((c) => ({ card: c, kind: 'frog' as const })),
    ...mkmStatic(g,pid,'extraClue').filter(c=>c.mkmSolved).map(c=>({card:c,kind:'clue' as const})),
    ...g.battlefield
      .map((id) => g.cards[id])
      .filter((c) => c.controller === pid && abilitiesOf(g, c).some((a) => a.kind === 'static' && a.artifactTokenDragon))
      .map((c) => ({ card: c, kind: 'dragon' as const })),
  ];
  while (pending.length) {
    const applicable = pending.filter((r) => r.kind !== 'dragon' || groups.some((group) => group.def.types.includes('Artifact')));
    if (!applicable.length) break;
    let pick = 0;
    if (applicable.length > 1) {
      const r: Response = yield {
        type: 'mode',
        player: pid,
        prompt: '選擇先套用的衍生物取代效果',
        options: applicable.map((x) => `${x.card.def.name} #${x.card.id}`),
        count: 1,
        purpose: 'trigger',
      };
      pick = r.type === 'modes' ? (r.picks[0] ?? 0) : 0;
    }
    const selected = applicable[pick] ?? applicable[0];
    pending.splice(pending.indexOf(selected), 1);
    if(selected.kind==='meditation'){const host=g.cards[selected.card.attachedTo??-1];if(host&&host.zone==='battlefield'&&(yield*yes(g,pid,'以所結附永久物的複製取代衍生物？')))for(const group of groups)group.def=copiable(host);}
    else if(selected.kind==='clue')groups.push({def:getDef('tok-clue'),n:1,primary:false});
    else if (selected.kind === 'frog') groups.push({ def: getDef('tok-fin-frog'), n: 1, primary: false });
    else if (selected.kind === 'dragon') {
      for (const group of groups) if (group.def.types.includes('Artifact')) group.def = getDef('tok-fra-dragon');
    } else if (yield* yes(g, pid, '以佩帶生物的複製取代本次衍生物？')) {
      const host = g.cards[selected.card.attachedTo ?? -1];
      if (host) for (const group of groups) group.def = copiable(host);
    }
  }
  g.players[pid].tokensCreatedTurn = g.turn;
  const previousGroup=g.mshTokenGroup;g.mshTokenGroup=opts.batch??g.nextSid++;
  const out: Card[] = [];
  for(const group of groups)group.n*=2**frontierStatic(g,pid,'fdn:doubleTokens').length*(group.def.types.includes('Creature')?3**frontierStatic(g,pid,'lci:tripleCreatureTokens').length:1);
  for (const group of groups)
    for (let i = 0; i < group.n; i++) {
      const c = newCard(g, group.def, pid, true);
      c.zone = 'exile';
      enterBattlefield(g, c, pid, !!opts.tapped);
      if (opts.attacking && isCreature(c)) c.attacking = true;
      if (opts.attachTo !== undefined){c.attachedTo = opts.attachTo;emit(g,{type:'frontier',action:'attached',card:c.id,player:pid,other:opts.attachTo,amount:0});}
      if (group.primary) out.push(c);
    }
  g.mshTokenGroup=previousGroup;
  return out;
}

export function* eclEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, { e: 'ecl' }>): SubFlow {
  const me = ctx.controller,
    opp = other(me),
    p = g.players[me],
    src = g.cards[ctx.source],
    linkKey = ctx.sourceLinkKey ?? src.tmtLinkKey ?? src.id;
  const card = (ref: Ref = ef.what ?? 'T0') => resolveRef(g, ctx, ref).cards[0];
  const run = (effects: Effect[]) => runEffects(g, ctx, effects);
  const evCard = ctx.ev && 'card' in ctx.ev ? g.cards[ctx.ev.card] : undefined;
  const tokens = (name: string, n = 1, pid = me) => makeEclTokenBatch(g, pid, 'tok-ecl-' + name, n);
  const linked = (c: Card) => {
    moveCard(g, c, 'exile');
    c.eclLinked = linkKey;
    c.eclExiledTurn = g.turn;
  };
  const impulse = (c: Card, until?: number, free = false, source?: number, mode?: string) => {
    c.eclCast = { by: me, until, free, source, mode, ...(until === undefined ? { nextTurn: (p.eclTurnCount ?? 0) + 1 } : {}) };
  };
  const restricted = (mana: Color[], rule: string, source?: number) => {
    (p.eclRestrictedMana ??= []).push(...mana.map((m) => ({ mana: m, rule, source })));
  };
  switch (ef.action) {
    case 'wardLife': {
      const item = g.stack.find((s) => s.sid === ef.n);
      if (!item) break;
      const pid = item.controller,
        n = ef.value ?? 2;
      const paid = g.players[pid].life >= n && (yield* yes(g, pid, `支付${n}生命作守護費用？`));
      if (paid) loseLife(g, pid, n);
      else if (item.kind === 'spell') {
        const c = g.cards[item.cardId];
        if (!uncounterableSpells(g, pid) && !c.def.uncounterable && !item.uncounterable)
          moveCard(g, c, item.alt === 'flashback' || item.alt === 'harmonize' ? 'exile' : 'graveyard');
      } else g.stack = g.stack.filter((s) => s.sid !== item.sid);
      break;
    }
    case 'evokeSac':
      if (src.zone === 'battlefield' && (ctx.sourceLinkKey === undefined || src.tmtLinkKey === ctx.sourceLinkKey)) sacrifice(g, src);
      break;
    case 'persist':
      if (src.zone === 'graveyard' && (ctx.sourceLinkKey === undefined || src.tmtLinkKey === ctx.sourceLinkKey)) {
        src.eclEnterMinus = 1;
        enterBattlefield(g, src, src.owner);
      }
      break;
    case 'sacSelf':
      if (src.zone === 'battlefield') sacrifice(g, src);
      break;
    case 'championReturn':
      for (const id of (ctx.ev?.type === 'leaves' ? ctx.ev.beheld : undefined) ?? src.eclBeheld ?? []) {
        const c = g.cards[id];
        if (c?.zone === 'exile') moveCard(g, c, 'hand');
      }
      break;
    case 'ajani': {
      const top = p.library.slice(0, Math.max(0, p.life));
      const options = top.filter((id) => permanent(g.cards[id]) && !isLand(g.cards[id]) && manaValue(g.cards[id].def) <= 3);
      const ids = yield* choose(g, me, '選任意數量費用至多3的非地永久物進場', options, 0, options.length);
      for (const id of ids) enterBattlefield(g, g.cards[id], me);
      shuffleArr(g, p.library);
      break;
    }
    case 'brigidMana': {
      const col = yield* color(g, me, ['G', 'W']);
      (p.pool ??= []).push(...Array(eligible(g, me, { type: 'Creature', other: true }).filter((id) => id !== src.id).length).fill(col));
      break;
    }
    case 'cribSwap': {
      const c = card();
      if (c) {
        const controller = c.controller;
        moveCard(g, c, 'exile');
        yield* tokens('shapeshifter', 1, controller);
      }
      break;
    }
    case 'colossus': {
      const pid = resolveRef(g, ctx, 'T0').players[0];
      if (pid === undefined) break;
      for (const id of eligible(g, pid, { type: 'Creature' })) {
        const c = g.cards[id];
        changeDef(c, { power: 1, toughness: 1, subtypes: [...(c.def.subtypes ?? []), 'Coward'] });
        c.eclLoseAbilities = true;
      }
      break;
    }
    case 'kinscaer': {
      const n = eligible(g, me, { type: 'Creature', attacking: true }).length;
      const [id] = yield* choose(
        g,
        me,
        '可放符合費用的生物，橫置且攻擊',
        p.hand.filter((id) => isCreature(g.cards[id]) && manaValue(g.cards[id].def) <= n),
      );
      if (id !== undefined) {
        enterBattlefield(g, g.cards[id], me, true);
        g.cards[id].attacking = true;
      }
      break;
    }
    case 'meanders': {
      const [id] = yield* choose(
        g,
        me,
        '可橫置另一個未橫置人魚',
        eligible(g, me, { type: 'Creature', sub: 'Merfolk', tapped: false }).filter((id) => id !== src.id),
      );
      if (id !== undefined) {
        tapCard(g, g.cards[id]);
        yield* run([
          {
            e: 'reflexive',
            targets: [{ kind: 'gyCard', filter: { ctrl: 'you', type: 'Creature', mvMax: 3 } }],
            effects: [{ e: 'reanimate', what: 'T0' }],
          },
        ]);
      }
      break;
    }
    case 'morningtide': {
      const ids = ctx.targets.flatMap((t) => (t && 'c' in t ? [t.c] : []));
      for (const id of ids) {
        const c = g.cards[id];
        moveCard(g, c, 'exile');
        c.eclLinked = -src.id;
      }
      (g.delayed ??= []).push({
        source: src.id,
        controller: me,
        on: 'eachEndStep',
        once: true,
        persistent: true,
        effects: [{ e: 'ecl', action: 'morningReturn', n: src.id }],
      });
      p.eclPreventDamageUntil = me;
      moveCard(g, src, 'exile');
      break;
    }
    case 'morningReturn':
      for (const pl of g.players)
        for (const id of pl.exile.slice()) {
          const c = g.cards[id];
          if (c.eclLinked === -(ef.n ?? 0)) enterBattlefield(g, c, c.owner, true);
        }
      break;
    case 'removeAny':
    case 'removeAll': {
      const c = card();
      if (!c) break;
      for (const [kind, n] of Object.entries(counterKinds(c))) {
        if (!n) continue;
        let k = n;
        if (ef.action === 'removeAny') {
          const r: Response = yield {
            type: 'mode',
            player: me,
            prompt: `移除幾個${kind}指示物？`,
            options: Array.from({ length: n + 1 }, (_, i) => String(i)),
            count: 1,
            purpose: 'count',
          };
          k = r.type === 'modes' ? (r.picks[0] ?? 0) : 0;
        }
        removeCounterKind(c, kind, Math.min(n, k));
      }
      break;
    }
    case 'slumbering': {
      const kinds = Object.entries(counterKinds(src)).filter(([, n]) => n > 0);
      if (!kinds.length) break;
      const r: Response = yield {
        type: 'mode',
        player: me,
        prompt: '可移除一個指示物，或略過',
        options: [...kinds.map(([k]) => k), '略過'],
        count: 1,
        purpose: 'trigger',
      };
      const kind = kinds[r.type === 'modes' ? r.picks[0] : kinds.length]?.[0];
      if (kind && removeCounterKind(src, kind))
        yield* run([
          {
            e: 'reflexive',
            targets: [{ kind: 'gyCard', filter: { ctrl: 'you', type: 'Creature', powMax: 2 } }],
            effects: [{ e: 'reanimate', what: 'T0' }],
          },
        ]);
      break;
    }
    case 'auraExile': {
      const c = g.cards[src.lastAttachedTo ?? src.attachedTo ?? -1];
      if (c?.zone === 'battlefield') moveCard(g, c, 'exile');
      break;
    }
    case 'winnowing': {
      const chosen = new Map<PID, Card>();
      for (const pid of [g.active, other(g.active)]) {
        const [id] = yield* choose(g, me, `為${g.players[pid].name}選一個保留類別的生物`, eligible(g, pid, { type: 'Creature' }), 1);
        if (id !== undefined) chosen.set(pid, g.cards[id]);
      }
      const victims: Card[] = [];
      for (const [pid, c] of chosen)
        for (const id of eligible(g, pid, { type: 'Creature' })) {
          const x = g.cards[id];
          if (x.id === c.id || x.def.changeling || c.def.changeling || x.def.subtypes?.some((t) => c.def.subtypes?.includes(t))) continue;
          emit(g, { type: 'sacrifice', card: x.id, player: pid });
          victims.push(x);
        }
      putIntoGraveyard(g, victims);
      break;
    }
    case 'flitterwing':
      (g.delayed ??= []).push({
        source: src.id,
        controller: me,
        on: 'allyCombatDamagePlayerOrWalker',
        effects: [{ e: 'draw', n: 1 }],
        once: false,
      });
      break;
    case 'glamer': {
      const c = card();
      if (c) {
        changeDef(c, { power: 4, toughness: 4, changeling: true }, true);
      }
      break;
    }
    case 'guardianCounter': {
      const c = card();
      if (c) {
        const controller = c.controller;
        yield* run([{ e: 'counter', what: 'T0' }]);
        drawCards(g, controller, 1);
      }
      break;
    }
    case 'answer': {
      let n = 0;
      for (const item of g.stack.slice()) {
        if (item.controller === me) continue;
        const c = g.cards[item.cardId];
        if (item.kind === 'spell') {
          if (uncounterableSpells(g, c.controller) || c.def.uncounterable || item.uncounterable) continue;
          moveCard(g, c, item.alt === 'flashback' || item.alt === 'harmonize' ? 'exile' : 'graveyard');
        } else g.stack = g.stack.filter((s) => s.sid !== item.sid);
        n++;
      }
      yield* tokens('faerie', n);
      break;
    }
    case 'gravelgill': {
      const [id] = yield* choose(
        g,
        me,
        '可橫置另一個未橫置生物',
        eligible(g, me, { type: 'Creature', tapped: false }).filter((id) => id !== src.id),
      );
      if (id !== undefined) {
        tapCard(g, g.cards[id]);
        yield* run([{ e: 'pump', what: 'self', p: 0, t: 0, kw: ['unblockable'] }]);
      }
      break;
    }
    case 'crescendo': {
      const sub = yield* chooseEclType(g, me);
      drawCards(g, me, eligible(g, me, { sub }).length);
      break;
    }
    case 'mirrorform': {
      const c = card();
      if (c) {
        const def = copiable(c);
        for (const id of eligible(g, me, { nonType: 'Land' })) {
          const x = g.cards[id];
          changeDef(x, def);
          x.copyLayer = def;
        }
      }
      break;
    }
    case 'allTypes': {
      const c = card();
      if (c) changeDef(c, { changeling: true });
      break;
    }
    case 'noTypes': {
      const c = card();
      if (c) changeDef(c, { changeling: false, subtypes: [] }, true);
      break;
    }
    case 'okoEmblem': {
      const sub = yield* chooseEclType(g, me);
      const def: CardDef = {
        id: 'ecl-oko-emblem',
        name: 'Oko Emblem',
        set: 'TOK',
        rarity: 'T',
        token: true,
        cost: '',
        types: ['Emblem'],
        text: `${sub} +3/+3、警戒、辟邪`,
        abilities: [
          {
            kind: 'static',
            anthem: { filter: { type: 'Creature', ctrl: 'you', sub }, grant: { p: 3, t: 3, kw: ['vigilance', 'hexproof'] } },
          },
        ],
      };
      const c = newCard(g, def, me, true);
      c.zone = 'exile';
      enterBattlefield(g, c, me);
      break;
    }
    case 'takeMilledPermanent':
    case 'lluwenTop': {
      const opts = (ctx.milled ?? []).filter(
        (id) =>
          g.cards[id].zone === 'graveyard' &&
          (ef.action === 'lluwenTop' ? isCreature(g.cards[id]) || isLand(g.cards[id]) : permanent(g.cards[id])),
      );
      const [id] = yield* choose(g, me, '可取一張磨到的牌', opts);
      if (id !== undefined) moveCard(g, g.cards[id], ef.action === 'lluwenTop' ? 'library' : 'hand');
      break;
    }
    case 'torqueNextCopy':
      (g.delayed ??= []).push({ source: src.id, controller: me, on: 'castInstSorc', once: true, effects: [{ e: 'copySpell' }] });
      break;
    case 'syggDraw': {
      const c = card();
      if (c) {
        const old = c.temporaryAbilities?.turn === g.turn ? c.temporaryAbilities.abilities : [];
        c.temporaryAbilities = {
          turn: g.turn,
          abilities: [...old, { kind: 'trigger', on: 'combatDamagePlayerOrWalker', effects: [{ e: 'draw', n: 1 }] }],
        };
      }
      break;
    }
    case 'temporal': {
      const c = card();
      if (!c) break;
      const bottom = yield* yes(g, c.owner, '放牌庫底？（否則放牌庫第二張）');
      moveCard(g, c, 'library', bottom);
      if (!bottom) {
        const lib = g.players[c.owner].library;
        lib.shift();
        lib.splice(Math.min(1, lib.length), 0, c.id);
      }
      break;
    }
    case 'thirst': {
      const [id] = yield* choose(
        g,
        me,
        '可棄一張生物，否則棄兩張',
        p.hand.filter((id) => isCreature(g.cards[id])),
      );
      if (id !== undefined) discard(g, g.cards[id]);
      else yield* run([{ e: 'discard', who: 'you', n: 2 }]);
      break;
    }
    case 'farewell': {
      let n = 0;
      for (const c of resolveRef(g, ctx, 'T0').cards.concat(resolveRef(g, ctx, 'T1').cards)) {
        if (c.zone === 'battlefield') {
          moveCard(g, c, 'hand');
          n++;
        }
      }
      if (eligible(g, me, { sub: 'Merfolk' }).length) yield* tokens('merfolk', n);
      break;
    }
    case 'bidding': {
      const sub = yield* chooseEclType(g, me);
      const ids = p.graveyard.filter((id) => isCreature(g.cards[id]) && matches(g, { sub }, g.cards[id], me));
      for (const id of ids) enterBattlefield(g, g.cards[id], me);
      break;
    }
    case 'opponentBlight':
      yield* blight(g, opp, ef.n ?? 1);
      break;
    case 'blightSelfPlayer':
      yield* blight(g, me, ef.n ?? 1);
      break;
    case 'dissidentExile': {
      const c = card();
      if (c) {
        linked(c);
        if (c.owner === me && isCreature(c)) c.eclCast = { by: me, source: linkKey, mode: 'dissident' };
      }
      break;
    }
    case 'doseBlight':
      if (!['main1', 'main2'].includes(g.phase) || g.active !== me) yield* blight(g, me, 2);
      break;
    case 'gloomRipper': {
      const n = eligible(g, me, { sub: 'Elf' }).length + p.graveyard.filter((id) => matches(g, { sub: 'Elf' }, g.cards[id], me)).length;
      yield* run([
        { e: 'pump', what: 'T0', p: n, t: 0 },
        { e: 'pump', what: 'T1', p: 0, t: -n },
      ]);
      break;
    }
    case 'grubCopy': {
      const c = yield* blight(g, me, 1, true);
      if (c) {
        const ts = yield* makeEclTokenBatch(
          g,
          me,
          {
            ...copiable(c),
            abilities: [
              ...(copiable(c).abilities ?? []),
              { kind: 'trigger', on: 'eachEndStep', effects: [{ e: 'ecl', action: 'sacSelf' }] },
            ],
          },
          1,
          { tapped: true, attacking: true },
        );
        ctx.created = ts[0]?.id;
      }
      break;
    }
    case 'gutsplitter':
      if (!(yield* blight(g, me, 2, true))) loseLife(g, me, 3);
      break;
    case 'mornsong': {
      const pid = ctx.ev?.type === 'step' ? ctx.ev.player : me;
      loseLife(g, pid, 3);
      const [id] = yield* choose(g, pid, '搜尋任意牌放手上', g.players[pid].library.slice(), 1);
      if (id !== undefined) moveCard(g, g.cards[id], 'hand');
      shuffleArr(g, g.players[pid].library);
      emit(g, { type: 'search', player: pid });
      break;
    }
    case 'exileHand': {
      const pid = resolveRef(g, ctx, 'T0').players[0];
      if (pid !== undefined) {
        const ids = yield* choose(g, pid, '放逐兩張手牌', g.players[pid].hand.slice(), ef.n ?? 2, ef.n ?? 2);
        for (const id of ids) moveCard(g, g.cards[id], 'exile');
      }
      break;
    }
    case 'retched':
      if (src.zone === 'graveyard' && (ctx.sourceLinkKey === undefined || src.tmtLinkKey === ctx.sourceLinkKey)) {
        enterBattlefield(g, src, me);
        src.eclLoseAbilities = true;
      }
      break;
    case 'malice': {
      const c = card();
      if (c) schedule(g, c, me, [{ e: 'token', token: 'tok-ecl-elf' }], 'dies');
      break;
    }
    case 'taster': {
      const pid = resolveRef(g, ctx, 'T0').players[0] ?? opp;
      const hand = g.players[pid].hand;
      const n = Math.min(hand.length, eligible(g, me, { sub: 'Goblin' }).length);
      const reveal = yield* choose(g, pid, `揭示${n}張手牌`, hand.slice(), n, n);
      const [id] = yield* choose(g, me, '選一張揭示牌放逐', reveal, 1);
      if (id !== undefined) {
        const c = g.cards[id];
        linked(c);
        if (c.def.types.some((t) => t === 'Instant' || t === 'Sorcery')) {
          c.eclCast = { by: me, source: linkKey, mode: 'taster' };
        }
      }
      break;
    }
    case 'ashlingMana': {
      const col = yield* color(g, me);
      restricted([col, col], 'mv4');
      break;
    }
    case 'burningCuriosity':
      for (let i = 0; i < (ef.n ?? 2) && p.library.length; i++) {
        const c = g.cards[p.library[0]];
        linked(c);
        impulse(c);
      }
      break;
    case 'endBlazeWatch': {
      const c = card();
      if (c) schedule(g, c, me, [{ e: 'ecl', action: 'endBlazeDeath', n: me }], 'dies');
      break;
    }
    case 'endBlazeDeath': {
      const pid = (ef.n ?? me) as PID;
      const power = ctx.ev?.type === 'dies' ? ctx.ev.power : (src.lastPower ?? 0);
      const ids: number[] = [];
      for (let i = 0; i < Math.max(0, power) && g.players[pid].library.length; i++) {
        const c = g.cards[g.players[pid].library[0]];
        moveCard(g, c, 'exile');
        ids.push(c.id);
      }
      const [id] = yield* choose(g, pid, '選一張本回合及下回合可使用的牌', ids, 1);
      if (id !== undefined) g.cards[id].eclCast = { by: pid, nextTurn: (g.players[pid].eclTurnCount ?? 0) + 1 };
      break;
    }
    case 'flamebraiderMana': {
      const cols: Color[] = [];
      for (let i = 0; i < 2; i++) cols.push(yield* color(g, me));
      restricted(cols, 'elemental');
      break;
    }
    case 'steal': {
      const c = card();
      if (c) {
        c.returnControl = { player: c.controller, turn: g.turn };
        c.controller = me;
        c.sick = true;
        c.tapped = false;
        c.attacking = false;
        c.blocking = null;
        g.eot.push({ card: c.id, p: 0, t: 0, kw: ['haste'] });
      }
      break;
    }
    case 'goatBonus': {
      const c = card();
      if (c && matches(g, { sub: 'Goat' }, c, me)) yield* run([{ e: 'pump', what: 'T0', p: 3, t: 0 }]);
      break;
    }
    case 'dreamCast': {
      const ids = p.exile.filter((id) => g.cards[id].eclDream);
      const [id] = yield* choose(g, me, '免費施放一張帶夢境指示物的牌', ids);
      if (id !== undefined) yield* freeCast(g, ctx, g.cards[id]);
      break;
    }
    case 'discardDraw': {
      const [id] = yield* choose(g, me, '棄一張牌', p.hand.slice(), 1);
      if (id !== undefined) {
        discard(g, g.cards[id]);
        drawCards(g, me, 1);
      }
      break;
    }
    case 'meek': {
      const [id] = yield* choose(
        g,
        me,
        '可放總身材至多5的生物',
        p.hand.filter((id) => isCreature(g.cards[id]) && (g.cards[id].def.power ?? 0) + (g.cards[id].def.toughness ?? 0) <= 5),
      );
      if (id !== undefined) {
        const c = g.cards[id];
        enterBattlefield(g, c, me);
        yield* runEffects(g, { ...ctx, targets: [{ c: id }] }, [{ e: 'pump', what: 'T0', p: 0, t: 0, kw: ['haste'] }]);
        schedule(g, c, me, [{ e: 'ecl', action: 'sacSelf' }]);
      }
      break;
    }
    case 'soulImmolation': {
      const n = ctx.x ?? 0;
      for (const id of eligible(g, opp, { type: 'Creature' })) dealDamage(g, src, me, { c: id }, n);
      dealDamage(g, src, me, { p: opp }, n);
      break;
    }
    case 'soulbright': {
      const n = src.eclUsage?.turn === g.turn ? src.eclUsage.n + 1 : 1;
      src.eclUsage = { turn: g.turn, n };
      if (n === 3) (p.pool ??= []).push('R', 'R', 'R', 'R');
      break;
    }
    case 'spinerock': {
      if (ctx.ev?.type !== 'cast') break;
      const castId = ctx.ev.card;
      const item = g.stack.find((s) => s.cardId === castId && s.kind === 'spell');
      if (
        item &&
        new Set(item.targets.filter(Boolean).map((t) => (t && 'c' in t ? 'c' + t.c : t && 'p' in t ? 'p' + t.p : ''))).size === 1 &&
        (yield* yes(g, me, '複製單一目標咒語並賦予凋萎？'))
      ) {
        g.cards[item.cardId].spellWitherTurn = g.turn;
        yield* run([{ e: 'copySpell' }]);
      }
      break;
    }
    case 'aurora': {
      const n = vividColors(g, me).length,
        top: number[] = [];
      let found = 0;
      for (const id of p.library) {
        top.push(id);
        if (permanent(g.cards[id]) && ++found >= n) break;
      }
      if (!n) break;
      const opts = top.filter((id) => permanent(g.cards[id]));
      const ids = yield* choose(g, me, '可將揭示的永久物放進戰場', opts, 0, opts.length);
      for (const id of ids) enterBattlefield(g, g.cards[id], me);
      const rest = top.filter((id) => !ids.includes(id));
      shuffleArr(g, rest);
      for (const id of rest) moveCard(g, g.cards[id], 'library', true);
      break;
    }
    case 'bloomMana':
      (p.pool ??= []).push(...vividColors(g, me));
      break;
    case 'celestial': {
      const opts = p.library.filter((id) => isCreature(g.cards[id]) && manaValue(g.cards[id].def) <= (ctx.x ?? 0));
      const [id] = yield* choose(g, me, '搜費用X以下生物', opts, 1);
      if (id !== undefined) {
        const c = g.cards[id],
          beheld = src.eclBeheld ?? [];
        const same = beheld.length === 2 && !!src.eclBeholdType && matches(g, { sub: src.eclBeholdType }, c, me);
        if (same) enterBattlefield(g, c, me);
        else moveCard(g, c, 'hand');
      }
      shuffleArr(g, p.library);
      emit(g, { type: 'search', player: me });
      break;
    }
    case 'selfless': {
      const sub = yield* chooseEclType(g, me);
      yield* run([{ e: 'pump', what: { all: { ctrl: 'you', sub, other: true } }, p: 0, t: 0, kw: ['hexproof', 'indestructible'] }]);
      break;
    }
    case 'prismabasher': {
      const n = vividColors(g, me).length;
      const ids = ctx.targets.flatMap((t) => (t && 'c' in t ? [t.c] : []));
      for (const id of ids) g.eot.push({ card: id, p: n, t: n, kw: [] });
      break;
    }
    case 'spry': {
      const ids = yield* choose(g, me, '選擇恰好兩個生物', eligible(g, me, { type: 'Creature' }), 2, 2);
      if (ids.length < 2) break;
      const n = Math.abs(stats(g, g.cards[ids[0]]).p - stats(g, g.cards[ids[1]]).p);
      drawCards(g, me, n);
      for (const id of ids) g.eot.push({ card: id, p: n, t: n, kw: ['trample'] });
      break;
    }
    case 'trystanFront':
      yield* run([
        { e: 'mill', n: 3 },
        { e: 'if', cond: { c: 'gyCount', filter: { sub: 'Elf' }, n: 1 }, then: [{ e: 'gain', n: 2 }] },
      ]);
      break;
    case 'trystanBack':
      yield* run([{ e: 'mill', n: 3 }]);
      {
        const [id] = yield* choose(
          g,
          me,
          '可放逐一張精靈牌',
          p.graveyard.filter((id) => matches(g, { sub: 'Elf' }, g.cards[id], me)),
        );
        if (id !== undefined) {
          moveCard(g, g.cards[id], 'exile');
          loseLife(g, opp, 2);
        }
        break;
      }
    case 'abigale': {
      const c = card();
      if (c) {
        c.eclLoseAbilities = true;
        for (const kw of ['flying', 'first_strike', 'lifelink'] as const) {
          (c.eclCounters ??= {})[kw] = ((c.eclCounters ?? {})[kw] ?? 0) + 1;
        }
        emit(g, { type: 'counterPlaced', card: c.id, controller: c.controller, amount: 3, counterKind: 'keyword' });
      }
      break;
    }
    case 'armyDamage': {
      const pid = resolveRef(g, ctx, ef.what ?? 'T0').players[0];
      if (pid !== undefined) for (const id of eligible(g, pid, { type: 'Creature' })) dealDamage(g, src, me, { c: id }, ef.n ?? 2);
      break;
    }
    case 'armyPump':
    case 'armyLifelink': {
      const pid = resolveRef(g, ctx, ef.what ?? 'T0').players[0];
      if (pid === undefined) break;
      for (const id of eligible(g, pid, { type: 'Creature' })) {
        if (ef.n === 3) g.cards[id].tapped = false;
        g.eot.push({ card: id, p: ef.n ?? 0, t: ef.n ?? 0, kw: ef.action === 'armyLifelink' ? ['lifelink'] : ef.n === 1 ? ['haste'] : [] });
      }
      break;
    }
    case 'bre': {
      let c: Card | undefined;
      while (p.library.length) {
        c = g.cards[p.library[0]];
        moveCard(g, c, 'exile');
        if (!isLand(c)) break;
        c = undefined;
      }
      if (c) {
        if (manaValue(c.def) <= p.lifeGainedThisTurn) {
          if (yield* yes(g, me, '免費施放揭示的非地牌？')) yield* freeCast(g, ctx, c);
        } else moveCard(g, c, 'hand');
      }
      break;
    }
    case 'chaos':
      if (!(canPayCost(g, me, parseCost('{2}')) && (yield* yes(g, me, '支付{2}以免枯萎2？')) && payCost(g, me, parseCost('{2}'))))
        yield* blight(g, me, 2);
      break;
    case 'doranAttack':
      if (ctx.ev?.type === 'youAttack')
        for (const id of ctx.ev.attackers) {
          const c = g.cards[id],
            st = stats(g, c),
            n = Math.abs(st.p - st.t);
          g.eot.push({ card: id, p: n, t: n, kw: [] });
        }
      break;
    case 'doranBlock':
      if (evCard) {
        const st = stats(g, evCard),
          n = Math.abs(st.p - st.t);
        g.eot.push({ card: evCard.id, p: n, t: n, kw: [] });
      }
      break;
    case 'dreamHarvest': {
      const ids: number[] = [];
      let total = 0;
      while (g.players[opp].library.length && total < 5) {
        const c = g.cards[g.players[opp].library[0]];
        linked(c);
        total += manaValue(c.def);
        ids.push(c.id);
        impulse(c, g.turn, true);
      }
      break;
    }
    case 'figure': {
      const n = ef.n ?? 1;
      if (n === 2 && !matches(g, { sub: 'Scout' }, src, me)) break;
      if (n === 3 && !matches(g, { sub: 'Soldier' }, src, me)) break;
      changeDef(src, {
        power: [0, 2, 4, 7][n],
        toughness: [0, 3, 5, 8][n],
        subtypes: ['Kithkin', ['', 'Scout', 'Soldier', 'Avatar'][n]],
        changeling: false,
      });
      if (n === 3) (src.permanentGrants ??= []).push({ kw: ['protection_opponent'] });
      break;
    }
    case 'grubMill': {
      const pid = resolveRef(g, ctx, 'T0').players[0] ?? me;
      const top = g.players[pid].library.slice(0, 5);
      for (const id of top) moveCard(g, g.cards[id], 'graveyard');
      for (const id of top) if (matches(g, { sub: 'Goblin' }, g.cards[id], pid)) moveCard(g, g.cards[id], 'hand');
      break;
    }
    case 'kirol': {
      const item = g.stack.find((s) => s.sid === ef.n && s.controller === me && s.kind === 'trigger');
      if (item) {
        const copy = { ...item, sid: g.nextSid++, targets: item.targets.slice() };
        if (item.targetSpecs.length) {
          const rr: Response = yield {
            type: 'targets',
            player: me,
            source: item.cardId,
            specs: item.targetSpecs,
            text: item.text,
            effects: item.effects,
          };
          if (rr.type === 'targets' && !validateTargets(g, item.targetSpecs, rr.targets, me, item.cardId)) copy.targets = rr.targets;
        }
        copy.targetVersions = copy.targets.map((t) => (t && 'c' in t ? (g.cards[t.c]?.objectVersion ?? 0) : undefined));
        g.stack.push(copy);
      }
      break;
    }
    case 'maralenExile': {
      const pid = resolveRef(g, ctx, 'T0').players[0] ?? opp;
      for (let i = 0; i < 2 && g.players[pid].library.length; i++) {
        const c = g.cards[g.players[pid].library[0]];
        linked(c);
        impulse(c, g.turn, true, linkKey, 'maralen');
      }
      break;
    }
    case 'sanar': {
      const colors = vividColors(g, me),
        top: number[] = [];
      let n = 0;
      for (const id of p.library) {
        top.push(id);
        if (!isLand(g.cards[id]) && ++n >= colors.length) break;
      }
      if (!colors.length) break;
      const chosen = new Set<number>();
      for (const col of colors) {
        const [id] = yield* choose(
          g,
          me,
          `可放逐一張${col}牌，本回合可施放`,
          top.filter((id) => !chosen.has(id) && colorsOf(g.cards[id].def).includes(col)),
        );
        if (id !== undefined) {
          chosen.add(id);
          linked(g.cards[id]);
          impulse(g.cards[id], g.turn);
        }
      }
      shuffleArr(g, p.library);
      break;
    }
    case 'urchin': {
      const n =
        ctx.ev && 'counterKinds' in ctx.ev
          ? Object.values(ctx.ev.counterKinds ?? {}).reduce<number>((sum, n) => sum + Math.abs(Number(n)), 0)
          : Math.abs(evCard?.lastCounters ?? 0);
      for (let i = 0; i < n && p.library.length; i++) {
        const c = g.cards[p.library[0]];
        linked(c);
        c.eclCast = { by: me, until: g.turn + 1, mode: 'nextEnd' };
      }
      break;
    }
    case 'allColors': {
      const c = card();
      if (c) changeDef(c, { colors: ['W', 'U', 'B', 'R', 'G'] }, true);
      break;
    }
    case 'chosenDraw':
      if (
        ctx.ev?.type === 'cast' &&
        (ctx.sourceType ?? src.eclType) &&
        matches(g, { sub: (ctx.sourceType ?? src.eclType)! }, g.cards[ctx.ev.card], me)
      )
        drawCards(g, me, 1);
      break;
    case 'wickermawMana': {
      const col = yield* color(g, me);
      (p.pool ??= []).push(col);
      changeDef(src, { colors: [col] }, true);
      break;
    }
    case 'gathering': {
      const id = p.library[0],
        c = g.cards[id];
      if (!c) break;
      let take = false;
      if (src.eclType && matches(g, { sub: src.eclType }, c, me)) take = yield* yes(g, me, '揭示所選類別的頂牌並取到手上？');
      if (take) moveCard(g, c, 'hand');
      else if (yield* yes(g, me, '將頂牌置入墳墓場？')) moveCard(g, c, 'graveyard');
      break;
    }
    case 'pucaColor': {
      const col = yield* color(g, me);
      changeDef(src, { colors: [col] });
      break;
    }
    case 'mutavault':
      changeDef(src, { types: ['Land', 'Creature'], power: 2, toughness: 2, changeling: true }, true);
      break;
    default:
      throw new Error('Unknown ECL effect ' + ef.action);
  }
  g.version++;
}
