import {orbitRefresh} from './orbit-station';
import {finishOmen} from './orbit';
import {campusRefresh} from './campus-zones';
import {campusCraftOptions} from './campus-casting';
import {campusTriggerAbility} from './campus-support';
import {forageOptions} from './meadow-costs';
import {meadowRefresh} from './meadow';
import {meadowTriggerAbility} from './meadow-support';
import {foundationExtraCosts} from './foundation-casting';
import {frontierStatic} from './frontier-support';
import {foundationRefresh} from './foundation-support';
import {commitCrime,refreshFrontierCopies} from './otj-support';
import {mshStatic} from './msh-support';
import {mkmStatic} from './mkm-support';
import {refreshFinLands} from './fin-support';
import {colorsOf} from './mana';
import {resolveEclEntries} from './ecl';
import {beholdOptions,canReceiveCounters,counterKinds,vividColors} from './ecl-support';
import { abilitiesFor, frontierStackChoices,castDef,canActivate, crewChoice,finStackChoices, performAction, sacChoices } from './actions';
import {
  attackCandidates,
  blockCandidates,
  combatDamage,
  declareAttackers,
  declareBlockers,
  endCombat,
  hasFirstStrikers,
} from './combat';
import { runEffects, type Ctx } from './effects';
import {
  abilitiesOf,cardName,
  checkCond,
  GameOver,
  hasStaticFlag,
  isCreature,
  isPermanentDef,
  log,
  other,
  randInt,
  show,
  shuffleArr,
  stats,matches,
} from './state';
import { hasTargetsAvailable, isLegalTarget, legalTargets, validateTargets } from './targets';
import type { Card, Effect, Flow, GameState, PID, Response, SubFlow, TargetRef, TargetSpec } from './types';
import { addLore, discard, drawCards, emit, enterBattlefield, enterBattlefieldBack, moveCard,  putIntoGraveyard, sacrifice } from './zones';

// ------------------------------------------------------------
// 狀態動作
// ------------------------------------------------------------
export function checkSBA(g: GameState): void {
  for (let iter = 0; iter < 30; iter++) {
    let changed = false;
    refreshFrontierCopies(g);
    foundationRefresh(g);
    campusRefresh(g);
    meadowRefresh(g);
    orbitRefresh(g);
    for(const host of g.battlefield){for(const pid of [0,1]as PID[]){const roles=g.battlefield.filter(id=>g.cards[id].attachedTo===host&&g.cards[id].controller===pid&&g.cards[id].def.subtypes?.includes('Role'));if(roles.length>1){for(const id of roles.slice(0,-1))moveCard(g,g.cards[id],'graveyard');changed=true;}}}
    const losers = g.players.filter(p=>!frontierStatic(g,p.id,'fdn:cantLose').length&&(p.foundationLost||p.life<=0&&!frontierStatic(g,p.id,'dsk:grimoire').length||p.drewFromEmpty||(p.poison??0)>=10));
    if (losers.length) {
      for (const p of losers) p.lost = true;
      g.winner = losers.length === 2 ? 'draw' : other(losers[0].id);
      if (g.winner === 'draw') log(g, '雙方同時落敗，平手！', undefined, 'result');
      else log(g, `${g.players[g.winner].name} 獲勝！`, g.winner, 'result');
      throw new GameOver();
    }
    const dying: Card[] = [];
    for (const id of g.battlefield) {
      const c = g.cards[id];
      // 鵬洛客：忠誠為0時置入墳墓場
      if (c.def.types.includes('Planeswalker') && !isCreature(c) && (c.loyalty ?? 0) <= 0 && !hasStaticFlag(g, c.controller, 'noZeroLoyaltyDeath')) {
        dying.push(c);
        continue;
      }
      if (!isCreature(c)) continue;
      const st = stats(g, c);
      if (st.t <= 0) dying.push(c);
      else if ((c.damage >= st.t || c.dtDamage) && !st.kw.has('indestructible')) dying.push(c);
    }
    if (dying.length) {
      for (const c of dying) log(g, `${cardName(c)} 死去`, c.controller, 'combat');
      putIntoGraveyard(g, dying);
      changed = true;
    }
    for (const id of [...g.battlefield]) {
      const c = g.cards[id];
      if (c.zone !== 'battlefield') continue;
      if (c.def.aura) {
        const t = c.attachedTo != null ? g.cards[c.attachedTo] : undefined;
        if (c.attachedToPlayer===undefined&&(!t || t.zone !== 'battlefield' || (c.def.aura.target?.kind!=='permanent'&&!isCreature(t)))) {
          moveCard(g, c, 'graveyard');
          changed = true;
        }
      } else if (c.def.equip && c.attachedTo != null) {
        const t = g.cards[c.attachedTo];
        if (isCreature(c) || !t || t.zone !== 'battlefield' || !isCreature(t)) {
          c.attachedTo = null;
          changed = true;
        }
      }
    }
    // 傳奇（Saga）：最後一章結算完畢後犧牲
    for (const id of [...g.battlefield]) {
      const c = g.cards[id];
      const n = c.def.saga?.chapters.length;
      if (!n || (c.lore ?? 0) < n) continue;
      if (g.stack.some((s) => s.cardId === c.id && s.kind === 'trigger') || g.pending.some((p) => p.source === c.id)) continue;
      log(g, `${cardName(c)} 的最後一章結束，犧牲`, c.controller);
      sacrifice(g, c);
      changed = true;
    }
    // 傳奇規則：保留最新進場的那個
    for (const pid of [0, 1] as PID[]) {
      if (g.legendExempt && g.legendExempt.pid === pid && g.legendExempt.turn === g.turn) continue;
      const seen = new Map<string, Card>();
      const extra: Card[] = [];
      for (const id of g.battlefield) {
        const c = g.cards[id];
        if (c.controller !== pid || !matches(g,{legendary:true},c,pid)) continue;
        const prev = seen.get(c.def.name);
        if (prev) extra.push(prev);
        seen.set(c.def.name, c);
      }
      if (extra.length) {
        for (const c of extra) log(g, `傳奇規則：${cardName(c)} 置入墳墓場`, pid);
        putIntoGraveyard(g, extra);
        changed = true;
      }
    }
    if (!changed) break;
  }
}

// ------------------------------------------------------------
// 觸發式能力上堆疊
// ------------------------------------------------------------
/** 把效果中的目標參照（T0、T1…）整體平移，用來合併多個模式 */
export function shiftRefs<T>(v: T, offset: number): T {
  if (offset === 0) return v;
  if (Array.isArray(v)) return v.map((x) => shiftRefs(x, offset)) as unknown as T;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o)) {
      const x = o[k];
      if (typeof x === 'string' && /^T\d+$/.test(x) && k !== 'text') out[k] = 'T' + (Number(x.slice(1)) + offset);
      else if (k === 't' && o.c === 'targetIs' && typeof x === 'number') out[k] = x + offset;
      else out[k] = shiftRefs(x, offset);
    }
    return out as T;
  }
  return v;
}

