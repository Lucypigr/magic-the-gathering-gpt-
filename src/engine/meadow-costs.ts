import {frontierFlags,frontierStatic} from './frontier-support';
import {isCreature,isLand,matches} from './state';
import {emit,moveCard,sacrifice} from './zones';
import type {Card,CastAlt,GameState,PID} from './types';
export function forageOptions(g:GameState,p:PID,exclude=-1){
 const foods=g.battlefield.filter(id=>id!==exclude&&g.cards[id].controller===p&&matches(g,{sub:'Food'},g.cards[id],p)),grave=g.players[p].graveyard.filter(id=>id!==exclude);
 return {kind:'forage' as const,ids:[...foods,...grave],n:foods.length?1:3,max:3,defaults:foods.length?foods.slice(0,1):grave.slice(0,3)};
}
export function validForage(g:GameState,p:PID,ids:number[],exclude=-1){return new Set(ids).size===ids.length&&(ids.length===1&&g.battlefield.includes(ids[0])&&g.cards[ids[0]].controller===p&&ids[0]!==exclude&&matches(g,{sub:'Food'},g.cards[ids[0]],p)||ids.length===3&&ids.every(id=>id!==exclude&&g.players[p].graveyard.includes(id)));}
export function payForage(g:GameState,p:PID,ids:number[]){const old=g.meadowZoneBatch;g.meadowZoneBatch=g.nextSid++;for(const id of ids){const c=g.cards[id];if(c.zone==='battlefield')sacrifice(g,c);else moveCard(g,c,'exile');}emit(g,{type:'frontier',action:'bdForage',card:-1,player:p,amount:1});g.meadowZoneBatch=old;}
export function meadowExtraCosts(g:GameState,p:PID,c:Card,alt?:CastAlt){
 if(alt==='forage')return forageOptions(g,p,c.id);
 if(c.def.meadow?.sacDiscount)return {kind:'sacAny' as const,n:0,max:g.battlefield.length,ids:g.battlefield.filter(id=>g.cards[id].controller===p&&!isLand(g.cards[id])),defaults:[] as number[]};
 return undefined;
}
export function osteoCast(g:GameState,p:PID,c:Card){return c.zone==='graveyard'&&c.owner===p&&isCreature(c)&&!!frontierFlags(g,p).bdOsteomancer;}
export function festivalCast(g:GameState,p:PID,c:Card){return c.zone==='graveyard'&&c.owner===p&&g.active===p&&c.def.types.some(t=>t==='Instant'||t==='Sorcery')&&!!frontierStatic(g,p,'blb:festival').length;}
