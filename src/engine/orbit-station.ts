import {abilitiesSuppressed,isCreature,stats} from './state';
import {meadowCounter} from './meadow';
import type {Ctx} from './effects';
import type {Card,GameState} from './types';
/** Station changes types continuously; the type change is not a copiable value. */
export function orbitRefresh(g:GameState,entering?:Card){
 if(entering?.def.meadow?.orbitStationAt)g.orbitHasStation=true;
 if(!g.orbitHasStation)return;
 for(const id of g.battlefield){
  const c=g.cards[id],wasCreature=isCreature(c);
  if(c.orbitTypeDef){if(c.def===c.orbitAppliedDef)c.def=c.orbitTypeDef;c.orbitTypeDef=undefined;c.orbitAppliedDef=undefined;}
  const threshold=Number(c.def.meadow?.orbitStationAt??0);
  if(threshold&&(c.charge??0)>=threshold&&!c.def.types.includes('Creature')){c.orbitTypeDef=c.def;c.def={...c.def,types:[...new Set([...c.def.types,'Creature' as const])]};c.orbitAppliedDef=c.def;}
  if(wasCreature&&!isCreature(c)){c.attacking=false;c.blockedBy=[];}
 }
}
export function orbitStation(g:GameState,ctx:Ctx){
 const source=g.cards[ctx.source],paid=ctx.orbitStation;
 if(!source||source.zone!=='battlefield'||ctx.sourceLinkKey!==undefined&&source.tmtLinkKey!==ctx.sourceLinkKey||!paid)return;
 const body=g.cards[paid.card];if(!body)return;
 const power=body.zone==='battlefield'&&(body.objectVersion??0)===paid.version?stats(g,body).p:body.orbitPowerHistory?.[paid.version]??0;
 meadowCounter(g,source,'charge',Math.max(0,power),ctx.controller);
 orbitRefresh(g);
}
export function orbitStationStats(g:GameState,c:Card,st:import('./state').Stats){
 const level=c.def.meadow?.orbitStationAt,keywords=c.def.meadow?.orbitStationKeywords;
 if(level&&keywords&&(c.charge??0)>=Number(level)&&!abilitiesSuppressed(g,c))for(const kw of String(keywords).split(',') as import('./types').Keyword[])st.kw.add(kw);
}