function* flushTriggers(g: GameState): SubFlow {
  const list = g.pending.splice(0);
  const ordered = [...list.filter((t) => t.controller === g.active), ...list.filter((t) => t.controller !== g.active)];
  for (const t of ordered) {
    let ab = campusTriggerAbility(g,g.cards[t.source],meadowTriggerAbility(g,g.cards[t.source],t.ability,t.ev));
    if(ab.campusAbilityTarget){const items=g.stack.filter(s=>s.kind!=='spell'&&!s.manaAbility);const r:Response=yield{type:'mode',player:t.controller,prompt:'選擇至多一個反擊異能的目標',options:['不選目標',...items.map(s=>s.text)],count:1,purpose:'trigger'};const index=r.type==='modes'?r.picks[0]??0:0;ab={...ab,effects:index&&items[index-1]?[{e:'frontier',action:'lci:81',n:items[index-1].sid}]:[]};}
    const src = g.cards[t.source];
    if(ab.mshDynamic==='wrecking'){ab={...ab,chooseN:Math.min(4,src.castX??0)};if(!ab.chooseN)continue;}
    let foundationMode:number|undefined;
    if(ab.foundationModes){const pact=ab.foundationModes==='pact',used=src.chosenModes??=[],available=Array.from({length:pact?4:3},(_,i)=>i).filter(i=>!used.includes(i));if(!available.length)continue;let chosen=available[0];if(available.length>1){const answer:Response=yield {type:'mode',player:t.controller,prompt:'選擇尚未選過的模式',options:available.map(i=>(pact?['4傷害且獲得4生命','目標對手棄二張','抽二張','你輸掉遊戲']:['兩個+1/+1指示物','抽牌','成為另一生物複製'])[i]),count:1,purpose:'trigger'};chosen=available[answer.type==='modes'?answer.picks[0]??0:0];}src.chosenModes=[...used,chosen];foundationMode=chosen;ab={...ab,targets:pact?chosen===0?[{kind:'any'}]:chosen===1?[{kind:'player',filter:{ctrl:'opp'}}]:undefined:chosen===2?[{kind:'creature',filter:{ctrl:'you'},notSelf:true}]:undefined};}
    let foundationDistribution:number[]|undefined;
    if(ab.foundationVariableTargets){const max=Math.min(ab.foundationVariableTargets,g.battlefield.filter(id=>isCreature(g.cards[id])).length);if(!max)continue;const answer:Response=yield{type:'mode',player:t.controller,prompt:'選擇目標數量',options:Array.from({length:max},(_,i)=>String(i+1)),count:1,purpose:'count'};const n=1+(answer.type==='modes'?answer.picks[0]??0:0);ab={...ab,targets:Array.from({length:n},()=>({kind:'creature'}))};foundationDistribution=n===1?[ab.foundationDistribution??2]:[1,1];}
    if (ab.modes) {
      // 模式式觸發：先選模式，再選目標
      const legal = ab.modes.map((_, i) => i).filter((i) => (!ab.modesOncePerTurn || src.classModesTurn?.turn!==g.turn || !src.classModesTurn.modes.includes(i)) && hasTargetsAvailable(g, ab.modes![i].targets ?? [], t.controller, t.source));
      const count = Math.min(ab.chooseN ?? 1, legal.length);
      if (count === 0) {
        log(g, `${cardName(src)} 的觸發式能力沒有可選的模式`, t.controller);
        continue;
      }
      let picks = legal;
      if (legal.length > count) {
        const r: Response = yield {
          type: 'mode',
          player: t.controller,
          prompt: `${cardName(src)}：選擇${count === 1 ? '一項' : `${count}項`}`,
          source: t.source,
          options: legal.map((i) => ab.modes![i].text),
          count,
          purpose: 'trigger',
          meta: { effects: legal.map((i) => ab.modes![i].effects), specs: legal.map((i) => ab.modes![i].targets ?? []) },
        };
        const chosen = r.type === 'modes' ? [...new Set(r.picks)].filter((k) => k >= 0 && k < legal.length).slice(0, count) : [];
        while (chosen.length < count) for (let k = 0; k < legal.length && chosen.length < count; k++) if (!chosen.includes(k)) chosen.push(k);
        picks = chosen.sort((a, b) => a - b).map((k) => legal[k]);
      }
      if(ab.modesOncePerTurn)src.classModesTurn={turn:g.turn,modes:[...(src.classModesTurn?.turn===g.turn?src.classModesTurn.modes:[]),...picks]};
      const eff: Effect[] = [];
      const sp: TargetSpec[] = [];
      for (const i of picks) {
        const m = ab.modes[i];
        eff.push(...shiftRefs(m.effects, sp.length));
        sp.push(...(m.targets ?? []));
      }
      ab = { ...ab, modes: undefined, effects: eff, targets: sp.length ? sp : undefined };
      log(g, `${cardName(src)}：選擇了「${picks.map((i) => t.ability.modes![i].text).join('」「')}」`, t.controller);
    }
    if(ab.mkmDynamic){
      const kind=ab.mkmDynamic;const total=kind==='vindicator'?src.mkmMarks?.faceUpX??0:kind==='maze'?src.castX??0:kind==='distribute2'?2:kind==='distribute3'?3:g.battlefield.length;
      const template:TargetSpec=kind==='vindicator'?{kind:'creatureOrGy',notSelf:true}:kind==='falcon'?{kind:'permanent',filter:{ctrl:'you'}}:{kind:'creature',...(kind==='distribute2'?{filter:{ctrl:'you' as const}}:{})};
      const available=legalTargets(g,template,t.controller,t.source).length;
      if(kind==='maze'&&available<total)continue;
      let n=kind==='maze'?total:Math.min(total,available);
      if(kind!=='maze'&&n>0){const min=kind.startsWith('distribute')?1:0;const r:Response=yield{type:'mode',player:t.controller,prompt:'選擇目標數量',options:Array.from({length:n-min+1},(_,i)=>String(i+min)),count:1,purpose:'count'};n=Math.min(n,min+(r.type==='modes'?r.picks[0]??0:0));}
      let effects=ab.effects;
      if(kind.startsWith('distribute')){let left=total;const allocation:Effect[]=[];for(let j=0;j<n;j++){const max=left-(n-j-1);let amount=max;if(j<n-1&&max>1){const r:Response=yield{type:'mode',player:t.controller,prompt:`分給第${j+1}個目標的指示物`,options:Array.from({length:max},(_,i)=>String(i+1)),count:1,purpose:'count'};amount=1+(r.type==='modes'?r.picks[0]??0:0);}allocation.push({e:'counters',what:(['T0','T1','T2'] as const)[j],n:amount});left-=amount;}effects=[...allocation,...effects.filter(e=>!(e.e==='mkm'&&e.action==='distribute'))];}
      ab={...ab,targets:Array.from({length:n},()=>template),effects};
    }
    if(ab.mshDynamic==='lifeTargets'||ab.mshDynamic==='equipment'){const max=ab.mshDynamic==='lifeTargets'?(t.ev.type==='lifegain'?t.ev.amount:0):g.battlefield.filter(id=>g.cards[id].controller===t.controller&&g.cards[id].def.subtypes?.includes('Equipment')).length;const r:Response=yield{type:'mode',player:t.controller,prompt:'選擇目標數量',options:Array.from({length:max+1},(_,i)=>String(i)),count:1,purpose:'count'};const n=r.type==='modes'?Math.min(max,r.picks[0]??0):0;ab={...ab,targets:Array.from({length:n},()=>ab.mshDynamic==='lifeTargets'?{kind:'creature' as const,filter:{ctrl:'you' as const}}:{kind:'permanent' as const,filter:{ctrl:'you' as const,sub:'Equipment'}})};}
    if(ab.finDynamic){const options=g.players[t.controller].graveyard.filter(id=>isCreature(g.cards[id]));const max=options.length;const r:Response=yield{type:'mode',player:t.controller,prompt:'選擇返回生物目標數量（總法力值至多6）',options:Array.from({length:max+1},(_,i)=>String(i)),count:1,purpose:'count'};const n=r.type==='modes'?Math.min(max,r.picks[0]??0):0;ab={...ab,targets:Array.from({length:n},()=>({kind:'gyCard' as const,filter:{ctrl:'you' as const,type:'Creature' as const},totalMvMax:6}))};}
    if(ab.variableVividTargets){const n=vividColors(g,t.controller).length;const r:Response=yield {type:'mode',player:t.controller,prompt:'選擇目標數量',options:Array.from({length:n+1},(_,i)=>String(i)),count:1,purpose:'count'};const k=r.type==='modes'?r.picks[0]??0:0;ab={...ab,targets:Array.from({length:Math.min(k,n)},()=>({kind:'creature' as const,filter:{ctrl:'you' as const}}))};}
    if(ab.frontierDynamic){const max=ab.frontierDynamic==='players'?2:Math.min(src.castX??0,g.battlefield.filter(id=>isCreature(g.cards[id])).length);const answer:Response=yield{type:'mode',player:t.controller,prompt:'選擇目標數量',options:Array.from({length:max+1},(_,i)=>String(i)),count:1,purpose:'count'};const n=answer.type==='modes'?answer.picks[0]??0:0;ab={...ab,targets:Array.from({length:n},()=>({kind:ab.frontierDynamic==='players'?'player' as const:'creature' as const}))};}
    const specs = (ab.targets ?? []).map(s=>s.filter?.chosenTribe?{...s,filter:{...s.filter,chosenTribe:false,sub:t.sourceType??src.eclType??''}}:s).map(s=>s.filter?.crewedSourceThisTurn?{...s,filter:{...s.filter,crewedSourceThisTurn:false,ids:(src.crewedBy??[]).slice()}}:s);
    let targets: (TargetRef | null)[] = [];
    if (specs.length) {
      const options = specs.map((s) => legalTargets(g, s, t.controller, t.source));
      if (specs.some((s, i) => !s.optional && options[i].length === 0)) {
        log(g, `${cardName(src)} 的觸發式能力沒有合法目標`, t.controller);
        continue;
      }
      if (specs.every((s, i) => s.optional && options[i].length === 0)) {
        targets = specs.map(() => null);
      } else {
        const r: Response = yield {
          type: 'targets',
          player: t.controller,
          source: t.source,
          specs,
          text: src.def.text,
          effects: ab.effects,
        };
        targets = r.type === 'targets' ? specs.map((_, i) => r.targets[i] ?? null) : [];
        if (validateTargets(g, specs, targets, t.controller, t.source)) {
          // 不合法的回應：自動選第一個合法目標
          targets = specs.map((s, i) => (s.optional ? null : options[i][0] ?? null));
        }
      }
    }
    g.stack.push({
      sid: g.nextSid++,
      kind: 'trigger',
      modeIndex:foundationMode,distribution:foundationDistribution,
      controller: t.controller,
      cardId: t.source,
      targets,
      targetSpecs: specs,
      targetVersions:targets.map(t=>t&&'c' in t?g.cards[t.c]?.objectVersion??0:undefined),
      effects: ab.effects,
      text: src.def.text,
      may: ab.may,
      cond: ab.cond,
      ev: t.ev,
      lkiPower: t.lkiPower,
      sourceType:t.sourceType,
      sourceLinkKey:t.sourceLinkKey,
      sneakPaid:t.sneakPaid,
    });
    commitCrime(g,t.controller,t.source,targets,g.stack[g.stack.length-1].sid);
    if(t.ev.type==='attacks' && t.ev.card===t.source) {
      for(const id of g.battlefield){const asc=g.cards[id];if(asc.controller!==t.controller||asc.def.id!=='firebender-ascension')continue;asc.charge=(asc.charge??0)+1;if(asc.charge<4)continue;
        const r:Response=yield {type:'yesno',player:t.controller,prompt:'複製攻擊觸發異能？'};
        if(r.type==='yesno'&&r.yes){let copied=targets.slice();if(specs.length){const choice:Response=yield {type:'targets',player:t.controller,source:t.source,specs,text:src.def.text,effects:ab.effects};if(choice.type==='targets'&&!validateTargets(g,specs,choice.targets,t.controller,t.source))copied=choice.targets;}g.stack.push({...g.stack[g.stack.length-1],sid:g.nextSid++,targets:copied});}
      }
    }
    show(g, { kind: 'trigger', player: t.controller, card: t.source, targets });
    for (const tg of targets) {
      if (tg && 'c' in tg && g.cards[tg.c]?.zone === 'battlefield') emit(g, { type: 'targeted', card: tg.c, by: t.controller, spell: false, stackSid:g.stack[g.stack.length-1]?.sid });
    }
    g.version++;
  }
}

