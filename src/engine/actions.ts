import {campusLink} from './campus';
import {campusCost,campusTargets,campusFree,campusCraftOptions,campusCraftValid,campusActivationBlocked,campusCastBlocked} from './campus-casting';
import {crewPower,ignoreExhaust} from './meadow-dft-support';
import {forageOptions,validForage,payForage,osteoCast,festivalCast} from './meadow-costs';
import {foundationPermission,foundationCastError,foundationPayExtras,foundationExtraCosts} from './foundation-casting';
import {changeDoor,foundationGrantedAbilities} from './foundation-support';
import {commitCrime,plotCard} from './otj-support';
import {frontierStatic,frontierFlags,frontierAbilityCost,frontierGrantedAbilities} from './frontier-support';
import {mshStatic,mshFlags,teamworkPayment,mshCanImprovise,blackSymbols} from './msh-support';
import {canEvidence,mkmFlags,mkmStatic} from './mkm-support';
import {evidencePayment,payEvidence} from './mkm';
import {finStatic} from './fin-support';
import {beholdOptions,canReceiveCounters,canBehold,counterKinds,counterTotal,eclStatic,hasBlightBody,removeCounterKind,validBehold,vividColors} from './ecl-support';
import { displayName } from '../data/names';
import { addCosts, colorsOf, costToString, findPayment, manaValue, parseCost, reduceCost, type ManaCost, type ManaSource } from './mana';
import {
  abilitiesOf,
  abilitiesSuppressed,
  cardName,
  checkCond,
  countMatching,
  hasKw,
  isCreature,
  isLand,
  log,
  matches,
  newCard,
  show,
  stats,
} from './state';
import { hasTargetsAvailable, validateTargets } from './targets';
import type {
  ActivatedAbility,
  Card,
  CardDef,
  CastAlt,
  Effect,
  Filter,
  GameState,
  PID,
  PriorityAction,
  TargetRef,
  TargetSpec,
} from './types';
import { putMinusCounters, bend, tapCard, discard, discardMany, emit, enterBattlefield, loseLife, moveCard, removeFromZone, sacrifice } from './zones';
import { faceDownDef, turnFaceUp } from './facedown';

// ------------------------------------------------------------
// 法術力
// ------------------------------------------------------------
export function manaSources(g: GameState, pid: PID, exclude?: number, convoke = false, forDef?: CardDef, fromHand = false): ManaSource[] {
  if(forDef&&!forDef.eclAbilityPayment&&forDef.types.includes('Creature')&&frontierStatic(g,pid,'dsk:creatureConvoke').length)convoke=true;
  if(forDef?.types.includes('Creature')&&!forDef.eclAbilityPayment&&eclStatic(g,pid,'creatureConvoke').length)convoke=true;
  const out: ManaSource[] = [];
  if(forDef&&mshCanImprovise(g,pid,forDef))for(const id of g.battlefield){const c=g.cards[id];if(c.controller===pid&&!c.tapped&&id!==exclude&&c.def.types.includes('Artifact')&&!c.def.produces)out.push({id,produces:['C'],isCreature:isCreature(c),convoke:true});}
  for(const id of g.battlefield){const c=g.cards[id];if(c.controller===pid&&!c.tapped&&id!==exclude&&matches(g,{sub:'Food'},c,pid)&&frontierStatic(g,pid,'foodMana').length&&(!isCreature(c)||!c.sick||hasKw(g,c,'haste')))out.push({id,produces:['G'],isCreature:isCreature(c)});}
  if (convoke) {
    // 召集：未橫置的生物可以支付 {1} 或一點與它同色的法術力（排在最後才用）
    for (const id of g.battlefield) {
      const c = g.cards[id];
      if (c.controller !== pid || c.tapped || !isCreature(c) || id === exclude || c.def.produces) continue;
      const cols = colorsOf(c.def);
      if(c.def.id==='freya-crescent'&&(!forDef||!(forDef.eclAbilityPayment?forDef.fin?.equipment==='equipPayment':forDef.subtypes?.includes('Equipment'))))continue;
    out.push({ id, produces: cols.length ? cols : ['C'], isCreature: true, sac: false, convoke: true });
    }
  }
  for (const id of g.battlefield) {
    const c = g.cards[id];
    if (c.controller !== pid || c.tapped || !c.def.produces || id === exclude) continue;
    if(c.def.id==='troyan-gutsy-explorer'&&(!forDef||forDef.eclAbilityPayment||manaValue(forDef)<5&&!(forDef.cost??'').includes('{X}')))continue;
    // 限定用途的法術力（例如只能用來施放鵬洛客咒語）
    if(c.def.manaOnly==='angel'&&(!forDef||forDef.eclAbilityPayment||!forDef.subtypes?.includes('Angel')))continue;
    if(c.def.manaOnly==='enchantOrSpecial'&&(!forDef||!(forDef.eclAbilityPayment?forDef.faceUpPayment||forDef.foundation?.unlockPayment:forDef.types.includes('Enchantment'))))continue;
    if (c.def.manaOnly === 'planeswalker' && !forDef?.types.includes('Planeswalker')) continue;
    if (c.def.manaOnly === 'notFromHand' && fromHand) continue;
    if(c.def.manaOnly==='notNonartifactSpell'&&forDef&&!forDef.eclAbilityPayment&&!forDef.types.includes('Artifact'))continue;
    if(c.def.manaOnly==='artifactOrAbility'&&(!forDef||!forDef.types.includes('Artifact')))continue;
    if (abilitiesSuppressed(g, c) && c.def.name!=='Humble Merchant') continue;
    const cr = isCreature(c);
    if (cr && c.sick && !hasKw(g, c, 'haste')&&!mshStatic(g,pid,'activateHaste').length) continue;
    if (c.def.chosenColorMana && !c.chosenColor) continue;
    if(c.def.id==='freya-crescent'&&(!forDef||!(forDef.eclAbilityPayment?forDef.fin?.equipment==='equipPayment':forDef.subtypes?.includes('Equipment'))))continue;
    out.push({ id, produces: (c.def.id==='intrepid-stablemaster'&&forDef&&!forDef.eclAbilityPayment&&forDef.subtypes?.some(s=>s==='Mount'||s==='Vehicle'))||(c.def.id==='bucolic-ranch'&&forDef&&!forDef.eclAbilityPayment&&forDef.subtypes?.includes('Mount'))?['W','U','B','R','G']:c.def.id==='arc-reactor'?['C']:(mshStatic(g,pid,'conditionalDual').some(s=>s.id===c.id)&&c.enteredTurn!==g.turn&&!g.battlefield.some(id=>g.cards[id].controller===pid&&g.cards[id].def.supertypes?.includes('Basic')))?['C']:(isLand(c)&&mkmStatic(g,pid,'guildpact').length)?['W','U','B','R','G']:(c.def.id==='jasmine-dragon-tea-shop' && forDef?.subtypes?.includes('Ally')) || (c.def.id==='white-lotus-hideout' && forDef?.subtypes?.some(s=>s==='Lesson'||s==='Shrine')) || (c.def.id==='turtle-lair'&&forDef?.subtypes?.some(s=>s==='Ninja'||s==='Turtle')) ? ['C','W','U','B','R','G'] : c.def.id==='eclipsed-realms'&&forDef&&!forDef.eclAbilityPayment&&c.eclType&&matchesDefSubtype(forDef,c.eclType)?['C','W','U','B','R','G']:c.def.chosenColorMana && c.chosenColor ? [c.chosenColor] : c.def.produces, isCreature: cr, sac: c.def.sacOnMana, filter: c.def.filterMana, pain: c.def.painMana });
    // 「{T}：加{C}{C}」（艾姆庫的放逐能力）
    if (c.bonusMana !== undefined && g.cards[c.bonusMana]?.zone === 'exile') out.push({ id: -100000 - id, produces: ['C'], isCreature: false, extra: true });
    // 「每當你為山脈橫置來產生法術力時，額外加一點{R}」
    if (g.players[pid].mountainBonus && c.def.subtypes?.includes('Mountain')) out.push({ id: -2000 - id, produces: ['R'], isCreature: false, extra: true });
  }
  for(const id of g.battlefield){const c=g.cards[id];if(c.controller===pid&&!c.tapped&&isLand(c)&&id!==exclude&&mkmStatic(g,pid,'guildpact').length&&!out.some(s=>s.id===id))out.push({id,produces:['W','U','B','R','G'],isCreature:isCreature(c)});}
  for (const id of g.battlefield) {
    const c = g.cards[id]; if (c.controller !== pid || c.tapped || id === exclude || out.some(s=>s.id===id) || (isCreature(c) && c.sick && !hasKw(g,c,'haste'))) continue;
    for (const sid of g.battlefield) { const s=g.cards[sid]; if(s.controller!==pid) continue;
      for(const a of abilitiesOf(g,s)) if(a.kind==='static' && a.manaGrant && matches(g,a.manaGrant.filter,c,pid,s.id)) {out.push({id,produces:a.manaGrant.colors,isCreature:isCreature(c)});break;}
    }
  }
  for(const c of g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===pid&&!c.tapped&&(!isCreature(c)||!c.sick||hasKw(g,c,'haste'))&&c.id!==exclude)){if(c.def.id==='freya-crescent'&&!out.some(s=>s.id===c.id)&&forDef&&(forDef.eclAbilityPayment?forDef.fin?.equipment==='equipPayment':forDef.subtypes?.includes('Equipment')))out.push({id:c.id,produces:['R'],isCreature:isCreature(c)});if(c.def.id==='the-emperor-of-palamecia'&&!forDef?.eclAbilityPayment&&forDef&&!forDef.types.includes('Creature'))out.push({id:c.id,produces:['U','R'],isCreature:true});}
  for(const id of g.battlefield){const c=g.cards[id];if(c.controller!==pid||c.tapped||id===exclude||!forDef)continue;const hero=c.def.id==='avengers-tower'&&forDef.subtypes?.includes('Hero'),villain=c.def.id==='villainous-hideout'&&forDef.subtypes?.includes('Villain'),artifact=c.def.id==='castle-doom'&&!forDef.eclAbilityPayment&&forDef.types.includes('Artifact');if(hero||villain||artifact){const source=out.find(s=>s.id===id);if(source)source.produces=['W','U','B','R','G'];}}
  (g.players[pid].retainedRed ?? []).forEach((m,i)=>out.push({id:-25000-i,produces:[m],isCreature:false,pool:true}));
  (g.players[pid].firePool ?? []).forEach((m,i)=>out.push({id:-30000-i,produces:[m],isCreature:false,pool:true}));
  for(const id of g.battlefield){const c=g.cards[id];if(c.controller===pid&&!c.tapped&&(isLand(c)||['elvish-archdruid','gilded-lotus','hedron-archive','overgrown-zealot'].includes(c.def.id)||c.def.id==='arc-reactor'||c.def.id==='troyan-gutsy-explorer'||c.def.id==='intrepid-stablemaster'||c.token&&c.def.types.includes('Artifact'))&&c.def.produces&&id!==exclude&&out.some(s=>s.id===id))landManaExtras(g,c,forDef).forEach((produces,k)=>out.push({id:-400000-id*1000-k,produces,isCreature:false,extra:true,...(produces.matches?{matchManaOf:id}:{}),...(produces.requires?{extraRequires:{id,mana:produces.requires}}:{})}));}
  (g.players[pid].eclRestrictedMana??[]).forEach((m,i)=>{const ok=forDef&&(m.rule==='ability'?!!forDef.eclAbilityPayment:m.rule==='artifactAbility'?forDef.types.includes('Artifact'):m.rule==='campusSpell'?!forDef.eclAbilityPayment&&forDef.types.some(t=>t==='Instant'||t==='Sorcery'):m.rule==='campusLandAbility'?!!forDef.eclAbilityPayment&&forDef.types.includes('Land'):m.rule==='campusDinosaur'?forDef.subtypes?.includes('Dinosaur'):m.rule==='campusCavern'?!forDef.eclAbilityPayment&&forDef.types.includes('Creature')&&!!g.cards[m.source??-1]?.eclType&&matchesDefSubtype(forDef,g.cards[m.source??-1].eclType!):!forDef.eclAbilityPayment&&(m.rule==='creature'?forDef.types.includes('Creature'):m.rule==='bdHelga'?forDef.types.includes('Creature')&&(manaValue(forDef)>=4||(forDef.cost??'').includes('{X}')):m.rule==='elemental'?matchesDefSubtype(forDef,'Elemental'):m.rule==='mv4'?manaValue(forDef)>=4:m.rule==='tribe'?!!g.cards[m.source??-1]?.eclType&&matchesDefSubtype(forDef,g.cards[m.source??-1].eclType!):false));if(ok)out.push({id:-70000-i,produces:[m.mana],isCreature:false,pool:true});});
  (g.players[pid].frontierMana??[]).forEach((m,i)=>{if(forDef&&!forDef.eclAbilityPayment&&(m.rule==='mountVehicle'?forDef.subtypes?.some(s=>s==='Mount'||s==='Vehicle'):manaValue(forDef)>=5||(forDef.cost??'').includes('{X}')))out.push({id:-84000-i,produces:[m.mana],isCreature:false,pool:true});});
  (g.players[pid].foundationPool??[]).forEach((m,i)=>{if(m.rule==='any'||forDef&&(forDef.foundation?.unlockPayment||!forDef.eclAbilityPayment&&forDef.subtypes?.includes('Room')))out.push({id:-85000-i,produces:[m.mana],isCreature:false,pool:true});});
  // 法術力池
  (g.players[pid].pool ?? []).forEach((m, i) => out.push({ id: -1000 - i, produces: [m], isCreature: false, pool: true }));
  if(forDef?.faceDown||forDef?.eclAbilityPayment&&forDef.faceUpPayment)(g.players[pid].mkmGossip??[]).forEach((mana,i)=>out.push({id:-81000-i,produces:[mana],isCreature:false,pool:true}));
  (g.players[pid].mshRestricted??[]).forEach((m,i)=>{if(forDef&&(m.rule==='equipment'?forDef.eclAbilityPayment?forDef.fin?.equipment==='equipPayment':forDef.subtypes?.includes('Equipment'):m.rule==='creatureAbility'?forDef.eclAbilityPayment&&forDef.types.includes('Creature'):false))out.push({id:-83000-i,produces:[m.mana],isCreature:false,pool:true});});
  if(forDef?.subtypes?.includes('Lesson'))(g.players[pid].poolLesson??[]).forEach((m,i)=>out.push({id:-40000-i,produces:[m],isCreature:false,pool:true}));
  // 只能用來施放非生物咒語的法術力
  if (forDef && !forDef.types.includes('Creature') && !forDef.types.includes('Land')) {
    (g.players[pid].poolNoncreature ?? []).forEach((m, i) => out.push({ id: -50000 - i, produces: [m], isCreature: false, pool: true, noncreatureOnly: true }));
  }
  for(const source of out){const card=g.cards[source.id];if(!card)continue;
   if(g.battlefield.some(id=>g.cards[id].attachedTo===card.id&&abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.frontier==='fdn:horizonsMana')))source.produces=['W','U','B','R','G'];
   const verge=card.def.foundation?.verge;if(verge&&!g.battlefield.some(id=>g.cards[id].controller===pid&&matches(g,{type:'Land',sub:[...verge]},g.cards[id],pid)))source.produces=[card.def.produces![0]];
   if(card.def.id==='secluded-courtyard'&&forDef&&card.eclType&&matchesDefSubtype(forDef,card.eclType))source.produces=['C','W','U','B','R','G'];
   if(card.def.id==='haunted-screen'){source.produces=['W','B',...(g.players[pid].life>0?['U','R','G']as const:[])];}
  }
  return out;
}

/** 額外的地（例如「你每回合可以多使用一張地」） */
export function extraLandDrops(g: GameState, pid: PID): number {
  let n = 0;
  for (const id of g.battlefield) {
    const c = g.cards[id];
    if (c.controller !== pid) continue;
    for (const ab of abilitiesOf(g, c)) if (ab.kind === 'static' && ab.extraLand) n += ab.extraLand;
  }
  return n;
}

function paymentWithWater(g: GameState, pid: PID, cost: ManaCost, exclude?: number, convoke=false, forDef?: CardDef, fromHand=false, water=forDef?.waterbend ?? 0) {
  const sources=manaSources(g,pid,exclude,convoke,forDef,fromHand);
  const first=findPayment(cost,sources); if(!first) return null;
  if(!water) return first;
  const used=new Set(first.map(p=>p.id));
  for(const p of first)if(p.id<=-400000)used.add(Math.floor((-400000-p.id)/1000));
  const helpers: ManaSource[]=g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===pid && !c.tapped && c.id!==exclude && !used.has(c.id) && (isCreature(c)||c.def.types.includes('Artifact'))).map(c=>({id:-300000-c.id,produces:['C'],isCreature:false}));
  const ids=new Set(helpers.map(s=>-300000-s.id));
  const remaining=sources.filter(s=>!used.has(s.id)&&!ids.has(s.id));
  const second=findPayment(parseCost(`{${water}}`),[...helpers,...remaining]);
  return second ? [...first,...second] : null;
}

export function canPayCost(g: GameState, pid: PID, cost: ManaCost, exclude?: number, convoke = false, forDef?: CardDef, fromHand = false, water = forDef?.waterbend ?? 0): boolean {
  return paymentWithWater(g,pid,cost,exclude,convoke,forDef,fromHand,water) !== null;
}

