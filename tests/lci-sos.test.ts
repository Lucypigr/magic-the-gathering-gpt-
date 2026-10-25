import {describe,it,expect} from 'vitest';
import {CARDS,slug} from '../src/data';
import lci from '../src/data/sets/lci-catalog.json';
import sos from '../src/data/sets/sos-catalog.json';
import {poolSize} from '../src/meta/booster';
import {abilitiesFor,castAlts,performAction} from '../src/engine/actions';
import {emit,moveCard,putIntoGraveyard,dealDamage,putCounters} from '../src/engine/zones';
import {runEffects} from '../src/engine/effects';
import {stats} from '../src/engine/state';
import {setCardLanguage,displayName} from '../src/data/names';
import {mk,put,inHand,inGy,lands,resolve,settleAll,answerDefault} from './helpers';
describe('LCI and SOS completion',()=>{
 it('contains all printed cards and faces with sourced Chinese names',()=>{
  expect(poolSize('LCI')).toBe(286);expect(poolSize('SOS')).toBe(266);setCardLanguage(true);
  for(const row of[...lci,...sos]){const c=CARDS.find(c=>c.id===slug(row.name));expect(c,row.name).toBeDefined();for(const k of['cost','power','toughness','types','subtypes','colors']as const)expect(c![k],row.name+' '+k).toEqual((row as any)[k]);expect(c!.text).toBe(row.text);expect(displayName(c!)).toMatch(/[\u3400-\u9fff]/);for(const key of['back','prepare','adventure']as const)if((row as any)[key]){expect(c![key]?.name).toBe((row as any)[key].name);expect(c![key]?.text).toBe((row as any)[key].text);}}
 });
 it('craft exiles the source and chosen materials as costs, then returns the back face',()=>{
  const g=mk(),c=put(g,0,'clay-fired-bricks'),artifact=put(g,0,'short-bow');lands(g,0,'plains',7);
  const ability=abilitiesFor(g,c).findIndex(a=>!!a.cost.craft);expect(ability).toBeGreaterThanOrEqual(0);
  expect(performAction(g,0,{type:'activate',card:c.id,ability,costCards:[artifact.id],targets:[]})).toBeNull();expect(c.zone).toBe('exile');expect(artifact.zone).toBe('exile');resolve(g);settleAll(g);
  expect(c.zone).toBe('battlefield');expect(c.def.name).toBe('Cosmium Kiln');expect(g.battlefield.filter(id=>g.cards[id].def.subtypes?.includes('Gnome'))).toHaveLength(2);
 });
 it('discover can cast a legal card for free while putting skipped cards on the bottom',()=>{
  const g=mk(),found=inHand(g,0,'colossadactyl'),spell=inHand(g,0,'daring-discovery');moveCard(g,found,'library');lands(g,0,'mountain',5);
  expect(performAction(g,0,{type:'cast',card:spell.id,targets:[null,null,null]})).toBeNull();resolve(g);expect(found.zone).toBe('stack');resolve(g);expect(found.zone).toBe('battlefield');
 });
 it('converge uses the colors actually spent and adds entry counters before ETB',()=>{
  const g=mk(),c=inHand(g,0,'rancorous-archaic');for(const land of['plains','island','swamp','mountain','forest'])lands(g,0,land,1);
  expect(performAction(g,0,{type:'cast',card:c.id,targets:[]})).toBeNull();resolve(g);expect(c.counters).toBe(5);expect(stats(g,c).p).toBe(7);
 });
 it('Opus uses mana spent rather than printed mana value',()=>{
  const g=mk(),muse=put(g,0,'muse-seeker'),spell=inHand(g,0,'homesickness');spell.manaSpent=2;const n=g.players[0].hand.length;
  emit(g,{type:'cast',card:spell.id,player:0,opponentTurn:false});settleAll(g);expect(g.players[0].hand).toHaveLength(n);
  spell.manaSpent=5;emit(g,{type:'cast',card:spell.id,player:0,opponentTurn:false});settleAll(g);expect(g.players[0].hand).toHaveLength(n+1);expect(muse.zone).toBe('battlefield');
 });
 it('Increment compares actual mana with either current power or toughness',()=>{
  const g=mk(),c=put(g,0,'ambitious-augmenter'),spell=inHand(g,0,'homesickness');spell.manaSpent=1;emit(g,{type:'cast',card:spell.id,player:0,opponentTurn:false});settleAll(g);expect(c.counters).toBe(0);
  spell.manaSpent=2;emit(g,{type:'cast',card:spell.id,player:0,opponentTurn:false});settleAll(g);expect(c.counters).toBe(1);
 });
 it('prepared spells are cast copies and unprepare the creature',()=>{
  const g=mk(),c=inHand(g,0,'elite-interceptor');lands(g,0,'plains',3);expect(performAction(g,0,{type:'cast',card:c.id,targets:[]})).toBeNull();resolve(g);expect(c.prepared).toBe(true);
  expect(performAction(g,0,{type:'cast',card:c.id,alt:'prepared',targets:[{c:c.id}]})).toBeNull();expect(c.prepared).toBe(false);expect(c.zone).toBe('battlefield');resolve(g);expect(c.zone).toBe('battlefield');
 });
 it('Deep-Cavern Bat returns the exiled hand card when it leaves',()=>{
  const g=mk(),card=inHand(g,1,'colossadactyl'),bat=inHand(g,0,'deep-cavern-bat');lands(g,0,'swamp',2);
  expect(performAction(g,0,{type:'cast',card:bat.id,targets:[]})).toBeNull();resolve(g);settleAll(g,d=>d.type==='choose'?{type:'choose',ids:[card.id]}:undefined);expect(card.zone).toBe('exile');moveCard(g,bat,'hand');expect(card.zone).toBe('hand');
 });
 it('paradigm is established only after resolution and offers a cast copy in the first main phase',()=>{
  const g=mk(),victim=inGy(g,0,'colossadactyl'),c=inHand(g,0,'restoration-seminar');lands(g,0,'plains',7);
  expect(performAction(g,0,{type:'cast',card:c.id,targets:[{c:victim.id}]})).toBeNull();resolve(g);expect(c.zone).toBe('exile');expect(victim.zone).toBe('battlefield');
  emit(g,{type:'step',step:'main1',player:0});expect(g.pending.some(p=>p.ability.effects.some(e=>e.e==='frontier'&&e.action==='sos:paradigmCopy'))).toBe(true);
 });
 it('Group Project flashback taps three creatures instead of paying mana',()=>{
  const g=mk(),c=inGy(g,0,'group-project');for(let i=0;i<3;i++)put(g,0,'brave-kin-duo');expect(castAlts(g,0,c)).toContain('flashback');
  expect(performAction(g,0,{type:'cast',card:c.id,alt:'flashback',targets:[]})).toBeNull();expect(g.battlefield.filter(id=>g.cards[id].tapped)).toHaveLength(3);resolve(g);expect(c.zone).toBe('exile');
 });
 it('an Ojer returns tapped and transformed after dying',()=>{
  const g=mk(),c=put(g,0,'ojer-pakpatiq-deepest-epoch');putIntoGraveyard(g,[c]);settleAll(g);expect(c.zone).toBe('battlefield');expect(c.def.name).toBe('Temple of Cyclical Time');expect(c.tapped).toBe(true);expect(c.eclCounters?.time).toBe(3);
 });
 it('Ojer Taq triples creature token creation without tripling artifact-only tokens',()=>{
  const g=mk();put(g,0,'ojer-taq-deepest-foundation');const c=inHand(g,0,'antiquities-on-the-loose');lands(g,0,'plains',3);
  expect(performAction(g,0,{type:'cast',card:c.id,targets:[]})).toBeNull();resolve(g);expect(g.battlefield.filter(id=>g.cards[id].def.id==='tok-cp-spirit22')).toHaveLength(6);
 });
 it('exploring a land emits the land event and Nicanzil can put a land from hand into play',()=>{
  const g=mk(),ally=put(g,0,'brave-kin-duo');put(g,0,'nicanzil-current-conductor');const forest=inHand(g,0,'forest');
  const gen=runEffects(g,{source:ally.id,controller:0,targets:[]},[{e:'explore',what:'self'}]);let r=gen.next();while(!r.done)r=gen.next(answerDefault(g,r.value));
  expect(g.pending.some(p=>p.ability.effects.some(e=>e.e==='frontier'&&e.action==='lci:mayPutLand'))).toBe(true);
  settleAll(g,d=>d.type==='choose'&&d.prompt.includes('地進場')?{type:'choose',ids:[forest.id]}:undefined);expect(forest.zone).toBe('battlefield');expect(forest.tapped).toBe(true);
 });
 it('Skullspore Nexus groups simultaneous deaths and totals their last known power',()=>{
  const g=mk();put(g,0,'the-skullspore-nexus');const a=put(g,0,'brave-kin-duo'),b=put(g,0,'topiary-panther'),sum=stats(g,a).p+stats(g,b).p;
  putIntoGraveyard(g,[a,b]);expect(g.pending.filter(p=>p.ev.type==='frontier'&&p.ev.action==='cpNexus')).toHaveLength(1);settleAll(g);
  const token=g.battlefield.map(id=>g.cards[id]).find(c=>c.token&&c.def.name==='Fungus Dinosaur');expect(token?.def.power).toBe(sum);expect(token?.def.toughness).toBe(sum);
 });
 it('Bloodletter doubles life lost during its controller’s turn while retaining the damage amount',()=>{
  const g=mk(),source=put(g,0,'brave-kin-duo');put(g,0,'bloodletter-of-aclazotz');expect(dealDamage(g,source,0,{p:1},3)).toBe(3);expect(g.players[1].life).toBe(14);
 });
 it('casualty sacrifices a creature as an additional cost and creates a cast-copy trigger',()=>{
  const g=mk();put(g,0,'silverquill-the-disputant');const weak=put(g,0,'brave-kin-duo'),ally=put(g,0,'brave-kin-duo'),c=inHand(g,0,'oracles-restoration');lands(g,0,'forest',1);
  expect(castAlts(g,0,c)).toContain('campusCasualty');expect(performAction(g,0,{type:'cast',card:c.id,alt:'campusCasualty',foundationCosts:[weak.id],targets:[{c:ally.id}]})).toBeNull();
  expect(weak.zone).toBe('graveyard');expect(g.pending.some(p=>p.ability.effects.some(e=>e.e==='copySpell'))).toBe(true);settleAll(g);expect(g.players[0].life).toBe(22);
 });
 it('Fix What’s Broken pays the chosen X in life and revives only matching mana values',()=>{
  const g=mk(),bat=inGy(g,0,'deep-cavern-bat'),other=inGy(g,0,'brave-kin-duo'),c=inHand(g,0,'fix-whats-broken');lands(g,0,'plains',1);lands(g,0,'swamp',1);lands(g,0,'forest',2);
  expect(performAction(g,0,{type:'cast',card:c.id,x:2,targets:[]})).toBeNull();expect(g.players[0].life).toBe(18);resolve(g);expect(bat.zone).toBe('battlefield');expect(other.zone).toBe('graveyard');
 });
 it('Market Gnome triggers when exiled to pay a craft cost',()=>{
  const g=mk(),c=put(g,0,'clay-fired-bricks'),gnome=put(g,0,'market-gnome');lands(g,0,'plains',7);const ability=abilitiesFor(g,c).findIndex(a=>!!a.cost.craft);
  expect(performAction(g,0,{type:'activate',card:c.id,ability,costCards:[gnome.id],targets:[]})).toBeNull();expect(gnome.zone).toBe('exile');expect(g.pending.some(p=>p.source===gnome.id)).toBe(true);settleAll(g);expect(g.players[0].life).toBe(21);
 });
 it('Emeritus of Truce creates the Inkling for the targeted player',()=>{
  const g=mk();put(g,1,'brave-kin-duo');put(g,1,'brave-kin-duo');const c=inHand(g,0,'emeritus-of-truce');lands(g,0,'plains',3);
  expect(performAction(g,0,{type:'cast',card:c.id,targets:[]})).toBeNull();resolve(g);settleAll(g,d=>d.type==='targets'?{type:'targets',targets:[{p:1}]}:undefined);
  expect(g.battlefield.some(id=>g.cards[id].def.id==='tok-cp-inkling'&&g.cards[id].controller===1)).toBe(true);expect(c.prepared).toBe(true);
 });

 it('conditional keywords are not intrinsic and require the actual descend threshold',()=>{
  const g=mk(),echo=put(g,0,'didact-echo'),akawalli=put(g,0,'akawalli-the-seething-tower');expect(stats(g,echo).kw.has('flying')).toBe(false);expect(stats(g,akawalli).kw.has('trample')).toBe(false);
  for(let i=0;i<4;i++)inGy(g,0,'forest');expect(stats(g,echo).kw.has('flying')).toBe(true);expect(stats(g,akawalli).kw.has('trample')).toBe(true);
 });
 it('Divergent Equation returns at most X graveyard spells and exiles itself',()=>{
  const g=mk(),opt=inGy(g,0,'opt'),c=inHand(g,0,'divergent-equation');lands(g,0,'island',3);
  expect(performAction(g,0,{type:'cast',card:c.id,x:1,mode:1,targets:[{c:opt.id}]})).toBeNull();resolve(g);expect(opt.zone).toBe('hand');expect(c.zone).toBe('exile');
 });

 it('crafted Raptor reads the exiled Dinosaur card’s power rather than battlefield counters',()=>{
  const g=mk(),lattice=put(g,0,'saheelis-lattice'),dino=put(g,0,'colossadactyl');putCounters(g,dino,3);lands(g,0,'mountain',5);
  const ability=abilitiesFor(g,lattice).findIndex(a=>!!a.cost.craft);expect(performAction(g,0,{type:'activate',card:lattice.id,ability,costCards:[dino.id],targets:[]})).toBeNull();resolve(g);
  expect(lattice.def.name).toBe('Mastercraft Raptor');expect(stats(g,lattice).p).toBe(4);moveCard(g,dino,'hand');expect(stats(g,lattice).p).toBe(0);
 });

});