/** 反覆檢查狀態動作並將觸發放上堆疊，直到穩定 */
export function* settle(g: GameState): SubFlow {
  for (let i = 0; i < 100; i++) {
    yield* resolveEclEntries(g);
    refreshFinLands(g);
    for(const pid of [0,1] as PID[]){
      if(g.legendExempt?.pid===pid&&g.legendExempt.turn===g.turn)continue;
      const groups=new Map<string,number[]>();
      for(const id of g.battlefield){const c=g.cards[id];if(c.controller===pid&&(c.def.set==='TMT'||c.def.set==='ECL'||c.def.set==='FIN'||c.def.set==='MKM'||c.def.set==='MSH')&&matches(g,{legendary:true},c,pid))groups.set(c.def.name,[...(groups.get(c.def.name)??[]),id]);}
      for(const ids of groups.values())if(ids.length>1){
        const r:Response=yield {type:'choose',player:pid,prompt:'傳奇規則：選擇保留的一個永久物',options:ids,min:1,max:1,purpose:'sacrifice'};
        const keep=r.type==='choose'&&ids.includes(r.ids[0])?r.ids[0]:ids[ids.length-1];
        putIntoGraveyard(g,ids.filter(id=>id!==keep).map(id=>g.cards[id]));
      }
    }
    checkSBA(g);
    if (!g.pending.length) return;
    yield* flushTriggers(g);
  }
}

