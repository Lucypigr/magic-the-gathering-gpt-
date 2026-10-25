import {campusTargets} from './campus-casting';
import {beholdOptions,canReceiveCounters} from './ecl-support';
// Shared choices for TLA cards that cannot be expressed as a fixed effect list.
import { canPayCost, maxXFor, frontierStackChoices,castDef,castDuringResolution, castTargetSpecs, payCost, spellEffects } from './actions';
import { resolveRef, runEffects, type Ctx } from './effects';
import { manaValue, parseCost } from './mana';
import { cardName, isCreature, isLand, matches, other, shuffleArr, stats } from './state';
import { hasTargetsAvailable, legalTargets, validateTargets } from './targets';
import type { Card, Effect, GameState, PID, Ref, Response, SubFlow, TargetSpec } from './types';
import {
  bend,
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
  tapCard,
  transformCard,
} from './zones';

export function* choose(g: GameState, pid: PID, prompt: string, options: number[], min = 0, max = 1): SubFlow<number[]> {
  if (!options.length || max <= 0) return [];
  min = Math.min(min, options.length);
  max = Math.min(max, options.length);
  const r: Response = yield { type: 'choose', player: pid, prompt, options, min, max, reveal: true, purpose: 'dig' };
  const ids = r.type === 'choose' ? [...new Set(r.ids)].filter((id) => options.includes(id)).slice(0, max) : [];
  for (const id of options) if (ids.length < min && !ids.includes(id)) ids.push(id);
  return ids;
}
export function* target(g: GameState, ctx: Ctx, spec: TargetSpec, effects: Effect[]): SubFlow {
  if (!legalTargets(g, spec, ctx.controller, ctx.source).length) return;
  const r: Response = yield {
    type: 'targets',
    player: ctx.controller,
    source: ctx.source,
    specs: [spec],
    text: g.cards[ctx.source].def.text,
    effects,
  };
  if (r.type === 'targets' && !validateTargets(g, [spec], r.targets, ctx.controller, ctx.source))
    yield* runEffects(g, { ...ctx, targets: r.targets }, effects);
}
export function* freeCast(g: GameState, ctx: Ctx, c: Card, free=true,alt?:import('./types').CastAlt): SubFlow<boolean> {
  const view=castDef(c.def,alt);
  const extra:Partial<Extract<import('./types').PriorityAction,{type:'cast'}>>={alt};
  let mode:number|undefined;
  if(view.spell?.modes){
    const modes=view.spell.modes;
    const legal=modes.map((_,i)=>i).filter(i=>hasTargetsAvailable(g,modes[i].targets??[],ctx.controller,c.id));
    if(!legal.length)return false;
    const r:Response=yield {type:'mode',player:ctx.controller,source:c.id,prompt:'選擇施放模式',options:legal.map(i=>modes[i].text),count:1,purpose:'trigger'};
    mode=legal[r.type==='modes'?(r.picks[0]??0):0];
  }
  if(!free&&alt!=='campusMiracle'&&parseCost(view.cost).x){const max=maxXFor(g,ctx.controller,c,mode,alt)??0;const r:Response=yield{type:'mode',player:ctx.controller,prompt:'選擇X',options:Array.from({length:max+1},(_,i)=>String(i)),count:1,purpose:'count'};extra.x=r.type==='modes'?r.picks[0]??0:0;}
  if(view.ecl?.variableTargets){const cap=view.frontier?.distribute==='X'?extra.x??0:view.frontier?.distribute??g.battlefield.length;const count=Math.min(cap,g.battlefield.filter(id=>isCreature(g.cards[id])&&(view.frontier?.variableTargets!=='own'||g.cards[id].controller===ctx.controller)).length);const r:Response=yield {type:'mode',player:ctx.controller,prompt:'選擇目標生物數量',options:Array.from({length:count+1},(_,i)=>String(i)),count:1,purpose:'count'};mode=r.type==='modes'?r.picks[0]??0:0;}
  const specs = campusTargets(g,ctx.controller,c,view,castTargetSpecs(view,mode),mode);
  let targets: Ctx['targets'] = [];
  if (specs.length) {
    const r: Response = yield {type:'targets',player:ctx.controller,source:c.id,specs,text:view.text,effects:spellEffects(view,mode)};
    if (r.type !== 'targets' || validateTargets(g, specs, r.targets, ctx.controller, c.id)) return false;
    targets = r.targets;
  }
  const total=view.frontier?.distribute==='X'?extra.x??0:view.frontier?.distribute;
  if(total!==undefined){let left=total;extra.distribution=[];for(let i=0;i<targets.length;i++){const max=left-(targets.length-i-1);let n=left;if(i<targets.length-1&&max>0){const r:Response=yield{type:'mode',player:ctx.controller,prompt:'分配指示物',options:Array.from({length:max},(_,j)=>String(j+1)),count:1,purpose:'count'};n=1+(r.type==='modes'?r.picks[0]??0:0);}extra.distribution.push(n);left-=n;}}
  const stackKinds=view.spell?.modes?.[mode??0]?.frontierStackTargets??(view.frontierStack?[view.frontierStack]:[]);
  if(stackKinds.length){extra.stackTargetSids=[];for(const kind of stackKinds){const items=frontierStackChoices(g,ctx.controller,kind);if(!items.length)return false;const r:Response=yield{type:'mode',player:ctx.controller,prompt:'選擇堆疊目標',options:items.map(s=>s.text),count:1,purpose:'trigger'};extra.stackTargetSids.push(items[r.type==='modes'?r.picks[0]??0:0].sid);}}
  let sac:number|undefined;
  const sacFilter=view.spell?.modes?.[mode??0]?.sac??view.addCost?.sac;
  if(sacFilter){
    const options=g.battlefield.filter(id=>g.cards[id].controller===ctx.controller&&matches(g,sacFilter,g.cards[id],ctx.controller,c.id));
    [sac]=yield* choose(g,ctx.controller,'選擇額外犧牲費用',options,1);
    if(sac===undefined)return false;
  }

  const blight=view.spell?.modes?.[mode??0]?.blight??view.addCost?.blight;
  if(blight){const options=g.battlefield.filter(id=>g.cards[id].controller===ctx.controller&&isCreature(g.cards[id])&&canReceiveCounters(g,g.cards[id]));[extra.blightCard]=yield* choose(g,ctx.controller,'選擇枯萎費用',options,1);if(extra.blightCard===undefined)return false;}
  const req=view.ecl?.behold;if(req&&!req.flashbackOnly){let pick=true;if(req.optional||req.tax){const r:Response=yield {type:'yesno',player:ctx.controller,prompt:'支付Behold額外費用？'};pick=r.type==='yesno'&&r.yes;}extra.beheld=pick?yield* choose(g,ctx.controller,'選擇Behold物件',beholdOptions(g,ctx.controller,c),req.n,req.n):[];}
  return castDuringResolution(g, ctx.controller, c.id, targets, free,mode,sac,extra) === null;
}
function waterMax(g: GameState, pid: PID, cap = 30): number {
  let n = 0;
  while (n < cap && canPayCost(g, pid, parseCost(''), undefined, false, undefined, false, n + 1)) n++;
  return n;
}
const ownCreatures = (g: GameState, p: PID) => g.battlefield.filter((id) => g.cards[id].controller === p && isCreature(g.cards[id]));
export function* tlaEffect(g: GameState, ctx: Ctx, ef: Extract<Effect, { e: 'tla' }>): SubFlow {
  const me = ctx.controller,
    opp = other(me),
    src = g.cards[ctx.source],
    p = g.players[me];
  const card = (ref: Ref = ef.what ?? 'T0') => resolveRef(g, ctx, ref).cards[0];
  const run = (effects: Effect[]) => runEffects(g, ctx, effects);
  const linked = (c: Card) => {
    moveCard(g, c, 'exile');
    c.tlaExiledBy = src.id;
  };
  switch (ef.action) {
    case 'herbalist': {
      for (let i = 0; i < 2; i++) {
        const colors = ['W', 'U', 'B', 'R', 'G'] as const;
        const r: Response = yield {
          type: 'mode',
          player: me,
          prompt: '選擇課程專用法術力顏色',
          options: [...colors],
          count: 1,
          purpose: 'color',
        };
        const pick = r.type === 'modes' ? (r.picks[0] ?? 0) : 0;
        (p.poolLesson ??= []).push(colors[pick] ?? 'W');
      }
      break;
    }
    case 'energy':
      for (const id of g.battlefield) {
        const c = g.cards[id];
        if (c.controller === me && isLand(c)) {
          c.baseDef ??= c.def;
          c.def = {
            ...c.def,
            subtypes: [...new Set([...(c.def.subtypes ?? []), 'Plains', 'Island', 'Swamp', 'Mountain', 'Forest'])],
            produces: ['W', 'U', 'B', 'R', 'G'],
          };
        }
      }
      break;
    case 'avatarType': {
      const c = card();
      if (c) {
        c.baseDef ??= c.def;
        c.def = { ...c.def, subtypes: [...(c.def.subtypes ?? []), 'Avatar'] };
      }
      break;
    }
    case 'appa': {
      const choices = g.battlefield.filter((id) => {
        const c = g.cards[id];
        return (
          c.controller === me &&
          id !== src.id &&
          !isLand(c) &&
          legalTargets(g, { kind: 'permanent', filter: { ctrl: 'you' } }, me, src.id).some((t) => 'c' in t && t.c === id)
        );
      });
      for (const id of yield* choose(g, me, '選擇御氣的永久物', choices, 0, choices.length))
        yield* runEffects(g, { ...ctx, targets: [{ c: id }] }, [{ e: 'airbend', what: 'T0' }]);
      break;
    }
    case 'exileAlly':
      if (ctx.ev?.type === 'cast' && g.cards[ctx.ev.card].castOrigin === 'exile') createToken(g, 'tok-ally', me);
      break;
    case 'wrath': {
      const keep = card();
      const ids = g.battlefield.filter((id) => isCreature(g.cards[id]) && id !== keep?.id);
      for (const id of ids) {
        moveCard(g, g.cards[id], 'exile');
        if (!g.cards[id].token) g.cards[id].airbent = true;
      }
      if (ids.length) bend(g, me, 'air');
      g.players[opp].noExileCastUntil = Infinity;
      g.players[opp].noExileCastBy = me;
      break;
    }
    case 'confrontation':
      for (const pid of [me, opp]) {
        const options = ownCreatures(g, pid);
        const selected = yield* choose(g, pid, '保留總力量至多4的生物', options, 0, options.length);
        const keep: number[] = [];
        let power = 0;
        for (const id of selected) {
          const n = Math.max(0, stats(g, g.cards[id]).p);
          if (power + n <= 4) {
            keep.push(id);
            power += n;
          }
        }
        for (const id of options) if (!keep.includes(id)) sacrifice(g, g.cards[id]);
      }
      break;
    case 'redemption': {
      const id = src.attachedTo ?? src.lastAttachedTo;
      const c = id != null ? g.cards[id] : undefined;
      if (c?.zone === 'battlefield') moveCard(g, c, 'exile');
      createToken(g, 'tok-ally', me);
      break;
    }
    case 'wave': {
      const options = legalTargets(g, { kind: 'creature' }, me, src.id).flatMap((t) => ('c' in t ? [t.c] : []));
      const max = waterMax(g, me);
      const r: Response = yield {
        type: 'mode',
        player: me,
        purpose: 'count',
        prompt: '選擇御水X',
        options: Array.from({ length: max + 1 }, (_, n) => `御水${n}`),
        count: 1,
      };
      const n = r.type === 'modes' ? Math.max(0, Math.min(max, r.picks[0] ?? 0)) : 0;
      if (!payCost(g, me, parseCost(''), undefined, false, undefined, false, n)) break;
      for (const id of yield* choose(g, me, '橫置至多X個生物', options, 0, n)) tapCard(g, g.cards[id]);
      for (let i = 0; i < 3; i++) {
        const tapped = g.battlefield.filter((id) => {
          const c = g.cards[id];
          return c.controller === opp && c.tapped && isCreature(c);
        });
        const [id] = yield* choose(g, me, '選擇暈眩指示物的生物', tapped, 1);
        if (id !== undefined) g.cards[id].stun++;
      }
      break;
    }
    case 'honest': {
      const c = src.attachedTo != null ? g.cards[src.attachedTo] : undefined;
      if (c) {
        tapCard(g, c);
        c.counters = 0;
        c.stun = 0;
        c.charge = 0;
        c.auraBaseDef ??= c.def;
        c.def = { ...c.def, name: 'Humble Merchant', subtypes: ['Citizen'], power: 1, toughness: 1, produces: ['C'] };
      }
      break;
    }
    case 'submersible':
      if (!src.def.types.includes('Creature')) {
        src.tlaOriginalDef ??= src.def;
        src.def = { ...src.def, types: [...src.def.types, 'Creature'] };
      }
      break;
    case 'lost': {
      const c = card();
      if (!c) break;
      const r: Response = yield { type: 'yesno', player: c.owner, prompt: '放在牌庫第二張？（否則放牌庫底）' };
      moveCard(g, c, 'library', true);
      if (r.type === 'yesno' && r.yes) {
        const lib = g.players[c.owner].library;
        lib.splice(lib.indexOf(c.id), 1);
        lib.splice(Math.min(1, lib.length), 0, c.id);
      }
      break;
    }
    case 'bloodbend': {
      const r: Response = yield { type: 'yesno', player: me, prompt: '額外御水10來操控整個回合？' };
      const whole = r.type === 'yesno' && r.yes && payCost(g, me, parseCost(''), undefined, false, undefined, false, 10);
      g.playerControl = { controller: me, player: opp, whole, starts: g.turn + 1, ends: Infinity };
      break;
    }
    case 'revival':
      for (const id of [...p.graveyard]) moveCard(g, g.cards[id], 'library');
      shuffleArr(g, p.library);
      drawCards(g, me, 7);
      p.noHandLimit = true;
      break;
    case 'teo': {
      drawCards(g, me, 1);
      const [id] = yield* choose(g, me, '棄一張牌', p.hand.slice(), 1);
      if (id !== undefined) {
        const nonland = !isLand(g.cards[id]);
        discard(g, g.cards[id]);
        if (nonland) yield* target(g, ctx, { kind: 'creature', filter: { ctrl: 'you' } }, [{ e: 'counters', what: 'T0', n: 1 }]);
      }
      break;
    }
    case 'chiBlock': {
      const c = card();
      if (c) {
        tapCard(g, c);
        c.noUntapBy = src.id;
        c.noUntapController = me;
      }
      break;
    }
    case 'wan':
      drawCards(g, me, Math.floor((src.castX ?? 0) / 2));
      break;
    case 'yue': {
      const options = p.hand.filter((id) => !isCreature(g.cards[id]) && !isLand(g.cards[id]));
      const [id] = yield* choose(g, me, '免費施放一個非生物咒語', options);
      if (id !== undefined) yield* freeCast(g, ctx, g.cards[id]);
      break;
    }
    case 'rioterExile': {
      const c = card();
      if (c) linked(c);
      break;
    }
    case 'rioterCast': {
      const options = p.exile.filter((id) => g.cards[id].tlaExiledBy === src.id && g.cards[id].def.subtypes?.includes('Ally'));
      const [id] = yield* choose(g, me, '施放放逐的盟友（需支付費用）', options);
      if (id !== undefined) {
        const c = g.cards[id];
        c.playableTurn = g.turn;
        c.playableBy = me;
      }
      break;
    }
    case 'inherit': {
      const ev = ctx.ev;
      if (ev && 'card' in ev) {
        const c = g.cards[ev.card];
        putCounters(g, src, c.lastCounters ?? 0);
      }
      break;
    }
    case 'fatal': {
      const c = card();
      if (c) (g.delayed ??= []).push({ controller: me, source: c.id, on: 'dies', effects: [{ e: 'earthbend', n: 4 }], once: true });
      break;
    }
    case 'visions': {
      const options = g.players.flatMap((p) => p.graveyard).filter((id) => isCreature(g.cards[id]));
      const max = waterMax(g, me, Math.min(options.length, 30));
      const r: Response = yield {
        type: 'mode',
        player: me,
        purpose: 'count',
        prompt: '選擇御水X',
        options: Array.from({ length: max + 1 }, (_, n) => `御水${n}`),
        count: 1,
      };
      const n = r.type === 'modes' ? Math.max(0, Math.min(max, r.picks[0] ?? 0)) : 0;
      if (!payCost(g, me, parseCost(''), undefined, false, undefined, false, n)) break;
      for (const id of yield* choose(g, me, '放逐生物牌並複製', options, 0, n)) {
        const c = g.cards[id];
        moveCard(g, c, 'exile');
        yield* runEffects(g, { ...ctx, targets: [{ c: id }] }, [{ e: 'copyCreature', what: 'T0', temp: true }]);
      }
      break;
    }
    case 'kohExile': {
      const c = card();
      if (c) linked(c);
      break;
    }
    case 'kohDead':
      if (ctx.ev?.type === 'dies') {
        const c = g.cards[ctx.ev.card];
        if (c.zone === 'graveyard') linked(c);
      }
      break;
    case 'kohChoose': {
      const options = g.players.flatMap((p) => p.exile).filter((id) => g.cards[id].tlaExiledBy === src.id && isCreature(g.cards[id]));
      const [id] = yield* choose(g, me, '選擇要取得異能的生物', options, 1);
      if (id !== undefined) src.copiedAbilities = (g.cards[id].def.abilities ?? []).filter((a) => a.kind !== 'static');
      break;
    }
    case 'fleet': {
      const copies = g.battlefield.filter((id) => g.cards[id].controller === me && g.cards[id].def.name === 'Phoenix Fleet Airship');
      if (copies.length >= 8)
        for (const id of copies) {
          const c = g.cards[id];
          if (!isCreature(c)) {
            c.tlaOriginalDef ??= c.def;
            c.def = { ...c.def, types: [...c.def.types, 'Creature'] };
          }
        }
      break;
    }
    case 'raven': {
      const c = card();
      if (c) {
        const creature = isCreature(c);
        moveCard(g, c, 'exile');
        if (creature) createToken(g, 'tok-clue', me);
      }
      break;
    }
    case 'ruinous':
      (g.delayed ??= []).push({ controller: me, source: src.id, on: 'otherDies', effects: [{ e: 'gain', n: 1 }], once: false });
      break;
    case 'combustion': {
      const c = card();
      if (!c) break;
      const r: Response = yield { type: 'yesno', player: c.controller, prompt: `受到${stats(g, src).p}點傷害來保留永久物？` };
      if (r.type === 'yesno' && r.yes) {
        yield* runEffects(g, { ...ctx, targets: [{ p: c.controller }] }, [{ e: 'damage', n: { power: 'self' }, to: 'T0' }]);
      } else destroyCards(g, [c]);
      break;
    }
    case 'fated':
      src.charge = src.castX ?? 0;
      break;
    case 'riot': {
      const t = ctx.targets[1];
      if (t && 'p' in t) yield* run([{ e: 'pump', what: { all: { type: 'Creature', ctrl: t.p === me ? 'you' : 'opp' } }, p: 2, t: 0 }]);
      break;
    }
    case 'nextLesson':
      (g.delayed ??= []).push({
        controller: me,
        source: src.id,
        on: 'castAny',
        filter: { sub: 'Lesson' },
        effects: [{ e: 'copySpell' }],
        once: true,
      });
      break;
    case 'steal': {
      const c = card();
      if (c) {
        c.returnControl = { player: c.controller, turn: g.turn };
        c.controller = me;
        c.tapped = false;
        yield* run([{ e: 'pump', what: ef.what ?? 'T0', p: 0, t: 0, kw: ['haste'] }]);
      }
      break;
    }
    case 'agni': {
      const a = card('T0'),
        b = card('T1');
      if (a && b) {
        const excess = Math.max(0, stats(g, a).p - (stats(g, b).t - b.damage));
        yield* run([
          { e: 'fight', a: 'T0', b: 'T1' },
          { e: 'addMana', mana: ['R'], n: excess },
        ]);
        p.keepRedTurn = g.turn;
      }
      break;
    }
    case 'ran': {
      const n = p.graveyard.filter((id) => g.cards[id].def.subtypes?.some((s) => s === 'Dragon' || s === 'Lesson')).length;
      if (src.wasCast && n >= 3) yield* run([{ e: 'copyCreature', what: 'self', nonLegendary: true }]);
      break;
    }
    case 'redirect': {
      const options = g.stack.filter((s) => s.cardId !== src.id && s.targets.filter(Boolean).length === 1).map((s) => s.cardId);
      const [id] = yield* choose(g, me, '選擇要更改目標的咒語或異能', options, 1);
      const item = g.stack.find((s) => s.cardId === id);
      if (item) {
        const i = item.targets.findIndex(Boolean),
          spec = item.targetSpecs[i];
        const r: Response = yield {
          type: 'targets',
          player: me,
          source: item.cardId,
          specs: [spec],
          text: item.text,
          effects: item.effects,
        };
        if (r.type === 'targets' && !validateTargets(g, [spec], r.targets, item.controller, item.cardId)) item.targets[i] = r.targets[0];
      }
      break;
    }
    case 'solstice': {
      while (p.library.length) {
        const c = g.cards[p.library[0]];
        moveCard(g, c, 'exile');
        if (isLand(c)) continue;
        const n = g.battlefield.filter((id) => g.cards[id].controller === me && g.cards[id].def.subtypes?.includes('Mountain')).length;
        const r: Response = yield { type: 'yesno', player: me, prompt: '免費施放此牌？' };
        if (manaValue(c.def) < n && r.type === 'yesno' && r.yes && (yield* freeCast(g, ctx, c))) break;
        moveCard(g, c, 'hand');
        break;
      }
      break;
    }
    case 'comet':
      for (const id of ownCreatures(g, me)) g.cards[id].grantedFirebend = { n: 5, turn: g.turn };
      break;
    case 'balloon':
      if ((src.charge ?? 0) >= 3 && !isCreature(src)) {
        src.tlaOriginalDef ??= src.def;
        src.def = { ...src.def, types: [...src.def.types, 'Creature'] };
      }
      break;
    case 'destiny': {
      const dead = src.attachedTo != null ? g.cards[src.attachedTo] : undefined;
      const n = dead?.lastPower ?? ctx.lkiPower ?? 0;
      const ids = p.library.slice(0, n);
      for (const id of ids) moveCard(g, g.cards[id], 'graveyard');
      if (src.zone === 'battlefield' || src.zone === 'graveyard') moveCard(g, src, 'hand');
      const [id] = yield* choose(
        g,
        me,
        '復活磨到的生物',
        ids.filter((id) => isCreature(g.cards[id]) && g.cards[id].zone === 'graveyard'),
      );
      if (id !== undefined) enterBattlefield(g, g.cards[id], me);
      break;
    }
    case 'trials': {
      const n = Math.min(3, p.graveyard.filter((id) => g.cards[id].def.subtypes?.includes('Lesson')).length);
      if (n) {
        const r: Response = yield {
          type: 'mode',
          player: me,
          purpose: 'count',
          prompt: '選擇至多課程數的試煉',
          count: n,
          options: ['三個指示物', '占卜3', '大地彎折3'],
        };
        if (r.type === 'modes')
          for (const i of [...new Set(r.picks)].slice(0, n))
            yield* run(
              i === 0
                ? [{ e: 'counters', what: 'self', n: 3 }]
                : i === 1
                  ? [{ e: 'scry', n: 3 }]
                  : i === 2
                    ? [{ e: 'earthbend', n: 3 }]
                    : [],
            );
      }
      break;
    }
    case 'teachings': {
      const options = p.library.filter((id) => isLand(g.cards[id]));
      const selected = yield* choose(g, me, '找至多四個不同名地', options, 0, 4);
      const names = new Set<string>();
      const unique = selected.filter((id) => {
        const name = g.cards[id].def.name;
        if (names.has(name)) return false;
        names.add(name);
        return true;
      });
      const grave = yield* choose(g, opp, '選兩張置入墳墓場', unique, Math.min(2, unique.length), 2);
      for (const id of unique)
        if (grave.includes(id)) moveCard(g, g.cards[id], 'graveyard');
        else enterBattlefield(g, g.cards[id], me, true);
      shuffleArr(g, p.library);
      emit(g, { type: 'search', player: me });
      break;
    }
    case 'ostrich': {
      const ids = p.library.slice(0, 3);
      for (const id of ids) moveCard(g, g.cards[id], 'graveyard');
      const [id] = yield* choose(
        g,
        me,
        '取回磨到的地',
        ids.filter((id) => isLand(g.cards[id])),
      );
      if (id !== undefined) moveCard(g, g.cards[id], 'hand');
      else putCounters(g, src, 1);
      break;
    }
    case 'dummy': {
      const id = p.library[0];
      if (id !== undefined) {
        const c = g.cards[id];
        moveCard(g, c, 'graveyard');
        if (c.def.subtypes?.includes('Lesson')) gainLife(g, me, 2);
        if (isLand(c)) {
          const r: Response = yield { type: 'yesno', player: me, prompt: '將磨到的地置於手上？' };
          if (r.type === 'yesno' && r.yes) moveCard(g, c, 'hand');
        }
      }
      break;
    }
    case 'invasionDraw':
      if (ownCreatures(g, me).some((id) => g.cards[id].attacking && g.cards[id].def.subtypes?.includes('Ally') && g.cards[id].dealtCombat))
        drawCards(g, me, 1);
      break;
    case 'usurper': {
      const [id] = yield* choose(
        g,
        opp,
        '放逐一個非衍生生物',
        ownCreatures(g, opp).filter((id) => !g.cards[id].token),
        1,
      );
      if (id !== undefined) {
        linked(g.cards[id]);
        g.cards[id].linkedCast = { by: me, cond: { c: 'yourTurn' } };
      }
      const [gid] = yield* choose(
        g,
        opp,
        '放逐墳墓場一張非地牌',
        g.players[opp].graveyard.filter((id) => !isLand(g.cards[id])),
        1,
      );
      if (gid !== undefined) {
        linked(g.cards[gid]);
        g.cards[gid].linkedCast = { by: me, cond: { c: 'yourTurn' } };
      }
      break;
    }
    case 'bounty':
      if (ctx.ev?.type === 'dies') yield* run([{ e: 'earthbend', n: ctx.ev.power }]);
      break;
    case 'bumiCombat':
      g.extraCombat = { player: me, landOnly: true };
      break;
    case 'zukoCast':
      if (ctx.ev?.type === 'cast' && g.cards[ctx.ev.card].castOrigin === 'exile')
        yield* run([{ e: 'counters', what: { all: { type: 'Creature', ctrl: 'you' } }, n: 1 }]);
      break;
    case 'zukoEtb':
      if (ctx.ev?.type === 'etb' && g.cards[ctx.ev.card].enteredFrom === 'exile')
        yield* run([{ e: 'counters', what: { all: { type: 'Creature', ctrl: 'you' } }, n: 1 }]);
      break;
    case 'hama': {
      const options = g.players[opp].graveyard.filter((id) => !isLand(g.cards[id]) && !isCreature(g.cards[id]));
      const [id] = yield* choose(g, me, '放逐一張非生物非地牌', options);
      if (id !== undefined) {
        const c = g.cards[id];
        linked(c);
        c.linkedCast = { by: me, cond: { c: 'yourTurn' } };
        c.waterCastBy = src.id;
      }
      break;
    }
    case 'tea': {
      const [id] = yield* choose(
        g,
        me,
        '送給對手一個永久物',
        g.battlefield.filter((id) => g.cards[id].controller === me),
      );
      if (id !== undefined) {
        g.cards[id].controller = opp;
        const token = createToken(g, 'tok-ally', me);
        const n = g.battlefield.filter((id) => g.cards[id].owner === me && g.cards[id].controller === opp).length;
        if (token) putCounters(g, token, n);
      }
      break;
    }
    case 'kataraX': {
      const max = waterMax(g, me);
      if (!max) break;
      const r: Response = yield {
        type: 'mode',
        player: me,
        purpose: 'count',
        prompt: '選擇御水X',
        count: 1,
        options: Array.from({ length: max }, (_, i) => `御水${i + 1}`),
      };
      const n = r.type === 'modes' ? Math.min(max, Math.max(1, (r.picks[0] ?? 0) + 1)) : 1;
      if (payCost(g, me, parseCost(''), undefined, false, undefined, false, n))
        for (const id of ownCreatures(g, me)) g.eot.push({ card: id, p: 0, t: 0, kw: [], base: { p: n, t: n } });
      break;
    }
    case 'zeiLoot': {
      const [id] = yield* choose(g, me, '棄一張牌', p.hand.slice(), 1);
      if (id !== undefined) {
        discard(g, g.cards[id]);
        drawCards(g, me, 1);
      }
      break;
    }
    case 'scavengers': {
      if (src.zone !== 'graveyard') break;
      const r: Response = yield { type: 'yesno', player: me, prompt: '放逐此牌來復活生物？' };
      if (r.type === 'yesno' && r.yes) {
        const power = ctx.lkiPower ?? src.lastPower ?? 0;
        moveCard(g, src, 'exile');
        yield* target(g, ctx, { kind: 'gyCard', filter: { ctrl: 'you', type: 'Creature', mvMax: power } }, [
          { e: 'reanimate', what: 'T0' },
        ]);
      }
      break;
    }
    case 'sokkaLoot': {
      const ids = yield* choose(g, me, '棄至多兩張牌', p.hand.slice(), 0, 2);
      for (const id of ids) discard(g, g.cards[id]);
      drawCards(g, me, ids.length);
      break;
    }
    case 'conflicted': {
      const used = src.chosenModes ?? [];
      const options = [0, 1, 2, 3].filter((i) => !used.includes(i));
      if (!options.length) break;
      const r: Response = yield {
        type: 'mode',
        player: me,
        purpose: 'count',
        prompt: '選擇未使用的選項',
        count: 1,
        options: options.map((i) => ['抓牌', '放指示物', '加{R}', '送給對手'][i]),
      };
      const pick = options[r.type === 'modes' ? (r.picks[0] ?? 0) : 0];
      if (pick === undefined) break;
      src.chosenModes = [...used, pick];
      loseLife(g, me, 2);
      if (pick === 0) drawCards(g, me, 1);
      if (pick === 1) putCounters(g, src, 1);
      if (pick === 2) yield* run([{ e: 'addMana', mana: ['R'] }]);
      if (pick === 3) {
        moveCard(g, src, 'exile');
        enterBattlefield(g, src, opp);
      }
      break;
    }
    case 'planetarium': {
      const c = g.cards[p.library[0]];
      if (c && !isLand(c)) {
        const r: Response = yield { type: 'yesno', player: me, prompt: `免費施放${cardName(c)}？` };
        if (r.type === 'yesno' && r.yes) yield* freeCast(g, ctx, c);
      }
      break;
    }
    case 'boomerangReturn': {
      const eq = g.battlefield.map((id) => g.cards[id]).find((c) => c.def.id === 'trusty-boomerang' && c.attachedTo === src.id);
      if (eq) moveCard(g, eq, 'hand');
      break;
    }
    case 'boomerang': {
      const c = src.attachedTo != null ? g.cards[src.attachedTo] : undefined;
      if (c && c.controller === me && !c.tapped && (!c.sick || stats(g, c).kw.has('haste'))) {
        tapCard(g, c);
        yield* target(g, ctx, { kind: 'creature' }, [{ e: 'tap', what: 'T0' }]);
        moveCard(g, src, 'hand');
      }
      break;
    }
    case 'tile': {
      const counts = new Map<string, number>();
      for (const id of ownCreatures(g, me))
        for (const sub of new Set(g.cards[id].def.subtypes ?? [])) counts.set(sub, (counts.get(sub) ?? 0) + 1);
      yield* run([{ e: 'addManaOfChoice', n: Math.max(0, ...counts.values()) }]);
      break;
    }
    case 'palace': {
      const c = card();
      if (c) c.grantedFirebend = { n: 4, turn: g.turn };
      break;
    }
    case 'tunnel': {
      const a = card('T0'),
        b = card('T1');
      if (a && b && a.id !== b.id && (a.def.changeling || b.def.changeling || a.def.subtypes?.some((s) => b.def.subtypes?.includes(s))))
        yield* run([
          { e: 'pump', what: 'T0', p: 0, t: 0, kw: ['unblockable'] },
          { e: 'pump', what: 'T1', p: 0, t: 0, kw: ['unblockable'] },
        ]);
      break;
    }
    case 'yangchen': {
      const ids: number[] = [];
      for (const pid of [me, opp]) {
        const options = g.battlefield.filter((id) => g.cards[id].controller !== me && manaValue(g.cards[id].def) >= 3);
        const [id] = yield* choose(g, pid, '放逐對手費用至少3永久物', options);
        if (id !== undefined) ids.push(id);
      }
      for (const id of new Set(ids)) moveCard(g, g.cards[id], 'exile');
      break;
    }
    case 'sozinName': {
      const q = g.players[opp];
      const options = [...q.hand, ...q.library, ...q.graveyard];
      const [id] = yield* choose(g, me, '選擇牌名，放逐至多四張同名牌', options, 1);
      if (id !== undefined) {
        const name = g.cards[id].def.name;
        for (const cid of options.filter((id) => g.cards[id].def.name === name).slice(0, 4)) moveCard(g, g.cards[cid], 'exile');
        shuffleArr(g, q.library);
      }
      break;
    }
    case 'roku':
      for (const id of p.library.slice(0, 3)) {
        const c = g.cards[id];
        moveCard(g, c, 'exile');
        c.playableTurn = g.turn;
        c.playableBy = me;
        c.playableUntil = g.turn + 2;
      }
      break;
    case 'fourElements':
      if ((p.bends?.length ?? 0) >= 4 && src.zone === 'battlefield') transformCard(g, src);
      break;
    case 'crossroads':
      (g.delayed ??= []).push({
        controller: me,
        source: src.id,
        on: 'eachUpkeep',
        effects: [{ e: 'transform', what: 'self' }],
        once: true,
        persistent: true,
      });
      break;
    case 'extraTurn':
      g.normalTurnAfterExtra ??= other(g.active);
      (g.extraTurns ??= []).push(me);
      break;
    case 'sozin': {
      const q = g.players[opp];
      const options = q.graveyard.filter((id) => isCreature(g.cards[id]));
      const ids = yield* choose(g, me, '復活對手生物（支付其總費用）', options, 0, options.length);
      const cost = ids.reduce((n, id) => n + manaValue(g.cards[id].def), 0);
      if (payCost(g, me, parseCost(`{${cost}}`))) for (const id of ids) enterBattlefield(g, g.cards[id], me);
      break;
    }
    default:
      throw new Error(`未實作的TLA效果：${ef.action}`);
  }
  g.version++;
}
