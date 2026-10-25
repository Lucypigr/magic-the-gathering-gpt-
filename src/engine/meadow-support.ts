import {dftAmount,dftCondition,dftTrigger,dftBaseStats,dftStats} from './meadow-dft-support';
import {abilitiesSuppressed,isCreature,isLand,matches,other,stats} from './state';
import {manaValue} from './mana';
import {frontierFlags,frontierStatic} from './frontier-support';
import type {Card,GameEvent,GameState,PID,TriggeredAbility} from './types';
const own=(g:GameState,p:PID)=>g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===p);
export function meadowAmount(g:GameState,p:PID,id:number,key:string,ev?:GameEvent){
 if(key.startsWith('dft:'))return dftAmount(g,p,id,key.slice(4),ev);
 const c=g.cards[id],f=frontierFlags(g,p);switch(key.split(':').slice(1).join(':')){
 case 'lastPower':if(ev?.type==='dies'&&ev.card===id)return ev.power;return c.zone==='battlefield'?stats(g,c).p:c.lastPower??c.def.power??0;
 case 'rotcall':return own(g,p).filter(x=>x.id!==id&&matches(g,{sub:['Squirrel','Bat','Lizard','Rat']},x,p)).length;
 case 'creatureDeaths':return f.bdDeaths??0;
 case 'greatestPower':return Math.max(0,...own(g,p).filter(isCreature).map(c=>stats(g,c).p));
 case 'opponentExiledCreatures':return frontierFlags(g,other(p)).bdExiledCreatures??0;
 default:throw Error('Unsupported meadow amount '+key);
 }
}
export function meadowCondition(g:GameState,key:string,p:PID,id:number,e?:GameEvent){
 if(key.startsWith('dft:'))return dftCondition(g,key.slice(4),p,id,e);
 const c=g.cards[id],player=g.players[p],opp=g.players[other(p)],f=frontierFlags(g,p);
 switch(key.split(':').slice(1).join(':')){
 case 'lostLife':return player.lifeLostThisTurn>0;
 case 'gainedOrLost':return player.lifeLostThisTurn>0||player.lifeGainedThisTurn>0;
 case 'gainedAndLost':return player.lifeLostThisTurn>0&&player.lifeGainedThisTurn>0;
 case 'opponentLostLife':return opp.lifeLostThisTurn>0;
 case 'power3':return stats(g,c).p>=3;
 case 'giftPromised':return !!c.frontierMarks?.bdGift;
 case 'notHandCast':return c.castOrigin!=='hand';
 case 'graveCast':return c.castOrigin==='graveyard';
 case 'bandit2':return opp.hand.length<=1;
 case 'forageReward':return (f.bdGraveLeft??0)>=3||!!f.bdFoodSac;
 case 'otherCreatureEntered':return Object.keys(f).some(k=>k.startsWith('bdEntered:')&&k!==`bdEntered:${id}:${c.objectVersion??0}`);
 case 'lands10':return own(g,p).filter(isLand).length>=10;
 case 'hunterDraw':return own(g,p).some(c=>isCreature(c)&&stats(g,c).p>=4);
 case 'curatorTypes':return new Set((c.meadowLinked??[]).filter(id=>g.cards[id].zone==='exile'&&g.cards[id].objectVersion===c.frontierMarks?.['bdCurator:'+id]).flatMap(id=>g.cards[id].def.types)).size>=4;
 case 'villageBlue':return ['Bird','Frog','Otter','Rat'].some(t=>!!f['bdEntryType:'+t]);
 default:throw Error('Unsupported meadow condition '+key);
 }
}
function batch(g:GameState,c:Card,key:string){const n=g.meadowZoneBatch??g.frontierEntryBatch??g.mshTokenGroup;if(n===undefined)return true;const m=c.frontierMarks??={};if(m['bdBatch:'+key]===n)return false;m['bdBatch:'+key]=n;return true;}
export function meadowTrigger(g:GameState,c:Card,a:TriggeredAbility,e:GameEvent){
 if(a.frontierEvent?.startsWith('dft:'))return dftTrigger(g,c,a,e);
 const key=a.frontierEvent!.split(':').slice(1).join(':'),p=c.controller,ec='card'in e?g.cards[e.card]:undefined;
 const entry=e.type==='etb'&&e.controller===p&&!!ec,life=(e.type==='lifegain'||e.type==='lifeloss')&&e.player===p;
 switch(key){
 case 'noncreatureEntryBatch':return entry&&!isCreature(ec!)&&!isLand(ec!)&&batch(g,c,key);
 case 'tokenEntryBatch':return entry&&!!ec!.token&&batch(g,c,key);
 case 'questEntryBatch':return entry&&ec!.id!==c.id&&matches(g,{sub:['Rabbit','Bat','Bird','Mouse']},ec!,p)&&batch(g,c,key);
 case 'sacSelf':return e.type==='sacrifice'&&e.card===c.id;
 case 'flyingDeath':return e.type==='dies'&&e.controller===p&&!!ec&&(ec.id===c.id||stats(g,ec).kw.has('flying'));
 case 'giveGift':return e.type==='frontier'&&e.action==='bdGift'&&e.player===p;
 case 'ownLife':return life&&g.active===p;
 case 'nondeathOtherBatch':case 'nondeathCreature':return e.type==='fin'&&e.action==='zoneMove'&&e.from==='battlefield'&&e.to!=='graveyard'&&!!ec&&(ec.frontierMarks?.lastController??e.player)===p&&!!ec.frontierMarks?.bdWasCreature&&(key==='nondeathCreature'||ec.id!==c.id)&&(key==='nondeathCreature'||batch(g,c,key));
 case 'noncreatureOrOtter':return e.type==='cast'&&e.player===p&&!!ec&&matches(g,{or:[{nonType:'Creature'},{sub:'Otter'}]},ec,p);
 case 'secondSpell':return e.type==='cast'&&g.players[e.player].spellsThisTurn===2;
 case 'expend4':case 'expend8':{const f=frontierFlags(g,p),n=key==='expend4'?4:8;return e.type==='cast'&&e.player===p&&(f.bdSpentBefore??0)<n&&(f.bdSpent??0)>=n;}
 case 'well':case 'patrol':case 'forageReturn':case 'zoraline':return e.type==='frontier'&&e.action==='bd:'+key&&e.card===c.id;
 case 'drawStep':return e.type==='step'&&e.step==='draw'&&e.player===p;
 case 'ownCreatureDeath':return e.type==='dies'&&e.controller===p&&!!ec&&!!ec.frontierMarks?.bdWasCreature;
 case 'sacPermanent':return e.type==='sacrifice'&&e.player===p;
 case 'toughEntry':return entry&&isCreature(ec!)&&(ec!.id===c.id||stats(g,ec!).t>stats(g,ec!).p);
 case 'opponentTargetsCreature':return e.type==='targeted'&&e.by!==p&&!!ec&&ec.controller===p&&isCreature(ec);
 case 'creatureCounters':return e.type==='counterPlaced'&&e.controller===p&&e.counterKind==='+1/+1'&&!!ec&&isCreature(ec);
 case 'foodSacBatch':return e.type==='sacrifice'&&e.player===p&&!!ec&&matches(g,{sub:'Food'},ec,p)&&batch(g,c,key);
 case 'foraged':return e.type==='frontier'&&e.action==='bdForage'&&e.player===p;
 case 'alaniaCast':{if(e.type!=='cast'||e.player!==p||!ec||ec.id===c.id)return false;const f=frontierFlags(g,p);return(ec.def.types.includes('Instant')&&f.bdInstants===1)||(ec.def.types.includes('Sorcery')&&f.bdSorceries===1)||(matches(g,{sub:'Otter'},ec,p)&&f.bdOtters===1);}
 case 'birdDamageBatch':{if(e.type!=='combatDamage'||e.player===p||!g.cards[e.source]||g.cards[e.source].controller!==p||!matches(g,{sub:'Bird'},g.cards[e.source],p))return false;const m=c.frontierMarks??={},key=(g.combatCount??0)*2+(g.phase==='combat_damage_first'?1:0);if(m.bdBirdTurn===g.turn&&m.bdBirdStep===key)return false;m.bdBirdTurn=g.turn;m.bdBirdStep=key;return true;}
 case 'flyingEntry':return entry&&(ec!.id===c.id||stats(g,ec!).kw.has('flying'));
 case 'foodDied':return e.type==='permanentDies'&&!!ec&&matches(g,{sub:'Food'},ec,p);
 case 'damageOpponent':return(e.type==='combatDamage'&&e.source===c.id&&e.player!==p)||(e.type==='frontier'&&e.action==='bdDamagePlayer'&&e.card===c.id&&e.player!==p);
 default:throw Error('Unsupported meadow trigger '+a.frontierEvent);
 }
}
export function meadowTriggerAbility(g:GameState,c:Card,a:TriggeredAbility,e:GameEvent):TriggeredAbility{
 if(!a.bdTargets)return a;const ec='card'in e?g.cards[e.card]:undefined;
 return {...a,targets:a.targets?.map(t=>{const filter={...t.filter};switch(a.bdTargets){case 'lesserDead':case 'lesserEntry':filter.mvMax=manaValue(ec?.def??c.def)-1;if(a.bdTargets==='lesserDead')filter.ids=g.players[c.controller].graveyard.filter(id=>id!==ec?.id);break;case 'otherEvent':filter.ids=g.battlefield.filter(id=>id!==ec?.id);break;case 'castX':filter.mvMax=c.castX??0;break;case 'cycleX':filter.mvMin=filter.mvMax=e.type==='frontier'?e.amount:0;break;case 'coin':filter.mvMin=filter.mvMax=e.type==='frontier'?e.amount:c.eclCounters?.coin??0;break;default:throw Error('Unsupported meadow targets '+a.bdTargets);}return {...t,filter};})};
}
export function meadowObserve(g:GameState,e:GameEvent){
 if(e.type==='cast'){const c=g.cards[e.card],f=frontierFlags(g,e.player);f.bdSpentBefore=f.bdSpent??0;f.bdSpent=(f.bdSpent??0)+(c.manaSpent??0);for(const[type,key]of [['Instant','bdInstants'],['Sorcery','bdSorceries']]as const)if(c.def.types.includes(type))f[key]=(f[key]??0)+1;if(matches(g,{sub:'Otter'},c,e.player))f.bdOtters=(f.bdOtters??0)+1;
  const spell=g.stack.find(s=>s.kind==='spell'&&s.cardId===c.id);if(spell)e.bdSpell={...spell,targets:spell.targets.slice()};
  if(c.def.types.some(t=>t==='Instant'||t==='Sorcery'))for(const emblem of frontierStatic(g,e.player,'blb:storm')){const n=g.players[0].spellsThisTurn+g.players[1].spellsThisTurn-1;if(n>0)g.pending.push({source:emblem.id,controller:e.player,abilityIndex:-201,ev:e,ability:{kind:'trigger',on:'castAny',effects:[{e:'frontier',action:'blb:storm',n}]}});}
  for(const d of g.meadowDelayed??[])if(d.kind==='seasonBurn'&&d.controller===e.player&&d.turn>=g.turn)g.pending.push({source:d.source,controller:d.controller,abilityIndex:-202,ev:e,ability:{kind:'trigger',on:'castAny',targets:[{kind:'creature',optional:true}],effects:[{e:'damage',n:2,to:'T0'}]}});
 }
 if(e.type==='discard'){const f=frontierFlags(g,e.player);if(e.batchPart)f.bdDiscardParts=(f.bdDiscardParts??0)+1;e.amount=e.batchSummary?f.bdDiscardParts??1:1;if(e.batchSummary)f.bdDiscardParts=0;}
 if(e.type==='etb'){const c=g.cards[e.card];if(matches(g,{or:[{sub:'Mount'},{sub:'Vehicle'}]},c,e.controller)){const f=frontierFlags(g,e.controller);f.bdMountVehicleEntries=(f.bdMountVehicleEntries??0)+1;}if(isCreature(c)){const f=frontierFlags(g,e.controller);f[`bdEntered:${c.id}:${c.objectVersion??0}`]=1;for(const t of c.def.subtypes??[])f['bdEntryType:'+t]=1;}}
 if(e.type==='dies'&&g.cards[e.card]?.frontierMarks?.bdWasCreature){const f=frontierFlags(g,e.controller);f.bdDeaths=(f.bdDeaths??0)+1;}
 if(e.type==='sacrifice'){const c=g.cards[e.card];if(matches(g,{sub:'Food'},c,e.player))frontierFlags(g,e.player).bdFoodSac=1;}
 if(e.type==='fin'&&e.action==='zoneMove'){const c=g.cards[e.card];if(e.from==='graveyard'){const f=frontierFlags(g,e.player);f.bdGraveLeft=(f.bdGraveLeft??0)+1;}if(e.from==='battlefield'&&e.to==='exile'&&c.frontierMarks?.bdWasCreature){const f=frontierFlags(g,(c.frontierMarks.lastController??e.player)as PID);f.bdExiledCreatures=(f.bdExiledCreatures??0)+1;}if(e.from==='battlefield'&&e.to!=='graveyard'&&c.def.id==='three-tree-scribe')for(const a of c.def.abilities??[])if(a.kind==='trigger'&&a.frontierEvent==='blb:nondeathCreature')g.pending.push({source:c.id,controller:(c.frontierMarks?.lastController??c.controller)as PID,abilityIndex:-203,ev:e,ability:a});}
 if(e.type==='step'&&e.step==='endStep')for(const d of g.meadowDelayed??[])if(!d.queued&&['returnNext','returnNextCounter','returnNextFlying','dragonhawk','exileCreated','sacCreated'].includes(d.kind)&&(!d.ownEnd||e.player===d.controller)){d.queued=true;g.pending.push({source:d.source,controller:d.controller,abilityIndex:-204,ev:e,ability:{kind:'trigger',on:'eachEndStep',effects:[{e:'frontier',action:'blb:delayed',n:d.id}]}});}
 if(e.type==='frontier'&&e.action==='bdExhaust'&&e.bdStack&&!e.bdStack.manaAbility)for(const d of g.meadowDelayed??[])if(d.kind==='pitCopy'&&!d.queued&&d.turn===g.turn&&d.controller===e.player){d.queued=true;g.pending.push({source:d.source,controller:d.controller,abilityIndex:-220,ev:e,ability:{kind:'trigger',on:'frontierEvent',effects:[{e:'frontier',action:'dft:copyAbility',n:e.other}]}});}
 if(e.type==='step'&&e.step==='combatStart')for(const d of g.meadowDelayed??[])if(d.kind==='fullThrottle'&&d.turn===g.turn)g.pending.push({source:d.source,controller:d.controller,abilityIndex:-221,ev:e,ability:{kind:'trigger',on:'combatStart',effects:[{e:'frontier',action:'dft:untapAttacked'}]}});
 if(e.type==='dies')for(const d of g.meadowDelayed??[])if(d.kind==='surveilDeath'&&d.turn===g.turn&&d.target===e.card&&g.cards[e.card].objectVersion===d.version)g.pending.push({source:d.source,controller:d.controller,abilityIndex:-222,ev:e,ability:{kind:'trigger',on:'dies',effects:[{e:'surveil',n:1}]}});
 if(e.type==='combatDamage')for(const d of g.meadowDelayed??[])if(d.kind==='howlerDraw'&&d.turn===g.turn&&d.target===e.source&&g.cards[e.source].objectVersion===d.version)g.pending.push({source:d.source,controller:d.controller,abilityIndex:-223,ev:e,ability:{kind:'trigger',on:'combatDamagePlayer',effects:[{e:'draw',n:1}]}});
 if(e.type==='combatDamageAny'&&e.controller===g.active)for(const c of frontierStatic(g,e.controller,'dft:aetherspark'))if(c.attachedTo===e.source)g.pending.push({source:c.id,controller:c.controller,abilityIndex:-224,ev:e,ability:{kind:'trigger',on:'combatDamageAny',effects:[{e:'frontier',action:'dft:loyaltyHost',n:e.amount}]}});
 if(e.type==='combatDamageAny'){const c=g.cards[e.source],m=c?.frontierMarks,key=(g.combatCount??0)*2+(g.phase==='combat_damage_first'?1:0);if(m?.bdBlinkDamage===g.turn&&(m.bdBlinkStep!==key||m.bdBlinkTurn!==g.turn)){m.bdBlinkStep=key;m.bdBlinkTurn=g.turn;g.pending.push({source:c.id,controller:c.controller,abilityIndex:-205,ev:e,ability:{kind:'trigger',on:'combatDamagePlayer',may:'放逐並移回此生物？',effects:[{e:'flicker',what:'self'}]}});}}
}
export function meadowBaseStats(g:GameState,c:Card,s:import('./state').Stats){
 dftBaseStats(g,c,s);
 if(!abilitiesSuppressed(g,c))for(const a of c.def.abilities??[])if(a.kind==='static'){
  if(a.frontier==='blb:eluge')s.p=s.t=own(g,c.controller).filter(c=>matches(g,{sub:'Island',type:'Land'},c,c.controller)).length;
  if(a.frontier==='blb:lumra')s.p=s.t=own(g,c.controller).filter(isLand).length;
  if(a.frontier==='blb:burrowguard')s.p=s.t=own(g,c.controller).filter(isCreature).length;
 }
 if(isCreature(c)){const effects=[...frontierStatic(g,c.controller,'dft:ooze').map(c=>({c,key:'ooze'})),...frontierStatic(g,other(c.controller),'blb:maha').map(c=>({c,key:'maha'}))].sort((a,b)=>(a.c.tmtLinkKey??a.c.id)-(b.c.tmtLinkKey??b.c.id));for(const fx of effects)if(fx.key==='ooze')s.p=s.t=6;else s.t=1;}
}
export function meadowStats(g:GameState,c:Card,s:import('./state').Stats){
 dftStats(g,c,s);
 if(!abilitiesSuppressed(g,c)&&c.def.abilities?.some(a=>a.kind==='static'&&a.frontier==='blb:ratToken')){const n=own(g,c.controller).filter(x=>x.id!==c.id&&matches(g,{sub:'Rat'},x,c.controller)).length;s.p+=n;s.t+=n;}
 if(c.frontierMarks?.bdPossessionSource!==undefined){const source=g.cards[c.frontierMarks.bdPossessionSource];if(source?.zone==='battlefield'&&source.controller===c.frontierMarks.bdPossessionController)s.cantAttack=s.cantBlock=true;}

 if(!abilitiesSuppressed(g,c)&&c.def.abilities?.some(a=>a.kind==='static'&&a.frontier==='blb:ratPower'))s.p+=own(g,c.controller).filter(x=>x.id!==c.id&&matches(g,{sub:'Rat'},x,c.controller)).length;
 if(g.active===c.controller&&g.battlefield.some(id=>g.cards[id].attachedTo===c.id&&g.cards[id].def.subtypes?.includes('Equipment'))&&frontierStatic(g,c.controller,'blb:equippedDoubleHaste').some(c=>(c.classLevel??1)>=3)){s.kw.add('double_strike');s.kw.add('haste');}
}
export function meadowWard(g:GameState,c:Card){return (matches(g,{sub:'Frog'},c,c.controller)?frontierStatic(g,c.controller,'blb:frogWard').filter(x=>x.id!==c.id).length:0)+(Object.values({...c.eclCounters,plus:c.counters,stun:c.stun,hexproof:c.hexproofCounters,loyalty:c.loyalty,finality:c.finality?1:0}).some(n=>!!n)?frontierStatic(g,c.controller,'blb:counterWard').filter(x=>(x.classLevel??1)>=2).length:0);}
export function meadowGrantedAbilities(g:GameState,c:Card):import('./types').ActivatedAbility[]{
 const out:import('./types').ActivatedAbility[]=[];
 if(c.zone==='graveyard'&&c.frontierMarks?.bdEmbalm===g.turn)out.push({kind:'activated',fromGraveyard:true,sorcery:true,cost:{mana:c.def.cost},effects:[{e:'frontier',action:'dft:embalm'}],label:'遺存：放逐並派出白色殭屍複製'});
 if(matches(g,{sub:'Frog'},c,c.controller)&&frontierStatic(g,c.controller,'blb:frogCreatureMana').length)out.push({kind:'activated',cost:{tap:true},label:'加綠或藍（限生物）',effects:[{e:'frontier',action:'blb:frogMana'}],manaAbility:true});return out;
}

export const meadowNoPrevent=(g:GameState)=>!!(frontierFlags(g,0).bdNoPrevent||frontierFlags(g,1).bdNoPrevent||frontierStatic(g,0,'blb:sunspine').length||frontierStatic(g,1,'blb:sunspine').length);
export const innkeeperMultiplier=(g:GameState,p:PID)=>2**frontierStatic(g,p,'blb:innkeeperCounters').filter(c=>(c.classLevel??1)>=3).length;