// ------------------------------------------------------------
// 堆疊結算
// ------------------------------------------------------------
export function* resolveTop(g: GameState): SubFlow {
  const previous=g.resolvingSpell;
  try {yield* resolveTopItem(g);}finally {g.resolvingSpell=previous;}
}
function* resolveTopItem(g: GameState): SubFlow {
  const item = g.stack.pop();
  if (!item) return;
  g.resolvingSpell=item.kind==='spell'?{card:item.cardId,targets:item.targets}:undefined;
  g.version++;
  const src = g.cards[item.cardId];
  const specs = item.targetSpecs;
  if(item.frontierStackSids?.length&&item.frontierStackSids.every(id=>!g.stack.some(s=>s.sid===id))&&!item.targets.some(Boolean)){if(item.kind==='spell'&&src.zone==='stack')moveCard(g,src,'graveyard');return;}
  const hadTargets = item.targets.some((t) => !!t);
  const legal = item.targets.map((t, i) =>
    t && specs[i] && (item.targetVersions?.[i]===undefined || !('c' in t) || item.targetVersions[i]===(g.cards[t.c]?.objectVersion??0)) && isLegalTarget(g, specs[i], t, item.controller, item.cardId) ? t : null,
  );
  if (hadTargets && legal.every((t) => !t)) {
    log(g, `${cardName(src)} 因目標不合法而無效`, item.controller);
    if (item.kind === 'spell' && src.zone === 'stack') moveCard(g, src, item.alt === 'flashback' || item.alt === 'harmonize' ? 'exile' : 'graveyard');
    return;
  }
  const ctx: Ctx = {
    controller: item.controller,
    source: item.cardId,
    targets: legal,
    ev: item.ev,
    lkiPower: item.lkiPower,
    sourceType:item.sourceType,
    sourceLinkKey:item.sourceLinkKey,
    orbitStation:item.orbitStation,
    sneakPaid:item.sneakPaid,
    bdSac:item.bdSac,
    bdCounters:item.bdCounters,
    x: item.x,
    distribution:item.distribution,
    mode:item.modeIndex,
    alt: item.alt,
  };
  if (item.kind === 'spell') {
    const def = src.def;
    if (item.alt === 'adventure' || item.alt === 'flashback' || (item.alt === 'harmonize' && !isPermanentDef(def))) {
      // 冒險：結算後放逐，之後可以施放本體；返照：結算後放逐
      yield* runEffects(g, ctx, item.effects);
      if (src.zone === 'stack' && item.alt === 'flashback' && def.flashbackTransform && def.back) {
        enterBattlefieldBack(g, src, item.controller);
        log(g, `${cardName(src)} 轉化後進入戰場`, item.controller);
      } else if (src.zone === 'stack') {
        if(item.alt==='adventure'&&def.meadow?.orbitOmen)finishOmen(g,src);else moveCard(g, src, def.mkm?.split?'graveyard':'exile');
        if (item.alt === 'adventure'&&!def.mkm?.split&&!def.meadow?.orbitOmen) {
          src.onAdventure = true;if(src.frontierMarks?.lilahPlot){src.plottedTurn=g.turn;delete src.frontierMarks.lilahPlot;}
          log(g, `${cardName(src)} 踏上冒險（之後可以從放逐區施放）`, item.controller);
        }
      }
    } else if (isPermanentDef(def)) {
      src.offspringPaid=item.alt==='offspring'||item.bdOffspringPaid;
      (src.frontierMarks??={}).bdGift=Number(item.alt==='gift'||item.bdGiftPaid);
      if(item.x!==undefined)src.castX=item.x;
      if (def.aura) {
        const t = legal[0];
        if(t&&'p'in t&&def.aura.target?.kind==='player'){enterBattlefield(g,src,item.controller);src.attachedToPlayer=t.p;return;}
        if (!t || !('c' in t)) {
          moveCard(g, src, 'graveyard');
          return;
        }
        enterBattlefield(g, src, item.controller);
        src.attachedTo = t.c;
        emit(g,{type:'frontier',action:'attached',card:src.id,player:item.controller,other:t.c,amount:0});
        // 讓永久物變成生物的光環
        const anim = def.aura.grant.animate;
        const host = g.cards[t.c];
        if (anim && host && !host.auraBaseDef) {
          host.auraBaseDef = host.def;
          host.def = {
            ...host.def,
            types: [...new Set([...host.def.types, 'Creature' as const])],
            subtypes: anim.replaceCreatureTypes ? (anim.subtype?[anim.subtype]:[]) : [...(host.def.subtypes ?? []), ...(anim.subtype ? [anim.subtype] : [])],
            ...(src.def.id==='noggle-the-mind'?{colors:[]}:{}),
            power: anim.p,
            toughness: anim.t,
          };
        }
        log(g, `${cardName(src)} 結附於 ${cardName(g.cards[t.c])}`, item.controller);
      } else if (item.alt === 'back') {
        enterBattlefieldBack(g, src, item.controller);
        log(g, `${cardName(src)} 進入戰場`, item.controller);
      } else {
        enterBattlefield(g, src, item.controller);
        src.wasCast = true;

        if (item.x !== undefined) src.castX = item.x;

        log(g, `${cardName(src)} 進入戰場`, item.controller);
        if (item.alt === 'warp') src.exileAtEnd = true;

      }
    } else {
      yield* runEffects(g, ctx, item.effects);
      if(src.zone==='stack'&&src.frontierMarks?.lilahPlot){moveCard(g,src,'exile');src.plottedTurn=g.turn;delete src.frontierMarks.lilahPlot;}
      if(src.zone==='stack'){const dream=src.castOrigin==='hand'&&g.battlefield.some(id=>g.cards[id].controller===item.controller&&g.cards[id].def.id==='goliath-daydreamer'&&abilitiesOf(g,g.cards[id]).length);moveCard(g,src,dream||src.finExileOnResolve||src.frontierMarks?.cpRebound?'exile':'graveyard');src.finExileOnResolve=undefined;if(dream)src.eclDream=true;}
    }
  } else {
    if (item.cond && !checkCond(g, item.cond, item.controller, item.cardId, legal, item.ev)) return;
    if (item.may) {
      const r: Response = yield { type: 'yesno', player: item.controller, prompt: item.may, source: item.cardId, purpose: 'may' };
      if (r.type !== 'yesno' || !r.yes) return;
    }
    yield* runEffects(g, ctx, item.effects);
  }
}

