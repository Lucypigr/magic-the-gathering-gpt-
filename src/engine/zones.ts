import {mshObserve,mshStatic,mshTriggerMatches,mshFlags} from './msh-support';
import {mshCounter} from './msh';
import {mkmObserve,mkmStatic,mkmTriggerMatches} from './mkm-support';
import {finTriggerMatches,finStatic} from './fin-support';
import { colorsOf } from './mana';
import { getDef } from './registry';
import {
  abilitiesOf,
  abilitiesSuppressed,
  cardName,
  checkCond,
  etbTriggersSuppressed,
  hasKw,
  hasStaticFlag,
  isCreature,
  isLand,
  lifegainBonus,
  log,
  matches,
  newCard,
  other,
  stats,
} from './state';
import type { Card, CardDef, GameEvent, GameState, PID, TargetRef, TriggeredAbility, Zone } from './types';

// ------------------------------------------------------------
// 觸發式能力偵測
// ------------------------------------------------------------
function triggerMatches(g: GameState, c: Card, ab: TriggeredAbility, ev: GameEvent): boolean {
  const pov = c.controller;
  switch (ab.on) {
    case 'mshEvent':return mshTriggerMatches(g,c,ab,ev);
    case 'mkmEvent':return mkmTriggerMatches(g,c,ab,ev);
    case 'finEvent':return finTriggerMatches(g,c,ab,ev);
    case 'combatDamagePlayerOrWalker':return ev.type==='combatPlayerOrWalker'&&ev.source===c.id;
    case 'allyCombatDamagePlayerOrWalker':return ev.type==='combatPlayerOrWalker'&&ev.controller===pov;
    case 'firstMain':return ev.type==='step'&&ev.step==='main1'&&ev.player===pov;
    case 'eachDrawStep':return ev.type==='step'&&ev.step==='draw';
    case 'transformed':return ev.type==='transformed'&&ev.card===c.id;
    case 'allyBlocks':return ev.type==='blocks'&&g.cards[ev.card].controller===pov;
    case 'permanentToGy':if(ev.type!=='permanentToGy'||ev.player!==pov||(g.eclEventGroup!==undefined&&c.eclGyGroup===g.eclEventGroup))return false;c.eclGyGroup=g.eclEventGroup;return true;

    case 'classLevel': return ev.type === 'classLevel' && ev.card === c.id && ev.level === ab.level;
    case 'otherLeaves': return ev.type === 'leaves' && ev.card !== c.id;
    case 'otherPermanentDies':return ev.type==='permanentDies'&&ev.card!==c.id&&matches(g,ab.filter,g.cards[ev.card],pov,c.id);
    case 'allyPermanentDies': return ev.type==='permanentDies'&&ev.controller===pov&&(ev.card!==c.id||!!ab.includeSelf)&&matches(g,ab.filter,g.cards[ev.card],pov,c.id);
    case 'combatDamageAny':return ev.type==='combatDamageAny'&&ev.source===c.id;
    case 'becomesTapped': return ev.type === 'tapped' && ev.card === c.id;
    case 'leaves': return ev.type === 'leaves' && ev.card === c.id;
    case 'allyLeaves': return ev.type === 'leaves' && ev.controller === pov && (ev.card !== c.id || !!ab.includeSelf) && matches(g, ab.filter, g.cards[ev.card], pov, c.id);
    case 'bend': return ev.type === 'bend' && ev.player === pov;
    case 'oppDrawSecond': return ev.type === 'drawSecond' && ev.player !== pov;
    case 'oppSearch': return ev.type === 'search' && ev.player !== pov;
    case 'etb':
      return ev.type === 'etb' && ev.card === c.id;
    case 'dies':
      return ev.type === 'dies' && ev.card === c.id;
    case 'attacks':
      return ev.type === 'attacks' && ev.card === c.id;
    case 'blocks':
      return ev.type === 'blocks' && ev.card === c.id;
    case 'upkeep':
      return ev.type === 'step' && ev.step === 'upkeep' && ev.player === pov;
    case 'oppUpkeep':
      return ev.type === 'step' && ev.step === 'upkeep' && ev.player !== pov;
    case 'endStep':
      return ev.type === 'step' && ev.step === 'endStep' && ev.player === pov;
    case 'combatStart':
      return ev.type === 'step' && ev.step === 'combatStart' && ev.player === pov;
    case 'castNoncreature':
      return ev.type === 'cast' && (ev.player === pov || !!ab.anyPlayer) && !isCreature(g.cards[ev.card]);
    case 'castInstSorc': {
      if (ev.type !== 'cast' || ev.player !== pov) return false;
      const t = g.cards[ev.card].def.types;
      return t.includes('Instant') || t.includes('Sorcery');
    }
    case 'castAny': {
      if (ev.type !== 'cast' || !(ev.player === pov || ab.anyPlayer || ab.oppOnly)) return false;
      if (ab.preparedOnly && g.stack.find((s) => s.kind === 'spell' && s.cardId === ev.card)?.alt !== 'prepared') return false;
      if (ab.oppOnly && ev.player === pov) return false;
      // 該咒語以對手或其生物為目標
      if (ab.targetsOpp) {
        const item = g.stack.find((s) => s.kind === 'spell' && s.cardId === ev.card);
        return !!item?.targets.some((t) => t && ('p' in t ? t.p !== pov : g.cards[t.c] && isCreature(g.cards[t.c]) && g.cards[t.c].controller !== pov));
      }
      if (matches(g, ab.filter, g.cards[ev.card], pov, c.id)) return true;
      // 或是該咒語的目標中有符合條件的永久物
      if (ab.orTargets) {
        const item = g.stack.find((s) => s.kind === 'spell' && s.cardId === ev.card);
        return !!item?.targets.some((t) => t && 'c' in t && g.cards[t.c] && matches(g, ab.orTargets, g.cards[t.c], pov, c.id));
      }
      return false;
    }
    case 'allyEtb': {
      if (ev.type !== 'etb' || ev.card === c.id || ev.controller !== pov) return false;
      const e = g.cards[ev.card];
      return isCreature(e) && matches(g, ab.filter, e, pov, c.id);
    }
    case 'anyEtb': {
      if (ev.type !== 'etb' || ev.card === c.id) return false;
      return isCreature(g.cards[ev.card]) && matches(g, ab.filter, g.cards[ev.card], pov, c.id);
    }
    case 'allyDies': {
      if (ev.type !== 'dies' || ev.controller !== pov) return false;
      if (!ab.includePw && !isCreature(g.cards[ev.card])) return false;
      if (ev.card === c.id && !ab.includeSelf) return false;
      return matches(g, ab.filter, g.cards[ev.card], pov, c.id);
    }
    case 'landfall':
      return ev.type === 'etb' && ev.controller === pov && isLand(g.cards[ev.card]) && matches(g, ab.filter, g.cards[ev.card], pov, c.id);
    case 'lifegain':
      return ev.type === 'lifegain' && ev.player === pov;
    case 'combatDamagePlayer':
      return ev.type === 'combatDamage' && ev.source === c.id;
    case 'allyCombatDamagePlayer':
      return ev.type === 'combatDamage' && g.cards[ev.source]?.controller === pov && matches(g, ab.filter, g.cards[ev.source], pov, c.id);
    case 'dealtDamage':
      return ev.type === 'damaged' && ev.card === c.id;
    case 'targeted':
      return ev.type === 'targeted' && ev.card === c.id && ev.by === pov && (!ab.spellOnly || ev.spell);
    case 'youAttack':
      return (
        ev.type === 'youAttack' &&
        ev.player === pov &&
        (!ab.alone || ev.attackers.length === 1) &&
        (!ab.filter || ev.attackers.some((a) => matches(g, ab.filter, g.cards[a], pov, c.id)))
      );
    case 'oppLifeLoss':
      return ev.type === 'lifeloss' && ev.player !== pov;
    case 'sacrifice':
      return ev.type === 'sacrifice' && ev.player === pov && matches(g, ab.filter, g.cards[ev.card], pov, c.id);
    case 'otherDies':
      return ev.type === 'dies' && ev.card !== c.id && (ab.includePw || isCreature(g.cards[ev.card])) && matches(g, ab.filter, g.cards[ev.card], pov, c.id);
    case 'allyPermEtb':
      return ev.type === 'etb' && ev.card !== c.id && ev.controller === pov && matches(g, ab.filter, g.cards[ev.card], pov, c.id);
    case 'allyCounters':
      return ev.type === 'counterPlaced' && ev.controller === pov && matches(g, ab.filter, g.cards[ev.card], pov, c.id);
    case 'allyTargeted': {
      if (ev.type !== 'targeted' || ev.by === pov) return false;
      const t = g.cards[ev.card];
      return !!t && t.controller === pov && isCreature(t) && matches(g, ab.filter, t, pov, c.id);
    }
    case 'drawSecond':
      return ev.type === 'drawSecond' && ev.player === pov;
    case 'turnedFaceUp':
      return ev.type === 'turnedFaceUp' && ev.card === c.id;
    case 'scry':
      return ev.type === 'scry' && ev.player === pov;
    case 'loyaltyPlaced':
      return ev.type === 'loyaltyPlaced' && ev.controller === pov;
    case 'loyaltyActivated':
      return ev.type === 'loyaltyActivated' && ev.controller === pov && ev.removed >= (ab.minRemoved ?? 0) && (!ab.filter || matches(g, ab.filter, g.cards[ev.card], pov, c.id));
    case 'noncombatOpp':
      return ev.type === 'noncombat' && ev.player !== pov;
    case 'anyDiscard':
      return ev.type === 'discard' && (ab.eachDiscard?!ev.batchSummary:!ev.batchPart) && (!ab.ownDiscard || ev.player===pov);
    case 'discardSelf':
      return ev.type === 'discard' && !ev.batchSummary && ev.card === c.id && ev.player === pov;
    case 'oppDrawStep':
      return ev.type === 'step' && ev.step === 'draw' && ev.player !== pov;
    case 'attackedYou': {
      if (ev.type !== 'attacks') return false;
      const a = g.cards[ev.card];
      if (!a || a.controller === pov) return false;
      return a.attackTarget == null || g.cards[a.attackTarget]?.controller === pov;
    }
    case 'allyAttacks':
      return ev.type === 'attacks' && g.cards[ev.card]?.controller === pov;
    case 'attachedDies':
      return ev.type === 'dies' && c.attachedTo === ev.card;
    case 'mainStart':
      return ev.type === 'step' && ev.step === 'main1' && ev.player === pov;
    case 'eachUpkeep':
      return ev.type === 'step' && ev.step === 'upkeep';
    case 'oppBlocks': {
      if (ev.type !== 'blocks') return false;
      const b = g.cards[ev.card];
      return !!b && b.controller !== pov && matches(g, ab.filter, b, pov, c.id);
    }
    case 'oppLoyaltyActivated':
      return ev.type === 'loyaltyActivated' && ev.controller !== pov;
    case 'eachEndStep':
      return ev.type === 'step' && ev.step === 'endStep';
    case 'targetedByOpp':
      return ev.type === 'targeted' && ev.card === c.id && ev.by !== pov;
    case 'oppCombatDamaged':
      return ev.type === 'combatBatch' && ev.attacker === pov && ev.damaged !== pov;
  }
}

