import {moveCard} from './zones';
import {abilitiesSuppressed,copiableDefinition,isCreature,isLand,other} from './state';
import {campusConverge} from './campus-support';
import {frontierStatic} from './frontier-support';
import {choose} from './tla';
import type {Card,CardDef,GameState,PID,SubFlow,Zone} from './types';
export function campusEntry(g:GameState,c:Card,p:PID,origin:Zone){
 if(origin==='stack'&&/Converge[^\n]*enters with a \+1\/\+1 counter/.test(c.def.text))c.counters+=campusConverge(c);
 if(origin==='stack'&&isCreature(c))c.counters+=campusConverge(c)*frontierStatic(g,p,'sos:convergeCreatureCounters').filter(s=>s.id!==c.id).length;
 if(c.def.meadow?.campusStunX){const n=Math.max(0,3-(c.castX??0));c.stun+=n;if((c.castX??0)<=2)c.tapped=true;}
 if(c.def.name==='Temple of Cyclical Time')(c.eclCounters??={}).time=3;
 if(c.def.types.includes('Artifact')&&frontierStatic(g,other(p),'lci:opponentArtifactsTapped').length)c.tapped=true;
 if(isLand(c)&&frontierStatic(g,p,'lci:landsUntapped').length)c.tapped=false;
 if(c.frontierMarks?.cpTemporaryCreature){(g.meadowDelayed??=[]).push({id:g.nextSid++,source:c.id,controller:p,kind:'sacCreated',target:c.id,version:c.objectVersion,turn:g.turn});g.eot.push({card:c.id,p:0,t:0,kw:['haste']});}
}
export function campusRefresh(g:GameState){
 // Ordinary battlefields need only a cheap scan; libraries are never affected.
 const battlefield=g.battlefield.map(id=>g.cards[id]);
 const piranhaTargets=new Set(battlefield.filter(c=>c.attachedTo!==null&&c.def.abilities?.some(a=>a.kind==='static'&&a.frontier==='lci:skeletonAura')&&!abilitiesSuppressed(g,c)).map(c=>c.attachedTo));
 const huatli=new Set(battlefield.filter(c=>c.frontierMarks?.cpHuatliChapter).map(c=>c.controller));
 const affected=battlefield.filter(c=>c.campusOriginalDef||c.campusTypeDef||c.frontierMarks?.cpTreasureSource!==undefined||c.frontierMarks?.cpLockedTapped||c.frontierMarks?.cpVampire||c.frontierMarks?.cpHuatliMana||piranhaTargets.has(c.id)||huatli.has(c.controller)||c.eclType&&c.def.abilities?.some(a=>a.kind==='static'&&a.frontier==='lci:chosenCreatureType'));
 const bats=g.players.flatMap(p=>p.exile).map(id=>g.cards[id]).filter(c=>c.frontierMarks?.cpBatSource!==undefined);
 for(const c of [...affected,...bats]){

  if(c.frontierMarks?.cpBatSource!==undefined&&c.zone==='exile'){const source=g.cards[c.frontierMarks.cpBatSource];if(source?.zone!=='battlefield'||source.objectVersion!==c.frontierMarks.cpBatVersion){delete c.frontierMarks.cpBatSource;moveCard(g,c,'hand');}}
  if(c.zone!=='battlefield')continue;
  if(!c.tapped&&c.frontierMarks)delete c.frontierMarks.cpLockedTapped;
  if(c.frontierMarks?.cpTreasureSource!==undefined){const source=g.cards[c.frontierMarks.cpTreasureSource];if(source?.zone!=='battlefield'||source.objectVersion!==c.frontierMarks.cpTreasureVersion){if(c.campusOriginalDef)c.def=c.campusOriginalDef;c.campusOriginalDef=undefined;delete c.frontierMarks.cpTreasureSource;}}
  if(c.campusTypeDef){c.def=c.campusTypeDef;c.campusTypeDef=undefined;}
  const piranhas=piranhaTargets.has(c.id);
  const ownType=!abilitiesSuppressed(g,c)&&c.eclType&&c.def.abilities?.some(a=>a.kind==='static'&&a.frontier==='lci:chosenCreatureType');
  if(piranhas||ownType||c.frontierMarks?.cpVampire){c.campusTypeDef=c.def;c.def=piranhas?{...c.def,types:['Creature'],subtypes:['Skeleton'],colors:['B'],power:1,toughness:1}:{...c.def,subtypes:[...new Set([...(c.def.subtypes??[]),...(ownType?[c.eclType!]:[]),...(c.frontierMarks?.cpVampire?['Vampire']:[])])]};}
  if(isCreature(c)){const granted=huatli.has(c.controller);if(granted)(c.frontierMarks??={}).cpHuatliMana=1;else if(c.frontierMarks)delete c.frontierMarks.cpHuatliMana;}
 }
}
export function* campusBeforeEntry(g:GameState,c:Card,p:PID):SubFlow<CardDef|undefined>{
 const ids=g.players.flatMap(pl=>pl.graveyard).filter(id=>isLand(g.cards[id])),[id]=yield*choose(g,p,'可複製墳墓場的一張地牌（橫置進場）',ids);
 if(id===undefined)return;const def=copiableDefinition(g.cards[id]);return{...def,subtypes:[...new Set([...(def.subtypes??[]),'Cave'])],etbTapped:true,ecl:undefined};
}
