import {orbitFinalEffect} from './orbit-final';
import {finalCondition,finalAmount,finalTrigger,finalBaseStats,finalGranted,finalCanSac} from './orbit-final-support';
import {colorsOf} from './mana';
import {orbitStation} from './orbit-station';
import {abilitiesSuppressed,copiableDefinition,isCreature,matches,other,stats,shuffleArr} from './state';
import {frontierStatic,frontierFlags} from './frontier-support';
import {campusCondition,campusTrigger} from './campus-support';
import {runEffects,resolveRef} from './effects';
import type {Ctx} from './effects';
import {destroyCards,moveCard,drawCards,dealDamage,loseLife,gainLife,discardMany,enterBattlefield,putCounters,sacrifice} from './zones';
import {makeEclTokenBatch} from './ecl';
import {meadowCounter,meadowYes,meadowMode} from './meadow';
import {choose} from './tla';
import {campusPermit} from './campus';
import type {Card,CardDef,GameState,GameEvent,PID,TriggeredAbility,Effect,SubFlow,Color,ActivatedAbility} from './types';
export function orbitCondition(g:GameState,key:string,p:PID,id:number,e?:GameEvent){
 if(key.includes(':final:'))return finalCondition(g,key,p,id,e);
 const us=g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===p);
 switch(key.split(':')[1]){
 case 'beforeSecond':return g.players[p].spellsThisTurn===1;
 case 'beheld':return !!g.cards[id].eclBeheld?.length;
 case 'attackers3':return us.filter(c=>c.attacking).length>=3;
 case 'graveLeftOwnTurn':return g.active===p&&!!frontierFlags(g,p).cpGraveLeft;
 case 'diedPlus':return e?.type==='dies'&&Number(e.counterKinds?.plus??g.cards[e.card].counters)>0;
 case 'charge':return(g.cards[id].charge??0)>=Number(key.split(':')[2]);
 case 'castTwo':return g.players[p].spellsThisTurn>=2;
 case 'castBefore':return g.players[p].spellsThisTurn>0;
 case 'tappedTwo':return us.filter(c=>isCreature(c)&&c.tapped).length>=2;
 case 'oppThree':return g.battlefield.filter(id=>g.cards[id].controller!==p&&isCreature(g.cards[id])).length>=3;
 case 'oppMoreLands':return g.battlefield.filter(id=>g.cards[id].controller!==p&&g.cards[id].def.types.includes('Land')).length>us.filter(c=>c.def.types.includes('Land')).length;
 default:return campusCondition(g,key,p,id,e);
 }
}
export function orbitTrigger(g:GameState,c:Card,a:TriggeredAbility,e:GameEvent){
 if(a.frontierEvent?.includes(':final:'))return finalTrigger(g,c,a,e);
 const ec='card'in e?g.cards[e.card]:undefined;
 switch(a.frontierEvent?.split(':')[1]){
 case 'opponentDiscard':return e.type==='discard'&&e.player!==c.controller;
 case 'graveLeaveBatch':return e.type==='fin'&&e.action==='zoneMove'&&e.from==='graveyard'&&e.player===c.controller&&g.active===c.controller&&orbitGraveBatch(g,c);
 case 'graveLeaveCard':return e.type==='fin'&&e.action==='zoneMove'&&e.from==='graveyard'&&e.player===c.controller&&g.active===c.controller;
 case 'otherArtifactEtb':return e.type==='etb'&&e.controller===c.controller&&e.card!==c.id&&!!ec?.def.types.includes('Artifact');
 case 'otherArtifactCreatureEtb':return e.type==='etb'&&e.controller===c.controller&&e.card!==c.id&&!!ec?.def.types.some(t=>t==='Artifact'||t==='Creature');
 case 'artifactCreatureDies':return e.type==='permanentDies'&&e.controller===c.controller&&!!ec?.def.types.some(t=>t==='Artifact'||t==='Creature');
 case 'sacrificeOtherArtifactCreature':return e.type==='sacrifice'&&e.player===c.controller&&e.card!==c.id&&!!ec?.def.types.some(t=>t==='Artifact'||t==='Creature');
 default:return campusTrigger(g,c,a,e);
 }
}
export function orbitAmount(g:GameState,p:PID,key:string,id?:number,e?:import('./types').GameEvent){
 if(key.includes(':final:'))return finalAmount(g,p,id??-1,key,e);
 if(key==='eoe:multicolor')return g.battlefield.filter(id=>g.cards[id].controller===p&&colorsOf(g.cards[id].def).length>1).length;
 if(key==='eoe:charge')return g.cards[id!].charge??0;
 if(key==='eoe:focusFire')return 2+g.battlefield.filter(id=>g.cards[id].controller===p&&matches(g,{or:[{type:'Creature'},{sub:'Spacecraft'}]},g.cards[id],p)).length;
 throw Error('Unsupported orbit amount '+key);
}
export function orbitBaseStats(g:GameState,c:Card,st:import('./state').Stats){
 finalBaseStats(g,c,st);
 const size=c.def.meadow?.orbitSize;if(!size||abilitiesSuppressed(g,c))return;
 if(size==='turn52'&&g.active===c.controller){st.p=5;st.t=2;}
 if(size==='creatures')st.p=g.battlefield.filter(id=>g.cards[id].controller===c.controller&&isCreature(g.cards[id])).length;
 if(size==='lands')st.p=st.t=g.battlefield.filter(id=>g.cards[id].controller===c.controller&&g.cards[id].def.types.includes('Land')).length;
}
export const orbitFlash=(g:GameState,p:PID,def:CardDef)=>!!(def.types.includes('Sorcery')||def.subtypes?.includes('Dragon'))&&frontierStatic(g,p,'tdm:dragonSorceryFlash').length>0;
export function* orbitEffect(g:GameState,ctx:Ctx,ef:Extract<Effect,{e:'frontier'}>):SubFlow{
 if(ef.action.includes(':final:')){yield*orbitFinalEffect(g,ctx,ef);return;}
 const p=ctx.controller,c=g.cards[ctx.source],key=ef.action.split(':').slice(1).join(':'),victim=resolveRef(g,ctx,ef.what??'T0').cards[0];
 const effects=(list:Effect[])=>runEffects(g,ctx,list);
 if(key.startsWith('mana:')){const colors=key.slice(5).split('') as Color[];const pick=yield*meadowMode(p,'選擇法術力顏色',colors);(g.players[p].pool??=[]).push(colors[pick]??colors[0]);g.version++;return;}
 if(key.startsWith('counter:')){if(victim)meadowCounter(g,victim,key.slice(8),ef.n??1,p);return;}
 switch(key){
 case 'tempSac':if(c.zone==='battlefield'&&c.controller===p&&finalCanSac(g,c)&&(ctx.sourceLinkKey===undefined||ctx.sourceLinkKey===c.tmtLinkKey))sacrifice(g,c);break;
 case 'exileTargets':case 'bounceTargets':case 'recoverTargets':for(let i=0;i<ctx.targets.length;i++){const body=resolveRef(g,ctx,('T'+i) as 'T0').cards[0];if(!body)continue;if(key==='exileTargets')moveCard(g,body,'exile');else if(key==='bounceTargets'&&body.zone==='battlefield'||key==='recoverTargets'&&body.zone==='graveyard')moveCard(g,body,'hand');}break;
 case 'smileReturn':{const returned:Card[]=[];for(let i=0;i<ctx.targets.length;i++){const body=resolveRef(g,ctx,('T'+i) as 'T0').cards[0];if(body?.zone==='graveyard'){enterBattlefield(g,body,p);returned.push(body);}}for(const body of returned)if(body.zone==='battlefield')putCounters(g,body,1);break;}
 case 'station':orbitStation(g,ctx);break;
 case 'discardOrLose3':if(g.players[other(p)].hand.length)yield*effects([{e:'discard',who:'opp',n:1}]);else loseLife(g,other(p),3);break;
 case 'recoverSpacecraft':{const ids=g.players[p].graveyard.filter(id=>matches(g,{or:[{type:'Creature'},{sub:'Spacecraft'}]},g.cards[id],p));const[id]=yield*choose(g,p,'將生物或星艦從墳墓場回手',ids,ids.length?1:0);if(id!==undefined)moveCard(g,g.cards[id],'hand');break;}
 case 'handCreature':{const ids=g.players[p].hand.filter(id=>isCreature(g.cards[id])),[id]=yield*choose(g,p,'可將手上一張生物放進戰場',ids);if(id!==undefined)enterBattlefield(g,g.cards[id],p);break;}
 case 'legendCopy':if(victim)yield*makeEclTokenBatch(g,p,{...copiableDefinition(victim),supertypes:[...new Set([...(copiableDefinition(victim).supertypes??[]),'Legendary' as const])]},1);break;
 case 'sacPowerDraw':drawCards(g,p,Math.max(0,ctx.bdSac?.power??0));break;
 case 'exileTwoCounter':{const ids=g.players[p].graveyard.slice();if(ids.length<2||!(yield*meadowYes(p,'放逐兩張墳墓場牌以放置指示物？')))break;const chosen=yield*choose(g,p,'放逐兩張墳墓場牌',ids,2,2);for(const id of chosen)moveCard(g,g.cards[id],'exile');if(c.zone==='battlefield'&&(ctx.sourceLinkKey===undefined||ctx.sourceLinkKey===c.tmtLinkKey))putCounters(g,c,1);break;}
 case 'counterUnlessX':yield*effects([{e:'counterUnless',what:ef.what??'T0',pay:ctx.x??0}]);break;
 case 'storiesDiscard':{const hand=g.players[p].hand.slice(),creatures=hand.filter(id=>isCreature(g.cards[id]));if(creatures.length&&(yield*meadowMode(p,'選擇棄牌方式',['棄一張生物牌','棄兩張牌']))===0){const ids=yield*choose(g,p,'棄一張生物牌',creatures,1);discardMany(g,ids.map(id=>g.cards[id]));}else yield*effects([{e:'discard',who:'you',n:2}]);break;}
 case 'negotiations':{const who=resolveRef(g,ctx,'T0').players[0];if(who===undefined)break;const hand=g.players[who].hand.slice(),ids=hand.filter(id=>!g.cards[id].def.types.includes('Land'));if(hand.length&&ids.length!==hand.length)yield{type:'choose',player:p,prompt:'檢視對手展示的完整手牌',options:hand,min:0,max:0,reveal:true,purpose:'dig'};const[id]=yield*choose(g,p,'檢視對手手牌並放逐一張非地牌',ids,ids.length?1:0);if(id!==undefined)moveCard(g,g.cards[id],'exile');break;}
 case 'strategicExile':{const who=resolveRef(g,ctx,'T0').players[0];if(who===undefined)break;const ids=g.battlefield.filter(id=>g.cards[id].controller===who&&isCreature(g.cards[id])),[id]=yield*choose(g,who,'放逐一個你操控的生物',ids,ids.length?1:0);if(id!==undefined)moveCard(g,g.cards[id],'exile');for(const id of g.players[who].graveyard.slice())moveCard(g,g.cards[id],'exile');break;}
 case 'wail':{const who=resolveRef(g,ctx,'T0').players[0];if(who!==undefined)yield*effects([{e:'pump',what:{all:{type:'Creature',ctrl:who===p?'you':'opp'}},p:-1,t:-1}]);break;}
 case 'mayAttachCreated':if(c.zone==='battlefield'&&ctx.created!==undefined&&g.cards[ctx.created]?.zone==='battlefield'&&(yield*meadowYes(p,'將此武具貼附在剛派出的武僧上？')))c.attachedTo=ctx.created;break;
 case 'exileOnDeath':if(victim?.zone==='battlefield')victim.exileOnDeathTurn=g.turn;break;
 case 'impulseOne':case 'impulseTwo':{const ids=g.players[p].library.slice(0,key==='impulseOne'?1:2);for(const id of ids){const card=g.cards[id];moveCard(g,card,'exile');campusPermit(g,card,p,g.turn+(g.active===p?2:1));}break;}
 case 'flushDiscard':if(g.players[p].hand.length){yield*effects([{e:'discard',who:'you',n:1},{e:'draw',n:2}]);}break;
 case 'twinBolt':{const split=ctx.distribution??[ctx.targets[1]?1:2,1];for(let i=0;i<2;i++)if(ctx.targets[i])yield*effects([{e:'damage',to:('T'+i) as 'T0',n:split[i]??1}]);break;}
 case 'ainokLand':{const ids=(ctx.milled??[]).filter(id=>g.cards[id].zone==='graveyard'&&g.cards[id].def.types.includes('Land')),[id]=yield*choose(g,p,'可取回本次磨進墳墓場的地',ids);if(id!==undefined)moveCard(g,g.cards[id],'hand');else if(c.zone==='battlefield'&&(ctx.sourceLinkKey===undefined||c.tmtLinkKey===ctx.sourceLinkKey))putCounters(g,c,1);break;}
 case 'botanist':{const id=g.players[p].library[0];if(id===undefined)break;const card=g.cards[id];yield{type:'choose',player:p,prompt:'檢視牌庫頂牌',options:[id],min:0,max:0,reveal:true,purpose:'dig'};if(card.def.types.includes('Land')&&(yield*meadowYes(p,'展示並將牌庫頂地牌放進手上？')))moveCard(g,card,'hand');else if(yield*meadowYes(p,'將這張牌庫頂牌放進墳墓場？'))moveCard(g,card,'graveyard');break;}
 case 'nightwatch':{const ids=g.players[p].library.slice(0,3),[keep]=yield*choose(g,p,'可保留一張在牌庫頂，其餘磨進墳墓場',ids);for(const id of ids)if(id!==keep)moveCard(g,g.cards[id],'graveyard');break;}
 case 'spiritToughness':{const n=Math.max(0,...g.battlefield.map(id=>g.cards[id]).filter(x=>x.controller===p&&isCreature(x)).map(x=>stats(g,x).t));yield*makeEclTokenBatch(g,p,{id:'tok-or-spirit',name:'Spirit',set:'TOK',rarity:'T',types:['Creature'],subtypes:['Spirit'],colors:['W'],power:n,toughness:n,text:''},1);break;}
 case 'sentinelLand':yield*effects([{e:'tutor',filter:{type:'Land',basic:true},optional:true,to:g.battlefield.some(id=>g.cards[id].controller===p&&g.cards[id].def.subtypes?.includes('Dragon'))?'battlefield':'top',tapped:true}]);break;

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

function orbitGraveBatch(g:GameState,c:Card){const n=g.meadowZoneBatch??g.frontierEntryBatch??g.mshTokenGroup;if(n===undefined)return true;const m=c.frontierMarks??={};if(m.orbitGraveBatch===n)return false;m.orbitGraveBatch=n;return true;}
export function orbitGrantedAbilities(g:GameState,c:Card):ActivatedAbility[]{
 const extra=finalGranted(g,c);
 if(!g.orbitHasRinging||c.zone!=='battlefield')return extra;
 const sources=g.battlefield.map(id=>g.cards[id]).filter(a=>a.attachedTo===c.id&&a.def.abilities?.some(ab=>ab.kind==='static'&&ab.frontier==='tdm:ringing')&&!abilitiesSuppressed(g,a));
 return [...extra,...sources.map(():ActivatedAbility=>({kind:'activated',cost:{mana:'{5}'},effects:[{e:'untap',what:'self'}],label:'重置此生物'}))];
}
