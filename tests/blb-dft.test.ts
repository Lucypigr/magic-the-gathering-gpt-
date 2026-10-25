import { describe, it, expect } from 'vitest';
import { CARDS, slug } from '../src/data';
import blb from '../src/data/sets/blb-catalog.json';
import dft from '../src/data/sets/dft-catalog.json';
import rules from '../scripts/localization/blb-dft-rules.json';
import { VERIFIED_BLB_DFT } from '../src/data/sets/blb-dft-verified';
import { mk, put, inHand, inGy, lands, resolve, settleAll } from './helpers';
import { performAction, abilitiesFor, canActivate } from '../src/engine/actions';
import { enterBattlefield, moveCard, emit, loseLife } from '../src/engine/zones';
import { abilitiesOf, stats, isCreature } from '../src/engine/state';
import { displayName, setCardLanguage } from '../src/data/names';
import { legalTargets } from '../src/engine/targets';
describe('BLB/DFT verified batch',()=>{
 it('matches every implemented printed row and supplies sourced Chinese names and rules',()=>{
  setCardLanguage(true);
  for(const [code,rows] of [['BLB',blb],['DFT',dft]] as const)for(const row of rows){
   if(!VERIFIED_BLB_DFT[code].includes(row.number))continue;
   const c=CARDS.find(c=>c.id===slug(row.name))!;
   expect(c,row.name).toBeDefined();
   for(const k of ['cost','power','toughness','types','subtypes','colors'] as const)expect(c[k],`${row.name}: ${k}`).toEqual(row[k as keyof typeof row]);
   const selfText=(text:string)=>text.replaceAll(row.name,'SELF').replace(/this (?:creature|enchantment|artifact|Vehicle|permanent|Aura|spell|land)/gi,'SELF');
   expect(selfText(c.text),row.name).toBe(selfText(row.text));
   expect(displayName(c),row.name).toMatch(/[\u3400-\u9fff]/);
   if(row.text){const entry=(rules as Record<string,{text:string;oracleText:string}>)[row.name];expect(entry,row.name).toBeDefined();expect(entry.oracleText).toBe(row.text);expect(entry.text).toMatch(/[\u3400-\u9fff]/);}
  }
 });
 it('offspring uses a separate ETB trigger and its copy still triggers its printed ETB',()=>{
  const g=mk(),c=inHand(g,0,'intrepid-rabbit');lands(g,0,'plains',4);
  expect(performAction(g,0,{type:'cast',card:c.id,targets:[],alt:'offspring'})).toBeNull();resolve(g);
  expect(g.battlefield.filter(id=>g.cards[id].token)).toHaveLength(0);
  expect(g.pending.some(t=>t.source===c.id&&t.ability.effects.some(e=>e.e==='copyCreature'))).toBe(true);
  settleAll(g);
  const copy=g.battlefield.map(id=>g.cards[id]).find(c=>c.token&&c.def.id==='intrepid-rabbit')!;
  expect(copy.def.power).toBe(1);expect(copy.def.toughness).toBe(1);
  expect(stats(g,c).p).toBe(5); // original ETB and copy ETB each give +1/+1
  moveCard(g,c,'exile');enterBattlefield(g,c,0);settleAll(g);
  expect(g.battlefield.filter(id=>g.cards[id].token&&g.cards[id].def.id==='intrepid-rabbit')).toHaveLength(1);
 });
 it('countering the offspring trigger prevents the copy',()=>{
  const g=mk(),c=inHand(g,0,'coruscation-mage');lands(g,0,'mountain',4);
  expect(performAction(g,0,{type:'cast',card:c.id,targets:[],alt:'offspring'})).toBeNull();resolve(g);
  const i=g.pending.findIndex(t=>t.ability.effects.some(e=>e.e==='copyCreature'));expect(i).toBeGreaterThanOrEqual(0);
  g.pending.splice(i,1);settleAll(g);expect(g.battlefield.some(id=>g.cards[id].token)).toBe(false);
 });
 it('Bria grants an additional prowess instance to a creature that already has prowess',()=>{
  const g=mk();put(g,0,'bria-riptide-rogue');const ally=put(g,0,'lightshell-duo'),spell=inHand(g,0,'playful-shove');
  emit(g,{type:'cast',card:spell.id,player:0,opponentTurn:false});
  expect(g.pending.filter(t=>t.source===ally.id&&t.abilityIndex===-1)).toHaveLength(2);
 });
 it('speed increases once per own turn and max speed gates Risen Necroregent',()=>{
  const g=mk(),c=put(g,0,'risen-necroregent');expect(g.players[0].speed).toBe(1);
  loseLife(g,1,1);loseLife(g,1,1);expect(g.players[0].speed).toBe(2);
  emit(g,{type:'step',step:'endStep',player:0});expect(g.pending.some(t=>t.source===c.id)).toBe(false);
  g.turn+=2;loseLife(g,1,1);g.turn+=2;loseLife(g,1,1);expect(g.players[0].speed).toBe(4);
  emit(g,{type:'step',step:'endStep',player:0});settleAll(g);
  expect(g.battlefield.some(id=>g.cards[id].token&&g.cards[id].def.subtypes?.includes('Zombie'))).toBe(true);
 });
 it('exhaust is spent on activation, stays spent across turns, and resets on reentry',()=>{
  const g=mk(),c=put(g,0,'keen-buccaneer');lands(g,0,'island',8);
  const i=abilitiesFor(g,c).findIndex(a=>a.oncePerGame);
  expect(performAction(g,0,{type:'activate',card:c.id,ability:i,targets:[]})).toBeNull();
  expect(canActivate(g,0,c,i)).toBe(false);resolve(g);
  expect(c.counters).toBe(1);g.turn+=2;expect(canActivate(g,0,c,i)).toBe(false);
  moveCard(g,c,'exile');enterBattlefield(g,c,0);expect(canActivate(g,0,c,i)).toBe(true);
 });
 it('Mindspring Merfolk pays X and puts exactly one counter on each Merfolk',()=>{
  const g=mk(),c=put(g,0,'mindspring-merfolk');lands(g,0,'island',4);
  const i=abilitiesFor(g,c).findIndex(a=>a.oncePerGame),n=g.players[0].hand.length;
  expect(performAction(g,0,{type:'activate',card:c.id,ability:i,targets:[],x:2})).toBeNull();resolve(g);
  expect(g.players[0].hand).toHaveLength(n+2);expect(c.counters).toBe(1);expect(c.tapped).toBe(true);
  expect(canActivate(g,0,c,i)).toBe(false);
 });
 it('Salvation Engine buffs only artifact creatures, and a crewed vehicle gains the bonus',()=>{
  const g=mk();put(g,0,'salvation-engine');const ox=put(g,0,'brightfield-mustang'),v=put(g,0,'air-response-unit');
  expect(stats(g,ox).p).toBe(3);expect(isCreature(v)).toBe(false);
  const i=abilitiesFor(g,v).findIndex(a=>a.cost.crew);
  expect(performAction(g,0,{type:'activate',card:v.id,ability:i,targets:[],costCards:[ox.id]})).toBeNull();resolve(g);
  expect(isCreature(v)).toBe(true);expect(stats(g,v).p).toBe(5);
 });
 it('Repel Calamity allows either power or toughness at least four',()=>{
  const g=mk(),spell=inHand(g,0,'repel-calamity'),a=put(g,1,'brightfield-mustang'),b=put(g,1,'guidelight-synergist');
  const targets=legalTargets(g,spell.def.spell!.targets![0],0,spell.id);
  expect(targets).not.toContainEqual({c:a.id});expect(targets).toContainEqual({c:b.id});
 });
 it('a max-speed Surveyor exiles itself as a cost and draws without casting a spell',()=>{
  const g=mk(),c=inGy(g,0,'leonin-surveyor');g.players[0].speed=4;lands(g,0,'plains',3);
  const i=abilitiesFor(g,c).findIndex(a=>a.fromGraveyard),n=g.players[0].hand.length;
  expect(performAction(g,0,{type:'activate',card:c.id,ability:i,targets:[]})).toBeNull();expect(c.zone).toBe('exile');resolve(g);
  expect(g.players[0].hand).toHaveLength(n+1);expect(g.players[0].spellsThisTurn).toBe(0);
 });
 it('Flood the Engine can target an uncrewed Vehicle and removes its abilities',()=>{
  const g=mk(),v=put(g,1,'air-response-unit'),a=inHand(g,0,'flood-the-engine');lands(g,0,'island',3);
  expect(performAction(g,0,{type:'cast',card:a.id,targets:[{c:v.id}]})).toBeNull();resolve(g);settleAll(g);
  expect(v.tapped).toBe(true);expect(abilitiesOf(g,v)).toHaveLength(0);expect(stats(g,v).noUntap).toBe(true);
 });
});