// ------------------------------------------------------------
// 優先權
// ------------------------------------------------------------
export function* priorityStep(g: GameState): SubFlow {
  let passes = 0;
  let p: PID = g.active;
  for (let guard = 0; guard < 2000; guard++) {
    yield* settle(g);
    g.priority = p;
    const r: Response = yield { type: 'priority', player: p };
    if (r.type === 'pass' || (r.type !== 'play' && r.type !== 'cast' && r.type !== 'activate')) {
      passes++;
      if (passes >= 2) {
        if (g.stack.length === 0) {
          g.priority = null;
          // 步驟結束：法術力池清空
          for (const pl of g.players) {
            const ozai=g.battlefield.some(id=>g.cards[id].controller===pl.id&&g.cards[id].def.id==='ozai-the-phoenix-king');
            pl.pool=ozai ? [...(pl.pool??[]),...(pl.firePool??[])].map(()=> 'R' as const) : [];
            if(ozai) pl.firePool=[];
            pl.poolNoncreature = [];pl.mshRestricted=[];pl.mkmGossip=[];
            pl.poolLesson=[];pl.frontierMana=[];pl.foundationPool=(pl.foundationPool??[]).filter(m=>m.keepTurn===g.turn);
          }
          return;
        }
        yield* resolveTop(g);
        if(g.finEndTurn)return;
        passes = 0;
        p = g.active;
        continue;
      }
      p = other(p);
    } else {
      if(r.type==='cast'){
        const card=g.cards[r.card];
        const view=card?castDef(card.def,r.alt):undefined;
        const stackKinds=view?.spell?.modes?.[r.mode??0]?.frontierStackTargets??(view?.frontierStack?[view.frontierStack]:[]);
        if(stackKinds.length&&!r.stackTargetSids){r.stackTargetSids=r.stackTargetSid!==undefined?[r.stackTargetSid]:[];for(let i=r.stackTargetSids.length;i<stackKinds.length;i++){const items=frontierStackChoices(g,p,stackKinds[i]);if(!items.length)break;const answer:Response=yield{type:'mode',player:p,prompt:'選擇堆疊上的目標',options:items.map(s=>s.text),count:1,purpose:'trigger'};r.stackTargetSids.push(items[answer.type==='modes'?answer.picks[0]??0:0].sid);}}
        const total=view?.frontier?.distribute==='X'?r.x??0:view?.frontier?.distribute;
        if(total!==undefined&&!r.distribution){let left=total;r.distribution=[];const n=r.targets.filter(Boolean).length;for(let i=0;i<n;i++){const max=left-(n-i-1);let amount=left;if(i<n-1&&max>=1){const answer:Response=yield{type:'mode',player:p,prompt:'分給第'+(i+1)+'個目標的指示物',options:Array.from({length:max},(_,j)=>String(j+1)),count:1,purpose:'count'};amount=1+(answer.type==='modes'?answer.picks[0]??0:0);}r.distribution.push(amount);left-=amount;}}
        if(card?.def.fin?.stackTarget&&r.stackTargetSid===undefined){const items=finStackChoices(g,p,false);const rr:Response=yield{type:'mode',player:p,prompt:'選擇要反擊的咒語或異能',options:items.map(s=>s.text),count:1,purpose:'trigger'};r.stackTargetSid=items[rr.type==='modes'?rr.picks[0]??0:0]?.sid;}
        if(card?.def.fin?.returnLandCost&&r.mode===1&&r.returnLand===undefined){const options=g.battlefield.filter(id=>g.cards[id].controller===p&&g.cards[id].def.types.includes('Land'));const rr:Response=yield{type:'choose',player:p,prompt:'收回一個地作額外費用',options,min:1,max:1,purpose:'dig'};r.returnLand=rr.type==='choose'?rr.ids[0]:undefined;}
        const c=g.cards[r.card],req=c?.def.ecl?.behold;
        if(c&&req&&(!req.flashbackOnly||r.alt==='flashback')&&r.beheld===undefined){
          let pick=true;if(req.tax||req.optional){const answer:Response=yield {type:'yesno',player:p,prompt:req.tax?`Behold而不另付{${req.tax}}？`:'支付Behold額外費用？'};pick=answer.type==='yesno'&&answer.yes;}
          if(pick&&beholdOptions(g,p,c,r.alt).length>=req.n){const options=beholdOptions(g,p,c,r.alt);const answer:Response=yield {type:'choose',player:p,prompt:`選擇${req.n}個${req.sub??'共用生物類別的'}物件作Behold`,options,min:req.n,max:req.n,purpose:'dig',reveal:true};r.beheld=answer.type==='choose'?answer.ids:[];}else r.beheld=[];
        }
        if(c&&req&&!req.sub&&r.beheld?.length&&r.beholdType===undefined){const options=[...new Set(['Elemental','Elf','Faerie','Giant','Goblin','Kithkin','Merfolk','Treefolk',...r.beheld.flatMap(id=>g.cards[id].def.subtypes??[])])].filter(sub=>r.beheld!.every(id=>matches(g,{sub},g.cards[id],p)));const answer:Response=yield {type:'mode',player:p,prompt:'選擇所Behold的共用生物類別',options,count:1,purpose:'creatureType'};r.beholdType=options[answer.type==='modes'?answer.picks[0]??0:0];}
        if(c&&!c.def.types.includes('Creature')&&r.conspireTapped===undefined){r.conspireTapped=[];const used=new Set<number>();for(const id of g.battlefield){const source=g.cards[id];if(source.controller!==p||!abilitiesOf(g,source).some(a=>a.kind==='static'&&a.ecl==='conspire'))continue;const options=g.battlefield.filter(id=>{const b=g.cards[id];return b.controller===p&&!b.tapped&&!used.has(id)&&isCreature(b)&&colorsOf(b.def).some(col=>colorsOf(c.def).includes(col));});if(options.length<2)continue;const answer:Response=yield {type:'choose',player:p,prompt:'可橫置兩個與咒語共色的生物作共謀（或略過）',options,min:0,max:2,purpose:'dig'};if(answer.type==='choose'&&answer.ids.length===2){r.conspireTapped.push(answer.ids);answer.ids.forEach(id=>used.add(id));}}}
        const n=c?.def.ecl?.blightX?(r.x??0):c?.def.spell?.modes?.[r.mode??0]?.blight??c?.def.addCost?.blight??0;
        if(n>0&&r.blightCard===undefined){const options=g.battlefield.filter(id=>g.cards[id].controller===p&&isCreature(g.cards[id])&&canReceiveCounters(g,g.cards[id]));const answer:Response=yield {type:'choose',player:p,prompt:`選擇枯萎${n}的生物（不指定目標）`,options,min:1,max:1,purpose:'blight'};r.blightCard=answer.type==='choose'?answer.ids[0]:undefined;}
      }
      if(r.type==='cast'&&r.foundationCosts===undefined){const cost=foundationExtraCosts(g,p,g.cards[r.card],r.alt);if(cost){const answer:Response=yield{type:'choose',player:p,prompt:cost.kind==='forage'?'掘食：選一個食物犧牲，或三張墳墓場牌放逐':cost.kind==='reveal'?'選擇手牌生物展示或你操控的生物':'選擇額外費用',options:cost.ids,min:cost.n,max:'max'in cost?cost.max:cost.n,purpose:'dig',reveal:cost.kind==='reveal'};r.foundationCosts=answer.type==='choose'?answer.ids:[];}}
      if(r.type==='activate'){
        const c=g.cards[r.card],ab=c?abilitiesFor(g,c)[r.ability]:undefined;
        const chooseCost = function*(prompt:string,options:number[],min:number,max:number):SubFlow<number[]>{
          const answer:Response=yield {type:'choose',player:p,prompt,options,min,max,purpose:'sacrifice'};
          return answer.type==='choose'?answer.ids:[];
        };
        if(c&&ab&&canActivate(g,p,c,r.ability)){
          if(ab.cost.craft&&r.costCards===undefined){const ids=campusCraftOptions(g,p,c,ab);r.costCards=yield*chooseCost('選擇製作時放逐的素材',ids,ab.cost.craftCount??1,c.def.meadow?.craftAny?ids.length:ab.cost.craftCount??1);}
          if(ab.campusExileArtifacts&&r.costCards===undefined)r.costCards=yield*chooseCost('放逐一個或更多其他神器',g.battlefield.filter(id=>id!==c.id&&g.cards[id].controller===p&&g.cards[id].def.types.includes('Artifact')),1,g.battlefield.length);
          if(ab.bdExile&&r.costCards===undefined)r.costCards=yield*chooseCost('選擇要放逐的墳墓場牌',g.players[p].graveyard.filter(id=>id!==c.id&&matches(g,ab.bdExile!.filter,g.cards[id],p)),ab.bdExile.n??0,ab.bdExile.any?g.players[p].graveyard.length:ab.bdExile.n??0);
          if(ab.bdSacAny&&r.costCards===undefined)r.costCards=yield*chooseCost('犧牲一個或更多永久物',g.battlefield.filter(id=>g.cards[id].controller===p&&matches(g,ab.bdSacAny,g.cards[id],p)),1,g.battlefield.length);
          if(ab.bdForage&&r.costCards===undefined){const cost=forageOptions(g,p);r.costCards=yield*chooseCost('掘食：選一個食物或三張墳墓場牌',cost.ids,cost.n,cost.max);}
          if(ab.bdTapMana&&r.tapCards===undefined)r.tapCards=yield*chooseCost('可橫置生物支付任意法力',g.battlefield.filter(id=>id!==c.id&&g.cards[id].controller===p&&isCreature(g.cards[id])&&!g.cards[id].tapped),0,4);
          if(ab.foundationDistribution&&!r.distribution){let left=ab.foundationDistribution;r.distribution=[];for(let i=0;i<r.targets.length;i++){const max=left-(r.targets.length-i-1);let n=max;if(i<r.targets.length-1){const answer:Response=yield{type:'mode',player:p,prompt:'分配給第'+(i+1)+'個目標的傷害',options:Array.from({length:max},(_,j)=>String(j+1)),count:1,purpose:'count'};n=1+(answer.type==='modes'?answer.picks[0]??0:0);}r.distribution.push(n);left-=n;}}
          if(ab.mshStack&&r.stackTargetSid===undefined){const items=g.stack.filter(s=>s.controller===p&&s.kind!=='spell'&&!s.manaAbility&&g.cards[s.cardId].def.types.includes(ab.mshStack==='artifact'?'Artifact':'Creature'));const rr:Response=yield{type:'mode',player:p,prompt:'選擇要複製的異能',options:items.map(s=>s.text),count:1,purpose:'trigger'};r.stackTargetSid=items[rr.type==='modes'?rr.picks[0]??0:0]?.sid;}
          if(ab.finStack&&r.stackTargetSid===undefined){const items=finStackChoices(g,p,true);const rr:Response=yield{type:'mode',player:p,prompt:'選擇你的起動或觸發異能',options:items.map(s=>s.text),count:1,purpose:'trigger'};r.stackTargetSid=items[rr.type==='modes'?rr.picks[0]??0:0]?.sid;}
          if(ab.cost.tapN&&r.tapCards===undefined)r.tapCards=yield* chooseCost('選擇橫置作費用的永久物',g.battlefield.filter(id=>{const x=g.cards[id];return x.controller===p&&!x.tapped&&(!ab.cost.tap||id!==c.id)&&matches(g,ab.cost.tapN!.filter,x,p,c.id);}),ab.cost.tapN.n,ab.cost.tapN.n);
          if(ab.effects.some(e=>e.e==='ecl'&&e.action==='kirol')&&r.stackTargetSid===undefined){const items=g.stack.filter(s=>s.kind==='trigger'&&s.controller===p);const answer:Response=yield {type:'mode',player:p,prompt:'選擇目標觸發異能',options:items.map(s=>s.text),count:1,purpose:'trigger'};r.stackTargetSid=items[answer.type==='modes'?answer.picks[0]??0:0]?.sid;}
          if(ab.cost.blight&&r.blightCard===undefined)r.blightCard=(yield* chooseCost('選擇枯萎生物',g.battlefield.filter(id=>g.cards[id].controller===p&&isCreature(g.cards[id])&&canReceiveCounters(g,g.cards[id])),1,1))[0];
          if(ab.removeCounter?.any&&!r.counterPayments){const remaining={...counterKinds(c)};r.counterPayments=[];for(let i=0;i<ab.removeCounter.n;i++){const kinds=Object.keys(remaining).filter(k=>remaining[k]>0);const answer:Response=yield {type:'mode',player:p,prompt:'選擇移除的指示物種類',options:kinds,count:1,purpose:'trigger'};const kind=kinds[answer.type==='modes'?answer.picks[0]??0:0];if(kind){remaining[kind]--;r.counterPayments.push({kind,n:1});}}}

          if(ab.sacN&&r.costCards===undefined)r.costCards=yield* chooseCost('選擇要犧牲的永久物',sacChoices(g,p,ab.sacN.filter,c.id),ab.sacN.n,ab.sacN.n);
          if(ab.cost.crew!==undefined&&r.costCards===undefined){
            const options=g.battlefield.filter(id=>{const x=g.cards[id];return x.controller===p&&id!==c.id&&!x.tapped&&isCreature(x);});
            r.costCards=g.players[p].isAI?(crewChoice(g,p,c,ab.cost.crew)??[]):yield* chooseCost(`選擇駕駛生物，總力量至少${ab.cost.crew}`,options,1,options.length);
          }
          if(ab.removeCounter?.fromCreature&&r.counterCard===undefined)r.counterCard=(yield* chooseCost('選擇要移除指示物的生物',g.battlefield.filter(id=>g.cards[id].controller===p&&isCreature(g.cards[id])&&g.cards[id].counters>=ab.removeCounter!.n),1,1))[0];
          if(ab.cost.discard===1&&r.discard===undefined)r.discard=(yield* chooseCost('選擇要棄掉的手牌',g.players[p].hand.filter(id=>!ab.cost.discardFilter||matches(g,ab.cost.discardFilter,g.cards[id],p)),1,1))[0];
        }
      }
      const err = performAction(g, p, r);
      if (err) {
        log(g, `（無效動作：${err}）`, p);
      } else {
        passes = 0;
        if(g.stack[g.stack.length-1]?.manaAbility)yield* resolveTop(g);
      }
    }
  }
  g.priority = null;
}

