import type {CardDef,Color,Keyword} from '../../engine/types';
const t=(id:string,name:string,colors:Color[],p:number,n:number,sub:string[],keywords:Keyword[]=[],extra:Partial<CardDef>={}):CardDef=>({id:'tok-cp-'+id,name,set:'TOK',rarity:'T',token:true,types:['Creature'],subtypes:sub,colors,power:p,toughness:n,keywords,text:'',...extra});
export const CAMPUS_TOKENS:CardDef[]=[
 t('angel','Angel',['W'],4,4,['Angel'],['flying','vigilance']),
 t('gnome-star','Gnome Soldier',['W'],0,0,['Gnome','Soldier'],[],{types:['Artifact','Creature'],text:"This token's power and toughness are each equal to the number of artifacts and/or creatures you control.",abilities:[{kind:'static',frontier:'lci:gnomeBody'}]}),
 t('merfolk','Merfolk',['U'],1,1,['Merfolk'],['hexproof']),t('fungus','Fungus',['B'],1,1,['Fungus'],[],{text:"This token can't block.",abilities:[{kind:'static',self:{grant:{cantBlock:true}}}]}),
 t('skeleton','Skeleton Pirate',['B'],2,2,['Skeleton','Pirate']),t('vampire','Vampire',['W'],1,1,['Vampire'],['lifelink']),
 t('dino31','Dinosaur',['R'],3,1,['Dinosaur']),t('dino33','Dinosaur',['G'],3,3,['Dinosaur']),t('egg','Dinosaur Egg',['G'],0,1,['Dinosaur','Egg']),
 t('golem44','Golem',['W','U'],4,4,['Golem'],[],{types:['Artifact','Creature']}),t('spirit32','Spirit',['R','W'],3,2,['Spirit']),t('demon','Vampire Demon',['W','B'],4,3,['Vampire','Demon'],['flying']),
 t('spirit22','Spirit',['R','W'],2,2,['Spirit']),t('inkling','Inkling',['W','B'],1,1,['Inkling'],['flying']),
 t('pest','Pest',['B','G'],1,1,['Pest'],[],{text:'Whenever this token attacks, you gain 1 life.',abilities:[{kind:'trigger',on:'attacks',effects:[{e:'gain',n:1}]}]}),
 t('elemental','Elemental',['U','R'],3,3,['Elemental'],['flying']),t('fractal','Fractal',['G','U'],0,0,['Fractal']),
 {id:'tok-cp-dellian',name:'Professor Dellian Fel Emblem',set:'TOK',rarity:'T',token:true,types:['Emblem'],text:'Whenever you gain life, target opponent loses that much life.',abilities:[{kind:'trigger',on:'lifegain',effects:[{e:'lose',n:{ev:true},who:'T0'}],targets:[{kind:'opponent'}]}]},
];
