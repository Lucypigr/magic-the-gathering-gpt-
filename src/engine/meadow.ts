import {finalCounterMultiplier} from './orbit-final-support';
import {dftEffect} from './meadow-dft';
import {abilitiesSuppressed,copiableDefinition,isCreature,isLand,matches,other,shuffleArr,stats} from './state';
import {canPayCost,payCost} from './actions';
import {manaValue,parseCost} from './mana';
import {choose,freeCast} from './tla';
import {makeEclTokenBatch} from './ecl';
import {canReceiveCounters} from './ecl-support';
import {runEffects,resolveRef,type Ctx} from './effects';
import {dealDamage,discardMany,drawCards,emit,enterBattlefield,gainLife,loseLife,moveCard,putCounters,sacrifice,tapCard,destroyCards} from './zones';
import {frontierFlags,frontierStatic} from './frontier-support';
import type {Ability,Card,CardDef,Color,Effect,GameState,PID,Response,SubFlow} from './types';
export function* meadowYes(p:PID,prompt:string):SubFlow<boolean>{const r:Response=yield{type:'yesno',player:p,prompt};return r.type==='yesno'&&r.yes;}
export function* meadowMode(p:PID,prompt:string,options:string[]):SubFlow<number>{const r:Response=yield{type:'mode',player:p,prompt,options,count:1,purpose:'trigger'};return r.type==='modes'?r.picks[0]??0:0;}
export function meadowCounter(g:GameState,c:Card,kind:string,n=1,actor:PID=c.controller){
 if(c.zone!=='battlefield'||n<=0||!canReceiveCounters(g,c))return;
 if(kind==='+1/+1'){putCounters(g,c,n,undefined,actor);return;}
 n*=finalCounterMultiplier(g,c)*2**(frontierStatic(g,c.controller,'fdn:doubleCounters').length+frontierStatic(g,actor,'blb:innkeeperCounters').filter(c=>(c.classLevel??1)>=3).length);
 if(kind==='loyalty')c.loyalty=(c.loyalty??0)+n;else if(kind==='stun')c.stun+=n;else if(kind==='charge'){
  // Older sets use the generic counter field for charge counters.
  if(['FDN','DSK','TLA','TMT','ECL','FIN','BLB','DFT','EOE','TDM'].includes(c.def.set))c.charge=(c.charge??0)+n;else c.counters+=n;
 }else if(kind==='lore')c.lore=(c.lore??0)+n;else if(kind==='hexproof')c.hexproofCounters=(c.hexproofCounters??0)+n;else if(kind==='finality'){c.finalityCount=(c.finality?Math.max(1,c.finalityCount??1):0)+n;c.finality=true;}else(c.eclCounters??={})[kind]=(c.eclCounters?.[kind]??0)+n;
 emit(g,{type:'counterPlaced',card:c.id,controller:c.controller,amount:n,actor,counterKind:kind});if(kind==='loyalty')emit(g,{type:'loyaltyPlaced',card:c.id,controller:c.controller,amount:n});
}
export function* meadowForage(g:GameState,p:PID):SubFlow<boolean>{
 const foods=g.battlefield.filter(id=>g.cards[id].controller===p&&matches(g,{sub:'Food'},g.cards[id],p)),grave=g.players[p].graveyard;
 if(!foods.length&&grave.length<3||!(yield*meadowYes(p,'是否掘食？')))return false;
 if(foods.length&&(grave.length<3||(yield*meadowMode(p,'掘食方式',['犧牲食物','放逐墳墓場三張牌']))===0)){const[id]=yield*choose(g,p,'犧牲食物',foods,1);if(id===undefined)return false;sacrifice(g,g.cards[id]);}
 else{const ids=yield*choose(g,p,'放逐墳墓場三張牌',grave.slice(),3,3);if(ids.length!==3)return false;for(const id of ids)moveCard(g,g.cards[id],'exile');}
 emit(g,{type:'frontier',action:'bdForage',player:p,card:-1,amount:1});return true;
}
export function meadowSchedule(g:GameState,ctx:Ctx,kind:string,c?:Card,extra:Partial<NonNullable<GameState['meadowDelayed']>[number]>={}){const d={id:g.nextSid++,source:ctx.source,controller:ctx.controller,kind,target:c?.id,version:c?.objectVersion,turn:g.turn,...extra};(g.meadowDelayed??=[]).push(d);return d;}
export function* meadowBeforeEntry(g:GameState,ctx:Ctx,c:Card):SubFlow<CardDef|undefined>{
 const kind=c.def.meadow?.asEnters;
 if(kind==='mimeoplasm'){
  c.meadowLinked=[];const ids=yield*choose(g,ctx.controller,'可放逐至多X張墳墓場生物牌',g.players[ctx.controller].graveyard.filter(id=>isCreature(g.cards[id])),0,ctx.x??0);
  const old=g.meadowZoneBatch;g.meadowZoneBatch=g.nextSid++;for(const id of ids){moveCard(g,g.cards[id],'exile');c.meadowLinked.push(id);(c.frontierMarks??={})['bdMime:'+id]=g.cards[id].objectVersion??0;}g.meadowZoneBatch=old;
  (c.finMarks??={}).enterCounters=3*ids.length;return;
 }
 if(kind!=='mockingbird'&&kind!=='waxen')return;
 const ids=g.battlefield.filter(id=>kind==='waxen'?g.cards[id].controller===ctx.controller&&(isCreature(g.cards[id])||g.cards[id].def.types.includes('Artifact')):isCreature(g.cards[id])&&manaValue(g.cards[id].def)<=(c.zone==='stack'?c.manaSpent??0:0));
 const[id]=yield*choose(g,ctx.controller,'可選擇要複製的永久物',ids,0);if(id===undefined)return;
 const def=copiableDefinition(g.cards[id]);return kind==='waxen'?{...def}:{...def,subtypes:[...new Set([...(def.subtypes??[]),'Bird'])],keywords:[...new Set([...(def.keywords??[]),'flying' as const])]};

}
export function* meadowEffect(g:GameState,original:Ctx,ef:Extract<Effect,{e:'frontier'}>):SubFlow{
 const [set,...rest]=ef.action.split(':'),action=rest.join(':'),offset=typeof ef.what==='string'&&/^T\d+$/.test(ef.what)?Number(ef.what.slice(1)):0;
 const ctx={...original,targets:original.targets.slice(offset)},p=ctx.controller,opp=other(p),player=g.players[p],src=g.cards[ctx.source];
 const cards=(filter:import('./types').Filter={})=>g.battlefield.map(id=>g.cards[id]).filter(c=>matches(g,filter,c,p,src.id));
 const ours=(filter:import('./types').Filter={})=>cards({ctrl:'you',...filter});
 const chosen=resolveRef(g,ctx,ef.what&&!(typeof ef.what==='string'&&/^T\d+$/.test(ef.what))?ef.what:'T0').cards[0];
 const run=(effects:Effect[])=>runEffects(g,ctx,effects);
 const pick=(ids:number[],prompt:string,min=0,max=1,by=p)=>choose(g,by,prompt,ids,min,max);
 const token=(def:string|CardDef,n=1,opts:Parameters<typeof makeEclTokenBatch>[4]={})=>makeEclTokenBatch(g,p,def,n,opts);
 const shuffled=(ids:number[])=>{shuffleArr(g,ids);return ids;};
 const counter=(c:Card,kind:string,n=1)=>meadowCounter(g,c,kind,n,p);
 const copy=(c:Card,power?:number)=>token({...copiableDefinition(c),...(power!==undefined?{power,toughness:power}:{})});
 const permit=(c:Card,next=false,any=false)=>{moveCard(g,c,'exile');c.eclCast={by:p,until:g.turn+(next?(g.active===p?2:1):0),...(any?{mode:'finAnyMana'}:{})};};
 const impulse=function*(n:number,next=false):SubFlow<Card[]>{const out=player.library.slice(0,n).map(id=>g.cards[id]);for(const c of out)permit(c,next);return out;};
 const mana=function*(n:number,colors:Color[]=['W','U','B','R','G'],rule?:string):SubFlow{if(n<=0)return;const color=colors[yield*meadowMode(p,'選擇法力顏色',colors)]??colors[0];if(rule)(player.eclRestrictedMana??=[]).push(...Array.from({length:n},()=>({mana:color,rule,source:src.id})));else(player.pool??=[]).push(...Array.from({length:n},()=>color));};
 const bargain=function*(who:PID,n:number):SubFlow{const h=g.players[who].hand,permanents=cards({nonType:'Land'}).filter(c=>c.controller===who).map(c=>c.id),choices=['失去'+n+'生命',...(h.length?['棄一張牌']:[]),...(permanents.length?['犧牲非地永久物']:[])];const i=yield*meadowMode(who,'選擇效果',choices);if(choices[i]?.startsWith('棄')){const[id]=yield*pick(h.slice(),'棄一張牌',1,1,who);if(id!==undefined)discardMany(g,[g.cards[id]]);}else if(choices[i]?.startsWith('犧牲')){const[id]=yield*pick(permanents,'犧牲非地永久物',1,1,who);if(id!==undefined)sacrifice(g,g.cards[id]);}else loseLife(g,who,n);};
 if(set==='dft'){yield*dftEffect(g,ctx,ef);return;}
 switch(action){
 case 'wardFood':{const item=g.stack.find(s=>s.sid===ef.n);if(!item)break;const who=item.controller,foods=g.battlefield.filter(id=>g.cards[id].controller===who&&matches(g,{sub:'Food'},g.cards[id],who));if(foods.length&&(yield*meadowYes(who,'犧牲一個食物支付守護？'))){const[id]=yield*pick(foods,'犧牲食物',1,1,who);if(id!==undefined)sacrifice(g,g.cards[id]);}else{g.stack=g.stack.filter(s=>s.sid!==ef.n);if(item.kind==='spell')moveCard(g,g.cards[item.cardId],'graveyard');}break;}
 case 'gift':{const kind=String(src.def.meadow?.gift??src.def.text.match(/^Gift (a tapped Fish|a Food|a Treasure|a card)/)?.[1]??'card');(src.frontierMarks??={}).bdGift=1;if(/Fish/.test(kind))yield*makeEclTokenBatch(g,opp,'tok-g-fish-11-u',1,{tapped:true});else if(/Food/.test(kind))yield*makeEclTokenBatch(g,opp,'tok-food',1);else if(/Treasure/.test(kind))yield*makeEclTokenBatch(g,opp,'tok-treasure',1);else drawCards(g,opp,1);emit(g,{type:'frontier',action:'bdGift',card:src.id,player:p,amount:1});break;}
 case '2':if(cards({ctrl:'opp',type:'Land'}).length>ours({type:'Land'}).length)yield*token('tok-treasure');if(g.players[opp].life>player.life)gainLife(g,p,4);if(cards({ctrl:'opp',type:'Creature'}).length>ours({type:'Creature'}).length)yield*token('tok-g-fish-11-u',2);if(g.players[opp].hand.length>player.hand.length)drawCards(g,p,1);break;
 case 'playerHexproof':frontierFlags(g,p).bdHexproof=1;break;
 case '11':if(chosen&&src.zone==='battlefield'){const small=stats(g,chosen).p<=2;yield*run([{e:'exileLinked',what:'T0'}]);if(small)counter(src,'+1/+1');}break;
 case 'moveCounters':if(chosen)for(const[k,n]of Object.entries(ctx.ev?.type==='dies'?ctx.ev.counterKinds??src.lastCounterKinds??{}:src.lastCounterKinds??{})){if(!n)continue;if(k==='plus'){if(Number(n)>0)counter(chosen,'+1/+1',Number(n));else chosen.counters+=Number(n);}else counter(chosen,k,Number(n));}break;
 case '15':{const m=src.frontierMarks??={};if(m.bdHostTurn!==g.turn)m.bdHostTurn=g.turn,m.bdHostCount=0;m.bdHostCount=(m.bdHostCount??0)+1;if(m.bdHostCount===2)drawCards(g,p,1);break;}
 case 'returnNextCounter':case 'returnNextFlying':case 'returnNext':if(chosen){moveCard(g,chosen,'exile');meadowSchedule(g,ctx,action,chosen);}break;
 case 'indestructibleCounter':if(chosen)counter(chosen,'indestructible');break;
 case '34':{const list=cards({type:'Creature'});destroyCards(g,list);const ids=list.filter(c=>c.zone==='graveyard'&&c.owner===p).map(c=>c.id);const[id]=yield*pick(ids,'將本次死去的己方生物移回戰場',1);if(id!==undefined)enterBattlefield(g,g.cards[id],p);break;}
 case '40':{const ids=player.library.slice(0,5),options=ids.filter(id=>isCreature(g.cards[id])&&manaValue(g.cards[id].def)<=3);const[id]=yield*pick(options,'可展示法術力值至多3的生物',0);if(id!==undefined){if(g.active===p&&(yield*meadowYes(p,'放進戰場？')))enterBattlefield(g,g.cards[id],p);else moveCard(g,g.cards[id],'hand');}for(const cid of shuffled(ids.filter(cid=>cid!==id)))if(g.cards[cid].zone==='library')moveCard(g,g.cards[cid],'library',true);break;}
 case '41':if(chosen){g.eot.push({card:chosen.id,p:0,t:0,kw:[],loseAbilities:true,until:p,...(isCreature(chosen)?{base:{p:2,t:2}}:{})});g.loseAbilities=true;}break;
 case 'freeGrave':if(chosen&&chosen.zone==='graveyard'){chosen.finExileOnResolve=true;if(!(yield*freeCast(g,ctx,chosen,true)))chosen.finExileOnResolve=undefined;}break;
 case 'flood':if(chosen){counter(chosen,'flood');meadowRefresh(g);}break;
 case '53':if(src.attachedTo!==null){const c=g.cards[src.attachedTo];if(c){tapCard(g,c);if(!src.frontierMarks?.bdGift)counter(c,'stun',3);}}break;
 case 'copySpell':if(chosen)yield*runEffects(g,{...ctx,ev:{type:'cast',card:chosen.id,player:p,opponentTurn:g.active!==p}},[{e:'copySpell'}]);break;
 case 'blinkOnDamage':if(chosen)(chosen.frontierMarks??={}).bdBlinkDamage=g.turn;break;
 case '66':{const ids=player.library.slice(0,ctx.x??src.castX??0),picked:number[]=[];for(const type of ['Artifact','Battle','Creature','Enchantment','Instant','Kindred','Land','Planeswalker','Sorcery']){const[id]=yield*pick(ids.filter(id=>!picked.includes(id)&&g.cards[id].def.types.includes(type as any)),'可為'+type+'放逐一張牌');if(id!==undefined){picked.push(id);moveCard(g,g.cards[id],'exile');}}for(const id of ids)if(!picked.includes(id))moveCard(g,g.cards[id],'graveyard');if(picked.length>=4){const[id]=yield*pick(picked.filter(id=>!isLand(g.cards[id])),'可免費施放一張放逐的牌');if(id!==undefined)yield*freeCast(g,ctx,g.cards[id],true);}for(const id of picked)if(g.cards[id].zone==='exile')moveCard(g,g.cards[id],'hand');break;}
 case 'chooseCopy':{const[id]=yield*pick(ours({type:['Artifact','Creature']}).map(c=>c.id),'選擇要複製的神器或生物',1);if(id!==undefined)yield*copy(g.cards[id]);break;}
 case '74':if(chosen){const match=matches(g,{sub:['Bird','Frog','Otter','Rat']},chosen,p);yield*run([{e:'flicker',what:'T0'}]);if(match)drawCards(g,p,1);}break;
 case '81':{const old=src.eclCounters?.coin??0;counter(src,'coin');if((src.eclCounters?.coin??0)>old)emit(g,{type:'frontier',action:'bd:well',card:src.id,player:p,amount:src.eclCounters?.coin??0});break;}
 case '83':{const h=g.players[opp].hand.slice(),nonland=h.filter(id=>!isLand(g.cards[id]));if(nonland.length&&(yield*meadowYes(opp,'棄一張非地牌，代替棄兩張牌？'))){const[id]=yield*pick(nonland,'棄非地牌',1,1,opp);if(id!==undefined)discardMany(g,[g.cards[id]]);}else discardMany(g,(yield*pick(h,'棄兩張牌',Math.min(2,h.length),2,opp)).map(id=>g.cards[id]));break;}
 case 'banditDraw':if(g.players[opp].hand.length<=1)drawCards(g,p,1);break;
 case 'copyNonlegendary11':if(chosen?.zone==='battlefield'&&!chosen.def.supertypes?.includes('Legendary'))yield*copy(chosen,1);break;
 case 'greatestSac':{const cs=cards({ctrl:'opp',type:'Creature'}),n=Math.max(-Infinity,...cs.map(c=>stats(g,c).p));const[id]=yield*pick(cs.filter(c=>stats(g,c).p===n).map(c=>c.id),'犧牲力量最大的生物',1,1,opp);if(id!==undefined)sacrifice(g,g.cards[id]);break;}
 case '88':case '88gift':{const[id]=yield*pick(g.players[opp].hand.filter(id=>!isLand(g.cards[id])),'選擇對手手牌中的非地牌',1);if(id!==undefined){moveCard(g,g.cards[id],'exile');if(action==='88gift')g.cards[id].eclCast={by:p,mode:'finAnyMana'};}break;}
 case '93':{const[id]=yield*pick(cards({ctrl:'opp',type:'Enchantment'}).map(c=>c.id),'選擇要放逐的結界',1,1,opp);if(id!==undefined)moveCard(g,g.cards[id],'exile');break;}
 case '103':frontierFlags(g,p).bdOsteomancer=1;break;
 case '104':if(src.zone==='graveyard'&&canPayCost(g,p,parseCost('{2}{B}'))&&(yield*meadowYes(p,'支付{2}{B}移回戰場？'))){payCost(g,p,parseCost('{2}{B}'));enterBattlefield(g,src,p,true);src.attacking=true;}break;
 case '107':{counter(src,'blight');const n=src.zone==='battlefield'?src.eclCounters?.blight??0:Number(src.lastCounterKinds?.blight??0);for(let i=0;i<n;i++)yield*bargain(opp,4);break;}
 case '108':{const[id]=yield*pick(g.players[opp].hand.slice(),'從手牌放逐一張牌',1,1,opp);if(id!==undefined)moveCard(g,g.cards[id],'exile');break;}
 case '111':{const options=ours({nonType:'Land',other:true}).map(c=>c.id);if(options.length<3||!(yield*meadowYes(p,'犧牲三個其他非地永久物來復活生物？')))break;for(const id of yield*pick(options,'犧牲三個非地永久物',3,3))sacrifice(g,g.cards[id]);const[id]=yield*pick(player.graveyard.filter(id=>isCreature(g.cards[id])),'選擇要復活的生物',1);if(id!==undefined){(g.cards[id].finMarks??={}).enterFinality=1;enterBattlefield(g,g.cards[id],p);}break;}
 case '114':{const x=ctx.x??src.castX??0,ids=player.library.slice(0,2*x),chosen=yield*pick(ids,'選擇放進手上的X張牌',Math.min(x,ids.length),x);for(const id of chosen)moveCard(g,g.cards[id],'hand');for(const id of ids)if(!chosen.includes(id))moveCard(g,g.cards[id],'graveyard');loseLife(g,p,x);break;}
 case '117':yield*bargain(opp,3);break;
 case '118':{const h=g.players[opp].hand.slice();if(g.players[opp].lifeLostThisTurn>0){const[id]=yield*pick(h.filter(id=>!isLand(g.cards[id])),'選擇對手非地手牌',1);if(id!==undefined)discardMany(g,[g.cards[id]]);}else{const[id]=yield*pick(h,'棄一張牌',1,1,opp);if(id!==undefined)discardMany(g,[g.cards[id]]);}break;}
 case 'wickSnail':{const snails=ours({sub:'Snail'});if(!snails.length)yield*token('tok-bd-snail');else{const[id]=yield*pick(snails.map(c=>c.id),'選擇蝸牛加指示物',1);if(id!==undefined)counter(g.cards[id],'+1/+1');}break;}
 case 'wickSac':{const n=ctx.bdSac?.power??src.frontierMarks?.bdSacPower??0;dealDamage(g,src,p,{p:opp},n);drawCards(g,p,n);break;}
 case 'patrol':case 'forageReturnEvent':emit(g,{type:'frontier',action:'bd:'+action,card:src.id,player:p,amount:0});break;
 case 'exileIfDies':if(chosen)chosen.exileOnDeathTurn=g.turn;break;
 case 'impulse':yield*impulse(1);break;
 case 'impulseNext':yield*impulse(1,true);break;
 case 'impulseNextTwo':yield*impulse(2,true);break;
 case 'redManaPersist':(player.pool??=[]).push('R');player.keepRedTurn=g.turn;break;
 case '129':if(yield*meadowYes(p,'棄掉所有手牌以抓兩張牌？')){discardMany(g,player.hand.slice().map(id=>g.cards[id]));drawCards(g,p,2);}break;
 case '132':{const out=yield*impulse(ours({type:'Creature'}).filter(c=>stats(g,c).p>=4).length);for(const c of out)c.eclCast={by:p,mode:'bdNextEnd'};meadowSchedule(g,ctx,'dragonhawk',undefined,{ids:out.map(c=>c.id),ownEnd:true});break;}
 case 'loot':if(player.hand.length&&(yield*meadowYes(p,'棄一張牌來抓牌？'))){const[id]=yield*pick(player.hand.slice(),'棄一張牌',1);if(id!==undefined){discardMany(g,[g.cards[id]]);drawCards(g,p,1);}}break;
 case 'stash':counter(src,'stash');break;
 case '141':{const n=Number(ctx.bdCounters?.stash??src.lastCounterKinds?.stash??src.eclCounters?.stash??0);discardMany(g,player.hand.slice().map(id=>g.cards[id]));drawCards(g,p,n);break;}
 case 'doubleStrikeOrTrample':if(chosen){const i=yield*meadowMode(p,'選擇異能',['連擊','踐踏']);yield*run([{e:'pump',what:'T0',p:0,t:0,kw:[i===0?'double_strike':'trample']}]);}break;
 case '149':if(chosen&&(stats(g,chosen).p<=2||ours({sub:'Lizard',other:true}).length)){chosen.returnControl={player:chosen.controller,turn:g.turn};chosen.controller=p;chosen.tapped=false;g.eot.push({card:chosen.id,p:0,t:0,kw:['haste']});emit(g,{type:'fin',action:'controlChange',card:chosen.id,player:p,amount:chosen.returnControl.player});}break;
 case 'seasonBurn':meadowSchedule(g,ctx,'seasonBurn',undefined,{turn:g.turn+(g.active===p?2:1)});break;
 case 'copySelfExileEnd':{for(const c of yield*copy(src))meadowSchedule(g,ctx,'exileCreated',c);break;}
 case '155':for(const who of [0,1]as PID[])dealDamage(g,src,p,{p:who},g.battlefield.filter(id=>g.cards[id].controller===who&&isLand(g.cards[id])&&!g.cards[id].def.supertypes?.includes('Basic')).length);break;
 case 'cantBlock':if(chosen)g.eot.push({card:chosen.id,p:0,t:0,kw:[],cantBlock:true});break;
 case 'forage':yield*meadowForage(g,p);break;
 case 'forageCounters':if(yield*meadowForage(g,p))counter(src,'+1/+1',2);break;
 case 'forageDraw':if(yield*meadowForage(g,p))drawCards(g,p,1);break;
 case 'forageReturn':if(yield*meadowForage(g,p))emit(g,{type:'frontier',action:'bd:forageReturn',card:src.id,player:p,amount:0});break;
 case '167':{const ids=player.library.slice(0,4);for(const id of ids)moveCard(g,g.cards[id],'graveyard');const[id]=yield*pick(ids.filter(id=>g.cards[id].zone==='graveyard'&&!g.cards[id].def.types.some(t=>t==='Instant'||t==='Sorcery')),'可取回本次磨掉的永久物');const squirrel=id!==undefined&&matches(g,{sub:'Squirrel'},g.cards[id],p);if(id!==undefined)moveCard(g,g.cards[id],'hand');if(squirrel||ours({sub:'Squirrel'}).length)yield*token('tok-food');break;}
 case '168':{const ids:number[]=[];for(const id of player.library.slice()){const c=g.cards[id];if(isLand(c)){enterBattlefield(g,c,p,true);break;}ids.push(id);}for(const id of shuffled(ids))moveCard(g,g.cards[id],'library',true);break;}
 case '171':{const c=g.cards[player.library[0]];if(c){if(isLand(c)){if(yield*meadowYes(p,'將牌庫頂的地橫置進場？'))enterBattlefield(g,c,p,true);}else moveCard(g,c,'hand');}break;}
 case '172':if(chosen){yield*token(copiableDefinition(chosen),ctx.x??src.castX??0);for(const c of ours({token:true}))g.eot.push({card:c.id,p:0,t:0,kw:['indestructible'],until:p});gainLife(g,p,ours({token:true}).length);}break;
 case 'tokenDeathtouch':if(chosen?.token)yield*run([{e:'pump',what:'T0',p:0,t:0,kw:['deathtouch']}]);break;
 case 'basicTapped':yield*run([{e:'searchLand',to:'battlefield',tapped:true,may:true}]);break;
 case 'curatorExile':if(chosen){moveCard(g,chosen,'exile');(src.meadowLinked??=[]).push(chosen.id);(src.frontierMarks??={})['bdCurator:'+chosen.id]=chosen.objectVersion??0;}break;
 case 'returnLands':{const old=g.frontierEntryBatch;g.frontierEntryBatch=g.nextSid++;for(const id of player.graveyard.slice())if(isLand(g.cards[id]))enterBattlefield(g,g.cards[id],p,true);g.frontierEntryBatch=old;break;}
 case '184':{const options=ours({type:'Creature',other:true}).map(c=>c.id);const[id]=yield*pick(options,'將另一個己方生物移回手上',options.length?1:0);if(id!==undefined){moveCard(g,g.cards[id],'hand');counter(src,'+1/+1');}else if(yield*meadowYes(p,'可將此生物移回手上？'))moveCard(g,src,'hand');break;}
 case '189':{const a=resolveRef(g,ctx,'T0').cards[0],b=resolveRef(g,ctx,'T1').cards[0];if(a&&b)dealDamage(g,a,p,{c:b.id},2*stats(g,a).p);break;}
 case 'gatherCounter':{const[id]=yield*pick(ours({type:'Creature'}).map(c=>c.id),'選擇生物放指示物並授予警戒踐踏',1);if(id!==undefined){counter(g.cards[id],'+1/+1');g.eot.push({card:id,p:0,t:0,kw:['vigilance','trample']});}break;}
 case 'wipeArtifactOrEnchantment':{const type=(yield*meadowMode(p,'選擇要消滅的類別',['神器','結界']))===0?'Artifact':'Enchantment';destroyCards(g,cards({type}));break;}
 case 'supply':counter(src,'supply');break;
 case 'forageMana':for(let i=0;i<2;i++)yield*mana(1);break;
 case 'attachEquipment':{const host=resolveRef(g,ctx,'T1').cards[0];if(chosen&&host){chosen.attachedTo=host.id;emit(g,{type:'frontier',action:'attached',card:chosen.id,player:p,other:host.id,amount:0});}break;}
 case '204':drawCards(g,opp,1);yield*run([{e:'copySpell'}]);break;
 case 'ownTargetDraw':if(chosen?.controller===p)drawCards(g,p,2);break;
 case '212':if(ours({type:'Creature'}).reduce((n,c)=>n+stats(g,c).p,0)>=10)drawCards(g,p,1);break;
 case '213':{const out=player.library.slice(0,2).map(id=>g.cards[id]);for(const c of out)moveCard(g,c,'exile');const[id]=yield*pick(out.map(c=>c.id),'選擇本回合可使用的牌',Math.min(1,out.length));if(id!==undefined)g.cards[id].eclCast={by:p,until:g.turn};break;}
 case 'helgaMana':yield*mana(stats(g,src).p,undefined,'bdHelga');break;
 case 'frogMana':yield*mana(1,['G','U'],'creature');break;
 case 'hugsImpulse':yield*impulse(src.castX??0,true);break;
 case '219':{let card:Card|undefined;for(const id of player.library.slice()){const c=g.cards[id];moveCard(g,c,'exile');if(!isLand(c)){card=c;break;}}if(card&&player.hand.length&&(yield*meadowYes(p,'棄一張牌來免費施放放逐的牌？'))){const[id]=yield*pick(player.hand.slice(),'棄一張牌',1);if(id!==undefined){discardMany(g,[g.cards[id]]);yield*freeCast(g,ctx,card,true);}}break;}
 case 'kastralBird':{const[id]=yield*pick([...player.hand,...player.graveyard].filter(id=>isCreature(g.cards[id])&&matches(g,{sub:'Bird'},g.cards[id],p)),'可將鳥牌放進戰場');if(id!==undefined){(g.cards[id].finMarks??={}).enterFinality=1;enterBattlefield(g,g.cards[id],p);}break;}
 case 'muerraMana':{const n=ours({sub:'Raccoon'}).length;if(n){const red=yield*meadowMode(p,'選紅色法力數量，其餘為綠色',Array.from({length:n+1},(_,i)=>String(i)));(player.pool??=[]).push(...Array.from({length:red},()=>'R' as const),...Array.from({length:n-red},()=>'G' as const));}break;}
 case 'loyaltyCounter':counter(src,'loyalty');break;
 case 'rgMana':yield*mana(1,['R','G']);break;
 case '242':if(player.life>=2&&canPayCost(g,p,parseCost('{W}{B}'))&&(yield*meadowYes(p,'支付{W}{B}與2生命？'))){payCost(g,p,parseCost('{W}{B}'));loseLife(g,p,2);emit(g,{type:'frontier',action:'bd:zoraline',card:src.id,player:p,amount:0});}break;
 case 'basicOnTop':{const[id]=yield*pick(player.library.filter(id=>isLand(g.cards[id])&&g.cards[id].def.supertypes?.includes('Basic')),'可搜尋基本地放牌庫頂');shuffleArr(g,player.library);if(id!==undefined)moveCard(g,g.cards[id],'library');emit(g,{type:'search',player:p});break;}
 case 'attachSelf':if(chosen&&src.zone==='battlefield'){src.attachedTo=chosen.id;emit(g,{type:'frontier',action:'attached',card:src.id,player:p,other:chosen.id,amount:0});}break;
 case 'storm':for(let i=0;i<(ef.n??0);i++)yield*run([{e:'copySpell'}]);break;
 case 'delayed':{const d=g.meadowDelayed?.find(d=>d.id===ef.n);if(!d)break;g.meadowDelayed=g.meadowDelayed!.filter(x=>x!==d);const c=d.target!==undefined?g.cards[d.target]:undefined;if(d.kind==='dragonhawk'){const left=(d.ids??[]).filter(id=>g.cards[id].zone==='exile'&&g.cards[id].eclCast?.mode==='bdNextEnd').length;for(const id of d.ids??[])if(g.cards[id].eclCast?.mode==='bdNextEnd')g.cards[id].eclCast=undefined;dealDamage(g,src,p,{p:opp},2*left);}else if(c&&c.objectVersion===d.version){if(d.kind==='sacCreated'&&c.zone==='battlefield')sacrifice(g,c);else if(d.kind==='exileCreated'&&c.zone==='battlefield')moveCard(g,c,'exile');else if(c.zone==='exile'&&d.kind.startsWith('returnNext')){enterBattlefield(g,c,c.owner);if(d.kind==='returnNextCounter')counter(c,'+1/+1');if(d.kind==='returnNextFlying')counter(c,'flying');}}break;}
 default:if(action.startsWith('creatureMana')){yield*mana(1,[action.slice(-1)as Color],'creature');break;}throw Error('Unsupported BLB effect '+action);
 }
}
export function meadowRefresh(g:GameState){
 for(const c of g.battlefield.map(id=>g.cards[id])){const m=c.frontierMarks;if(m?.bdPossessionSource!==undefined){const source=g.cards[m.bdPossessionSource];if(source?.zone!=='battlefield'||source.controller!==m.bdPossessionController){if(c.mshMarks?.controlSource===m.bdPossessionSource){c.controller=c.mshMarks.controlPlayer as PID;delete c.mshMarks.controlSource;delete c.mshMarks.controlPlayer;}delete m.bdPossessionSource;delete m.bdPossessionController;}}}
 const board=g.battlefield.map(id=>g.cards[id]),foodAuras=new Set(board.filter(a=>a.def.abilities?.some(x=>x.kind==='static'&&x.frontier==='blb:foodAura')&&!abilitiesSuppressed(g,a)).map(a=>a.attachedTo));
 const active=(key:string)=>board.filter(c=>!foodAuras.has(c.id)&&!abilitiesSuppressed(g,c)&&(c.meadowTypeDef??c.def).abilities?.some(a=>a.kind==='static'&&a.frontier===key));
 const ygras=active('blb:ygra'),oozes=active('dft:ooze'),tribes=active('dft:vehicleTribe');
 for(const c of Object.values(g.cards)){
  if(c.zone!=='battlefield'){if(c.meadowTypeDef){c.def=c.meadowTypeDef;c.meadowTypeDef=undefined;}continue;}
  const original=c.meadowTypeDef??c.def,food=foodAuras.has(c.id),offTurn=!food&&!abilitiesSuppressed(g,c)&&original.abilities?.some(a=>a.kind==='static'&&a.frontier==='dft:offTurnCreature')&&g.active!==c.controller;
  const creature=original.types.includes('Creature')||!!offTurn,ygra=creature&&ygras.some(s=>s.id!==c.id),ooze=creature&&oozes.some(s=>s.controller===c.controller),flood=original.types.includes('Land')&&(c.eclCounters?.flood??0)>0;
  const extraTribes=creature&&original.subtypes?.includes('Vehicle')?tribes.filter(s=>s.controller===c.controller&&s.eclType).map(s=>s.eclType!):[];
  if(food||ygra||ooze||flood||offTurn||extraTribes.length){
   c.meadowTypeDef??=original;
   const ability:Ability={kind:'activated',cost:{mana:'{2}',tap:true,sacSelf:true},effects:[{e:'gain',n:3}],label:'犧牲食物：獲得3生命'};
   c.def=food?{...original,types:['Artifact'],subtypes:['Food'],colors:[],keywords:[],abilities:[ability],produces:undefined,ward:undefined,wardLife:undefined,wardDiscard:undefined,wardSac:undefined,equip:undefined,aura:undefined}:{...original,types:[...new Set([...original.types,...(offTurn?['Creature' as const]:[]),...(ygra?['Artifact' as const]:[])])],subtypes:[...new Set([...(original.subtypes??[]),...(ygra?['Food']:[]),...(ooze?['Ooze']:[]),...(flood?['Island']:[]),...extraTribes])],abilities:[...(original.abilities??[]),...(ygra?[ability]:[])],...(flood?{produces:[...new Set([...(original.produces??[]),'U' as const])]}:{})};
  }else if(c.meadowTypeDef){c.def=c.meadowTypeDef;c.meadowTypeDef=undefined;}
 }
}
