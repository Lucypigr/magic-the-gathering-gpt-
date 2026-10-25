import {expect,it} from 'vitest';
import {abilitiesFor,performAction} from '../src/engine/actions';
import {moveCard} from '../src/engine/zones';
import {mk,put,inHand,lands,resolve,settleAll} from './helpers';
it('Tidebinder chooses an ability on trigger placement and disables only its original battlefield source',()=>{
 const g=mk(),guard=put(g,0,'adaptive-gemguard'),food=put(g,0,'tok-food'),treasure=put(g,0,'tok-treasure');
 expect(performAction(g,0,{type:'activate',card:guard.id,ability:0,tapCards:[food.id,treasure.id],targets:[]})).toBeNull();
 const binder=inHand(g,0,'tishanas-tidebinder');lands(g,0,'island',3);expect(performAction(g,0,{type:'cast',card:binder.id,targets:[]})).toBeNull();resolve(g);
 settleAll(g,d=>d.type==='mode'&&d.prompt.includes('反擊異能')?{type:'modes',picks:[1]}:undefined);
 expect(guard.counters).toBe(0);expect(abilitiesFor(g,guard)).toHaveLength(0);moveCard(g,binder,'hand');expect(abilitiesFor(g,guard).length).toBeGreaterThan(0);
});

it('strictly converted craft abilities also return after the source is exiled as a cost',()=>{
 const g=mk(),landmark=put(g,0,'oteclan-landmark'),bow=put(g,0,'short-bow');lands(g,0,'plains',4);
 const ability=abilitiesFor(g,landmark).findIndex(a=>!!a.cost.craft);expect(performAction(g,0,{type:'activate',card:landmark.id,ability,costCards:[bow.id],targets:[]})).toBeNull();
 expect(landmark.zone).toBe('exile');resolve(g);expect(landmark.zone).toBe('battlefield');expect(landmark.def.name).toBe('Oteclan Levitator');
});