/** 勇行：每當你施放非生物咒語時，此生物得+1/+1直到回合結束 */
const PROWESS: TriggeredAbility = { kind: 'trigger', on: 'castNoncreature', effects: [{ e: 'pump', what: 'self', p: 1, t: 1 }] };

export function tapCard(g: GameState, c: Card): void {
  if (c.tapped) return;
  c.tapped = true;
  emit(g, { type: 'tapped', card: c.id, controller: c.controller });
  g.version++;
}

export function bend(g: GameState, player: PID, element: 'air' | 'water' | 'earth' | 'fire'): void {
  const p = g.players[player];
  p.bends = [...new Set([...(p.bends ?? []), element])];
  emit(g, { type: 'bend', player, element });
}

export function emit(g: GameState, ev: GameEvent): void {
  mkmObserve(g,ev);
  mshObserve(g,ev);
  if(ev.type==='dies'){for(const pl of g.players)(pl.finFlags??={}).creaturesDied=(pl.finFlags?.creaturesDied??0)+1;(g.players[other(ev.controller)].finFlags??={}).opponentCreatureDied=1;}
  if(ev.type==='combatDamage'){const source=g.cards[ev.source],pid=source.controller;(g.players[ev.player].finFlags??={}).combatTaken=(g.players[ev.player].finFlags?.combatTaken??0)+ev.amount;if(source.def.supertypes?.includes('Legendary'))(g.players[pid].finFlags??={}).legendCombat=1;if(matches(g,{sub:['Scout','Pirate','Rogue']},source,pid))for(const c of g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===pid&&c.def.id==='vaan-street-thief'))(c.finMarks??={}).vaanHit=1;}
  if(ev.type==='cast'&&g.cards[ev.card].def.id==='photon-blast-barrage'){const n=g.stack.find(s=>s.kind==='spell'&&s.cardId===ev.card)?.x??0;if(n)g.pending.push({source:ev.card,controller:ev.player,abilityIndex:-90,ev,ability:{kind:'trigger',on:'castAny',effects:[{e:'msh',action:'photonCopies',n}]}});}
  if(ev.type==='cast'){const c=g.cards[ev.card],p=g.players[ev.player];if(isCreature(c)&&matches(g,{sub:'Human'},c,ev.player)){const before=p.finFlags?.humanCast??0;(p.finFlags??={}).humanCast=before+1;;}if(isCreature(c)&&c.def.supertypes?.includes('Legendary'))(p.finFlags??={}).legendCast=(p.finFlags?.legendCast??0)+1;}

  if(ev.type==='step'&&ev.step==='endStep')for(const c of Object.values(g.cards))if(c.eclCast?.mode==='nextEnd')c.eclCast=undefined;
  if(ev.type==='targeted'&&ev.stackSid!==undefined){const c=g.cards[ev.card];if(c&&c.controller!==ev.by&&!abilitiesSuppressed(g,c)){
    const costs:number[]=[];if(c.def.set==='ECL'&&c.def.wardLife)costs.push(c.def.wardLife);
    if(isCreature(c))for(const id of g.battlefield){const source=g.cards[id];if(id!==c.id&&source.controller===c.controller&&abilitiesOf(g,source).some(a=>a.kind==='static'&&a.ecl==='squelcher'))costs.push(2);}
    for(const cost of costs)g.pending.push({source:c.id,controller:c.controller,abilityIndex:-23,ev,ability:{kind:'trigger',on:'targeted',effects:[{e:'ecl',action:'wardLife',n:ev.stackSid,value:cost}]}});
  }}
  if(ev.type==='etb'&&isCreature(g.cards[ev.card]))(g.players[ev.controller].eclEntries??=[]).push(ev.card);
  if(ev.type==='counterPlaced'&&isCreature(g.cards[ev.card]))g.players[ev.controller].eclCounterPlaced=true;
  if(ev.type==='youAttack')g.players[ev.player].eclAttackedMerfolk=(g.players[ev.player].eclAttackedMerfolk??0)+ev.attackers.filter(id=>matches(g,{sub:'Merfolk'},g.cards[id],ev.player)).length;
  if(ev.type==='etb')for(const id of g.battlefield){const s=g.cards[id],c=g.cards[ev.card];if(s.controller!==ev.controller||!s.eclType||!matches(g,{sub:s.eclType},c,s.controller))continue;
    for(const ab of abilitiesOf(g,s))if(ab.kind==='static'&&(ab.ecl==='pennant'||ab.ecl==='torque'))g.pending.push({source:s.id,controller:s.controller,abilityIndex:-20,ev,ability:{kind:'trigger',on:'etb',effects:ab.ecl==='pennant'?[{e:'gain',n:1}]:[{e:'chargeCounter',what:'self',n:1}]}});
  }

  if(ev.type==='targeted'&&ev.stackSid!==undefined){
    const c=g.cards[ev.card];
    if(c&&c.controller!==ev.by&&!abilitiesSuppressed(g,c)){
      let mana=0;for(const source of finStatic(g,c.controller,'yunaKeywords'))if(g.active===c.controller&&(source.id===c.id||isCreature(c)&&c.def.types.includes('Enchantment')))mana+=2;
      for(const id of g.battlefield){const eq=g.cards[id];if(eq.attachedTo===c.id&&abilitiesOf(g,eq).some(a=>a.kind==='static'&&a.fin==='paladinWard'))mana++;}
      for(const id of g.battlefield){const a=g.cards[id];if(a.attachedTo===c.id)for(const ab of abilitiesOf(g,a))if(ab.kind==='static'&&((ab.msh==='equipWard1')||(ab.msh==='equipWard2')))mana+=ab.msh==='equipWard1'?1:2;}
      if(mana)g.pending.push({source:c.id,controller:c.controller,abilityIndex:-45,ev,ability:{kind:'trigger',on:'targeted',effects:[{e:'tmt',action:'ward',n:ev.stackSid,amount:mana}]}});
      if(c.def.fin?.wardPower)g.pending.push({source:c.id,controller:c.controller,abilityIndex:-46,ev,ability:{kind:'trigger',on:'targeted',effects:[{e:'ecl',action:'wardLife',n:ev.stackSid,value:Math.max(0,stats(g,c).p)}]}});
    }

    if(c&&c.controller!==ev.by&&!abilitiesSuppressed(g,c)&&['the-serpent-society','titania-rugged-rumbler'].includes(c.def.id))g.pending.push({source:c.id,controller:c.controller,abilityIndex:-72,ev,ability:{kind:'trigger',on:'targeted',effects:[{e:'msh',action:'ward',n:ev.stackSid}]}});
    if(c&&c.controller!==ev.by&&!abilitiesSuppressed(g,c)&&(c.def.id==='vein-ripper'||c.def.id==='axebane-ferox'))g.pending.push({source:c.id,controller:c.controller,abilityIndex:-71,ev,ability:{kind:'trigger',on:'targeted',effects:[{e:'mkm',action:'ward',n:ev.stackSid}]}});
    if((c?.def.set==='TMT'||c?.def.set==='ECL'||c?.def.set==='FIN'||c?.def.set==='MKM'||c?.def.set==='MSH')&&c.def.ward&&c.controller!==ev.by&&!abilitiesSuppressed(g,c)){
      const extra=g.battlefield.reduce((n,id)=>{const s=g.cards[id];return n+(s.controller===c.controller?abilitiesOf(g,s).filter(a=>a.kind==='static'&&a.triggerDouble&&matches(g,a.triggerDouble,c,c.controller,s.id)).length:0);},0);
      for(let i=0;i<(1+extra);i++)g.pending.push({source:c.id,controller:c.controller,abilityIndex:-3,ev,ability:{kind:'trigger',on:'targeted',effects:[{e:'tmt',action:'ward',n:ev.stackSid,amount:c.def.ward}]}});
    }
  }
  if (ev.type === 'sacrifice') g.players[ev.player].sacrificedThisTurn = true;
  if(ev.type==='cast'){const p=g.players[ev.player];p.spellTypesThisTurn=[...new Set([...(p.spellTypesThisTurn??[]),...g.cards[ev.card].def.types])];}
  if (ev.type === 'etb') {
    const e = g.cards[ev.card];
    if (e && (isCreature(e) || e.def.types.includes('Artifact')) && etbTriggersSuppressed(g)) return;
  }
  if (ev.type === 'discard') {
    // 「當你棄掉這張牌時」：來源已在墳墓場
    const dc = g.cards[ev.card];
    const dabs = dc?.def.abilities ?? [];
    for (let i = 0; i < dabs.length; i++) {
      const ab = dabs[i];
      if (ab.kind === 'trigger' && ab.on === 'discardSelf' && triggerMatches(g, dc, ab, ev)) {
        g.pending.push({ source: dc.id, controller: dc.owner, ability: ab, abilityIndex: i, ev });
      }
    }
  }
  if(ev.type==='etb'&&(isCreature(g.cards[ev.card])||g.cards[ev.card].def.types.includes('Artifact'))&&g.battlefield.some(id=>abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.mkm==='noEtb')))return;
  for (const id of g.battlefield) {
    const c = g.cards[id];
    const finExtra=g.battlefield.reduce((n,sid)=>{const source=g.cards[sid];if(source.controller!==c.controller)return n;for(const a of abilitiesOf(g,source))if(a.kind==='static'){if(a.fin==='masamune'&&ev.type==='dies'){const host=g.cards[source.attachedTo??-1];if(host&&host.controller===c.controller&&(host.id===c.id||c.def.types.includes('Emblem')&&c.owner===host.controller))n++;}if(a.fin==='cloudDouble'&&g.battlefield.some(id=>g.cards[id].attachedTo===source.id&&g.cards[id].def.equip)&&(c.id===source.id||c.attachedTo===source.id))n++;if(a.fin==='travelingDouble'&&ev.type==='etb'&&g.cards[ev.card].controller===source.controller&&(isLand(g.cards[ev.card])||matches(g,{sub:'Bird'},g.cards[ev.card],source.controller)))n++;}return n;},0);
    const extraTriggers=(isCreature(c)&&stats(g,c).p<=2?mkmStatic(g,c.controller,'delney').length:0)+finExtra+g.battlefield.reduce((n,id)=>{const s=g.cards[id];return n+(s.controller===c.controller?abilitiesOf(g,s).filter(a=>a.kind==='static'&&((a.allyTriggerDouble&&c.def.subtypes?.includes('Ally'))||(a.triggerDouble&&matches(g,a.triggerDouble,c,c.controller,s.id)))).length:0);},0);
    if (ev.type === 'cast' && hasKw(g, c, 'prowess') && triggerMatches(g, c, PROWESS, ev)) {
      for(let i=0;i<(1+extraTriggers);i++)g.pending.push({ source: c.id, controller: c.controller, ability: PROWESS, abilityIndex: -1, ev });
    }
    const fire = c.grantedFirebend?.turn === g.turn ? c.grantedFirebend.n : c.def.firebending;
    if (fire !== undefined && ev.type === 'attacks' && ev.card === c.id && !abilitiesSuppressed(g,c)) for(let i=0;i<(1+extraTriggers);i++) g.pending.push({ source:c.id, controller:c.controller, abilityIndex:-2, ev, ability:{kind:'trigger',on:'attacks',effects:[{e:'firebend',n:fire}]} });
    const abs = abilitiesOf(g, c);
    // 裝備授予被裝備生物的觸發式異能
    for (const sid of g.battlefield) {
      const eq = g.cards[sid];
      const tr = eq.attachedTo === c.id ? eq.def.equip?.trigger : undefined;
      if (tr && !abilitiesSuppressed(g, c) && triggerMatches(g, c, tr, ev)) for (let copy=0;copy<(1+extraTriggers);copy++) g.pending.push({ source: c.id, controller: c.controller, ability: tr, abilityIndex: -1, ev });
    }
    if (!abs.length) continue;
    for (let i = 0; i < abs.length; i++) {
      const ab = abs[i];
      if (ab.kind !== 'trigger') continue;
      if (!triggerMatches(g, c, ab, ev)) continue;
      if (ab.oncePerTurn && c.usedThisTurn.includes(i)) continue;
      if (ab.cond && !checkCond(g, ab.cond, c.controller, c.id, [],ev)) continue;
      if (ab.when && !checkCond(g, ab.when, c.controller, c.id, [],ev)) continue;
      if (ab.oncePerTurn) c.usedThisTurn.push(i);
      const copies=1+extraTriggers;
      for (let copy = 0; copy < copies; copy++) g.pending.push({
        source: c.id,
        controller: c.controller,
        ability: ab,
        abilityIndex: i,
        ev,
        lkiPower: ev.type === 'dies' && ev.card === c.id ? ev.power : undefined,
      });
    }
  }
  // 來源在墳墓場時也會觸發的觸發式異能（例如「回到戰場」）
  for (const p of g.players) {
    for (const id of p.graveyard.slice()) {
      const gc = g.cards[id];
      const gabs = gc.def.abilities ?? [];
      for (let i = 0; i < gabs.length; i++) {
        const ab = gabs[i];
        if (ab.kind !== 'trigger' || !ab.fromGraveyard || !triggerMatches(g, gc, ab, ev)) continue;
        if (ab.cond && !checkCond(g, ab.cond, gc.controller, gc.id, [])) continue;
        if (ab.when && !checkCond(g, ab.when, gc.controller, gc.id, [])) continue;
        g.pending.push({ source: gc.id, controller: gc.owner, ability: ab, abilityIndex: i, ev });
      }
    }
  }
  // 本回合的延遲觸發（例如「當你下一次施放瞬間或法術時……」）
  if (g.delayed?.length) {
    for (const d of [...g.delayed]) {
      const src = g.cards[d.source];
      if (!src) continue;
      const ab: TriggeredAbility = { kind: 'trigger', on: d.on, effects: d.effects, filter:d.filter, alone:d.alone,finEvent:d.finEvent,mshEvent:d.mshEvent };
      // 延遲觸發的控制者是建立它的玩家，不一定是來源目前的控制者
      const probe = src.controller === d.controller ? src : { ...src, controller: d.controller };
      if (!triggerMatches(g, probe, ab, ev)) continue;
      g.pending.push({ source: d.source, controller: d.controller, ability: ab, abilityIndex: -1, ev });
      if (d.once) g.delayed = g.delayed.filter((x) => x !== d);
    }
  }
  if(ev.type==='etb'){const c=g.cards[ev.card];if(c.evokePaid&&c.def.evoke&&!abilitiesSuppressed(g,c))g.pending.push({source:c.id,controller:c.controller,abilityIndex:-21,ev,ability:{kind:'trigger',on:'etb',effects:[{e:'ecl',action:'evokeSac'}]}});}
  for(const pending of g.pending){pending.sourceType??=g.cards[pending.source]?.eclType;pending.sourceLinkKey??=g.cards[pending.source]?.tmtLinkKey;pending.sneakPaid??=g.cards[pending.source]?.sneakTurn===g.turn;}
}

