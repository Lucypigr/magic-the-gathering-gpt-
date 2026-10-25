import {frontierCanBlock,frontierStatic,enchanted} from './frontier-support';
import {mshStatic} from './msh-support';
import {mkmStatic} from './mkm-support';
import {colorsOf,parseCost} from './mana';
import {payCost} from './actions';
import { abilitiesOf,matches,abilitiesSuppressed, cardName, creaturesOf, hasStaticFlag, isCreature, log, other, show, stats } from './state';
import type { Card, GameState, PID } from './types';
import { tapCard } from './zones';
import { dealDamage, emit } from './zones';

export function canAttack(g: GameState, c: Card): boolean {
  if (!isCreature(c) || c.zone !== 'battlefield' || c.tapped) return false;
  if (c.controller !== g.active) return false;
  if(g.landCombatOnly&&!c.def.types.includes('Land')&&c.def.id!=='tok-earth')return false;
  if(stats(g,c).kw.has('flying')&&mshStatic(g,(1-c.controller) as PID,'stormFlying').length)return false;
  const st = stats(g, c);
  if(frontierStatic(g,other(c.controller),'erietteAttack').some(s=>enchanted(g,c,s.controller)))return false;
  if (st.cantAttack || (st.kw.has('defender') && !st.ignoreDefender)) return false;
  if (c.sick && !st.kw.has('haste')) return false;
  return true;
}

export function attackCandidates(g: GameState, pid: PID): Card[] {
  return creaturesOf(g, pid).filter((c) => canAttack(g, c));
}

/** 阻擋者是否能阻擋此攻擊者（不考慮威懾） */
export function canBlock(g: GameState, blocker: Card, attacker: Card): boolean {
  if (!isCreature(blocker) || blocker.zone !== 'battlefield' || blocker.tapped) return false;
  if (!attacker.attacking || attacker.zone !== 'battlefield') return false;
  if (blocker.controller === attacker.controller) return false;
  if(!frontierCanBlock(g,blocker,attacker))return false;
  if(frontierStatic(g,attacker.controller,'fdn:protectionEverything').some(c=>c.id===attacker.id))return false;
  if(!abilitiesSuppressed(g,attacker)){const keys=abilitiesOf(g,attacker).filter(a=>a.kind==='static').map(a=>a.kind==='static'?a.frontier:undefined);if(keys.includes('fdn:cantBlockedHumans')&&matches(g,{sub:'Human'},blocker,blocker.controller)||keys.includes('fdn:cantBlockedWalls')&&matches(g,{sub:'Wall'},blocker,blocker.controller)||keys.includes('fdn:cantBlockedSmall')&&stats(g,blocker).p<=2||keys.includes('dsk:cantBlockedGlimmers')&&matches(g,{sub:'Glimmer'},blocker,blocker.controller))return false;}
  const bs = stats(g, blocker);
  if (bs.cantBlock) return false;
  const as = stats(g, attacker);
  if(as.kw.has('protection_opponent')&&blocker.controller!==attacker.controller)return false;
  if(as.kw.has('protection_colors')&&colorsOf(blocker.def).length)return false;
  if(bs.p>=3&&as.p<=2&&mkmStatic(g,attacker.controller,'delney').length)return false;
  if(attacker.def.id==='pompous-gadabout'&&blocker.hidden)return false;
  if(g.battlefield.some(id=>g.cards[id].def.id==='burden-of-proof'&&g.cards[id].attachedTo===blocker.id)&&attacker.def.subtypes?.includes('Detective')&&!(blocker.controller===g.cards[g.battlefield.find(id=>g.cards[id].def.id==='burden-of-proof'&&g.cards[id].attachedTo===blocker.id)!].controller&&blocker.def.subtypes?.includes('Detective')))return false;
  if(bs.kw.has('flying')&&mshStatic(g,attacker.controller,'stormFlying').length)return false;
  if(attacker.mshMarks?.hasteBlock===g.turn&&!bs.kw.has('haste'))return false;
  if (as.kw.has('unblockable')) return false;
  if(!abilitiesSuppressed(g,attacker)&&attacker.def.evadePowGte!==undefined&&bs.p>=attacker.def.evadePowGte)return false;
  if(!abilitiesSuppressed(g,attacker)&&attacker.def.evadeGreaterPower&&bs.p>as.p)return false;
  if((blocker.def.id==='tok-tla-spirit'&&!attacker.def.subtypes?.includes('Spirit'))||(attacker.def.id==='tok-tla-spirit'&&!blocker.def.subtypes?.includes('Spirit')))return false;
  if (as.kw.has('flying') && !bs.kw.has('flying') && !bs.kw.has('reach')) return false;
  if (!abilitiesSuppressed(g,attacker)&&attacker.def.evadePowLte !== undefined && bs.p <= attacker.def.evadePowLte) return false;
  return true;
}