export function payCost(g: GameState, pid: PID, cost: ManaCost, exclude?: number, convoke = false, forDef?: CardDef, fromHand = false, water = forDef?.waterbend ?? 0): boolean {
  const pay = paymentWithWater(g,pid,cost,exclude,convoke,forDef,fromHand,water);
  if (!pay) return false;
  const normalSources=manaSources(g,pid,exclude,convoke,forDef,fromHand);
  g.lastManaSourceIds=pay.filter(p=>p.id>=0).map(p=>p.id);
  g.lastManaPayment=pay.filter(p=>!normalSources.find(s=>s.id===p.id)?.convoke).map(p=>p.mana);
  g.lastManaSpent=pay.filter(p=>(p.id>-300000||p.id<=-400000)&&!normalSources.find(s=>s.id===p.id)?.convoke).length;
  for (const p of pay) if (p.id >= 0) tapCard(g,g.cards[p.id]);
  for (const p of pay) if(p.id<=-300000&&p.id>-400000) tapCard(g,g.cards[-300000-p.id]);
  const bonusLandIds=new Set(pay.filter(p=>p.id<=-400000).map(p=>Math.floor((-400000-p.id)/1000)));
  for(const id of bonusLandIds)tapCard(g,g.cards[id]);
  const paidLands=new Set([...pay.filter(p=>p.id>=0&&(isLand(g.cards[p.id])||g.cards[p.id].def.id==='arc-reactor'||g.cards[p.id].def.id==='troyan-gutsy-explorer'||g.cards[p.id].def.id==='intrepid-stablemaster'||g.cards[p.id].token&&g.cards[p.id].def.types.includes('Artifact'))).map(p=>p.id),...bonusLandIds]);
  for(const id of paidLands){const store=(mana:import('./types').Mana)=>{const key=g.cards[id].def.id;if(key==='intrepid-stablemaster'||key==='troyan-gutsy-explorer')(g.players[pid].frontierMana??=[]).push({mana,rule:key==='intrepid-stablemaster'?'mountVehicle':'bigSpell'});else(g.players[pid].pool??=[]).push(mana);};const extras=landManaExtras(g,g.cards[id],forDef),parent=normalSources.find(s=>s.id===id);const usedBonus=pay.find(p=>normalSources.find(s=>s.id===p.id)?.matchManaOf===id);const color=pay.find(p=>p.id===id)?.mana??usedBonus?.mana??parent?.produces[0]??'C';for(let k=0;k<extras.length;k++)if((!extras[k].requires||color===extras[k].requires)&&!pay.some(p=>p.id===-400000-id*1000-k))store(extras[k].matches?color:extras[k][0]);if(extras.length&&!pay.some(p=>p.id===id))store(color);}

  for (const p of pay) if (p.id >= 0 && g.cards[p.id].def.painMana && p.mana !== 'C') loseLife(g, pid, 1);
  for (const p of pay) if (p.id >= 0 && g.cards[p.id].def.sacOnMana) sacrifice(g, g.cards[p.id]);
  // 用掉的法術力池
  const usedPool = new Set(pay.filter((p) => p.id <= -1000 && p.id > -2000).map((p) => -1000 - p.id));
  if (usedPool.size) g.players[pid].pool = (g.players[pid].pool ?? []).filter((_, i) => !usedPool.has(i));
  const usedRestricted = new Set(pay.filter((p) => p.id <= -50000 && p.id > -100000).map((p) => -50000 - p.id));
  if (usedRestricted.size) g.players[pid].poolNoncreature = (g.players[pid].poolNoncreature ?? []).filter((_, i) => !usedRestricted.has(i));
  const usedLesson=new Set(pay.filter(p=>p.id<=-40000&&p.id>-50000).map(p=>-40000-p.id));
  if(usedLesson.size)g.players[pid].poolLesson=(g.players[pid].poolLesson??[]).filter((_,i)=>!usedLesson.has(i));
  const usedRetained=new Set(pay.filter(p=>p.id<=-25000&&p.id>-30000).map(p=>-25000-p.id));
  if(usedRetained.size)g.players[pid].retainedRed=(g.players[pid].retainedRed??[]).filter((_,i)=>!usedRetained.has(i));
  const usedFire=new Set(pay.filter(p=>p.id<=-30000&&p.id>-40000).map(p=>-30000-p.id));
  if(usedFire.size) g.players[pid].firePool=(g.players[pid].firePool??[]).filter((_,i)=>!usedFire.has(i));
  const usedMsh=new Set(pay.filter(p=>p.id<=-83000&&p.id>-84000).map(p=>-83000-p.id));if(usedMsh.size)g.players[pid].mshRestricted=(g.players[pid].mshRestricted??[]).filter((_,i)=>!usedMsh.has(i));
  const usedFoundation=new Set(pay.filter(p=>p.id<=-85000&&p.id>-86000).map(p=>-85000-p.id));if(usedFoundation.size)g.players[pid].foundationPool=(g.players[pid].foundationPool??[]).filter((_,i)=>!usedFoundation.has(i));
  const usedFrontier=new Set(pay.filter(p=>p.id<=-84000&&p.id>-85000).map(p=>-84000-p.id));if(usedFrontier.size)g.players[pid].frontierMana=(g.players[pid].frontierMana??[]).filter((_,i)=>!usedFrontier.has(i));
  const usedGossip=new Set(pay.filter(p=>p.id<=-81000&&p.id>-82000).map(p=>-81000-p.id));if(usedGossip.size)g.players[pid].mkmGossip=(g.players[pid].mkmGossip??[]).filter((_,i)=>!usedGossip.has(i));
  const usedEcl=new Set(pay.filter(p=>p.id<=-70000&&p.id>-80000).map(p=>-70000-p.id));if(usedEcl.size)g.players[pid].eclRestrictedMana=(g.players[pid].eclRestrictedMana??[]).filter((_,i)=>!usedEcl.has(i));
  for(const id of new Set(pay.filter(x=>x.id>=0).map(x=>x.id))){const c=g.cards[id];if(c.def.id==='twitching-doll')c.charge=(c.charge??0)+2**frontierStatic(g,pid,'fdn:doubleCounters').length;if(c.def.id==='haunted-screen'&&pay.some(x=>x.id===id&&['U','R','G'].includes(x.mana)))loseLife(g,pid,1);}
  if(water) bend(g,pid,'water');
  g.version++;
  return true;
}

// ------------------------------------------------------------
// 時機
// ------------------------------------------------------------
export const isMainPhase = (g: GameState) => g.phase === 'main1' || g.phase === 'main2';
export const sorceryTiming = (g: GameState, pid: PID) => g.active === pid && isMainPhase(g) && g.stack.length === 0;
export const instantSpeed = (def: CardDef) => def.types.includes('Instant') || !!def.keywords?.includes('flash');

// ------------------------------------------------------------
// 咒語資訊
// ------------------------------------------------------------
export function castTargetSpecs(def: CardDef, mode?: number): TargetSpec[] {
  if(def.id==='divine-resilience'&&!def.cost?.includes('{2}'))return [{kind:'creature',filter:{ctrl:'you'}}];
  if(def.frontier?.variableTargets==='graceful')return [...Array.from({length:mode??0},()=>({kind:'creature' as const,filter:{ctrl:'you' as const,enchanted:true}})),{kind:'creature' as const,filter:{ctrl:'you' as const},optional:true},{kind:'creature' as const,filter:{ctrl:'opp' as const}}];
  if(def.ecl?.variableTargets&&def.frontier?.variableTargets==='own')return Array.from({length:mode??0},()=>({kind:'creature' as const,filter:{ctrl:'you' as const}}));
  if(def.ecl?.variableTargets)return Array.from({length:mode??0},()=>({kind:def.id==='doppelgang'?'permanent' as const:'creature' as const}));
  if (def.spell?.modes) return def.spell.modes[mode ?? 0]?.targets ?? [];
  if (def.spell?.targets) return def.spell.targets;
  if (def.aura) return [def.aura.target ?? { kind: 'creature' }];
  return [];
}

export function spellEffects(def: CardDef, mode?: number): Effect[] {
  if (def.spell?.modes) return def.spell.modes[mode ?? 0]?.effects ?? [];
  return def.spell?.effects ?? [];
}

const altCache = new WeakMap<CardDef, Partial<Record<CastAlt, CardDef>>>();

/** 以冒險或返照施放時，這個咒語實際的特性（費用、類別、效果） */
export function castDef(def: CardDef, alt?: CastAlt): CardDef {
  if (!alt) return def;
  let m = altCache.get(def);
  if (!m) altCache.set(def, (m = {}));
  if (m[alt]) return m[alt]!;
  let d: CardDef;
  if((alt==='roomLeft'||alt==='roomRight')&&def.room){const face=alt==='roomLeft'?def.room.left:def.room.right;d={...def,name:face.name,cost:face.cost,text:face.text,abilities:face.abilities};}
  else if(alt==='mutation')d={...def,cost:'{W}{U}{B}{R}{G}'};
  else if(alt==='impending'&&def.impending)d={...def,cost:def.impending.cost};
  else if(alt==='kicked'&&def.kicker)d={...def,cost:costToString(addCosts(parseCost(def.cost),parseCost(def.kicker)))};
  else if(alt==='titaniaMana')d={...def,cost:costToString(addCosts(parseCost(def.cost),parseCost('{2}'))),addCost:undefined};
  else if(alt==='plotTop')d={...def,cost:def.cost,types:['Sorcery'],spell:{effects:[]},addCost:undefined,costReduce:undefined};
  else if(alt==='bargain')d={...def,cost:costToString(reduceCost(parseCost(def.cost),parseCost('{'+(def.frontier?.bargainDiscount??0)+'}')))};
  else if(alt==='teamwork')d={...def,spell:def.msh?.teamworkSpell??def.spell};
  else if(alt==='evidenceFree')d={...def,cost:''};
  else if(alt==='evoke'&&def.evoke)d={...def,cost:def.evoke};
  else if(alt==='sneak'||alt==='sneakGranted'){d={...def,cost:alt==='sneakGranted'?'{3}{B}':def.sneak??'{3}{B}'};}
  else if (alt === 'adventure' && def.adventure) {
    const a = def.adventure;
    d = {
      id: def.id,
      name: a.name,
      zh: a.zh,
      set: def.set,
      rarity: def.rarity,
      cost: a.cost,
      types: a.types,
      subtypes: ['Adventure'],
      spell: a.spell,
      frontier:a.frontier,ecl:a.ecl,frontierStack:a.frontierStack,
      text: a.text,
      imageName: def.imageName,
    };
  } else if (alt === 'back' && def.back) {
    d = def.back;
  } else if (alt === 'free') {
    d = { ...def, cost: '' };
  } else if (alt === 'warp' && def.warp) {
    d = { ...def, cost: def.warp };
  } else if (alt === 'offspring' && def.offspring) {
    d = { ...def, cost: costToString(addCosts(parseCost(def.cost), parseCost(def.offspring))) };
  } else if (alt === 'mayhem' && def.mayhem) {
    d = { ...def, cost: def.mayhem };
  } else if (alt === 'harmonize' && def.harmonize) {
    d = { ...def, cost: def.harmonize };
  } else if (alt === 'prepared' && def.prepare) {
    const a = def.prepare;
    d = { id: def.id, name: a.name, zh: a.zh, set: def.set, rarity: def.rarity, cost: a.cost, types: a.types, spell: a.spell, text: a.text, imageName: def.imageName };
  } else if (alt === 'disguise' && def.disguise) {
    d = faceDownDef(def, true);
  } else if (alt === 'plot' && (def.plot||def.foretell)) {
    d = { ...def, cost: def.plot??'{2}', types: ['Sorcery'], spell: { effects: [] }, addCost: undefined, costReduce: undefined };
  } else if (alt === 'plotted') {
    d = def;
  } else if(alt==='graveCost'){d={...def,addCost:{life:2,sac:{type:['Artifact','Creature']}}};
  } else if(alt==='campusSac'){d={...def,addCost:{sac:{}}};
  } else if(alt==='campusCasualty'){d=def;
  } else if(alt==='campusExile'||alt==='campusFree'||alt==='campusMiracle'){d=def;
  } else if (alt === 'cycle' && def.cycling) {
    // 循環是起動式異能：任何時候都能起動，不是施放咒語
    d = { ...def, cost: def.cycling.cost, types: ['Instant'], spell: { effects: cycleEffects(def) }, addCost: undefined, costReduce: undefined };
  } else {
    d = { ...def, cost: def.flashback ?? def.cost, ...(def.flashbackAddCost ? { addCost: def.flashbackAddCost } : {}) };
  }
  m[alt] = d;
  return d;
}

/** 「你可以從手上免費施放法術力值小於或等於你操控的生物數量的咒語」 */
function freeCastAllowed(g: GameState, pid: PID, c: Card): boolean {
  if(c.zone==='hand'&&frontierStatic(g,pid,'fdn:omniFree').length)return true;
  if(mshFlags(g,pid).freeRG&&isCreature(c)&&colorsOf(c.def).some(c=>c==='R'||c==='G'))return true;
  let has = false;
  for (const id of g.battlefield) {
    const s = g.cards[id];
    if (s.controller === pid && abilitiesOf(g, s).some((a) => a.kind === 'static' && a.freeCastByCreatures)) has = true;
  }
  if (!has) return false;
  let n = 0;
  for (const id of g.battlefield) {
    const s = g.cards[id];
    if (s.controller === pid && isCreature(s)) n++;
  }
  return manaValue(c.def) <= n;
}

export function cycleEffects(def: CardDef): Effect[] {
  return def.cycling?.search ? [{ e: 'tutor', filter: def.cycling.search }] : [{ e: 'draw', n: 1 }];
}

/** 這張牌在目前的區域可以用哪些方式施放 */
export function sneakAttackers(g:GameState,pid:PID):Card[]{return ['combat_blockers','combat_damage_first','combat_damage','combat_end'].includes(g.phase)&&g.blockersDeclared?g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===pid&&isCreature(c)&&c.attacking&&!c.wasBlocked&&!c.blockedBy.length):[];}
function ninjaGraveSneak(g:GameState,pid:PID):boolean{return g.battlefield.some(id=>{const c=g.cards[id];return c.controller===pid&&c.def.id==='ninja-teen'&&(c.classLevel??1)>=3&&!abilitiesSuppressed(g,c);});}
function graveCastAllowed(g:GameState,pid:PID,c:Card):boolean{return g.active===pid&&g.battlefield.some(id=>{const s=g.cards[id];return s.controller===pid&&abilitiesOf(g,s).some(a=>a.kind==='static'&&a.graveCast&&matches(g,a.graveCast,c,pid,s.id));});}

export function castAlts(g:GameState,pid:PID,c:Card):(CastAlt|undefined)[]{const alts=baseCastAlts(g,pid,c);if(c.zone==='graveyard'&&c.owner===pid&&c.def.meadow?.graveSacCast)alts.push('graveCost');if((c.def.meadow?.forageSpell||osteoCast(g,pid,c))&&validForage(g,pid,forageOptions(g,pid,c.id).defaults,c.id))alts.push('forage');if(!alts.length)return alts;if(c.zone==='hand'&&frontierStatic(g,pid,'dsk:mutationCost').length)alts.push('mutation');if(c.zone==='exile'&&!frontierFlags(g,pid).warpedUsed&&frontierStatic(g,pid,'dsk:warpedFree').length)alts.push('free');return alts;}
function baseCastAlts(g: GameState, pid: PID, c: Card): (CastAlt | undefined)[] {
  const def = c.def;
  if(festivalCast(g,pid,c))return [undefined];
  if(c.zone==='graveyard'&&c.owner===pid&&c.def.meadow?.graveMaxSpeed&&(g.players[pid].speed??0)>=4)return [undefined];
  if(c.zone!=='hand'&&foundationPermission(g,pid,c))return def.room?['roomLeft','roomRight']:[undefined];
  if(c.zone==='library'&&c.owner===pid&&!isLand(c)&&g.players[pid].library[0]===c.id&&frontierStatic(g,pid,'fblthpPlot').length)return ['plotTop'];
  if(c.zone==='graveyard'&&c.owner===pid&&(c.frontierMarks?.dreadUntil??-1)>=g.turn)return ['adventure'];
  if(c.zone==='library'&&frontierStatic(g,pid,'johannTopOnce').length&&frontierFlags(g,pid).johannTop)return [];
  if(c.zone==='library'&&c.owner===pid&&g.players[pid].library[0]===c.id&&((mkmStatic(g,pid,'assemble').length&&isCreature(c)&&(c.def.power??0)<=2&&!mkmFlags(g,pid).topCast)||mkmStatic(g,pid,'hothouse').some(s=>s.mkmSolved)&&(isLand(c)||c.def.types.some(t=>t==='Creature'||t==='Enchantment'))))return [undefined];
  if(c.zone==='graveyard'&&c.owner===pid&&isCreature(c)&&mkmFlags(g,pid).graveCast===g.turn)return [undefined];
  if(c.zone==='library'&&c.owner===pid&&g.players[pid].library[0]===c.id&&((finStatic(g,pid,'travelingTop').length&&(isLand(c)||matches(g,{sub:'Bird'},c,pid)))||finStatic(g,pid,'whaleTop').some(s=>s.attackedTurn===g.turn)))return [undefined];
  if(c.zone==='graveyard'&&c.owner===pid&&isLand(c)&&mshStatic(g,pid,'graveLands').length)return [undefined];
  if(c.zone==='graveyard'&&c.owner===pid&&finGraveCast(g,pid,c))return [undefined,...(def.adventure?['adventure' as const]:[])];
  if(c.zone!=='hand' && (g.players[pid].noExileCastUntil??-1)>=g.turn) return [];
  if (c.zone === 'hand' && c.owner === pid) {
    const base: (CastAlt | undefined)[] = def.room ? ['roomLeft','roomRight'] : def.adventure ? [undefined, 'adventure'] : def.mdfc && def.back ? [undefined, 'back'] : [undefined];
    if(def.meadow?.campusExileOrPay&&g.players[pid].graveyard.length>=Number(def.meadow.campusExileOrPay))base.push('campusExile');
    if(def.meadow?.campusDiscardOrSac&&g.battlefield.some(id=>g.cards[id].controller===pid))base.push('campusSac');
    if(campusFree(g,pid,c))base.push('campusFree');
    if(def.types.some(t=>t==='Instant'||t==='Sorcery')&&frontierStatic(g,pid,'sos:casualty').length&&g.battlefield.some(id=>g.cards[id].controller===pid&&isCreature(g.cards[id])&&stats(g,g.cards[id]).p>=1))base.push('campusCasualty');
    if(def.kicker)base.push('kicked');if(def.impending)base.push('impending');
    if(def.sneak&&sneakAttackers(g,pid).length)base.push('sneak');
    if(def.id==='titania-rugged-rumbler')base.push('titaniaMana');
    if(def.msh?.teamwork&&teamworkPayment(g,pid,def.msh.teamwork))base.push('teamwork');
    if(def.mkm?.optionalEvidence&&canEvidence(g,pid,def.mkm.optionalEvidence))base.push('evidence');
    if(!isLand(c)&&mkmStatic(g,pid,'evidenceFree').length&&canEvidence(g,pid,10))base.push('evidenceFree');
    if(def.evoke)base.push('evoke');
    if (def.disguise) base.push('disguise');
    if(!isLand(c)&&isCreature(c)&&mshFlags(g,pid).freeRG&&colorsOf(def).some(c=>c==='R'||c==='G'))base.push('free');
    if (!isLand(c) && freeCastAllowed(g, pid, c)) base.push('free');
    if (def.warp) base.push('warp');
    if (def.offspring) base.push('offspring');
    if(def.meadow?.gift)base.push('gift');
    if(def.frontier?.bargain&&!def.spell?.modes)base.push('bargain');
    if (def.plot || def.foretell) base.push('plot');
    return def.cycling ? [...base, 'cycle'] : base;
  }
  if(c.zone==='exile'&&c.eclCast?.by===pid&&eclPermission(g,pid,c))return [undefined];
  if (c.zone === 'exile' && c.owner === pid && c.plottedTurn !== undefined && c.plottedTurn < g.turn) return ['plotted'];
  if (c.zone === 'battlefield' && c.controller === pid && c.prepared && def.prepare) return ['prepared'];
  if (c.zone === 'exile' && g.players[pid].noExileCastUntil !== undefined && g.turn <= g.players[pid].noExileCastUntil!) return [];
  if (c.zone === 'exile' && c.airbent && c.owner === pid) return [undefined];
  if (c.zone === 'library' && c.owner === pid && g.players[pid].library[0] === c.id && g.battlefield.some(id=>g.cards[id].controller===pid && abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.topCast&&matches(g,a.topCast,c,pid)))) return [undefined];
  if(c.zone==='exile' && c.playableBy===pid && c.playableUntil!==undefined && c.playableUntil>=g.turn) return [undefined];
  if (c.zone === 'exile' && c.owner === pid && c.onAdventure) return [undefined];
  if (c.zone === 'exile' && (c.onAdventure&&c.owner===pid||(c.playableTurn === g.turn && c.playableBy === pid)||eclPermission(g,pid,c))) return def.adventure ? [undefined, 'adventure'] : [undefined];
  if (c.zone === 'exile' && c.owner === pid && c.warpExiled !== undefined && c.warpExiled < g.turn) return [undefined];
  if (c.zone === 'exile' && c.waterCastBy !== undefined && g.cards[c.waterCastBy]?.zone !== 'battlefield') return [];
  if (c.zone === 'exile' && c.linkedCast && c.linkedCast.by === pid && checkCond(g, c.linkedCast.cond, pid, undefined, [])) return [undefined];
  if (c.zone === 'graveyard' && c.owner === pid) {
    const out: (CastAlt|undefined)[] = [];
    if(isCreature(c)&&ninjaGraveSneak(g,pid)&&sneakAttackers(g,pid).length){out.push('sneak');if(def.sneak&&def.sneak!=='{3}{B}')out.push('sneakGranted');}
    if(graveCastAllowed(g,pid,c))out.push(undefined);
    if (def.flashback || c.tempFlashbackTurn === g.turn || (g.active===pid && g.battlefield.some(id=>g.cards[id].controller===pid&&abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.flashbackAll)) && def.types.some(t=>t==='Instant'||t==='Sorcery'))) out.push('flashback');
    if (def.harmonize) out.push('harmonize');
    if (def.mayhem && c.discardedTurn === g.turn) out.push('mayhem');
    return out;
  }
  return [];
}