// ------------------------------------------------------------
// 區域移動
// ------------------------------------------------------------
export function removeFromZone(g: GameState, c: Card): void {
  if (c.zone === 'battlefield') {
    const i = g.battlefield.indexOf(c.id);
    if (i >= 0) g.battlefield.splice(i, 1);
  } else if (c.zone === 'stack') {
    const i = g.stack.findIndex((s) => s.kind === 'spell' && s.cardId === c.id);
    if (i >= 0) g.stack.splice(i, 1);
  } else {
    const arr = g.players[c.owner][c.zone];
    const i = arr.indexOf(c.id);
    if (i >= 0) arr.splice(i, 1);
  }
}

function resetPermanentState(c: Card): void {
  c.copyLayer=undefined;
  c.mshHarnessed=undefined;c.mshCopyUntil=undefined;
  c.tapped = false;
  if(c.tlaLandOriginal){c.def=c.tlaLandOriginal;c.tlaLandOriginal=undefined;}
  if(c.tlaOriginalDef){c.def=c.tlaOriginalDef;c.tlaOriginalDef=undefined;}
  c.noUntapBy = undefined;
  c.returnControl = undefined;
  c.permanentGrants = undefined;
  c.charge = undefined;
  c.hexproofCounters = undefined;
  c.temporaryAbilities=undefined;
  c.eclLoseAbilities=undefined;c.eclCounters=undefined;c.eclUsage=undefined;
  c.colorProtections=undefined;
  c.classLevel=undefined;
  c.colorProtection=undefined;
  c.classModesTurn=undefined;
  c.crewedBy=undefined;
  c.crewedTurn=undefined;
  c.copiedAbilities = undefined;
  c.grantedFirebend = undefined;
  c.chosenModes = undefined;
  c.damage = 0;
  c.dtDamage = false;
  c.counters = 0;
  c.stun = 0;
  c.attacking = false;
  c.blocking = null;
  c.blockedBy = [];
  c.wasBlocked = false;
  c.sick = false;
  c.lastAttachedTo=c.attachedTo;
  c.attachedTo = null;
  c.usedThisTurn = [];
  c.exhausted = undefined;
  c.dealtCombat = undefined;
  c.loseAbilitiesTurn = undefined;
  if (c.auraBaseDef) {
    c.def = c.auraBaseDef;
    c.auraBaseDef = undefined;
  }
  c.prepared = undefined;
  c.exileAtEnd = undefined;
  c.suspected = undefined;
  c.loyalty = undefined;
  c.lore = undefined;
  c.sacAtEnd = undefined;
  c.attackTarget = undefined;
  if (c.baseDef) {
    c.def = c.baseDef;
    c.baseDef = undefined;
  }
}