export function attackers(g: GameState): Card[] {
  return g.battlefield.map((id) => g.cards[id]).filter((c) => c.attacking);
}

export function blockCandidates(g: GameState, pid: PID): Card[] {
  const atk = attackers(g);
  return creaturesOf(g, pid).filter((b) => atk.some((a) => canBlock(g, b, a)));
}

/** 可以被攻擊的鵬洛客（防守玩家操控的） */
export function attackablePlaneswalkers(g: GameState, attacker: PID): Card[] {
  return g.battlefield.map((id) => g.cards[id]).filter((c) => c.controller !== attacker && c.def.types.includes('Planeswalker') && !(c.attachedTo!==null&&!abilitiesSuppressed(g,c)&&abilitiesOf(g,c).some(a=>a.kind==='static'&&a.frontier==='dft:aetherspark')));
}

export function declareAttackers(g: GameState, pid: PID, ids: number[], targets?: Record<number, number>): Card[] {
  const forced=g.battlefield.filter(id=>{const c=g.cards[id];return c.controller===pid&&canAttack(g,c)&&((c.mkmMarks?.mustAttackBlock===g.turn)||(c.frontierMarks?.bdMustAttack===g.turn)||(!abilitiesSuppressed(g,c)&&abilitiesOf(g,c).some(a=>a.kind==='static'&&a.frontier==='fdn:mustAttack'))||(!abilitiesSuppressed(g,c)&&['red-herring','ares-god-of-war','tok-msh-void','tok-msh-alien'].includes(c.def.id)));});
  const uniq = [...new Set([...ids,...forced])];
  const list = uniq.map((id) => g.cards[id]).filter((c) => c && c.controller === pid && canAttack(g, c));
  const tax=frontierStatic(g,(1-pid) as PID,'archangelTax').filter(c=>!c.tapped).length;
  if(tax&&list.length){
    // Nonvigilant attackers are already tapped when attack costs are paid.
    const reserved=list.filter(c=>!stats(g,c).kw.has('vigilance'));for(const c of reserved)c.tapped=true;
    const paid=payCost(g,pid,parseCost('{'+tax*list.length+'}'));for(const c of reserved)c.tapped=false;
    if(!paid)return [];
  }
  const pws = new Set(attackablePlaneswalkers(g, pid).map((c) => c.id));
  const attackedPw = new Set<number>();
  const oldTapGroup=g.mshTapGroup;g.mshTapGroup=g.nextSid++;
  for (const c of list) {
    c.attacking = true;
    c.attackedTurn = g.turn;
    const t = targets?.[c.id];
    c.attackTarget = t != null && pws.has(t) ? t : null;
    // 「每個戰鬥只能有一個生物攻擊此鵬洛客」：多出來的攻擊玩家
    if (c.attackTarget != null) {
      const pw = g.cards[c.attackTarget];
      if (hasStaticFlag(g, pw.controller, 'pwOneAttacker') && attackedPw.has(pw.id)) c.attackTarget = null;
      else attackedPw.add(pw.id);
    }
    if (!stats(g, c).kw.has('vigilance')) tapCard(g,c);
  }
  g.mshTapGroup=oldTapGroup;
  if (list.length) {
    g.attackedThisTurn = true;
    const desc = (c: Card) => (c.attackTarget != null ? `${cardName(c)}（→ ${cardName(g.cards[c.attackTarget])}）` : cardName(c));
    log(g, `攻擊：${list.map(desc).join('、')}`, pid, 'combat');
    for (const c of list) emit(g, { type: 'attacks', card: c.id });
    emit(g, { type: 'youAttack', player: pid, attackers: list.map((c) => c.id) });
    show(g, { kind: 'attack', player: pid, pairs: list.map((c) => [c.id, c.attackTarget ?? -1] as [number, number]) });
  }
  g.version++;
  return list;
}