export function modeCount(def: CardDef): number {
  return def.spell?.modes?.length ?? 1;
}

export function spellCost(g: GameState, c: Card, pid: PID, mode?: number, targets?: (TargetRef | null)[], alt?: CastAlt, x = 0,extraCosts?:number[]): ManaCost {
  const def = castDef(c.def, alt);
  if(c.waterCastBy!==undefined) return parseCost('');
  if(c.zone==='exile'&&foundationPermission(g,pid,c)&&frontierStatic(g,pid,'dsk:valgavothPlay').some(s=>c.frontierMarks?.valgavothLink===s.tmtLinkKey))return parseCost('');
  if(alt==='flashback' && !c.def.flashback && g.active===pid && g.battlefield.some(id=>g.cards[id].controller===pid&&abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.flashbackAll))) return parseCost(c.def.subtypes?.includes('Lesson')?'{1}':c.def.cost);
  if(alt==='cycle'){const cost=parseCost(def.cost);cost.generic+=(cost.x??0)*x;return cost;}
  if (alt === 'plotTop') return parseCost(def.cost);
  if(alt==='plot')return reduceCost(parseCost(def.cost),parseCost('{'+2*frontierStatic(g,pid,'aurlockDiscount').length+'}'));
  if(alt==='flashback'&&c.frontierMarks?.freeFlashback===g.turn)return parseCost('');
  if (alt === 'free'||alt==='campusFree') {
    const cost = parseCost('');
    if (targets) cost.generic += wardTax(g, pid, targets);
    return cost;
  }
  if (alt === 'disguise') {
    const cost = parseCost('{3}');
    cost.generic=Math.max(0,cost.generic-(mkmFlags(g,pid).faceDownDiscount??0));
    if (targets) cost.generic += wardTax(g, pid, targets);
    return cost;
  }
  if (alt === 'plotted') {
    const cost = parseCost(c.foretellTurn!==undefined ? c.def.foretell : '');
    if (targets) cost.generic += wardTax(g, pid, targets);
    return cost;
  }
  let cost = alt==='campusMiracle'?parseCost('{2}'):c.eclCast?.free&&eclPermission(g,pid,c)?parseCost(''):parseCost(c.airbent ? '{2}' : def.spell?.modes?.[mode ?? 0]?.cost ?? def.cost);
  campusCost(g,pid,c,def,cost,targets,alt);
  if(c.def.ecl?.behold?.tax&&!canBehold(g,pid,c,alt))cost.generic+=c.def.ecl.behold.tax;
  if(['rime-chill','wildvine-pummeler'].includes(def.id))cost.generic=Math.max(0,cost.generic-vividColors(g,pid).length);
  if(def.id==='swat-away'&&g.battlefield.some(id=>g.cards[id].controller!==pid&&g.cards[id].attacking))cost.generic=Math.max(0,cost.generic-2);
  if(def.types.includes('Creature')&&(def.toughness??0)>(def.power??0))cost.generic=Math.max(0,cost.generic-eclStatic(g,pid,'doranCost').length);
  for(const source of eclStatic(g,pid,'gatheringCost'))if(source.eclType&&matchesDefSubtype(def,source.eclType))cost.generic=Math.max(0,cost.generic-1);
  const frontier=frontierFlags(g,pid);
  if(def.foundation?.totalPowerDiscount)cost.generic=Math.max(0,cost.generic-g.battlefield.filter(id=>g.cards[id].controller===pid&&isCreature(g.cards[id])).reduce((n,id)=>n+stats(g,g.cards[id]).p,0));
  if(def.frontier?.attackerDiscount)cost.generic=Math.max(0,cost.generic-g.players.reduce((n,p)=>n+(frontierFlags(g,p.id).attackers??0),0));
  if(g.players[pid].spellsThisTurn===1)cost.generic=Math.max(0,cost.generic-frontierStatic(g,pid,'secondDiscount').length);
  if(def.adventure&&def.types.some(t=>t==='Creature'||t==='Artifact'||t==='Enchantment'))cost.generic=Math.max(0,cost.generic-frontierStatic(g,pid,'belunaDiscount').length);
  if(colorsOf(def).some(c=>c==='B'||c==='R'))cost.generic=Math.max(0,cost.generic-(frontier.rowan??0));
  if(colorsOf(def).some(c=>c==='W'||c==='U'))cost.generic=Math.max(0,cost.generic-(frontier.will??0));
  if(c.zone==='graveyard'||c.zone==='exile'){cost.generic+=2*frontierStatic(g,(1-pid)as PID,'avenTax').length;cost.generic=Math.max(0,cost.generic-2*frontierStatic(g,pid,'aurlockDiscount').length);}
  if(g.active!==pid)cost.generic=Math.max(0,cost.generic-frontierStatic(g,pid,'geyserDiscount').length);
  if(def.frontier?.tappedTargetDiscount&&targets?.some(t=>t&&'c'in t&&g.cards[t.c].tapped))cost.generic=Math.max(0,cost.generic-def.frontier.tappedTargetDiscount);
  if(def.frontier?.ownTargetDiscount&&targets?.some(t=>t&&'c'in t&&g.cards[t.c].controller===pid))cost.generic=Math.max(0,cost.generic-def.frontier.ownTargetDiscount);
  if (cost.x) cost.generic += Math.max(0, x) * cost.x;
  // 「額外費用：注視傑斯或支付 {1}」：沒有符合條件時多付
  if(def.meadow?.forageSpell&&alt!=='forage')cost.B++;
  if (def.costMoreUnless && !checkCond(g, def.costMoreUnless.cond, pid, c.id, [])) cost = addCosts(cost, parseCost(def.costMoreUnless.mana));
  if(def.meadow?.graveExileDiscount)cost.generic=Math.max(0,cost.generic-[...g.players[pid].graveyard,...g.players[pid].exile].filter(id=>isCreature(g.cards[id])).length);
  if(def.meadow?.sacDiscount)cost.generic=Math.max(0,cost.generic-(extraCosts?.length??g.battlefield.filter(id=>g.cards[id].controller===pid&&!isLand(g.cards[id])).length));
  if(def.meadow?.targetDiscount&&targets?.[0]&&'c'in targets[0]){const t=g.cards[targets[0].c];if(def.meadow.targetDiscountKind==='attackTapped'&&(t.attacking||t.tapped))cost.generic=Math.max(0,cost.generic-Number(def.meadow.targetDiscount));}
  cost.generic=Math.max(0,cost.generic-(!def.types.includes('Creature')?frontierStatic(g,pid,'blb:artistCost').filter(c=>(c.classLevel??1)>=2).length:0));
  if(def.types.some(t=>t==='Instant'||t==='Sorcery')&&!frontierFlags(g,pid).bdInstants&&!frontierFlags(g,pid).bdSorceries)for(const eluge of frontierStatic(g,pid,'blb:eluge')){const n=g.battlefield.filter(id=>g.cards[id].controller===pid&&(g.cards[id].eclCounters?.flood??0)>0).length;let left=n;const blue=Math.min(cost.U,left);cost.U-=blue;left-=blue;cost.generic=Math.max(0,cost.generic-left);void eluge;}
  if(!def.types.includes('Creature'))cost.generic=Math.max(0,cost.generic-(g.players[pid].speed??0)*frontierStatic(g,pid,'dft:samut').length);
  const cr = def.costReduce;
  if (cr) {
    if (cr.perGy) {
      let n = 0;
      for (const id of g.players[pid].graveyard) if (matches(g, cr.perGy, g.cards[id], pid)) n++;
      cost = reduceCost(cost, { ...parseCost(''), generic: n });
    }
    if (cr.perMaxMv) {
      let n = 0;
      for (const id of g.battlefield) {
        const s = g.cards[id];
        if (s.controller === pid && matches(g, cr.perMaxMv, s, pid)) n = Math.max(n, manaValue(s.def));
      }
      cost = reduceCost(cost, { ...parseCost(''), generic: n });
    }
    if (cr.perMaxStat) {
      let n = 0;
      for (const id of g.battlefield) {
        const s = g.cards[id];
        if (s.controller !== pid || !matches(g, cr.perMaxStat.filter, s, pid)) continue;
        const st = stats(g, s);
        n = Math.max(n, cr.perMaxStat.stat === 'power' ? st.p : st.t);
      }
      cost = reduceCost(cost, { ...parseCost(''), generic: n });
    }
    if (cr.perCount) cost = reduceCost(cost, { ...parseCost(''), generic: countMatching(g, { ...cr.perCount, ctrl: 'you' }, pid) });
    if (cr.cond && cr.mana && checkCond(g, cr.cond, pid, c.id, [])) cost = reduceCost(cost, parseCost(cr.mana));
  }
  for (const id of g.battlefield) {
    const s = g.cards[id];
    if (s.controller !== pid) continue;
    for (const ab of abilitiesOf(g, s)) {
      if (ab.kind === 'static' && ab.spellCostColorsLess) cost = reduceCost(cost,parseCost(ab.spellCostColorsLess));
      if (ab.kind === 'static' && ab.spellCostLess && (!ab.condition || checkCond(g,ab.condition,pid,s.id,[])) && matches(g, ab.spellCostLess.filter, c, pid)) {
        cost = reduceCost(cost, { ...parseCost(''), generic: ab.spellCostLess.n });
      }
    }
  }
  if(g.players[pid].nextAffinity&&!def.types.includes('Creature'))cost.generic=Math.max(0,cost.generic-(g.players[pid].nextAffinity??0)*countMatching(g,{type:'Artifact',ctrl:'you'},pid));
  // 「可以用任何類型的法術力支付」：有色需求都改成一般費用
  if(def.id==='fate-of-the-sun-cryst'&&targets?.some(t=>t&&'c'in t&&isCreature(g.cards[t.c])&&g.cards[t.c].tapped))cost.generic=Math.max(0,cost.generic-2);
  if(def.types.includes('Creature')&&def.supertypes?.includes('Legendary')&&!g.players[pid].finFlags?.legendCast)cost.generic=Math.max(0,cost.generic-2*finStatic(g,pid,'firstLegendDiscount').length);
  if(def.id==='depower'&&targets?.some(t=>t&&'c'in t&&g.cards[t.c].attacking))cost.generic=Math.max(0,cost.generic-2);
  if(def.types.includes('Artifact'))cost.generic=Math.max(0,cost.generic-(mshFlags(g,pid).artifactDiscount??0));
  if(def.types.some(t=>t==='Instant'||t==='Sorcery')&&manaValue(def)>=4)cost.generic=Math.max(0,cost.generic-mshStatic(g,pid,'scarletDiscount').reduce((n,s)=>n+Math.max(0,stats(g,s).p),0));
  if (c.frontierMarks?.stash&&foundationPermission(g,pid,c)||isCreature(c)&&frontierStatic(g,pid,'fdn:vizierCast').length||c.linkedCast || c.finMarks?.anyMana===1||c.eclCast?.mode==='finAnyMana'||c.eclCast?.mode==='taster'&&eclPermission(g,pid,c)) {
    const total = cost.generic + cost.W + cost.U + cost.B + cost.R + cost.G + cost.C + (cost.hyb?.length ?? 0);
    cost = { ...parseCost(''), generic: total };
  }
  // 稅：永久物讓咒語多花費用（例如「對手施放的非生物咒語費用多{1}」）
  for (const id of g.battlefield) {
    const s = g.cards[id];
    for (const ab of abilitiesOf(g, s)) {
      if (ab.kind !== 'static' || !ab.spellCostMore) continue;
      const m = ab.spellCostMore;
      if ((m.who === 'all' || s.controller !== pid) && matches(g, m.filter, c, pid)) cost.generic += m.n;
    }
  }
  if (alt === 'harmonize') {
    const h = harmonizeTapper(g, pid);
    if (h) cost = reduceCost(cost, { ...parseCost(''), generic: h.p });
  }
  if(alt==='evidence'&&def.id==='bite-down-on-crime')cost.generic=Math.max(0,cost.generic-2);
  if(def.id==='the-pride-of-hull-clade')cost.generic=Math.max(0,cost.generic-g.battlefield.filter(id=>g.cards[id].controller===pid&&isCreature(g.cards[id])).reduce((n,id)=>n+Math.max(0,stats(g,g.cards[id]).t),0));
  if(def.subtypes?.includes('Case')&&mkmStatic(g,pid,'caseMana').length){const total=cost.generic+cost.W+cost.U+cost.B+cost.R+cost.G+cost.C+(cost.hyb?.length??0);cost={...parseCost(''),generic:total};}
  if (targets) cost.generic += wardTax(g, pid, targets);
  return cost;
}

/** 和聲：選一個未橫置、力量最大的生物來橫置減費 */
export function harmonizeTapper(g: GameState, pid: PID): { id: number; p: number } | null {
  let best: { id: number; p: number } | null = null;
  for (const id of g.battlefield) {
    const c = g.cards[id];
    if (c.controller !== pid || c.tapped || !isCreature(c)) continue;
    const p = stats(g, c).p;
    if (p > 0 && (!best || p > best.p)) best = { id, p };
  }
  return best;
}

/** 守護—支付生命：以對手的永久物為目標時要支付的生命 */
export function wardLifeTax(g: GameState, pid: PID, targets: (TargetRef | null)[]): number {
  let n = 0;
  for (const t of targets) {
    if (!t || !('c' in t)) continue;
    const tc = g.cards[t.c];
    if (tc && tc.zone === 'battlefield' && tc.controller !== pid && tc.def.wardLife && tc.def.set!=='FDN'&&tc.def.set!=='DSK'&&tc.def.set!=='ECL'&&tc.def.set!=='FIN'&&tc.def.set!=='MKM'&&tc.def.set!=='MSH'&&tc.def.set!=='WOE'&&tc.def.set!=='OTJ'&&tc.def.set!=='BLB'&&tc.def.set!=='SOS'&&tc.def.set!=='DFT'&&tc.def.set!=='LCI' && !abilitiesSuppressed(g, tc)) n += tc.def.wardLife;
  }
  return n;
}

/** 守護—棄掉一張牌：以對手的永久物為目標時，自動棄掉手牌中最不重要的一張；回傳需要棄的張數 */
export function wardDiscardCount(g: GameState, pid: PID, targets: (TargetRef | null)[]): number {
  let n = 0;
  for (const t of targets) {
    if (!t || !('c' in t)) continue;
    const tc = g.cards[t.c];
    if (tc && tc.zone === 'battlefield' && tc.controller !== pid && tc.def.wardDiscard&&tc.def.set!=='FDN'&&tc.def.set!=='DSK'&&tc.def.set!=='BLB'&&tc.def.set!=='SOS' && !abilitiesSuppressed(g, tc)) n++;
  }
  return n;
}

/** 守護—犧牲永久物：以對手的永久物為目標時要犧牲的數量 */
export function wardSacCount(g: GameState, pid: PID, targets: (TargetRef | null)[]): number {
  let n = 0;
  for (const t of targets) {
    if (!t || !('c' in t)) continue;
    const tc = g.cards[t.c];
    if (tc && tc.zone === 'battlefield' && tc.controller !== pid && tc.def.wardSac&&tc.def.set!=='FDN'&&tc.def.set!=='DSK' && !abilitiesSuppressed(g, tc)) n += tc.def.wardSac;
  }
  return n;
}

/** 自動犧牲最不重要的永久物：已橫置的地、其他地，然後法術力值最低的非地永久物 */
function payWardSac(g: GameState, pid: PID, n: number, exclude?: number): void {
  for (let i = 0; i < n; i++) {
    const mine = g.battlefield.map((id) => g.cards[id]).filter((x) => x.controller === pid && x.id !== exclude);
    if (!mine.length) return;
    const rank = (x: Card) => (isLand(x) ? (x.tapped ? 0 : 1) : 2) * 1000 + manaValue(x.def);
    mine.sort((a, b) => rank(a) - rank(b));
    log(g, `守護：犧牲 ${cardName(mine[0])}`, pid);
    sacrifice(g, mine[0]);
  }
}

function payWardDiscard(g: GameState, pid: PID, n: number, exclude?: number): void {
  for (let i = 0; i < n; i++) {
    const hand = g.players[pid].hand.filter((id) => id !== exclude).map((id) => g.cards[id]);
    if (!hand.length) return;
    // 優先棄掉地以外法術力值最低的牌；全是地就棄地
    hand.sort((a, b) => Number(isLand(b)) - Number(isLand(a)) || manaValue(a.def) - manaValue(b.def));
    log(g, `守護：棄掉 ${cardName(hand[0])}`, pid);
    discard(g, hand[0]);
  }
}

export function wardTax(g: GameState, pid: PID, targets: (TargetRef | null)[]): number {
  let n = 0;
  for (const t of targets) {
    if (!t || !('c' in t)) continue;
    const tc = g.cards[t.c];
    if (tc && tc.zone === 'battlefield' && tc.controller !== pid && tc.def.ward && tc.def.set!=='TMT'&&tc.def.set!=='FDN'&&tc.def.set!=='DSK'&&tc.def.set!=='ECL'&&tc.def.set!=='FIN'&&tc.def.set!=='MKM'&&tc.def.set!=='MSH'&&tc.def.set!=='WOE'&&tc.def.set!=='OTJ'&&tc.def.set!=='BLB'&&tc.def.set!=='SOS'&&tc.def.set!=='DFT'&&tc.def.set!=='LCI' && !abilitiesSuppressed(g, tc)) n += tc.def.ward;
  }
  return n;
}

// ------------------------------------------------------------
// 起動式異能（含裝備）
// ------------------------------------------------------------
const abilityCache = new WeakMap<CardDef, ActivatedAbility[]>();

export function activatedAbilities(def: CardDef): ActivatedAbility[] {
  let list = abilityCache.get(def);
  if (list) return list;
  list = (def.abilities ?? []).filter((a): a is ActivatedAbility => a.kind === 'activated');
  if (def.equip&&!def.equip.manual) {
    list = [
      ...list,
      {
        kind: 'activated',
        cost: { mana: def.equip.cost },
        sorcery: true,
        targets: [{ kind: 'creature', filter: { ctrl: 'you' }, notSelf: true, prompt: '選擇要裝備的生物' }],
        effects: [{ e: 'attach', what: 'T0' }],
        label: `裝備 ${def.equip.cost}`,
        isEquip: true,
      },
    ];
  }
  list=list.flatMap(ab=>ab.foundationDistribution===8?Array.from({length:9},(_,n)=>({...ab,label:ab.label+'（'+n+'個目標）',targets:Array.from({length:n},()=>({kind:'creatureOrPlaneswalker' as const}))})): [ab]);
  abilityCache.set(def, list);
  return list;
}

