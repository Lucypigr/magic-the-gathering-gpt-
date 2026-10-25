import {supplementDft} from './dft-remaining';
import {supplementBlb} from './blb-remaining';
import {patchBuilder} from './meadow-dsl';
import blb from './blb-catalog.json';
import dft from './dft-catalog.json';
import blbAuto from './blb-auto.json';
import dftAuto from './dft-auto.json';
import { add, defs, slug, act, etb, trig, CR, MY_CR, OPP_CR, OPP } from '../dsl';
import { REPRINTS } from '../reprints';
import { pump, cnt, draw, destroy, token, gy, mine, spec } from './frontier-dsl';
import type { Ability, CardDef, Cond, Filter, Grant, Ref } from '../../engine/types';
const all=(filter:Filter):Ref=>({all:filter});
const self=(grant:Grant,cond?:Cond):Ability=>({kind:'static',self:{grant,cond}});
const anthem=(filter:Filter,grant:Grant):Ability=>({kind:'static',anthem:{filter,grant}});
const ownVehicle=spec('permanent',{ctrl:'you',or:[{type:'Creature'},{sub:'Vehicle'}]});
const vehicle=spec('permanent',{or:[{type:'Creature'},{sub:'Vehicle'}]});
const mount=spec('permanent',{or:[{sub:'Mount'},{sub:'Vehicle'}]});
const threshold:Cond={c:'gyCount',filter:{},n:7};
const valiant=(effects:Parameters<typeof trig>[1])=>trig('targeted',effects,{oncePerTurn:true});
const B=patchBuilder(blbAuto),D=patchBuilder(dftAuto);
{
 const {d,a,s}=B;
 a(1,[etb([{e:'exileLinked',what:'T0'}],{targets:[spec('permanent',{nonType:'Land',ctrl:'opp'})]})]);
 a(14,[valiant([pump(all({ctrl:'you',type:'Creature',sub:'Mouse'}),1,0)])]);
 s(21,[pump('T0',2,2),pump('T1',1,1)],[CR,{...CR,optional:true,differentFrom:0}]);
 s(26,[pump(mine,2,1),{e:'if',cond:{c:'controls',filter:{sub:'Rabbit'}},then:[{e:'scry',n:2}]}]);
 s(27,[destroy],[spec('creature',{or:[{powMin:4},{toughMin:4}]})]);
 a(30,[trig('attacks',[pump('self',2,0)],{cond:{c:'controls',filter:{token:true}}})]);
 a(38,[trig('youAttack',[],{modes:[{text:'派出橫置且正攻擊的兔子',effects:[{...token('tok-g-rabbit-11-w'),tapped:true,attacking:true}]},{text:'攻擊生物得+1/+1',effects:[pump(all({ctrl:'you',attacking:true}),1,1)]}]})]);
 s(43,[{e:'bounce',what:'T0'},{e:'bounce',what:'T1'},{e:'draw',n:2},{e:'discard',n:1,who:'you'}],[{...CR,optional:true},{...CR,optional:true,differentFrom:0}]);
 s(45,[{e:'if',cond:{c:'controls',filter:{sub:'Bird'}},then:[{e:'counterUnless',what:'T0',pay:4}],else:[{e:'counterUnless',what:'T0',pay:2}]}],[spec('spell')]);
 a(55,[trig('allyEtb',[token('tok-g-fish-11-u')],{filter:{sub:'Bird',token:false}})]);
 a(60,[trig('upkeep',[{e:'surveil',n:1}]),{kind:'static',anthem:{filter:{ctrl:'opp',type:'Creature'},grant:{p:-1}},condition:threshold}]);
 a(62,[self({p:1,kw:['unblockable']},threshold)]);
 s(64,[{e:'draw',n:2}]);d(64,{costReduce:{cond:{c:'controls',filter:{sub:'Otter'}},mana:'{1}'}});
 s(67,[{e:'bounce',what:'T0'},{e:'bounce',what:'T1'}],[CR,{...CR,differentControllerFrom:0}]);
 s(69,[pump('T0',1,1,['hexproof']),{e:'untap',what:'T0'}],[MY_CR]);
 a(70,[trig('combatDamagePlayer',[draw,{e:'if',cond:{c:'not',cond:threshold},then:[{e:'discard',n:1,who:'you'}]}])]);d(70,{keywords:['unblockable']});
 a(73,[etb([{e:'tap',what:'T0'},{e:'stun',what:'T0'}],{targets:[{...CR,optional:true}]})]);
 a(77,[act({mana:'{1}{U}'},[cnt('self'),draw],'門檻：放指示物並抓牌',{oncePerGame:true,cond:threshold})]);
 a(78,[etb([{e:'dig',n:4,take:1,optional:true,filter:{nonType:['Creature','Land']},rest:'bottom',randomBottom:true}])]);
 a(84,[act({mana:'{3}{B}',exileSelf:true},[{e:'toHand',what:'T0'}],'取回另一張生物牌',{fromGraveyard:true,targets:[{...gy({type:'Creature'}),notSelf:true}]})]);
 a(90,[trig('upkeep',[{e:'revealDraw'}])]);
 a(92,[etb([],{modes:[{text:'對手生物得-1/-1',targets:[OPP_CR],effects:[pump('T0',-1,-1)]},{text:'消滅受過傷害的對手生物',targets:[spec('creature',{ctrl:'opp',damaged:true})],effects:[destroy]}]})]);
 s(97,[{e:'toHand',what:'T0'},{e:'toHand',what:'T1'},{e:'lose',n:2,who:'opp'},{e:'gain',n:2}],[gy({type:'Creature'},true),{...gy({type:'Creature'},true),differentFrom:0}]);
 s(105,[{e:'discard',n:2,who:'opp'},{e:'if',cond:{c:'controls',filter:{sub:'Rat'}},then:[{e:'surveil',n:2}]}],[OPP]);
 s(110,[pump('T0',2,0,['lifelink','indestructible'])],[CR]);d(110,{costReduce:{perCount:{ctrl:'you',sub:'Lizard'}}});
 s(130,[{e:'damage',n:6,to:'T0'},{e:'damage',n:2,to:'T1'}],[CR,spec('creature',{token:true},true)]);
 s(144,[pump('T0',0,0,['trample']),{e:'if',cond:{c:'controls',filter:{sub:'Mouse'}},then:[pump('T0',1,0)]},draw],[CR]);
 s(147,[pump('T0',1,0),{e:'damage',from:'T0',n:{power:'T0'},to:'T1'}],[MY_CR,OPP_CR]);
 a(170,[self({p:2,kw:['trample']},{c:'controls',filter:{token:true}})]);
 s(176,[pump('T0',1,3,['reach']),{e:'untap',what:'T0'}],[CR]);
 a(177,[etb([],{modes:[{text:'放置+1/+1指示物',effects:[cnt('T0')],targets:[MY_CR]},{text:'與生物衍生物互鬥',effects:[{e:'fight',a:'self',b:'T0'}],targets:[spec('creature',{token:true})]},{text:'消滅神器或結界',effects:[destroy],targets:[spec('permanent',{type:['Artifact','Enchantment']})]}]})]);
 a(178,[etb([cnt('self',{count:{ctrl:'you',other:true,or:[{sub:'Squirrel'},{sub:'Food'}]}})]),trig('allyPermEtb',[cnt('self')],{filter:{or:[{sub:'Squirrel'},{sub:'Food'}]}})]);
 a(193,[etb([{e:'bounce',what:'T0'}],{targets:[{...spec('permanent',{ctrl:'you'},true),notSelf:true}]})]);
 a(195,[etb([cnt('T0'),{e:'gain',n:1}],{targets:[CR]})]);
 a(200,[etb([pump('T0',{count:{ctrl:'you',type:'Creature'}},{count:{ctrl:'you',type:'Creature'}},['vigilance'])],{targets:[MY_CR]})]);
 a(202,[trig('allyEtb',[cnt('self')],{filter:{sub:['Frog','Rabbit','Raccoon','Squirrel']}})]);
 a(205,[act({tapN:{filter:{token:true},n:2}},[{e:'addManaOfChoice',n:1}],'橫置兩個衍生物：加法力',{manaAbility:true}),act({tapN:{filter:{token:true},n:3}},[draw],'橫置三個衍生物：抓牌'),act({tapN:{filter:{token:true},n:4}},[cnt('self',3),pump('self',0,0,['trample'])],'橫置四個衍生物：強化')]);
 a(222,[act({mana:'{1}{G}{U}'},[{e:'flicker',what:'T0',counters:1}],'閃爍另一個生物並放指示物',{sorcery:true,targets:[{...MY_CR,notSelf:true}]})]);
 a(234,[{kind:'static',spellCostLess:{filter:{type:['Instant','Sorcery']},n:1}}]);
 d(243,{changeling:true,abilities:[act({mana:'{2}'},[{e:'toLibraryBottom',what:'T0'}],'將墳墓場的牌放牌庫底',{targets:[gy()]})]});
 d(251,{changeling:true,abilities:[act({mana:'{1}'},[{e:'addManaOfChoice',n:1}],'轉換法力',{oncePerTurn:true,manaAbility:true})]});
 a(380,[etb([cnt('T0'),cnt('T1')],{targets:[{...CR,optional:true},{...CR,optional:true,differentFrom:0}]}),trig('allyAttacks',[{e:'doubleCounters',what:'trig'}],{filter:{plusCounters:true}})]);
 a(387,[trig('allyEtb',[cnt('trig',2)],{filter:{powMax:2}})]);
 d(388,{aura:{target:CR,grant:{noUntap:true}},abilities:[etb([{e:'tap',what:'attached'}])]});
 d(392,{aura:{target:CR,grant:{p:20,t:20}},abilities:[etb([{e:'tap',what:'attached'}])]});
}
{
 const {d,a,s}=D;
 d(10,{spell:{modes:[{text:'傷害生物',effects:[{e:'damage',to:'T0',n:{count:{ctrl:'you',or:[{type:'Creature'},{sub:'Vehicle'}]}}}],targets:[CR]},{text:'消滅神器',effects:[destroy],targets:[spec('permanent',{type:'Artifact'})]}]}});
 a(11,[act({mana:'{3}{W}'},[cnt('T0')],'放指示物',{targets:[mount]})]);
 a(12,[etb([{e:'exileLinked',what:'T0'}],{targets:[spec('permanent',{ctrl:'opp',type:['Artifact','Creature']})]})]);
 s(13,[destroy],[spec('creature',{toughMin:4})]);
 a(14,[trig('attacks',[{e:'tutor',filter:{type:'Land',sub:'Plains',basic:true}}],{cond:{c:'saddled'}})]);
 a(15,[trig('attacks',[{e:'tutor',filter:{nonType:['Instant','Sorcery','Land'],mvMax:3},to:'battlefield'}],{cond:{c:'saddled'}})]);d(15,{ward:2});
 a(16,[{kind:'static',selfPowerCount:{ctrl:'you',type:'Artifact'}}]);
 a(21,[etb([pump('T0',0,0,['lifelink','indestructible'])],{targets:[vehicle]})]);
 a(23,[etb([{e:'exileLinked',what:'T0'}],{targets:[spec('permanent',{ctrl:'opp',nonType:'Land'})]}),act({tap:true},[cnt('T0')],'最高速度：放指示物',{sorcery:true,cond:{c:'maxSpeed'},targets:[ownVehicle]})]);
 a(24,[trig('combatStart',[pump('T0',0,0,['double_strike'])],{cond:{c:'maxSpeed'},targets:[ownVehicle]})]);
 a(27,[anthem({ctrl:'you',type:'Artifact',alsoType:'Creature',other:true},{p:2,t:2}),trig('attacks',[{e:'reanimate',what:'T0'}],{targets:[gy({type:'Artifact'},true)]})]);
 a(34,[trig('attacks',[pump('self',0,0,['indestructible']),{e:'untap',what:mine}],{cond:{c:'saddled'}})]);
 a(36,[etb([{e:'scry',n:1}]),act({tapN:{filter:{type:'Creature',other:true},n:3}},[{e:'animate',what:'self',p:2,t:2},pump('self',0,0,['flying']),cnt('self')],'橫置三個其他生物：啟動')]);
 a(37,[{kind:'static',spellCostLess:{filter:{type:'Artifact'},n:1}}]);
 a(38,[act({mana:'{2}',tap:true},[draw],'抓一張牌'),trig('draw',[{e:'mill',who:'opp',n:2}],{cond:{c:'maxSpeed'}})]);
 s(39,[{e:'bounce',what:'T0'}],[vehicle]);
 d(42,{aura:{target:vehicle,grant:{noUntap:true,loseAbilities:true}},abilities:[etb([{e:'tap',what:'attached'}])]});
 a(51,[act({mana:'{X}{U}{U}',tap:true},[{e:'draw',n:{x:true}},cnt(all({ctrl:'you',type:'Creature',sub:'Merfolk'}))],'竭絕：抓X張並放指示物',{oncePerGame:true,xMana:1})]);
 s(63,[{e:'counterUnless',what:'T0',pay:4}],[spec('spell',{type:['Artifact','Creature']})]);
 s(66,[{e:'tap',what:'T0'},{e:'stun',what:'T0',n:3}],[vehicle]);
 s(67,[{e:'dig',n:5,take:2,rest:'bottom'}]);
 a(70,[etb([{e:'tutor',filter:{type:'Artifact',mvMin:4,mvMax:5},optional:true}])]);
 s(71,[{e:'topOrBottom',what:'T0'}],[spec('permanent',{nonType:'Land'})]);
 a(72,[trig('endStep',[{e:'untap',what:all({ctrl:'you',nonType:'Land'})}])]);
 d(79,{costReduce:{perGy:{type:['Artifact','Creature']}}});
 a(85,[act({mana:'{B}',sacOther:{or:[{type:'Creature'},{sub:'Vehicle'}]}},[draw],'最高速度：犧牲另一個生物或載具抓牌',{cond:{c:'maxSpeed'}})]);d(85,{etbTapped:true});
 a(91,[etb([token('tok-g-zombie-22-b')]),act({mana:'{1}{B}',sacSelf:true},[{e:'tutor',filter:{}}],'最高速度：搜尋牌',{sorcery:true,cond:{c:'maxSpeed'}})]);
 s(103,[{e:'draw',n:2},{e:'lose',who:'you',n:2},{e:'lose',who:'opp',n:2}]);
 a(104,[etb([pump(all({type:'Creature',other:true}),-2,-2)])]);
 s(106,[destroy],[vehicle]);
 d(119,{spell:{modes:[{text:'消滅載具',effects:[destroy],targets:[spec('permanent',{sub:'Vehicle'})]},{text:'造成6點傷害',effects:[{e:'damage',n:6,to:'T0'}],targets:[spec('creatureOrPlaneswalker')]}]}});
 a(124,[act({tap:true},[{e:'addMana',mana:['R','R']}],'最高速度：加兩點紅色法力',{manaAbility:true,cond:{c:'maxSpeed'}})]);
 a(148,[act({discard:1},[draw],'棄一張牌：抓一張牌',{sorcery:true,oncePerTurn:true})]);
 a(153,[etb([token('tok-g-elephant-33-g')]),trig('attacks',[token('tok-g-elephant-33-g')],{cond:{c:'saddled'}})]);
 a(154,[act({mana:'{4}{G}'},[{e:'dig',n:3,take:1,optional:true,filter:{nonType:['Instant','Sorcery']},rest:'bottom'}],'檢視三張牌，取一張永久物')]);
 s(156,[destroy],[spec('permanent',{or:[{type:['Artifact','Enchantment']},{type:'Creature',kw:'flying'}]})]);
 a(162,[etb([pump('T0',2,2)],{targets:[{...ownVehicle,notSelf:true}]})]);
 a(172,[etb([{e:'mill',n:2,who:'you'},cnt('self',{gy:{type:['Artifact','Creature']}})])]);
 d(174,{spell:{modes:[{text:'生物互鬥',effects:[{e:'fight',a:'T0',b:'T1'}],targets:[MY_CR,OPP_CR]},{text:'消滅載具',effects:[destroy],targets:[spec('permanent',{sub:'Vehicle'})]}]}});
 d(180,{aura:{target:vehicle,grant:{p:1,t:2,kw:['reach']}},abilities:[etb([{e:'untap',what:'attached'}])]});
 a(188,[act({tap:true},[pump('T0',0,0,['lifelink','unblockable'])],'授予繫命且不能被阻擋',{targets:[spec('creature',{ctrl:'you',powMax:2})]})]);
 a(191,[etb([{e:'tutorMany',filter:{type:['Artifact','Creature','Enchantment'],mvMax:1},n:2,to:'hand'}])]);
 a(193,[trig('upkeep',[{e:'surveil',n:1}]),act({mana:'{2}{B}{G}',tap:true,sacSelf:true},[{e:'reanimate',what:'T0'}],'復活生物或載具',{sorcery:true,targets:[gy({or:[{type:'Creature'},{sub:'Vehicle'}]})]})]);
 a(205,[etb([{e:'damage',n:1,to:'T0'},{e:'gain',n:1}],{targets:[OPP]}),self({kw:['deathtouch','haste']},{c:'maxSpeed'})]);
 a(208,[trig('youAttack',[pump('T0',1,0,['deathtouch']),{e:'untap',what:'T0'}],{targets:[MY_CR]})]);
 a(211,[trig('attacks',[cnt('T0'),cnt('T1')],{cond:{c:'saddled'},targets:[{...mount,optional:true},{...mount,optional:true,differentFrom:0}]})]);
 a(212,[act({mana:'{G}',tap:true},[{e:'addManaOfChoice',n:3}],'竭絕：加三點同色法力',{oncePerGame:true,manaAbility:true}),act({mana:'{U}',tap:true},[{e:'draw',n:3}],'竭絕：抓三張牌',{oncePerGame:true}),act({mana:'{R}',tap:true},[{e:'damage',n:3,to:'T0'}],'竭絕：造成3點傷害',{oncePerGame:true,targets:[spec('any')]})]);
 a(225,[etb([destroy],{targets:[spec('permanent',{ctrl:'opp',nonType:'Land',mvMax:4})]})]);
 a(226,[trig('endStep',[{e:'untap',what:mine}]),act({mana:'{2}{G}{W}'},[pump(mine,1,1)],'己方生物得+1/+1')]);
 d(227,{costReduce:{perCount:{ctrl:'you',type:'Artifact'}},spell:{effects:[{e:'draw',n:3},{e:'gain',n:3}]}});
 a(230,[act({mana:'{2}',tap:true,sacSelf:true},[destroy],'消滅另一個神器',{sorcery:true,targets:[{...spec('permanent',{type:'Artifact'}),notSelf:true}]})]);
 a(242,[act({mana:'{3}',tap:true,sacSelf:true},[{e:'damage',n:3,to:'T0'}],'造成3點傷害',{targets:[CR]}),act({mana:'{6}',tap:true,sacSelf:true},[destroy],'消滅生物或載具',{targets:[vehicle]})]);

}
supplementBlb(B);
supplementDft(D);
export const VERIFIED_BLB_DFT={BLB:[...B.patches.keys()],DFT:[...D.patches.keys()]};
/** Install the complete printed catalogs, preserving shared reprint identities. */
export function supplementBlbDft(){
 for(const [code,catalog,patches] of [['BLB',blb,B.patches],['DFT',dft,D.patches]] as const){
  for(const row of catalog){
   const patch=patches.get(row.number);if(!patch)continue;
   const c={...row,...patch,id:slug(row.name),text:row.text} as unknown as CardDef;
   if(code==='BLB'&&row.text.startsWith('Gift'))for(const mode of c.spell?.modes??[])if(mode.text==='送禮')mode.effects=[{e:'frontier',action:'blb:gift'},...mode.effects.slice(1)];
   const cycling=row.text.match(/^Cycling ((?:\{[^}]+\})+)/m);if(cycling)c.cycling={cost:cycling[1]};
   if(row.text.includes('Start your engines!'))c.startEngines=true;
   const offspring=row.text.match(/^Offspring ((?:\{[^}]+\})+)/m);if(offspring)c.offspring=offspring[1];
   const saddle=row.text.match(/^Saddle (\d+)/m);if(saddle&&!c.abilities?.some(a=>a.kind==='activated'&&a.effects.some(e=>e.e==='saddle')))c.abilities=[...(c.abilities??[]),act({crew:Number(saddle[1])},[{e:'saddle'}],'騎乘'+saddle[1],{sorcery:true})];
   const crew=row.text.match(/^Crew (\d+)/m);if(crew&&!c.abilities?.some(a=>a.kind==='activated'&&a.cost.crew))c.abilities=[...(c.abilities??[]),act({crew:Number(crew[1])},[{e:'animate',what:'self',p:c.power??0,t:c.toughness??0}],'搭載'+crew[1])];
   if(code==='DFT'&&row.text.includes('Exhaust'))for(const a of c.abilities??[])if(a.kind==='activated'&&a.oncePerGame)a.bdExhaust=true;
   if(code==='DFT')for(const a of c.abilities??[])if(a.kind==='activated'&&a.oncePerGame)a.label=a.label.replace(/^竭力：/,'竭絕：');
   if(c.meadow?.gift)c.abilities=[...(c.abilities??[]),{kind:'trigger',on:'etb',when:{c:'frontier',action:'blb:giftPromised'},effects:[{e:'frontier',action:'blb:gift'}]}];
   for(const a of c.abilities??[])if(a.kind==='trigger'&&a.cond?.c==='classLevel'){const gate=a.cond;a.cond=undefined;a.when=a.when?{c:'and',conds:[a.when,gate]}:gate;}
   const old=defs.find(d=>d.id===c.id);
   if(old&&old.set!==code){
    c.set=old.set;const reprints=REPRINTS[code]??=[];if(!reprints.some(([id])=>id===c.id))reprints.push([c.id,c.rarity]);}
   if(old){for(const k of Object.keys(old))delete(old as any)[k];Object.assign(old,c);}else add(c);
  }
  if(patches.size===catalog.length){const ids=new Set(catalog.map(c=>slug(c.name)));for(const c of defs)if(c.set===code&&!ids.has(c.id))c.boosterExcluded=true;REPRINTS[code]=(REPRINTS[code]??[]).filter(([id])=>ids.has(id));}
 }
}
