import{drawWithReplacements as mh3Draw}from'./draw-replacements';
import{validateTargets,isLegalTarget}from'./targets';
import{payCost,canPayCost,frontierCanPayLife,frontierPayLife}from'./actions';
import{parseCost}from'./mana';
import{putFaceDown}from'./facedown';
import{freeCast}from'./tla';
import{counterKinds,removeCounterKind}from'./ecl-support';
import {abilitiesOf,abilitiesSuppressed,checkCond,copiableDefinition,isCreature,isLand,randInt,matches,other,shuffleArr,stats} from './state';
import{colorsOf,manaValue}from'./mana';
import{dealDamage,discardMany,emit,enterBattlefield,gainLife,loseLife,putCounters,moveCard,sacrifice,destroyCards}from'./zones';
import{runEffects,resolveRef,type Ctx}from'./effects';
import{choose}from'./tla';
import{meadowCounter,meadowMode,meadowYes}from'./meadow';
import{makeEclTokenBatch}from'./ecl';
import{webModified}from'./web-shire-support';
import type{Card,Effect,GameEvent,GameState,PID,SubFlow,TriggeredAbility}from'./types';
const prefix='modern:mh3:';
const own=(g:GameState,p:PID,f:import('./types').Filter={})=>g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===p&&matches(g,f,c,p));
/** Inspect possible sources before evaluating continuous ability suppression. */
export function mh3HasStatic(g:GameState,c:Card,key:string){const match=(a:import('./types').Ability)=>a.kind==='static'&&a.frontier===prefix+key;return ((c.def.abilities??[]).some(match)||(c.copiedAbilities??[]).some(match)||(c.temporaryAbilities?.turn===g.turn&&c.temporaryAbilities.abilities.some(match)))&&abilitiesOf(g,c).some(match);}
export const mh3Static=(g:GameState,p:PID,key:string)=>g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===p&&mh3HasStatic(g,c,key));
export function mh3GainEnergy(g:GameState,p:PID,n:number){if(n<=0)return;n+=mh3Static(g,p,'energyPlus').length;g.players[p].energy=(g.players[p].energy??0)+n;emit(g,{type:'frontier',action:prefix+'energy',player:p,card:-1,amount:n});g.version++;}
export function mh3PayEnergy(g:GameState,p:PID,n:number){const pl=g.players[p];if(n<0||(pl.energy??0)<n)return false;pl.energy=(pl.energy??0)-n;if(pl.mh3EnergyTurn!==g.turn)pl.mh3EnergyTurn=g.turn,pl.mh3EnergySpent=0;pl.mh3EnergySpent=(pl.mh3EnergySpent??0)+n;g.version++;return true;}
export function mh3Amount(g:GameState,p:PID,id:number,key:string,e?:GameEvent){const c=g.cards[id];switch(key.slice(prefix.length)){case'lifeGained':return g.players[p].lifeGainedThisTurn;case'counters':return c.counters;case'countersAll':return own(g,p).reduce((n,c)=>n+Object.values(counterKinds(c)).reduce((n,v)=>n+v,0),0);case'negativeX':return -(c.castX??0);case'lastPower':return e?.type==='dies'?e.power:stats(g,c).p;case'twiceCreatures':return 2*own(g,p,{type:'Creature'}).length;default:throw Error('Unknown MH3 amount '+key);}}
export function mh3Condition(g:GameState,p:PID,id:number,key:string){const c=g.cards[id];switch(key.slice(prefix.length)){case'spent4':return g.players[p].mh3EnergyTurn===g.turn&&(g.players[p].mh3EnergySpent??0)>=4;case'modified':return webModified(g,c);case'opponentMulticolor':return own(g,other(p)).some(c=>colorsOf(c.def).length>1);case'kicked':return !!c.kicked;case'kickerGreen':return !!((c.frontierMarks?.mh3Kicker??0)&1);case'kickerBlue':return !!((c.frontierMarks?.mh3Kicker??0)&2);case'graveCast':return c.castOrigin==='graveyard';case'colorlessPaid':return !!c.manaPaid?.includes('C');case'noColorlessPaid':return !c.manaPaid?.includes('C');default:throw Error('Unknown MH3 condition '+key);}}
export function mh3Trigger(g:GameState,c:Card,a:TriggeredAbility,e:GameEvent){const p=c.controller,ec='card'in e?g.cards[e.card]:undefined;switch(a.frontierEvent?.slice(prefix.length)){
 case'enchantedMain2':return e.type==='step'&&e.step==='main2'&&c.attachedToPlayer===e.player;case'anyCast':return e.type==='cast';case'castSelf':return e.type==='cast'&&e.card===c.id;
 case'secondSpell':return e.type==='cast'&&g.players[e.player].spellsThisTurn===2;
 case'thirdDraw':return e.type==='draw'&&e.player===p&&g.players[p].drawsThisTurn===3;
 case'colorlessCast':return e.type==='cast'&&e.player===p&&colorsOf(ec!.castFace??ec!.def).length===0;
 case'bigColorlessCast':return e.type==='cast'&&e.player===p&&colorsOf(ec!.castFace??ec!.def).length===0&&manaValue(ec!.castFace??ec!.def)+(ec!.castX??0)>=7;
 case'bigPowerCast':return e.type==='cast'&&e.player===p&&isCreature(ec!)&&stats(g,ec!).p>=5;
 case'anyNoncreatureCast':return e.type==='cast'&&!isCreature(ec!);
 case'castNotHand':return e.type==='cast'&&e.player===p&&ec!.castOrigin!=='hand';
 case'auraModifiedCast':return e.type==='cast'&&e.player===p&&!!ec!.castFace?.subtypes?.includes('Aura')&&!!g.stack.find(s=>s.cardId===e.card&&s.kind==='spell')?.targets.some(t=>t&&'c'in t&&g.cards[t.c].controller===p&&webModified(g,g.cards[t.c]));
 case'magecraft':return e.type==='cast'&&e.player===p&&(ec!.castFace??ec!.def).types.some(t=>t==='Instant'||t==='Sorcery')||e.type==='frontier'&&e.action===prefix+'spellCopied'&&e.player===p&&!!ec?.def.types.some(t=>t==='Instant'||t==='Sorcery');
 case'energyGain':return e.type==='frontier'&&e.action===prefix+'energy'&&e.player===p;
 case'attackTwo':return e.type==='youAttack'&&e.attackers.length>=2;
 case'permanentSelfDies':return e.type==='permanentDies'&&e.card===c.id;
 case'modifiedDeath':case'modifiedOtherDeath':return e.type==='dies'&&e.controller===p&&ec?.id!==c.id&&webModified(g,ec!);
 case'modifiedAttacks':return e.type==='attacks'&&ec?.controller===p&&webModified(g,ec!);
 case'nontokenLeaves':return e.type==='leaves'&&e.controller===p&&e.card!==c.id&&!ec?.token;
 case'graveCreatureEtb':return e.type==='etb'&&e.controller===p&&!!ec&&isCreature(ec)&&(ec.mh3EntryFrom==='graveyard'||ec.castOrigin==='graveyard'&&ec.enteredTurn===g.turn);
 case'libraryGraveExile':{if(!(e.type==='fin'&&e.action==='zoneMove'&&e.player===p&&e.to==='exile'&&(e.from==='library'||e.from==='graveyard')))return false;const batch=g.meadowZoneBatch??g.nextSid++;if(c.frontierMarks?.mh3ExileBatch===batch)return false;(c.frontierMarks??={}).mh3ExileBatch=batch;return true;}
 default:return false;
}}
export function mh3Stats(g:GameState,c:Card,st:import('./state').Stats){
 if(abilitiesOf(g,c).some(a=>a.kind==='static'&&a.frontier===prefix+'wight')){const n=g.players[c.controller].graveyard.filter(id=>isCreature(g.cards[id])).length;st.p+=n;st.t+=n;}
 if(c.def.id==='nyxborn-hydra'&&c.mh3BestowBase)st.kw.delete('reach'),st.kw.delete('trample');
 for(const id of g.battlefield){const a=g.cards[id];if(a.attachedTo!==c.id||abilitiesSuppressed(g,a))continue;if(a.def.id==='dog-umbra'&&c.controller!==a.controller)st.cantAttack=true,st.cantBlock=true;
 if(a.def.id==='glyph-elemental'||a.def.id==='nyxborn-hydra')st.p+=a.counters,st.t+=a.counters;
 if(a.def.id==='cranial-ram')st.p+=own(g,a.controller,{type:'Artifact'}).length;
 if(abilitiesOf(g,a).some(b=>b.kind==='static'&&b.frontier===prefix+'harvestAura')){const n=own(g,a.controller,{type:['Creature','Enchantment']}).length;st.p+=n;st.t+=n;}}
 for(const kw of ['vigilance','lifelink','first_strike','trample','haste','hexproof','indestructible']as const)if((c.eclCounters?.[kw]??0)>0)st.kw.add(kw);
 if((c.eclCounters?.flying??0)>0)st.kw.add('flying');if((c.eclCounters?.reach??0)>0)st.kw.add('reach');if((c.eclCounters?.deathtouch??0)>0)st.kw.add('deathtouch');
}
export function mh3Link(src:Card,c:Card){(src.meadowLinked??=[]).push(c.id);(src.frontierMarks??={})['mh3Link:'+c.id]=c.objectVersion??0;}
export function mh3Linked(g:GameState,src:Card){return(src.meadowLinked??[]).map(id=>g.cards[id]).filter(c=>c.zone==='exile'&&(c.objectVersion??0)===src.frontierMarks?.['mh3Link:'+c.id]);}
export function mh3Schedule(g:GameState,ctx:Ctx,kind:string,c:Card){(g.mh3Delayed??=[]).push({source:ctx.source,controller:ctx.controller,kind,card:c.id,version:c.objectVersion??0,sourceVersion:g.cards[ctx.source]?.objectVersion??0});}
export function mh3BaseStats(g:GameState,c:Card,st:import('./state').Stats){if(c.def.id==='nethergoyf'){const n=new Set(g.players[c.controller].graveyard.flatMap(id=>g.cards[id].def.types)).size;st.p=n;st.t=n+1;}if(g.battlefield.some(id=>id!==c.id&&mh3HasStatic(g,g.cards[id],'kudo'))&&isCreature(c))st.p=2,st.t=2;}
export function mh3Protected(g:GameState,c:Card,source:Card,ability=false){return abilitiesOf(g,c).some(a=>a.kind==='static'&&a.frontier===prefix+'emrakulProtection')&&(!ability&&source.zone==='stack'||source.zone!=='stack'&&source.mh3CastTurn===g.turn);}
export function* mh3BeforeEntry(g:GameState,c:Card,p:PID):SubFlow<import('./types').CardDef|undefined>{
 if(c.def.ecl?.asEnters==='mh3Shape'){const i=yield*meadowMode(p,'選擇進場身材',['3/3飛行','2/5警戒','0/12守軍']);return{...c.def,ecl:undefined,power:[3,2,0][i],toughness:[3,5,12][i],keywords:[(['flying','vigilance','defender']as const)[i]??'flying']};}
 const kind=String(c.def.meadow?.mh3Copy),ids=g.battlefield.filter(id=>kind==='estrid'?g.cards[id].controller===p&&g.cards[id].def.types.includes('Enchantment'):isCreature(g.cards[id]));
 const[id]=yield*choose(g,p,'可以選擇要複製的永久物',ids,0,1);if(id===undefined)return;
 const def=copiableDefinition(g.cards[id]);
 if(kind==='mirror'){c.mh3TemporaryBase=c.def;c.mh3CopyTurn=g.turn;return{...def,ecl:undefined,keywords:[...(def.keywords??[]),'haste']};}
 const ability:TriggeredAbility=kind==='estrid'?{kind:'trigger',on:'upkeep',effects:[{e:'frontier',action:prefix+'estridBlink'}]}:{kind:'trigger',on:'attacks',effects:[{e:'connive',what:'self'}]};
 return{...def,ecl:undefined,abilities:[...(def.abilities??[]),ability]};
}
export function mh3Cleanup(g:GameState){for(const c of Object.values(g.cards))if(c.mh3TemporaryBase&&c.mh3CopyTurn===g.turn){c.def=c.mh3TemporaryBase;c.mh3TemporaryBase=undefined;c.mh3CopyTurn=undefined;}}
export function* mh3TriggerAbility(g:GameState,c:Card,a:TriggeredAbility):SubFlow<TriggeredAbility>{
 if(c.def.id==='depth-defiler'&&a.frontierEvent===prefix+'castSelf')return{...a,effects:[],chooseN:c.kicked?2:1,modes:[{text:'生物回手',targets:[{kind:'creature'}],effects:[{e:'bounce',what:'T0'}]},{text:'玩家抓二棄一',targets:[{kind:'player'}],effects:[{e:'draw',who:'T0',n:2},{e:'discard',who:'T0',n:1}]}]};
 if(c.def.id==='genku-future-shaper'&&a.frontierEvent===prefix+'nontokenLeaves'){const m=c.frontierMarks??={};if(m.mh3GenkuTurn!==g.turn||m.mh3GenkuVersion!==(c.objectVersion??0))m.mh3GenkuTurn=g.turn,m.mh3GenkuVersion=c.objectVersion??0,m.mh3GenkuMask=0;const choices=[0,1,2].filter(i=>!((m.mh3GenkuMask??0)&2**i));if(!choices.length)return{...a,modes:[],effects:[]};const i=choices[yield*meadowMode(c.controller,'選擇本回合尚未選過的衍生物',choices.map(i=>['2/2狐狸警戒','1/2月人飛行','1/1老鼠繫命'][i]))]??choices[0];m.mh3GenkuMask=(m.mh3GenkuMask??0)|2**i;return{...a,effects:[{e:'token',token:['tok-mh3-fox','tok-mh3-moonfolk','tok-mh3-rat'][i]}]};}
 if(a.frontierEvent===prefix+'mentor'){const n=c.zone==='battlefield'?stats(g,c).p:c.lastPower??0;return{...a,targets:[{kind:'creature',filter:{ctrl:'you',attacking:true,powMax:n-1},notSelf:true}]};}return a;
}