/** 其他永久物授予這張牌的起動式異能（例如「由你操控的鵬洛客具有……」） */
export function grantedAbilities(g: GameState, c: Card): ActivatedAbility[] {
  const out: ActivatedAbility[] = [];
  if(c.hidden&&mkmStatic(g,c.controller,'etrata').length)out.push({kind:'activated',cost:{mana:'{2}{U}{B}'},effects:[{e:'mkm',action:'etrataUp'}],label:'翻正面，或放逐後免費施放'});
  if (c.zone !== 'battlefield'){if(c.zone==='hand'||c.zone==='graveyard')out.push(...frontierGrantedAbilities(g,c));return out;}
  out.push(...frontierGrantedAbilities(g,c));
  for (const id of g.battlefield) {
    const s = g.cards[id];
    if (s.controller !== c.controller) continue;
    if(s.attachedTo===c.id&&s.def.equip?.abilities)out.push(...s.def.equip.abilities);
    for (const ab of abilitiesOf(g, s)) {
      if (ab.kind === 'static' && ab.grantAbilities && matches(g, ab.grantAbilities.filter, c, c.controller, s.id)) out.push(...ab.grantAbilities.abilities);
    }
  }
  return out;
}

/** 這張牌目前所有的起動式異能（含授予的；索引依序接在本身的異能後面） */
export function abilitiesFor(g: GameState, c: Card): ActivatedAbility[] {
  if (abilitiesSuppressed(g, c)) return foundationGrantedAbilities(g,c).filter(a=>a.roomDoor!==undefined);
  const base = activatedAbilities(c.def);
  const extra = [...grantedAbilities(g, c),...(c.copiedAbilities??[]).filter((a):a is ActivatedAbility=>a.kind==='activated')];
  return (extra.length?[...base,...extra]:base).map(a=>a.effects.some(e=>e.e==='frontier'&&e.action==='dft:214')?{...a,targets:a.targets?.map(t=>({...t,filter:{...t.filter,ids:(c.meadowLinked??[]).filter(id=>g.cards[id].zone==='exile'&&g.cards[id].objectVersion===c.frontierMarks?.['bdMime:'+id])}}))}:a);
}

/** 工藝的素材：優先用墳墓場的牌，其次是戰場上價值最低的永久物 */
export function craftMaterials(g: GameState, pid: PID, f: Filter, selfId: number, n = 1): number[] | null {
  const gy = g.players[pid].graveyard.map((id) => g.cards[id]).filter((c) => matches(g, f, c, pid, selfId));
  const bf = sacCandidates(g, pid, { ...f, other: true }, selfId).filter((c) => c.id !== selfId);
  bf.sort((a, b) => manaValue(a.def) - manaValue(b.def) || Number(!!b.token) - Number(!!a.token));
  const pick = [...gy, ...bf].slice(0, n).map((c) => c.id);
  return pick.length === n ? pick : null;
}

function sacCandidates(g: GameState, pid: PID, f: Filter, sourceId?: number): Card[] {
  return g.battlefield
    .map((id) => g.cards[id])
    .filter((c) => c.controller === pid && matches(g, f, c, pid, sourceId));
}

/**
 * 駕駛：挑選要橫置的生物（總力量至少 n）。
 * 優先用剛進場（本來就不能攻擊）的生物，並盡量少浪費力量。找不到回傳 null。
 */
export function crewChoice(g: GameState, pid: PID, vehicle: Card, n: number): number[] | null {
  const cands = g.battlefield
    .map((id) => g.cards[id])
    .filter((c) => c.controller === pid && (c.id!==vehicle.id||vehicle.def.subtypes?.includes('Vehicle')) && isCreature(c) && !c.tapped && crewPower(g,c)>0);
  const pow = (c: Card) => crewPower(g,c);
  const cost = (c: Card) => pow(c) + (c.sick && !hasKw(g, c, 'haste') ? 0 : 3);
  if (cands.length <= 12) {
    let best: Card[] | null = null;
    let bestCost = Infinity;
    for (let mask = 1; mask < 1 << cands.length; mask++) {
      const pick = cands.filter((_, i) => mask & (1 << i));
      if (pick.reduce((s, c) => s + pow(c), 0) < n) continue;
      const k = pick.reduce((s, c) => s + cost(c), 0);
      if (k < bestCost) {
        bestCost = k;
        best = pick;
      }
    }
    return best ? best.map((c) => c.id) : null;
  }
  const sorted = [...cands].sort((a, b) => cost(a) - cost(b));
  const out: number[] = [];
  let sum = 0;
  for (const c of sorted) {
    if (sum >= n) break;
    out.push(c.id);
    sum += pow(c);
  }
  return sum >= n ? out : null;
}

/** usedThisTurn 中代表「本回合已起動過忠誠異能」的記號 */
const LOYALTY_USED = 2000;

/** 起動代價「橫置 n 個未橫置的永久物」：優先選不會產生法術力的永久物 */
export function tapNChoices(g: GameState, pid: PID, f: Filter, n: number, sourceId: number): number[] | null {
  const cands = g.battlefield
    .map((id) => g.cards[id])
    .filter((x) => x.controller === pid && !x.tapped && matches(g, f, x, pid, sourceId));
  if (cands.length < n) return null;
  cands.sort((a, b) => Number(!!a.def.produces) - Number(!!b.def.produces) || manaValue(a.def) - manaValue(b.def));
  return cands.slice(0, n).map((x) => x.id);
}

function tokenAbilityReduction(g:GameState,c:Card):number{return c.token&&c.def.types.includes('Artifact')?g.battlefield.reduce((n,id)=>{const s=g.cards[id];return n+(s.controller===c.controller?abilitiesOf(g,s).reduce((a,b)=>a+(b.kind==='static'?b.artifactTokenCostLess??0:0),0):0);},0):0;}

export function canActivate(g: GameState, pid: PID, c: Card, idx: number): boolean {
  const ab = abilitiesFor(g, c)[idx];
  if (!ab||campusActivationBlocked(g,c,ab)) return false;
  if(ab.cost.craft&&campusCraftOptions(g,pid,c,ab).length<(ab.cost.craftCount??1))return false;
  if(ab.roomDoor!==undefined){const cost=parseCost(ab.cost.mana);cost.generic=Math.max(0,cost.generic-frontierStatic(g,pid,'dsk:unlockDiscount').length);return c.zone==='battlefield'&&c.controller===pid&&sorceryTiming(g,pid)&&canPayCost(g,pid,cost,undefined,false,{...c.def,eclAbilityPayment:true,foundation:{...c.def.foundation,unlockPayment:true}});}
  if(g.battlefield.some(id=>g.cards[id].attachedTo===c.id&&abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.fin==='disableAttached')))return false;
  const isMana=ab.manaAbility||!ab.targets?.length&&ab.cost.loyalty===undefined&&ab.effects.every(e=>e.e==='addMana'||e.e==='addManaOfChoice'||e.e==='frontier'&&e.action==='fdn:lotusMana');if(!isMana&&[...frontierStatic(g,0,'fdn:spyglass'),...frontierStatic(g,1,'fdn:spyglass')].some(s=>s.foundationNamed===c.def.name))return false;
  if(ab.foundationNinjutsu&&!sneakAttackers(g,pid).length)return false;
  const fishing=ab.effects.find(e=>e.e==='frontier'&&e.action==='fdn:fishBait');if(fishing?.e==='frontier'&&g.cards[fishing.n??-1]?.tapped)return false;
  if(c.def.id==='say-its-name'&&g.players[pid].graveyard.filter(id=>g.cards[id].def.id==='say-its-name').length<3)return false;
  if(ab.mshBoast&&g.players[pid].graveyard.reduce((n,id)=>n+blackSymbols(g.cards[id]),0)<15)return false;
  if(c.def.id==='ronin-shadow-stalker'&&ab.cost.sacOther&&!g.battlefield.some(id=>g.cards[id].attachedTo===c.id&&g.cards[id].def.subtypes?.includes('Equipment')))return false;
  if(ab.evidence&&!canEvidence(g,pid,ab.evidence,c.zone==='graveyard'?c.id:undefined))return false;
  if(ab.roomDoor===undefined&&ab.special&&g.active!==pid&&mkmStatic(g,g.active,'watchdog').length)return false;
  if (ab.fromGraveyard ? c.zone !== 'graveyard' || c.owner !== pid : ab.fromHand ? c.zone !== 'hand' || c.owner !== pid : c.zone !== 'battlefield' || c.controller !== pid) return false;
  if (ab.sorcery && !sorceryTiming(g, pid)) return false;
  if(ab.mshStack&&!g.stack.some(s=>s.controller===pid&&s.kind!=='spell'&&!s.manaAbility&&g.cards[s.cardId].def.types.includes(ab.mshStack==='artifact'?'Artifact':'Creature')))return false;
  if(ab.finStack&&!g.stack.some(s=>s.controller===pid&&(s.kind==='trigger'||s.kind==='activated')&&!s.effects.some(e=>e.e==='fin'&&e.action==='copyAbility')))return false;
  if(ab.levelUp&&(c.classLevel??1)!==ab.levelUp.from)return false;
  if(ab.cost.blight&&!hasBlightBody(g,pid))return false;
  if(ab.effects.some(e=>e.e==='ecl'&&e.action==='kirol')&&!g.stack.some(s=>s.kind==='trigger'&&s.controller===pid))return false;
  if(ab.cost.discardFilter&&!g.players[pid].hand.some(id=>matches(g,ab.cost.discardFilter,g.cards[id],pid)))return false;
  if(ab.removeCounter?.any&&counterTotal(c)<ab.removeCounter.n)return false;
  if(ab.removeCounter&&!ab.removeCounter.any){const {n,fromCreature}=ab.removeCounter;if(fromCreature?!g.battlefield.some(id=>g.cards[id].controller===pid&&isCreature(g.cards[id])&&g.cards[id].counters>=n):(c.charge??c.counters)<n)return false;}
  if(ab.sacN&&sacCandidates(g,pid,ab.sacN.filter,c.id).length<ab.sacN.n)return false;
  if(ab.frontierRemoveLoot&&(c.frontierMarks?.loot??0)<ab.frontierRemoveLoot)return false;
  if (ab.oncePerTurn && c.usedThisTurn.includes(1000 + idx)) return false;
  if(ab.powerUp&&(g.players[pid].mshNoPowerTurn===g.turn||(c.exhausted??[]).filter(i=>i===idx).length>=1+mshStatic(g,pid,'extraPowerUp').length))return false;
  if (!ab.powerUp&&ab.oncePerGame && c.exhausted?.includes(idx)&&!(ab.bdExhaust&&ignoreExhaust(g,pid))) return false;
  if (ab.cost.loyalty !== undefined) {
    // 忠誠異能：法術時機、每回合一次、忠誠要夠扣
    const instantOk = !!(g.loyaltyInstant && g.loyaltyInstant.pid === pid && g.loyaltyInstant.turn === g.turn && c.def.subtypes?.includes('Jace'));
    if ((!sorceryTiming(g, pid) && !instantOk) || c.usedThisTurn.includes(LOYALTY_USED)) return false;
    if (ab.cost.loyalty < 0 && (c.loyalty ?? 0) < -ab.cost.loyalty) return false;
  }
  if(ab.effects.some(e=>e.e==='tla'&&e.action==='kataraX')&&!canPayCost(g,pid,parseCost(''),undefined,false,undefined,false,1))return false;
  if(ab.effects.some(e=>e.e==='tla'&&e.action==='zeiLoot')&&!g.players[pid].hand.length)return false;
  if(ab.effects.some(e=>e.e==='tla'&&e.action==='boomerang')){const host=c.attachedTo!=null?g.cards[c.attachedTo]:undefined;if(!host||host.controller!==pid||host.tapped||(host.sick&&!hasKw(g,host,'haste')))return false;}
  if(ab.bdForage&&!validForage(g,pid,forageOptions(g,pid).defaults))return false;
  if(ab.bdRemove&&(c.eclCounters?.[ab.bdRemove]??0)<1)return false;
  if(ab.bdExile&&g.players[pid].graveyard.filter(id=>id!==c.id&&matches(g,ab.bdExile!.filter,g.cards[id],pid)).length<(ab.bdExile.n??0))return false;
  if(ab.bdSacAny&&!g.battlefield.some(id=>g.cards[id].controller===pid&&matches(g,ab.bdSacAny,g.cards[id],pid)))return false;
  if (ab.cond && !checkCond(g, ab.cond, pid, c.id, [])) return false;
  if (ab.cost.crew !== undefined && crewChoice(g, pid, c, ab.cost.crew) == null) return false;
  if (ab.cost.tap) {
    if (c.tapped) return false;
    if (isCreature(c) && c.sick && !hasKw(g, c, 'haste')&&!mshStatic(g,pid,'activateHaste').length) return false;
  }
  if(ab.frontierMode!==undefined&&c.frontierMarks?.['porridge'+ab.frontierMode])return false;
  if (ab.cost.life && !frontierCanPayLife(g,pid,ab.cost.life)) return false;
  if (ab.cost.discard && g.players[pid].hand.length<ab.cost.discard) return false;
  if (ab.duringYourTurn && g.active !== pid) return false;
  if (ab.cost.tapN && !tapNChoices(g, pid, ab.cost.tapN.filter, ab.cost.tapN.n, c.id)) return false;
  if (ab.cost.sacOther && sacCandidates(g, pid, ab.cost.sacOther, c.id).length === 0) return false;
  if (ab.cost.craft && craftMaterials(g, pid, ab.cost.craft, c.id, ab.cost.craftCount) == null) return false;
  if (ab.cost.mana) {
    const cost = parseCost(ab.cost.mana);
    if(ab.special&&c.hidden?.id==='fugitive-codebreaker')cost.generic=Math.max(0,cost.generic-g.players[pid].graveyard.filter(id=>g.cards[id].def.types.some(t=>t==='Instant'||t==='Sorcery')).length);
    if(ab.xMana)cost.generic+=ab.xMana*(ab.xMin??0);
    if (ab.isEquip) {
      let best = 0;
      for (const id of g.battlefield) {
        const t = g.cards[id];
        if (t.controller === pid && t.id !== c.id && isCreature(t)) best = Math.max(best, t.def.equipDiscount ?? 0);
      }
      if (c.def.equip?.costLessPerCounter) {
        for (const id of g.battlefield) {
          const t = g.cards[id];
          if (t.controller === pid && isCreature(t)) best = Math.max(best, t.counters);
        }
      }
      cost.generic = Math.max(0, cost.generic - best-(c.finCopyEquipDiscount?2:0));
    }
    if (ab.powerUp && c.enteredTurn === g.turn) Object.assign(cost, reduceCost(cost, parseCost(c.def.cost)));
    if(ab.powerUp)cost.generic=Math.max(0,cost.generic-3*mshStatic(g,pid,'powerUpDiscount').filter(s=>s.id!==c.id&&isCreature(c)).length);
  frontierAbilityCost(g,c,ab,cost);if(ab.roomDoor!==undefined)cost.generic=Math.max(0,cost.generic-frontierStatic(g,pid,'dsk:unlockDiscount').length);
  cost.generic=Math.max(0,cost.generic-tokenAbilityReduction(g,c));
  if(c.def.types.includes('Artifact')&&mkmStatic(g,pid,'gadgetDiscount').length)cost.generic=Math.max(cost.W+cost.U+cost.B+cost.R+cost.G+cost.C+(cost.hyb?.length??0)>0?0:1,cost.generic-mkmStatic(g,pid,'gadgetDiscount').length);
    if(ab.costLessPer) cost.generic=Math.max(0,cost.generic-countMatching(g,ab.costLessPer,pid));
    const reserved=ab.bdTapMana?g.battlefield.filter(id=>id!==c.id&&g.cards[id].controller===pid&&isCreature(g.cards[id])&&!g.cards[id].tapped).slice(0,cost.generic):ab.cost.tapN?(tapNChoices(g,pid,{...ab.cost.tapN.filter,...(ab.cost.tap?{other:true}:{})},ab.cost.tapN.n,c.id)??[]):[];
    const bdNormal=ab.bdTapMana&&canPayCost(g,pid,cost,ab.cost.tap?c.id:undefined,false,{...c.def,eclAbilityPayment:true});
    if(ab.bdTapMana)cost.generic=Math.max(0,cost.generic-reserved.length);
    for(const id of reserved)g.cards[id].tapped=true;
    const canPay=canPayCost(g, pid, cost, ab.cost.tap ? c.id : undefined,false,{...c.def,eclAbilityPayment:true,foundation:{...c.def.foundation,unlockPayment:ab.roomDoor!==undefined},faceUpPayment:!!ab.special&&ab.roomDoor===undefined,fin:ab.isEquip?{...c.def.fin,equipment:'equipPayment'}:c.def.fin},false,ab.waterbend);
    for(const id of reserved)g.cards[id].tapped=false;
    if(!canPay&&!bdNormal)return false;
  }
  if (ab.waterbend && !ab.cost.mana && !canPayCost(g,pid,parseCost(''),ab.cost.tap?c.id:undefined,false,{...c.def,eclAbilityPayment:true,foundation:{...c.def.foundation,unlockPayment:ab.roomDoor!==undefined},faceUpPayment:!!ab.special&&ab.roomDoor===undefined,fin:ab.isEquip?{...c.def.fin,equipment:'equipPayment'}:c.def.fin},false,ab.waterbend)) return false;
  if (!hasTargetsAvailable(g, ab.targets ?? [], pid, c.id)) return false;
  return true;
}

// ------------------------------------------------------------
// 可執行的動作
// ------------------------------------------------------------
export interface PlayOption {
  kind: 'play' | 'cast' | 'activate';
  card: number;
  ability?: number;
  mode?: number;
  specs: TargetSpec[];
  sacFilter?: Filter;
  label: string;
  /** 冒險或返照 */
  alt?: CastAlt;
  /** 施放時的效果（AI 用） */
  effects?: Effect[];
  /** X 咒語：目前付得起的最大 X */
  maxX?: number;
}

/** X 咒語目前付得起的最大 X（不是 X 咒語回傳 undefined） */
export function maxXFor(g: GameState, pid: PID, c: Card, mode?: number, alt?: CastAlt): number | undefined {
  const def = castDef(c.def, alt);
  if(c.eclCast?.free)return 0;
  if(def.ecl?.blightX)return Math.max(0,...g.battlefield.filter(id=>g.cards[id].controller===pid&&isCreature(g.cards[id])).map(id=>stats(g,g.cards[id]).t));
  if (!parseCost(def.spell?.modes?.[mode ?? 0]?.cost ?? def.cost).x) return undefined;
  let x = 0;
  while (x < 20 && canPayCost(g, pid, spellCost(g, c, pid, mode, undefined, alt, x + 1), undefined, !!def.convoke, def, c.zone === 'hand' && !c.token, c.waterCastBy!==undefined ? manaValue(def) : def.spell?.modes?.[mode??0]?.waterbend ?? def.waterbend)) x++;
  return x;
}