export function refreshTlaPermanents(g: GameState): void {
  const zhao=g.battlefield.map(id=>g.cards[id]).find(c=>c.def.id==='zhao-the-moon-slayer'&&(c.charge??0)>0&&!abilitiesSuppressed(g,c));
  const toph=g.battlefield.map(id=>g.cards[id]).filter(c=>c.def.id==='toph-the-first-metalbender'&&!abilitiesSuppressed(g,c));
  for(const id of g.battlefield){const c=g.cards[id];const base=c.tlaLandOriginal??c.def;const metal=!c.token&&base.types.includes('Artifact')&&toph.some(t=>t.controller===c.controller);const mountain=!!zhao && (base.types.includes('Land')||metal)&&!base.supertypes?.includes('Basic');
    if(metal||mountain){c.tlaLandOriginal??=base;c.def={...base,types:metal?[...new Set([...base.types,'Land' as const])]:base.types,...(mountain?{subtypes:['Mountain'],produces:['R' as const],abilities:undefined,keywords:undefined}: {})};}
    else if(c.tlaLandOriginal){c.def=c.tlaLandOriginal;c.tlaLandOriginal=undefined;}
  }
}

export function moveCard(g: GameState, c: Card, to: Zone, bottom = false): void {
  if(c.zone==='battlefield'&&c.mkmMarks?.controlled!==undefined){const x=g.cards[c.mkmMarks.controlled];if(x?.zone==='battlefield'){x.controller=c.mkmMarks.previous as PID;if(x.tlaOriginalDef){x.def=x.tlaOriginalDef;x.tlaOriginalDef=undefined;}}}
  if(c.zone==='battlefield'){(c.mshMarks??={}).lastController=c.controller;for(const id of g.battlefield){const x=g.cards[id];if(x.mshMarks?.controlSource===c.id){x.controller=x.mshMarks.controlPlayer as PID;delete x.mshMarks.controlSource;delete x.mshMarks.controlPlayer;}if(x.mshMarks?.invasion===c.id&&x.tlaOriginalDef){x.def=x.tlaOriginalDef;x.tlaOriginalDef=undefined;x.copyLayer=undefined;delete x.mshMarks.invasion;}}}
  if(c.zone==='battlefield')(c.mkmMarks??={}).lastController=c.controller;
  if(c.tokenDeparted)return;
  if(c.zone==='stack'&&to==='graveyard'&&c.mkmMarks?.voltBottom){to='library';bottom=true;delete c.mkmMarks.voltBottom;}
  if(to==='graveyard'&&c.zone==='stack'&&c.finExileOnResolve)to='exile';
  if(to==='graveyard'&&(c.finMarks?.deathHades||finStatic(g,c.owner,'hadesExile').length))to='exile';
  if(to==='graveyard'&&c.zone==='battlefield'&&isCreature(c)&&!c.token){const crystal=c.finMarks?.deathCrystal?g.cards[c.finMarks.deathCrystal]:finStatic(g,other(c.controller),'darkness')[0];if(crystal){to='exile';(crystal.finLinked??=[]).push(c.id);gainLife(g,crystal.controller,2);}}
  if(c.zone==='stack'&&to!=='stack')c.finExileOnResolve=undefined;
  const wasOnBf = c.zone === 'battlefield';
  const from = c.zone;
  if(wasOnBf)c.eclType=undefined;
  c.eclCast=undefined;c.eclLinked=undefined;c.eclDream=undefined;c.spellWitherTurn=undefined;
  if(from!==to)c.objectVersion=(c.objectVersion??0)+1;
  // 使永久物變成生物的光環離開時，恢復原本的樣子
  if (wasOnBf && c.def.aura && c.attachedTo != null) {
    const host = g.cards[c.attachedTo];
    if (host?.auraBaseDef) {
      host.def = host.auraBaseDef;
      host.auraBaseDef = undefined;
    }
  }
  if (wasOnBf) {c.lastToughness=stats(g,c).t;c.lastCounterKinds={plus:c.counters,charge:c.charge??0,stun:c.stun,hexproof:c.hexproofCounters??0,finality:!!c.finality,lore:c.lore??0};g.players[c.controller].permanentLeftThisTurn=true;c.countersBeforeLeaving=c.counters; c.lastCounters = c.counters; c.lastPower = stats(g,c).p; emit(g, { type: 'leaves', card: c.id, controller: c.controller, counterKinds:{...c.lastCounterKinds},beheld:c.eclBeheld?.slice() }); }
  c.airbent = undefined;
  c.linkedCast = undefined;
  c.tlaExiledBy = undefined;
  c.waterCastBy = undefined;
  c.sneakTurn=undefined;
  c.sneakFromGy=undefined;
  c.tmtLinked=undefined;
  // 直到回合結束，將要死去時改為放逐
  if (wasOnBf && to === 'graveyard' && c.exileOnDeathTurn === g.turn) {
    log(g, `${cardName(c)} 改為放逐`, c.owner);
    to = 'exile';
  }
  c.exileOnDeathTurn = undefined;
  // 帶著終結指示物的永久物死去時改為放逐
  if (wasOnBf && to === 'graveyard' && c.finality) {
    log(g, `${cardName(c)} 有終結指示物，改為放逐`, c.owner);
    to = 'exile';
  }
  if (wasOnBf && to === 'graveyard' && isCreature(c) && hasStaticFlag(g, other(c.controller), 'exileOppDying')) {
    log(g, `${cardName(c)} 改為放逐`, c.owner);
    to = 'exile';
  }
  c.finality = undefined;
  if (wasOnBf && !c.def.types.includes('Land')) g.voidThisTurn = true;
  if (from === 'library' && to === 'graveyard') g.players[c.owner].libToGyThisTurn = (g.players[c.owner].libToGyThisTurn ?? 0) + 1;
  c.warpExiled = undefined;
  if (wasOnBf) {
    c.lastPower = stats(g, c).p;
    g.eot = g.eot.filter((e) => e.card !== c.id);
    for (const id of g.battlefield) {
      const o = g.cards[id];
      if (o.blockedBy.includes(c.id)) o.blockedBy = o.blockedBy.filter((x) => x !== c.id);
    }
  }
  removeFromZone(g, c);
  if (wasOnBf){resetPermanentState(c);c.finMarks=undefined;c.finLinked=undefined;}
  if(c.token&&wasOnBf&&to!=='battlefield')c.tokenDeparted=true;
  c.zone = to;
  c.controller = c.owner;
  c.playableTurn = undefined;
  c.playableUntil=undefined;
  c.onAdventure = false;
  // 面朝下的牌離開戰場後亮出真正的牌
  if (c.hidden) {
    c.def = c.hidden;
    c.hidden = undefined;
  }
  c.plottedTurn = undefined;
  c.saddledTurn = undefined;
  // 雙面牌離開戰場後回到正面
  if (c.front) {
    c.def = c.front;
    c.front = undefined;
  }
  if (to !== 'exile') c.exiledBy = undefined;
  if (to === 'graveyard' && !c.token && !c.def.types.some((t) => t === 'Instant' || t === 'Sorcery')) g.players[c.owner].permToGyThisTurn = true;
  if (c.token && to !== 'battlefield') {
    // 衍生物離開戰場即消失
  } else if (to === 'library') {
    const lib = g.players[c.owner].library;
    if (bottom) lib.push(c.id);
    else lib.unshift(c.id);
  } else if (to === 'battlefield') {
    g.battlefield.push(c.id);
  } else if (to !== 'stack') {
    g.players[c.owner][to].push(c.id);
  }
  g.version++;
  if(to==='graveyard'&&!c.token&&c.def.types.some(t=>['Creature','Artifact','Enchantment','Planeswalker','Land'].includes(t)))emit(g,{type:'permanentToGy',card:c.id,player:c.owner});
  if(wasOnBf&&c.def.id==='cloak-and-dagger-entwined'&&c.mshLinked)for(const id of c.mshLinked)if(g.cards[id]?.zone==='exile')moveCard(g,g.cards[id],'hand');
  if (wasOnBf) {returnLinked(g, c.id);if(c.def.id==='aurelias-vindicator')for(const id of c.mkmLinked??[])if(g.cards[id]?.zone==='exile')moveCard(g,g.cards[id],'hand');c.mkmSolved=undefined;c.mkmLinked=undefined;}
  emit(g,{type:'fin',action:'zoneMove',card:c.id,player:c.owner,amount:0,from,to});
  if(wasOnBf&&c.finPartner!==undefined){const partner=g.cards[c.finPartner];c.finPartner=undefined;if(partner?.zone==='exile'){partner.finPartner=undefined;moveCard(g,partner,to,bottom);}}
  refreshTlaPermanents(g);
}

