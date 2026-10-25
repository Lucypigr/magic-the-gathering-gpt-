import type {CardDef,Color,Keyword} from '../../engine/types';
const t=(id:string,name:string,colors:Color[],p:number,n:number,sub:string[],keywords:Keyword[]=[],extra:Partial<CardDef>={}):CardDef=>({id:'tok-bd-'+id,name,set:'TOK',rarity:'T',token:true,types:['Creature'],subtypes:sub,colors,power:p,toughness:n,keywords,text:'',...extra});
export const MEADOW_TOKENS:CardDef[]=[
 t('wall','Wall',['W'],0,4,['Wall'],['defender']),t('rat','Rat',['B'],1,1,['Rat'],[],{text:'This token gets +1/+1 for each other Rat you control.',abilities:[{kind:'static',frontier:'blb:ratToken'}]}),
 t('snail','Snail',['B'],1,1,['Snail']),t('otter','Otter',['U','R'],1,1,['Otter'],['prowess']),t('bat','Bat',['B'],1,1,['Bat'],['flying']),t('squirrel','Squirrel',['G'],1,1,['Squirrel']),
 t('pilot','Pilot',[],1,1,['Pilot'],[],{text:'This token saddles Mounts and crews Vehicles as though its power were 2 greater.',meadow:{crewPower:2}}),
 t('cat','Cat',['W'],1,1,['Cat'],['lifelink']),t('dragon','Dinosaur Dragon',['R'],4,4,['Dinosaur','Dragon'],['flying']),t('insect','Insect',['G'],1,1,['Insect']),
 t('vehicle','Vehicle',[],3,2,['Vehicle'],[],{types:['Artifact'],abilities:[{kind:'activated',cost:{crew:1},effects:[{e:'animate',what:'self',p:3,t:2}],label:'搭載1'}]}),
 {id:'tok-bd-sword',name:'Sword',set:'TOK',rarity:'T',token:true,types:['Artifact'],subtypes:['Equipment'],text:'Equipped creature gets +1/+1.\nEquip {2}',equip:{cost:'{2}',grant:{p:1,t:1}}},
 {id:'tok-bd-cragflame',name:'Cragflame',set:'TOK',rarity:'T',token:true,supertypes:['Legendary'],types:['Artifact'],subtypes:['Equipment'],text:'Equipped creature gets +1/+1 and has vigilance, trample, and haste.\nEquip {2}',equip:{cost:'{2}',grant:{p:1,t:1,kw:['vigilance','trample','haste']}}},
 {id:'tok-bd-ral',name:'Ral, Crackling Wit Emblem',set:'TOK',rarity:'T',token:true,types:['Emblem'],text:'Instant and sorcery spells you cast have storm.',abilities:[{kind:'static',frontier:'blb:storm'}]},
 {id:'tok-bd-chandra',name:'Chandra, Spark Hunter Emblem',set:'TOK',rarity:'T',token:true,types:['Emblem'],text:'Whenever an artifact you control enters, this emblem deals 3 damage to any target.',abilities:[{kind:'trigger',on:'allyPermEtb',filter:{type:'Artifact'},effects:[{e:'damage',n:3,to:'T0'}],targets:[{kind:'any'}]}]},
];