export function castableCards(g: GameState, pid: PID): Card[] {
  const p = g.players[pid];
  const out = p.hand.map((id) => g.cards[id]);
  for(const c of Object.values(g.cards))if(c.zone!=='hand'&&foundationPermission(g,pid,c)&&!out.some(x=>x.id===c.id))out.push(c);
  for (const id of p.exile) {
    const c = g.cards[id];
    if ((c.playableTurn === g.turn && c.playableBy === pid) || c.onAdventure || c.airbent || (c.playableBy===pid && (c.playableUntil??-1)>=g.turn)) out.push(c);
  }
  for (const id of p.graveyard) {
    const c = g.cards[id];
    if (c.def.meadow?.graveSacCast||osteoCast(g,pid,c)||festivalCast(g,pid,c)||finGraveCast(g,pid,c)||graveCastAllowed(g,pid,c) || (isCreature(c)&&ninjaGraveSneak(g,pid)) || castAlts(g,pid,c).some(a=>a==='flashback'||a==='adventure') || c.def.harmonize || (c.def.mayhem && c.discardedTurn === g.turn)) out.push(c);
  }
  for (const id of p.exile) {
    const c = g.cards[id];
    if ((c.plottedTurn !== undefined && c.plottedTurn < g.turn) || (c.warpExiled !== undefined && c.warpExiled < g.turn)) out.push(c);
  }
  const top=g.cards[p.library[0]]; if(top && castAlts(g,pid,top).length) out.push(top);
  // 被對手的手牌放逐、在條件成立時可以施放的牌（例如 Null Summoner）
  for (const q of g.players) {
    for (const id of q.exile) {
      const c = g.cards[id];
      if (!out.includes(c)&&((c.linkedCast && c.linkedCast.by === pid && checkCond(g, c.linkedCast.cond, pid, undefined, []))||eclPermission(g,pid,c))) out.push(c);
    }
  }
  return out;
}

export function canPlayLand(g: GameState, pid: PID): boolean {
  return sorceryTiming(g, pid) && g.players[pid].landsPlayed < 1 + extraLandDrops(g, pid) + (g.players[pid].extraLandsThisTurn ?? 0);
}

export function castOptionsFor(g: GameState, pid: PID, c: Card): PlayOption[] {
  const out: PlayOption[] = [];
  if (isLand(c)) {
    if(c.def.adventure)out.push(...castOptionsAs(g,pid,c,'adventure'));
    if (!c.frontierMarks?.spellsOnly&&(c.zone !== 'graveyard'||finGraveCast(g,pid,c)) && canPlayLand(g, pid)) out.push({ kind: 'play', card: c.id, specs: [], label: `打出 ${displayName(c.def)}` });
    if (c.def.cycling && c.zone === 'hand' && c.owner === pid) out.push(...castOptionsAs(g, pid, c, 'cycle'));
    if (c.def.plot && c.zone === 'hand' && c.owner === pid) out.push(...castOptionsAs(g, pid, c, 'plot'));
    return out;
  }
  for (const alt of castAlts(g, pid, c)) out.push(...castOptionsAs(g, pid, c, alt));
  return out;
}

function castOptionsAs(g: GameState, pid: PID, c: Card, alt: CastAlt | undefined): PlayOption[] {
  const def = castDef(c.def, alt);
  const out: PlayOption[] = [];
  if(campusCastBlocked(g,pid))return out;
  if(pid!==g.active&&mshStatic(g,g.active,'ownTurnSilence').length)return out;
  if (alt === 'cycle') {
    if (!canPayCost(g, pid, parseCost(def.cost))) return out;
    const search = c.def.cycling?.search;
    return [{ kind: 'cast', card: c.id, specs: [], alt, effects: cycleEffects(c.def), label: `${search ? '尋地循環' : '循環'} ${def.cost}` }];
  }
  if (alt === 'plot'||alt==='plotTop') {
    if (!sorceryTiming(g, pid) || !canPayCost(g, pid, spellCost(g,c,pid,undefined,undefined,alt))) return out;
    return [{ kind: 'cast', card: c.id, specs: [], alt, effects: [], label: `預謀 ${def.cost}` }];
  }
  if(frontierStatic(g,0,'highNoon').length+frontierStatic(g,1,'highNoon').length&&g.players[pid].spellsThisTurn>=1)return out;
  if (alt === 'plotted' && !sorceryTiming(g, pid)) return out;
  if (alt!=='sneak'&&alt!=='sneakGranted' && !instantSpeed(def) && !frontierStatic(g,pid,'fdn:allFlash').length && !(frontierStatic(g,pid,'blb:noncreatureFlash').length&&!def.types.includes('Creature')) && !mshCosmicFlash(g,pid) && !(def.flashCond && checkCond(g,def.flashCond,pid,c.id,[])) && !sorceryTiming(g, pid)) return out;
  if(alt==='campusFree'&&!campusFree(g,pid,c))return out;
  if (c.def.castCond && !checkCond(g, c.def.castCond, pid, c.id, [])) return out;
  const fc=foundationExtraCosts(g,pid,c,alt);if(fc&&fc.ids.length<fc.n)return out;
  if(def.fin?.stackTarget&&!finStackChoices(g,pid,false).length)return out;
  if(c.def.ecl?.behold&&!c.def.ecl.behold.tax&&!c.def.ecl.behold.optional&&!canBehold(g,pid,c,alt))return out;
  if(def.id==='demand-answers'&&!g.players[pid].hand.some(id=>id!==c.id)&&!g.battlefield.some(id=>g.cards[id].controller===pid&&g.cards[id].def.types.includes('Artifact')))return out;
  if (def.addCost?.life && g.players[pid].life < def.addCost.life) return out;
  if (def.addCost?.sac && sacCandidates(g, pid, def.addCost.sac).length === 0) return out;
  if (def.addCost?.discard && g.players[pid].hand.filter((id) => id !== c.id).length < def.addCost.discard) return out;
  const n = def.meadow?.campusVariable==='graveSpellsX'?g.players[pid].graveyard.filter(id=>g.cards[id].def.types.some(t=>t==='Instant'||t==='Sorcery')).length+1:def.ecl?.variableTargets?g.battlefield.filter(id=>def.id==='doppelgang'||isCreature(g.cards[id])).length+1:modeCount(def);
  for (let m = 0; m < n; m++) {
    if(def.spell?.modes?.[m]?.foundationRequireDelirium&&new Set(g.players[pid].graveyard.flatMap(id=>g.cards[id].def.types)).size<4)continue;
    if(def.spell?.modes?.[m]?.cond&&!checkCond(g,def.spell.modes[m].cond!,pid,c.id,[]))continue;
    const mode = def.spell?.modes||def.ecl?.variableTargets ? m : undefined;
    const stackKinds=def.spell?.modes?.[m]?.frontierStackTargets??(def.frontierStack?[def.frontierStack]:[]);if(stackKinds.some(k=>!frontierStackChoices(g,pid,k).length))continue;
    if(def.frontier?.distribute===3&&(m===0||m>3))continue;
    if(def.frontier?.variableTargets&&m>g.battlefield.filter(id=>g.cards[id].controller===pid&&isCreature(g.cards[id])&&(def.frontier?.variableTargets!=='graceful'||matches(g,{enchanted:true},g.cards[id],pid))).length)continue;
    if(def.id==='demand-answers'&&m===0&&!g.players[pid].hand.some(id=>id!==c.id))continue;
    if(def.fin?.returnLandCost&&mode===1&&!g.battlefield.some(id=>g.cards[id].controller===pid&&isLand(g.cards[id])))continue;
    if((def.spell?.modes?.[mode??0]?.blight||def.addCost?.blight||def.ecl?.blightX)&&!hasBlightBody(g,pid))continue;
    const specs = campusTargets(g,pid,c,def,castTargetSpecs(def, mode),mode);
    if (!hasTargetsAvailable(g, specs, pid, c.id)) continue;
    const msac = alt==='bargain'?{or:[{type:'Artifact' as const},{type:'Enchantment' as const},{token:true}]}:def.spell?.modes?.[m]?.sac;
    if (msac && sacCandidates(g, pid, msac).length === 0) continue;
    const cost = spellCost(g, c, pid, mode, def.id==='fate-of-the-sun-cryst'?g.battlefield.filter(id=>isCreature(g.cards[id])&&g.cards[id].tapped).slice(0,1).map(c=>({c})):undefined, alt,def.id==='doppelgang'||def.meadow?.campusVariable==='graveSpellsX'?mode??0:0);
  const tapper = alt === 'harmonize' ? harmonizeTapper(g, pid)?.id : undefined;
    if (!canPayCost(g, pid, cost, tapper, !!def.convoke, def, c.zone === 'hand' && !c.token, c.waterCastBy!==undefined ? manaValue(def) : def.spell?.modes?.[mode??0]?.waterbend ?? def.waterbend)) continue;
    const name = alt === 'adventure' ? (def.zh ?? def.name) : displayName(def);
    out.push({
      kind: 'cast',
      card: c.id,
      mode,
      specs,
      sacFilter: (alt==='sneak'||alt==='sneakGranted')?{type:'Creature',ctrl:'you',unblocked:true}:msac ?? def.addCost?.sac,
      alt,
      effects: spellEffects(def, mode),
      maxX: def.meadow?.campusLifeX?g.players[pid].life:def.id==='doppelgang'||alt === 'plotted' || alt === 'disguise' ? undefined : maxXFor(g, pid, c, mode, alt),
      label:
        alt==='titaniaMana'?`另付{2}施放：${name}`:alt==='teamwork'?`Teamwork ${def.msh?.teamwork}：${def.spell?.modes?.[m]?.text??name}`:def.ecl?.variableTargets?`選${m}個目標：${name}`:alt==='evidence'?`蒐證${def.mkm?.optionalEvidence}：${name}`:alt==='evidenceFree'?`蒐證10取代法力費用：${name}`:alt==='evoke'?`呼魂 ${def.cost}：${name}`:(alt==='sneak'||alt==='sneakGranted') ? `潛行 ${def.cost}：收回未被阻擋的攻擊者` : alt === 'adventure'
          ? `${c.def.mkm?.split?'施放另一半':'冒險'}：${name}`
          : alt === 'flashback'
            ? `返照：${name}`
            : alt === 'back'
              ? `施放背面：${def.name}`
            : alt === 'free'
              ? `免費施放 ${name}`
            : alt === 'warp'
              ? `折躍 ${def.cost}`
            : alt === 'gift' ? '承諾贈禮' : alt==='forage'?'掘食施放':alt==='graveCost'?'從墳墓場支付額外費用施放'
          : alt === 'offspring'
              ? `子嗣：施放 ${name}（${def.cost}）`
            : alt === 'mayhem'
              ? `騷亂：從墳墓場施放 ${name}`
            : alt === 'harmonize'
              ? `和聲：從墳墓場施放 ${name}`
            : alt === 'prepared'
              ? `施放準備的咒語：${def.zh ?? def.name}${def.spell?.modes ? `（${def.spell.modes[m].text}）` : ''}`
            : alt === 'disguise'
              ? `偽裝：面朝下施放 {3}`
            : alt === 'plotted'
              ? `免費施放（預謀）${def.spell?.modes ? `：${def.spell.modes[m].text}` : ''}`
            : def.spell?.modes
              ? def.spell.modes[m].text
              : `施放 ${name}`,
    });
  }
  return out;
}

/** 戰鬥中不能施放咒語或起動異能（例如「戰鬥中，所有玩家都不能施放咒語」） */
/** 堆疊上有切割（split second）咒語時，不能施放咒語或起動異能 */
export function splitSecondLocked(g: GameState): boolean {
  return g.stack.some((it) => {
    if (it.kind !== 'spell') return false;
    const c = g.cards[it.cardId];
    if (!c) return false;
    if (c.def.splitSecond) return true;
    if (!c.def.types.some((t) => t === 'Instant' || t === 'Sorcery')) return false;
    return g.battlefield.some((id) => {
      const s = g.cards[id];
      return s.controller === it.controller && abilitiesOf(g, s).some((a) => a.kind === 'static' && a.splitSecondSpells);
    });
  });
}

export function combatLocked(g: GameState): boolean {
  if (splitSecondLocked(g)) return true;
  if (!g.phase.startsWith('combat')) return false;
  return g.battlefield.some((id) => abilitiesOf(g, g.cards[id]).some((a) => a.kind === 'static' && a.noCombatActions));
}

export function playOptions(g: GameState, pid: PID): PlayOption[] {
  const out: PlayOption[] = [];
  if (combatLocked(g)) return out;
  for (const c of castableCards(g, pid)) out.push(...castOptionsFor(g, pid, c));
  const gyAbility = g.players[pid].graveyard.filter((id) => abilitiesFor(g,g.cards[id]).some((a) => a.fromGraveyard));
  const handAbility = g.players[pid].hand.filter((id) => abilitiesFor(g,g.cards[id]).some((a) => a.fromHand));
  for (const id of [...g.battlefield, ...gyAbility, ...handAbility]) {
    const c = g.cards[id];
    if (c.zone === 'battlefield' ? c.controller !== pid : c.owner !== pid) continue;
    if (c.prepared && c.zone === 'battlefield') out.push(...castOptionsAs(g, pid, c, 'prepared'));
    const abs = abilitiesFor(g, c);
    for (let i = 0; i < abs.length; i++) {
      if (!canActivate(g, pid, c, i)) continue;
      out.push({
        kind: 'activate',
        card: c.id,
        ability: i,
        specs: abs[i].targets ?? [],
        sacFilter: abs[i].cost.sacOther,
        label: abs[i].label,
        ...(abs[i].xLoyalty ? { maxX: c.loyalty ?? 0 } : abs[i].xMana?{maxX:finAbilityMaxX(g,pid,c,i)}:{}),
      });
    }
  }
  return out;
}

export function sacChoices(g: GameState, pid: PID, f: Filter, sourceId?: number): number[] {
  return sacCandidates(g, pid, f, sourceId).map((c) => c.id);
}

// ------------------------------------------------------------
// 執行動作（回傳錯誤訊息或 null）
// ------------------------------------------------------------
export function performAction(g: GameState, pid: PID, a: PriorityAction): string | null {
  g.eclEventGroup=g.nextSid++;
  if ((a.type === 'cast' || a.type === 'activate') && combatLocked(g)) return splitSecondLocked(g) ? '切割咒語在堆疊上時，不能施放咒語或起動異能' : '戰鬥中不能施放咒語或起動異能';
  if (a.type === 'play') return doPlay(g, pid, a.card);
  if (a.type === 'cast') return doCast(g, pid, a);
  if (a.type === 'activate') return doActivate(g, pid, a);
  return null;
}

function inCastableZone(g: GameState, pid: PID, c: Card, alt?: CastAlt): boolean {
  if(isLand(c)&&foundationPermission(g,pid,c))return true;
  if (isLand(c)) return (alt==='adventure'&&castAlts(g,pid,c).includes(alt))||(c.zone==='graveyard'&&finGraveCast(g,pid,c))||(c.zone==='library'&&castAlts(g,pid,c).length>0) || (c.zone === 'hand' && c.owner === pid) || (c.zone === 'exile' && (c.onAdventure&&c.owner===pid||(c.playableTurn === g.turn && c.playableBy === pid)||eclPermission(g,pid,c)));
  return castAlts(g, pid, c).includes(alt);
}

function consumeRaphaelPermission(g:GameState,c:Card){
  const permission=c.raphaelPermissions?.find(p=>p.turn===g.turn);
  if(permission)for(const card of Object.values(g.cards))if(card.raphaelPermissions?.some(p=>p.source===permission.source)){
    card.raphaelPermissions=card.raphaelPermissions.filter(p=>p.source!==permission.source);
    if(!card.raphaelPermissions.some(p=>p.turn===g.turn))card.playableTurn=undefined;
  }
}
function doPlay(g: GameState, pid: PID, id: number): string | null {
  const c = g.cards[id];
  if (!c || !isLand(c) || !inCastableZone(g, pid, c)) return '無法打出這張地';
  if(c.frontierMarks?.spellsOnly)return '此效果僅允許施放咒語';
  if (!canPlayLand(g, pid)) return '現在不能打出地';
  consumeRaphaelPermission(g,c);
  if(c.zone==='graveyard')foundationPayExtras(g,pid,c,{type:'cast',card:c.id,targets:[]});
  g.players[pid].landsPlayed++;
  log(g, `打出 ${cardName(c)}`, pid, 'cast');
  enterBattlefield(g, c, pid);
  return null;
}

function doCycle(g: GameState, pid: PID, c: Card,x=0): string | null {
  if (!c.def.cycling || c.zone !== 'hand' || c.owner !== pid) return '無法循環這張牌';
  const cost = parseCost(c.def.cycling.cost);
  cost.generic+=(cost.x??0)*x;
  if (!payCost(g, pid, cost)) return `法術力不足（需要 ${costToString(cost)}）`;
  const label = c.def.cycling.search ? '尋地循環' : '循環';
  const cycleTriggers=(c.def.abilities??[]).filter(ab=>ab.kind==='trigger'&&ab.frontierEvent==='dft:cycleSelf');
  log(g, `${label} ${cardName(c)}`, pid, 'cast');
  discard(g, c);
  g.stack.push({
    sid: g.nextSid++,
    kind: 'activated',
    controller: pid,
    cardId: c.id,
    targets: [],
    targetSpecs: [],
    x,
    effects: cycleEffects(c.def),
    text: c.def.cycling.search ? '搜尋一張地牌放到手上' : '抓一張牌',
  });
  for(const ability of cycleTriggers)if(ability.kind==='trigger')g.pending.push({source:c.id,controller:pid,abilityIndex:-240,ability,ev:{type:'frontier',action:'bdCycle',card:c.id,player:pid,amount:x}});
  show(g, { kind: 'activated', player: pid, card: c.id, targets: [], text: label });
  return null;
}

/** 施放已準備生物附帶咒語的複製：複製品是一張暫時放在手上的衍生物，照一般流程施放 */
function doCastPrepared(g: GameState, pid: PID, c: Card, a: Extract<PriorityAction, { type: 'cast' }>): string | null {
  if (c.zone !== 'battlefield' || c.controller !== pid || !c.prepared || !c.def.prepare) return '這個生物沒有準備好';
  const cp = newCard(g, castDef(c.def, 'prepared'), pid, true);
  cp.zone = 'hand';
  g.players[pid].hand.push(cp.id);
  const err = doCast(g, pid, { ...a, card: cp.id, alt: undefined });
  if (err) {
    removeFromZone(g, cp);
    delete g.cards[cp.id];
    return err;
  }
  c.prepared = false;
  g.version++;
  return null;
}

function doPlot(g: GameState, pid: PID, c: Card, top=false): string | null {
  if ((top?c.zone!=='library'||g.players[pid].library[0]!==c.id||!frontierStatic(g,pid,'fblthpPlot').length:isLand(c)||(!c.def.plot && !c.def.foretell)||c.zone!=='hand') || c.owner !== pid) return '無法預謀這張牌';
  if (!sorceryTiming(g, pid)) return '只能在你的主要階段且堆疊為空時預謀';
  const cost = top?parseCost(c.def.cost):reduceCost(parseCost(c.def.plot??'{2}'),parseCost('{'+2*frontierStatic(g,pid,'aurlockDiscount').length+'}'));
  if (!payCost(g, pid, cost)) return `法術力不足（需要 ${costToString(cost)}）`;
  plotCard(g,c);
  if(c.def.foretell) c.foretellTurn=g.turn;
  log(g, `預謀 ${cardName(c)}（之後的回合可以免費施放）`, pid, 'cast');
  return null;
}

