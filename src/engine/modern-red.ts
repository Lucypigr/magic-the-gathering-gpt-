import { getDef } from './registry';
import { abilitiesOf, log } from './state';
import { parseCost } from './mana';
import { payCost } from './actions';
import { moveCard } from './zones';
import { freeCast } from './tla';
import { meadowYes } from './meadow';
import { runEffects, type Ctx } from './effects';
import type { Card, Effect, GameEvent, GameState, PID, SubFlow } from './types';
export function redCage(g:GameState):boolean {
  return g.battlefield.some(id=>abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.frontier==='modern:red:cage'));
}
export const redCastBlocked=(g:GameState,c:Card)=>['graveyard','library'].includes(c.zone)&&redCage(g);
export function redEntryBlocked(g:GameState,c:Card):boolean {
  if(c.token||!['graveyard','library'].includes(c.zone))return false;
  let printed=c.front??c.def;
  try{printed=getDef(printed.id);}catch{/* Isolated/custom game definitions keep their own identity. */}
  return printed.types.includes('Creature')&&redCage(g);
}
export const redMastery=(g:GameState,c:Card)=>c.zone==='stack'&&!!c.def.meadow?.modernRedMastery&&g.players[c.controller].graveyard.filter(id=>g.cards[id].def.types.some(t=>t==='Instant'||t==='Sorcery')).length>=2;
export function redDamage(g:GameState,victim:PID,n:number) {
  if(g.modernRed?.turn!==g.turn)g.modernRed={turn:g.turn,damage:[0,0]};
  g.modernRed.damage[victim]+=n;
}
export const redDiscount=(g:GameState,p:PID)=>g.modernRed?.turn===g.turn?g.modernRed.damage[p===0?1:0]:0;
export function redObserve(g:GameState,ev:GameEvent) {
  if(ev.type!=='step'||ev.step!=='upkeep')return;
  for(const id of g.players[ev.player].exile){const c=g.cards[id];
    if(!c.def.meadow?.modernRedSuspend||(c.eclCounters?.time??0)<=0)continue;
    const version=c.objectVersion??0;c.modernSuspended??={player:ev.player,version};
    g.pending.push({source:id,controller:ev.player,abilityIndex:-471,ev,ability:{kind:'trigger',on:'upkeep',effects:[{e:'frontier',action:'modern:red:removeTime',n:version}]}});
  }
}
export function redSuspend(g:GameState,p:PID,c:Card,timingAllowed:boolean):string|null {
  if(c.zone!=='hand'||c.owner!==p||!c.def.meadow?.modernRedSuspend)return '不能延緩這張牌';
  if(!timingAllowed)return '目前不能以此時機延緩';
  if(!payCost(g,p,parseCost(String(c.def.meadow.modernRedSuspend))))return '法術力不足以支付延緩費用';
  moveCard(g,c,'exile');(c.eclCounters??={}).time=1;c.modernSuspended={player:p,version:c.objectVersion??0};
  log(g,'延緩1：放逐此牌並放上一個時間指示物',p);return null;
}
export function redEntry(g:GameState,c:Card,from:string) {
  const turn=c.frontierMarks?.modernArenaHaste;
  if(c.frontierMarks)delete c.frontierMarks.modernArenaHaste;
  if(from==='stack'&&turn===g.turn)g.eot.push({card:c.id,p:0,t:0,kw:['haste']});
}
export function* redEffect(g:GameState,ctx:Ctx,ef:Extract<Effect,{e:'frontier'}>):SubFlow {
  const c=g.cards[ctx.source],p=ctx.controller;
  switch(ef.action.slice(11)) {
    case 'arena':g.players[p].modernArenaMana=(g.players[p].modernArenaMana??0)+2;break;
    case 'incinerate':if(ctx.ev?.type==='frontier')yield*runEffects(g,ctx,[{e:'damage',to:'T0',n:ctx.ev.amount}]);break;
    case 'removeTime':
      if(c.zone==='exile'&&(c.objectVersion??0)===ef.n&&(c.eclCounters?.time??0)>0){
        c.eclCounters!.time!--;
        if(c.eclCounters!.time===0)g.pending.push({source:c.id,controller:p,abilityIndex:-472,ev:ctx.ev!,ability:{kind:'trigger',on:'frontierEvent',effects:[{e:'frontier',action:'modern:red:suspendCast',n:ef.n}]}});
      }break;
    case 'suspendCast':
      if(c.zone==='exile'&&(c.objectVersion??0)===ef.n){
        c.modernSuspended=undefined;
        if(yield*meadowYes(p,'施放已移去最後時間指示物的牌，不支付法術力費用？')){
          if(yield*freeCast(g,ctx,c,false,'modernSuspended'))delete c.eclCounters?.time;
        }
      }break;
    default:throw Error('Unknown red effect '+ef.action);
  }
}
