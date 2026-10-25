import {abilitiesSuppressed,abilitiesOf,isCreature,isLand,matches,stats,other} from './state';
import {frontierFlags,frontierStatic} from './frontier-support';
import {manaValue} from './mana';
import type {Card,GameEvent,GameState,PID,TriggeredAbility} from './types';
export function dftAmount(g:GameState,p:PID,id:number,key:string,ev?:GameEvent){switch(key){case 'speed':return g.players[p].speed??0;case 'roadRage':return 2+g.battlefield.filter(id=>g.cards[id].controller===p&&matches(g,{or:[{sub:'Mount'},{sub:'Vehicle'}]},g.cards[id],p)).length;case 'mountVehicleEntries':return frontierFlags(g,p).bdMountVehicleEntries??0;case 'lastCounters':return ev?.type==='dies'?Number(ev.counterKinds?.plus??g.cards[id].lastCounters??0):g.cards[id].lastCounters??0;default:throw Error('Unsupported DFT amount '+key);}}
export function dftCondition(g:GameState,key:string,p:PID,id:number,e?:GameEvent){switch(key){case 'opponentLife10':return g.players[other(p)].life<=10;case 'opponentMoreLands':return g.battlefield.filter(id=>g.cards[id].controller===other(p)&&isLand(g.cards[id])).length>g.battlefield.filter(id=>g.cards[id].controller===p&&isLand(g.cards[id])).length;case 'sacrificedVehicle':return !!g.cards[id].frontierMarks?.bdSacVehicle;case 'opponentTurnCast':return e?.type==='cast'&&e.player!==g.active;case 'pirateVehicleAttack':{const ids=e?.type==='youAttack'?e.attackers:g.battlefield.filter(id=>g.cards[id].attacking&&g.cards[id].controller===p);return ids.some(id=>matches(g,{sub:'Pirate'},g.cards[id],p))&&ids.some(id=>matches(g,{sub:'Vehicle'},g.cards[id],p));}default:throw Error('Unsupported DFT condition '+key);}}
function batch(g:GameState,c:Card,key:string){const n=g.meadowZoneBatch??g.frontierEntryBatch??g.mshTokenGroup;if(n===undefined)return true;const m=c.frontierMarks??={};if(m[key]===n)return false;m[key]=n;return true;}
export function dftTrigger(g:GameState,c:Card,a:TriggeredAbility,e:GameEvent){const key=a.frontierEvent!.slice(4),p=c.controller,ec='card'in e?g.cards[e.card]:undefined;switch(key){case 'cycleSelf':return false; // queued directly from the cycling cost, including exile replacements
case 'crewedBySelf':return e.type==='frontier'&&e.action==='bdCrew'&&e.other===c.id&&e.player===p&&g.active===p&&(g.phase==='main1'||g.phase==='main2');
case 'exhaust':return e.type==='frontier'&&e.action==='bdExhaust'&&e.player===p;
case 'attackedBatch':return e.type==='youAttack'&&e.player!==p;
case 'artifactEntryOrSelf':return e.type==='etb'&&e.controller===p&&!!ec&&(ec.id===c.id||ec.def.types.includes('Artifact'));
case 'castNotOwned':return e.type==='cast'&&!!ec&&e.player!==ec.owner;
case 'anyCreatureOpponentDamage':return e.type==='combatDamage'&&e.player!==p&&!!g.cards[e.source]&&isCreature(g.cards[e.source]);
case 'graveArtifactCreatureBatch':return e.type==='fin'&&e.action==='zoneMove'&&e.from==='graveyard'&&e.player===p&&!!ec&&ec.def.types.some(t=>t==='Artifact'||t==='Creature')&&batch(g,c,'bdGraveBatch');
case 'exileBatch':return e.type==='fin'&&e.action==='zoneMove'&&e.to==='exile'&&(e.from==='graveyard'||e.from==='battlefield')&&g.active===p&&batch(g,c,'bdExileBatch');
case 'blockbuster':return e.type==='frontier'&&e.action==='bd:blockbuster'&&e.card===c.id;
case 'flyingDamageBatch':{if(e.type!=='combatDamage'||e.player===p||g.cards[e.source]?.controller!==p||!stats(g,g.cards[e.source]).kw.has('flying'))return false;const m=c.frontierMarks??={},key=(g.combatCount??0)*2+(g.phase==='combat_damage_first'?1:0);if(m.bdFlyingDamageTurn===g.turn&&m.bdFlyingDamageStep===key)return false;m.bdFlyingDamageTurn=g.turn;m.bdFlyingDamageStep=key;return true;}
default:throw Error('Unsupported DFT event '+key);}}
export function dftBaseStats(g:GameState,c:Card,s:import('./state').Stats){
 if(!abilitiesSuppressed(g,c))for(const a of abilitiesOf(g,c))if(a.kind==='static')switch(a.frontier){case 'dft:artifactPower':s.p=g.battlefield.filter(id=>g.cards[id].controller===c.controller&&g.cards[id].def.types.includes('Artifact')).length;break;case 'dft:artifactMaxPower':s.p=Math.max(0,...g.battlefield.filter(id=>g.cards[id].controller===c.controller&&g.cards[id].def.types.includes('Artifact')).map(id=>manaValue(g.cards[id].def)));break;case 'dft:landsPower':s.p=g.battlefield.filter(id=>g.cards[id].controller===c.controller&&isLand(g.cards[id])).length;break;}

}
export function dftStats(g:GameState,c:Card,s:import('./state').Stats){
 if(!abilitiesSuppressed(g,c))for(const a of abilitiesOf(g,c))if(a.kind==='static')switch(a.frontier){case 'dft:lifePenalty':s.p-=g.players[c.controller].life;s.t-=g.players[c.controller].life;break;case 'dft:hazoret':if((g.players[c.controller].speed??0)<4)s.cantAttack=s.cantBlock=true;break;case 'dft:exileSeven':if(g.players[0].exile.length+g.players[1].exile.length<7)s.cantAttack=s.cantBlock=true;break;case 'dft:evenCounters':{const n=c.counters+c.stun+(c.charge??0)+(c.hexproofCounters??0)+(c.finality?Math.max(1,c.finalityCount??1):0)+(c.loyalty??0)+Object.values(c.eclCounters??{}).reduce((n,k)=>n+k,0);if(n%2)s.cantAttack=s.cantBlock=true;break;}}
 if(isCreature(c))for(const samut of frontierStatic(g,c.controller,'dft:samut'))if(samut.id!==c.id)s.p+=g.players[c.controller].speed??0;
 if(c.attacking&&c.attackTarget==null&&frontierStatic(g,c.controller,'dft:attackingTrample').length)s.kw.add('trample');
}
export function crewPower(g:GameState,c:Card){return c.def.meadow?.crewToughness?stats(g,c).t:stats(g,c).p+Number(c.def.meadow?.crewPower??0);}
export function ignoreExhaust(g:GameState,p:PID){return g.active===p&&!frontierFlags(g,p).bdExhausted&&!!frontierStatic(g,p,'dft:refueler').length;}
