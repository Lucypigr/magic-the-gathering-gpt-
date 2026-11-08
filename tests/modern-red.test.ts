import {describe,it,expect}from'vitest';
import {slug,MODERN_AI_DECKS,expandDeck}from'../src/data';
import catalog from'../src/data/sets/modern-red-catalog.json';
import{getDef}from'../src/engine/registry';
import{zhName,sourcedChineseName,publishedChineseName}from'../src/data/names';
import{traditionalRulesText}from'../src/data/localization';
import{abilitiesFor,castAlts,castOptionsFor,castDuringResolution,performAction,spellCost}from'../src/engine/actions';
import{cloneGame,stats}from'../src/engine/state';
import{manaValue}from'../src/engine/mana';
import{dealDamage,loseLife,emit,enterBattlefield,moveCard}from'../src/engine/zones';
import{putFaceDown}from'../src/engine/facedown';
import{runEffects}from'../src/engine/effects';
import{runGame,settle}from'../src/engine/flow';
import{runHeadless}from'../src/engine/controller';
import{mk,put,inHand,inGy,resolve,settleAll,answerDefault,type Answer}from'./helpers';
import type{TargetRef,Response,Effect}from'../src/engine/types';
const cast=(g:ReturnType<typeof mk>,c:ReturnType<typeof inHand>,targets:TargetRef[]=[],extra={})=>performAction(g,c.owner,{type:'cast',card:c.id,targets,...extra});
const activate=(g:ReturnType<typeof mk>,c:ReturnType<typeof put>,ability=0,targets:TargetRef[]=[])=>performAction(g,c.controller,{type:'activate',card:c.id,ability,targets});
const targetOpponent:Answer=d=>d.type==='targets'?{type:'targets',targets:[{p:1}]}:undefined;
function triggers(g:ReturnType<typeof mk>){const gen=settle(g);let r=gen.next();while(!r.done)r=gen.next(answerDefault(g,r.value));}
function suspended(){const g=mk(),c=inHand(g,0,'rift-bolt');g.players[0].pool=['R'];expect(cast(g,c,[],{alt:'modernSuspend'})).toBeNull();return{g,c};}
function upkeep(g:ReturnType<typeof mk>){g.turn+=2;g.active=0;g.phase='upkeep';emit(g,{type:'step',step:'upkeep',player:0});}

