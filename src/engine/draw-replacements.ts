import{abilitiesOf,isLand}from'./state';
import{drawCards,modifiedDrawCount,moveCard}from'./zones';
import type{GameState,PID,SubFlow,Response}from'./types';
/** Resolve replacements before moving the next card, including draws inside older custom effects. */
export function* drawWithReplacements(g:GameState,p:PID,n:number):SubFlow<number>{
 const dredge=()=>g.battlefield.some(id=>g.cards[id].controller===p&&abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.frontier==='modern:mh3:dredgeLands'));
 if(!dredge())return drawCards(g,p,n);
 n=modifiedDrawCount(g,p,n);let drawn=0;
 for(let i=0;i<n;i++){
  const pl=g.players[p],ids=dredge()&&pl.library.length>=2?pl.graveyard.filter(id=>isLand(g.cards[id])):[];
  if(ids.length){const answer:Response=yield{type:'mode',player:p,prompt:'抓牌，或以發掘2替代？',options:['抓一張牌',...ids.map(id=>g.cards[id].def.name)],count:1,purpose:'trigger'};const mode=answer.type==='modes'?answer.picks[0]??0:0;
   if(mode>0&&ids[mode-1]!==undefined){moveCard(g,g.cards[ids[mode-1]],'hand');for(const id of pl.library.slice(0,2))moveCard(g,g.cards[id],'graveyard');continue;}
  }
  drawn+=drawCards(g,p,1,true);
 }
 return drawn;
}