/** 驗證並套用阻擋宣告；回傳實際生效的阻擋 */
export function declareBlockers(g: GameState, pid: PID, blocks: [number, number][]): [number, number][] {
  const used = new Set<number>();
  let valid: [number, number][] = [];
  for (const [b, a] of blocks) {
    const bc = g.cards[b];
    const ac = g.cards[a];
    if (!bc || !ac || used.has(b) || bc.controller !== pid) continue;
    if (!canBlock(g, bc, ac)) continue;
    used.add(b);
    valid.push([b, a]);
  }
  for(const a of attackers(g).filter(c=>(['raphael-ninja-destroyer','vinebred-brawler'].includes(c.def.id)||c.frontierMarks?.mustBlocked===g.turn||c.frontierMarks?.cpMustBlocked===g.turn||abilitiesOf(g,c).some(a=>a.kind==='static'&&a.frontier==='dsk:mustBlocked')||c.finMarks?.mustBlock===g.turn||g.battlefield.some(id=>g.cards[id].attachedTo===c.id&&g.cards[id].def.id==='the-masamune'))&&!abilitiesSuppressed(g,c))){
    const st=stats(g,a),minimum=a.def.id==='relentless-x-atm092'||a.frontierMarks?.cpBlockThree===g.turn||abilitiesOf(g,a).some(a=>a.kind==='static'&&a.frontier==='lci:blockThree')?3:st.kw.has('menace')?2:1;
    if(st.onlyOneBlocker&&minimum>1)continue;
    const assigned=valid.filter(([,id])=>id===a.id);
    if(assigned.length>=minimum)continue;
    const candidates=creaturesOf(g,pid).filter(c=>canBlock(g,c,a)).sort((x,y)=>Number(valid.some(([id])=>id===x.id))-Number(valid.some(([id])=>id===y.id)));
    if(candidates.length<minimum)continue;
    const chosen=[...new Set([...assigned.map(([id])=>id),...candidates.map(c=>c.id)])].slice(0,minimum);
    valid=valid.filter(([id])=>!chosen.includes(id));valid.push(...chosen.map(id=>[id,a.id] as [number,number]));
  }
  for(const id of g.battlefield){const b=g.cards[id];if(b.controller!==pid||valid.some(([id])=>id===b.id))continue;const w=g.cards[b.mkmMarks?.blockWolf??-1];const target=w?.attacking&&canBlock(g,b,w)?w:b.mkmMarks?.mustAttackBlock===g.turn?attackers(g).find(a=>canBlock(g,b,a)):undefined;if(target)valid.push([b.id,target.id]);}
  // 威懾：只被一個生物阻擋的攻擊無效
  const countFor = (a: number) => valid.filter(([, x]) => x === a).length;
  valid = valid.filter(([, a]) => !(g.cards[a].def.id==='relentless-x-atm092'||g.cards[a].frontierMarks?.cpBlockThree===g.turn||abilitiesOf(g,g.cards[a]).some(a=>a.kind==='static'&&a.frontier==='lci:blockThree')?countFor(a)<3:stats(g,g.cards[a]).kw.has('menace')&&countFor(a)<2));
  valid = valid.filter(([,a],i) => !stats(g,g.cards[a]).onlyOneBlocker || valid.findIndex(([,id])=>id===a)===i);
  const tax=frontierStatic(g,(1-pid) as PID,'archangelTax').filter(c=>c.attacking).length;if(tax&&valid.length&&!payCost(g,pid,parseCost('{'+tax*valid.length+'}')))return [];
  for (const [b, a] of valid) {
    const bc = g.cards[b];
    const ac = g.cards[a];
    bc.blocking = a;
    ac.blockedBy.push(b);
    ac.wasBlocked = true;
    for(const [source,otherCard] of [[bc,ac],[ac,bc]])if(source.def.id==='skewer-slinger')emit(g,{type:'frontier',action:'slingerBlock',card:source.id,other:otherCard.id,player:source.controller,amount:0});
  }
  for(const a of attackers(g))if(a.blockedBy.length&&a.def.subtypes?.includes('Rat'))emit(g,{type:'frontier',action:'ratBlocked',card:a.id,player:a.controller,amount:0});
  for(const a of attackers(g))if(a.blockedBy.length)emit(g,{type:'mkm',action:'blocked',card:a.id,player:a.controller});
  if (valid.length) {
    log(
      g,
      `阻擋：${valid.map(([b, a]) => `${cardName(g.cards[b])} 擋 ${cardName(g.cards[a])}`).join('；')}`,
      pid,
      'combat',
    );
    for (const [b] of valid) emit(g, { type: 'blocks', card: b });
    show(g, { kind: 'block', player: pid, pairs: valid });
  }
  g.version++;
  return valid;
}

export function hasFirstStrikers(g: GameState): boolean {
  return g.battlefield.some((id) => {
    const c = g.cards[id];
    if (!c.attacking && c.blocking == null) return false;
    const k = stats(g, c).kw;
    return k.has('first_strike') || k.has('double_strike');
  });
}

type DamageStep = 'first' | 'regular' | 'all';

function dealsIn(g: GameState, c: Card, step: DamageStep): boolean {
  if (step === 'all') return true;
  const k = stats(g, c).kw;
  const fs = k.has('first_strike');
  const ds = k.has('double_strike');
  return step === 'first' ? fs || ds : !fs || ds;
}