describe('Mono-Red Burn additional cards',()=>{
 it.each(catalog)('$name matches pinned printed data with sourced Chinese',row=>{
  const c=getDef(slug(row.name));for(const k of['cost','types','subtypes','supertypes','colors','text']as const)expect(c[k],k).toEqual(row[k]);
  if('power'in row){expect(c.power).toBe(row.power);expect(c.toughness).toBe(row.toughness);}
  expect(zhName(c)).toMatch(/\p{Script=Han}/u);expect(publishedChineseName(c)??sourcedChineseName(c)).toBeDefined();expect(traditionalRulesText(c.text)).toMatch(/\p{Script=Han}/u);
 });
 it('Seal sacrifices as a cost, and deals two from the graveyard when the ability resolves',()=>{
  const g=mk(),c=put(g,0,'seal-of-fire');expect(activate(g,c,0,[{p:1}])).toBeNull();expect(c.zone).toBe('graveyard');expect(g.players[1].life).toBe(20);resolve(g);expect(g.players[1].life).toBe(18);
 });
 it('Consign cannot target Seal’s activated ability; sacrifice remains paid',()=>{
  const g=mk(),c=put(g,0,'seal-of-fire');expect(activate(g,c,0,[{p:1}])).toBeNull();const counter=inHand(g,1,'consign-to-memory');g.players[1].pool=['U'];expect(cast(g,counter,[],{stackTargetSid:g.stack[0].sid})).not.toBeNull(); // Consign only counters triggered abilities, not activated ones.
  resolve(g);expect(g.players[1].life).toBe(18);expect(c.zone).toBe('graveyard');
 });
 it('Incinerator costs 5R minus all noncombat damage to opponents, including their own sources',()=>{
  const g=mk(),c=inHand(g,0,'chandras-incinerator'),src=put(g,1,'barbarian-ring');expect(spellCost(g,c,0).generic).toBe(5);
  loseLife(g,1,2);expect(spellCost(g,c,0).generic).toBe(5);dealDamage(g,src,1,{p:1},2);expect(spellCost(g,c,0).generic).toBe(3);
  dealDamage(g,null,0,{p:1},2,{combat:true});expect(spellCost(g,c,0).generic).toBe(3);
  dealDamage(g,null,0,{p:1},5);expect(spellCost(g,c,0).generic).toBe(0);g.players[0].pool=['R'];expect(cast(g,c)).toBeNull();expect(manaValue(c.castFace!)).toBe(6);resolve(g);expect(stats(g,c).kw.has('trample')).toBe(true);
 });
 it('Incinerator counts only damage actually dealt and the discount expires with the turn',()=>{
  const g=mk(),c=inHand(g,0,'chandras-incinerator');g.players[1].eclPreventDamageUntil=1;dealDamage(g,null,0,{p:1},5);expect(spellCost(g,c,0).generic).toBe(5);delete g.players[1].eclPreventDamageUntil;dealDamage(g,null,0,{p:1},2);expect(spellCost(g,c,0).generic).toBe(3);g.turn++;expect(spellCost(g,c,0).generic).toBe(5);
 });
 it('Incinerator copies the amount of each controlled noncombat source to an opposing creature',()=>{
  const g=mk(),inc=put(g,0,'chandras-incinerator'),body=put(g,1,'armament-dragon'),bolt=inHand(g,0,'lightning-bolt');body.counters=5;g.players[0].pool=['R'];expect(cast(g,bolt,[{p:1}])).toBeNull();resolve(g);expect(g.players[1].life).toBe(17);settleAll(g,d=>d.type==='targets'?{type:'targets',targets:[{c:body.id}]}:undefined);expect(body.damage).toBe(3);expect(inc.damage).toBe(0);
 });
 it('an opposing source damaging its own controller discounts Incinerator but does not trigger it',()=>{
  const g=mk();put(g,0,'chandras-incinerator');put(g,1,'armament-dragon');const ring=put(g,1,'barbarian-ring');dealDamage(g,ring,1,{p:1},1);triggers(g);expect(g.stack).toHaveLength(0);
 });
 it('Firecraft deals four and cannot be countered with two instant/sorcery cards in its controller graveyard',()=>{
  const g=mk(),c=inHand(g,0,'exquisite-firecraft');inGy(g,0,'opt');inGy(g,0,'lightning-bolt');g.players[0].pool=['R','R','C'];expect(cast(g,c,[{p:1}])).toBeNull();const counter=inHand(g,1,'counterspell');g.players[1].pool=['U','U'];expect(cast(g,counter,[{c:c.id}])).toBeNull();resolve(g);expect(c.zone).toBe('stack');resolve(g);expect(g.players[1].life).toBe(16);
 });
 it('spell mastery is checked at counter resolution and can be lost after casting',()=>{
  const g=mk(),c=inHand(g,0,'exquisite-firecraft'),a=inGy(g,0,'opt'),b=inGy(g,0,'lightning-bolt');g.players[0].pool=['R','R','C'];expect(cast(g,c,[{p:1}])).toBeNull();const counter=inHand(g,1,'counterspell');g.players[1].pool=['U','U'];expect(cast(g,counter,[{c:c.id}])).toBeNull();moveCard(g,a,'exile');moveCard(g,b,'exile');resolve(g);expect(c.zone).toBe('graveyard');expect(g.players[1].life).toBe(20);
 });
 it.each(['fin','tmt','mkm'] as const)('spell mastery also applies to existing %s counter effects',engine=>{
  const g=mk(),c=inHand(g,0,'exquisite-firecraft');inGy(g,0,'opt');inGy(g,0,'lightning-bolt');g.players[0].pool=['R','R','C'];expect(cast(g,c,[{p:1}])).toBeNull();const counter=inHand(g,1,'counterspell');
  const effect=engine==='fin'?{e:'fin',action:'counterStack',n:g.stack[0].sid}:engine==='tmt'?{e:'tmt',action:'ward',n:g.stack[0].sid,amount:3}:{e:'mkm',action:'221'};
  const gen=runEffects(g,{controller:1,source:counter.id,targets:[{c:c.id}]},[effect as Effect]);let r=gen.next();while(!r.done)r=gen.next(r.value.type==='yesno'?{type:'yesno',yes:false}:answerDefault(g,r.value));expect(c.zone).toBe('stack');expect(g.stack.some(s=>s.cardId===c.id)).toBe(true);
 });
 it('Suspend is a special action, not a spell cast, and does not trigger Eidolon or Vortex',()=>{
  const g=mk();put(g,1,'eidolon-of-the-great-revel');put(g,1,'roiling-vortex');const c=inHand(g,0,'rift-bolt');g.players[0].pool=['R'];expect(castOptionsFor(g,0,c).some(o=>o.alt==='modernSuspend'&&o.specs.length===0)).toBe(true);expect(cast(g,c,[],{alt:'modernSuspend'})).toBeNull();expect(c.zone).toBe('exile');expect(c.eclCounters?.time).toBe(1);expect(g.stack).toHaveLength(0);expect(g.pending).toHaveLength(0);expect(g.players[0].spellsThisTurn).toBe(0);expect(g.players[0].life).toBe(20);
 });
 it('Suspend cannot be used from the graveyard, in the opponent turn, or in response',()=>{
  const g=mk(),c=inHand(g,0,'rift-bolt');g.players[0].pool=['R'];g.active=1;expect(cast(g,c,[],{alt:'modernSuspend'})).not.toBeNull();g.active=0;const enemy=inHand(g,1,'opt');g.players[1].pool=['U'];expect(cast(g,enemy)).toBeNull();expect(cast(g,c,[],{alt:'modernSuspend'})).not.toBeNull();resolve(g);moveCard(g,c,'graveyard');expect(cast(g,c,[],{alt:'modernSuspend'})).not.toBeNull();
 });
 it('removes a time counter only in the owner upkeep, then offers a real zero-mana cast with mana value three',()=>{
  const{g,c}=suspended();emit(g,{type:'step',step:'upkeep',player:1});triggers(g);expect(g.stack).toHaveLength(0);upkeep(g);triggers(g);expect(g.stack).toHaveLength(1);resolve(g);expect(c.eclCounters?.time).toBe(0);expect(c.zone).toBe('exile');triggers(g);resolve(g,targetOpponent);expect(c.zone).toBe('stack');expect(manaValue(c.castFace!)).toBe(3);expect(c.manaSpent).toBe(0);resolve(g);expect(g.players[1].life).toBe(17);
 });
 it('the time-removal trigger is counterable and leaves a time counter for next upkeep',()=>{
  const{g,c}=suspended();upkeep(g);triggers(g);const counter=inHand(g,1,'consign-to-memory');g.players[1].pool=['U'];expect(cast(g,counter,[],{stackTargetSid:g.stack[0].sid})).toBeNull();resolve(g);expect(c.eclCounters?.time).toBe(1);upkeep(g);settleAll(g,targetOpponent);expect(c.zone).toBe('graveyard');expect(g.players[1].life).toBe(17);
 });
 it('the final-counter cast trigger is independently counterable, leaving the card exiled without permission',()=>{
  const{g,c}=suspended();upkeep(g);triggers(g);resolve(g);triggers(g);const counter=inHand(g,1,'consign-to-memory');g.players[1].pool=['U'];expect(cast(g,counter,[],{stackTargetSid:g.stack[0].sid})).toBeNull();resolve(g);expect(c.zone).toBe('exile');expect(c.eclCounters?.time).toBe(0);expect(castAlts(g,0,c)).toEqual([]);upkeep(g);triggers(g);expect(g.stack).toHaveLength(0);
 });
 it('the controller may decline the last-counter cast and the card stays exiled',()=>{
  const{g,c}=suspended();upkeep(g);settleAll(g,d=>d.type==='yesno'?{type:'yesno',yes:false}:undefined);expect(c.zone).toBe('exile');expect(castAlts(g,0,c)).toEqual([]);
 });
 it('suspended casting triggers Eidolon at mana value three and Vortex for spending no mana',()=>{
  const{g,c}=suspended();put(g,1,'eidolon-of-the-great-revel');put(g,1,'roiling-vortex');upkeep(g);settleAll(g,targetOpponent);expect(c.zone).toBe('graveyard');expect(g.players[0].life).toBe(12);expect(g.players[1].life).toBe(17);
 });
 it.each([false,true])('suspended casting still pays spell taxes, which count as mana spent (pay=%s)',pay=>{
  const{g,c}=suspended();const body=put(g,1,'armament-dragon');body.def={...body.def,abilities:[{kind:'static',spellCostMore:{who:'all',filter:{},n:2}}]};put(g,1,'roiling-vortex');upkeep(g);g.players[0].pool=pay?['C','C']:[];
  settleAll(g,d=>d.type==='targets'?{type:'targets',targets:[{c:body.id}]}:undefined);expect(c.zone).toBe(pay?'graveyard':'exile');expect(body.damage).toBe(pay?3:0);expect(g.players[0].life).toBe(19);if(pay)expect(c.manaSpent).toBe(2);
 });
 it('Incinerator reductions apply after spell cost increases',()=>{
  const g=mk(),c=inHand(g,0,'chandras-incinerator'),tax=put(g,1,'mind-stone');tax.def={...tax.def,abilities:[{kind:'static',spellCostMore:{who:'all',filter:{},n:2}}]};dealDamage(g,null,0,{p:1},6);expect(spellCost(g,c,0).generic).toBe(1);
 });
 it('granting flash allows the suspend special action during an opponent turn',()=>{
  const g=mk(),c=inHand(g,0,'rift-bolt');c.def={...c.def,keywords:['flash']};g.active=1;g.players[0].pool=['R'];expect(castOptionsFor(g,0,c).some(o=>o.alt==='modernSuspend')).toBe(true);expect(cast(g,c,[],{alt:'modernSuspend'})).toBeNull();expect(c.zone).toBe('exile');expect(g.stack).toHaveLength(0);
 });
 it('Rift Bolt can also be cast normally for 2R',()=>{
  const g=mk(),c=inHand(g,0,'rift-bolt');g.players[0].pool=['R','C','C'];expect(cast(g,c,[{p:1}])).toBeNull();resolve(g);expect(g.players[1].life).toBe(17);
 });
 it('Cage blocks creature entry from graveyard and library but allows hand, exile and noncreature cards',()=>{
  const g=mk();put(g,0,'grafdiggers-cage');const gy=inGy(g,1,'brave-kin-duo'),lib=inHand(g,0,'brave-kin-duo');moveCard(g,lib,'library');enterBattlefield(g,gy,1);enterBattlefield(g,lib,0);expect(gy.zone).toBe('graveyard');expect(lib.zone).toBe('library');expect(g.players[0].library).toContain(lib.id);
  const artifact=inGy(g,0,'mind-stone');enterBattlefield(g,artifact,0);expect(artifact.zone).toBe('battlefield');const hand=inHand(g,0,'brave-kin-duo');enterBattlefield(g,hand,0);expect(hand.zone).toBe('battlefield');moveCard(g,gy,'exile');enterBattlefield(g,gy,1);expect(gy.zone).toBe('battlefield');
 });
 it('blocked face-down entry leaves the original library card unchanged',()=>{
  const g=mk();put(g,0,'grafdiggers-cage');const c=inHand(g,0,'opt');moveCard(g,c,'library');const def=c.def;putFaceDown(g,c,0,true);expect(c.zone).toBe('library');expect(c.def).toBe(def);expect(c.hidden).toBeUndefined();
 });
 it('Cage checks original graveyard card types, not an as-enters copy',()=>{
  const g=mk();put(g,0,'grafdiggers-cage');const creature=inGy(g,0,'brave-kin-duo'),artifact=inGy(g,0,'mind-stone');
  enterBattlefield(g,creature,0,false,getDef('mind-stone'));expect(creature.zone).toBe('graveyard');
  enterBattlefield(g,artifact,0,false,getDef('brave-kin-duo'));expect(artifact.zone).toBe('battlefield');expect(artifact.def.types).toContain('Creature');
 });
 it('Cage blocks all spells from graveyards and libraries, even resolution-time free casting',()=>{
  const g=mk(),cage=put(g,0,'grafdiggers-cage'),dart=inGy(g,0,'lava-dart'),mountain=put(g,0,'mountain'),opt=inHand(g,0,'opt');moveCard(g,opt,'library');expect(castAlts(g,0,dart)).toEqual([]);expect(cast(g,dart,[{p:1}],{alt:'flashback',sac:mountain.id})).not.toBeNull();expect(mountain.zone).toBe('battlefield');expect(castDuringResolution(g,0,opt.id,[],true)).not.toBeNull();expect(opt.zone).toBe('library');moveCard(g,cage,'graveyard');expect(cast(g,dart,[{p:1}],{alt:'flashback',sac:mountain.id})).toBeNull();resolve(g);expect(g.players[1].life).toBe(19);
 });
 it('Cage does not block suspended casting from exile, and losing Cage abilities restores entry',()=>{
  const{g,c}=suspended();const cage=put(g,0,'grafdiggers-cage');upkeep(g);settleAll(g,targetOpponent);expect(c.zone).toBe('graveyard');expect(g.players[1].life).toBe(17);const body=inGy(g,0,'brave-kin-duo');g.eot.push({card:cage.id,p:0,t:0,kw:[],loseAbilities:true});enterBattlefield(g,body,0);expect(body.zone).toBe('battlefield');
 });
 it.each([false,true])('Arena enters tapped unless a Mountain is already controlled (Mountain=%s)',mountain=>{
  const g=mk();if(mountain)put(g,0,'steam-vents');const c=inHand(g,0,'arena-of-glory');enterBattlefield(g,c,0);expect(c.tapped).toBe(!mountain);
 });
 it('Arena basic mana needs no exertion; exerting pays R, creates two qualified R, and tags only spent creature mana',()=>{
  const g=mk(),arena=put(g,0,'arena-of-glory');expect(activate(g,arena)).toBeNull();settleAll(g);expect(g.players[0].pool).toEqual(['R']);expect(arena.frontierMarks?.bdExertBy).toBeUndefined();arena.tapped=false;
  expect(activate(g,arena,1)).toBeNull();settleAll(g);expect(g.players[0].modernArenaMana).toBe(2);expect(arena.frontierMarks?.bdExertBy).toBe(1);dealDamage(g,null,0,{p:1},5);const creature=inHand(g,0,'chandras-incinerator');expect(cast(g,creature)).toBeNull();expect(stats(g,creature).kw.has('haste')).toBe(true);resolve(g);expect(stats(g,creature).kw.has('haste')).toBe(true);expect(g.players[0].modernArenaMana).toBe(1);
  const bolt=inHand(g,0,'lightning-bolt');expect(cast(g,bolt,[{p:1}])).toBeNull();resolve(g);expect(g.players[0].modernArenaMana).toBe(0);g.eot=[];expect(stats(g,creature).kw.has('haste')).toBe(false);
 });
 it('Arena prefers its qualified mana for a creature and does not grant haste after a blink',()=>{
  const g=mk(),arena=put(g,0,'arena-of-glory');g.players[0].pool=['R'];expect(activate(g,arena,1)).toBeNull();settleAll(g);g.players[0].pool=['R'];const c=inHand(g,0,'eidolon-of-the-great-revel');expect(cast(g,c)).toBeNull();expect(g.players[0].pool).toEqual(['R']);resolve(g);moveCard(g,c,'exile');enterBattlefield(g,c,0);expect(stats(g,c).kw.has('haste')).toBe(false);
 });
 it('exertion skips precisely the next own untap and qualified mana empties at step boundaries',()=>{
  const g=mk(),arena=put(g,0,'arena-of-glory');g.players[0].pool=['R'];expect(activate(g,arena,1)).toBeNull();settleAll(g);const gen=runGame(g,0);let r=gen.next(),seen=0,firstTurn=-1;
  for(let i=0;i<1000&&!r.done;i++){
   if(r.value.type==='priority'&&g.active===0&&g.phase==='upkeep'&&g.turn!==firstTurn){firstTurn=g.turn;seen++;expect(arena.tapped).toBe(seen===1);expect(g.players[0].modernArenaMana).toBe(0);if(seen===2)break;}
   let response:Response;
   switch(r.value.type){case'priority':response={type:'pass'};break;case'attackers':response={type:'attackers',ids:[]};break;case'blockers':response={type:'blockers',blocks:[]};break;case'mulligan':response={type:'keep',keep:true};break;default:response=answerDefault(g,r.value);}
   r=gen.next(response);
  }expect(seen).toBe(2);
 });
 it('Moon removes Arena ETB restrictions and its exert ability',()=>{
  const g=mk();put(g,0,'blood-moon');const c=inHand(g,0,'arena-of-glory');enterBattlefield(g,c,0);expect(c.tapped).toBe(false);expect(abilitiesFor(g,c)).toHaveLength(0);expect(c.def.produces).toEqual(['R']);
 });
 it('AI clones keep accumulated damage and suspended counters independent',()=>{
  const{g,c}=suspended();dealDamage(g,null,0,{p:1},2);const copy=cloneGame(g);copy.modernRed!.damage[1]=10;copy.cards[c.id].eclCounters!.time=2;copy.cards[c.id].modernSuspended!.version=99;expect(g.modernRed!.damage[1]).toBe(2);expect(c.eclCounters!.time).toBe(1);expect(c.modernSuspended!.version).not.toBe(99);
 });
 it('the complete original Mono-Red main deck finishes a representative AI match',()=>{
  const a=MODERN_AI_DECKS.find(d=>d.id==='modern-mono-red-burn')!,b=MODERN_AI_DECKS.find(d=>d.id==='modern-boros-burn')!;expect(a.colors).toEqual(['R']);const g=runHeadless({name:'A',deckName:a.name,deck:expandDeck(a),isAI:true},{name:'B',deckName:b.name,deck:expandDeck(b),isAI:true},['normal','normal'],1188,['aggro','aggro']);expect(g.winner).not.toBeNull();
 });
});