// ------------------------------------------------------------
// 回合流程
// ------------------------------------------------------------
function* mulligans(g: GameState): SubFlow {
  for (const pid of [g.firstPlayer, other(g.firstPlayer)] as PID[]) drawCards(g, pid, 7);
  for (const pid of [g.firstPlayer, other(g.firstPlayer)] as PID[]) {
    const pl = g.players[pid];
    while (pl.mulligans < 5) {
      const r: Response = yield { type: 'mulligan', player: pid, mulligans: pl.mulligans };
      if (r.type !== 'keep' || r.keep) break;
      pl.mulligans++;
      log(g, `${pl.name} 重抽起手（第 ${pl.mulligans} 次）`, pid);
      for (const id of pl.hand.splice(0)) {
        const c = g.cards[id];
        c.zone = 'library';
        pl.library.push(id);
      }
      shuffleArr(g, pl.library);
      drawCards(g, pid, 7);
    }
    if (pl.mulligans > 0) {
      const n = Math.min(pl.mulligans, pl.hand.length);
      const r: Response = yield {
        type: 'choose',
        player: pid,
        prompt: `選擇 ${n} 張牌放到牌庫底`,
        options: pl.hand.slice(),
        min: n,
        max: n,
        purpose: 'bottom',
      };
      let ids = r.type === 'choose' ? r.ids.filter((id) => pl.hand.includes(id)).slice(0, n) : [];
      for (const id of pl.hand) if (ids.length < n && !ids.includes(id)) ids.push(id);
      ids = ids.slice(0, n);
      for (const id of ids) moveCard(g, g.cards[id], 'library', true);
    }
  }
  // 起手的「地脈」牌
  for (const pid of [g.firstPlayer, other(g.firstPlayer)] as PID[]) {
    for (const id of g.players[pid].hand.slice()) {
      const c = g.cards[id];
      if (!c.def.leyline&&!c.def.foundation?.leyline) continue;
      const r: Response = yield {
        type: 'yesno',
        player: pid,
        prompt: `要讓 ${cardName(c)} 在遊戲開始時就在戰場上嗎？`,
        source: id,
        purpose: 'leyline',
      };
      if (r.type === 'yesno' && r.yes) {
        log(g, `${cardName(c)} 以開局方式進入戰場`, pid);
        enterBattlefield(g, c, pid);
      }
    }
  }
  g.pending = [];
}

