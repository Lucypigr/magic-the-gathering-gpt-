import {abilitiesOf,isCreature,matches,stats} from './state';
import {campusCaves,campusDescent} from './campus-support';
import {frontierFlags,frontierStatic} from './frontier-support';
import {parseCost,reduceCost,type ManaCost} from './mana';
import type {ActivatedAbility,Card,CardDef,CastAlt,GameState,PID,TargetRef,TargetSpec} from './types';
export function campusPermission(g:GameState,p:PID,c:Card){
 if(c.zone==='graveyard'&&c.owner===p){if(c.frontierMarks?.cpGravePlay===g.turn)return true;if(isCreature(c)&&frontierFlags(g,p).cpTomb)return true;}
 if(c.zone==='library'&&c.owner===p&&g.players[p].library[0]===c.id&&frontierFlags(g,p).cpTopPlay)return true;
 if(c.zone==='exile'&&c.owner===p&&isCreature(c)&&c.def.subtypes?.includes('Dinosaur'))return frontierStatic(g,p,'lci:paleontologist').some(s=>s.campusLinked?.some(x=>x.id===c.id&&x.version===c.objectVersion));
 return false;
}
export function campusFree(g:GameState,p:PID,c:Card){return c.zone==='hand'&&c.owner===p&&g.active===p&&c.def.types.some(t=>t==='Instant'||t==='Sorcery')&&!frontierFlags(g,p).cpFreeUsed&&!!frontierStatic(g,p,'sos:freeSpellTurn').length;}
export function campusExtraCosts(g:GameState,p:PID,c:Card,alt?:CastAlt){
 if(alt==='campusCasualty')return{kind:'sac'as const,n:1,ids:g.battlefield.filter(id=>g.cards[id].controller===p&&isCreature(g.cards[id])&&stats(g,g.cards[id]).p>=1)};
 if(c.def.meadow?.campusTapCast)return{kind:'tap'as const,n:Number(c.def.meadow.campusTapCast),ids:g.battlefield.filter(id=>g.cards[id].controller===p&&!g.cards[id].tapped&&g.cards[id].def.types.some(t=>t==='Artifact'||t==='Creature'||t==='Land'))};
 if(c.def.meadow?.campusFlashbackTap&&alt==='flashback')return{kind:'tap'as const,n:Number(c.def.meadow.campusFlashbackTap),ids:g.battlefield.filter(id=>g.cards[id].controller===p&&!g.cards[id].tapped&&isCreature(g.cards[id]))};
 if(c.def.meadow?.campusExileOrPay&&alt==='campusExile')return{kind:'exile'as const,n:Number(c.def.meadow.campusExileOrPay),ids:g.players[p].graveyard.filter(id=>id!==c.id)};
}
export function campusCost(g:GameState,p:PID,c:Card,def:CardDef,cost:ManaCost,targets:(TargetRef|null)[]|undefined,alt?:CastAlt){
 if(c.frontierMarks?.cpAnyMana===g.turn){cost.generic+=cost.W+cost.U+cost.B+cost.R+cost.G+cost.C+(cost.hyb?.length??0)+(cost.twoHyb?.length??0);cost.W=cost.U=cost.B=cost.R=cost.G=cost.C=0;cost.hyb=[];cost.twoHyb=[];}
 const meta=def.meadow;if(meta?.campusExileOrPay&&alt!=='campusExile'){cost.generic++;cost.W++;}
 if(meta?.campusCaveDiscount)cost.generic=Math.max(0,cost.generic-campusCaves(g,p));
 if(meta?.campusPowerDiscount)cost.generic=Math.max(0,cost.generic-Math.max(0,...g.battlefield.filter(id=>g.cards[id].controller===p&&isCreature(g.cards[id])).map(id=>stats(g,g.cards[id]).p)));
 if(meta?.campusToughnessDiscount&&g.battlefield.filter(id=>g.cards[id].controller===p&&isCreature(g.cards[id])).reduce((n,id)=>n+stats(g,g.cards[id]).t,0)>=10)cost.generic=Math.max(0,cost.generic-Number(meta.campusToughnessDiscount));
 if(def.types.some(t=>t==='Instant'||t==='Sorcery')&&frontierStatic(g,p,'sos:affinitySpells').length)cost.generic=Math.max(0,cost.generic-g.battlefield.filter(id=>g.cards[id].controller===p&&isCreature(g.cards[id])).length);
 const target=targets?.find(t=>t&&'c'in t),tc=target&&'c'in target?g.cards[target.c]:undefined,discount=meta?.campusTargetDiscount;
 if(tc&&discount){const ok=discount==='tapped3'?tc.tapped:discount==='attacking1'?tc.attacking:discount==='creatureSpell2'?tc.zone==='stack'&&isCreature(tc):tc.def.types.some(t=>t==='Instant'||t==='Sorcery');if(ok){if(discount==='instantSorcery1U')Object.assign(cost,reduceCost(cost,parseCost('{1}{U}')));else cost.generic=Math.max(0,cost.generic-(discount==='tapped3'?3:discount==='attacking1'?1:2));}}
}
export function campusTargets(g:GameState,p:PID,c:Card,def:CardDef,specs:TargetSpec[],count?:number){
 if(def.meadow?.campusTargetDescent)return specs.map(s=>({...s,filter:{...s.filter,mvMax:campusDescent(g,p)}}));
 const variable=def.meadow?.campusVariable;if(variable==='ownCreatures')return Array.from({length:count??0},(_,i)=>({kind:'creature'as const,filter:{ctrl:'you'as const},...(i?{differentFrom:i-1}:{})}));
 if(variable==='graveSpellsX')return Array.from({length:count??0},(_,i)=>({kind:'gyCard'as const,filter:{ctrl:'you'as const,type:['Instant','Sorcery']as import('./types').CardType[]},...(i?{differentFrom:i-1}:{})}));
 return specs;
}
export function campusCraftOptions(g:GameState,p:PID,c:Card,ab:ActivatedAbility){return[...g.players[p].graveyard,...g.battlefield.filter(id=>g.cards[id].controller===p)].filter(id=>id!==c.id&&matches(g,ab.cost.craft,g.cards[id],p)&&(!c.def.meadow?.craftActivated||(abilitiesOf(g,g.cards[id]).some(a=>a.kind==='activated')||!!g.cards[id].def.equip||!!g.cards[id].def.produces?.length)));}
export function campusCraftValid(g:GameState,p:PID,c:Card,ab:ActivatedAbility,ids:number[]){
 const opts=campusCraftOptions(g,p,c,ab);if(new Set(ids).size!==ids.length||ids.some(id=>!opts.includes(id))||ids.length<(ab.cost.craftCount??1)||!c.def.meadow?.craftAny&&ids.length!==(ab.cost.craftCount??1))return false;
 if(c.def.meadow?.craftTribes){const tribes=['Dinosaur','Merfolk','Pirate','Vampire'];const match=(i:number,used:number[]):boolean=>i===4||ids.some(id=>!used.includes(id)&&g.cards[id].def.subtypes?.includes(tribes[i])&&match(i+1,[...used,id]));return match(0,[]);}return true;
}
export function campusActivationBlocked(g:GameState,c:Card,ab:ActivatedAbility){
 if(ab.isEquip&&isCreature(c))return true;
 if(c.frontierMarks?.cpLockedTapped&&c.tapped)return true;
 if(ab.campusEquipmentSac!==undefined&&g.cards[ab.campusEquipmentSac]?.zone!=='battlefield')return true;
 const mana=ab.manaAbility||!ab.targets?.length&&ab.cost.loyalty===undefined&&ab.effects.every(e=>e.e==='addMana'||e.e==='addManaOfChoice');
 if(!mana&&g.battlefield.some(id=>{const s=g.cards[id];return abilitiesOf(g,s).some(a=>a.kind==='static'&&(a.frontier==='lci:spyglass'||a.frontier==='sos:hamlet'))&&s.foundationNamed===c.def.name;}))return true;
 if(g.battlefield.some(id=>g.cards[id].attachedTo===c.id&&abilitiesOf(g,g.cards[id]).some(a=>a.kind==='static'&&a.frontier==='lci:disableAttached')))return true;
 return false;
}
export function campusCastBlocked(g:GameState,p:PID){
 if(g.active!==p&&frontierStatic(g,g.active,'lci:noOpponentCastOwnTurn').length)return true;
 if(g.active===p&&frontierFlags(g,p).cpAttackers&&frontierStatic(g,(1-p)as PID,'lci:wanderglyph').length)return true;return false;
}