function returnLinked(g: GameState, sourceId: number): void {
  for (const p of g.players) {
    for (const id of [...p.exile]) {
      const e = g.cards[id];
      if (e.exiledBy === sourceId) {
        e.exiledBy = undefined;
        log(g, `${cardName(e)} 回到戰場`, e.owner);
        enterBattlefield(g, e, e.owner);
      }
    }
  }
}

export function enterBattlefield(g: GameState, c: Card, controller: PID, tapped = false, enterAs?: CardDef): void {
  if(c.tokenDeparted)return;
  if(c.def.ecl?.asEnters&&!c.eclPrepared && !(c.def.ecl.asEnters==='shock'&&g.players[controller].isAI)){
    if(!g.eclEntryQueue?.some(e=>e.card===c.id))(g.eclEntryQueue??=[]).push({card:c.id,controller,tapped,enterAs});
    return;
  }
  const origin=c.zone;
  if(origin!=='stack'){c.manaPaid=undefined;c.evokePaid=undefined;c.eclBeheld=undefined;c.eclBeholdType=undefined;}
  if(origin!=='battlefield')c.objectVersion=(c.objectVersion??0)+1;
  let t = tapped || !!c.def.etbTapped;
  if (isLand(c) && !c.def.supertypes?.includes('Basic') && g.battlefield.some(id => abilitiesOf(g,g.cards[id]).some(a => a.kind === 'static' && a.allNonbasicTapped))) t = true;
  if (c.def.etbTappedUnless && !checkCond(g, c.def.etbTappedUnless, controller, c.id, [])) t = true;
  if (c.def.shock && !t && !c.eclPrepared) {
    if (g.players[controller].life > 10) {
      loseLife(g, controller, 2);
      log(g, `${cardName(c)}：支付2點生命，未橫置進場`, controller, 'life');
    } else t = true;
  }
  if (c.zone !== 'battlefield') removeFromZone(g, c);
  const finCounters=c.finMarks?.enterCounters??0,finFinality=c.finMarks?.enterFinality;
  const eclAttachment=c.eclPrepared?c.attachedTo:null;
  resetPermanentState(c);
  if(eclAttachment!==null)c.attachedTo=eclAttachment;
  if(enterAs){c.tlaOriginalDef=c.def;c.def=enterAs;c.copyLayer=enterAs;}
  c.mkmSolved=undefined;if(c.mkmMarks)for(const key of ['impostor','unlock','blood','killer','controlled','previous'])delete c.mkmMarks[key];
  c.mshMarks=undefined;c.mshLinked=undefined;
  c.zone = 'battlefield';
  g.battlefield.push(c.id);
  c.controller = controller;
  c.tapped = t;
  c.sick = true;
  c.enteredTurn = g.turn;
  c.enteredFrom = origin;
  c.tmtLinkKey=g.nextSid++;
  c.wasCast=origin==='stack'&&c.castOrigin!==undefined;
  if(origin!=='stack'){c.sneakTurn=undefined;c.sneakFromGy=undefined;}
  c.counters = finCounters+(c.def.etbCounters ?? 0)-(c.eclEnterMinus??0);c.eclEnterMinus=undefined;
  if(c.finMarks){delete c.finMarks.enterCounters;delete c.finMarks.enterFinality;}
  if(finFinality)c.finality=true;
  if(finStatic(g,controller,'landsUntapped').length&&isLand(c))c.tapped=false;
  if (c.def.id === 'putrid-pals' && g.players[controller].permanentLeftThisTurn) c.counters += 2;
  if (c.def.id === 'leatherhead-swamp-stalker') c.hexproofCounters = 1;
  if(c.def.subtypes?.includes('Class'))c.classLevel=1;
  if(origin==='stack' && isCreature(c)){
    if(c.castOrigin==='library' && g.battlefield.some(id=>g.cards[id].controller===controller&&g.cards[id].def.id==='mikey-don-party-planners'&&!abilitiesSuppressed(g,g.cards[id])))c.counters++;
    if(c.sneakFromGy)c.finality=true;
    if(c.sneakTurn===g.turn){c.tapped=true;c.attacking=true;c.attackedTurn=g.turn;}
  }
  if(c.def.id==='weather-maker')c.charge=0;
  if(c.def.types.includes('Artifact'))g.players[controller].artifactEnteredThisTurn=true;
  if(c.def.id==='crowd-control-warden')c.counters+=g.battlefield.filter(id=>id!==c.id&&g.cards[id].controller===controller&&isCreature(g.cards[id])).length;
  if(c.def.id==='captain-america-super-soldier')mshCounter(g,c,'shield');
  if(c.counters>0)c.counters+=mshStatic(g,c.controller,'extraCounters').length;
  if(c.counters>0&&isCreature(c))c.counters*=2**finStatic(g,c.controller,'doubleCounters').length;
  if (c.counters > 0 && isCreature(c)) {
    // 帶著指示物進場：同樣套用「多放 n 個」
    for (const id of g.battlefield) {
      const s = g.cards[id];
      if (s.controller !== controller) continue;
      for (const ab of abilitiesOf(g, s)) if (ab.kind === 'static' && ab.counterPlus) c.counters += ab.counterPlus;
    }
  }
  if (c.def.etbPrepared) c.prepared = true;
  if (c.def.aura?.grant?.loseAbilities) g.loseAbilities = true;
  if (c.def.types.includes('Planeswalker')) c.loyalty = c.def.loyalty ?? 0;
  c.playableTurn = undefined;
  g.version++;
  if (c.def.startEngines && !g.players[controller].speed) {
    g.players[controller].speed = 1;
    log(g, '發動引擎！速度變為 1', controller);
  }
  if (!c.def.types.includes('Land')) g.players[controller].nonlandEtbThisTurn = (g.players[controller].nonlandEtbThisTurn ?? 0) + 1;
  refreshTlaPermanents(g);
  const enterCounters=Math.abs(c.counters)+(c.hexproofCounters??0)+Number(!!c.finality)+(c.loyalty??0);
  if(enterCounters)emit(g,{type:'counterPlaced',card:c.id,controller,amount:enterCounters});
  emit(g, { type: 'etb', card: c.id, controller });
  if (c.def.saga) addLore(g, c, 1);
}

