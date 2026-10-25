import {campusDiscover,campusPermit} from './campus';
import {campusConverge} from './campus-support';
import {copiableDefinition,isCreature,isLand,matches,newCard,other,rand,shuffleArr,stats} from './state';
import {frontierFlags} from './frontier-support';
import {manaValue,parseCost} from './mana';
import {canPayCost,payCost} from './actions';
import {choose,freeCast,target} from './tla';
import {makeEclTokenBatch} from './ecl';
import {resolveRef,runEffects,type Ctx} from './effects';
import {meadowCounter,meadowMode,meadowYes,meadowEffect} from './meadow';
import {dealDamage,discardMany,drawCards,enterBattlefield,gainLife,loseLife,moveCard,putCounters,sacrifice,tapCard,destroyCards} from './zones';
import type {Card,CardDef,Color,Effect,GameState,PID,SubFlow} from './types';
export function* campusSosEffect(g:GameState,original:Ctx,ef:Extract<Effect,{e:'frontier'}>):SubFlow{
 const action=ef.action.slice(4),offset=typeof ef.what==='string'&&/^T\d+$/.test(ef.what)?Number(ef.what.slice(1)):0,ctx={...original,targets:original.targets.slice(offset)},p=ctx.controller,src=g.cards[ctx.source],ev=ctx.ev;
 const chosen=resolveRef(g,ctx,'T0').cards[0],player=resolveRef(g,ctx,'T0').players[0]??p,run=(effects:Effect[])=>runEffects(g,ctx,effects),ours=(filter:import('./types').Filter={})=>g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===p&&matches(g,filter,c,p,src.id));
 const tk=(id:string|CardDef,n=1,who=p)=>makeEclTokenBatch(g,who,id,n),pick=(ids:number[],text:string,min=0,max=1,who=p)=>choose(g,who,text,ids,min,max);
 const fractal=function*(n:number,count=1):SubFlow{const ts=yield*tk('tok-cp-fractal',count);for(const c of ts)putCounters(g,c,n,undefined,p);};
 const copy=()=>run([{e:'copySpell'}]);
 const pay=function*(mana:string):SubFlow<boolean>{return canPayCost(g,p,parseCost(mana))&&(yield*meadowYes(p,'是否支付'+mana+'？'))&&payCost(g,p,parseCost(mana));};
 const impulse=function*(until=g.turn+2):SubFlow{const id=g.players[p].library[0];if(id!==undefined){moveCard(g,g.cards[id],'exile');campusPermit(g,g.cards[id],p,until);}};
 switch(action){
 case 'freeGraveSpell':if(chosen?.zone==='graveyard'&&(yield*meadowYes(p,'免費施放墳墓場咒語？'))){chosen.finExileOnResolve=true;yield*freeCast(g,ctx,chosen);}break;
 case '5':{const n=campusConverge(src);if(n&&(yield*meadowYes(p,'抓'+n+'張後棄兩張？'))){drawCards(g,p,n);yield*run([{e:'discard',n:2,who:'you'}]);}break;}
 case 'tapOrUntap':if(chosen&&(yield*meadowYes(p,'橫置或重置？'))){if(chosen.tapped)chosen.tapped=false;else tapCard(g,chosen);}break;
 case 'swords':if(chosen){const who=chosen.controller,n=stats(g,chosen).p;moveCard(g,chosen,'exile');gainLife(g,who,n);}break;
 case 'blinkEnd':yield*meadowEffect(g,ctx,{...ef,action:'blb:returnNext'});break;
 case 'inkTarget':yield*tk('tok-cp-inkling',1,player);break;
 case 'inkController':if(chosen)yield*tk('tok-cp-inkling',1,chosen.controller);break;
 case 'countersPlayer':for(const c of g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===player&&isCreature(c)))putCounters(g,c,1,undefined,p);break;
 case 'doubleOrLifelink':if(chosen){const n=yield*meadowMode(p,'選擇異能',['連擊','繫命']);yield*run([{e:'pump',what:'T0',p:0,t:0,kw:[n===0?'double_strike':'lifelink']}]);}break;
 case 'toHandTargets':for(const t of ctx.targets)if(t&&'c'in t&&g.cards[t.c].zone==='graveyard')moveCard(g,g.cards[t.c],'hand');break;
 case 'copyToPlayer':{const t=original.targets[0],c=t&&'c'in t?g.cards[t.c]:undefined;if(c?.zone==='battlefield')yield*tk(copiableDefinition(c),1,player);break;}
 case '45':{const gy=g.players[p].graveyard;if(gy.length>=8&&(yield*meadowYes(p,'放逐八張墳墓場牌以準備？'))){for(const id of yield*pick(gy.slice(),'放逐八張牌',8,8))moveCard(g,g.cards[id],'exile');yield*run([{e:'prepare',what:'self'}]);}break;}
 case 'fractalDrawn':yield*fractal(g.players[p].drawsThisTurn);break;
 case 'fractalize':if(chosen){const n=(ctx.x??0)+1;g.eot.push({card:chosen.id,p:0,t:0,kw:[],base:{p:n,t:n}}as any);chosen.baseDef??=chosen.def;chosen.def={...chosen.def,colors:['G','U'],subtypes:['Fractal']};}break;
 case 'brainstorm':drawCards(g,p,3);for(const id of yield*pick(g.players[p].hand.slice(),'選兩張放回牌庫頂',2,2))moveCard(g,g.cards[id],'library');break;
 case 'spellMana':{let cols:Color[]=ef.n===2?['U']:ef.n===3?['R','R']:ef.n===4?['U','R']:[];if(!cols.length){const i=yield*meadowMode(p,'選擇限定法術力',['白','藍','黑','紅','綠']);cols=Array.from({length:ef.n===5?2:1},()=>['W','U','B','R','G'][i]as Color);}for(const mana of cols)(g.players[p].eclRestrictedMana??=[]).push({mana,rule:'campusSpell'});break;}
 case 'fractalXAll':yield*tk('tok-cp-fractal',ctx.x??0);for(const c of ours({sub:'Fractal'}))putCounters(g,c,ctx.x??0,undefined,p);break;
 case '57':if(chosen){const n=chosen.manaSpent??0,hasWizard=ours({sub:'Wizard'}).length;yield*run([{e:'counter',what:'T0'}]);if(hasWizard)(g.campusDelayed??=[]).push({kind:'nextMainMana',player:p,source:src.id,n,turn:g.turn});}break;
 case 'stunTwiceX':if(chosen)meadowCounter(g,chosen,'stun',2*(ctx.x??0),p);break;
 case '69':{const max=src.counters;if(max<1)break;const options=Array.from({length:max+1},(_,i)=>String(i)),n=yield*meadowMode(p,'選擇支付X並移動的指示物',options);if(n&&canPayCost(g,p,parseCost('{'+n+'}'))&&payCost(g,p,parseCost('{'+n+'}'))){yield*target(g,ctx,{kind:'creature',notSelf:true},[{e:'frontier',action:'sos:moveSelfPlus',n}]);}break;}
 case 'moveSelfPlus':if(chosen){const n=Math.min(ef.n??0,src.counters);src.counters-=n;putCounters(g,chosen,n,undefined,p);}break;
 case 'returnAllSpells':for(const id of [...g.players[p].graveyard])if(g.cards[id].def.types.some(t=>t==='Instant'||t==='Sorcery'))moveCard(g,g.cards[id],'hand');break;
 case 'noHandLimit':g.players[p].noHandLimit=true;break;
 case '81':{const cs=g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===player&&c.def.types.some(t=>t==='Creature'||t==='Planeswalker')),n=Math.max(-1,...cs.map(c=>manaValue(c.def))),[id]=yield*pick(cs.filter(c=>manaValue(c.def)===n).map(c=>c.id),'放逐法術力值最大者',1,1,player);if(id!==undefined)moveCard(g,g.cards[id],'exile');break;}
 case '83':if(chosen){const who=chosen.controller;destroyCards(g,[chosen]);if(g.players[p].lifeGainedThisTurn>0)loseLife(g,who,3);}break;
 case 'reanimateLife':if(chosen?.zone==='graveyard'){const n=manaValue(chosen.def);enterBattlefield(g,chosen,p);loseLife(g,p,n);}break;
 case '94':{const order=[g.active,other(g.active)]as PID[];for(const who of order)loseLife(g,who,Math.floor(g.players[who].life/2));for(const who of order){const hand=g.players[who].hand.slice(),n=Math.floor(hand.length/2);discardMany(g,(yield*pick(hand,'棄一半手牌',n,n,who)).map(id=>g.cards[id]));}for(const who of order){const bf=g.battlefield.filter(id=>g.cards[id].controller===who),m=Math.floor(bf.length/2);for(const id of yield*pick(bf,'犧牲一半永久物',m,m,who))sacrifice(g,g.cards[id]);}break;}
 case '96':for(const t of ctx.targets)if(t&&'c'in t){const c=g.cards[t.c];g.eot.push({card:c.id,p:1,t:0,kw:[]});(c.frontierMarks??={}).cpRabid=g.turn;}break;
 case 'discardTargets':for(const t of ctx.targets)if(t&&'p'in t){const[id]=yield*pick(g.players[t.p].hand.slice(),'棄一張',1,1,t.p);if(id!==undefined)discardMany(g,[g.cards[id]]);}break;
 case '97':{let n=0;for(let i=0;i<5;i++)if(rand(g)<.5)n++;g.players[player].campusSkipTurns=(g.players[player].campusSkipTurns??0)+n;break;}
 case '107':if(chosen){const n=campusConverge(src),before=Math.max(0,stats(g,chosen).t-chosen.damage),damage=dealDamage(g,src,p,{c:chosen.id},n),excess=Math.max(0,damage-before);for(let i=0;i<excess;i++)yield*impulse();}break;
 case 'copySpell':yield*meadowEffect(g,ctx,{...ef,what:'T0',action:'blb:copySpell'});break;
 case 'copyCreatureSpell':if(chosen&&!chosen.def.meadow?.cantCopy){yield*meadowEffect(g,ctx,{...ef,what:'T0',action:'blb:copySpell'});const cp=g.stack.at(-1);if(cp&&cp.cardId!==chosen.id){const c=g.cards[cp.cardId];(c.frontierMarks??={}).cpTemporaryCreature=1;}}break;
 case 'grantFlashback':if(chosen)(chosen.tempFlashbackTurn=g.turn);break;
 case '118':if(chosen){const who=chosen.controller;dealDamage(g,src,p,{c:chosen.id},6);const[id]=yield*pick(g.players[p].graveyard.slice(),'可放逐一張牌以對操控者造成2傷害');if(id!==undefined){moveCard(g,g.cards[id],'exile');dealDamage(g,src,p,{p:who},2);}}break;
 case 'noPrevention':frontierFlags(g,p).bdNoPrevent=1;break;
 case '120':{const ids:number[]=[];let sum=0;while(g.players[p].library.length&&sum<4){const c=g.cards[g.players[p].library[0]];moveCard(g,c,'exile');sum+=manaValue(c.def);ids.push(c.id);}while(true){const options=ids.filter(id=>g.cards[id].zone==='exile'&&!isLand(g.cards[id])),[id]=yield*pick(options,'可免費施放一張翻出的牌');if(id===undefined)break;if(!(yield*freeCast(g,ctx,g.cards[id])))break;}break;}
 case '124':{const[id]=yield*pick(ours({type:'Artifact'}).map(c=>c.id),'可犧牲神器以複製咒語');if(id!==undefined){sacrifice(g,g.cards[id]);yield*copy();}break;}
 case 'redPowerMana':for(let i=0;i<Math.max(0,stats(g,src).p);i++)(g.players[p].pool??=[]).push('R');break;
 case 'nextCopy':frontierFlags(g,p).cpNextCopy=(frontierFlags(g,p).cpNextCopy??0)+1;break;
 case 'rubbleDamage':g.pending.push({source:src.id,controller:p,abilityIndex:-320,ev:{type:'frontier',action:'cpReflexive',card:src.id,player:p,amount:1},ability:{kind:'trigger',on:'frontierEvent',effects:[{e:'damage',n:1,to:'opp'}]}});break;
 case 'rummagePlayer':{const hand=g.players[player].hand.slice(),ids=yield*pick(hand,'可棄任意數量手牌',0,hand.length,player);discardMany(g,ids.map(id=>g.cards[id]));drawCards(g,player,ids.length);break;}
 case 'millPlay':{const id=g.players[p].library[0];if(id!==undefined){moveCard(g,g.cards[id],'graveyard');campusPermit(g,g.cards[id],p);(g.cards[id].frontierMarks??={}).cpGravePlay=g.turn;}break;}
 case '140':{const counters=ev?.type==='dies'?ev.counterKinds:src.lastCounterKinds,plus=Number(counters?.plus??0);const ts=yield*tk('tok-cp-fractal');for(const c of ts){putCounters(g,c,plus,undefined,p);for(const[k,n]of Object.entries(counters??{}))if(k!=='plus'&&k!=='minus'&&Number(n)>0)meadowCounter(g,c,k,Number(n),p);}break;}
 case 'growthCounter':meadowCounter(g,src,'growth');break;
 case 'fractalLandNames':yield*fractal(new Set(ours({type:'Land'}).map(c=>c.def.name)).size);break;
 case 'searchFourBasics':for(let i=0;i<4;i++)yield*run([{e:'tutor',filter:{type:'Land',basic:true},to:'battlefield',tapped:true}]);break;
 case 'fractalConvergePair':{const n=campusConverge(src);yield*fractal(n,2);gainLife(g,p,n);break;}
 case 'fractalX':yield*fractal(ctx.x??0);break;case 'fractalThree':yield*fractal(3);break;
 case '169':{const top=g.players[p].library.slice(0,5),ids=yield*pick(top.filter(id=>isLand(g.cards[id])||isCreature(g.cards[id])),'可揭示至多兩張生物或地',0,2);for(const id of ids)if(isLand(g.cards[id]))enterBattlefield(g,g.cards[id],p,true);else moveCard(g,g.cards[id],'hand');const rest=top.filter(id=>!ids.includes(id));shuffleArr(g,rest);for(const id of rest)moveCard(g,g.cards[id],'library',true);break;}
 case '172':if(chosen){const def=copiableDefinition(chosen);const ts=yield*tk({...def,types:[...new Set([...def.types,'Creature' as const])],subtypes:[...(def.subtypes??[]),'Fractal'],power:0,toughness:0});for(const c of ts)putCounters(g,c,6,undefined,p);}break;
 case '174':{const ids=ours({type:'Creature',tapped:false}).map(c=>c.id);if(ids.length>=3&&(yield*meadowYes(p,'橫置三個生物以複製？'))){for(const id of yield*pick(ids,'橫置三個生物',3,3))tapCard(g,g.cards[id]);yield*copy();}break;}
 case 'discardHandDrawOpp':{const n=g.players[player].hand.length;discardMany(g,g.players[p].hand.map(id=>g.cards[id]));drawCards(g,p,n);break;}
 case 'rummageAll':{const ids=g.players[p].hand.slice();discardMany(g,ids.map(id=>g.cards[id]));drawCards(g,p,ids.length);break;}
 case 'rummagePlus':{const ids=yield*pick(g.players[p].hand.slice(),'棄任意張再抓多一張',0,g.players[p].hand.length);discardMany(g,ids.map(id=>g.cards[id]));drawCards(g,p,ids.length+1);break;}
 case '184':{const ids=g.players[p].library.filter(id=>isCreature(g.cards[id])),[id]=yield*pick(ids,'搜尋生物');if(id!==undefined){const gy=yield*meadowYes(p,'放入手牌？否則放入墳墓場');moveCard(g,g.cards[id],gy?'hand':'graveyard');}shuffleArr(g,g.players[p].library);break;}
 case 'impulseNext':yield*impulse();break;
 case '188':for(const id of[...g.players[p].graveyard])if(g.cards[id].def.types.some(t=>t==='Artifact'||t==='Creature')&&manaValue(g.cards[id].def)===(ctx.x??0))enterBattlefield(g,g.cards[id],p);break;
 case '197':if(src.zone==='graveyard'&&(yield*pay('{W/B}')))moveCard(g,src,'hand');break;
 case '202':{const[id]=yield*pick(g.players[p].hand.filter(id=>!g.cards[id].def.types.some(t=>t==='Instant'||t==='Sorcery')&&manaValue(g.cards[id].def)<=(ctx.x??0)),'可放一張永久物進場');if(id!==undefined)enterBattlefield(g,g.cards[id],p,true);break;}
 case '203':{const old=g.players[player].hand.slice();yield*run([{e:'discard',n:2,who:'T0'}]);const lands=old.filter(id=>g.cards[id].zone==='graveyard'&&isLand(g.cards[id])),[id]=yield*pick(lands,'可放一張被棄的地進場');if(id!==undefined)enterBattlefield(g,g.cards[id],p,true);break;}
 case '206':if(chosen?.zone==='graveyard'){moveCard(g,chosen,'exile');campusPermit(g,chosen,p);(chosen.frontierMarks??={}).cpAnyMana=g.turn;chosen.finExileOnResolve=true;}break;
 case 'exileGraveNext':if(chosen?.zone==='graveyard'){moveCard(g,chosen,'exile');campusPermit(g,chosen,p,g.turn+2);}break;
 case 'base55':if(chosen)g.eot.push({card:chosen.id,p:0,t:0,kw:[],base:{p:5,t:5}}as any);break;
 case '222':for(const c of ours({type:'Creature'}))(c.frontierMarks??={}).cpRootAttack=g.turn;break;
 case 'moveDeadCounters':if(chosen){const counters=ev?.type==='dies'?ev.counterKinds:src.lastCounterKinds;putCounters(g,chosen,Number(counters?.plus??0),undefined,p);for(const[k,n]of Object.entries(counters??{}))if(k!=='plus'&&k!=='minus'&&Number(n)>0)meadowCounter(g,chosen,k,Number(n),p);}break;
 case '236':{const cards:Card[]=[];if(chosen?.zone==='battlefield')cards.push(chosen);const top=g.players[p].library[0];if(top!==undefined)cards.push(g.cards[top]);for(const c of cards){moveCard(g,c,'exile');campusPermit(g,c,c.owner,g.turn+(c.owner===g.active?2:1));}break;}
 case '241':destroyCards(g,g.battlefield.map(id=>g.cards[id]).filter(c=>c.def.types.some(t=>t==='Artifact'||t==='Creature')&&manaValue(c.def)<=(ctx.x??0)));break;
 case 'exileDamaged':if(chosen)(chosen.frontierMarks??={}).cpExileDeath=g.turn;break;
 case 'pageCounter':meadowCounter(g,src,'page');break;
 case '250':{const ids:number[]=[];let found:Card|undefined;while(g.players[p].library.length){const c=g.cards[g.players[p].library[0]];ids.push(c.id);if(c.def.types.some(t=>t==='Instant'||t==='Sorcery')){found=c;break;}moveCard(g,c,'exile');}if(found)moveCard(g,found,'hand');const rest=ids.filter(id=>g.cards[id].zone==='exile');shuffleArr(g,rest);for(const id of rest)moveCard(g,g.cards[id],'library',true);break;}
 case '257':yield*run([{e:'animate',what:'self',p:2,t:4,subtypes:['Wizard'],permanent:true}]);src.def={...src.def,abilities:[...(src.def.abilities??[]),{kind:'trigger',on:'castInstSorc',effects:[{e:'pump',what:'self',p:1,t:0}]}]};break;
 case 'hasteCreated':for(const id of original.createdList??[])g.eot.push({card:id,p:0,t:0,kw:['haste']});break;
 case 'cantBlock':if(chosen)g.eot.push({card:chosen.id,p:0,t:0,kw:[],cantBlock:true});break;
 case 'mayPutLand':{const[id]=yield*pick(g.players[p].hand.filter(id=>isLand(g.cards[id])),'可放一張地進場');if(id!==undefined)enterBattlefield(g,g.cards[id],p,true);break;}
 case 'delayedMana':for(let i=0;i<(ef.n??0);i++)(g.players[p].pool??=[]).push('C');break;
 case 'draw1':drawCards(g,p,1);break;
 case 'gain1':gainLife(g,p,1);break;
 case 'copyCast':yield*copy();break;
 case 'stormCopies':for(let i=0;i<(ef.n??0);i++)yield*copy();break;
 case 'cascade':yield*campusDiscover(g,ctx,ef.n??0,true);break;
 case 'paradigm':if(src.zone==='stack'){moveCard(g,src,'exile');if(!g.campusParadigms?.some(x=>x.name===src.def.name&&x.player===p)){(g.campusParadigms??=[]).push({name:src.def.name,player:p,card:src.id,version:src.objectVersion??0});(src.frontierMarks??={}).cpParadigmController=p+1;}}break;
 case 'paradigmCopy':if(src.zone==='exile'&&(yield*meadowYes(p,'範式：免費施放此咒語的複製？'))){const def={...src.def,meadow:{...src.def.meadow,paradigm:false},spell:{...src.def.spell,effects:src.def.spell?.effects?.filter(e=>e.e!=='frontier'||e.action!=='sos:paradigm'),modes:src.def.spell?.modes?.map(m=>({...m,effects:m.effects.filter(e=>e.e!=='frontier'||e.action!=='sos:paradigm')}))}},cp=newCard(g,def,p,true);cp.zone='hand';g.players[p].hand.push(cp.id);yield*freeCast(g,ctx,cp);}break;
 case 'miracle':if(src.zone==='hand'&&(yield*meadowYes(p,'展示並以奇蹟費用{2}施放？')))yield*freeCast(g,ctx,src,false,'campusMiracle');break;
 default:throw Error('Unsupported SOS effect '+action);
 }
}
