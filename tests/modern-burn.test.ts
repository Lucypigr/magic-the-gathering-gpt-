import { describe, it, expect } from 'vitest';
import { slug, MODERN_AI_DECKS, expandDeck } from '../src/data';
import catalog from '../src/data/sets/modern-burn-catalog.json';
import { getDef } from '../src/engine/registry';
import { zhName, sourcedChineseName, publishedChineseName } from '../src/data/names';
import { traditionalRulesText } from '../src/data/localization';
import { castAlts, performAction, abilitiesFor } from '../src/engine/actions';
import { cloneGame, stats } from '../src/engine/state';
import { manaValue } from '../src/engine/mana';
import { dealDamage, destroyCards, gainLife, loseLife, emit, enterBattlefield, moveCard } from '../src/engine/zones';
import { burnCleanup } from '../src/engine/modern-burn';
import { runHeadless } from '../src/engine/controller';
import { targetRelationPossible } from '../src/engine/targets';
import { mk, put, inHand, inGy, resolve, settleAll, type Answer } from './helpers';
import type { TargetRef } from '../src/engine/types';
const cast = (g: ReturnType<typeof mk>, c: ReturnType<typeof inHand>, targets: TargetRef[] = [], extra = {}) => performAction(g, c.owner, { type: 'cast', card: c.id, targets, ...extra });
const activate = (g: ReturnType<typeof mk>, c: ReturnType<typeof put>, index=0, targets:TargetRef[]=[]) => performAction(g,c.controller,{type:'activate',card:c.id,ability:index,targets});
const chooseSource = (id:number): Answer => d=> d.type==='choose'&&d.prompt.includes('防止傷害的來源')?{type:'choose',ids:[id]}:undefined;