/** 在傳奇上放置傳奇指示物，並觸發新到達的章節 */
export function addLore(g: GameState, c: Card, n: number): void {
  const chapters = c.def.saga?.chapters;
  if (!chapters || c.zone !== 'battlefield') return;
  for (let i = 0; i < n; i++) {
    (c.finMarks??={}).loreTurn=g.turn;for(const id of c.finLinked??[]){const exiled=g.cards[id];if(exiled?.zone==='exile'&&exiled.eclCast?.mode==='brynhildr')(exiled.finMarks??={}).brynhildrTurn=g.turn;}
    c.lore = (c.lore ?? 0) + 1;
    emit(g,{type:'counterPlaced',card:c.id,controller:c.controller,amount:1});
    const ch = chapters[c.lore - 1];
    if (!ch) continue;
    log(g, `${cardName(c)}：第 ${ROMAN[c.lore - 1]} 章`, c.controller);
    g.pending.push({
      source: c.id,
      controller: c.controller,
      ability: { kind: 'trigger', on: 'etb', effects: ch.effects, targets: ch.targets,finDynamic:ch.finDynamic },
      abilityIndex: 3000 + c.lore,
      ev: { type: 'etb', card: c.id, controller: c.controller },
    });
  }
  g.version++;
}
export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

/** 以背面進戰場（模式雙面牌施放背面、轉化後放回戰場） */
export function enterBattlefieldBack(g: GameState, c: Card, controller: PID, tapped = false): void {
  if(c.tokenDeparted)return;
  const front = c.front ?? c.def;
  if (!front.back) {
    enterBattlefield(g, c, controller, tapped);
    return;
  }
  if (c.zone !== 'battlefield') removeFromZone(g, c);
  c.front = front;
  c.def = front.back;
  enterBattlefield(g, c, controller, tapped);
}

/** 轉化戰場上的雙面牌（正面 ↔ 背面）；回傳是否成功 */
export function transformCard(g: GameState, c: Card): boolean {
  if (c.zone !== 'battlefield') return false;
  if (c.baseDef) {
    c.def = c.baseDef;
    c.baseDef = undefined;
  }
  if (c.front) {
    c.def = c.front;
    c.front = undefined;
  } else if (c.def.back) {
    c.front = c.def;
    c.def = c.def.back;
  } else return false;
  emit(g,{type:'transformed',card:c.id,controller:c.controller});
  g.version++;
  return true;
}

/** 在生物上放置 +1/+1 指示物（套用「多放 n 個」的取代效果）；回傳實際放置的數量 */
export function putCounters(g: GameState, c: Card, n: number): number {
  if(g.battlefield.some(id=>g.cards[id].attachedTo===c.id&&g.cards[id].def.id==='blossombind'))return 0;
  if (n <= 0 || c.zone !== 'battlefield') return 0;
  if (isCreature(c)) {
    for (const id of g.battlefield) {
      const s = g.cards[id];
      if (s.controller !== c.controller) continue;
      for (const ab of abilitiesOf(g, s)) if (ab.kind === 'static' && ab.counterPlus) n += ab.counterPlus;
    }
  }
  n*=2**finStatic(g,c.controller,'doubleCounters').length;
  n+=mshStatic(g,c.controller,'extraCounters').length;
  c.counters += n;
  emit(g, { type: 'counterPlaced', card: c.id, controller: c.controller, amount: n });
  return n;
}

