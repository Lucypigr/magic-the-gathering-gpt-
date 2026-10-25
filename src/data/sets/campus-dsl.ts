import {setBuilder} from './frontier-dsl';
import type {Ability,Amt,CardDef,Effect,TargetSpec,TriggeredAbility} from '../../engine/types';
export function campusBuilder(code:'LCI'|'SOS',catalog:any[],auto:object){
 const b=setBuilder(code,catalog,auto),prefix=code.toLowerCase()+':';
 const E=(key:string|number,what:import('../../engine/types').Ref='T0',n?:number):Effect=>({e:'frontier',action:prefix+key,what,n});
 const C=(key:string)=>({c:'frontier' as const,action:prefix+key});
 const N=(key:string):Amt=>({frontier:prefix+key});
 const F=(key:string):Ability=>({kind:'static',frontier:prefix+key});
 const event=(key:string,effects:Effect[],extra:Partial<TriggeredAbility>={}):TriggeredAbility=>({kind:'trigger',on:'frontierEvent',frontierEvent:prefix+key,effects,...extra});
 const face=(n:number,key:'back'|'prepare'|'adventure',patch:any)=>b.d(n,{[key]:{...catalog.find(c=>c.number===n)[key],...patch}} as Partial<CardDef>);
 return {...b,E,C,N,F,event,back:(n:number,patch:any)=>face(n,'back',patch),prep:(n:number,effects:Effect[],targets?:TargetSpec[])=>face(n,'prepare',{spell:{effects,targets}}),adv:(n:number,effects:Effect[],targets?:TargetSpec[])=>face(n,'adventure',{spell:{effects,targets}})};
}
