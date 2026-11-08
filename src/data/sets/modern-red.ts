import catalog from './modern-red-catalog.json';
import { add, act, slug, ANY } from '../dsl';
import type { CardDef } from '../../engine/types';
export function completeModernRed() {
  for(const row of catalog) {
    const d={...row,id:slug(row.name),meadow:{modernBatch:true}} as CardDef;
    switch(row.name) {
      case "Chandra's Incinerator":
        d.keywords=['trample'];d.meadow!.modernRedIncinerator=true;
        d.abilities=[{kind:'trigger',on:'frontierEvent',frontierEvent:'modern:red:damage',targets:[{kind:'creatureOrPlaneswalker',filter:{ctrl:'opp'}}],effects:[{e:'frontier',action:'modern:red:incinerate'}]}];break;
      case 'Exquisite Firecraft':d.meadow!.modernRedMastery=true;d.spell={targets:[ANY],effects:[{e:'damage',n:4,to:'T0'}]};break;
      case 'Rift Bolt':d.meadow!.modernRedSuspend='{R}';d.spell={targets:[ANY],effects:[{e:'damage',n:3,to:'T0'}]};break;
      case 'Seal of Fire':d.abilities=[act({sacSelf:true},[{e:'damage',n:2,to:'T0'}],'犧牲：造成2傷害',{targets:[ANY]})];break;
      case "Grafdigger's Cage":d.abilities=[{kind:'static',frontier:'modern:red:cage'}];break;
      case 'Arena of Glory':
        d.produces=['R'];d.etbTappedUnless={c:'controls',filter:{type:'Land',sub:'Mountain'}};
        d.abilities=[act({tap:true},[{e:'addMana',mana:['R']}],'加紅',{manaAbility:true}),act({mana:'{R}',tap:true},[{e:'frontier',action:'modern:red:arena'}],'督戰：加兩點紅，花在生物上使其敏捷',{manaAbility:true,bdExert:true})];break;
    }
    add(d);
  }
}