/** 生物將要死去時是否改為放逐 */
function deathReplacedByExile(g: GameState, c: Card): boolean {
  if (c.exileOnDeathTurn === g.turn || c.finality||c.finMarks?.deathHades||finStatic(g,c.owner,'hadesExile').length||isCreature(c)&&!c.token&&(c.finMarks?.deathCrystal||finStatic(g,other(c.controller),'darkness').length)) return true;
  return isCreature(c) && hasStaticFlag(g, other(c.controller), 'exileOppDying');
}

/** 同時將多張永久物置入墳墓場（生物會觸發「死去」） */
export function putIntoGraveyard(g: GameState, cards: Card[]): void {
  g.eclEventGroup=g.nextSid++;
  const list = cards.filter((c) => c.zone === 'battlefield');
  for(const c of list){const crystal=isCreature(c)&&!c.token?finStatic(g,other(c.controller),'darkness')[0]:undefined;if(crystal)(c.finMarks??={}).deathCrystal=crystal.id;if(finStatic(g,c.owner,'hadesExile').length)(c.finMarks??={}).deathHades=1;}
  for (const c of list) {
    c.lastToughness = stats(g,c).t;
    c.lastCounterKinds={plus:c.counters,charge:c.charge??0,stun:c.stun,hexproof:c.hexproofCounters??0,finality:!!c.finality,lore:c.lore??0};
    if(!deathReplacedByExile(g,c))emit(g,{type:'permanentDies',card:c.id,controller:c.controller,counterKinds:{...c.lastCounterKinds}});
    if(isCreature(c)&&hasKw(g,c,'persist')&&c.counters>=0&&!deathReplacedByExile(g,c))g.pending.push({source:c.id,sourceLinkKey:c.tmtLinkKey,controller:c.controller,abilityIndex:-22,ev:{type:'dies',card:c.id,controller:c.controller,power:stats(g,c).p},ability:{kind:'trigger',on:'dies',effects:[{e:'ecl',action:'persist'}]}});
    if (isCreature(c)) {
      // 將要死去時改為放逐的取代效果：它並沒有死去
      if (deathReplacedByExile(g, c)) continue;
      g.creatureDiedThisTurn = true;
      g.creaturesDiedCount = (g.creaturesDiedCount ?? 0) + 1;
      emit(g, { type: 'dies', card: c.id, controller: c.controller, power: stats(g, c).p, toughness:c.lastToughness });
    } else if (c.def.types.includes('Planeswalker')) {
      emit(g, { type: 'dies', card: c.id, controller: c.controller, power: 0 });
    }
  }
  for (const c of list) moveCard(g, c, 'graveyard');
}

export function destroyCards(g: GameState, cards: Card[]): void {
  const list = cards.filter((c) => {if(c.zone!=='battlefield'||hasKw(g,c,'indestructible'))return false;if((c.eclCounters?.shield??0)>0){c.eclCounters!.shield--;return false;}return true;});
  for (const c of list) log(g, `${cardName(c)} 被消滅`, c.controller);
  putIntoGraveyard(g, list);
}

export function sacrifice(g: GameState, c: Card): void {
  if (c.zone !== 'battlefield') return;
  log(g, `犧牲 ${cardName(c)}`, c.controller);
  emit(g, { type: 'sacrifice', card: c.id, player: c.controller });
  putIntoGraveyard(g, [c]);
}

export function drawCards(g: GameState, pid: PID, n: number): number {
  if(g.battlefield.some(id=>g.cards[id].def.id==='mornsong-aria'&&!abilitiesSuppressed(g,g.cards[id])))return 0;
  const p = g.players[pid];
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (!p.library.length) {
      if(mkmStatic(g,pid,'emptyLibrary').length)return drawn;
      p.drewFromEmpty = true;
      return drawn;
    }
    drawn++;
    const id = p.library.shift()!;
    const c = g.cards[id];
    c.zone = 'hand';
    p.hand.push(id);
    emit(g,{type:'msh',action:'draw',player:pid,card:id});
    p.drawsThisTurn++;
    if(p.drawsThisTurn===3)emit(g,{type:'fin',action:'thirdDraw',card:c.id,player:pid,amount:1});
    if (p.drawsThisTurn === 2) emit(g, { type: 'drawSecond', player: pid });
  }
  g.version++;
  return drawn;
}

/** 棄牌；silent 時不發出事件（同時棄多張牌時由 discardMany 統一發出一次） */
export function discard(g: GameState, c: Card, silent = false): void {
  log(g, `棄掉 ${cardName(c)}`, c.owner);
  moveCard(g, c, 'graveyard');
  c.discardedTurn = g.turn;
  g.players[c.owner].discardedThisTurn = (g.players[c.owner].discardedThisTurn ?? 0) + 1;
  if (!silent) emit(g, { type: 'discard', player: c.owner, card: c.id });
}

/** 同時棄掉多張牌：「一個或更多張」的觸發只會觸發一次 */
export function discardMany(g: GameState, cards: Card[]): void {
  for (const c of cards) discard(g, c, true);
  for(const c of cards)emit(g,{type:'discard',player:c.owner,card:c.id,batchPart:true});
  if(cards[0])emit(g,{type:'discard',player:cards[0].owner,card:cards[0].id,batchSummary:true});
}

export function gainLife(g: GameState, pid: PID, n: number): void {
  if (n <= 0) return;
  const p = g.players[pid];
  if(g.battlefield.some(id=>g.cards[id].def.id==='mornsong-aria'&&!abilitiesSuppressed(g,g.cards[id])))return;
  if (p.cantGainLife) return;
  n += lifegainBonus(g, pid);
  n*=2**finStatic(g,pid,'doubleLife').length;
  p.life += n;
  p.lifeGainedThisTurn += n;
  log(g, `獲得 ${n} 點生命（${p.life}）`, pid, 'life');
  emit(g, { type: 'lifegain', player: pid, amount: n });
}

export function loseLife(g: GameState, pid: PID, n: number): void {
  if (n <= 0) return;
  const p = g.players[pid];
  p.life -= n;
  p.lifeLostThisTurn += n;
  g.version++;
  // 速度：你的回合中對手失去生命時，每回合提升一次（最高 4）
  const act = g.players[g.active];
  if (pid !== g.active && act.speed && act.speed < 4 && act.speedUpTurn !== g.turn) {
    act.speed++;
    act.speedUpTurn = g.turn;
    log(g, act.speed >= 4 ? '速度達到最高（4）！' : `速度提升為 ${act.speed}`, g.active);
  }
  emit(g, { type: 'lifeloss', player: pid, amount: n });
}