function* combatPhase(g: GameState): SubFlow {
  const a = g.active;
  g.blockersDeclared=false;
  g.combatCount=(g.combatCount??0)+1;g.finCombatNumber=g.combatCount;
  g.phase = 'combat_begin';
  emit(g, { type: 'step', step: 'combatStart', player: a });
  yield* priorityStep(g);
  if (attackCandidates(g, a).length === 0) {
    g.phase = 'combat_end';
    endCombat(g);
    return;
  }
  g.phase = 'combat_attackers';
  g.version++;
  const r: Response = yield { type: 'attackers', player: a };
  const list = declareAttackers(g, a, r.type === 'attackers' ? r.ids : [], r.type === 'attackers' ? r.targets : undefined);
  if (!list.length) {
    g.phase = 'combat_end';
    endCombat(g);
    return;
  }
  yield* priorityStep(g);
  g.phase = 'combat_blockers';
  g.version++;
  const d = other(a);
  if (blockCandidates(g, d).length > 0) {
    const rb: Response = yield { type: 'blockers', player: d };
    declareBlockers(g, d, rb.type === 'blockers' ? rb.blocks : []);
  }
  g.blockersDeclared=true;
  yield* priorityStep(g);
  if (hasFirstStrikers(g)) {
    g.phase = 'combat_damage_first';
    combatDamage(g, 'first');
    yield* priorityStep(g);
    g.phase = 'combat_damage';
    combatDamage(g, 'regular');
  } else {
    g.phase = 'combat_damage';
    combatDamage(g, 'all');
  }
  yield* priorityStep(g);
  g.phase = 'combat_end';
  emit(g,{type:'fin',action:'endCombat',card:-1,player:a,amount:0});
  yield* priorityStep(g);
  endCombat(g);
  while((g.frontierExtraUpkeeps??0)>0){g.frontierExtraUpkeeps!--;g.phase='upkeep';emit(g,{type:'step',step:'upkeep',player:a});yield*priorityStep(g);}
}