/** 效果結算中施放一張牌（例如「你可以施放那張牌」）：不受時機限制，仍須支付費用 */
export function castDuringResolution(g: GameState, pid: PID, cardId: number, targets: (TargetRef | null)[], free = false, mode?:number, sac?:number,extra:Partial<Extract<PriorityAction,{type:'cast'}>>={}): string | null {
  return doCast(g, pid, { ...extra,mode,sac,type: 'cast', card: cardId, targets, ignoreTiming: true },free,true);
}

function doCast(g: GameState, pid: PID, a: Extract<PriorityAction, { type: 'cast' }>,free=false,duringResolution=false): string | null {
  const c = g.cards[a.card];
  const alt = a.alt;
  if (c && alt === 'cycle') return doCycle(g, pid, c,a.x??0);
  if (c && (alt === 'plot'||alt==='plotTop')) return doPlot(g, pid, c,alt==='plotTop');
  if(frontierStatic(g,0,'highNoon').length+frontierStatic(g,1,'highNoon').length&&g.players[pid].spellsThisTurn>=1)return 'High Noon：每回合至多施放一個咒語';
  if (c && alt === 'prepared') return doCastPrepared(g, pid, c, a);
  if(campusCastBlocked(g,pid))return '目前不能施放咒語';
  if(pid!==g.active&&mshStatic(g,g.active,'ownTurnSilence').length)return '對手回合中不能施放咒語';
  if (!c || (isLand(c)&&alt!=='adventure') || (!duringResolution && !inCastableZone(g, pid, c, alt))) return '無法施放這張牌';
  const def = castDef(c.def, alt);
  if ((alt === 'plotted' || (alt!=='sneak'&&alt!=='sneakGranted' && !instantSpeed(def) && !frontierStatic(g,pid,'fdn:allFlash').length && !(frontierStatic(g,pid,'blb:noncreatureFlash').length&&!def.types.includes('Creature')) && !mshCosmicFlash(g,pid) && !(def.flashCond && checkCond(g,def.flashCond,pid,c.id,[])))) && !sorceryTiming(g, pid) && !a.ignoreTiming) return '只能在你的主要階段且堆疊為空時施放';
  if(alt==='campusFree'&&!campusFree(g,pid,c))return '目前不能免費施放';
  if(c.def.meadow?.campusLifeX&&((a.x??0)<0||(a.x??0)>g.players[pid].life))return '生命不足';
  if (c.def.castCond && !checkCond(g, c.def.castCond, pid, c.id, [])) return '不滿足施放此咒語的條件';
  const mode = def.ecl?.variableTargets?Math.max(0,Math.min(def.meadow?.campusVariable==='graveSpellsX'?g.players[pid].graveyard.length:g.battlefield.length,a.mode??0)):def.spell?.modes ? Math.max(0, Math.min(def.spell.modes.length - 1, a.mode ?? 0)) : undefined;
  if(def.spell?.modes?.[mode??0]?.foundationRequireDelirium&&new Set(g.players[pid].graveyard.flatMap(id=>g.cards[id].def.types)).size<4)return '需要譫妄';
  if(def.spell?.modes?.[mode??0]?.cond&&!checkCond(g,def.spell.modes[mode??0].cond!,pid,c.id,[]))return '不滿足模式條件';
  const eaterLife=c.zone==='exile'&&frontierStatic(g,pid,'dsk:valgavothPlay').some(s=>c.frontierMarks?.valgavothLink===s.tmtLinkKey)?manaValue(def)+(a.x??0):0;if(eaterLife&&!frontierCanPayLife(g,pid,eaterLife))return '生命不足以施放';
  if(alt==='campusCasualty'&&a.sac!==undefined&&a.foundationCosts?.includes(a.sac))return '兩項犧牲費用不能使用同一永久物';
  const foundationErr=foundationCastError(g,pid,c,a);if(foundationErr)return foundationErr;
  const specs = campusTargets(g,pid,c,def,castTargetSpecs(def, mode),mode);
  const targets = specs.map((_, i) => a.targets?.[i] ?? null);
  const targetVersions=targets.map(t=>t&&'c' in t?g.cards[t.c]?.objectVersion??0:undefined);
  const err = validateTargets(g, specs, targets, pid, c.id);
  if (err) return err;
  const stackKinds=def.spell?.modes?.[mode??0]?.frontierStackTargets??(def.frontierStack?[def.frontierStack]:[]);
  const frontierSids=a.stackTargetSids??(a.stackTargetSid!==undefined?[a.stackTargetSid]:[]);
  if(stackKinds.some((kind,i)=>!frontierStackChoices(g,pid,kind).some(s=>s.sid===frontierSids[i])))return '請選擇合法的堆疊目標';
  const p = g.players[pid];
  const terrorLife=3*new Set(targets.flatMap(t=>t&&'c'in t&&g.cards[t.c].controller!==pid&&frontierStatic(g,g.cards[t.c].controller,'terrorCost').some(s=>s.id===t.c)?[t.c]:[])).size;
  const modeLife=(def.spell?.modes?.[mode??0]?.life??0)+terrorLife;
  if(modeLife && !frontierCanPayLife(g,pid,modeLife)) return '生命不足';
  let sacCard: Card | undefined;
  const sacF = alt==='bargain'?{or:[{type:'Artifact' as const},{type:'Enchantment' as const},{token:true}]}:(mode !== undefined ? def.spell?.modes?.[mode]?.sac : undefined) ?? def.addCost?.sac;
  if (sacF) {
    sacCard = a.sac != null ? g.cards[a.sac] : undefined;
    if (!sacCard || sacCard.zone !== 'battlefield' || sacCard.controller !== pid || !matches(g, sacF, sacCard, pid))
      return '請選擇要犧牲的永久物';
  }
  const sneakReturn=(alt==='sneak'||alt==='sneakGranted')?(a.sac!==undefined?sneakAttackers(g,pid).find(c=>c.id===a.sac):sneakAttackers(g,pid)[0]):undefined;
  if((alt==='sneak'||alt==='sneakGranted')&&!sneakReturn)return '潛行只能在宣告阻擋後收回未被阻擋的己方攻擊生物';
  let discardCard: Card | undefined;
  if (def.addCost?.discard||def.meadow?.campusDiscardMode&&(mode??0)===0) {
    discardCard = a.discard != null ? g.cards[a.discard] : undefined;
    if (!discardCard) {
      // 沒有指定時，自動選擇最不重要的牌（非地優先棄法術力值低的；全是地就棄地）
      const hand = p.hand.filter((id) => id !== c.id).map((id) => g.cards[id]);
      hand.sort((x, y) => Number(isLand(y)) - Number(isLand(x)) || manaValue(x.def) - manaValue(y.def));
      discardCard = hand[0];
    }
    if (!discardCard || discardCard.zone !== 'hand' || discardCard.owner !== pid || discardCard.id === c.id)
      return '請選擇要棄掉的牌';
  }
  if (def.addCost?.life && !frontierCanPayLife(g,pid,def.addCost.life)) return '生命不足';
  const x = def.meadow?.campusLifeX?Math.max(0,Math.floor(a.x??0)):def.id==='doppelgang'?(mode??0):(def.ecl?.blightX||parseCost(def.spell?.modes?.[mode ?? 0]?.cost ?? def.cost).x) ? Math.max(0, Math.floor(a.x ?? 0)) : undefined;
  if(def.meadow?.campusVariable==='graveSpellsX'&&(mode??0)>(x??0))return '目標數量不能超過X';
  const blightN=def.ecl?.blightX?(x??0):def.spell?.modes?.[mode??0]?.blight??def.addCost?.blight??0;
  const body=blightN>0?(a.blightCard!==undefined?g.cards[a.blightCard]:g.battlefield.map(id=>g.cards[id]).find(c=>c.controller===pid&&isCreature(c)&&canReceiveCounters(g,c))):undefined;
  if(blightN>0&&(!body||body.zone!=='battlefield'||body.controller!==pid||!isCreature(body)||!canReceiveCounters(g,body)))return '請選擇枯萎生物';
  if(def.ecl?.blightX&&(x??0)>(maxXFor(g,pid,c,mode,alt)??0))return 'X超過最大防禦力';
  const req=def.ecl?.behold, needsBehold=req&&(!req.flashbackOnly||alt==='flashback');
  let beheld:number[]=a.beheld??[];
  if(needsBehold&&!a.beheld){const options=beholdOptions(g,pid,c,alt);beheld=options.slice(0,req.n);if(!validBehold(g,c,beheld,pid,alt)&&!req.sub){const subs=options.flatMap(id=>g.cards[id].def.subtypes??[]);for(const sub of subs){const pick=options.filter(id=>matches(g,{sub},g.cards[id],pid)).slice(0,req.n);if(validBehold(g,c,pick,pid,alt)){beheld=pick;break;}}}}
  if(needsBehold&&beheld.length&&!validBehold(g,c,beheld,pid,alt))return 'Behold選擇不合法';
  if(needsBehold&&!beheld.length&&!req.tax&&!req.optional)return '缺少Behold費用';
  const beholdType=a.beholdType??beheld.flatMap(id=>g.cards[id].def.subtypes??[]).find(sub=>beheld.every(id=>matches(g,{sub},g.cards[id],pid)));
  if(req&&!req.sub&&beheld.length&&(!beholdType||!beheld.every(id=>matches(g,{sub:beholdType},g.cards[id],pid))))return 'Behold生物類別不合法';
  const permission=c.eclCast;
  if((free||permission?.free)&&parseCost(def.cost).x&&(x??0)!==0)return '免費施放的X必須是0';
  if(permission?.mode==='dissident'&&eligibleCounterTotal(g,pid)<3)return '需要從你的生物移除三個指示物';
  const dissidentCosts=a.eclCounterSources??(permission?.mode==='dissident'?defaultCounterSources(g,pid,3):[]);
  if(permission?.mode==='dissident'&&!validCounterSources(g,pid,dissidentCosts,3))return '移除指示物費用不合法';
  const finStack=def.fin?.stackTarget?finStackChoices(g,pid,false).find(s=>s.sid===a.stackTargetSid):undefined;
  if(def.fin?.stackTarget&&!finStack)return '請選擇合法的非生物咒語或異能';
  const returnLand=def.fin?.returnLandCost&&mode===1?(a.returnLand!==undefined?g.cards[a.returnLand]:g.battlefield.map(id=>g.cards[id]).find(c=>c.controller===pid&&isLand(c))):undefined;
  if(def.fin?.returnLandCost&&mode===1&&(!returnLand||returnLand.zone!=='battlefield'||returnLand.controller!==pid||!isLand(returnLand)))return '請選擇收回的地';
  const noctisCost=c.zone==='graveyard'&&alt===undefined&&c.def.types.includes('Artifact')&&!!finStatic(g,pid,'noctisCast').length;
  if(noctisCost&&p.life<3)return '生命不足以支付Noctis費用';
  const allocationTotal=def.frontier?.distribute==='X'?x??0:def.frontier?.distribute;
  if(allocationTotal!==undefined){const n=targets.filter(Boolean).length;if((allocationTotal>0&&n===0)||(allocationTotal===0&&n!==0)||!a.distribution||a.distribution.length!==n||a.distribution.some(v=>!Number.isInteger(v)||v<1)||a.distribution.reduce((v,n)=>v+n,0)!==allocationTotal)return '指示物分配不合法';}
  const cost = free ? parseCost('') : spellCost(g, c, pid, mode, targets, alt, x ?? 0,a.foundationCosts??[]);
  if((free||permission?.free)&&def.spell?.modes?.[mode??0]?.cost)Object.assign(cost,reduceCost(parseCost(def.spell.modes[mode??0].cost),parseCost(def.cost)));
  if(needsBehold&&req.tax&&!beheld.length&&(free||permission?.free||canBehold(g,pid,c,alt)))cost.generic+=req.tax;

  const teamwork=alt==='teamwork'?teamworkPayment(g,pid,def.msh?.teamwork??0,a.teamworkTapped):[];
  if(!teamwork)return 'Teamwork的總力量不足';
  const evidenceN=alt==='evidenceFree'?10:alt==='evidence'?def.mkm?.optionalEvidence??0:def.mkm?.evidence===-1?targets.reduce((v,t)=>v+(t&&'c'in t?manaValue(g.cards[t.c].def):0),0):def.mkm?.evidence??0;
  const evidenceIds=evidencePayment(g,pid,evidenceN,a.evidenceCards,c.zone==='graveyard'?c.id:undefined);
  if(evidenceN&&!evidenceIds)return '墳墓場牌的總法力值不足以蒐證';

  if(def.id==='demand-answers'&&(mode??0)===0&&!p.hand.some(id=>id!==c.id))return '需要棄一張牌';
  if(def.id==='demand-answers'&&(mode??0)===0&&a.discard!==undefined&&(a.discard===c.id||!p.hand.includes(a.discard)))return '棄牌費用不合法';
  const schemes=eclStatic(g,pid,'conspire'),groups=a.conspireTapped??[],conspireIds=groups.flat();
  if(groups.length&&(def.types.includes('Creature')||groups.length>schemes.length||new Set(conspireIds).size!==conspireIds.length||groups.some(ids=>ids.length!==2||ids.some(id=>{const b=g.cards[id];return !b||b.zone!=='battlefield'||b.controller!==pid||b.tapped||!isCreature(b)||!colorsOf(b.def).some(col=>colorsOf(def).includes(col));}))))return '共謀費用不合法';
  for(const id of [...conspireIds,...teamwork])g.cards[id].tapped=true;
  const tapper = alt === 'harmonize' ? harmonizeTapper(g, pid) : null;
  const foundationTap=foundationExtraCosts(g,pid,c,alt);const foundationTapIds=foundationTap?.kind==='tap'?a.foundationCosts??foundationTap.ids.slice(0,foundationTap.n):[];for(const id of foundationTapIds)g.cards[id].tapped=true;
  const paid=payCost(g, pid, cost, tapper?.id, !!def.convoke, def, c.zone === 'hand' && !c.token, c.waterCastBy!==undefined ? manaValue(def) : def.spell?.modes?.[mode??0]?.waterbend ?? def.waterbend);
  for(const id of [...conspireIds,...teamwork,...foundationTapIds])g.cards[id].tapped=false;
  if(!paid)return `法術力不足（需要 ${costToString(cost)}）`;
  const tapGroup=g.mshTapGroup;g.mshTapGroup=g.nextSid++;for(const id of teamwork){tapCard(g,g.cards[id]);emit(g,{type:'msh',action:'teamworkTap',card:id,player:pid});}g.mshTapGroup=tapGroup;
  const foundationManaSources=(g.lastManaSourceIds??[]).slice(),campusPaid=g.lastManaPayment?.slice(),campusSpent=g.lastManaSpent??0;
  const caveMana=foundationManaSources.filter(id=>g.cards[id].def.subtypes?.includes('Cave')).length;
  if(eaterLife)frontierPayLife(g,pid,eaterLife);if(c.zone==='exile'&&alt==='free')frontierFlags(g,pid).warpedUsed=1;
  if(alt==='campusCasualty'&&a.foundationCosts===undefined){const cost=foundationExtraCosts(g,pid,c,alt);a.foundationCosts=cost?.ids.filter(id=>id!==a.sac).slice(0,1);}
  foundationPayExtras(g,pid,c,a);
  if(def.types.includes('Creature')&&def.subtypes?.includes('Dragon')&&foundationManaSources.some(id=>g.cards[id].def.id==='orb-of-dragonkind'))(c.frontierMarks??={}).orbHaste=1;
  c.mshTeamwork=alt==='teamwork';
  c.kicked=alt==='kicked';c.impendingPaid=alt==='impending';if(def.room)(c.frontierMarks??={}).castRoomDoor=alt==='roomRight'?1:0;
  c.frontierBargained=alt==='bargain'||!!(sacF&&c.def.text.startsWith('Bargain'));
  if(c.def.id==='faerie-fencing')(c.frontierMarks??={}).castFaerie=Number(g.battlefield.some(id=>g.cards[id].controller===pid&&matches(g,{sub:'Faerie'},g.cards[id],pid)));
  if(mshFlags(g,pid).freeRG&&isCreature(c)&&colorsOf(def).some(c=>c==='R'||c==='G'))mshFlags(g,pid).freeRG=0;
  for(const id of conspireIds)tapCard(g,g.cards[id]);
  if (tapper) {
    g.cards[tapper.id].tapped = true;
    log(g, `和聲：橫置 ${cardName(g.cards[tapper.id])}，費用減少 {${tapper.p}}`, pid);
  }
  c.mkmEvidence=false;if(evidenceN&&evidenceIds)payEvidence(g,pid,c,evidenceIds);
  if(def.id==='demand-answers'&&(mode??0)===0){const id=a.discard??p.hand.find(id=>id!==c.id);if(id!==undefined)discard(g,g.cards[id]);}
  c.manaPaid=campusPaid;
  for(const k of Object.keys(c.frontierMarks??{}))if(k.startsWith('cpUsedMana:')||k==='cpRebound')delete c.frontierMarks![k];
  (c.frontierMarks??={}).cpCaveMana=caveMana;for(const id of foundationManaSources)c.frontierMarks['cpUsedMana:'+id]=1;
  if(returnLand)moveCard(g,returnLand,'hand');
  if(noctisCost){loseLife(g,pid,3);(c.finMarks??={}).enterFinality=1;}
  c.eclBlightPaid=blightN>0;if(body)putMinusCounters(g,body,blightN);
  if(permission?.mode==='dissident')for(const payment of dissidentCosts)removeCounterKind(g.cards[payment.card],payment.kind);
  c.eclBeheld=beheld.slice();c.eclBeholdType=beholdType;if(needsBehold&&req.exile)for(const id of beheld)moveCard(g,g.cards[id],'exile');
  c.evokePaid=alt==='evoke';
  if(c.eclCast?.mode==='maralen'&&c.eclCast.source!==undefined)(p.eclMaralenUsed??=[]).push(c.eclCast.source);
  c.eclCast=undefined;
  consumeRaphaelPermission(g,c);
  c.manaSpent=campusSpent;
  if(!def.types.includes('Creature'))p.nextAffinity=0;
  if (alt === 'warp') g.voidThisTurn = true;
  const wl = wardLifeTax(g, pid, targets);
  if (wl) {
    log(g, `守護：支付${wl}點生命`, pid, 'life');
    loseLife(g, pid, wl);
  }
  payWardDiscard(g, pid, wardDiscardCount(g, pid, targets), c.id);
  payWardSac(g, pid, wardSacCount(g, pid, targets), c.id);
  if (def.addCost?.life) {
    frontierPayLife(g,pid,def.addCost.life);
  }
  if(modeLife) frontierPayLife(g,pid,modeLife);
  if(sneakReturn){moveCard(g,sneakReturn,'hand');c.sneakTurn=g.turn;}
  else c.sneakTurn=undefined;
  c.sneakFromGy=c.zone==='graveyard'&&!finGraveCast(g,pid,c)&&graveCastAllowed(g,pid,c)&&alt!=='sneak'&&alt!=='sneakGranted';
  if (discardCard) discard(g, discardCard);
  removeFromZone(g, c);
  c.castOrigin = c.zone;
  if(alt==='campusFree')frontierFlags(g,pid).cpFreeUsed=1;
  if(c.def.meadow?.campusLifeX)frontierPayLife(g,pid,a.x??0);
  if(c.zone==='graveyard'&&isCreature(c)&&frontierFlags(g,pid).cpTomb){frontierFlags(g,pid).cpTomb=0;(c.finMarks??={}).enterFinality=1;(c.frontierMarks??={}).cpVampire=1;}
  if(c.zone==='exile'&&isCreature(c)&&c.def.subtypes?.includes('Dinosaur')&&frontierStatic(g,pid,'lci:paleontologist').some(s=>s.campusLinked?.some(x=>x.id===c.id&&x.version===c.objectVersion)))(c.finMarks??={}).enterFinality=1;
  c.airbent = undefined;
  c.onAdventure = false;
  c.plottedTurn = undefined;
  if (alt === 'disguise') {
    c.hidden = c.def;
    c.def = def;
  }
  c.zone = 'stack';
  c.castFace=def;
  c.objectVersion=(c.objectVersion??0)+1;
  c.controller = pid;
  c.playableTurn = undefined;
  const modeText = mode !== undefined ? (def.ecl?.variableTargets?`（${mode}個目標）`:`（${def.spell!.modes![mode].text}）`) : '';
  g.stack.push({
    sid: g.nextSid++,
    kind: 'spell',
    bdSac:sacCard?{power:stats(g,sacCard).p,mana:manaValue(sacCard.def),vehicle:matches(g,{sub:'Vehicle'},sacCard,pid)}:undefined,
    distribution:a.distribution?.slice(),
    frontierStackSids:frontierSids.slice(),
    controller: pid,
    cardId: c.id,
    targets,
    targetSpecs: specs,
    targetVersions,
    effects: stackKinds.length?spellEffects(def,mode).map((e,i)=>e.e==='frontier'?{...e,n:frontierSids[i]}:e):finStack?spellEffects(def,mode).map(e=>e.e==='fin'&&e.action==='counterStack'?{...e,n:finStack.sid}:e):spellEffects(def, mode),
    text: def.text,
    modeIndex: mode,
    alt,
    x,
  });
  if(def.types.some(t=>t==='Instant'||t==='Sorcery')&&colorsOf(def).includes('R'))for(const id of foundationManaSources.filter(id=>g.cards[id].def.id==='pyromancers-goggles'))g.pending.push({source:id,controller:pid,abilityIndex:-122,ev:{type:'cast',card:c.id,player:pid,opponentTurn:g.active!==pid},ability:{kind:'trigger',on:'castAny',effects:[{e:'copySpell'}]}});
  for(let i=0;i<groups.length;i++)g.pending.push({source:c.id,controller:pid,abilityIndex:-30,ev:{type:'cast',card:c.id,player:pid,opponentTurn:g.active!==pid},ability:{kind:'trigger',on:'castAny',effects:[{e:'copySpell'}]}});
  show(g, { kind: 'spell', player: pid, card: c.id, targets });
  if(sacCard)(c.frontierMarks??={}).sacOutlaw=Number(matches(g,{outlaw:true},sacCard,pid));
  if (sacCard){if(sacCard.suspected)(c.mkmMarks??={}).sacSuspect=g.turn;sacrifice(g,sacCard);}
  if(alt==='campusCasualty')g.pending.push({source:c.id,controller:pid,abilityIndex:-315,ev:{type:'cast',card:c.id,player:pid,opponentTurn:g.active!==pid,bdSpell:{...g.stack[g.stack.length-1]}},ability:{kind:'trigger',on:'castAny',effects:[{e:'copySpell'}]}});
  p.spellsThisTurn++;
  if (def.types.includes('Instant') || def.types.includes('Sorcery')) p.instSorcThisTurn++;
  if (!def.types.includes('Creature')) p.noncreatureThisTurn = (p.noncreatureThisTurn ?? 0) + 1;
  if (p.nextSpellUncounterable) {
    p.nextSpellUncounterable = false;
    g.stack[g.stack.length - 1].uncounterable = true;
  }
  const how = alt === 'adventure' ? '施放冒險 ' : alt === 'flashback' ? '返照施放 ' : '施放 ';
  log(g, `${how}${alt === 'adventure' ? (def.zh ?? def.name) : displayName(def)}${x !== undefined ? `（X=${x}）` : ''}${modeText}${describeTargets(g, targets)}`, pid, 'cast');
  commitCrime(g,pid,c.id,targets,g.stack[g.stack.length-1].sid,frontierSids);
  emit(g, { type: 'cast', card: c.id, player: pid, opponentTurn: g.active !== pid });
  if (def.castEffects?.length) {
    g.stack.push({ sid: g.nextSid++, kind: 'trigger', controller: pid, cardId: c.id, targets: [], targetSpecs: [], effects: def.castEffects, text: '當你施放此咒語時' });
  }
  for (const t of targets) if (t && 'c' in t && g.cards[t.c].zone === 'battlefield') emit(g, { type: 'targeted', card: t.c, by: pid, spell: true, stackSid:[...g.stack].reverse().find(s=>s.kind==='spell'&&s.cardId===c.id)?.sid });
  return null;
}

