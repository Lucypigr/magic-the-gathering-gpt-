import {describe,it,expect} from 'vitest';
import {poolSize} from '../src/meta/booster';
import {abilitiesFor,canActivate,performAction,spellCost,castAlts} from '../src/engine/actions';
import {isCreature,stats,copiableDefinition,cloneGame} from '../src/engine/state';
import {drawCards,emit,enterBattlefield,moveCard,putCounters,putIntoGraveyard} from '../src/engine/zones';
import {checkSBA} from '../src/engine/flow';
import {mk,put,inGy,inHand,lands,resolve,settleAll} from './helpers';
const activate=(g:ReturnType<typeof mk>,id:number,predicate:(a:ReturnType<typeof abilitiesFor>[number])=>boolean,extra:Record<string,any>={})=>{const ability=abilitiesFor(g,g.cards[id]).findIndex(predicate);expect(ability).toBeGreaterThanOrEqual(0);expect(performAction(g,0,{type:'activate',card:id,ability,targets:[],...extra})).toBeNull();};
describe('complete BLB and DFT mechanics',()=>{
 it('contains every unique nonbasic printing',()=>{expect(poolSize('BLB')).toBe(274);expect(poolSize('DFT')).toBe(271);});
 it('delivers a promised gift before a spell bonus and triggers Jolly Gerbils separately',()=>{
  const g=mk(),gerbils=put(g,0,'jolly-gerbils'),ally=put(g,0,'brave-kin-duo'),c=inHand(g,0,'crumb-and-get-it');lands(g,0,'plains',1);
  const n=g.players[0].hand.length;expect(performAction(g,0,{type:'cast',card:c.id,mode:1,targets:[{c:ally.id}]})).toBeNull();resolve(g);
  expect(stats(g,ally).p).toBe(3);expect(stats(g,ally).kw.has('indestructible')).toBe(true);
  expect(g.battlefield.some(id=>g.cards[id].controller===1&&g.cards[id].def.id==='tok-food')).toBe(true);
  expect(g.pending.filter(t=>t.source===gerbils.id)).toHaveLength(1);settleAll(g);expect(g.players[0].hand).toHaveLength(n);
 });
 it('promising a permanent gift enables its conditional ETB',()=>{
  const g=mk(),artifact=put(g,1,'short-bow'),c=inHand(g,0,'scrapshooter');lands(g,0,'forest',3);const n=g.players[1].hand.length;
  expect(castAlts(g,0,c)).toContain('gift');expect(performAction(g,0,{type:'cast',card:c.id,alt:'gift',targets:[]})).toBeNull();resolve(g);settleAll(g);
  expect(g.players[1].hand).toHaveLength(n+1);expect(artifact.zone).toBe('graveyard');
 });
 it('repeats Season modes within five paw prints and keeps copies when bouncing nontokens',()=>{
  const g=mk(),c=inHand(g,0,'season-of-the-burrow');lands(g,0,'plains',5);
  const mode=c.def.spell!.modes!.findIndex(m=>m.effects.length===5&&m.effects.every(e=>e.e==='token'));
  expect(performAction(g,0,{type:'cast',card:c.id,mode,targets:[]})).toBeNull();resolve(g);
  expect(g.battlefield.filter(id=>g.cards[id].token&&g.cards[id].def.subtypes?.includes('Rabbit'))).toHaveLength(5);
  const artifact=put(g,0,'short-bow'),weave=inHand(g,0,'season-of-weaving');lands(g,0,'island',6);
  const wm=weave.def.spell!.modes!.findIndex(m=>m.effects.length===2&&m.effects[0].e==='frontier'&&m.effects[1].e==='bounce');
  expect(performAction(g,0,{type:'cast',card:weave.id,mode:wm,targets:[]})).toBeNull();resolve(g,d=>d.type==='choose'&&d.prompt.includes('複製')?{type:'choose',ids:[artifact.id]}:undefined);
  expect(artifact.zone).toBe('hand');expect(g.battlefield.some(id=>g.cards[id].token&&g.cards[id].def.id==='short-bow')).toBe(true);
 });
 it('forages as an activation cost and Camellia produces a Squirrel before the main ability',()=>{
  const g=mk(),c=put(g,0,'camellia-the-seedmiser'),squirrel=put(g,0,'tok-bd-squirrel'),food=put(g,0,'tok-food');lands(g,0,'forest',2);
  activate(g,c.id,a=>!!a.bdForage,{costCards:[food.id]});expect(food.zone).not.toBe('battlefield');expect(squirrel.counters).toBe(0);settleAll(g);
  expect(c.counters).toBe(0);expect(squirrel.counters).toBe(1);
  expect(g.battlefield.filter(id=>g.cards[id].def.id==='tok-bd-squirrel'&&g.cards[id].counters===1)).toHaveLength(2);
 });
 it('Feed the Cycle can pay forage in place of its additional black mana',()=>{
  const g=mk(),food=put(g,0,'tok-food'),victim=put(g,1,'topiary-panther'),c=inHand(g,0,'feed-the-cycle');lands(g,0,'swamp',1);lands(g,0,'forest',1);
  expect(spellCost(g,c,0,undefined,[{c:victim.id}],undefined).B).toBe(2);
  expect(performAction(g,0,{type:'cast',card:c.id,alt:'forage',foundationCosts:[food.id],targets:[{c:victim.id}]})).toBeNull();
  expect(food.zone).not.toBe('battlefield');expect(victim.zone).toBe('battlefield');resolve(g);expect(victim.zone).toBe('graveyard');
 });
 it('expend triggers only when crossing the mana-spent threshold',()=>{
  const g=mk(),mentor=put(g,0,'wandertale-mentor');lands(g,0,'swamp',6);
  for(let i=0;i<3;i++){const victim=put(g,1,'topiary-panther'),c=inHand(g,0,'fell');expect(performAction(g,0,{type:'cast',card:c.id,targets:[{c:victim.id}]})).toBeNull();resolve(g);settleAll(g);expect(mentor.counters).toBe(i===0?0:1);}
 });
 it('Innkeeper doubles entry and effect counters but does not double loyalty costs',()=>{
  const g=mk(),inn=put(g,0,'innkeepers-talent');inn.classLevel=3;
  const walker=put(g,0,'chandra-spark-hunter');expect(walker.loyalty).toBe(walker.def.loyalty!*2);
  const n=walker.loyalty!;activate(g,walker.id,a=>a.cost.loyalty===2);expect(walker.loyalty).toBe(n+2);resolve(g);
  const opponent=put(g,1,'brave-kin-duo');putCounters(g,opponent,2,undefined,0);expect(opponent.counters).toBe(4);
  const x=inHand(g,0,'marketback-walker');lands(g,0,'forest',8);
  expect(performAction(g,0,{type:'cast',card:x.id,x:4,targets:[]})).toBeNull();resolve(g);expect(x.counters).toBe(8);
 });
 it('a delayed blink returns the same exiled object with a flying counter',()=>{
  const g=mk(),ally=put(g,0,'brave-kin-duo'),swan=inHand(g,0,'salvation-swan');lands(g,0,'plains',4);
  expect(performAction(g,0,{type:'cast',card:swan.id,targets:[]})).toBeNull();resolve(g);settleAll(g);expect(ally.zone).toBe('exile');
  emit(g,{type:'step',step:'endStep',player:0});settleAll(g);expect(ally.zone).toBe('battlefield');expect(ally.eclCounters?.flying).toBe(1);
 });
 it('Pilots crew using extra power without receiving a power bonus',()=>{
  const g=mk(),pilot=put(g,0,'tok-bd-pilot'),v=put(g,0,'detention-chariot');expect(stats(g,pilot).p).toBe(1);
  activate(g,v.id,a=>a.cost.crew===3,{costCards:[pilot.id]});expect(pilot.tapped).toBe(true);resolve(g);expect(isCreature(v)).toBe(true);expect(stats(g,v).p).toBe(6);
 });
 it('exhaust activation triggers still resolve when the original ability is countered',()=>{
  const g=mk(),r=put(g,0,'rangers-refueler'),expert=inGy(g,0,'afterburner-expert'),c=put(g,0,'keen-buccaneer');lands(g,0,'island',2);const n=g.players[0].hand.length;
  activate(g,c.id,a=>!!a.bdExhaust);g.stack.pop();expect(g.pending.some(t=>t.source===r.id)).toBe(true);settleAll(g);
  expect(expert.zone).toBe('battlefield');expect(c.counters).toBe(0);expect(g.players[0].hand).toHaveLength(n+1);
 });
 it('Elvish Refueler permits one spent exhaust ability again on each own turn',()=>{
  const g=mk();put(g,0,'elvish-refueler');const c=put(g,0,'keen-buccaneer');lands(g,0,'island',6);
  const i=abilitiesFor(g,c).findIndex(a=>a.bdExhaust);activate(g,c.id,a=>!!a.bdExhaust);resolve(g);expect(canActivate(g,0,c,i)).toBe(false);
  g.turn+=2;expect(canActivate(g,0,c,i)).toBe(true);activate(g,c.id,a=>!!a.bdExhaust);resolve(g);expect(canActivate(g,0,c,i)).toBe(false);
 });
 it('variable cycling pays X and queues a separate Pilot trigger',()=>{
  const g=mk(),c=inHand(g,0,'valors-flagship');lands(g,0,'plains',5);
  expect(performAction(g,0,{type:'cast',card:c.id,alt:'cycle',x:2,targets:[]})).toBeNull();expect(c.zone).toBe('graveyard');expect(g.players[0].spellsThisTurn).toBe(0);settleAll(g);
  expect(g.battlefield.filter(id=>g.cards[id].def.id==='tok-bd-pilot')).toHaveLength(2);
 });
 it('Pit Automaton copies an activated exhaust ability even after that ability is countered',()=>{
  const g=mk(),pit=put(g,0,'pit-automaton'),c=put(g,0,'keen-buccaneer');lands(g,0,'island',4);
  activate(g,pit.id,a=>a.effects.some(e=>e.e==='frontier'&&e.action==='dft:pitCopy'));resolve(g);
  activate(g,c.id,a=>!!a.bdExhaust);g.stack.pop();settleAll(g);expect(c.counters).toBe(1);
 });
 it('continuous base-stat effects use their timestamps and copying excludes Food type changes',()=>{
  const g=mk();put(g,1,'maha-its-feathers-night');put(g,0,'march-of-the-world-ooze');const c=put(g,0,'brave-kin-duo');expect(stats(g,c).t).toBe(6);
  const ygra=put(g,0,'ygra-eater-of-all');checkSBA(g);expect(c.def.types).toContain('Artifact');expect(c.def.subtypes).toContain('Food');expect(copiableDefinition(c).types).not.toContain('Artifact');
  moveCard(g,ygra,'exile');checkSBA(g);expect(c.def.subtypes).not.toContain('Food');
 });
 it('a granted Class trigger resolves after that Class leaves',()=>{
  const g=mk(),ally=put(g,0,'brave-kin-duo'),c=put(g,0,'builders-talent');c.classLevel=2;
  const artifact=inHand(g,0,'short-bow');enterBattlefield(g,artifact,0);expect(g.pending.some(t=>t.source===c.id)).toBe(true);
  moveCard(g,c,'hand');settleAll(g);expect(ally.counters).toBe(1);
 });
 it('a death trigger uses the power of the dead object after reanimation',()=>{
  const g=mk(),c=put(g,0,'heartfire-hero');putCounters(g,c,2);putIntoGraveyard(g,[c]);enterBattlefield(g,c,0);
  expect(c.counters).toBe(0);settleAll(g);expect(g.players[1].life).toBe(17);
 });
 it('Mimeoplasm exiles X creatures, copies only its linked cards and retains counters',()=>{
  const g=mk(),a=inGy(g,0,'brave-kin-duo'),b=inGy(g,0,'topiary-panther'),c=inHand(g,0,'mimeoplasm-revered-one');lands(g,0,'swamp',1);lands(g,0,'island',1);lands(g,0,'forest',3);
  expect(performAction(g,0,{type:'cast',card:c.id,x:2,targets:[]})).toBeNull();resolve(g);
  settleAll(g,d=>d.type==='choose'&&d.prompt.includes('X張')?{type:'choose',ids:[a.id,b.id]}:undefined);
  expect(c.counters).toBe(6);expect(a.zone).toBe('exile');expect(b.zone).toBe('exile');lands(g,0,'forest',2);
  activate(g,c.id,x=>x.effects.some(e=>e.e==='frontier'&&e.action==='dft:214'),{targets:[{c:a.id}]});resolve(g);
  expect(c.def.name).toBe('Brave-Kin Duo');expect(stats(g,c).p).toBe(6);expect(abilitiesFor(g,c).some(x=>x.effects.some(e=>e.e==='frontier'&&e.action==='dft:214'))).toBe(true);
 });
 it('Innkeeper tracks multiple finality counters for Sab-Sunen parity',()=>{
  const g=mk(),inn=put(g,0,'innkeepers-talent');inn.classLevel=3;const c=inHand(g,0,'sab-sunen-luxa-embodied');(c.finMarks??={}).enterFinality=1;enterBattlefield(g,c,0);
  expect(c.finalityCount).toBe(2);expect(stats(g,c).cantAttack).toBe(false);
 });
 it('Vnwxt replaces each draw at maximum speed and simulations isolate per-turn bookkeeping',()=>{
  const g=mk();put(g,0,'vnwxt-verbose-host');g.players[0].speed=4;const n=g.players[0].hand.length;drawCards(g,0,1);expect(g.players[0].hand).toHaveLength(n+2);
  const simulated=cloneGame(g);simulated.players[0].frontierFlags!.test=1;expect(g.players[0].frontierFlags!.test).toBeUndefined();
 });
 it('Oviya grants trample only to creatures attacking her opponent and animated Equipment falls off',()=>{
  const g=mk();put(g,0,'oviya-automech-artisan');const ally=put(g,0,'brave-kin-duo'),enemy=put(g,1,'brave-kin-duo');
  ally.attacking=true;enemy.attacking=true;expect(stats(g,ally).kw.has('trample')).toBe(true);expect(stats(g,enemy).kw.has('trample')).toBe(false);
  ally.attackTarget=put(g,1,'chandra-spark-hunter').id;expect(stats(g,ally).kw.has('trample')).toBe(false);
  const blade=put(g,0,'rover-blades');blade.attachedTo=ally.id;blade.def={...blade.def,types:[...blade.def.types,'Creature']};checkSBA(g);expect(blade.attachedTo).toBeNull();
 });
 it('Waxen Shapethief makes a fresh choice when copying Patchwork Banner',()=>{
  const g=mk(),banner=put(g,0,'patchwork-banner');const c=inHand(g,0,'waxen-shapethief');lands(g,0,'island',4);
  expect(performAction(g,0,{type:'cast',card:c.id,targets:[]})).toBeNull();resolve(g);settleAll(g,d=>d.type==='choose'&&d.prompt.includes('複製')?{type:'choose',ids:[banner.id]}:undefined);
  expect(c.def.name).toBe('Patchwork Banner');expect(c.eclType).toBeTruthy();moveCard(g,c,'graveyard');expect(c.def.name).toBe('Waxen Shapethief');
 });

 it('sacrificed Vehicle information survives until Hellish Sideswipe resolves',()=>{
  const g=mk(),vehicle=put(g,0,'rover-blades'),target=put(g,1,'topiary-panther'),c=inHand(g,0,'hellish-sideswipe');lands(g,0,'swamp',3);
  expect(performAction(g,0,{type:'cast',card:c.id,sac:vehicle.id,targets:[{c:target.id}]})).toBeNull();
  const n=g.players[0].hand.length;expect(vehicle.zone).toBe('graveyard');resolve(g);expect(target.zone).toBe('graveyard');expect(g.players[0].hand).toHaveLength(n+1);
 });
 it('Wick snapshots each sacrificed Snail power independently on the stack',()=>{
  const g=mk(),wick=put(g,0,'wick-the-whorled-mind'),a=put(g,0,'tok-bd-snail'),b=put(g,0,'tok-bd-snail');putCounters(g,b,2);lands(g,0,'island',2);lands(g,0,'swamp',2);lands(g,0,'mountain',2);
  activate(g,wick.id,x=>x.effects.some(e=>e.e==='frontier'&&e.action==='blb:wickSac'),{sac:a.id});
  activate(g,wick.id,x=>x.effects.some(e=>e.e==='frontier'&&e.action==='blb:wickSac'),{sac:b.id});resolve(g);expect(g.players[1].life).toBe(17);resolve(g);expect(g.players[1].life).toBe(16);
 });

 it('Vren Rat tokens gain both power and toughness for other Rats',()=>{
  const g=mk(),a=put(g,0,'tok-bd-rat'),b=put(g,0,'tok-bd-rat'),otherRat=put(g,0,'burglar-rat');
  expect(stats(g,a).p).toBe(3);expect(stats(g,a).t).toBe(3);expect(stats(g,b).t).toBe(3);expect(stats(g,otherRat).t).toBe(1);
 });

});