/** 造成傷害；回傳實際造成的傷害量 */
export function dealDamage(
  g: GameState,
  src: Card | null,
  srcController: PID,
  target: TargetRef,
  n: number,
  opts: { combat?: boolean; noLifeGain?: boolean; batchCombat?: boolean } = {},
): number {
  if (n <= 0) return 0;
  const redirects=new Set<number>();
  for(;;){const pid='p'in target?target.p:g.cards[target.c]?.controller;if(pid===undefined)break;
    if('p'in target&&finStatic(g,pid,'playerProtection').length&&srcController!==pid)return 0;
    const turtle=finStatic(g,pid,'adamantoise').find(c=>!redirects.has(c.id)&&('p'in target||c.id!==target.c));if(!turtle)break;
    redirects.add(turtle.id);target={c:turtle.id};
  }
  const finVictim='p'in target?target.p:g.cards[target.c]?.controller;
  if(finVictim!==undefined&&g.players[finVictim].finFlags?.lightningUntil)n*=2;
  if(src&&matches(g,{sub:'Wizard'},src,srcController))n*=2**finStatic(g,srcController,'doubleWizardDamage').length;
  if('c'in target){const c=g.cards[target.c];if(c&&isCreature(c)&&(g.players[c.controller].finFlags?.creatureFog===g.turn||opts.combat&&abilitiesOf(g,c).some(a=>a.kind==='static'&&a.fin==='preventCombat')))return 0;}
  if('p'in target&&g.players[target.p].eclPreventDamageUntil!==undefined)return 0;
  if('c'in target){const c=g.cards[target.c];if(c){const ks=stats(g,c).kw;if(ks.has('protection_opponent')&&c.controller!==srcController)return 0;if(ks.has('protection_colors')&&src&&colorsOf(src.def).length)return 0;}}
  for(const id of g.battlefield){const s=g.cards[id];if(s.controller===srcController&&s.def.id==='collective-inferno'&&s.eclType&&src&&matches(g,{sub:s.eclType},src,srcController)&&!abilitiesSuppressed(g,s))n*=2;}
  // 非戰鬥傷害加成（例如「多造成 1 點傷害」）：只對對手或其永久物
  if (!opts.combat) {
    const victimCtl = 'p' in target ? target.p : g.cards[target.c]?.controller;
    if (victimCtl != null && victimCtl !== srcController) {
      for (const id of g.battlefield) {
        const s = g.cards[id];
        if (s.controller !== srcController) continue;
        for (const ab of abilitiesOf(g, s)) if (ab.kind === 'static' && ab.noncombatPlus) n += ab.noncombatPlus;
      }
    }
  }
  if('c'in target){const c=g.cards[target.c];if(c&&mshStatic(g,c.controller,'preventSelfDamage').some(s=>s.id===c.id))return 0;if(c&&(c.eclCounters?.shield??0)>0){c.eclCounters!.shield--;return 0;}if(c?.def.id==='wolverine-fierce-fighter'&&!abilitiesSuppressed(g,c)){c.damage=0;c.dtDamage=false;}}
  if(!opts.combat){const controller='p'in target?target.p:g.cards[target.c]?.controller;if(controller!==undefined&&controller!==srcController)for(const s of mshStatic(g,srcController,'hawkeyeDamage'))n+=stats(g,s).p;}
  if(src)for(const id of g.battlefield){const eq=g.cards[id];if(eq.attachedTo===src.id&&abilitiesOf(g,eq).some(a=>a.kind==='static'&&a.msh==='doubleEquippedDamage'))n*=2;}
  const victim='p' in target?target.p:g.cards[target.c]?.controller;
  if(victim!==undefined && victim!==srcController)for(const id of g.battlefield){const s=g.cards[id];if(s.controller===srcController&&s.def.id==='fated-firepower'&&!abilitiesSuppressed(g,s))n+=s.charge??0;}
  const kws = src ? (src.zone === 'battlefield' ? stats(g, src).kw : new Set(src.def.keywords ?? [])) : new Set();
  if(src?.def.subtypes?.some(s=>s==='Noble'||s==='Lesson')&&g.battlefield.some(id=>g.cards[id].controller===srcController&&g.cards[id].def.id==='lo-and-li-twin-tutors'&&!abilitiesSuppressed(g,g.cards[id])))kws.add('lifelink');
  if(src?.spellWitherTurn===g.turn)kws.add('wither');
  if(src?.mkmMarks?.judith===g.turn){kws.add('deathtouch');kws.add('lifelink');}
  const srcName = src ? cardName(src) : '';
  if(opts.combat&&src&&!opts.batchCombat)emit(g,{type:'combatDamageAny',source:src.id,controller:srcController,amount:n});
  if ('p' in target) {
    const p = g.players[target.p];
    loseLife(g, target.p, n);
    if (opts.noLifeGain) p.cantGainLife = true;
    log(g, `${srcName} 對 ${p.name} 造成 ${n} 點傷害（${p.life}）`, srcController, 'damage');
    if (opts.combat && src) {
      src.dealtCombat = true;
      emit(g, { type: 'combatDamage', source: src.id, player: target.p, amount: n });
      emit(g,{type:'combatPlayerOrWalker',source:src.id,controller:srcController,amount:n});
    }
    if (!opts.combat) {
      p.noncombatThisTurn = true;
      emit(g, { type: 'noncombat', player: target.p, amount: n, sourceController: srcController });
    }
  } else {
    const c = g.cards[target.c];
    if (!c || c.zone !== 'battlefield') return 0;
    if (!isCreature(c)) {
      // 對鵬洛客造成的傷害會移除等量的忠誠指示物
      if (!c.def.types.includes('Planeswalker')) return 0;
      c.loyalty = (c.loyalty ?? 0) - n;
      if(opts.combat&&src)emit(g,{type:'combatPlayerOrWalker',source:src.id,controller:srcController,amount:n});
      log(g, `${srcName} 對 ${cardName(c)} 造成 ${n} 點傷害（忠誠 ${c.loyalty}）`, srcController, 'damage');
      if (kws.has('lifelink')) gainLife(g, srcController, n);
      g.version++;
      return n;
    }
    if(kws.has('wither'))putMinusCounters(g,c,n);else c.damage += n;
    if (opts.combat && src) src.dealtCombat = true;
    if (kws.has('deathtouch')) c.dtDamage = true;
    log(g, `${srcName} 對 ${cardName(c)} 造成 ${n} 點傷害`, srcController, 'damage');
    emit(g, { type: 'damaged', card: c.id, amount: n });
  }
  if (kws.has('lifelink')) gainLife(g, srcController, n);
  if(src&&'p'in target&&matches(g,{sub:'Hero'},src,srcController)){const flags=mshFlags(g,srcController),key=opts.batchCombat?-10*(g.combatCount??1)-(g.phase==='combat_damage_first'?1:2):g.nextSid++;if(flags.heroDamageGroup!==key){flags.heroDamageGroup=key;emit(g,{type:'msh',action:'heroDamage',card:src.id,player:srcController,n});}}
  if(src)emit(g,{type:'fin',action:'sourceDamage',card:src.id,player:srcController,amount:n});
  return n;
}

export function createToken(
  g: GameState,
  tokenId: string,
  controller: PID,
  opts: { tapped?: boolean; attacking?: boolean; attachTo?: number } = {},
): Card {
  g.players[controller].tokensCreatedTurn=g.turn;
  // 取代效果：神器衍生物改為 5/5 的龍衍生物
  if (getDef(tokenId).types.includes('Artifact') && !tokenId.startsWith('tok-fra-dragon')) {
    for (const id of g.battlefield) {
      const s = g.cards[id];
      if (s.controller === controller && abilitiesOf(g, s).some((a) => a.kind === 'static' && a.artifactTokenDragon)) {
        tokenId = 'tok-fra-dragon';
        break;
      }
    }
  }
  const c = newCard(g, getDef(tokenId), controller, true);
  c.zone = 'exile'; // 暫存，隨即進場
  enterBattlefield(g, c, controller, !!opts.tapped);
  if (opts.attachTo != null) c.attachedTo = opts.attachTo;
  if (opts.attacking) {
    c.attacking = true;
  }
  return c;
}

export function shuffleLibrary(g: GameState, pid: PID, shuffle: (arr: number[]) => void): void {
  shuffle(g.players[pid].library);
}

export function putMinusCounters(g:GameState,c:Card,n:number):number {if(n<=0||c.zone!=='battlefield'||g.battlefield.some(id=>g.cards[id].attachedTo===c.id&&g.cards[id].def.id==='blossombind'))return 0;c.counters-=n;emit(g,{type:'counterPlaced',card:c.id,controller:c.controller,amount:n,counterKind:'minus'});g.version++;return n;}