/** 攻擊者的傷害分配：先給阻擋者致命傷害，剩餘的（踐踏）給玩家 */
export function assignAttackerDamage(
  g: GameState,
  a: Card,
  blockers: Card[],
  power: number,
): { card?: Card; player?: PID; n: number }[] {
  const st = stats(g, a);
  const dt = st.kw.has('deathtouch');
  const trample = st.kw.has('trample');
  const out: { card?: Card; player?: PID; n: number }[] = [];
  if (power <= 0) return out;
  const need = (b: Card) => (dt ? 1 : Math.max(1, stats(g, b).t - b.damage));
  const sorted = [...blockers].sort((x, y) => need(x) - need(y));
  let rem = power;
  for (const b of sorted) {
    const give = Math.min(rem, need(b));
    if (give > 0) out.push({ card: b, n: give });
    rem -= give;
    if (rem <= 0) break;
  }
  if (rem > 0) {
    if (trample) out.push({ player: other(a.controller), n: rem });
    else if (out.length) out[0].n += rem;
  }
  return out;
}

/** 戰鬥傷害使用的力量（防禦力大於力量且被授予時，以防禦力代替） */
function combatPower(g: GameState, c: Card): number {
  const st = stats(g, c);
  if (st.damageAbs && st.p < 0) return -st.p;
  return st.damageByToughness && st.t > st.p ? st.t : st.p;
}

export function combatDamage(g: GameState, step: DamageStep): void {
  const hits: { src: Card; card?: Card; player?: PID; n: number }[] = [];
  for (const a of attackers(g)) {
    if (!dealsIn(g, a, step)) continue;
    const p = combatPower(g, a);
    if (p <= 0) continue;
    // 攻擊鵬洛客：傷害給該鵬洛客；它已經離開戰場的話不造成傷害
    const pw = a.attackTarget != null ? g.cards[a.attackTarget] : null;
    const pwGone = a.attackTarget != null && (!pw || pw.zone !== 'battlefield');
    const toDefender = (n: number) => {
      if (pw && !pwGone) hits.push({ src: a, card: pw, n });
      else if (!pwGone) hits.push({ src: a, player: other(a.controller), n });
    };
    const blockers = a.blockedBy.map((id) => g.cards[id]).filter((b) => b && b.zone === 'battlefield');
    if (!a.wasBlocked) {
      toDefender(p);
    } else if (blockers.length === 0) {
      if (stats(g, a).kw.has('trample')) toDefender(p);
    } else {
      for (const h of assignAttackerDamage(g, a, blockers, p)) {
        if (h.player !== undefined) toDefender(h.n);
        else hits.push({ src: a, ...h });
      }
    }
  }
  for (const id of g.battlefield) {
    const b = g.cards[id];
    if (b.blocking == null || !dealsIn(g, b, step)) continue;
    const a = g.cards[b.blocking];
    if (!a || a.zone !== 'battlefield' || !a.attacking) continue;
    const p = combatPower(g, b);
    if (p > 0) hits.push({ src: b, card: a, n: p });
  }
  const damagedPlayers = new Set<number>();
  const dealt=new Map<Card,number>();
  for (const h of hits) {
    let actual=0;
    if (h.player !== undefined) {
      actual=dealDamage(g, h.src, h.src.controller, { p: h.player }, h.n, { combat: true, batchCombat:true });
      damagedPlayers.add(h.src.controller * 2 + h.player);
    } else if (h.card) actual=dealDamage(g, h.src, h.src.controller, { c: h.card.id }, h.n, { combat: true, batchCombat:true });
    if(actual>0)dealt.set(h.src,(dealt.get(h.src)??0)+actual);
  }
  for(const [src,amount] of dealt)emit(g,{type:'combatDamageAny',source:src.id,controller:src.controller,amount});
  // 每個傷害步驟中，「一個或更多對手被造成戰鬥傷害」只觸發一次
  for (const k of damagedPlayers) emit(g, { type: 'combatBatch', attacker: (k >> 1) as PID, damaged: (k & 1) as PID });
  g.version++;
}

export function endCombat(g: GameState): void {
  for(const p of g.players){
    const ozai=g.battlefield.some(id=>g.cards[id].controller===p.id&&g.cards[id].def.id==='ozai-the-phoenix-king');
    if(ozai)(p.pool??=[]).push(...(p.firePool??[]));
    p.firePool=[];
  }
  for (const id of g.battlefield) {
    const c = g.cards[id];
    c.attacking = false;
    c.attackTarget = undefined;
    c.blocking = null;
    c.blockedBy = [];
    c.wasBlocked = false;
  }
  g.version++;
}
