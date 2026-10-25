import {validateTargets} from './targets';
import {meadowEffect,meadowMode,meadowYes,meadowSchedule} from './meadow';
import {copiableDefinition,isCreature,isLand,matches,other,shuffleArr,stats} from './state';
import {canPayCost,payCost} from './actions';
import {manaValue,parseCost} from './mana';
import {choose} from './tla';
import {makeEclTokenBatch} from './ecl';
import {resolveRef,runEffects,type Ctx} from './effects';
import {dealDamage,destroyCards,discardMany,drawCards,emit,enterBattlefield,loseLife,moveCard,putCounters,sacrifice} from './zones';
import {frontierFlags} from './frontier-support';
import type {Card,CardDef,Color,Effect,GameState,PID,Response,SubFlow} from './types';
export function* dftEffect(g:GameState,ctx:Ctx,ef:Extract<Effect,{e:'frontier'}>):SubFlow{
 const key=ef.action.slice(4),p=ctx.controller,opp=other(p),player=g.players[p],src=g.cards[ctx.source],ev=ctx.ev;
 const chosen=resolveRef(g,ctx,ef.what??'T0').cards[0];
 const own=(f:import('./types').Filter={})=>g.battlefield.map(id=>g.cards[id]).filter(c=>matches(g,{ctrl:'you',...f},c,p,src.id));
 const pick=(ids:number[],text:string,min=0,max=1,by=p)=>choose(g,by,text,ids,min,max);
 const token=(def:string|CardDef,n=1,extra:Parameters<typeof makeEclTokenBatch>[4]={})=>makeEclTokenBatch(g,p,def,n,extra);
 const run=(effects:Effect[])=>runEffects(g,ctx,effects);
 const animate=function*(c:Card|undefined,permanent=false):SubFlow{if(c&&c.zone==='battlefield')yield*runEffects(g,{...ctx,targets:[{c:c.id}]},[{e:'animate',what:'T0',p:c.def.power??0,t:c.def.toughness??0,permanent}]);};
 const mana=function*(n:number,colors:Color[]=['W','U','B','R','G'],rule='ability'):SubFlow{if(n<=0)return;const color=colors[yield*meadowMode(p,'選擇法力顏色',colors)]??colors[0];(player.eclRestrictedMana??=[]).push(...Array.from({length:n},()=>({mana:color,rule,source:src.id})));};
 const gravePick=function*(filter:import('./types').Filter,optional=false):SubFlow{const[id]=yield*pick(player.graveyard.filter(id=>matches(g,filter,g.cards[id],p)),'從墳墓場取回一張牌',optional?0:1);if(id!==undefined)moveCard(g,g.cards[id],'hand');};
 switch(key){
 case 'untapAttacked':for(const c of g.battlefield.map(id=>g.cards[id]).filter(c=>isCreature(c)&&c.attackedTurn===g.turn))c.tapped=false;break;
 case 'loyaltyHost':yield*run([{e:'loyalty',what:'self',n:ef.n??0}]);break;
 case 'copySpell':case 'returnNext':case 'attachSelf':yield*meadowEffect(g,ctx,{...ef,action:'blb:'+key});break;
 case 'saddleAnimate':{const c=ev?.type==='etb'?g.cards[ev.card]:chosen;if(c){if(c.def.subtypes?.includes('Mount'))c.saddledTurn=g.turn;if(c.def.subtypes?.includes('Vehicle'))yield*animate(c);}break;}
 case 'saddle':if(chosen)chosen.saddledTurn=g.turn;break;
 case 'animate':yield*animate(src);break;
 case 'animateTarget':yield*animate(chosen);break;
 case 'animatePermanent':yield*animate(src,true);break;
 case 'animateVehiclePermanent':if(chosen?.def.subtypes?.includes('Vehicle'))yield*animate(chosen,true);break;
 case 'animateVehicleHaste':if(chosen){yield*animate(chosen);g.eot.push({card:chosen.id,p:0,t:0,kw:['haste']});}break;
 case '29':{const cards=g.battlefield.map(id=>g.cards[id]).filter(c=>isCreature(c)||c.def.subtypes?.includes('Vehicle'));for(const c of cards)g.eot.push({card:c.id,p:0,t:0,kw:[],removeKw:['indestructible']});destroyCards(g,cards);break;}
 case 'cyclePilots':yield*token('tok-bd-pilot',ev?.type==='frontier'?ev.amount:0);break;
 case 'optimizerMana':yield*mana(1,['U'],'artifactAbility');break;
 case '54':if(chosen&&src.zone==='battlefield'){(chosen.mshMarks??={}).controlSource=src.id;chosen.mshMarks.controlPlayer=chosen.controller;chosen.controller=p;chosen.noUntapBy=undefined;(chosen.frontierMarks??={}).bdPossessionSource=src.id;chosen.frontierMarks.bdPossessionController=p;emit(g,{type:'fin',action:'controlChange',card:chosen.id,player:p,amount:chosen.mshMarks.controlPlayer});}break;
 case '56':{const n=(ctx.bdSac?.mana??src.frontierMarks?.bdSacMana??0)+1;yield*run([{e:'tutor',filter:{type:'Artifact',mvMin:n,mvMax:n},to:'battlefield'}]);break;}
 case '57':for(const t of ctx.targets)if(t&&'p'in t){const n=g.players[t.p].graveyard.length;yield*runEffects(g,{...ctx,targets:[t]},[{e:'mill',n,who:'T0'}]);}break;
 case '65':if(chosen){const who=chosen.controller;moveCard(g,chosen,'hand');if((g.players[who].speed??0)>(g.players[other(who)].speed??0))g.players[who].speed=Math.max(1,(g.players[who].speed??0)-1);}break;
 case 'exchange':{const a=resolveRef(g,ctx,'T0').cards[0],b=resolveRef(g,ctx,'T1').cards[0];if(a?.zone==='battlefield'&&b?.zone==='battlefield'){const who=a.controller;a.controller=b.controller;b.controller=who;emit(g,{type:'fin',action:'controlChange',card:a.id,player:a.controller,amount:who});emit(g,{type:'fin',action:'controlChange',card:b.id,player:b.controller,amount:a.controller});}break;}
 case '75':{const all=[...g.players[opp].hand,...g.players[opp].graveyard,...g.players[opp].library],names=[...new Set(Object.values(g.cards).map(c=>c.def.name))];const i=yield*meadowMode(p,'選擇牌名',names),name=names[i];const ids=yield*pick(all.filter(id=>g.cards[id].def.name===name),'可放逐至多四張同名牌',0,4);for(const id of ids)moveCard(g,g.cards[id],'exile');shuffleArr(g,g.players[opp].library);emit(g,{type:'search',player:p});break;}
 case 'graveCreatureVehicle':yield*gravePick({or:[{type:'Creature'},{sub:'Vehicle'}]});break;
 case 'graveLand':yield*gravePick({type:'Land'},true);break;
 case 'grantEmbalm':if(chosen)(chosen.frontierMarks??={}).bdEmbalm=g.turn;break;
 case 'embalm':{const base=copiableDefinition(src);yield*token({...base,colors:['W'],cost:'',subtypes:[...new Set([...(base.subtypes??[]),'Zombie'])]});break;}
 case 'sacVehicleDraw':if(ctx.bdSac?.vehicle)drawCards(g,p,1);break;
 case '83':{const cards=ctx.targets.flatMap(t=>t&&'c'in t?[g.cards[t.c]]:[]),own=cards.filter(c=>c.controller===p);destroyCards(g,cards);if(own.some(c=>c.zone!=='battlefield'))putCounters(g,src,2);break;}
 case 'discardInstantSorcery':{const[id]=yield*pick(g.players[opp].hand.filter(id=>g.cards[id].def.types.some(t=>t==='Instant'||t==='Sorcery')),'選對手瞬間或巫術手牌',1);if(id!==undefined)discardMany(g,[g.cards[id]]);break;}
 case 'exileHandArtifactCreature':{const[id]=yield*pick(g.players[opp].hand.filter(id=>g.cards[id].def.types.some(t=>t==='Artifact'||t==='Creature')),'選對手神器或生物手牌',1);if(id!==undefined)moveCard(g,g.cards[id],'exile');break;}
 case 'treasureCaster':if(ev?.type==='cast')yield*makeEclTokenBatch(g,ev.player,'tok-treasure',1);break;
 case 'gontiExile':if(ev?.type==='combatDamage'){const by=g.cards[ev.source].controller,c=g.cards[g.players[ev.player].library[0]];if(c){moveCard(g,c,'exile');c.hiddenExile=true;c.eclCast={by,mode:'finAnyMana'};}}break;
 case 'surveilWhenDies':if(chosen)meadowSchedule(g,ctx,'surveilDeath',chosen);break;
 case '97':{const ids=g.battlefield.filter(id=>g.cards[id].controller===opp&&(isCreature(g.cards[id])||g.cards[id].def.subtypes?.includes('Vehicle')));if(ids.length){const[id]=yield*pick(ids,'犧牲生物或載具',1,1,opp);if(id!==undefined)sacrifice(g,g.cards[id]);}else if(g.players[opp].hand.length){const[id]=yield*pick(g.players[opp].hand.slice(),'棄一張牌',1,1,opp);if(id!==undefined)discardMany(g,[g.cards[id]]);}break;}
 case '100':if(chosen&&manaValue(chosen.def)<=player.graveyard.length)destroyCards(g,[chosen]);break;
 case 'abilityMana4':yield*mana(4);break;
 case 'powerAbilityMana':yield*mana(stats(g,src).p);break;
 case 'colorlessAbilityMana2':(player.eclRestrictedMana??=[]).push({mana:'C',rule:'ability'},{mana:'C',rule:'ability'});break;
 case '116':{const artifacts=own({type:'Artifact'}).map(c=>c.id),h=player.hand.slice(),modes=[...(artifacts.length?['犧牲神器']:[]),...(h.length?['棄一張牌']:[]),'不支付'];const i=yield*meadowMode(p,'可支付費用來抓牌',modes);if(modes[i]==='犧牲神器'){const[id]=yield*pick(artifacts,'犧牲神器',1);if(id!==undefined)sacrifice(g,g.cards[id]),drawCards(g,p,1);}else if(modes[i]==='棄一張牌'){const[id]=yield*pick(h,'棄一張牌',1);if(id!==undefined)discardMany(g,[g.cards[id]]),drawCards(g,p,1);}break;}
 case '120':if(chosen){const[id]=yield*pick(own({type:'Artifact'}).map(c=>c.id),'可犧牲一個神器');if(id!==undefined){sacrifice(g,g.cards[id]);enterBattlefield(g,chosen,p);}}break;
 case '127':g.extraCombat={player:p,landOnly:false,count:(g.extraCombat?.count??0)+2};meadowSchedule(g,ctx,'fullThrottle');break;
 case '128':{const[id]=yield*pick(own({or:[{type:'Creature'},{sub:'Vehicle'}]}).map(c=>c.id),'可犧牲生物或載具');if(id!==undefined){sacrifice(g,g.cards[id]);emit(g,{type:'frontier',action:'bd:blockbuster',card:src.id,player:p,amount:0});}break;}
 case '132':{const ids=yield*pick(player.hand.slice(),'可棄至多兩張牌',0,2);discardMany(g,ids.map(id=>g.cards[id]));drawCards(g,p,ids.length);break;}
 case 'goblinMustAttack':{const out=yield*token('tok-g-goblin-11-r');for(const c of out)(c.frontierMarks??={}).bdMustAttack=g.turn;break;}
 case '135':if(player.hand.length&&(yield*meadowYes(p,'棄一張牌來抓兩張牌？'))){const[id]=yield*pick(player.hand.slice(),'棄一張牌',1);if(id!==undefined){discardMany(g,[g.cards[id]]);drawCards(g,p,2);}}break;
 case '139':for(const who of [0,1]as PID[])if((g.players[who].speed??0)<4)dealDamage(g,src,p,{p:who},2);break;
 case '143':{const old=g.frontierEntryBatch;g.frontierEntryBatch=g.nextSid++;for(const id of player.graveyard.slice())if(matches(g,{or:[{sub:'Mount'},{sub:'Vehicle'}]},g.cards[id],p)){enterBattlefield(g,g.cards[id],p);meadowSchedule(g,ctx,'sacCreated',g.cards[id]);}g.frontierEntryBatch=old;for(const c of own({sub:'Vehicle'}))yield*animate(c);for(const c of own({type:'Creature'}))g.eot.push({card:c.id,p:0,t:0,kw:['haste']});break;}
 case '163':{const pool=[...player.library,...player.graveyard].filter(id=>isCreature(g.cards[id])&&g.cards[id].def.text.trim()===''&&!(g.cards[id].def.keywords?.length));const[id]=yield*pick(pool,'可從牌庫或墳墓場取沒有異能的生物');if(id!==undefined)moveCard(g,g.cards[id],'hand');if(id===undefined||g.cards[id].enteredFrom!=='graveyard'){shuffleArr(g,player.library);emit(g,{type:'search',player:p});}break;}
 case '173':{const[id]=yield*pick(player.hand.filter(id=>isCreature(g.cards[id])||g.cards[id].def.subtypes?.includes('Vehicle')),'可放生物或載具進場');if(id!==undefined){const c=g.cards[id];enterBattlefield(g,c,p);if(c.def.types.includes('Artifact'))putCounters(g,c,2);}break;}
 case '194':if(chosen){const n=ev?.type==='discard'?ev.amount??1:1;g.eot.push({card:chosen.id,p:2*n,t:0,kw:[]});meadowSchedule(g,ctx,'howlerDraw',chosen);}break;
 case 'distribution2':{const a=resolveRef(g,ctx,'T0').cards[0],b=resolveRef(g,ctx,'T1').cards[0];if(a){putCounters(g,a,b?1:2);if(b)putCounters(g,b,1);}break;}
 case '198':if(chosen){(chosen.finMarks??={}).enterFinality=1;enterBattlefield(g,chosen,p);g.eot.push({card:chosen.id,p:0,t:0,kw:['menace','deathtouch','haste']});meadowSchedule(g,ctx,'exileCreated',chosen,{ownEnd:true});}break;
 case '206':{const[id]=yield*pick(player.library.filter(id=>g.cards[id].def.types.includes('Artifact')),'可搜尋一張神器');if(id!==undefined){const c=g.cards[id];if(manaValue(c.def)<=2)enterBattlefield(g,c,p);else moveCard(g,c,'hand');}shuffleArr(g,player.library);emit(g,{type:'search',player:p});break;}
 case '213':if(canPayCost(g,p,parseCost('{1}'))&&(yield*meadowYes(p,'支付{1}複製神器咒語？'))){payCost(g,p,parseCost('{1}'));yield*run([{e:'copySpell'}]);}break;
 case '214':if(chosen&&src.meadowLinked?.includes(chosen.id)&&chosen.objectVersion===src.frontierMarks?.['bdMime:'+chosen.id]){const ability=src.def.abilities?.find(a=>a.kind==='activated'&&a.effects.some(e=>e.e==='frontier'&&e.action==='dft:214')),def=copiableDefinition(chosen);src.tlaOriginalDef??=src.def;src.copyLayer={...def,power:0,toughness:0,abilities:[...(def.abilities??[]),...(ability?[ability]:[])]};src.def=src.copyLayer;src.meadowTypeDef=undefined;}break;
 case '215':{const who=ctx.targets[0]&&'p'in ctx.targets[0]?ctx.targets[0].p:opp;const[id]=yield*pick(g.players[who].hand.slice(),'可選擇一張手牌棄掉');if(id!==undefined){discardMany(g,[g.cards[id]]);drawCards(g,who,1);}break;}
 case 'noPrevent':frontierFlags(g,p).bdNoPrevent=1;break;
 case '218':{const ids=yield*pick(player.hand.filter(id=>!g.cards[id].def.types.some(t=>t==='Instant'||t==='Sorcery')),'放任意數量永久物進場',0,player.hand.length),old=g.frontierEntryBatch;g.frontierEntryBatch=g.nextSid++;for(const id of ids)enterBattlefield(g,g.cards[id],p);g.frontierEntryBatch=old;break;}
 case 'thirdFromTop':if(chosen){const owner=chosen.owner;moveCard(g,chosen,'library');const lib=g.players[owner].library;lib.splice(lib.indexOf(chosen.id),1);lib.splice(Math.min(2,lib.length),0,chosen.id);}break;
 case '221':{const n=src.counters+src.stun+(src.charge??0)+(src.hexproofCounters??0)+(src.finality?Math.max(1,src.finalityCount??1):0)+(src.loyalty??0)+Object.values(src.eclCounters??{}).reduce((n,v)=>n+v,0);if(n%2)drawCards(g,p,2);break;}
 case '223':if(yield*meadowYes(p,'將其他己方生物的基礎力量與防禦力改為此生物力量？')){const n=stats(g,src).p;for(const c of own({type:'Creature',other:true}))g.eot.push({card:c.id,p:0,t:0,kw:[],base:{p:n,t:n}});}break;
 case '224':{const lands:number[]=[],rest:number[]=[];for(const id of player.library.slice()){if(isLand(g.cards[id])){lands.push(id);if(lands.length===2)break;}else rest.push(id);}const old=g.frontierEntryBatch;g.frontierEntryBatch=g.nextSid++;for(const id of lands)enterBattlefield(g,g.cards[id],p,true);g.frontierEntryBatch=old;shuffleArr(g,rest);for(const id of rest)moveCard(g,g.cards[id],'library',true);break;}
 case '228':for(const c of g.battlefield.map(id=>g.cards[id]).filter(c=>c.id!==src.id&&isCreature(c)&&!c.def.types.includes('Artifact')))g.eot.push({card:c.id,p:-(ctx.x??0),t:-(ctx.x??0),kw:[]});break;
 case 'pitCopy':meadowSchedule(g,ctx,'pitCopy');break;
 case 'copyAbility':{const item=g.stack.find(s=>s.sid===ef.n)??(ev?.type==='frontier'?ev.bdStack:undefined);if(item){let targets=item.targets.slice();if(item.targetSpecs.length){const r:Response=yield{type:'targets',player:p,source:src.id,specs:item.targetSpecs,text:item.text,effects:item.effects};if(r.type==='targets'&&!validateTargets(g,item.targetSpecs,r.targets,p,src.id))targets=r.targets;}g.stack.push({...item,sid:g.nextSid++,controller:p,targets,targetVersions:targets.map(t=>t&&'c'in t?g.cards[t.c]?.objectVersion??0:undefined)});}break;}
 case '240':{const who=ctx.targets[0]&&'p'in ctx.targets[0]?ctx.targets[0].p:p,n=3*(ctx.x??0);if(n){const colors=['W','U','B','R','G']as Color[],color=colors[yield*meadowMode(p,'選擇法力顏色',colors)]??'W';(g.players[who].pool??=[]).push(...Array.from({length:n},()=>color));}break;}
 case 'wardManaLife':{const item=g.stack.find(s=>s.sid===ef.n);if(!item)break;const who=item.controller;if(g.players[who].life>=2&&canPayCost(g,who,parseCost('{2}'))&&(yield*meadowYes(who,'支付{2}與2生命支付守護？'))){payCost(g,who,parseCost('{2}'));loseLife(g,who,2);}else{g.stack=g.stack.filter(s=>s!==item);if(item.kind==='spell')moveCard(g,g.cards[item.cardId],'graveyard');}break;}
 default:throw Error('Unsupported DFT effect '+key);
 }
}
