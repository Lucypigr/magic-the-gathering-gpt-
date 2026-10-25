import {abilitiesOf,abilitiesSuppressed,isCreature,isLand,matches,other,stats} from './state';
import {frontierFlags,frontierStatic} from './frontier-support';
import {manaValue} from './mana';
import type {ActivatedAbility,Card,GameEvent,GameState,PID,TriggeredAbility} from './types';
export const campusMaterials=(g:GameState,c:Card)=>(c.campusLinked??[]).filter(e=>!e.token&&g.cards[e.id]?.zone==='exile'&&g.cards[e.id].objectVersion===e.version);
export const campusPermanent=(c:Card)=>!c.def.types.some(t=>t==='Instant'||t==='Sorcery');
const own=(g:GameState,p:PID)=>g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===p);
export const campusDescent=(g:GameState,p:PID)=>g.players[p].graveyard.filter(id=>campusPermanent(g.cards[id])).length;
export const campusConverge=(c:Card)=>new Set((c.manaPaid??[]).filter(col=>col!=='C')).size;
export const campusCaves=(g:GameState,p:PID)=>[...g.battlefield.filter(id=>g.cards[id].controller===p),...g.players[p].graveyard].filter(id=>g.cards[id].def.subtypes?.includes('Cave')).length;
export function campusAmount(g:GameState,p:PID,id:number,key:string,x=0,e?:GameEvent):number{
 const c=g.cards[id],f=frontierFlags(g,p);switch(key.split(':').slice(1).join(':')){
 case 'converge':return campusConverge(c);case 'eventConverge':return e?.type==='cast'?campusConverge(g.cards[e.card]):0;
 case 'eventMana':return e?.type==='cast'?g.cards[e.card].manaSpent??0:0;case 'manaSpent':return c.manaSpent??0;case 'eventX':return e?.type==='cast'?g.cards[e.card].castX??0:0;
 case 'descent':return campusDescent(g,p);case 'caves':return campusCaves(g,p);case 'caveMana':return c.frontierMarks?.cpCaveMana??0;case 'creaturesLeft':return f.cpCreaturesLeft??0;
 case 'craftedMv':return campusMaterials(g,c).reduce((n,c)=>n+manaValue(g.cards[c.id].def),0);case 'attackingDinosaurs':return own(g,p).filter(c=>c.attacking&&c.def.subtypes?.includes('Dinosaur')).length;
 case 'dinosaurPower':return Math.max(2,...own(g,p).filter(c=>c.def.subtypes?.includes('Dinosaur')).map(c=>stats(g,c).p));
 case 'mapOpponents':return 1+Number(own(g,other(p)).some(c=>c.def.types.includes('Artifact')));case 'descendedTimes':return f.cpDescended??0;
 case 'graveSpells':return g.players[p].graveyard.filter(id=>g.cards[id].def.types.some(t=>t==='Instant'||t==='Sorcery')).length;
 case 'ancestralAnger':return 1+g.players[p].graveyard.filter(id=>g.cards[id].def.name==='Ancestral Anger').length;
 case 'twoToX':return 2**x;default:throw Error('Unsupported campus amount '+key);
 }
}
export function campusCondition(g:GameState,key:string,p:PID,id:number,e?:GameEvent){
 const c=g.cards[id],f=frontierFlags(g,p),us=own(g,p),them=own(g,other(p));switch(key.split(':').slice(1).join(':')){
 case 'wasCast':return c.wasCast??false;case 'threeCounters':return Object.values({...c.eclCounters,plus:c.counters,stun:c.stun,charge:c.charge,hexproof:c.hexproofCounters,loyalty:c.loyalty,lore:c.lore,finality:c.finality?Math.max(1,c.finalityCount??1):0}).reduce<number>((n,k)=>n+(k??0),0)>=3;
 case 'artifactEntered':return !!f.cpArtifactEntered;case 'attacked3':return(f.cpAttackers??0)>=3;case 'noTime':return !(c.eclCounters?.time??0);case 'handOne':return g.players.some(p=>p.hand.length<=1);
 case 'attackAlone':return us.filter(c=>c.attacking).length===1;case 'attackingMostLife':return c.attacking&&c.attackTarget==null&&g.players[other(p)].life>=g.players[p].life;case 'mostLife':return g.players[p].life>=g.players[other(p)].life;
 case 'hasPlus':return c.counters>0;case 'opponentTurnCast':return e?.type==='cast'&&e.player!==g.active;case 'dinosaurAttack':return us.some(c=>c.attacking&&c.def.subtypes?.includes('Dinosaur'));
 case 'targetEntered':return false; // evaluated with the chosen target in campusEffect
 case 'nonGnomeAttack':return us.some(c=>c.attacking&&!c.def.subtypes?.includes('Gnome'));case 'redNoncombat4':return(f.cpRedNoncombat??0)>=4;
 case 'fourPermanentTypes':return new Set(g.players[p].graveyard.flatMap(id=>g.cards[id].def.types.filter(t=>t!=='Instant'&&t!=='Sorcery'))).size>=4;
 case 'otherCaves3':return campusCaves(g,p)-Number(c.def.subtypes?.includes('Cave'))>=3;
 case 'opus':return e?.type==='cast'&&(g.cards[e.card].manaSpent??0)>=5;case 'notHandCast':return c.castOrigin!=='hand';
 case 'opponentMoreCreatures':return them.filter(isCreature).length>us.filter(isCreature).length;case 'opponentMoreHand':return g.players[other(p)].hand.length>g.players[p].hand.length;
 case 'exiledThisTurn':return !!f.cpAnyExiled;case 'graveLeft':return !!f.cpGraveLeft;case 'instantAndSorcery':return ['Instant','Sorcery'].every(t=>g.players[p].graveyard.some(id=>g.cards[id].def.types.includes(t as any)));
 case 'twoDeaths':return (f.cpAllDeaths??0)>=2;case 'hadCounters':return Object.values(e?.type==='dies'?e.counterKinds??{}:c.lastCounterKinds??{}).some(n=>!!n);
 case 'anotherInstantSorcery':return g.players[p].instSorcThisTurn>(c.zone==='stack'?1:0);case 'growth5':return(c.eclCounters?.growth??0)>=5;
 case 'ownCreatureDied':return !!f.cpOwnDeath;case 'selfCounterThisTurn':return c.frontierMarks?.cpCounterTurn===g.turn;case 'notCreature':return !isCreature(c);
 default:throw Error('Unsupported campus condition '+key);
 }
}
function batch(g:GameState,c:Card,key:string){const n=g.meadowZoneBatch??g.frontierEntryBatch??g.mshTokenGroup;if(n===undefined)return true;const m=c.frontierMarks??={};if(m[key]===n)return false;m[key]=n;return true;}
export function campusTrigger(g:GameState,c:Card,a:TriggeredAbility,e:GameEvent){
 const key=a.frontierEvent!.split(':').slice(1).join(':'),p=c.controller,ec='card'in e?g.cards[e.card]:undefined;switch(key){
 case 'tappedSelf':return e.type==='tapped'&&e.card===c.id;
 case 'opponentDiscardLand':return e.type==='discard'&&e.player!==p&&!!ec&&isLand(ec);
 case 'castInstantHand':return e.type==='cast'&&e.player===p&&ec?.castOrigin==='hand'&&ec.def.types.includes('Instant');
 case 'castArtifact':return e.type==='cast'&&e.player===p&&!!ec&&ec.def.types.includes('Artifact');
 case 'castSelf':return e.type==='cast'&&e.card===c.id;
 case 'castFromExile':return e.type==='cast'&&e.player===p&&ec?.castOrigin==='exile';
 case 'castNotOwned':return e.type==='cast'&&e.player===p&&ec?.owner!==p;
 case 'increment':return e.type==='cast'&&e.player===p&&(ec!.manaSpent??0)>Math.min(stats(g,c).p,stats(g,c).t);
 case 'castMulticolor':return e.type==='cast'&&e.player===p&&new Set(ec?.def.colors??[]).size>1;
 case 'castX':return e.type==='cast'&&e.player===p&&!!ec?.castFace?.cost?.includes('{X}');
 case 'thirdSpell':return e.type==='cast'&&e.player===p&&g.players[p].spellsThisTurn===3;
 case 'repartee':return e.type==='cast'&&e.player===p&&!!ec&&ec.def.types.some(t=>t==='Instant'||t==='Sorcery')&&(e.bdSpell??g.stack.find(s=>s.kind==='spell'&&s.cardId===ec.id))?.targets.some(t=>t&&'c'in t&&isCreature(g.cards[t.c]))===true;
 case 'graveLeaveBatch':return e.type==='fin'&&e.action==='zoneMove'&&e.from==='graveyard'&&e.player===p&&batch(g,c,'cpGraveBatch');
 case 'tokenEntryBatch':return e.type==='etb'&&e.controller===p&&!!ec?.token&&batch(g,c,'cpTokenBatch');
 case 'selfPlus':return e.type==='counterPlaced'&&e.card===c.id&&e.counterKind==='plus';
 case 'secondMain':return e.type==='step'&&e.step==='main2'&&e.player===p;
 case 'smallCreatureDies':return e.type==='dies'&&e.controller===p&&(e.power<=1||(e.toughness??2)<=1);
 case 'ownCombatBatch':return e.type==='combatBatch'&&e.attacker===p;
 case 'playerCombatDamaged':return e.type==='combatDamage'&&e.player===p;
 case 'merfolkTappedBatch':return e.type==='tapped'&&e.controller===p&&!!ec&&!ec.token&&matches(g,{sub:'Merfolk'},ec,p)&&batch(g,c,'cpMerfolkBatch');
 case 'craftExiled':return e.type==='frontier'&&e.action==='cpCraftExiled'&&e.card===c.id;
 case 'explore':case 'exploreLand':case 'exploreNonland':return e.type==='frontier'&&e.player===p&&(e.action===key||key==='explore'&&(e.action==='exploreLand'||e.action==='exploreNonland'));
 case 'discover':return e.type==='frontier'&&e.action==='discover'&&e.player===p;
 case 'riftManaCast':case 'smithyManaCast':case 'poolsManaCast':return e.type==='cast'&&e.player===p&&!!ec?.frontierMarks?.['cpUsedMana:'+c.id]&&(key==='smithyManaCast'?ec.def.types.some(t=>t==='Artifact'||t==='Creature'):campusPermanent(ec));
 case 'sacrificeOther':return e.type==='sacrifice'&&e.player===p&&e.card!==c.id;
 case 'otherArtifactCreatureDeath':return e.type==='permanentDies'&&e.card!==c.id&&!!ec&&ec.def.types.some(t=>t==='Artifact'||t==='Creature');
 case 'boostedCombatBatch':{if(e.type!=='combatDamage'||g.cards[e.source]?.controller!==p||!isCreature(g.cards[e.source])||stats(g,g.cards[e.source]).p<=(g.cards[e.source].def.power??0))return false;const m=c.frontierMarks??={},step=(g.combatCount??0)*2+(g.phase==='combat_damage_first'?1:0);if(m.cpBoostTurn===g.turn&&m.cpBoostStep===step)return false;m.cpBoostTurn=g.turn;m.cpBoostStep=step;return true;}
 case 'creatureDeathBatch':return e.type==='dies'&&e.controller===p&&!ec?.token&&batch(g,c,'cpDeathBatch');
 case 'untapBatch':return e.type==='frontier'&&e.action==='cpUntap'&&e.player===p;
 case 'excessNoncombatBatch':return e.type==='frontier'&&e.action==='cpExcess'&&e.player===p&&batch(g,c,'cpExcessBatch');
 default:throw Error('Unsupported campus event '+key);
 }
}
export function campusTriggerAbility(g:GameState,c:Card,a:TriggeredAbility):TriggeredAbility{
 if(a.campusConvergeTargets)return {...a,targets:a.targets?.map(s=>({...s,filter:{...s.filter,mvMax:campusConverge(c)}}))};
 if(a.campusLifeTargets)return {...a,targets:a.targets?.map(s=>({...s,filter:{...s.filter,mvMax:g.players[c.controller].lifeGainedThisTurn}}))};return a;
}
export function campusBaseStats(g:GameState,c:Card,s:import('./state').Stats){
 const has=(list:import('./types').Ability[]|undefined)=>list?.some(a=>a.kind==='static'&&a.frontier?.startsWith('lci:'));
 if(!(has(c.def.abilities)||has(c.copiedAbilities)||has(c.temporaryAbilities?.turn===g.turn?c.temporaryAbilities.abilities:undefined))||abilitiesSuppressed(g,c))return;
 for(const a of abilitiesOf(g,c))if(a.kind==='static')switch(a.frontier){case 'lci:descentBody':s.p=campusDescent(g,c.controller);s.t=s.p+1;break;case 'lci:gnomeBody':s.p=s.t=own(g,c.controller).filter(c=>c.def.types.some(t=>t==='Artifact'||t==='Creature')).length;break;case 'lci:mycotyrant':s.p=s.t=own(g,c.controller).filter(c=>isCreature(c)&&c.def.subtypes?.some(t=>t==='Fungus'||t==='Saproling')).length;break;case 'lci:craftedPower':s.p=campusMaterials(g,c).reduce((n,c)=>n+stats(g,g.cards[c.id]).p,0);break;case 'lci:craftedColors':s.p=s.t=new Set(campusMaterials(g,c).flatMap(c=>g.cards[c.id].def.colors??[])).size;break;}
}
export function campusStats(g:GameState,c:Card,s:import('./state').Stats){
 const creature=isCreature(c);
 for(const id of g.battlefield){const source=g.cards[id];
  const abs=source.copiedAbilities?.length||source.temporaryAbilities?.turn===g.turn?abilitiesOf(g,source):source.def.abilities??[];
  for(const a of abs){if(a.kind!=='static'||!a.frontier?.startsWith('lci:'))continue;
   const key=a.frontier;if(key!=='lci:wanderglyph'&&key!=='lci:bedrock'&&key!=='lci:blowgun'&&key!=='lci:descentAura')continue;
   if(abilitiesSuppressed(g,source))continue;
   if(key==='lci:wanderglyph'&&creature&&g.active===c.controller&&source.controller!==c.controller&&g.players[c.controller].spellsThisTurn)s.cantAttack=true;
   if(key==='lci:bedrock'&&creature&&source.controller===c.controller&&s.t>s.p)s.damageByToughness=true;
   if(source.attachedTo===c.id){if(key==='lci:blowgun')s.kw.add(g.active===c.controller?'deathtouch':'reach');if(key==='lci:descentAura')s.p-=campusDescent(g,source.controller);}
  }
 }
}
export function campusGrantedAbilities(g:GameState,c:Card):ActivatedAbility[]{
 const out:ActivatedAbility[]=[],E=(action:string):any=>({e:'frontier',action});
 if(c.zone!=='battlefield')return out;
 if(c.def.name==='Pirate Hat')out.push({kind:'activated',cost:{mana:'{1}'},isEquip:true,sorcery:true,effects:[{e:'attach',what:'T0'}],targets:[{kind:'creature',filter:{ctrl:'you',sub:'Pirate'}}],label:'裝備海盜{1}'});
 if(c.def.abilities?.some(a=>a.kind==='static'&&a.frontier==='lci:discardEquip'))out.push({kind:'activated',cost:{discard:1},isEquip:true,sorcery:true,effects:[{e:'attach',what:'T0'}],targets:[{kind:'creature',filter:{ctrl:'you'}}],label:'棄一張牌裝備'});
 for(const id of g.battlefield){const eq=g.cards[id];if(eq.attachedTo!==c.id||abilitiesSuppressed(g,eq))continue;
 if(abilitiesOf(g,eq).some(a=>a.kind==='static'&&a.frontier==='lci:hammerGrant'))out.push({kind:'activated',cost:{mana:'{3}',tap:true},effects:[E('lci:hammer')],targets:[{kind:'permanent',filter:{type:['Artifact','Enchantment']}}],label:'犧牲解構鎚：消滅神器或結界',campusEquipmentSac:eq.id}as any);
 if(abilitiesOf(g,eq).some(a=>a.kind==='static'&&a.frontier==='lci:whipGrant'))out.push({kind:'activated',cost:{mana:'{2}',tap:true},effects:[{e:'tap',what:'T0'}],targets:[{kind:'permanent',filter:{type:['Artifact','Creature']}}],label:'橫置神器或生物'},{kind:'activated',cost:{mana:'{8}',tap:true},effects:[{e:'frontier',action:'lci:discover',n:10}],label:'發現10'});
 }
 if(isLand(c)&&g.battlefield.some(id=>{const s=g.cards[id];return s.foundationNamed===c.def.name&&abilitiesOf(g,s).some(a=>a.kind==='static'&&a.frontier==='sos:hamlet');}))out.push({kind:'activated',cost:{tap:true},effects:[{e:'addMana',mana:['C']}],label:'加無色（石化村落）',manaAbility:true});
 if(isLand(c)&&frontierStatic(g,c.controller,'sos:landSpellMana').length)out.push({kind:'activated',cost:{tap:true},effects:[{e:'frontier',action:'sos:spellMana',n:5}],label:'加兩點同色（瞬間法術）',manaAbility:true});
 if(c.def.subtypes?.includes('Cave')&&frontierStatic(g,c.controller,'lci:caveManaGrant').some(x=>x.id!==c.id))out.push({kind:'activated',cost:{tap:true,life:1},effects:[{e:'addManaOfChoice',n:1}],label:'支付1生命：任意色',manaAbility:true});
 if(c.frontierMarks?.cpHuatliMana)out.push({kind:'activated',cost:{tap:true},effects:[{e:'frontier',action:'lci:huatliCreatureMana'}],label:'加紅綠白',manaAbility:true});
 if(abilitiesOf(g,c).some(a=>a.kind==='static'&&a.frontier==='lci:locusAbilities'))for(const[j,entry]of(c.campusLinked??[]).entries())if(!entry.token&&g.cards[entry.id].zone==='exile'&&g.cards[entry.id].objectVersion===entry.version){
  const list=entry.def.abilities?.filter((a):a is ActivatedAbility=>a.kind==='activated')??[];
  if(entry.def.equip)list.push({kind:'activated',cost:{mana:entry.def.equip.cost},sorcery:true,effects:[{e:'attach',what:'T0'}],targets:[{kind:'creature',filter:{ctrl:'you'}}],label:'所獲裝備異能'});
  if(entry.def.produces?.length&&!list.some(a=>a.manaAbility))list.push({kind:'activated',cost:{tap:true},manaAbility:true,effects:[{e:'frontier',action:'lci:locusMana',n:j}],label:'所獲產法力異能'});
  for(const[i,ab]of list.entries())out.push({...ab,oncePerTurn:true,campusLocusKey:100*j+i});
 }
 return out;
}
export function campusObserve(g:GameState,e:GameEvent){
 const queue=(c:Card,action:string,n=0,ev:GameEvent=e)=>g.pending.push({source:c.id,controller:c.controller,abilityIndex:-310,ev,ability:{kind:'trigger',on:'frontierEvent',effects:[{e:'frontier',action,n}]}});
 if(e.type==='etb'){const c=g.cards[e.card],f=frontierFlags(g,e.controller);if(c.def.types.includes('Artifact'))f.cpArtifactEntered=1;}
 if(e.type==='leaves'){const c=g.cards[e.card];if(isCreature(c))frontierFlags(g,e.controller).cpCreaturesLeft=(frontierFlags(g,e.controller).cpCreaturesLeft??0)+1;}
 if(e.type==='dies'&&!g.cards[e.card].token&&isCreature(g.cards[e.card]))for(const nexus of frontierStatic(g,e.controller,'lci:nexus')){
  const group=g.meadowZoneBatch??g.nextSid++,pending=g.pending.find(t=>t.source===nexus.id&&t.ev.type==='frontier'&&t.ev.action==='cpNexus'&&t.ev.amount===group);
  if(pending){const effect=pending.ability.effects[0];if(effect.e==='frontier')effect.n=(effect.n??0)+e.power;}
  else g.pending.push({source:nexus.id,controller:nexus.controller,abilityIndex:-317,ev:{type:'frontier',action:'cpNexus',card:nexus.id,player:nexus.controller,amount:group},ability:{kind:'trigger',on:'frontierEvent',effects:[{e:'frontier',action:'lci:212',n:e.power}]}});
 }
 if(e.type==='dies'&&g.cards[e.card].frontierMarks?.cpRabid===g.turn)queue(g.cards[e.card],'sos:draw1');
 if(e.type==='frontier'&&e.action==='activated'){const c=g.cards[e.card];if(c?.zone==='battlefield'&&frontierStatic(g,c.controller,'lci:locusCopy').some(s=>s.id===c.id))queue(c,'lci:copyActivated',e.other??0);}
 if(e.type==='dies')for(const p of [0,1]as PID[]){const f=frontierFlags(g,p);f.cpAllDeaths=(f.cpAllDeaths??0)+1;if(e.controller===p)f.cpOwnDeath=1;}
 if(e.type==='permanentToGy'){const f=frontierFlags(g,e.player);f.cpDescended=(f.cpDescended??0)+1;}
 if(e.type==='fin'&&e.action==='zoneMove'){
  if(e.from==='graveyard')frontierFlags(g,e.player).cpGraveLeft=1;
  if(e.to==='exile')for(const p of[0,1]as PID[])frontierFlags(g,p).cpAnyExiled=1;
 }
 if(e.type==='counterPlaced'){const c=g.cards[e.card];(c.frontierMarks??={}).cpCounterTurn=g.turn;
  if(e.counterKind==='time'&&c.def.id==='the-millennium-calendar'&&(c.eclCounters?.time??0)>=1000&&!c.frontierMarks.cpCalendarQueued){c.frontierMarks.cpCalendarQueued=1;queue(c,'lci:calendarLose');}
 }
 if(e.type==='youAttack')frontierFlags(g,e.player).cpAttackers=(frontierFlags(g,e.player).cpAttackers??0)+e.attackers.length;
 if(e.type==='cast'){
  const c=g.cards[e.card],p=e.player,inst=c.def.types.some(t=>t==='Instant'||t==='Sorcery');

  if(inst&&frontierFlags(g,p).cpNextCopy){frontierFlags(g,p).cpNextCopy--;queue(c,'sos:copyCast',0,e);}
  if(inst&&frontierStatic(g,p,'sos:storm').length){const n=Math.max(0,g.players[0].spellsThisTurn+g.players[1].spellsThisTurn-1);if(n)queue(c,'sos:stormCopies',n,e);}
  if((c.def.id==='quandrix-the-proof'||inst&&c.castOrigin==='hand'&&frontierStatic(g,p,'sos:cascade').length))queue(c,'sos:cascade',manaValue(c.def),e);
 }
 if(e.type==='draw'&&g.players[e.player].drawsThisTurn===1&&frontierStatic(g,e.player,'sos:miracleSpells').length){const c=g.cards[e.card];if(c.def.types.some(t=>t==='Instant'||t==='Sorcery'))queue(c,'sos:miracle');}
 if(e.type==='step'){
  if(e.step==='main1'||e.step==='main2')for(const d of [...g.campusDelayed??[]])if(d.kind==='nextMainMana'&&d.player===e.player){g.campusDelayed=g.campusDelayed!.filter(x=>x!==d);const c=g.cards[d.source];queue(c,'sos:delayedMana',d.n);}
  if(e.step==='endStep')for(const c of Object.values(g.cards))if(c.zone==='exile'&&c.frontierMarks?.cpUntilOwnEnd===e.player+1){c.playableUntil=g.turn-1;delete c.frontierMarks.cpUntilOwnEnd;}

  if(e.step==='main1')for(const c of Object.values(g.cards))if(c.zone==='exile'&&c.frontierMarks?.cpParadigmController===e.player+1)queue(c,'sos:paradigmCopy');
  if(e.step==='upkeep')for(const c of Object.values(g.cards))if(c.owner===e.player&&c.zone==='exile'&&c.frontierMarks?.cpRebound){delete c.frontierMarks.cpRebound;queue(c,'lci:reboundCast');}
 }
 if(e.type==='attacks'){const c=g.cards[e.card];if(c.frontierMarks?.cpRootAttack===g.turn)queue(c,'sos:gain1');}
 if(e.type==='combatDamage'&&g.cards[e.source]?.frontierMarks?.cpDreadmaw===g.turn)queue(g.cards[e.source],'lci:dreadmawDestroy',0,e);
}