function doActivate(g: GameState, pid: PID, a: Extract<PriorityAction, { type: 'activate' }>): string | null {
  const c = g.cards[a.card];
  if (!c) return '找不到永久物';
  const ab = abilitiesFor(g, c)[a.ability];
  const bdCounters=counterKinds(c);
  if(ab?.bdForage&&!validForage(g,pid,a.costCards??forageOptions(g,pid).defaults))return '掘食費用不合法';
  if (!ab || !canActivate(g, pid, c, a.ability)) return '現在不能起動這個異能';
  if(c.def.id==='say-its-name'&&a.costCards&&(a.costCards.length!==3||new Set(a.costCards).size!==3||!a.costCards.includes(c.id)||a.costCards.some(id=>!g.players[pid].graveyard.includes(id)||g.cards[id].def.id!=='say-its-name')))return '需要放逐此牌與另兩張同名牌';
  const specs = (ab.targets ?? []).map(s=>ab.effects.some(e=>e.e==='frontier'&&e.action==='dft:214')?{...s,filter:{...s.filter,ids:(c.meadowLinked??[]).filter(id=>g.cards[id].zone==='exile'&&g.cards[id].objectVersion===c.frontierMarks?.['bdMime:'+id])}}:s).map(s=>s.filter?.chosenTribe?{...s,filter:{...s.filter,chosenTribe:false,sub:c.eclType??''}}:s);
  const targets = specs.map((_, i) => a.targets?.[i] ?? null);
  const targetVersions=targets.map(t=>t&&'c' in t?g.cards[t.c]?.objectVersion??0:undefined);
  const err = validateTargets(g, specs, targets, pid, c.id);
  if (err) return err;
  if(ab.foundationDistribution&&targets.length&&a.distribution&&(a.distribution.length!==targets.length||a.distribution.some(n=>!Number.isInteger(n)||n<1)||a.distribution.reduce((n,v)=>n+v,0)!==ab.foundationDistribution))return '分配傷害不合法';
  let sacCard: Card | undefined;
  if (ab.cost.sacOther) {
    sacCard = a.sac != null ? g.cards[a.sac] : undefined;
    if (!sacCard || sacCard.zone !== 'battlefield' || sacCard.controller !== pid || !matches(g, ab.cost.sacOther, sacCard, pid, c.id))
      return '請選擇要犧牲的永久物';
  }
  if(c.def.id==='ronin-shadow-stalker'&&sacCard&&sacCard.attachedTo!==c.id)return '必須犧牲結附在Ronin上的武具';
  // Validate explicit payment choices before spending any mana.
  const chosen = a.costCards;
  const craftIds=ab.cost.craft?(chosen??campusCraftOptions(g,pid,c,ab).slice(0,ab.cost.craftCount??1)):[];
  if(ab.cost.craft&&!campusCraftValid(g,pid,c,ab,craftIds))return '製作素材不合法';
  const foundryIds=ab.campusExileArtifacts?(chosen??g.battlefield.filter(id=>id!==c.id&&g.cards[id].controller===pid&&g.cards[id].def.types.includes('Artifact')).slice(0,1)):[];
  if(ab.campusExileArtifacts&&(!foundryIds.length||new Set(foundryIds).size!==foundryIds.length||foundryIds.some(id=>id===c.id||!g.battlefield.includes(id)||g.cards[id].controller!==pid||!g.cards[id].def.types.includes('Artifact'))))return '放逐神器費用不合法';
  const foundryMv=foundryIds.reduce((n,id)=>n+manaValue(g.cards[id].def),0);
  if(ab.campusExileArtifacts&&targets.some(t=>t&&'c'in t&&manaValue(g.cards[t.c].def)>foundryMv))return '所放逐神器總法術力值不足';
  const exileCards=ab.bdExile?(chosen??g.players[pid].graveyard.filter(id=>id!==c.id&&matches(g,ab.bdExile!.filter,g.cards[id],pid)).slice(0,ab.bdExile.n??0)):[];
  if(ab.bdExile&&(new Set(exileCards).size!==exileCards.length||!ab.bdExile.any&&exileCards.length!==(ab.bdExile.n??0)||exileCards.some(id=>id===c.id||!g.players[pid].graveyard.includes(id)||!matches(g,ab.bdExile!.filter,g.cards[id],pid))))return '放逐費用不合法';
  const sacAny=ab.bdSacAny?(chosen??g.battlefield.filter(id=>g.cards[id].controller===pid&&matches(g,ab.bdSacAny,g.cards[id],pid)).slice(0,1)):[];
  if(ab.bdSacAny&&(!sacAny.length||new Set(sacAny).size!==sacAny.length||sacAny.some(id=>!g.battlefield.includes(id)||g.cards[id].controller!==pid||!matches(g,ab.bdSacAny,g.cards[id],pid))))return '犧牲費用不合法';
  if (chosen && new Set(chosen).size !== chosen.length) return '費用不能重複選擇同一物件';
  if (chosen && ab.sacN && (chosen.length!==ab.sacN.n || chosen.some(id=>!sacCandidates(g,pid,ab.sacN!.filter,c.id).some(x=>x.id===id)))) return '犧牲費用不合法';
  if (chosen && ab.cost.crew!==undefined && (chosen.some(id=>{const x=g.cards[id];return !x||x.zone!=='battlefield'||x.controller!==pid||x.id===c.id&&ab.effects.some(e=>e.e==='saddle')||!isCreature(x)||x.tapped;}) || chosen.reduce((n,id)=>n+Math.max(0,crewPower(g,g.cards[id])),0)<ab.cost.crew)) return '駕駛費用不合法';
  if (a.counterCard!==undefined && ab.removeCounter?.fromCreature) {const x=g.cards[a.counterCard];if(!x||x.zone!=='battlefield'||x.controller!==pid||!isCreature(x)||x.counters<ab.removeCounter.n)return '移除指示物費用不合法';}
  if (a.discard!==undefined && ab.cost.discard && !g.players[pid].hand.includes(a.discard)) return '棄牌費用不合法';
  const blightBody=ab.cost.blight?(a.blightCard!==undefined?g.cards[a.blightCard]:g.battlefield.map(id=>g.cards[id]).find(x=>x.controller===pid&&isCreature(x)&&canReceiveCounters(g,x))):undefined;
  if(ab.cost.blight&&(!blightBody||blightBody.zone!=='battlefield'||blightBody.controller!==pid||!isCreature(blightBody)||!canReceiveCounters(g,blightBody)))return '枯萎費用不合法';
  if(a.discard!==undefined&&ab.cost.discardFilter&&!matches(g,ab.cost.discardFilter,g.cards[a.discard],pid))return '棄牌類別不合法';
  if(ab.removeCounter?.any&&a.counterPayments){const counts:Record<string,number>={};for(const x of a.counterPayments)counts[x.kind]=(counts[x.kind]??0)+x.n;if(Object.values(counts).reduce((a,b)=>a+b,0)!==ab.removeCounter.n||Object.entries(counts).some(([k,n])=>n<0||(counterKinds(c)[k]??0)<n))return '移除指示物費用不合法';}
  if(ab.removeCounter?.any&&a.counterKind&&(counterKinds(c)[a.counterKind]??0)<ab.removeCounter.n)return '移除指示物費用不合法';
  const tapIds=ab.bdTapMana?(a.tapCards??[]):ab.cost.tapN?(a.tapCards??tapNChoices(g,pid,{...ab.cost.tapN.filter,...(ab.cost.tap?{other:true}:{})},ab.cost.tapN.n,c.id)??[]):[];
  if(ab.bdTapMana&&(new Set(tapIds).size!==tapIds.length||tapIds.length>4||tapIds.some(id=>!g.battlefield.includes(id)||g.cards[id].controller!==pid||g.cards[id].tapped||id===c.id&&!!ab.cost.tap||!isCreature(g.cards[id]))))return '橫置生物費用不合法';
  if(ab.cost.tapN&&(tapIds.length!==ab.cost.tapN.n||new Set(tapIds).size!==tapIds.length||tapIds.some(id=>{const x=g.cards[id];return !x||x.zone!=='battlefield'||x.controller!==pid||x.tapped||(ab.cost.tap&&id===c.id)||!matches(g,ab.cost.tapN!.filter,x,pid,c.id);})))return '橫置費用不合法';
  const kirol=ab.effects.some(e=>e.e==='ecl'&&e.action==='kirol');
  const kirolTarget=kirol?g.stack.find(s=>s.sid===a.stackTargetSid&&s.kind==='trigger'&&s.controller===pid):undefined;
  if(kirol&&!kirolTarget)return '請選擇你的觸發異能';
  let xLoy = 0;
  const cost = parseCost(ab.cost.mana);
  if(c.def.id==='raft-security-officer'&&targets[0]&&'c'in targets[0]&&stats(g,g.cards[targets[0].c]).p<=3)cost.generic=Math.max(0,cost.generic-1);
  if(ab.special&&c.hidden?.id==='fugitive-codebreaker')cost.generic=Math.max(0,cost.generic-g.players[pid].graveyard.filter(id=>g.cards[id].def.types.some(t=>t==='Instant'||t==='Sorcery')).length);
  const finX=ab.xMana?Math.max(0,Math.floor(a.x??ab.xMin??0)):undefined;
  if(ab.xMana&&(finX??0)<(ab.xMin??0))return 'X不合法';
  if(ab.xMana)cost.generic+=ab.xMana*(finX??0);
  const boastIds=ab.mshBoast?(a.costCards??g.players[pid].graveyard.filter(id=>blackSymbols(g.cards[id])>0)):[];
  if(ab.mshBoast&&(new Set(boastIds).size!==boastIds.length||boastIds.some(id=>!g.players[pid].graveyard.includes(id)||blackSymbols(g.cards[id])===0)||boastIds.reduce((n,id)=>n+blackSymbols(g.cards[id]),0)<15))return '需從墳墓場放逐至少十五個黑色法力符號的牌';
  const mshTarget=ab.mshStack?g.stack.find(s=>s.sid===a.stackTargetSid&&s.controller===pid&&s.kind!=='spell'&&!s.manaAbility&&g.cards[s.cardId].def.types.includes(ab.mshStack==='artifact'?'Artifact':'Creature')):undefined;
  if(ab.mshStack&&!mshTarget)return '請選擇指定來源的起動或觸發異能';
  const abilityTarget=ab.finStack?finStackChoices(g,pid,true).find(s=>s.sid===a.stackTargetSid):undefined;
  if(ab.finStack&&!abilityTarget)return '請選擇你的起動或觸發異能';
  if(ab.effects.some(e=>e.e==='fin'&&e.action==='rydiaReturn')&&targets[0]&&'c'in targets[0]&&manaValue(g.cards[targets[0].c].def)!==finX)return 'X必須等於傳紀的法力值';
  if(ab.effects.some(e=>e.e==='frontier'&&e.action==='woe:208')&&targets[0]&&'c'in targets[0]&&manaValue(g.cards[targets[0].c].def)!==(finX??0))return 'X必須等於目標生物牌的法力值';
  if (ab.isEquip) {
    const t = targets[0];
    const d = t && 'c' in t ? g.cards[t.c]?.def.equipDiscount ?? 0 : 0;
    const tc = t && 'c' in t ? g.cards[t.c] : undefined;
    const perCounter = c.def.equip?.costLessPerCounter && tc ? tc.counters : 0;
    cost.generic = Math.max(0, cost.generic - d - perCounter-(c.finCopyEquipDiscount?2:0));
  }
  if (ab.powerUp && c.enteredTurn === g.turn) Object.assign(cost, reduceCost(cost, parseCost(c.def.cost)));
  cost.generic += wardTax(g, pid, targets);
  if(ab.powerUp)cost.generic=Math.max(0,cost.generic-3*mshStatic(g,pid,'powerUpDiscount').filter(s=>s.id!==c.id&&isCreature(c)).length);
  frontierAbilityCost(g,c,ab,cost);if(ab.roomDoor!==undefined)cost.generic=Math.max(0,cost.generic-frontierStatic(g,pid,'dsk:unlockDiscount').length);
  cost.generic=Math.max(0,cost.generic-tokenAbilityReduction(g,c));
  if(c.def.types.includes('Artifact')&&mkmStatic(g,pid,'gadgetDiscount').length)cost.generic=Math.max(cost.W+cost.U+cost.B+cost.R+cost.G+cost.C+(cost.hyb?.length??0)>0?0:1,cost.generic-mkmStatic(g,pid,'gadgetDiscount').length);
    if(ab.costLessPer) cost.generic=Math.max(0,cost.generic-countMatching(g,ab.costLessPer,pid));
  if(ab.bdTapMana&&tapIds.length>cost.generic)return '不能橫置超過費用所需的生物';
  if(ab.bdTapMana)cost.generic=Math.max(0,cost.generic-tapIds.length);
  for(const id of tapIds)g.cards[id].tapped=true;
  const evidenceIds=ab.evidence?evidencePayment(g,pid,ab.evidence,a.evidenceCards,c.zone==='graveyard'?c.id:undefined):[];
  if(!evidenceIds)return '蒐證費用不合法';
  const ninja=ab.foundationNinjutsu?sneakAttackers(g,pid).find(x=>x.id===(a.costCards?.[0]??sneakAttackers(g,pid)[0]?.id)):undefined;if(ab.foundationNinjutsu&&!ninja)return '需要收回未被阻擋的攻擊生物';
  const paid=payCost(g, pid, cost, ab.cost.tap ? c.id : undefined,false,{...c.def,eclAbilityPayment:true,foundation:{...c.def.foundation,unlockPayment:ab.roomDoor!==undefined},faceUpPayment:!!ab.special&&ab.roomDoor===undefined,fin:ab.isEquip?{...c.def.fin,equipment:'equipPayment'}:c.def.fin},false,ab.waterbend);
  for(const id of tapIds)g.cards[id].tapped=false;
  if(!paid)return '法術力不足';
  if(c.def.id==='say-its-name'){const ids=a.costCards??[c.id,...g.players[pid].graveyard.filter(id=>id!==c.id&&g.cards[id].def.id==='say-its-name').slice(0,2)];for(const id of ids)moveCard(g,g.cards[id],'exile');}
  if(ninja){(c.frontierMarks??={}).ninjaTarget=ninja.attackTarget??-1;moveCard(g,ninja,'hand');}
  const fishing=ab.effects.find(e=>e.e==='frontier'&&e.action==='fdn:fishBait');if(fishing?.e==='frontier')tapCard(g,g.cards[fishing.n!]);
  for(const id of boastIds)moveCard(g,g.cards[id],'exile');
  if(ab.evidence)payEvidence(g,pid,c,evidenceIds!);
  if (ab.special) {
    if(c.hidden?.id==='aurelias-vindicator')(c.mkmMarks??={}).faceUpX=finX??0;
    // 翻成正面：特殊動作，立即生效
    if(ab.roomDoor!==undefined)changeDoor(g,c,ab.roomDoor);else turnFaceUp(g, c);
    return null;
  }
  if(ab.frontierMode!==undefined)(c.frontierMarks??={})['porridge'+ab.frontierMode]=1;
  if(ab.frontierRemoveLoot)(c.frontierMarks??={}).loot=(c.frontierMarks?.loot??0)-ab.frontierRemoveLoot;
  if(blightBody)putMinusCounters(g,blightBody,ab.cost.blight!);
  if(ab.removeCounter?.any&&a.counterPayments)for(const x of a.counterPayments)removeCounterKind(c,x.kind,x.n);
  if(ab.removeCounter?.any&&!a.counterPayments){let left=ab.removeCounter.n;for(const [kind,n]of Object.entries(counterKinds(c))){if(a.counterKind&&kind!==a.counterKind)continue;const take=Math.min(left,n);if(take)removeCounterKind(c,kind,take);left-=take;if(!left)break;}}
  if(ab.removeCounter&&!ab.removeCounter.any){const {n,fromCreature}=ab.removeCounter;const target=fromCreature?g.cards[a.counterCard ?? g.battlefield.find(id=>g.cards[id].controller===pid&&isCreature(g.cards[id])&&g.cards[id].counters>=n)!]:c;if(target.charge!==undefined&&!fromCreature)target.charge-=n;else target.counters-=n;}
  if(ab.sacN)for(const victim of (a.costCards?.map(id=>g.cards[id]) ?? sacCandidates(g,pid,ab.sacN.filter,c.id).slice(0,ab.sacN.n)))sacrifice(g,victim);
  if(sacCard){(c.frontierMarks??={}).sacToughness=stats(g,sacCard).t;c.frontierMarks.bdSacPower=stats(g,sacCard).p;}
  const lki = c.zone === 'battlefield' ? stats(g, c).p : 0;
  const wl = wardLifeTax(g, pid, targets);
  if (wl) {
    log(g, `守護：支付${wl}點生命`, pid, 'life');
    loseLife(g, pid, wl);
  }
  payWardDiscard(g, pid, wardDiscardCount(g, pid, targets));
  payWardSac(g, pid, wardSacCount(g, pid, targets), c.id);
  if (ab.cost.tap) tapCard(g,c);
  if (ab.cost.tapN||ab.bdTapMana) {
    for (const id of tapIds) {
      tapCard(g,g.cards[id]);
      log(g, `橫置 ${cardName(g.cards[id])}`, pid);
    }
  }
  const oldBatch=g.meadowZoneBatch;g.meadowZoneBatch=g.nextSid++;
  for(const id of exileCards)moveCard(g,g.cards[id],'exile');
  for(const id of sacAny)sacrifice(g,g.cards[id]);
  g.meadowZoneBatch=oldBatch;
  if(ab.bdExert){(c.frontierMarks??={}).bdExertBy=pid+1;c.frontierMarks.bdExertTurn=g.turn;}
  if(ab.bdForage)payForage(g,pid,a.costCards??forageOptions(g,pid).defaults);
  if(ab.bdRemove)c.eclCounters![ab.bdRemove]--;
  if(ab.cost.discard){const hand=a.discard!==undefined?[a.discard]:g.players[pid].hand.filter(id=>!ab.cost.discardFilter||matches(g,ab.cost.discardFilter,g.cards[id],pid)).sort((a,b)=>manaValue(g.cards[a].def)-manaValue(g.cards[b].def));for(const id of hand.slice(0,ab.cost.discard))discard(g,g.cards[id]);}
  if (ab.cost.life) {
    frontierPayLife(g,pid,ab.cost.life);
  }
  if (ab.oncePerTurn) c.usedThisTurn.push(1000 + a.ability);
  if (ab.oncePerGame) c.exhausted = [...(c.exhausted ?? []), a.ability];
  if (ab.cost.loyalty !== undefined) {
    // −X：X 由玩家選擇，不超過目前的忠誠
    xLoy = ab.xLoyalty ? Math.max(0, Math.min(a.x ?? 0, c.loyalty ?? 0)) : 0;
    c.loyalty = (c.loyalty ?? 0) + ab.cost.loyalty - xLoy;
    c.usedThisTurn.push(LOYALTY_USED);
    g.players[pid].loyaltyActivatedThisTurn = true;
    if (ab.cost.loyalty > 0) emit(g, { type: 'loyaltyPlaced', card: c.id, controller: pid, amount: ab.cost.loyalty });
    emit(g, { type: 'loyaltyActivated', card: c.id, controller: pid, removed: Math.max(0, -ab.cost.loyalty) + xLoy });
  }
  if (ab.cost.crew !== undefined) {
    const crew = a.costCards ?? crewChoice(g, pid, c, ab.cost.crew) ?? [];
    for (const id of crew) tapCard(g,g.cards[id]);
    c.crewedBy=[...new Set([...(c.crewedTurn===g.turn?c.crewedBy??[]:[]),...crew])];c.crewedTurn=g.turn;
    const saddle = ab.effects.some((e) => e.e === 'saddle');
    for(const id of crew)emit(g,{type:'frontier',action:'bdCrew',card:c.id,other:id,player:pid,amount:a.ability});
    log(g, `${crew.map((id) => cardName(g.cards[id])).join('、')} ${saddle ? '騎乘' : '駕駛'} ${cardName(c)}`, pid);
  }
  g.stack.push({
    sid: g.nextSid++,
    kind: 'activated',bdCounters,bdSac:sacCard?{power:stats(g,sacCard).p,mana:manaValue(sacCard.def),vehicle:matches(g,{sub:'Vehicle'},sacCard,pid)}:undefined,distribution:a.distribution??(ab.foundationDistribution&&targets.length?targets.map((_,i)=>i?1:ab.foundationDistribution!-targets.length+1):undefined),
    controller: pid,
    cardId: c.id,
    targets,
    targetSpecs: specs,
    targetVersions,
    effects: ab.mshBoast?ab.effects.map(e=>e.e==='msh'&&e.action==='87'?{...e,ids:boastIds.slice()}:e):mshTarget?ab.effects.map(e=>e.e==='msh'&&e.action==='copyAbility'?{...e,n:mshTarget.sid}:e):abilityTarget?ab.effects.map(e=>e.e==='fin'&&e.action==='copyAbility'?{...e,n:abilityTarget.sid}:e):kirol?ab.effects.map(e=>e.e==='ecl'&&e.action==='kirol'?{...e,n:kirolTarget!.sid}:e):ab.effects,
    text: ab.label,
    sourceType:c.eclType,
    sourceLinkKey:c.tmtLinkKey,
    manaAbility: ab.manaAbility||!ab.targets?.length && ab.cost.loyalty===undefined && ab.effects.every(e=>(e.e==='msh'&&['112','187','baxterMana'].includes(e.action))||(e.e==='mkm'&&['235','cryptexMana','manaAny'].includes(e.action))||e.e==='addMana'||e.e==='addManaOfChoice'||(e.e==='fin'&&e.action==='viviMana')||(e.e==='ecl'&&['bloomMana','brigidMana','wickermawMana','flamebraiderMana'].includes(e.action))),
    lkiPower: lki,
    ...(ab.xLoyalty ? { x: xLoy } : ab.xMana?{x:finX}:ab.bdExile?.any?{x:exileCards.length}:ab.bdSacAny?{x:sacAny.length}:{}),
  });
  show(g, { kind: 'activated', player: pid, card: c.id, targets, text: ab.label });
  log(g, `起動 ${cardName(c)}：${ab.label}${describeTargets(g, targets)}`, pid, 'cast');
  if(sacCard)(c.frontierMarks??={}).sacOutlaw=Number(matches(g,{outlaw:true},sacCard,pid));
  if (sacCard){if(sacCard.suspected)(c.mkmMarks??={}).sacSuspect=g.turn;sacrifice(g,sacCard);}
  if (ab.cost.sacSelf) sacrifice(g, c);
  if (ab.cost.exileSelf && !ab.fromHand && c.zone === 'battlefield') moveCard(g, c, 'exile');
  if (ab.fromGraveyard && !ab.keepSelf && c.zone === 'graveyard') moveCard(g, c, 'exile');
  if (ab.fromHand && c.zone === 'hand') {
    if (ab.cost.discardSelf) discard(g, c);
    else if (ab.cost.exileSelf) moveCard(g, c, 'exile');
  }
  if (ab.cost.craft) {
    c.campusLinked=[];
    for (const m of craftIds) {
      log(g, `工藝：放逐 ${cardName(g.cards[m])}`, pid);
      const material=g.cards[m],craftTriggers=abilitiesOf(g,material).filter(a=>a.kind==='trigger'&&a.frontierEvent==='lci:craftExiled');
      campusLink(g,c,material);
      for(const ability of craftTriggers)if(ability.kind==='trigger')g.pending.push({source:m,controller:pid,abilityIndex:-316,ev:{type:'frontier',action:'cpCraftExiled',card:m,player:pid,amount:c.id},ability});
      emit(g,{type:'frontier',action:'cpCraftExiled',card:m,player:pid,amount:c.id});
    }
  }
  if(ab.cost.craft){moveCard(g,c,'exile');(c.frontierMarks??={}).cpCraftVersion=c.objectVersion??0;}
  if(ab.campusDiscardHand)discardMany(g,g.players[pid].hand.map(id=>g.cards[id]));
  if(ab.campusEquipmentSac!==undefined)sacrifice(g,g.cards[ab.campusEquipmentSac]);
  const activatedItem=g.stack[g.stack.length-1];
  if(ab.campusExileArtifacts){activatedItem.x=foundryMv;for(const id of foundryIds)moveCard(g,g.cards[id],'exile');}
  if(!activatedItem.manaAbility)emit(g,{type:'frontier',action:'activated',card:c.id,player:pid,other:activatedItem.sid,amount:a.ability,bdStack:{...activatedItem,targets:activatedItem.targets.slice()}});
  if(ab.bdExhaust){frontierFlags(g,pid).bdExhausted=1;emit(g,{type:'frontier',action:'bdExhaust',card:c.id,player:pid,other:activatedItem.sid,amount:a.ability,bdStack:{...activatedItem,targets:activatedItem.targets.slice()}});}
  commitCrime(g,pid,c.id,targets,activatedItem.sid);
  if(targets.some(t=>t&&('p'in t||isCreature(g.cards[t.c]))))emit(g,{type:'frontier',action:'activatedTargets',card:c.id,player:pid,amount:activatedItem.sid});
  if(targets.some(t=>t&&'p'in t))emit(g,{type:'msh',action:'abilityPlayerTarget',card:c.id,player:pid});
  for (const t of targets) if (t && 'c' in t && g.cards[t.c].zone === 'battlefield') emit(g, { type: 'targeted', card: t.c, by: pid, spell: false, stackSid:[...g.stack].reverse().find(s=>s.kind==='activated'&&s.cardId===c.id)?.sid });
  return null;
}

