import type {Ability,ActivatedAbility,CardDef,Cond,Effect,Filter,Grant,Mode,Ref,TargetSpec,TriggeredAbility} from '../../engine/types';
import {act} from '../dsl';
export function patchBuilder(auto:object={}){
 const patches=new Map<number,Partial<CardDef>>(Object.entries(auto).map(([n,p])=>[Number(n),p]));
 const d=(n:number,p:Partial<CardDef>)=>patches.set(n,{...patches.get(n),...p});
 const a=(n:number,abilities:Ability[])=>d(n,{abilities});
 const s=(n:number,effects:Effect[],targets?:TargetSpec[])=>d(n,{spell:{effects,targets}});
 const modes=(n:number,modes:Mode[])=>d(n,{spell:{modes}});
 return {patches,d,a,s,modes};
}
export type PatchBuilder=ReturnType<typeof patchBuilder>;
export const target=(kind:TargetSpec['kind']='creature',filter:Filter={},optional=false):TargetSpec=>({kind,filter,optional});
export const every=(filter:Filter={}):Ref=>({all:filter});
export const anthem=(filter:Filter,grant:Grant,condition?:Cond):Ability=>({kind:'static',anthem:{filter,grant},condition});
export const self=(grant:Grant,cond?:Cond):Ability=>({kind:'static',self:{grant,cond}});
export const level=(n:number):Cond=>({c:'classLevel',n});
export const upgrade=(from:number,mana:string):ActivatedAbility=>act({mana},[{e:'tmt',action:'level',n:from+1}],`升至等級${from+1}`,{sorcery:true,levelUp:{from,to:from+1}});
export function meadowDsl(code:'blb'|'dft',b:PatchBuilder){
 const E=(key:string|number,what:Ref='T0',n?:number):Effect=>({e:'frontier',action:code+':'+key,what,n});
 const C=(key:string):Cond=>({c:'frontier',action:code+':'+key});
 const N=(key:string)=>({frontier:code+':'+key});
 const F=(key:string):Ability=>({kind:'static',frontier:code+':'+key});
 const event=(key:string,effects:Effect[],extra:Partial<TriggeredAbility>={}):TriggeredAbility=>({kind:'trigger',on:'frontierEvent',frontierEvent:code+':'+key,effects,...extra});
 const gift=(n:number,normal:Effect[],promised:Effect[],targets?:TargetSpec[],giftTargets=targets)=>b.modes(n,[{text:'不承諾贈禮',effects:normal,targets},{text:'承諾贈禮',effects:[E('gift'),...promised],targets:giftTargets}]);
 const season=(n:number,parts:Mode[])=>{
  const modes:Mode[]=[];
  const shift=(v:any,o:number):any=>typeof v==='string'&&/^T\d+(?:ctrl)?$/.test(v)?v.replace(/^T(\d+)/,(_,i)=>'T'+(Number(i)+o)):Array.isArray(v)?v.map(x=>shift(x,o)):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,shift(x,o)])):v;
  for(let a=0;a<=5;a++)for(let b=0;b<=2;b++)for(let c=0;c<=1;c++)if(a+2*b+3*c<=5){const effects:Effect[]=[],targets:TargetSpec[]=[];const counts=[a,b,c];for(let i=0;i<3;i++)for(let j=0;j<counts[i];j++){effects.push(...shift(parts[i].effects,targets.length));targets.push(...(parts[i].targets??[]));}modes.push({text:counts.map((k,i)=>k?`${parts[i].text} ×${k}`:'').filter(Boolean).join('；')||'不選模式',effects,targets});}b.modes(n,modes);
 };
 return {...b,E,C,N,F,event,gift,season};
}