export function mh3Entry(g:GameState,c:Card,from:string){
 c.mh3EntryFrom=from as import('./types').Zone;
 if(from!=='stack')c.mh3CastTurn=undefined;
 if(c.def.meadow?.mh3UlamogEntry)c.counters+=Math.max(0,...g.players.flatMap(p=>p.exile).filter(id=>!g.cards[id].frontierMarks?.mh3Hidden).map(id=>manaValue(g.cards[id].def)));
 if(c.def.meadow?.mh3EntryX)c.counters+=c.castX??0;
 if(c.def.meadow?.mh3Voidpouncer&&c.kicked){c.counters+=2;(c.eclCounters??={}).trample=1;g.eot.push({card:c.id,p:0,t:0,kw:['haste']});}
 if(c.def.meadow?.mh3RalEntry)c.loyalty=(c.loyalty??0)+(g.players[c.controller].instSorcThisTurn??0);
}
export function mh3Umbra(g:GameState,c:Card){const aura=g.battlefield.map(id=>g.cards[id]).find(a=>a.attachedTo===c.id&&!abilitiesSuppressed(g,a)&&(a.def.id==='lion-umbra'||a.def.id==='dog-umbra'&&a.controller===c.controller));if(!aura)return false;c.damage=0;c.dtDamage=false;moveCard(g,aura,'graveyard');return true;}
export function* mh3Opening(g:GameState):SubFlow{for(const pl of g.players)for(const id of pl.hand){const c=g.cards[id];if(c.def.id==='devourer-of-destiny'&&(yield*meadowYes(pl.id,'從起手牌展示命運吞噬者，於第一次維持檢視四張？')))(c.frontierMarks??={}).mh3Opening=1;}}
const refreshGuard=new WeakSet<GameState>();
export function mh3Refresh(g:GameState){if(refreshGuard.has(g))return;refreshGuard.add(g);try{for(const id of g.battlefield){const c=g.cards[id],base=c.mh3TypeBase??c.def;if(base.id!=='idol-of-false-gods')continue;const active=c.counters>=8&&!abilitiesSuppressed(g,c);if(active){c.mh3TypeBase??=base;c.def={...base,types:[...base.types,'Creature'],power:0,toughness:0};}else if(c.mh3TypeBase){c.def=c.mh3TypeBase;c.mh3TypeBase=undefined;}}}finally{refreshGuard.delete(g);}}
export function mh3DamageBonus(g:GameState,p:PID,target:import('./types').TargetRef,combat:boolean){return !combat&&g.players[p].permanentLeftThisTurn&&('p'in target?target.p!==p:g.cards[target.c]?.controller!==p)?2*mh3Static(g,p,'revoltDamage').length:0;}
export function mh3AbilityCost(g:GameState,c:Card,ab:import('./types').ActivatedAbility,cost:import('./mana').ManaCost){if(ab.mh3Quest)cost.generic=Math.max(0,cost.generic-(c.eclCounters?.quest??0));if(c.def.id==='kami-of-jealous-thirst'&&g.players[c.controller].drawsThisTurn>=3)cost.generic=0,cost.B=0;}

