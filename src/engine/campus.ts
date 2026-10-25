import {dftEffect} from './meadow-dft';
import {campusSosEffect} from './campus-sos';
import {copiableDefinition,isCreature,isLand,matches,other,shuffleArr,stats} from './state';
import {campusDescent,campusMaterials} from './campus-support';
import {frontierFlags} from './frontier-support';
import {manaValue,parseCost} from './mana';
import {canPayCost,payCost} from './actions';
import {choose,freeCast,target} from './tla';
import {makeEclTokenBatch} from './ecl';
import {resolveRef,runEffects,type Ctx} from './effects';
import {meadowCounter,meadowYes,meadowMode,meadowEffect} from './meadow';
import {dealDamage,discardMany,drawCards,emit,enterBattlefield,enterBattlefieldBack,gainLife,loseLife,moveCard,putCounters,sacrifice,tapCard,destroyCards} from './zones';
import type {Card,CardDef,Effect,GameState,PID,SubFlow,TargetSpec} from './types';
export function campusReflexive(g:GameState,ctx:Ctx,effects:Effect[],targets:TargetSpec[]=[]){g.pending.push({source:ctx.source,controller:ctx.controller,abilityIndex:-311,ev:{type:'frontier',action:'cpReflexive',card:ctx.source,player:ctx.controller,amount:1},ability:{kind:'trigger',on:'frontierEvent',effects,targets}});}
export function campusPermit(g:GameState,c:Card,p:PID,until=g.turn){c.playableBy=p;c.playableTurn=g.turn;c.playableUntil=until;}
export function campusLink(g:GameState,source:Card,c:Card){const token=c.token;moveCard(g,c,'exile');const def=copiableDefinition(c),power=isCreature(c)?stats(g,c).p:0;(source.campusLinked??=[]).push({id:c.id,version:c.objectVersion??0,def,power,token});}
export function* campusDiscover(g:GameState,ctx:Ctx,n:number,cascade=false,p=ctx.controller):SubFlow<number>{
 const ids:number[]=[],lib=g.players[p].library;let found:Card|undefined;
 while(lib.length){const c=g.cards[lib[0]];moveCard(g,c,'exile');ids.push(c.id);if(!isLand(c)&&(cascade?manaValue(c.def)<n:manaValue(c.def)<=n)){found=c;break;}}
 if(!cascade)emit(g,{type:'frontier',action:'discover',card:ctx.source,player:p,amount:n});
 if(found){const cast=yield*meadowYes(p,cascade?'是否免費施放翻出的牌？':'免費施放發現牌？否則放入手牌');if(cast){const ok=yield*freeCast(g,{...ctx,controller:p},found);if(!ok&&!cascade&&found.zone==='exile')moveCard(g,found,'hand');}else if(!cascade)moveCard(g,found,'hand');}
 const rest=ids.filter(id=>g.cards[id].zone==='exile');shuffleArr(g,rest);for(const id of rest)moveCard(g,g.cards[id],'library',true);return found?manaValue(found.def):n;
}
export function* campusEffect(g:GameState,original:Ctx,ef:Extract<Effect,{e:'frontier'}>):SubFlow{
 if(ef.action.startsWith('sos:')){yield*campusSosEffect(g,original,ef);return;}
 const action=ef.action.slice(4),offset=typeof ef.what==='string'&&/^T\d+$/.test(ef.what)?Number(ef.what.slice(1)):0,ctx={...original,targets:original.targets.slice(offset)},p=ctx.controller,opp=other(p),src=g.cards[ctx.source],ev=ctx.ev;
 const chosen=resolveRef(g,ctx,ef.what&&!(typeof ef.what==='string'&&/^T\d+$/.test(ef.what))?ef.what:'T0').cards[0],run=(effects:Effect[])=>runEffects(g,ctx,effects),ours=(f:import('./types').Filter={})=>g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===p&&matches(g,f,c,p,src.id));
 const tk=(id:string|CardDef,n=1,who=p)=>makeEclTokenBatch(g,who,id,n),pick=(ids:number[],text:string,min=0,max=1)=>choose(g,p,text,ids,min,max);
 const pay=function*(mana:string,prompt='是否支付法術力？'):SubFlow<boolean>{return canPayCost(g,p,parseCost(mana))&&(yield*meadowYes(p,prompt))&&payCost(g,p,parseCost(mana));};
 if(action.startsWith('counter:')){meadowCounter(g,src,action.slice(8),ef.n??1,p);return;}
 switch(action){
 case 'discover':original.lastDiscover=yield*campusDiscover(g,ctx,ef.n??0);break;
 case 'discoverEvent':yield*campusDiscover(g,ctx,ev?.type==='frontier'?ev.amount:0);break;
 case 'discoverSpellMv':yield*campusDiscover(g,ctx,ev?.type==='cast'?manaValue(g.cards[ev.card].def):0);break;
 case 'craftReturn':if(src.zone==='exile'&&src.frontierMarks?.cpCraftVersion===(src.objectVersion??0)){(src.frontierMarks??={}).cpCraftReturning=1;enterBattlefieldBack(g,src,src.owner);}break;
 case 'grantRebound':if(ev?.type==='cast'){const c=g.cards[ev.card];if(c.zone==='stack'&&g.stack.some(s=>s.kind==='spell'&&s.cardId===c.id&&(!ev.bdSpell||ev.bdSpell.sid===s.sid)))(c.frontierMarks??={}).cpRebound=1;}break;
 case 'blinkEnd':yield*meadowEffect(g,ctx,{...ef,action:'blb:returnNext'});break;
 case 'copyActivated':yield*dftEffect(g,ctx,{...ef,action:'dft:copyAbility'});break;
 case 'deathBack':if(src.zone==='graveyard'){(src.finMarks??={}).cpTempleTime=src.def.id==='ojer-pakpatiq-deepest-epoch'?3:0;enterBattlefieldBack(g,src,src.owner,true);}break;
 case '1':if(chosen?.zone==='graveyard'){(chosen.finMarks??={}).enterCounters=ctx.x??0;const base=copiableDefinition(chosen);const def:CardDef={...base,types:[...new Set([...base.types,'Creature' as const])],subtypes:[...(base.subtypes??[]),'Spirit'],power:1,toughness:1,keywords:[...(base.keywords??[]),'flying']};enterBattlefield(g,chosen,p,false,def);}break;
 case '8':destroyCards(g,g.battlefield.map(id=>g.cards[id]).filter(c=>c.def.types.includes('Artifact')&&manaValue(c.def)===(ctx.x??0)));break;
 case 'artifactMana':(g.players[p].eclRestrictedMana??=[]).push({mana:ef.n===2?'U':'W',rule:'artifactAbility'});break;
 case 'abilityMana':for(let i=0;i<(ef.n??2);i++)(g.players[p].eclRestrictedMana??=[]).push({mana:'C',rule:'ability'});break;
 case '12':if(chosen?.zone==='graveyard'&&manaValue(chosen.def)<=(ctx.x??0))enterBattlefield(g,chosen,p);break;
 case '14':if(chosen){const who=chosen.controller;destroyCards(g,[chosen]);yield*tk('tok-map',2,who);}break;
 case '15':{const[id]=yield*pick(ours({type:['Artifact','Creature'],other:true}).map(c=>c.id),'可犧牲另一個生物或神器');if(id!==undefined){sacrifice(g,g.cards[id]);campusReflexive(g,ctx,[{e:'counters',what:'T0',n:1},{e:'counters',what:'T1',n:1}],[{kind:'creature',optional:true},{kind:'creature',optional:true,differentFrom:0}]);}break;}
 case 'exileGrave':for(const who of resolveRef(g,ctx,'T0').players)for(const id of [...g.players[who].graveyard])moveCard(g,g.cards[id],'exile');break;
 case 'hammer':if(chosen)destroyCards(g,[chosen]);break;
 case '37':if(yield*pay('{2}{W}'))campusReflexive(g,ctx,[{e:'tap',what:'T0'}],[{kind:'creature'}]);break;
 case '39':{const ids=ours({type:['Artifact','Creature'],tapped:false}).map(c=>c.id);if(ids.length>=5&&(yield*meadowYes(p,'橫置五個神器或生物以轉化？'))){for(const id of yield*pick(ids,'橫置五個',5,5))tapCard(g,g.cards[id]);yield*run([{e:'transform',what:'self'}]);}break;}
 case '41':{const keep:number[]=[];for(const who of[g.active,other(g.active)]as PID[]){const ids=g.battlefield.filter(id=>g.cards[id].controller===who&&isCreature(g.cards[id])&&stats(g,g.cards[id]).p<=2);keep.push(...yield*pick(ids,'選擇保留一個力量2以下的生物',1));}destroyCards(g,g.battlefield.map(id=>g.cards[id]).filter(c=>isCreature(c)&&!keep.includes(c.id)));break;}
 case '46':if(chosen){const tapped=chosen.tapped;moveCard(g,chosen,'hand');if(tapped)yield*tk('tok-map');}break;
 case '47':if(chosen){tapCard(g,chosen);(chosen.frontierMarks??={}).cpLockedTapped=1;}break;
 case 'thirdTop':moveCard(g,src,'library');{const lib=g.players[src.owner].library,i=lib.indexOf(src.id);lib.splice(i,1);lib.splice(Math.min(2,lib.length),0,src.id);}break;
 case 'poolsCopy':if(chosen&&ev?.type==='cast'){const spell=g.cards[ev.card];chosen.baseDef??=chosen.def;chosen.def={...copiableDefinition(spell)};chosen.copyLayer=chosen.def;}break;
 case '59':if(chosen){const n=manaValue(chosen.def);yield*run([{e:'counter',what:'T0'}]);yield*campusDiscover(g,ctx,n);}break;
 case 'tapOrUntap':if(chosen&&(yield*meadowYes(p,'要橫置或重置此永久物？'))){if(chosen.tapped)chosen.tapped=false;else tapCard(g,chosen);}break;
 case '61':for(const t of ctx.targets)if(t&&'c'in t){const c=g.cards[t.c];if(c?.zone==='battlefield'){c.campusOriginalDef??=c.def;c.def={id:c.def.id,name:c.def.name,set:c.def.set,rarity:c.def.rarity,cost:c.def.cost,types:['Artifact'],subtypes:['Treasure'],text:'',abilities:[{kind:'activated',cost:{tap:true,sacSelf:true},effects:[{e:'addManaOfChoice',n:1}],label:'犧牲：任意色',manaAbility:true}]};(c.frontierMarks??={}).cpTreasureSource=src.id;c.frontierMarks.cpTreasureVersion=src.objectVersion??0;}}break;
 case '63':{meadowCounter(g,src,'chorus');drawCards(g,p,1);const[id]=yield*pick(g.players[p].hand.slice(),'棄一張牌',1);if(id!==undefined){discardMany(g,[g.cards[id]]);if((src.eclCounters?.chorus??0)>=4&&g.cards[id].zone==='graveyard'&&(yield*meadowYes(p,'免費施放棄掉的牌？')))yield*freeCast(g,ctx,g.cards[id]);}break;}
 case 'removeTime':if((src.eclCounters?.time??0)>0)src.eclCounters!.time--;break;
 case 'reboundCast':if(src.zone==='exile'&&(yield*meadowYes(p,'反彈：免費施放？')))yield*freeCast(g,ctx,src);break;
 case 'animateDinosaur':if(chosen){chosen.baseDef??=chosen.def;chosen.def={...chosen.def,types:[...new Set([...chosen.def.types,'Artifact' as const,'Creature' as const])],subtypes:[...(chosen.def.subtypes??[]),'Dinosaur']};g.eot.push({card:chosen.id,p:0,t:0,kw:[],base:{p:4,t:3}});}break;
 case '73':{const ids=g.players[p].library.slice(0,3),[top]=yield*pick(ids,'可保留一張在牌庫頂');for(const id of ids)if(id!==top)moveCard(g,g.cards[id],'graveyard');break;}
 case '81':{const index=g.stack.findIndex(s=>s.sid===ef.n&&s.kind!=='spell'&&!s.manaAbility);if(index>=0){const[item]=g.stack.splice(index,1),source=g.cards[item.cardId];if(source?.zone==='battlefield'&&(item.sourceLinkKey===undefined||source.tmtLinkKey===item.sourceLinkKey)&&source.def.types.some(t=>t==='Artifact'||t==='Creature'||t==='Planeswalker')){(source.frontierMarks??={}).cpDisableSource=src.id;source.frontierMarks.cpDisableVersion=src.objectVersion??0;}}break;}
 case '88':if(!g.players[opp].hand.length)drawCards(g,p,1);else{const[id]=yield*choose(g,opp,'棄一張牌',g.players[opp].hand.slice(),1);if(id!==undefined)discardMany(g,[g.cards[id]]);}break;
 case '90':{const ids=yield*pick(g.players[p].graveyard.filter(id=>isCreature(g.cards[id])),'可取回至多兩張生物',0,2);for(const id of ids)moveCard(g,g.cards[id],'hand');break;}
 case '94':{const old=g.players.map(p=>p.graveyard.slice());for(const who of[g.active,other(g.active)]as PID[])for(const c of g.battlefield.map(id=>g.cards[id]).filter(c=>c.id!==src.id&&c.controller===who&&isCreature(c)))sacrifice(g,c);for(const who of[g.active,other(g.active)]as PID[])for(const id of old[who])if(g.cards[id].zone==='graveyard'&&isCreature(g.cards[id]))enterBattlefield(g,g.cards[id],who);break;}
 case '98':if(yield*meadowYes(p,'支付1生命，移回手上？')){if(g.players[p].life>=1){loseLife(g,p,1);moveCard(g,src,'hand');}}break;
 case '102':{const who=resolveRef(g,ctx,'T0').players[0]??opp,[id]=yield*pick(g.players[who].hand.filter(id=>!isLand(g.cards[id])),'可暫時放逐非地牌');if(id!==undefined){const c=g.cards[id];moveCard(g,c,'exile');(c.frontierMarks??={}).cpBatSource=src.id;c.frontierMarks.cpBatVersion=src.objectVersion??0;}break;}
 case 'returnAttached':{const id=ev?.type==='dies'?ev.card:src.lastAttachedTo,c=g.cards[id??-1];if(c?.zone==='graveyard')enterBattlefield(g,c,c.owner,true);break;}
 case '108':{const c=ours({attacking:true})[0];if(c){yield*runEffects(g,{...ctx,targets:[{c:c.id}]},[{e:'pump',what:'T0',p:0,t:0,kw:['deathtouch','lifelink']}]);meadowCounter(g,src,'dread');if((src.eclCounters?.dread??0)>=3)yield*run([{e:'transform',what:'self'}]);}break;}
 case 'exileOpponentDeaths':frontierFlags(g,p).cpExileOpponentDeaths=1;break;
 case 'reanimateFinalityLife':if(chosen?.zone==='graveyard'){const n=manaValue(chosen.def);(chosen.finMarks??={}).enterFinality=1;enterBattlefield(g,chosen,p);loseLife(g,p,n);}break;
 case 'exileHandChoice':{const who=resolveRef(g,ctx,'T0').players[0]??opp,[id]=yield*choose(g,who,'放逐一張手牌',g.players[who].hand.slice(),1);if(id!==undefined)moveCard(g,g.cards[id],'exile');break;}
 case '123':{const ids=g.players[p].library.slice(0,2),grave=yield*pick(ids,'刺探2：選擇放入墳墓場',0,2);for(const id of grave)moveCard(g,g.cards[id],'graveyard');const n=ids.length-grave.length;drawCards(g,p,n);loseLife(g,p,3*n);break;}
 case 'tombPermission':frontierFlags(g,p).cpTomb=1;break;
 case '129':{const who=resolveRef(g,ctx,'T0').players[0]??opp,[id]=yield*pick(g.players[who].hand.filter(id=>g.cards[id].def.types.some(t=>t==='Artifact'||t==='Creature')),'選擇神器或生物棄掉',1);if(id!==undefined)discardMany(g,[g.cards[id]]);break;}
 case '133':if(ev?.type==='etb'&&(yield*meadowYes(p,'此生物基礎力量變成新恐龍的力量？'))){const n=stats(g,g.cards[ev.card]).p;g.eot.push({card:src.id,p:0,t:0,kw:[],base:{p:n}});}break;
 case '134':{const ids=g.players[p].library.slice(0,2);let land=false,nonland=false;for(const id of ids){const c=g.cards[id];land||=isLand(c);nonland||=!isLand(c);moveCard(g,c,'exile');campusPermit(g,c,p);}if(land)yield*tk('tok-cp-dino31');if(nonland)yield*tk('tok-treasure');break;}
 case 'rummagePlus':{const ids=yield*pick(g.players[p].hand.slice(),'棄任意張再抓多一張',0,g.players[p].hand.length);discardMany(g,ids.map(id=>g.cards[id]));drawCards(g,p,ids.length+1);break;}
 case '135':meadowCounter(g,src,'bore');if((src.eclCounters?.bore??0)>=3){src.eclCounters!.bore=0;yield*run([{e:'transform',what:'self'}]);}break;
 case 'cantBlock':if(chosen)g.eot.push({card:chosen.id,p:0,t:0,kw:[],cantBlock:true});break;
 case 'impulse':case 'impulseNextEnd':{const id=g.players[p].library[0];if(id!==undefined){const c=g.cards[id];moveCard(g,c,'exile');campusPermit(g,c,p,action==='impulseNextEnd'?g.turn+2:g.turn);if(action==='impulseNextEnd')(c.frontierMarks??={}).cpUntilOwnEnd=p+1;}break;}
 case 'blunderbuss':{const eq=g.battlefield.map(id=>g.cards[id]).find(c=>c.attachedTo===src.id&&c.def.name==='Dire Blunderbuss'),ids=ours({type:'Artifact'}).filter(c=>c.id!==eq?.id).map(c=>c.id),[id]=yield*pick(ids,'可犧牲另一神器');if(id!==undefined){sacrifice(g,g.cards[id]);yield*target(g,ctx,{kind:'creature'},[{e:'damage',from:'self',to:'T0',n:{power:'self'}}]);}break;}
 case '147':if(chosen)(chosen.frontierMarks??={}).cpDreadmaw=g.turn;break;
 case '153':yield*makeEclTokenBatch(g,p,'tok-treasure',Math.max(0,10-(original.lastDiscover??10)),{tapped:true});break;
 case '156':{const[id]=yield*pick(g.players[p].hand.slice(),'可棄一張牌');if(id!==undefined){discardMany(g,[g.cards[id]]);campusReflexive(g,ctx,[{e:'counters',what:'T0',n:1},{e:'pump',what:'T0',p:0,t:0,kw:['trample']}],[{kind:'creature',filter:{attacking:true}}]);}break;}
 case '167':{const eq=g.battlefield.map(id=>g.cards[id]).find(c=>c.attachedTo===src.id&&c.def.name==='Sunfire Torch');if(eq&&(yield*meadowYes(p,'犧牲陽炎火炬？'))){sacrifice(g,eq);yield*target(g,ctx,{kind:'any'},[{e:'damage',from:'self',to:'T0',n:2}]);}break;}
 case '165':if(ev?.type==='cast')dealDamage(g,src,p,{p:ev.player},4);break;
 case 'blockThreeSelf':(src.frontierMarks??={}).cpBlockThree=g.turn;break;
 case '173':if(chosen){const n=manaValue(chosen.def),who=chosen.owner;moveCard(g,chosen,'library',true);shuffleArr(g,g.players[who].library);yield*campusDiscover(g,ctx,n,false,who);}break;
 case '174':{if(ours({sub:'Dinosaur',other:true}).length)gainLife(g,p,3);else{const[id]=yield*pick(g.players[p].hand.filter(id=>g.cards[id].def.subtypes?.includes('Dinosaur')),'可展示恐龍牌');if(id!==undefined)gainLife(g,p,3);}break;}
 case 'movePlus':if(chosen&&src.counters>0){src.counters--;putCounters(g,chosen,1,undefined,p);}break;
 case 'mustBeBlocked':if(chosen)(chosen.frontierMarks??={}).cpMustBlocked=g.turn;break;
 case '185':{const ids=yield*pick(g.players[p].hand.filter(id=>isCreature(g.cards[id])),'可放任意數量生物進場',0,g.players[p].hand.length);for(const id of ids)enterBattlefield(g,g.cards[id],p);break;}
 case 'huatliMana':(src.frontierMarks??={}).cpHuatliChapter=1;break;
 case '192':{const top=g.players[p].library.slice(0,4),[cr]=yield*pick(top.filter(id=>isCreature(g.cards[id])),'可選一張生物'),[land]=yield*pick(top.filter(id=>isLand(g.cards[id])),'可選一張地');for(const id of top)moveCard(g,g.cards[id],id===cr||id===land?'hand':'graveyard');break;}
 case '193':if(chosen)campusLink(g,src,chosen);break;
 case 'dinosaurMana':{const i=yield*meadowMode(p,'恐龍限定法術力',['白','藍','黑','紅','綠']);(g.players[p].eclRestrictedMana??=[]).push({mana:(['W','U','B','R','G']as const)[i],rule:'campusDinosaur'}as any);break;}
 case '198':if(chosen?.enteredTurn===g.turn)putCounters(g,chosen,1,undefined,p);break;
 case '195':{const ids=yield*pick(ours({type:'Creature'}).map(c=>c.id),'選擇一至三個生物分配三個指示物',1,3);let left=3;for(let i=0;i<ids.length;i++){const max=left-(ids.length-i-1),n=i===ids.length-1?left:1+(yield*meadowMode(p,'放幾個指示物',Array.from({length:max},(_,j)=>String(j+1))));putCounters(g,g.cards[ids[i]],n,undefined,p);left-=n;}break;}
 case 'exploreX':for(let i=0;i<(src.castX??0);i++)yield*run([{e:'explore',what:'self'}]);break;
 case '204':{const n=ev?.type==='combatDamage'?ev.amount:0,top=g.players[p].library.slice(0,n);const[cr]=yield*pick(top.filter(id=>isCreature(g.cards[id])),'可放一張生物進場'),[land]=yield*pick(top.filter(id=>isLand(g.cards[id])),'可放一張地進場');for(const id of[cr,land])if(id!==undefined)enterBattlefield(g,g.cards[id],p);const rest=top.filter(id=>id!==cr&&id!==land);shuffleArr(g,rest);for(const id of rest)moveCard(g,g.cards[id],'library',true);break;}
 case '212':{const n=ev?.type==='dies'?ev.power:ef.n??0;yield*tk({id:'tok-cp-fungus-dinosaur',name:'Fungus Dinosaur',set:'TOK',rarity:'T',token:true,types:['Creature'],subtypes:['Fungus','Dinosaur'],colors:['G'],cost:'',power:n,toughness:n,text:''});break;}
 case '213':{const[id]=yield*pick(g.players[p].hand.filter(id=>isLand(g.cards[id])),'可放一張地進場');if(id!==undefined){const cave=g.cards[id].def.subtypes?.includes('Cave');enterBattlefield(g,g.cards[id],p);if(cave)gainLife(g,p,4);}break;}
 case '221':if(stats(g,src).p===20)destroyCards(g,g.battlefield.map(id=>g.cards[id]).filter(c=>c.id!==src.id&&isCreature(c)));break;
 case '222':{drawCards(g,p,1);const[id]=yield*pick(g.players[p].hand.slice(),'棄一張牌',1);if(id!==undefined){const n=manaValue(g.cards[id].def);discardMany(g,[g.cards[id]]);yield*target(g,ctx,{kind:'player'},[{e:'mill',n,who:'T0'}]);}break;}
 case 'topPlay':frontierFlags(g,p).cpTopPlay=1;break;
 case '226':{const ids=ours({type:['Artifact','Creature'],tapped:false}).map(c=>c.id);if(ids.length>=2&&(yield*meadowYes(p,'橫置兩個神器或生物來發現3？'))){for(const id of yield*pick(ids,'選兩個',2,2))tapCard(g,g.cards[id]);yield*campusDiscover(g,ctx,3);}break;}
 case '228':{const[id]=yield*pick(ours({type:'Creature',other:true}).map(c=>c.id),'可複製另一個己方生物');if(id!==undefined){src.baseDef??=src.def;src.def={...copiableDefinition(g.cards[id])};src.copyLayer=src.def;}break;}
 case '229':{const top=g.players[p].library.slice(0,ev?.type==='combatDamage'?ev.amount:0),ids=yield*pick(top.filter(id=>isCreature(g.cards[id])&&g.cards[id].def.subtypes?.includes('Dinosaur')),'放任意數量恐龍進場',0,top.length);for(const id of ids)enterBattlefield(g,g.cards[id],p);const rest=top.filter(id=>!ids.includes(id));shuffleArr(g,rest);for(const id of rest)moveCard(g,g.cards[id],'library',true);break;}
 case '230':if(yield*pay('{2}'))campusReflexive(g,ctx,[{e:'bite',a:'T0',b:'T1'}],[{kind:'creature',filter:{ctrl:'you',sub:'Dinosaur'}},{kind:'creature',differentFrom:0}]);break;
 case '231':{const id=g.players[p].library[0];if(id!==undefined){const c=g.cards[id];if(isCreature(c)&&manaValue(c.def)<=3)moveCard(g,c,'hand');else if(yield*meadowYes(p,'將展示的牌放入墳墓場？'))moveCard(g,c,'graveyard');}break;}
 case '237':{const egg=ours({sub:'Egg'})[0];if(egg&&(yield*meadowYes(p,'犧牲一個蛋？'))){const[id]=yield*pick(ours({sub:'Egg'}).map(c=>c.id),'選擇蛋',1);sacrifice(g,g.cards[id]);yield*tk('tok-cp-dino33');}break;}
 case '238':{for(const t of ctx.targets)if(t&&'c'in t){const c=g.cards[t.c];if(c.zone==='graveyard'){moveCard(g,c,'exile');campusPermit(g,c,p);(g.players[p].pool??=[]).push('R');}}break;}
 case '239':if(chosen){const def=copiableDefinition(chosen),ts=yield*tk({...def,types:[...new Set([...def.types,'Artifact' as const])],keywords:[...(def.keywords??[]),'haste']});for(const t of ts)(g.meadowDelayed??=[]).push({id:g.nextSid++,source:src.id,controller:p,kind:'sacCreated',target:t.id,version:t.objectVersion,turn:g.turn});}break;
 case '240':for(const c of ours({type:'Creature'})){const n=stats(g,c).p-(c.def.power??0);if(n>0)putCounters(g,c,n,undefined,p);}break;
 case '243':{const m=src.frontierMarks??={},k='cpVito:'+g.turn;m[k]=(m[k]??0)+1;if(m[k]===1)gainLife(g,p,2);else if(m[k]===2)loseLife(g,opp,2);else if(m[k]===3)yield*tk('tok-cp-demon');break;}
 case '245':{const opts=['承受3點傷害'];if(g.players[opp].hand.length)opts.push('棄一張牌');if(g.battlefield.some(id=>g.cards[id].controller===opp))opts.push('犧牲永久物');const i=yield*meadowMode(opp,'選擇棄牌、犧牲或傷害',opts);if(opts[i]==='棄一張牌'){const[id]=yield*choose(g,opp,'棄一張牌',g.players[opp].hand.slice(),1);discardMany(g,[g.cards[id]]);}else if(opts[i]==='犧牲永久物'){const[id]=yield*choose(g,opp,'犧牲永久物',g.battlefield.filter(id=>g.cards[id].controller===opp),1);sacrifice(g,g.cards[id]);}else dealDamage(g,src,p,{p:opp},3);break;}
 case 'ballControl':if(ev?.type==='combatDamage'){src.controller=g.cards[ev.source].controller;src.tapped=false;}break;
 case '251':meadowCounter(g,src,'point');if((src.eclCounters?.point??0)>=5){sacrifice(g,src);yield*tk('tok-treasure');}break;
 case 'exileTargets':for(const t of ctx.targets)if(t&&'c'in t&&g.cards[t.c].zone==='graveyard')moveCard(g,g.cards[t.c],'exile');break;
 case 'coreMana':{const n=campusDescent(g,p),i=yield*meadowMode(p,'選擇顏色',['白','藍','黑','紅','綠']);for(let j=0;j<n;j++)(g.players[p].pool??=[]).push((['W','U','B','R','G']as const)[i]);break;}
 case '257':meadowCounter(g,src,'time',ev?.type==='frontier'?ev.amount:0);break;
 case 'doubleTime':meadowCounter(g,src,'time',src.eclCounters?.time??0);break;
 case 'calendarLose':if(src.zone==='battlefield'&&(src.eclCounters?.time??0)>=1000){sacrifice(g,src);loseLife(g,opp,1000);}break;
 case 'locusMana':{const def=src.campusLinked?.[ef.n??0]?.def,cols=def?.produces??[];if(cols.length){const i=yield*meadowMode(p,'選擇法術力',cols),count=def?.id==='gilded-lotus'?3:1;for(let n=0;n<count;n++)(g.players[p].pool??=[]).push(cols[i]);}break;}
 case 'craftedMana':for(const col of new Set(campusMaterials(g,src).flatMap(c=>c.def.colors??[])))(g.players[p].pool??=[]).push(col);break;
 case '266':{const ids=src.campusLinked?.filter(x=>g.cards[x.id].zone==='exile'&&g.cards[x.id].objectVersion===x.version&&x.def.types.includes('Creature')).map(c=>c.id)??[],[id]=yield*pick(ids,'可將製作生物放進戰場攻擊');if(id!==undefined){enterBattlefield(g,g.cards[id],p,true);g.cards[id].attacking=true;g.cards[id].attackTarget=src.attackTarget;}break;}
 case '267':meadowCounter(g,src,'landmark');if((src.eclCounters?.landmark??0)>=3){src.eclCounters!.landmark=0;yield*run([{e:'transform',what:'self'}]);yield*tk('tok-treasure',3);}break;
 case 'cavernMana':{const i=yield*meadowMode(p,'選定類別生物用法力',['白','藍','黑','紅','綠']);(g.players[p].eclRestrictedMana??=[]).push({mana:(['W','U','B','R','G']as const)[i],rule:'campusCavern',source:src.id}as any);break;}
 case 'pitLink':for(const t of ctx.targets)if(t&&'c'in t&&g.cards[t.c].zone==='graveyard')campusLink(g,src,g.cards[t.c]);break;
 case 'pitMana':{const cols=[...new Set(campusMaterials(g,src).flatMap(c=>c.def.colors??[]))];if(cols.length){const i=yield*meadowMode(p,'選擇法術力',cols);(g.players[p].pool??=[]).push(cols[i]);}break;}
 case 'chosenMana':case 'landAbilityMana':if(src.chosenColor)for(let i=0;i<(ef.n??1);i++)if(action==='landAbilityMana')(g.players[p].eclRestrictedMana??=[]).push({mana:src.chosenColor,rule:'campusLandAbility'}as any);else(g.players[p].pool??=[]).push(src.chosenColor);break;
 case 'huatliCreatureMana':{const cols=['R','G','W']as const,i=yield*meadowMode(p,'選擇紅綠白',[...cols]);(g.players[p].pool??=[]).push(cols[i]);break;}
 case 'confluenceAnimate':{const[id]=yield*pick(ours({sub:'Cave'}).map(c=>c.id),'選擇一個洞窟',1);if(id!==undefined)yield*runEffects(g,{...ctx,targets:[{c:id}]},[{e:'counters',what:'T0',n:3},{e:'animate',what:'T0',p:0,t:0,subtypes:['Elemental'],kw:['haste'],permanent:true}]);break;}
 case 'mayPutLand':{const[id]=yield*pick(g.players[p].hand.filter(id=>isLand(g.cards[id])),'可放一張地進場');if(id!==undefined)enterBattlefield(g,g.cards[id],p,true);break;}
 case 'returnSelfFinality':(src.finMarks??={}).enterFinality=1;enterBattlefield(g,src,p);break;
 case 'dreadmawDestroy':if(ev?.type==='combatDamage')yield*target(g,ctx,{kind:'permanent',filter:{ctrl:'opp',type:'Artifact'}},[{e:'destroy',what:'T0'}]);break;
 default:throw Error('Unsupported LCI effect '+action);
 }
}