describe('Boros Burn source fidelity and card interactions',()=>{
  it.each(catalog)('$name matches preserved Oracle characteristics and has traceable Chinese',row=>{
    const d=getDef(slug(row.name));
    for(const k of ['cost','types','subtypes','supertypes','colors','text'] as const)expect(d[k],k).toEqual(row[k]);
    if('power'in row){expect(d.power).toBe(row.power);expect(d.toughness).toBe(row.toughness);}
    expect(zhName(d)).toMatch(/\p{Script=Han}/u);expect(sourcedChineseName(d)??publishedChineseName(d)).toBeDefined();expect(traditionalRulesText(d.text)).toMatch(/\p{Script=Han}/u);
  });
  it.each([true,false])('Guide reveals the defending top card; moves only lands into hand (land=%s)',land=>{
    const g=mk(),c=put(g,0,'goblin-guide'),top=inHand(g,1,land?'island':'opt');moveCard(g,top,'library');const hand=g.players[1].hand.length,draws=g.players[1].drawsThisTurn;
    expect(stats(g,c).kw.has('haste')).toBe(true);emit(g,{type:'attacks',card:c.id});settleAll(g);
    expect(top.zone).toBe(land?'hand':'library');expect(g.players[1].hand.length).toBe(hand+Number(land));expect(g.players[1].drawsThisTurn).toBe(draws);expect(g.log.some(l=>l.text.includes('展示'))).toBe(true);
  });
  it('Lava Spike hits a player or planeswalker but rejects creatures',()=>{
    const g=mk(),body=put(g,1,'brave-kin-duo'),spell=inHand(g,0,'lava-spike');g.players[0].pool=['R'];expect(cast(g,spell,[{c:body.id}])).not.toBeNull();expect(cast(g,spell,[{p:1}])).toBeNull();resolve(g);expect(g.players[1].life).toBe(17);
  });
  it('Spectacle requires opponent life loss, costs R and retains mana value three',()=>{
    const g=mk(),c=inHand(g,0,'skewer-the-critics');g.players[0].pool=['R'];loseLife(g,0,1);expect(castAlts(g,0,c)).not.toContain('modernSpectacle');expect(cast(g,c,[{p:1}])).not.toBeNull();
    loseLife(g,1,1);expect(castAlts(g,0,c)).toContain('modernSpectacle');expect(cast(g,c,[{p:1}],{alt:'modernSpectacle'})).toBeNull();expect(manaValue(c.castFace!)).toBe(3);resolve(g);expect(g.players[1].life).toBe(16);
  });
  it('Spectacle does not make a sorcery instant speed and normal casting costs 2R',()=>{
    const g=mk(),c=inHand(g,0,'skewer-the-critics');loseLife(g,1,1);g.active=1;g.players[0].pool=['R'];expect(cast(g,c,[{p:1}],{alt:'modernSpectacle'})).not.toBeNull();
    g.active=0;g.players[0].pool=['R','C','C'];expect(cast(g,c,[{p:1}])).toBeNull();resolve(g);expect(g.players[1].life).toBe(16);
  });
  it('Blaze has two related required targets; rejects an unrelated creature before payment',()=>{
    const g=mk(),ours=put(g,0,'brave-kin-duo'),theirs=put(g,1,'armament-dragon'),c=inHand(g,0,'searing-blaze');g.players[0].pool=['R','R'];
    expect(cast(g,c,[{p:1},{c:ours.id}])).not.toBeNull();expect(g.players[0].pool).toEqual(['R','R']);expect(cast(g,c,[{p:1}])).not.toBeNull();
    expect(cast(g,c,[{p:1},{c:theirs.id}])).toBeNull();resolve(g);expect(g.players[1].life).toBe(19);expect(theirs.damage).toBe(1);
  });
  it('landfall records a land that entered and left this turn and deals three to both targets',()=>{
    const g=mk(),target=put(g,1,'armament-dragon'),land=put(g,0,'mountain');moveCard(g,land,'graveyard');const c=inHand(g,0,'searing-blaze');g.players[0].pool=['R','R'];
    expect(cast(g,c,[{p:1},{c:target.id}])).toBeNull();resolve(g);expect(g.players[1].life).toBe(17);expect(target.damage).toBe(3);
  });
  it('Blaze damages a remaining legal target when the creature leaves, and does not follow it through a blink',()=>{
    const g=mk(),target=put(g,1,'armament-dragon'),c=inHand(g,0,'searing-blaze');g.players[0].pool=['R','R'];expect(cast(g,c,[{p:1},{c:target.id}])).toBeNull();moveCard(g,target,'exile');enterBattlefield(g,target,1);g.pending=[];resolve(g);
    expect(g.players[1].life).toBe(19);expect(target.damage).toBe(0);
  });
  it('Blaze rechecks related controllers independently on resolution',()=>{
    const g=mk(),target=put(g,1,'armament-dragon'),c=inHand(g,0,'searing-blaze');g.players[0].pool=['R','R'];expect(cast(g,c,[{p:1},{c:target.id}])).toBeNull();target.controller=0;resolve(g);expect(g.players[1].life).toBe(19);expect(target.damage).toBe(0);
  });
  it('Blaze can damage a creature even if the player gained hexproof',()=>{
    const g=mk(),target=put(g,1,'armament-dragon'),c=inHand(g,0,'searing-blaze');g.players[0].pool=['R','R'];expect(cast(g,c,[{p:1},{c:target.id}])).toBeNull();g.players[1].frontierFlags={bdHexproof:1};resolve(g);expect(g.players[1].life).toBe(20);expect(target.damage).toBe(1);
  });
  it('Blaze supports planeswalkers and the UI rejects a first target without a related legal creature',()=>{
    const g=mk(),body=put(g,1,'armament-dragon'),walker=put(g,1,'kaito-cunning-infiltrator'),c=inHand(g,0,'searing-blaze');g.players[0].pool=['R','R'];
    const specs=c.def.spell!.targets!;expect(targetRelationPossible(g,specs,0,{p:0},[],0,c.id)).toBe(false);const loyalty=walker.loyalty;
    expect(cast(g,c,[{c:walker.id},{c:body.id}])).toBeNull();resolve(g);expect(walker.loyalty).toBe(loyalty!-1);expect(body.damage).toBe(1);
  });
  it('Searing Blood triggers after lethal damage but puts the three damage on the stack separately',()=>{
    const g=mk(),body=put(g,1,'brave-kin-duo'),c=inHand(g,0,'searing-blood');g.players[0].pool=['R','R'];expect(cast(g,c,[{c:body.id}])).toBeNull();resolve(g);expect(g.players[1].life).toBe(20);settleAll(g);expect(body.zone).toBe('graveyard');expect(g.players[1].life).toBe(17);
  });
  it('Searing Blood tracks the creature for the rest of the turn and damages its controller when it dies',()=>{
    const g=mk(),body=put(g,1,'armament-dragon'),c=inHand(g,0,'searing-blood');g.players[0].pool=['R','R'];expect(cast(g,c,[{c:body.id}])).toBeNull();settleAll(g);expect(g.players[1].life).toBe(20);body.controller=0;destroyCards(g,[body]);settleAll(g);expect(g.players[0].life).toBe(17);expect(g.players[1].life).toBe(20);
  });
  it.each(['exile','blink','cleanup'])('Searing Blood does not trigger on %s',kind=>{
    const g=mk(),body=put(g,1,'armament-dragon'),c=inHand(g,0,'searing-blood');g.players[0].pool=['R','R'];expect(cast(g,c,[{c:body.id}])).toBeNull();settleAll(g);
    if(kind==='exile')moveCard(g,body,'exile');else if(kind==='blink'){moveCard(g,body,'exile');enterBattlefield(g,body,1);g.pending=[];destroyCards(g,[body]);}else{burnCleanup(g);destroyCards(g,[body]);}settleAll(g);expect(g.players[1].life).toBe(20);
  });
  it('Smash still deals three if the artifact is indestructible, and uses its controller before destruction',()=>{
    for(const indestructible of [true,false]){const g=mk(),artifact=put(g,1,'mind-stone'),c=inHand(g,0,'smash-to-smithereens');if(indestructible)artifact.permanentGrants=[{kw:['indestructible']}];g.players[0].pool=['R','C'];expect(cast(g,c,[{c:artifact.id}])).toBeNull();resolve(g);expect(g.players[1].life).toBe(17);expect(artifact.zone).toBe(indestructible?'battlefield':'graveyard');}
  });
  it('Skullcrack stops both players gaining life and prevents no damage, including its own three',()=>{
    const g=mk(),c=inHand(g,0,'skullcrack');g.players[1].eclPreventDamageUntil=1;g.players[0].pool=['R','C'];expect(cast(g,c,[{p:1}])).toBeNull();resolve(g);expect(g.players[1].life).toBe(17);gainLife(g,0,4);gainLife(g,1,4);expect(g.players[0].life).toBe(20);expect(g.players[1].life).toBe(17);
    burnCleanup(g);gainLife(g,0,4);gainLife(g,1,4);expect(g.players[0].life).toBe(24);expect(g.players[1].life).toBe(21);
  });
  it('unpreventable damage removes a shield counter and is still dealt',()=>{
    const g=mk(),body=put(g,1,'armament-dragon'),crack=inHand(g,0,'skullcrack');body.counters=5;body.eclCounters={shield:1};g.players[0].pool=['R','C'];expect(cast(g,crack,[{p:1}])).toBeNull();resolve(g);const bolt=inHand(g,0,'lightning-bolt');g.players[0].pool=['R'];expect(cast(g,bolt,[{c:body.id}])).toBeNull();resolve(g);expect(body.damage).toBe(3);expect(body.eclCounters.shield).toBe(0);
  });
  it('Palm chooses a source on resolution without targeting and reflects only its next damage event',()=>{
    const g=mk(),body=put(g,1,'armament-dragon'),palm=inHand(g,0,'deflecting-palm');body.hexproofCounters=1;g.players[0].pool=['R','W'];expect(cast(g,palm)).toBeNull();resolve(g,chooseSource(body.id));expect(dealDamage(g,body,1,{p:0},4,{combat:true})).toBe(0);expect(g.players[0].life).toBe(20);expect(g.players[1].life).toBe(16);
    dealDamage(g,body,1,{p:0},4,{combat:true});expect(g.players[0].life).toBe(16);
  });
  it('Palm reflects a spell source and does not target the recipient of reflected damage',()=>{
    const g=mk(),bolt=inHand(g,1,'lightning-bolt');g.players[1].pool=['R'];expect(cast(g,bolt,[{p:0}])).toBeNull();const palm=inHand(g,0,'deflecting-palm');g.players[0].pool=['R','W'];expect(cast(g,palm)).toBeNull();resolve(g,chooseSource(bolt.id));g.players[1].frontierFlags={bdHexproof:1};resolve(g);expect(g.players[0].life).toBe(20);expect(g.players[1].life).toBe(17);
  });
  it('Palm can choose Searing Blood while its delayed death trigger is waiting',()=>{
    const g=mk(),body=put(g,0,'armament-dragon'),blood=inHand(g,1,'searing-blood');g.players[1].pool=['R','R'];expect(cast(g,blood,[{c:body.id}])).toBeNull();settleAll(g);
    const palm=inHand(g,0,'deflecting-palm');g.players[0].pool=['R','W'];expect(cast(g,palm)).toBeNull();let offered=false;
    resolve(g,d=>{if(d.type==='choose'&&d.prompt.includes('防止傷害的來源')){offered=d.options.includes(blood.id);return{type:'choose',ids:[blood.id]};}});expect(offered).toBe(true);
    destroyCards(g,[body]);settleAll(g);expect(g.players[0].life).toBe(20);expect(g.players[1].life).toBe(17);
  });
  it('Skullcrack makes Palm unable to prevent or reflect damage',()=>{
    const g=mk(),body=put(g,1,'armament-dragon'),palm=inHand(g,0,'deflecting-palm');g.players[0].pool=['R','W'];expect(cast(g,palm)).toBeNull();resolve(g,chooseSource(body.id));const crack=inHand(g,1,'skullcrack');g.players[1].pool=['R','C'];expect(cast(g,crack,[{p:0}])).toBeNull();resolve(g);dealDamage(g,body,1,{p:0},4);expect(g.players[0].life).toBe(13);expect(g.players[1].life).toBe(20);
  });
  it('Palm does not follow a blinked source and expires at cleanup',()=>{
    for(const blink of [true,false]){const g=mk(),body=put(g,1,'armament-dragon'),palm=inHand(g,0,'deflecting-palm');g.players[0].pool=['R','W'];expect(cast(g,palm)).toBeNull();resolve(g,chooseSource(body.id));if(blink){moveCard(g,body,'exile');enterBattlefield(g,body,1);}else burnCleanup(g);dealDamage(g,body,1,{p:0},4);expect(g.players[0].life).toBe(16);expect(g.players[1].life).toBe(20);}
  });
  it('Eidolon triggers for either player, including a spectacle spell at printed mana value three',()=>{
    const g=mk();put(g,0,'eidolon-of-the-great-revel');const bolt=inHand(g,1,'lightning-bolt');g.players[1].pool=['R'];expect(cast(g,bolt,[{p:0}])).toBeNull();settleAll(g);expect(g.players[0].life).toBe(17);expect(g.players[1].life).toBe(18);
    const skewer=inHand(g,0,'skewer-the-critics');g.players[0].pool=['R'];expect(cast(g,skewer,[{p:1}],{alt:'modernSpectacle'})).toBeNull();settleAll(g);expect(g.players[0].life).toBe(15);expect(g.players[1].life).toBe(15);
  });
  it('Eidolon counts X chosen on the stack, not just printed symbols',()=>{
    for(const x of [0,3]){const g=mk();put(g,0,'eidolon-of-the-great-revel');const c=inHand(g,1,'meltdown');g.players[1].pool=['R','C','C','C'];expect(cast(g,c,[],{x,ignoreTiming:true})).toBeNull();settleAll(g);expect(g.players[1].life).toBe(x===0?18:20);}
  });
  it('Vortex triggers every upkeep and only no-mana casts; its ability stops only opponents gaining life',()=>{
    const g=mk(),v=put(g,0,'roiling-vortex');emit(g,{type:'step',step:'upkeep',player:1});settleAll(g);emit(g,{type:'step',step:'upkeep',player:0});settleAll(g);expect(g.players[0].life).toBe(19);expect(g.players[1].life).toBe(19);
    const bauble=inHand(g,1,'mishras-bauble');expect(cast(g,bauble,[],{ignoreTiming:true})).toBeNull();settleAll(g);expect(g.players[1].life).toBe(14);
    g.players[0].pool=['R'];expect(activate(g,v)).toBeNull();resolve(g);gainLife(g,0,3);gainLife(g,1,3);expect(g.players[0].life).toBe(22);expect(g.players[1].life).toBe(14);burnCleanup(g);gainLife(g,1,3);expect(g.players[1].life).toBe(17);
  });
  it('Vortex treats paid Phyrexian life as no mana spent but does not trigger for paid red mana',()=>{
    const g=mk();put(g,0,'roiling-vortex');const target=inGy(g,0,'opt'),c=inHand(g,0,'surgical-extraction');expect(cast(g,c,[{c:target.id}],{alt:'modernLife'})).toBeNull();settleAll(g);expect(g.players[0].life).toBe(13);
    const bolt=inHand(g,0,'lightning-bolt');g.players[0].pool=['R'];expect(cast(g,bolt,[{p:1}])).toBeNull();settleAll(g);expect(g.players[0].life).toBe(13);expect(g.players[1].life).toBe(17);
  });
  it('Barbarian Ring threshold is checked before paying sacrifice, and its damage activation needs R',()=>{
    const g=mk(),ring=put(g,0,'barbarian-ring');for(let i=0;i<6;i++)inGy(g,0,'opt');g.players[0].pool=['R'];expect(activate(g,ring,1,[{p:1}])).not.toBeNull();inGy(g,0,'opt');expect(activate(g,ring,1,[{p:1}])).toBeNull();resolve(g);expect(ring.zone).toBe('graveyard');expect(g.players[1].life).toBe(18);
  });
  it('Ring mana causes preventable damage; Canyon mana pays life that cannot be prevented',()=>{
    for(const id of ['barbarian-ring','sunbaked-canyon']){const g=mk(),land=put(g,0,id);g.players[0].eclPreventDamageUntil=0;const bolt=inHand(g,0,'lightning-bolt');expect(cast(g,bolt,[{p:1}])).toBeNull();resolve(g);expect(land.tapped).toBe(true);expect(g.players[0].life).toBe(id==='barbarian-ring'?20:19);}
  });
  it('manual Ring mana and automatic mana have the same damage; Moon removes that damage ability',()=>{
    const g=mk(),ring=put(g,0,'barbarian-ring');expect(activate(g,ring)).toBeNull();settleAll(g);expect(g.players[0].life).toBe(19);expect(g.players[0].pool).toContain('R');ring.tapped=false;g.players[0].pool=[];put(g,0,'blood-moon');expect(abilitiesFor(g,ring)).toHaveLength(0);const c=inHand(g,0,'lightning-bolt');expect(cast(g,c,[{p:1}])).toBeNull();expect(g.players[0].life).toBe(19);
  });
  it('Canyon has R/W mana and a separate one-mana, tap, sacrifice draw ability',()=>{
    const g=mk(),land=put(g,0,'sunbaked-canyon');expect(activate(g,land,1)).toBeNull();settleAll(g);expect(g.players[0].pool).toContain('W');expect(g.players[0].life).toBe(19);land.tapped=false;const n=g.players[0].hand.length;expect(activate(g,land,2)).toBeNull();resolve(g);expect(land.zone).toBe('graveyard');expect(g.players[0].hand.length).toBe(n+1);
  });
  it('automatic payment rejects life costs that exceed the remaining life',()=>{
    const g=mk(),a=put(g,0,'sunbaked-canyon'),b=put(g,0,'sunbaked-canyon'),c=inHand(g,0,'skullcrack');g.players[0].life=1;
    expect(cast(g,c,[{p:1}])).not.toBeNull();expect(g.players[0].life).toBe(1);expect(a.tapped||b.tapped).toBe(false);expect(c.zone).toBe('hand');
  });
  it('a replacement for paying life applies to Canyon automatic mana payment',()=>{
    const g=mk();put(g,0,'ashiok-wicked-manipulator');put(g,0,'sunbaked-canyon');const c=inHand(g,0,'lightning-bolt'),top=g.players[0].library[0];
    expect(cast(g,c,[{p:1}])).toBeNull();expect(g.players[0].life).toBe(20);expect(g.cards[top].zone).toBe('exile');
  });
  it('separate Canyon life costs can use a replacement and then remaining life',()=>{
    const g=mk();put(g,0,'ashiok-wicked-manipulator');put(g,0,'sunbaked-canyon');put(g,0,'sunbaked-canyon');
    for(const id of g.players[0].library.slice(1))moveCard(g,g.cards[id],'exile');g.pending=[];g.players[0].life=2;const c=inHand(g,0,'skullcrack');
    expect(cast(g,c,[{p:1}])).toBeNull();expect(g.players[0].life).toBe(1);expect(g.players[0].library).toHaveLength(0);
  });
  it('AI simulations keep the new delayed effects and landfall state independent',()=>{
    const g=mk(),body=put(g,1,'armament-dragon');put(g,0,'mountain');const c=inHand(g,0,'searing-blood');g.players[0].pool=['R','R'];expect(cast(g,c,[{c:body.id}])).toBeNull();resolve(g);const clone=cloneGame(g);burnCleanup(clone);clone.modernBurn!.landTurns[0]=-3;expect(g.modernBurn!.blood).toHaveLength(1);expect(g.modernBurn!.landTurns[0]).toBe(g.turn);
  });
  it('the complete original Burn main deck finishes a representative AI game',()=>{
    const a=MODERN_AI_DECKS.find(d=>d.id==='modern-boros-burn')!,b=MODERN_AI_DECKS.find(d=>d.id==='modern-izzet-murktide')!;
    expect(a.colors).toEqual(['W','R']);const g=runHeadless({name:'A',deckName:a.name,deck:expandDeck(a),isAI:true},{name:'B',deckName:b.name,deck:expandDeck(b),isAI:true},['normal','normal'],1123,['aggro','tempo']);expect(g.winner).not.toBeNull();
  });
});