function* turn(g: GameState): SubFlow {
  g.turn++;
  const extra=g.extraTurns?.shift();
  if(extra!==undefined)g.active=extra;
  else if(g.normalTurnAfterExtra!==undefined){g.active=g.normalTurnAfterExtra;g.normalTurnAfterExtra=undefined;}
  else g.active=g.turn===1?g.firstPlayer:other(g.active);
  if((g.players[g.active].campusSkipTurns??0)>0){g.players[g.active].campusSkipTurns!--;g.turn--;return;}
  const a = g.active;
  campusRefresh(g);
  meadowRefresh(g);
  if(g.playerControl && a===g.playerControl.player && g.turn>=g.playerControl.starts)g.playerControl.ends=g.turn;
  const pl = g.players[a];
  for(const c of Object.values(g.cards))if(c.controller===a&&c.mshCopyUntil!==undefined&&c.mshCopyUntil<=g.turn){if(c.baseDef){c.def=c.baseDef;c.baseDef=undefined;c.copyLayer=undefined;}c.mshCopyUntil=undefined;}
  pl.eclTurnCount=(pl.eclTurnCount??0)+1;
  for(const p of g.players)if(p.noExileCastBy===a){p.noExileCastBy=undefined;p.noExileCastUntil=undefined;}
  for (const p of g.players) {
    p.landsPlayed = 0;
    p.spellsThisTurn = 0;
    p.instSorcThisTurn = 0;
    p.lifeGainedThisTurn = 0;
    p.drawsThisTurn = 0;
    p.nonlandEtbThisTurn = 0;
    p.permToGyThisTurn = false;
    p.scriedThisTurn = false;
    p.libToGyThisTurn = 0;
    p.noncombatLastTurn = !!p.noncombatThisTurn;
    p.noncombatThisTurn = false;
    p.noncreatureThisTurn = 0;
    p.nextSpellUncounterable = false;
    p.discardedThisTurn = 0;
    p.extraLandsThisTurn = 0;
    p.loyaltyActivatedThisTurn = false;
    p.mountainBonus = false;
    p.pool = [];p.frontierMana=[];p.foundationPool=[];p.mkmGossip=[];p.mshRestricted=[];
    const lightning=p.finFlags?.lightningUntil;
    p.finFlags=lightning&&lightning!==a+1?{lightningUntil:lightning}:{};
    p.retainedRed=[];p.eclRestrictedMana=[];p.eclEntries=[];p.eclCounterPlaced=false;p.eclAttackedMerfolk=0;p.eclMaralenUsed=[];if(p.eclPreventDamageUntil===a)p.eclPreventDamageUntil=undefined;
    p.poolNoncreature = [];
    p.poolLesson=[];
    p.firePool = [];
    p.bends = [];
    p.sacrificedThisTurn = false;
    p.permanentLeftThisTurn=false;
    p.artifactEnteredThisTurn=false;
    p.spellTypesThisTurn=[];
    p.nextAffinity=0;
    p.lifeLostThisTurn = 0;
  }
  g.combatCount=0;g.finCombatNumber=0;g.finEndNumber=1;g.finExtraEnd=false;g.finEndTurn=false;
  g.blockersDeclared=false;
  g.attackedThisTurn = false;
  g.creatureDiedThisTurn = false;
  g.creaturesDiedCount = 0;
  g.voidThisTurn = false;
  // 「直到你的下一個回合」的延遲觸發與效果持續到該玩家的回合開始
  g.delayed = (g.delayed ?? []).filter((d) => d.persistent || (d.until !== undefined && d.until !== a));
  g.eot = g.eot.filter((e) => e.until === undefined || e.until !== a);
  for (const id of g.battlefield) g.cards[id].usedThisTurn = [];
  log(g, `—— 第 ${g.turn} 回合：${pl.name} ——`, a, 'turn');
  if (g.turn > g.maxTurns) {
    g.winner = 'draw';
    log(g, '回合數過多，判定平手', undefined, 'result');
    throw new GameOver();
  }
  // 重置
  g.phase = 'untap';
  const cpTappedBefore=g.battlefield.filter(id=>g.cards[id].controller===a&&g.cards[id].tapped);
  for (const id of g.battlefield) {
    const c = g.cards[id];
    if(c.def.id==="benders-waterskin") c.tapped=false;
    if (c.controller !== a){if(c.tapped&&abilitiesOf(g,c).some(a=>a.kind==='static'&&a.frontier==='lci:opponentUntap')&&!stats(g,c).noUntap){if(c.stun>0)c.stun--;else c.tapped=false;}continue;}
    c.sick = false;
    if(c.frontierMarks?.bdExertBy===a+1&&(c.frontierMarks.bdExertTurn??g.turn)<g.turn){delete c.frontierMarks.bdExertBy;delete c.frontierMarks.bdExertTurn;continue;}
    if(c.tapped&&c.def.id==='hedge-whisperer'){const r:Response=yield{type:'yesno',player:a,prompt:'保持 Hedge Whisperer 橫置？'};if(r.type==='yesno'&&r.yes)continue;}
    if (c.tapped && !stats(g, c).noUntap) {
      if (c.stun > 0) c.stun--;
      else {c.tapped=false;emit(g,{type:'frontier',action:'untapped',card:c.id,player:c.controller,amount:0});}
    }
  }
  for(const id of g.battlefield){const c=g.cards[id],hedge=c.mkmMarks?.hedge;if(hedge!==undefined&&(!g.cards[hedge]?.tapped||g.cards[hedge].zone!=='battlefield')){if(c.tlaOriginalDef){c.def=c.tlaOriginalDef;c.tlaOriginalDef=undefined;}delete c.mkmMarks!.hedge;}}
  g.version++;
  for(const id of g.battlefield){const c=g.cards[id];if(c.controller!==a&&isCreature(c)&&frontierStatic(g,c.controller,'dsk:otherUntap').length&&!stats(g,c).noUntap){if(c.stun>0)c.stun--;else c.tapped=false;}}
  const cpUntapped=cpTappedBefore.filter(id=>!g.cards[id].tapped).length;if(cpUntapped)emit(g,{type:'frontier',action:'cpUntap',card:-1,player:a,amount:cpUntapped});
  // 維持
  phases:{
  g.phase = 'upkeep';
  emit(g, { type: 'step', step: 'upkeep', player: a });
  yield* priorityStep(g);if(g.finEndTurn)break phases;
  // 抓牌
  g.phase = 'draw';
  emit(g, { type: 'step', step: 'draw', player: a });
  if (g.turn > 1) drawCards(g, a, 1);
  yield* priorityStep(g);if(g.finEndTurn)break phases;
  // 主要階段一：傳奇在抓牌步驟後前進一章
  g.phase = 'main1';
  emit(g, { type: 'step', step: 'main1', player: a });
  for (const id of [...g.battlefield]) {
    const c = g.cards[id];
    if (c.controller === a && c.def.saga) addLore(g, c, 1);
  }
  yield* priorityStep(g);if(g.finEndTurn)break phases;
  // 戰鬥
  yield* combatPhase(g);if(g.finEndTurn)break phases;
  while(g.extraCombat?.player===a){const extra=g.extraCombat;g.landCombatOnly=extra.landOnly;g.extraCombat=(extra.count??1)>1?{...extra,count:(extra.count??1)-1}:undefined;yield* combatPhase(g);if(g.finEndTurn)break phases;g.landCombatOnly=false;}
  // 主要階段二
  for(const p of g.players) p.firePool=[];
  g.phase = 'main2';
  emit(g,{type:'step',step:'main2',player:g.active});
  yield* priorityStep(g);if(g.finEndTurn)break phases;
  while(g.extraCombat?.player===a){const extra=g.extraCombat;g.landCombatOnly=extra.landOnly;g.extraCombat=(extra.count??1)>1?{...extra,count:(extra.count??1)-1}:undefined;yield*combatPhase(g);if(g.finEndTurn)break phases;g.landCombatOnly=false;}
  // 結束：動員之類的暫時衍生物在結束步驟開始時犧牲
  g.phase = 'end';
  for (const id of [...g.battlefield]) {
    const c = g.cards[id];
    if (c.sacAtEnd) continue; // The end-step event queues the delayed sacrifice.
    else if (c.exileAtEndFinal && c.zone === 'battlefield') {
      log(g, `${cardName(c)} 被放逐`, c.controller);
      moveCard(g, c, 'exile');
    } else if (c.exileAtEnd && c.zone === 'battlefield') {
      // 折躍：放逐，之後的回合可以從放逐區施放
      log(g, `${cardName(c)} 折躍結束，被放逐（之後的回合可以再施放）`, c.controller);
      moveCard(g, c, 'exile');
      c.warpExiled = g.turn;
    }
  }
  emit(g, { type: 'step', step: 'endStep', player: a });
  yield* priorityStep(g);if(g.finEndTurn)break phases;
  if(g.finExtraEnd){g.finExtraEnd=false;g.finEndNumber=2;emit(g,{type:'step',step:'endStep',player:a});yield* priorityStep(g);}
  }
  // 清除
  g.phase = 'cleanup';
  const handLimit=mshStatic(g,a,'handTen').length?10:Math.max(0,7-(frontierStatic(g,(1-a)as PID,'dsk:winterHand').length&&new Set(g.players[(1-a)as PID].graveyard.flatMap(id=>g.cards[id].def.types)).size>=4?new Set(g.players[(1-a)as PID].graveyard.flatMap(id=>g.cards[id].def.types)).size:0));
  const over = pl.noHandLimit||frontierStatic(g,a,'fdn:noHandLimit').length||frontierStatic(g,a,'dsk:noHandLimit').length||mkmStatic(g,a,'noMaxHand').length||mshStatic(g,a,'noMaxHand').length ? 0 : pl.hand.length - handLimit;
  if (over > 0) {
    const r: Response = yield {
      type: 'choose',
      player: a,
      prompt: `手牌上限為 7 張，請棄掉 ${over} 張`,
      options: pl.hand.slice(),
      min: over,
      max: over,
      purpose: 'discard',
    };
    let ids = r.type === 'choose' ? r.ids.filter((id) => pl.hand.includes(id)).slice(0, over) : [];
    for (const id of pl.hand) if (ids.length < over && !ids.includes(id)) ids.push(id);
    ids = ids.slice(0, over);
    for (const id of ids) discard(g, g.cards[id]);
  }
  for (const id of g.battlefield) {
    const c = g.cards[id];
    if(!abilitiesOf(g,c).some(ab=>ab.kind==='static'&&ab.fin==='adamantoise'))c.damage = 0;
    c.dtDamage = false;
    if(c.returnControl?.turn===g.turn){const old=c.controller;c.controller=c.returnControl.player;c.returnControl=undefined;if(c.finMarks?.uniformTurn===g.turn&&c.attachedTo!==null&&g.cards[c.attachedTo]?.controller===old)c.attachedTo=null;emit(g,{type:'fin',action:'controlChange',card:c.id,player:c.controller,amount:old});}
    // 暫時成為生物的地恢復原狀
    if (c.baseDef&&c.mshCopyUntil===undefined&&!c.frontierMarks?.permanentAnimation&&(c.frontierMarks?.animationUntilTurn??0)<=g.turn) {
      c.def = c.baseDef;
      c.orbitTypeDef=undefined;c.orbitAppliedDef=undefined;
      c.meadowTypeDef=undefined;
      c.baseDef = undefined;
      c.copyLayer=undefined;
    }
  }
  g.eot = g.eot.filter((e) => e.until !== undefined);
  for(const c of Object.values(g.cards)){const permission=c.eclCast;if(permission&&((permission.until!==undefined&&permission.until<=g.turn)||(permission.by===a&&permission.nextTurn!==undefined&&permission.nextTurn<=(g.players[a].eclTurnCount??0))))c.eclCast=undefined;}
  // 清除階段若有觸發，再給一次優先權
  if (g.pending.length) yield* priorityStep(g);
}

export function* runGame(g: GameState, firstPlayer?: PID): Flow {
  try {
    g.firstPlayer = firstPlayer ?? (randInt(g, 2) as PID);
    log(g, `${g.players[g.firstPlayer].name} 先攻`, g.firstPlayer, 'turn');
    yield* mulligans(g);
    for (;;) yield* turn(g);
  } catch (e) {
    if (e instanceof GameOver) {
      g.phase = 'cleanup';
      g.version++;
      return;
    }
    throw e;
  }
}
