import {abilitiesSuppressed,isCreature,matches,stats,shuffleArr} from './state';
import {frontierStatic} from './frontier-support';
import {campusCondition,campusTrigger} from './campus-support';
import {runEffects,resolveRef} from './effects';
import type {Ctx} from './effects';
import {destroyCards,moveCard,drawCards,dealDamage,loseLife,gainLife,discardMany} from './zones';
import {makeEclTokenBatch} from './ecl';
import {meadowCounter,meadowYes} from './meadow';
import {choose} from './tla';
import {campusPermit} from './campus';
import type {Card,CardDef,GameState,GameEvent,PID,TriggeredAbility,Effect,SubFlow} from './types';
export function orbitCondition(g:GameState,key:string,p:PID,id:number,e?:GameEvent){
 const us=g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===p);
 switch(key.split(':')[1]){
 case 'diedPlus':return e?.type==='dies'&&Number(e.counterKinds?.plus??g.cards[e.card].counters)>0;
 case 'castTwo':return g.players[p].spellsThisTurn>=2;
 case 'castBefore':return g.players[p].spellsThisTurn>0;
 case 'tappedTwo':return us.filter(c=>isCreature(c)&&c.tapped).length>=2;
 case 'oppThree':return g.battlefield.filter(id=>g.cards[id].controller!==p&&isCreature(g.cards[id])).length>=3;
 case 'oppMoreLands':return g.battlefield.filter(id=>g.cards[id].controller!==p&&g.cards[id].def.types.includes('Land')).length>us.filter(c=>c.def.types.includes('Land')).length;
 default:return campusCondition(g,key,p,id,e);
 }
}
export function orbitTrigger(g:GameState,c:Card,a:TriggeredAbility,e:GameEvent){
 const ec='card'in e?g.cards[e.card]:undefined;
 switch(a.frontierEvent?.split(':')[1]){
 case 'otherArtifactEtb':return e.type==='etb'&&e.controller===c.controller&&e.card!==c.id&&!!ec?.def.types.includes('Artifact');
 case 'otherArtifactCreatureEtb':return e.type==='etb'&&e.controller===c.controller&&e.card!==c.id&&!!ec?.def.types.some(t=>t==='Artifact'||t==='Creature');
 case 'artifactCreatureDies':return e.type==='permanentDies'&&e.controller===c.controller&&!!ec?.def.types.some(t=>t==='Artifact'||t==='Creature');
 case 'sacrificeOtherArtifactCreature':return e.type==='sacrifice'&&e.player===c.controller&&e.card!==c.id&&!!ec?.def.types.some(t=>t==='Artifact'||t==='Creature');
 default:return campusTrigger(g,c,a,e);
 }
}
export function orbitAmount(g:GameState,p:PID,key:string){
 if(key==='eoe:focusFire')return 2+g.battlefield.filter(id=>g.cards[id].controller===p&&matches(g,{or:[{type:'Creature'},{sub:'Spacecraft'}]},g.cards[id],p)).length;
 throw Error('Unsupported orbit amount '+key);
}
export function orbitBaseStats(g:GameState,c:Card,st:import('./state').Stats){
 if(c.def.abilities?.some(a=>a.kind==='static'&&a.frontier==='eoe:landSize')&&!abilitiesSuppressed(g,c))st.p=st.t=g.battlefield.filter(id=>g.cards[id].controller===c.controller&&g.cards[id].def.types.includes('Land')).length;
}
export const orbitFlash=(g:GameState,p:PID,def:CardDef)=>!!(def.types.includes('Sorcery')||def.subtypes?.includes('Dragon'))&&frontierStatic(g,p,'tdm:dragonSorceryFlash').length>0;
export function* orbitEffect(g:GameState,ctx:Ctx,ef:Extract<Effect,{e:'frontier'}>):SubFlow{
 const p=ctx.controller,c=g.cards[ctx.source],key=ef.action.split(':').slice(1).join(':'),victim=resolveRef(g,ctx,ef.what??'T0').cards[0];
 const effects=(list:Effect[])=>runEffects(g,ctx,list);
 if(key.startsWith('counter:')){if(victim)meadowCounter(g,victim,key.slice(8),ef.n??1,p);return;}
 switch(key){
 case 'attachCreated':{if(ctx.created===undefined||c.zone!=='battlefield')break;c.attachedTo=ctx.created;break;}
 case 'drawIfPlus':if((victim?.counters??0)>0)drawCards(g,p,1);break;
 case 'destroyAndLander':{if(!victim)break;const owner=victim.controller;destroyCards(g,[victim]);yield*makeEclTokenBatch(g,owner,'tok-lander',1);break;}
 case 'destroyIfZero':if(victim&&stats(g,victim).p<=0)destroyCards(g,[victim]);break;
 case 'surveilArtifacts':yield*effects([{e:'surveil',n:g.battlefield.filter(id=>g.cards[id].controller===p&&g.cards[id].def.types.includes('Artifact')).length}]);break;
 case 'consult':yield*effects([{e:'dig',n:{count:{ctrl:'you',type:'Land'}},take:c.kicked?2:1,rest:'bottom',randomBottom:true}]);break;
 case 'selfDamage':if(victim)dealDamage(g,victim,victim.controller,{c:victim.id},Math.max(0,stats(g,victim).p)*(stats(g,victim).kw.has('flying')?2:1));break;
 case 'doublePower':if(victim)yield*effects([{e:'pump',what:ef.what??'T0',p:stats(g,victim).p,t:0}]);break;
 case 'doubleStats':if(victim)yield*effects([{e:'pump',what:ef.what??'T0',p:stats(g,victim).p,t:stats(g,victim).t}]);break;
 case 'doubleAll':for(const id of [...g.battlefield]){const target=g.cards[id];if(target.controller===p&&isCreature(target)){const s=stats(g,target);g.eot.push({card:id,p:s.p,t:s.t,kw:[]});}}break;
 case 'kirin':if(victim){const token=victim.token;moveCard(g,victim,'hand');if(token)drawCards(g,p,1);}break;
 case 'defeat':if(victim){const controller=victim.controller;moveCard(g,victim,'exile');loseLife(g,controller,3);gainLife(g,p,3);}break;
 case 'narset':if(yield*meadowYes(p,'棄掉手牌並依本回合施放咒語數抓牌？')){discardMany(g,g.players[p].hand.slice().map(id=>g.cards[id]));drawCards(g,p,g.players[p].spellsThisTurn);}break;
 case 'toTop':case 'toBottom':if(victim){moveCard(g,victim,'library');const lib=g.players[victim.owner].library;lib.splice(lib.indexOf(victim.id),1);if(key==='toTop')lib.unshift(victim.id);else lib.push(victim.id);}break;
 case 'removeCounters':if(victim){victim.counters=0;victim.charge=0;victim.stun=0;victim.hexproofCounters=0;victim.eclCounters={};victim.lore=0;victim.loyalty=0;victim.finality=false;victim.finalityCount=0;}break;
 case 'impulseChoose':{const cards=g.players[p].library.slice(0,2);for(const id of cards)moveCard(g,g.cards[id],'exile');const [id]=yield*choose(g,p,'選擇一張可使用至下回合結束的牌',cards,cards.length?1:0,1);if(id!==undefined)campusPermit(g,g.cards[id],p,g.turn+(g.active===p?2:1));break;}
 case 'doubleStrikeTurn':(g.delayed??=[]).push({source:c.id,controller:p,on:'castNoncreature',once:false,targets:[{kind:'creature',filter:{ctrl:'you'}}],effects:[{e:'pump',what:'T0',p:0,t:0,kw:['double_strike']}]});break;
 default:throw Error('Unsupported orbit effect '+ef.action);
 }
 g.version++;
}
// Omens resolve by shuffling their physical card, rather than gaining adventure permission.
export function finishOmen(g:GameState,c:Card){moveCard(g,c,'library');shuffleArr(g,g.players[c.owner].library);}