export function describeTargets(g: GameState, targets: (TargetRef | null)[]): string {
  const names = targets
    .filter((t): t is TargetRef => !!t)
    .map((t) => ('p' in t ? g.players[t.p].name : cardName(g.cards[t.c])));
  return names.length ? ` → ${names.join('、')}` : '';
}

export function hasAnyAction(g: GameState, pid: PID): boolean {
  return playOptions(g, pid).length > 0;
}

function matchesDefSubtype(d:CardDef,sub:string){return !!d.changeling||!!d.subtypes?.includes(sub);}
function eclPermission(g:GameState,pid:PID,c:Card){const p=c.eclCast;if(!p||p.by!==pid||(p.until!==undefined&&p.until<g.turn)||(p.nextTurn!==undefined&&(g.players[pid].eclTurnCount??0)>p.nextTurn))return false;if(p.mode==='brynhildr')return c.finMarks?.brynhildrTurn===g.turn;if(p.source!==undefined&&!g.battlefield.some(id=>g.cards[id].tmtLinkKey===p.source&&g.cards[id].controller===pid))return false;if(p.mode==='dissident')return g.active===pid&&eligibleCounterTotal(g,pid)>=3;
if(p.mode==='maralen')return !(g.players[pid].eclMaralenUsed??[]).includes(p.source!)&&c.eclExiledTurn===g.turn&&manaValue(c.def)<=g.battlefield.filter(id=>g.cards[id].controller===pid&&isCreature(g.cards[id])&&(matches(g,{sub:'Elf'},g.cards[id],pid)||matches(g,{sub:'Faerie'},g.cards[id],pid))).length;return true;}

function eligibleCounterTotal(g:GameState,pid:PID){return g.battlefield.filter(id=>g.cards[id].controller===pid&&isCreature(g.cards[id])).reduce((n,id)=>n+counterTotal(g.cards[id]),0);}
function defaultCounterSources(g:GameState,pid:PID,n:number){const out:{card:number;kind:string}[]=[];for(const id of g.battlefield){const c=g.cards[id];if(c.controller!==pid||!isCreature(c))continue;for(const [kind,count]of Object.entries(counterKinds(c)))for(let i=0;i<count&&out.length<n;i++)out.push({card:id,kind});if(out.length===n)break;}return out;}
function validCounterSources(g:GameState,pid:PID,list:{card:number;kind:string}[],n:number){if(list.length!==n)return false;const used:Record<string,number>={};for(const x of list){const c=g.cards[x.card];if(!c||c.zone!=='battlefield'||c.controller!==pid||!isCreature(c))return false;const key=x.card+':'+x.kind;used[key]=(used[key]??0)+1;if((counterKinds(c)[x.kind]??0)<used[key])return false;}return true;}

/** Extra mana abilities resolve together with the land's mana ability. */
function landManaExtras(g:GameState,land:Card,forDef?:CardDef):(import('./types').Mana[]&{requires?:import('./types').Mana;matches?:boolean})[] {
 const out:(import('./types').Mana[]&{requires?:import('./types').Mana;matches?:boolean})[]=[];
 if(land.def.id==='gilded-lotus')for(let i=0;i<2;i++)out.push(Object.assign(['W','U','B','R','G'] as import('./types').Mana[],{matches:true}));
 if(land.def.id==='hedron-archive')out.push(['C']);
 if(land.def.id==='elvish-archdruid')for(let i=1;i<g.battlefield.filter(id=>g.cards[id].controller===land.controller&&matches(g,{type:'Creature',sub:'Elf'},g.cards[id],land.controller)).length;i++)out.push(['G']);
 if(land.def.id==='overgrown-zealot'&&forDef?.faceUpPayment)out.push(Object.assign(['W','U','B','R','G'] as import('./types').Mana[],{matches:true}));
 for(const id of g.battlefield){const aura=g.cards[id];if(aura.attachedTo===land.id&&abilitiesOf(g,aura).some(a=>a.kind==='static'&&a.frontier==='fdn:horizonsMana'))out.push(Object.assign(['W','U','B','R','G'] as import('./types').Mana[],{matches:true}));}
 if(land.def.id==='arc-reactor')out.push(['C'],['C']);
 if(land.def.id==='arid-archway')out.push(['C']);
 if(land.def.id==='intrepid-stablemaster'&&forDef&&!forDef.eclAbilityPayment&&forDef.subtypes?.some(s=>s==='Mount'||s==='Vehicle'))out.push(Object.assign(['W','U','B','R','G'] as import('./types').Mana[],{matches:true}));
 if(land.token&&land.def.types.includes('Artifact'))for(const _s of frontierStatic(g,land.controller,'artifactTokenManaBonus'))out.push(Object.assign([...(land.def.produces??['C'])] as import('./types').Mana[],{matches:true}));
 if(land.def.id==='troyan-gutsy-explorer')out.push(['U']);
 if(!isLand(land))return out;
 if(isLand(land)&&land.def.supertypes?.includes('Basic'))for(let i=1;i<3**frontierStatic(g,land.controller,'tripleBasicMana').length;i++)out.push(Object.assign([...(land.def.produces??['C'])] as import('./types').Mana[],{matches:true}));
 for(const id of g.battlefield){const source=g.cards[id];for(const a of abilitiesOf(g,source))if(a.kind==='static'){
  if(a.fin==='colorlessManaBonus'&&source.controller===land.controller&&land.def.produces?.includes('C'))out.push(Object.assign(['C' as const],{requires:'C' as const}));
  if(a.mkm==='gardenMana'&&source.attachedTo===land.id)out.push(['W','U','B','R','G']);
  if(a.landManaBonus==='G'&&source.controller===land.controller)out.push(['G']);
  if(a.ecl==='basicManaBonus'&&land.def.supertypes?.includes('Basic'))out.push(Object.assign([...(land.def.produces??['C'])] as import('./types').Mana[],{matches:true}));
  if(a.ecl==='landAuraMana'&&source.attachedTo===land.id&&source.chosenColor)out.push([source.chosenColor]);
 }}return out;
}

function finGraveCast(g:GameState,pid:PID,c:Card){if(c.owner===pid&&isLand(c)&&mshStatic(g,pid,'graveLands').length)return true;if(c.owner===pid&&isCreature(c)&&mkmFlags(g,pid).graveCast===g.turn)return true;return c.owner===pid&&(g.active===pid&&finStatic(g,pid,'hadesCast').length>0||c.def.types.includes('Artifact')&&finStatic(g,pid,'noctisCast').length>0&&g.players[pid].life>=3);}
export function finStackChoices(g:GameState,pid:PID,ownAbility:boolean){return g.stack.filter(s=>ownAbility?s.controller===pid&&(s.kind==='trigger'||s.kind==='activated')&&!s.effects.some(e=>e.e==='fin'&&e.action==='copyAbility'):s.kind!=='spell'||!isCreature(g.cards[s.cardId]));}
function finAbilityMaxX(g:GameState,pid:PID,c:Card,index:number){const ab=abilitiesFor(g,c)[index];let n=0;while(n<100&&canPayCost(g,pid,{...parseCost(ab.cost.mana),generic:parseCost(ab.cost.mana).generic+(n+1)*(ab.xMana??1)},ab.cost.tap?c.id:undefined,false,{...c.def,eclAbilityPayment:true}))n++;return n;}

function mshCosmicFlash(g:GameState,pid:PID){return mshStatic(g,pid,'cosmicFlash').length>0&&g.players[(1-pid) as PID].spellsThisTurn>0;}

export function frontierCanPayLife(g:GameState,pid:PID,n:number){return g.players[pid].life>=n||!!frontierStatic(g,pid,'ashiokLife').length&&g.players[pid].library.length>=n;}
export function frontierPayLife(g:GameState,pid:PID,n:number){if(frontierStatic(g,pid,'ashiokLife').length&&g.players[pid].library.length>=n){for(const id of g.players[pid].library.slice(0,n))moveCard(g,g.cards[id],'exile');}else loseLife(g,pid,n);}

export function frontierStackChoices(g:GameState,pid:PID,kind:string){return g.stack.filter(s=>kind==='ownAbility'?s.kind!=='spell'&&s.controller===pid:kind==='retarget'?s.targets.filter(Boolean).length===1:s.kind!=='spell'||(g.cards[s.cardId].castFace??g.cards[s.cardId].def).types.some(t=>t==='Instant'||t==='Sorcery'));}