export{drawWithReplacements as mh3Draw}from'./draw-replacements';
export function mh3Observe(g:GameState,e:GameEvent){
 if(e.type==='targeted'&&e.stackSid!==undefined){const c=g.cards[e.card];if(c?.def.set==='MH3'&&e.by!==c.controller&&!abilitiesSuppressed(g,c)){const kind=c.def.wardSac?'sac':c.def.wardDiscard?'discard':c.def.ward?'mana':undefined,n=c.def.wardSac??c.def.ward??1;if(kind)g.pending.push({source:c.id,controller:c.controller,abilityIndex:-523,ev:e,ability:{kind:'trigger',on:'targeted',effects:[{e:'frontier',action:prefix+'ward:'+kind+':'+n,n:e.stackSid}]}});}}
 if(e.type==='cast'){
  const c=g.cards[e.card],echoes=colorsOf(c.castFace??c.def).length===0?mh3Static(g,e.player,'echoes').length:0;
  for(const[i,a]of(c.def.abilities??[]).entries())if(a.kind==='trigger'&&a.frontierEvent===prefix+'castSelf'&&(!a.cond||checkCond(g,a.cond,e.player,c.id,[],e)))for(let n=0;n<=echoes;n++)g.pending.push({source:c.id,controller:e.player,ability:a,abilityIndex:i,ev:e});
  const before=g.players.reduce((n,p)=>n+p.spellsThisTurn,0)-1,replicate=c.frontierMarks?.mh3Replicate??0,copies=c.def.meadow?.mh3Storm?before:replicate;
  if(copies>0)g.pending.push({source:c.id,controller:e.player,abilityIndex:-510,ev:e,ability:{kind:'trigger',on:'castAny',effects:[{e:'frontier',action:prefix+'repeatCopies',n:copies}]}});
  if(c.def.meadow?.mh3Cascade)g.pending.push({source:c.id,controller:e.player,abilityIndex:-511,ev:e,ability:{kind:'trigger',on:'castAny',effects:[{e:'frontier',action:prefix+'cascade'}]}});
 }
 if(e.type==='step'&&e.step==='upkeep')for(const c of Object.values(g.cards))if(c.owner===e.player&&c.frontierMarks?.mh3Opening){delete c.frontierMarks.mh3Opening;g.pending.push({source:c.id,controller:c.owner,abilityIndex:-512,ev:e,ability:{kind:'trigger',on:'upkeep',effects:[{e:'frontier',action:prefix+'openingScry'}]}});}
 if(e.type==='step'&&e.step==='endStep'){const list=g.mh3Delayed??[];g.mh3Delayed=[];for(const d of list)g.pending.push({source:d.source,controller:d.controller,abilityIndex:-513,ev:e,ability:{kind:'trigger',on:'endStep',effects:[{e:'frontier',action:prefix+`delay:${d.kind}:${d.card}:${d.version}:${d.sourceVersion}`}]}});}
 for(const player of g.players)if(!player.mh3Blessing&&mh3Static(g,player.id,'ascend').length&&own(g,player.id).length>=10)player.mh3Blessing=true;
 if(e.type==='counterPlaced'&&e.counterKind==='+1/+1')for(const source of mh3Static(g,e.controller,'wombat')){const c=g.cards[e.card],m=c.frontierMarks??={},key='mh3Wombat:'+source.id+':'+(source.objectVersion??0)+':'+(c.objectVersion??0);if(abilitiesSuppressed(g,c)||m[key]===g.turn)continue;m[key]=g.turn;g.pending.push({source:c.id,controller:c.controller,abilityIndex:-514,ev:e,ability:{kind:'trigger',on:'counterPlacedSelf',effects:[{e:'counters',what:'self',n:1}]}});}
 if(e.type==='targeted'){const c=g.cards[e.card];if(c&&isCreature(c)&&!abilitiesSuppressed(g,c))for(const source of mh3Static(g,c.controller,'nadu')){const m=c.frontierMarks??={},key='mh3Nadu:'+source.id+':'+(source.objectVersion??0)+':'+(c.objectVersion??0);if(m[key+':turn']!==g.turn)m[key+':turn']=g.turn,m[key]=0;if((m[key]??0)>=2)continue;m[key]=(m[key]??0)+1;g.pending.push({source:c.id,controller:c.controller,abilityIndex:-515,ev:e,ability:{kind:'trigger',on:'targeted',effects:[{e:'frontier',action:prefix+'nadu'}]}});}}
 if(e.type==='attacks'){const c=g.cards[e.card];if(c.def.id==='hydra-trainer'&&c.frontierMarks?.mh3ExertTurn===g.turn)g.pending.push({source:c.id,controller:c.controller,abilityIndex:-522,ev:e,ability:{kind:'trigger',on:'attacks',targets:[{kind:'creature'}],effects:[{e:'pump',what:'T0',p:{frontier:prefix+'countersAll'},t:{frontier:prefix+'countersAll'}}]}});if(c.def.id==='idol-of-false-gods'&&isCreature(c)&&!abilitiesSuppressed(g,c))g.pending.push({source:c.id,controller:c.controller,abilityIndex:-521,ev:e,ability:{kind:'trigger',on:'attacks',effects:[{e:'sacPlayer',who:'opp',filter:{},n:2}]}});for(const source of own(g,c.controller))if((source.id===c.id||source.attachedTo===c.id)&&abilitiesOf(g,source).some(a=>a.kind==='static'&&a.frontier===prefix+'mentor'))g.pending.push({source:c.id,controller:c.controller,abilityIndex:-516,ev:e,ability:{kind:'trigger',on:'frontierEvent',frontierEvent:prefix+'mentor',effects:[{e:'frontier',action:prefix+'mentor'}]}});
 for(let copies=g.battlefield.map(id=>g.cards[id]).filter(s=>s.attachedTo===c.id&&s.def.id==='drossclaw'&&!abilitiesSuppressed(g,c)).length;copies>0;copies--)g.pending.push({source:c.id,controller:c.controller,abilityIndex:-517,ev:e,ability:{kind:'trigger',on:'attacks',effects:[{e:'lose',who:'opp',n:1}]}});
 for(const defender of g.players)if(defender.id!==c.controller&&defender.mh3DebuffUntil!==undefined&&g.turn<defender.mh3DebuffUntil){const n=defender.frontierFlags?.['mh3AttackDebuff:'+defender.id]??0;if(n&&c.attackTarget!==c.controller)g.eot.push({card:c.id,p:-n,t:0,kw:[]});}}
 if(e.type==='dies'){const c=g.cards[e.card];for(let copies=g.battlefield.map(id=>g.cards[id]).filter(a=>a.attachedTo===c.id&&a.def.id==='indebted-spirit'&&!abilitiesSuppressed(g,c)).length;copies>0;copies--)g.pending.push({source:c.id,controller:c.controller,abilityIndex:-518,ev:e,ability:{kind:'trigger',on:'dies',effects:[{e:'token',token:'tok-mh3-afterlife'}]}});}

 if(e.type==='etb'&&isCreature(g.cards[e.card])){const c=g.cards[e.card];for(let copies=mh3Static(g,c.controller,'evolveTokens').length;copies>0;copies--)for(const t of own(g,c.controller,{type:'Creature',token:true}))if(t.id!==c.id&&(stats(g,c).p>stats(g,t).p||stats(g,c).t>stats(g,t).t))g.pending.push({source:t.id,controller:t.controller,abilityIndex:-501,ev:e,ability:{kind:'trigger',on:'etb',effects:[{e:'frontier',action:prefix+'evolve',what:'self',n:c.id}]}});}
 if(e.type==='youAttack'&&e.attackers.length===1){const n=own(g,e.player).reduce((n,c)=>n+(c.eclCounters?.exalted??0),0);for(let i=0;i<n;i++)g.pending.push({source:e.attackers[0],controller:e.player,abilityIndex:-502,ev:e,ability:{kind:'trigger',on:'youAttack',effects:[{e:'pump',what:'self',p:1,t:1}]}});}
}
export function* mh3Effect(g:GameState,ctx:Ctx,ef:Extract<Effect,{e:'frontier'}>):SubFlow{
 const src=g.cards[ctx.source],p=ctx.controller,pl=g.players[p],action=ef.action.slice(prefix.length),x=ctx.x??src.castX??0;
 const t=resolveRef(g,ctx,ef.what??'T0').cards[0],run=(es:Effect[])=>runEffects(g,ctx,es),pick=(ids:number[],text:string,min=0,max=1,by=p)=>choose(g,by,text,ids,min,max);
 const randomOne=(ids:number[])=>ids.length?[ids[randInt(g,ids.length)]]:[];
 const token=(def:string|import('./types').CardDef,n=1)=>makeEclTokenBatch(g,p,def,n);
 if(action.startsWith('ward:')){const item=g.stack.find(s=>s.sid===ef.n);if(!item)return;const[,kind,count]=action.split(':'),n=+count,who=item.controller;let paid=false;if(kind==='mana')paid=canPayCost(g,who,parseCost('{'+n+'}'))&&(yield*meadowYes(who,'支付{'+n+'}守護？'))&&payCost(g,who,parseCost('{'+n+'}'));if(kind==='discard'&&g.players[who].hand.length&&(yield*meadowYes(who,'棄一張牌支付守護？'))){const[id]=yield*pick(g.players[who].hand.slice(),'棄牌支付守護',1,1,who);if(id!==undefined)discardMany(g,[g.cards[id]]),paid=true;}if(kind==='sac'){const ids=own(g,who).map(c=>c.id);if(ids.length>=n&&(yield*meadowYes(who,'犧牲'+n+'個永久物支付守護？'))){const chosen=yield*pick(ids,'犧牲永久物',n,n,who);if(chosen.length===n){for(const id of chosen)sacrifice(g,g.cards[id]);paid=true;}}}if(!paid){if(item.kind==='spell')yield*runEffects(g,{...ctx,targets:[{c:item.cardId}]},[{e:'counter',what:'T0'}]);else g.stack=g.stack.filter(s=>s.sid!==item.sid);}return;}
 if(action.startsWith('delay:')){const[,kind,idText,versionText,sourceText]=action.split(':'),c=g.cards[+idText];if(!c||(c.objectVersion??0)!==+versionText)return;if(kind==='phelia'&&c.zone==='exile'){enterBattlefield(g,c,c.owner);if(c.owner===p&&src.zone==='battlefield'&&(src.objectVersion??0)===+sourceText)meadowCounter(g,src,'+1/+1');}if(kind==='glimpse'&&c.zone==='exile'){moveCard(g,c,'graveyard');if(String(c.zone)==='graveyard')yield*token('tok-mh3-spawn');}if(kind==='unearth'&&c.zone==='battlefield')moveCard(g,c,'exile');return;}
 if(action.startsWith('counter:')){const c=ef.what==='self'?src:t;if(c)meadowCounter(g,c,action.slice(8),ef.n??1,p);return;}
 if(action.startsWith('addType:')){if(t){t.baseDef??=t.def;t.def={...t.def,subtypes:[...new Set([...(t.def.subtypes??[]),action.slice(8)])]};}return;}
 switch(action){
 case'energy':mh3GainEnergy(g,p,ef.n??0);break;
 case'energyCreatures':mh3GainEnergy(g,p,own(g,p,{type:'Creature'}).length);break;
 case'adapt':if(src.counters===0)yield*run([{e:'counters',what:'self',n:ef.n??1}]);break;
 case'evolve':{const c=g.cards[ef.n??-1];if(c?.zone==='battlefield'&&src.zone==='battlefield'&&(stats(g,c).p>stats(g,src).p||stats(g,c).t>stats(g,src).t))yield*run([{e:'counters',what:'self',n:1}]);break;}
 case'populate':{const[id]=yield*pick(own(g,p,{type:'Creature',token:true}).map(c=>c.id),'選擇要殖民的衍生物',1);if(id!==undefined)yield*token(copiableDefinition(g.cards[id]));break;}
 case'24':if(t){const auras=g.battlefield.map(id=>g.cards[id]).filter(a=>a.attachedTo===t.id&&a.controller===p&&a.def.subtypes?.includes('Aura'));moveCard(g,t,'hand');for(const a of auras)moveCard(g,a,'hand');}break;
 case'33':if(t&&t.zone==='graveyard'){const n=manaValue(t.def);if((pl.energy??0)>=n&&(yield*meadowYes(p,'支付'+n+'能量使其回戰場？'))){mh3PayEnergy(g,p,n);enterBattlefield(g,t,p);}}break;
 case'42':{const ids=pl.library.slice(0,6),options=ids.filter(id=>matches(g,{type:['Artifact','Enchantment']},g.cards[id],p));const[id]=yield*pick(options,'可展示神器或結界');if(id!==undefined)moveCard(g,g.cards[id],'hand');else yield*run([{e:'counters',what:'self',n:1}]);const rest=ids.filter(i=>i!==id);shuffleArr(g,rest);for(const id of rest)moveCard(g,g.cards[id],'library',true);break;}
 case'upkeepPrison':case'upkeepTap':if((pl.energy??0)>0&&(yield*meadowYes(p,'支付1能量？')))mh3PayEnergy(g,p,1);else if(action==='upkeepPrison')sacrifice(g,src);else yield*run([{e:'tap',what:'self'}]);break;
 case'46':if((yield*meadowMode(p,'選擇效果',['自身警戒與繫命','其他生物+1/+1']))===0)yield*run([{e:'pump',what:'self',p:0,t:0,kw:['vigilance','lifelink']}]);else yield*run([{e:'pump',what:{all:{ctrl:'you',type:'Creature',other:true}},p:1,t:1}]);break;
 case'replaceLand':if(t){const owner=t.controller;destroyCards(g,[t]);yield*runEffects(g,{...ctx,targets:[{p:owner}]},[{e:'searchLand',who:'T0',to:'battlefield',tapped:true,may:true}]);}break;
 case'49':case'50':case'122':case'260':{if(action==='49')mh3GainEnergy(g,p,x);const opts=Array.from({length:(pl.energy??0)+1},(_,i)=>String(i)),n=yield*meadowMode(p,'支付多少能量？',opts);mh3PayEnergy(g,p,n);if(action==='49')destroyCards(g,g.battlefield.map(id=>g.cards[id]).filter(c=>c.def.types.some(t=>t==='Artifact'||t==='Creature'||t==='Enchantment')&&manaValue(c.def)<=n));if(action==='50')yield*run([{e:'counterUnless',what:'T0',pay:n}]);if(action==='122')yield*run([{e:'damage',to:'T0',n}]);if(action==='260'){const who=resolveRef(g,ctx,'T0').players[0];if(who===undefined)break;const ids=own(g,who,{type:'Creature'}).map(c=>c.id);for(const id of ids)yield*runEffects(g,{...ctx,targets:[{c:id}]},[{e:'tap',what:'T0'}]);const chosen=yield*pick(ids.filter(id=>g.cards[id].tapped),'選擇放暈眩指示物的生物',0,n);for(const id of chosen)meadowCounter(g,g.cards[id],'stun',1,p);}break;}
 case'53':yield*mh3Draw(g,p,4);{const ids=yield*pick(pl.hand.slice(),'選擇兩張放回牌庫頂（先選的在最上方）',Math.min(2,pl.hand.length),2);for(const id of [...ids].reverse())moveCard(g,g.cards[id],'library');}break;
 case'57':if(t){const who=t.owner,second=yield*meadowYes(who,'放在牌庫頂第二張？（否則牌庫底）');moveCard(g,t,'library',!second);if(second){g.players[who].library.shift();g.players[who].library.splice(Math.min(1,g.players[who].library.length),0,t.id);}}break;
 case'vanishing':if((src.eclCounters?.time??0)>0){src.eclCounters!.time!--;if(src.eclCounters!.time===0)g.pending.push({source:src.id,controller:p,abilityIndex:-503,ev:ctx.ev!,ability:{kind:'trigger',on:'upkeep',effects:[{e:'sac',what:'self'}]}});}break;
 case'71':if(t){const who=t.controller;yield*run([{e:'counter',what:'T0'}]);yield*makeEclTokenBatch(g,who,{id:'tok-mh3-bird',name:'Bird',set:'TOK',rarity:'T',types:['Creature'],cost:'',power:2,toughness:2,colors:['U'],subtypes:['Bird'],keywords:['flying'],text:''},1);}break;
 case'81':if(t&&t.zone==='battlefield'){const n=src.lastCounters??0;if(n>0&&(yield*meadowYes(p,'把'+n+'個指示物放到目標神器生物？')))meadowCounter(g,t,'+1/+1',n,p);}break;
 case'82':if(t){const n=colorsOf(t.def).length;destroyCards(g,[t]);gainLife(g,p,n);}break;
 case'97':{const n=own(g,p).reduce((n,c)=>n+(c.def.cost?.match(/\{(?:B|W\/B|B\/R|B\/G|U\/B)\}/g)?.length??0),0);const[id]=yield*pick(pl.library.filter(id=>manaValue(g.cards[id].def)<=n),'搜尋不超過黑色獻力的牌',0);if(id!==undefined)moveCard(g,g.cards[id],'hand');shuffleArr(g,pl.library);break;}
 case'amass':{let army=own(g,p,{sub:'Army'})[0];if(!army){const made=yield*token('tok-mh3-army');army=made[0];}if(army)meadowCounter(g,army,'+1/+1',ef.n??3,p);break;}
 case'173':{const id=pl.library[0];if(id===undefined)break;const c=g.cards[id];if(isCreature(c)&&(yield*meadowYes(p,'展示並將生物牌置於手上？')))moveCard(g,c,'hand');else if(yield*meadowYes(p,'將牌庫頂置於墳墓場？'))moveCard(g,c,'graveyard');break;}
 case'188':{const n=stats(g,src).p;if(n>0&&(yield*meadowYes(p,'抓'+n+'張，再棄同量？'))){yield*mh3Draw(g,p,n);yield*run([{e:'discard',n,who:'you'}]);}break;}
 case'200':if(t){const n=manaValue(t.def);moveCard(g,t,'hand');yield*runEffects(g,{...ctx,targets:ctx.targets.slice(1)},[{e:'damage',to:'T0',n}]);}break;
 case'212':if(ctx.ev?.type==='cast'){const c=g.cards[ctx.ev.card];if(c.manaSpent===0)yield*runEffects(g,{...ctx,targets:[{c:c.id}]},[{e:'counter',what:'T0'}]);}break;
 case'230':if(t)for(let i=0;i<(g.players[0].finFlags?.creaturesDied??0);i++)yield*run([{e:'connive',what:'T0'}]);break;
 case'240':if(t&&t.zone==='stack'){const item=g.stack.find(s=>s.cardId===t.id&&s.kind==='spell');if(item&&item.targets.filter(Boolean).length===1){const index=item.targets.findIndex(Boolean),spec=item.targetSpecs[index];if(spec&&isLegalTarget(g,spec,{c:src.id},item.controller,item.cardId)&&(yield*meadowYes(p,'將唯一目標改為此生物？'))){item.targets[index]={c:src.id};(item.targetVersions??=[])[index]=src.objectVersion??0;emit(g,{type:'targeted',card:src.id,by:item.controller,spell:true,stackSid:item.sid});}}}break;
 case'groundedNoBlock':for(const player of g.players)player.mh3GroundedNoBlockTurn=g.turn;for(const c of g.battlefield.map(id=>g.cards[id]).filter(isCreature))if(!stats(g,c).kw.has('flying'))g.eot.push({card:c.id,p:0,t:0,kw:[],cantBlock:true});break;
 case'250':{const[id]=yield*pick(own(g,p,{type:'Creature'}).filter(c=>c.id!==src.id).map(c=>c.id),'可犧牲另一個生物');if(id!==undefined){const n=Math.max(0,stats(g,g.cards[id]).p);sacrifice(g,g.cards[id]);gainLife(g,p,n);yield*mh3Draw(g,p,n);}break;}
 case'doublePower':if(t){const n=stats(g,t).p;yield*run([{e:'pump',what:'T0',p:n,t:0}]);}break;
 case'257':if((pl.energy??0)>=2&&(yield*meadowYes(p,'支付2能量免棄牌？')))mh3PayEnergy(g,p,2);else yield*run([{e:'discard',who:'you',n:1,random:true}]);break;
 case'shroud':if(t)g.eot.push({card:t.id,p:0,t:0,kw:['shroud']});break;
 case'copyCast':case'reclamationCopy':if(action!=='reclamationCopy'||(yield*meadowYes(p,'複製此咒語？')))yield*run([{e:'copySpell'}]);break;
 case'copyTargetSpell':if(t)yield*runEffects(g,{...ctx,ev:{type:'cast',card:t.id,player:t.controller,opponentTurn:g.active!==t.controller}},[{e:'copySpell'}]);break;
 case'6':{const who=resolveRef(g,ctx,'T0').players[0];if(who!==undefined)for(const c of own(g,who,{type:'Creature'}))c.controller=p;break;}
 case'8':if(yield*meadowYes(p,'放逐手牌並抓三張？')){for(const id of pl.hand.slice())moveCard(g,g.cards[id],'exile');yield*mh3Draw(g,p,3);}break;
 case'10':for(const who of resolveRef(g,ctx,'T0').players.concat(resolveRef(g,ctx,'T1').players)){const ids=yield*pick(g.players[who].hand.slice(),'選擇兩張手牌顯化',Math.min(2,g.players[who].hand.length),2,who);let n=0;for(const id of ids){putFaceDown(g,g.cards[id],who,false);if(g.cards[id].zone==='battlefield')n++;}yield*mh3Draw(g,p,n);}break;
 case'spawnPlayer':{const who=resolveRef(g,ctx,ef.what??'T0').players[0];if(who!==undefined)yield*makeEclTokenBatch(g,who,'tok-mh3-spawn',x);break;}
 case'scryPlayerX':{const who=resolveRef(g,ctx,ef.what??'T0').players[0];if(who!==undefined)yield*runEffects(g,{...ctx,controller:who},[{e:'scry',n:x},{e:'draw',n:1}]);break;}
 case'exileX':if(t&&manaValue(t.def)<=x)moveCard(g,t,'exile');break;
 case'exileGraveX':for(const target of ctx.targets.slice(ef.n??0))if(target&&'c'in target&&g.cards[target.c]?.zone==='graveyard')moveCard(g,g.cards[target.c],'exile');break;
 case'15':{const who=resolveRef(g,ctx,'T0').players[0];if(who!==undefined)for(const id of g.players[who].library.slice(0,Math.ceil(g.players[who].library.length/2)))moveCard(g,g.cards[id],'exile');break;}
 case'vigilanceChoice':{const[id]=yield*pick(own(g,p,{type:'Creature'}).map(c=>c.id),'選擇生物放警戒指示物',1);if(id!==undefined)meadowCounter(g,g.cards[id],'vigilance');break;}
 case'20':if(t){const who=t.controller;moveCard(g,t,'exile');yield*mh3Draw(g,who,2);}break;
 case'21':{meadowCounter(g,src,'collection');if((src.eclCounters?.collection??0)>=3&&src.zone==='battlefield'){sacrifice(g,src);yield*mh3Draw(g,p,1);yield*run([{e:'tutor',filter:{type:'Land',sub:'Plains'},to:'battlefield',tapped:true,optional:true}]);}break;}
 case'25':if(t&&(src.kicked||manaValue(t.def)<=3)){const who=t.controller,n=manaValue(t.def);moveCard(g,t,'exile');gainLife(g,who,n);}break;
 case'26':pl.mh3LifeLockTurn=g.turn;yield*run([{e:'pump',what:{all:{ctrl:'you'}},p:0,t:0,kw:['hexproof','indestructible']}]);break;
 case'manifestTop':{const id=pl.library[0];if(id!==undefined)putFaceDown(g,g.cards[id],p,false);break;}
 case'livingWeapon':{const made=yield*token('tok-mh3-germ');if(made[0]&&src.zone==='battlefield')src.attachedTo=made[0].id;break;}
 case'38':{const blessing=!!pl.mh3Blessing,snap=g.battlefield.map(id=>g.cards[id]).filter(c=>c.controller===p&&c.token&&c.enteredTurn===g.turn);yield*token('tok-mh3-cat');if(blessing){const cat=g.battlefield.map(id=>g.cards[id]).find(c=>c.controller===p&&c.token&&c.def.id==='tok-mh3-cat'&&!snap.includes(c));if(cat)snap.push(cat);for(const c of snap)yield*token(copiableDefinition(c));}break;}
 case'40':if(t){moveCard(g,t,'exile');mh3Schedule(g,ctx,'phelia',t);}break;
 case'58':{const opts=[0,1,...(src.kicked?[2]:[])],mode=yield*meadowMode(p,'選擇施放觸發',['移回生物','抓二棄一',...(src.kicked?['兩者']:[])]);if(opts[mode]===0||opts[mode]===2)yield*run([{e:'reflexive',targets:[{kind:'creature'}],effects:[{e:'bounce',what:'T0'}]}]);if(opts[mode]===1||opts[mode]===2)yield*run([{e:'reflexive',targets:[{kind:'player'}],effects:[{e:'draw',n:2,who:'T0'},{e:'discard',n:1,who:'T0'}]}]);break;}
 case'70':if(src.attachedToPlayer!==undefined){const who=src.attachedToPlayer;(g.players[who].mh3ExtraBeginning??=0);g.players[who].mh3ExtraBeginning!++;}break;
 case'attackDebuff':(pl.frontierFlags??={})['mh3AttackDebuff:'+p]=ef.n??1;pl.mh3DebuffUntil=g.turn+(g.active===p?2:1);break;
 case'72':{const ids=yield*pick(pl.hand.slice(),'可棄任意張牌',0,pl.hand.length);discardMany(g,ids.map(id=>g.cards[id]));yield*token('tok-clue',ids.length*2);break;}
 case'79':if(t&&src.zone==='battlefield'&&t.zone==='battlefield'){const who=t.controller;src.controller=who;t.controller=p;mh3GainEnergy(g,p,4);const n=manaValue(t.def);if((pl.energy??0)>=n&&(yield*meadowYes(p,'支付'+n+'能量保留交換來的生物？')))mh3PayEnergy(g,p,n);else sacrifice(g,t);}break;
 case'83':if(t&&t.zone==='graveyard')enterBattlefield(g,t,p);break;
 case'85':{const who=resolveRef(g,ctx,'T0').players[0];if(who===undefined)break;const victim=g.players[who],ids=[...victim.library.slice(0,1),...randomOne(victim.graveyard),...randomOne(victim.hand)];for(const id of ids)moveCard(g,g.cards[id],'exile');const[id]=yield*pick(ids.filter(id=>!isLand(g.cards[id])),'可免費施放一張放逐的牌');if(id!==undefined)yield*freeCast(g,ctx,g.cards[id],true);break;}
 case'avacynSearch':{const[id]=yield*pick(pl.library.slice(),'搜尋一張牌面朝下放逐',1);if(id!==undefined){moveCard(g,g.cards[id],'exile');mh3Link(src,g.cards[id]);(g.cards[id].frontierMarks??={}).mh3Hidden=1;}shuffleArr(g,pl.library);break;}
 case'avacynReveal':{const c=mh3Linked(g,src)[0];if(c){delete c.frontierMarks?.mh3Hidden;if(isCreature(c))loseLife(g,p,manaValue(c.def));}break;}
 case'avacynReturn':{const c=mh3Linked(g,src)[0];if(c){if(isCreature(c)&&(yield*meadowYes(p,'將生物放進戰場？')))enterBattlefield(g,c,p);else moveCard(g,c,'hand');}break;}
 case'emperorExile':if(t){moveCard(g,t,'exile');mh3Link(src,t);}break;
 case'emperorReturn':{const[id]=yield*pick(mh3Linked(g,src).filter(isCreature).map(c=>c.id),'將放逐的生物放回戰場',1);if(id!==undefined){const c=g.cards[id];enterBattlefield(g,c,p);if(c.zone==='battlefield'){meadowCounter(g,c,'finality');g.eot.push({card:c.id,p:0,t:0,kw:['haste']});c.sacAtEnd=true;}}break;}
 case'91':if(putCounters(g,src,1)>0)yield*run([{e:'reflexive',targets:[{kind:'permanentOrPlayer',notSelf:true,mh3OpponentPlayer:true,optional:true}],effects:[{e:'frontier',action:prefix+'removeCounter'}]}]);break;
 case'removeCounter':{if(t){const kinds=Object.entries(counterKinds(t)).filter(([,n])=>n>0).map(([k])=>k);if(kinds.length)removeCounterKind(t,kinds[yield*meadowMode(p,'移去一個指示物',kinds)]);}else{const who=resolveRef(g,ctx,'T0').players[0];if(who!==undefined&&(g.players[who].energy??0)>0)mh3PayEnergy(g,who,1);}break;}
 case'zombiePlayer':{const who=resolveRef(g,ctx,ef.what??'T0').players[0];if(who!==undefined)yield*makeEclTokenBatch(g,who,'tok-mh3-zombie',1);break;}
 case'99':if(src.frontierMarks?.mh3SacModified)yield*mh3Draw(g,p,1);break;
 case'102':{const n=yield*meadowMode(p,'支付多少生命並抓牌？',Array.from({length:Math.max(0,pl.life)+1},(_,i)=>String(i)));if(frontierCanPayLife(g,p,n)){frontierPayLife(g,p,n);yield*mh3Draw(g,p,n);}break;}
 case'107':{const ids=pl.library.slice(0,3);for(const id of ids)moveCard(g,g.cards[id],'graveyard');if(frontierCanPayLife(g,p,3)&&canPayCost(g,p,parseCost('{1}'))&&(yield*meadowYes(p,'支付{1}與3生命，取回一張本次碾磨的牌？'))){if(payCost(g,p,parseCost('{1}'))){frontierPayLife(g,p,3);const[id]=yield*pick(ids.filter(id=>g.cards[id].zone==='graveyard'),'取一張牌',1);if(id!==undefined)moveCard(g,g.cards[id],'hand');}}break;}
 case'shilgengarBlood':yield*token('tok-blood',ctx.bdSac?.subtypes?.includes('Angel')?ctx.bdSac.toughness??1:1);break;
 case'shilgengarReturn':for(const id of pl.graveyard.slice())if(isCreature(g.cards[id])){const c=g.cards[id];enterBattlefield(g,c,p);if(c.zone==='battlefield'){meadowCounter(g,c,'finality');c.baseDef??=c.def;c.def={...c.def,subtypes:[...new Set([...(c.def.subtypes??[]),'Vampire'])]};}}break;
 case'114':if(src.castOrigin==='hand'){const ids:number[]=[];let c:Card|undefined;while(pl.library.length){c=g.cards[pl.library[0]];moveCard(g,c,'exile');ids.push(c.id);if(!isLand(c))break;}if(c&&!isLand(c)){const n=manaValue(c.def);if((pl.energy??0)>=n&&(yield*meadowYes(p,'支付'+n+'能量施放 '+c.def.name+'？'))){const old=pl.energy??0;mh3PayEnergy(g,p,n);if(!(yield*freeCast(g,ctx,c,false,'mh3EnergyPaid')))pl.energy=old;}}}break;
 case'115':{yield*run([{e:'discard',who:'you',n:1},{e:'draw',n:1}]);const m=src.frontierMarks??={};if(m.mh3MageTurn!==g.turn)m.mh3MageTurn=g.turn,m.mh3MageCount=0;m.mh3MageCount=(m.mh3MageCount??0)+1;if(m.mh3MageCount===2)yield*run([{e:'damage',to:'opp',n:2},{e:'damage',to:{all:{ctrl:'opp',type:'Creature'}},n:2}]);if(m.mh3MageCount===3)(pl.pool??=[]).push('R','R','R','R');break;}
 case'124':{for(const id of pl.library.slice(0,3)){const c=g.cards[id];moveCard(g,c,'exile');c.eclCast={by:p,until:g.turn};mh3Schedule(g,ctx,'glimpse',c);}break;}
 case'125':{const[id]=yield*pick(own(g,p,{type:'Creature'}).map(c=>c.id),'可犧牲一個生物利用');if(id!==undefined){sacrifice(g,g.cards[id]);yield*run([{e:'reflexive',targets:[{kind:'permanent',filter:{type:['Artifact','Creature']}}],effects:[{e:'frontier',action:prefix+'controlTemporary'},{e:'untap',what:'T0'},{e:'pump',what:'T0',p:0,t:0,kw:['haste']}]}]);}break;}
 case'127':{let left=3;const targets=ctx.targets.filter((t):t is import('./types').TargetRef=>!!t);for(let i=0;i<targets.length;i++){const n=ctx.distribution?.[i]??(i===targets.length-1?left:1);dealDamage(g,src,p,targets[i],n);left-=n;}break;}
 case'unearth':if(src.zone==='graveyard'){enterBattlefield(g,src,p);if(String(src.zone)==='battlefield'){(src.frontierMarks??={}).mh3Unearthed=1;g.eot.push({card:src.id,p:0,t:0,kw:['haste']});mh3Schedule(g,ctx,'unearth',src);}}break;
 case'129':{const[id]=yield*pick(pl.hand.slice(),'可棄一張牌以放逐兩張');if(id!==undefined){discardMany(g,[g.cards[id]]);const ids=pl.library.slice(0,2);for(const id of ids)moveCard(g,g.cards[id],'exile');const[selected]=yield*pick(ids,'選擇本回合可以使用的牌',1);if(selected!==undefined)g.cards[selected].eclCast={by:p,until:g.turn};}break;}
 case'131':if(ctx.ev?.type==='cast'&&pl.library.length&&(yield*meadowYes(p,'展示牌庫頂？'))){const c=g.cards[pl.library[0]],evc=g.cards[ctx.ev.card];if(manaValue(c.def)===manaValue(evc.castFace??evc.def)&&!isLand(c)&&(yield*meadowYes(p,'免費施放展示的牌？')))yield*freeCast(g,ctx,c,true);}break;
 case'discardImpulse':{const[id]=yield*pick(pl.hand.slice(),'可棄一張牌以放逐頂牌');if(id!==undefined){discardMany(g,[g.cards[id]]);for(const id of pl.library.slice(0,2)){const c=g.cards[id];moveCard(g,c,'exile');c.eclCast={by:p,until:g.turn+(g.active===p?2:1)};}}break;}
 case'133':{const m=src.frontierMarks??={};if(m.mh3BattlecryTurn!==g.turn)m.mh3BattlecryTurn=g.turn,m.mh3Battlecry=0;m.mh3Battlecry=(m.mh3Battlecry??0)+1;break;}
 case'battlecry':if(src.frontierMarks?.mh3BattlecryTurn===g.turn)yield*run([{e:'pump',what:{all:{ctrl:'you',type:'Creature',attacking:true,other:true}},p:src.frontierMarks.mh3Battlecry??0,t:0}]);break;
 case'142':{const id=pl.library[0];if(id===undefined)break;for(const c of mh3Linked(g,src))if(c.eclCast?.mode==='mh3Amulet'&&c.eclCast.by===p)c.eclCast=undefined;src.meadowLinked=[];const c=g.cards[id];moveCard(g,c,'exile');mh3Link(src,c);c.eclCast={by:p,mode:'mh3Amulet'};break;}
 case'144':{const n=yield*meadowMode(p,'支付多少能量？',Array.from({length:(pl.energy??0)+1},(_,i)=>String(i)));mh3PayEnergy(g,p,n);for(const who of [p,other(p)])if(yield*meadowYes(who,'放逐手牌並抓'+n+'張？')){const ids=g.players[who].hand.slice();for(const id of ids){const c=g.cards[id];moveCard(g,c,'exile');if(n>=7&&c.owner===p)c.eclCast={by:p,until:g.turn+(g.active===p?2:1)};}yield*mh3Draw(g,who,n);}break;}
 case'146':{const ids=pl.library.slice(0,7),[victim]=yield*pick(own(g,p,{type:'Creature'}).map(c=>c.id),'可犧牲生物以進化');if(victim!==undefined){const n=manaValue(g.cards[victim].def)+1;sacrifice(g,g.cards[victim]);const[id]=yield*pick(ids.filter(id=>g.cards[id].zone==='library'&&isCreature(g.cards[id])&&manaValue(g.cards[id].def)<=n),'可放入法術力值符合的生物');if(id!==undefined)enterBattlefield(g,g.cards[id],p);}const rest=ids.filter(id=>g.cards[id].zone==='library');shuffleArr(g,rest);for(const id of rest)moveCard(g,g.cards[id],'library',true);break;}
 case'149':{const top=pl.library[0],ids=pl.hand.slice();if(top!==undefined)ids.push(top);const[id]=yield*pick(ids,'展示手牌或牌庫頂',1);if(id!==undefined&&isCreature(g.cards[id]))enterBattlefield(g,g.cards[id],p);break;}
 case'eternalize':yield*token({...src.def,id:'tok-mh3-eternal-'+src.def.id,types:['Creature'],cost:'',power:4,toughness:4,colors:['B'],subtypes:[...new Set([...(src.def.subtypes??[]),'Zombie'])]});break;
 case'153':if(t){if(putCounters(g,t,1)>0)putCounters(g,t,t.counters);}break;
 case'153all':for(const c of own(g,p,{type:'Creature'}))if(putCounters(g,c,1)>0)putCounters(g,c,c.counters);break;
 case'doublePlusCounters':if(t&&t.counters>0)putCounters(g,t,t.counters);break;
 case'154':{const ids=yield*pick(pl.library.filter(id=>g.cards[id].def.supertypes?.includes('Basic')&&isLand(g.cards[id])),'搜尋至多兩張基本地',0,2);if(ids.length){const[id]=yield*pick(ids,'選擇橫置進戰場的一張',1);if(id!==undefined)enterBattlefield(g,g.cards[id],p,true);for(const rest of ids)if(rest!==id)moveCard(g,g.cards[rest],'hand');}shuffleArr(g,pl.library);break;}
 case'158':{const victims=yield*pick(own(g,p,{type:'Creature'}).map(c=>c.id),'可犧牲任意數量生物',0,own(g,p,{type:'Creature'}).length);for(const id of victims)sacrifice(g,g.cards[id]);const library=yield*meadowYes(p,'也搜尋牌庫？'),ids=[...pl.graveyard,...(library?pl.library:[])].filter(id=>isCreature(g.cards[id])&&manaValue(g.cards[id].def)<=victims.length),[id]=yield*pick(ids,'搜尋符合費用的生物',0);if(id!==undefined)enterBattlefield(g,g.cards[id],p);if(library)shuffleArr(g,pl.library);break;}
 case'162':if(ctx.ev?.type==='cast')yield*run([{e:'frontier',action:'lci:discover',n:manaValue(g.cards[ctx.ev.card].castFace??g.cards[ctx.ev.card].def)}]);break;
 case'168':{const victim=resolveRef(g,ctx,'T1').cards[0];if(victim)for(const c of own(g,p,{type:'Creature'}).filter(c=>webModified(g,c)))dealDamage(g,c,p,{c:victim.id},Math.max(0,stats(g,c).p));break;}
 case'171':{const host=src.attachedTo!==null?g.cards[src.attachedTo]:undefined;let made=false;if(host?.zone==='battlefield'&&host.controller===p&&canPayCost(g,p,parseCost('{1}{G}'))&&(yield*meadowYes(p,'支付{1}{G}，複製所結附的生物？'))&&payCost(g,p,parseCost('{1}{G}'))){const list=yield*token(copiableDefinition(host));made=list.length>0;}if(!made)yield*token('tok-mh3-insect-green');break;}
 case'174':if(t){moveCard(g,t,'exile');(src.copiedAbilities??=[]).push({kind:'trigger',on:'leaves',targets:[{kind:'opponent'}],effects:[{e:'draw',n:1,who:'T0'}]});}break;
 case'176':{const who=resolveRef(g,ctx,'T0').players[0];if(who!==undefined&&(yield*meadowYes(who,'將一張生物牌從手上放進戰場？'))){const[id]=yield*pick(g.players[who].hand.filter(id=>isCreature(g.cards[id])),'選擇生物',0,1,who);if(id!==undefined)enterBattlefield(g,g.cards[id],who);}break;}
 case'177':if(t){moveCard(g,t,'exile');t.eclCast={by:p,mode:'mh3AnyC'};}break;
 case'178':if(ctx.ev?.type==='attacks'){const c=g.cards[ctx.ev.card];for(const[k,n]of Object.entries(counterKinds(c)))if(n>0)meadowCounter(g,c,k,n,p);const attachments=g.battlefield.map(id=>g.cards[id]).filter(a=>a.attachedTo===c.id&&!a.token);for(const a of attachments){const copies=yield*token(copiableDefinition(a));for(const copy of copies)copy.attachedTo=c.id;}}break;
 case'186':break; // The mode and token are selected when this trigger is put on the stack.
 case'imskirDraw':{const n=Math.floor(own(g,p,{type:'Artifact'}).length/2);yield*mh3Draw(g,p,n);loseLife(g,p,n);break;}
 case'imskirDamage':yield*run([{e:'damage',to:'T0',n:ctx.bdSac?.mana??0}]);break;
 case'190':if(t){const item=g.stack.find(s=>s.kind==='spell'&&s.cardId===t.id);if(!item)break;if(randInt(g,2)===0){item.controller=p;t.controller=p;if(item.targetSpecs.length){const answer:import('./types').Response=yield{type:'targets',player:p,source:t.id,specs:item.targetSpecs,text:t.def.text,effects:item.effects};if(answer.type==='targets'&&!validateTargets(g,item.targetSpecs,answer.targets,p,t.id)){item.targets=answer.targets;item.targetVersions=answer.targets.map(t=>t&&'c'in t?g.cards[t.c]?.objectVersion??0:undefined);}}}else yield*run([{e:'counter',what:'T0'}]);}break;
 case'nadu':{const id=pl.library[0];if(id!==undefined){const c=g.cards[id];if(isLand(c))enterBattlefield(g,c,p);else moveCard(g,c,'hand');}break;}
 case'194':yield*token(new Set(own(g,p,{type:'Land'}).map(c=>c.def.name)).size>=7?'tok-mh3-zombie':'tok-mh3-plant');break;
 case'throwLine':if(ctx.targets[1]){yield*run([{e:'counters',what:'T0',n:1},{e:'counters',what:'T1',n:1}]);}else yield*run([{e:'counters',what:'T0',n:2}]);break;
 case'phlageSac':if(!src.frontierMarks?.mh3Escaped)sacrifice(g,src);break;
 case'198':{const ids=pl.library.slice(0,4),lands=ids.filter(id=>isLand(g.cards[id]));let selected:number|undefined;if(lands.length&&(yield*meadowYes(p,'可將一張地橫置放進戰場？'))){[selected]=yield*pick(lands,'選擇地',1);if(selected!==undefined)enterBattlefield(g,g.cards[selected],p,true);}if(selected===undefined){[selected]=yield*pick(ids,'選擇一張牌放手上',Math.min(1,ids.length));if(selected!==undefined)moveCard(g,g.cards[selected],'hand');}const rest=ids.filter(id=>id!==selected&&g.cards[id].zone==='library');shuffleArr(g,rest);for(const id of rest)moveCard(g,g.cards[id],'library',true);break;}
 case'rosheenRetrieve':{const ids=(ctx.milled??[]).filter(id=>g.cards[id]?.zone==='graveyard'&&(g.cards[id].def.cost??'').includes('{X}'));const[id]=yield*pick(ids,'可取回含X費用的牌');if(id!==undefined)moveCard(g,g.cards[id],'hand');break;}
 case'rosheenMana':{const ids=yield*pick(pl.hand.filter(id=>(g.cards[id].def.cost??'').includes('{X}')),'展示任意數量X牌',0,pl.hand.length);(pl.eclRestrictedMana??=[]).push(...Array.from({length:2*ids.length},()=>({mana:'C' as const,rule:'mh3:X',source:src.id})));break;}
 case'improviseNext':pl.mh3ImproviseTurn=g.turn;break;
 case'woodlandCopy':if(t&&t.zone==='graveyard'){src.mh3TemporaryBase=src.def;src.mh3CopyTurn=g.turn;src.def=copiableDefinition(t);}break;
 case'imprintLabyrinth':{const[id]=yield*pick(pl.hand.filter(id=>colorsOf(g.cards[id].def).length===0&&manaValue(g.cards[id].def)>=7),'可壓印無色大牌');if(id!==undefined){const c=g.cards[id];moveCard(g,c,'exile');mh3Link(src,c);}break;}
 case'labyrinthMana':(pl.pool??=[]).push(...Array.from({length:mh3Linked(g,src).length?2:1},()=> 'C' as const));break;
 case'labyrinthReturn':{const c=mh3Linked(g,src)[0];if(c)moveCard(g,c,'hand');break;}
 case'mayTransform':if(src.zone==='battlefield'&&(yield*meadowYes(p,'放逐並轉化此牌？')))yield*run([{e:'returnTransformed'}]);break;
 case'extort':if(canPayCost(g,p,parseCost('{W/B}'))&&(yield*meadowYes(p,'支付{W/B}敲詐？'))&&payCost(g,p,parseCost('{W/B}'))){loseLife(g,other(p),1);gainLife(g,p,1);}break;
 case'ralCoin':if(randInt(g,2)===0)dealDamage(g,src,p,{p},1);else if(yield*meadowYes(p,'放逐並轉化拉爾？'))yield*run([{e:'returnTransformed'}]);break;
 case'gristTransform':if(canPayCost(g,p,parseCost('{G}'))&&(yield*meadowYes(p,'支付{G}轉化格蕊斯？'))&&payCost(g,p,parseCost('{G}')))yield*run([{e:'returnTransformed'}]);break;
 case'252':{const who=resolveRef(g,ctx,'T0').players[0];if(who!==undefined)for(const id of g.players[who].library.slice(0,3)){const c=g.cards[id];moveCard(g,c,'exile');c.eclCast={by:p,mode:'finAnyMana',until:g.turn+(g.active===p?2:1)};}break;}
 case'decreeCycle':{const n=yield*meadowMode(p,'支付X以派出士兵',Array.from({length:21},(_,i)=>String(i)));if(canPayCost(g,p,parseCost('{'+n+'}'))&&payCost(g,p,parseCost('{'+n+'}')))yield*token('tok-soldier',n);break;}
 case'265':{const who=resolveRef(g,ctx,'T0').players[0];if(who!==undefined)g.players[who].mh3SilencedTurn=g.turn;if(src.kicked)for(const player of g.players)player.mh3NoAttacksTurn=g.turn;break;}
 case'estridBlink':if(src.zone==='battlefield'&&(yield*meadowYes(p,'放逐此結界並使其返回？')))yield*run([{e:'flicker',what:'self'}]);break;
 case'273':{const ids=yield*pick(pl.library.filter(id=>isCreature(g.cards[id])),'搜尋至多三張生物置入墳墓場',0,3);for(const id of ids)moveCard(g,g.cards[id],'graveyard');shuffleArr(g,pl.library);break;}
 case'290':{const[id]=yield*pick(pl.hand.filter(id=>isCreature(g.cards[id])&&g.cards[id].def.subtypes?.some(s=>s==='Angel'||s==='Demon'||s==='Dragon')),'可放入天使、惡魔或龍');if(id!==undefined){const c=g.cards[id];enterBattlefield(g,c,p,true);if(c.zone==='battlefield'){c.attacking=true;c.attackTarget=src.attackTarget;}}break;}
 case'302':{const dest=resolveRef(g,ctx,'T1').cards[0];if(t&&dest){const kinds=Object.entries(counterKinds(t)).filter(([,n])=>n>0).map(([k])=>k);if(kinds.length){const kind=kinds[yield*meadowMode(p,'選擇要移動的指示物',kinds)]??kinds[0];if(removeCounterKind(t,kind))meadowCounter(g,dest,kind,1,p);}}break;}
 case'mentor':if(t&&t.zone==='battlefield'&&stats(g,t).p<(src.zone==='battlefield'?stats(g,src).p:src.lastPower??0))meadowCounter(g,t,'+1/+1',1,p);break;
 case'repeatCopies':for(let i=0;i<(ef.n??0);i++)yield*run([{e:'copySpell'}]);break;
 case'cascade':{const ids:number[]=[],limit=manaValue(src.castFace??src.def)+(src.castX??0);let c:Card|undefined;while(pl.library.length){c=g.cards[pl.library[0]];moveCard(g,c,'exile');ids.push(c.id);if(!isLand(c)&&manaValue(c.def)<limit)break;}if(c&&!isLand(c)&&manaValue(c.def)<limit&&(yield*meadowYes(p,'可以免費施放連鎖翻出的牌？')))yield*freeCast(g,ctx,c,true);const rest=ids.filter(id=>g.cards[id].zone==='exile');shuffleArr(g,rest);for(const id of rest)moveCard(g,g.cards[id],'library',true);break;}
 case'openingScry':{const ids=pl.library.slice(0,4),[id]=yield*pick(ids,'可以保留一張牌在牌庫頂');for(const rest of ids)if(rest!==id)moveCard(g,g.cards[rest],'exile');break;}
 case'madness':if(src.zone==='exile'){if(!(yield*meadowYes(p,'支付六點無色，以瘋魔施放？'))||!(yield*freeCast(g,ctx,src,false,'mh3Madness')))moveCard(g,src,'graveyard');}break;
 case'primalEnergy':break;
 case'ajaniToken':{yield*token('tok-mh3-cat-warrior');if(own(g,p,{color:'R'}).some(c=>c.id!==src.id))yield*run([{e:'reflexive',targets:[{kind:'any'}],effects:[{e:'frontier',action:prefix+'ajaniDamage'}]}]);break;}
 case'ajaniDamage':if(own(g,p,{color:'R'}).some(c=>c.id!==src.id))yield*run([{e:'damage',to:'T0',n:{count:{ctrl:'you',type:'Creature'}}}]);break;
 case'ajaniSweep':{const who=other(p),cards=own(g,who,{nonType:'Land'}),keep=new Set<number>();for(const type of ['Artifact','Creature','Enchantment','Planeswalker']as const){const ids=cards.filter(c=>c.def.types.includes(type)).map(c=>c.id);if(ids.length){const[id]=yield*pick(ids,'保留一個'+type,1,1,who);if(id!==undefined)keep.add(id);}}for(const c of cards)if(!keep.has(c.id))sacrifice(g,c);break;}
 case'tamiyoReturn':if(t){const green=colorsOf(t.def).includes('G');moveCard(g,t,'hand');if(green)yield*run([{e:'addManaOfChoice',n:1}]);}break;
 case'tamiyoEmblem':yield*mh3Draw(g,p,Math.ceil(pl.library.length/2));pl.noHandLimit=true;break;
 case'sorinControl':if(t){t.controller=p;t.baseDef??=t.def;t.def={...t.def,subtypes:[...new Set([...(t.def.subtypes??[]),'Vampire'])]};if(own(g,p,{color:'W'}).some(c=>c.id!==src.id&&c.id!==t.id))meadowCounter(g,t,'lifelink',1,p);}break;
 case'ralDiscount':pl.mh3RalDiscountUntil=g.turn+(g.active===p?2:1);break;
 case'ralDraw':if(own(g,p,{color:'U'}).some(c=>c.id!==src.id))yield*mh3Draw(g,p,1);break;
 case'ralExile':for(const id of pl.library.slice(0,8)){const c=g.cards[id];moveCard(g,c,'exile');if(c.def.types.some(t=>t==='Instant'||t==='Sorcery'))c.eclCast={by:p,until:g.turn,free:true};}break;
 case'gristInsect':{const made=yield*token('tok-mh3-insect'),ids=pl.library.slice(0,2);for(const id of ids)moveCard(g,g.cards[id],'graveyard');if(ids.some(id=>g.cards[id].zone==='graveyard'&&colorsOf(g.cards[id].def).includes('B')))for(const c of made)meadowCounter(g,c,'deathtouch',1,p);break;}
 case'gristCopies':for(const id of pl.graveyard.slice())if(isCreature(g.cards[id])){const c=g.cards[id];yield*token({...copiableDefinition(c),power:1,toughness:1,colors:['B','G'],subtypes:['Insect']});}break;
 case'controlTemporary':if(t){t.returnControl={player:t.controller,turn:g.turn};t.controller=p;yield*run([{e:'untap',what:'T0'},{e:'pump',what:'T0',p:0,t:0,kw:['haste']}]);}break;
 default:throw Error('Unimplemented MH3 effect '+action);
 }
}
