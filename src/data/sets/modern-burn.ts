import catalog from './modern-burn-catalog.json';
import { add, act, trig, slug, ANY, CR } from '../dsl';
import type { CardDef, Effect, TargetSpec } from '../../engine/types';
const E = (name: string): Effect => ({ e: 'frontier', action: 'modern:burn:' + name });
const playerOrWalker: TargetSpec = { kind: 'any', filter: { type: 'Planeswalker' } };
export function completeModernBurn() {
  for (const row of catalog) {
    const d = { ...row, id: slug(row.name), meadow: { modernBatch: true } } as CardDef;
    switch (row.name) {
      case 'Goblin Guide': d.keywords = ['haste']; d.abilities = [trig('attacks', [E('guide')])]; break;
      case 'Eidolon of the Great Revel': d.abilities = [{ kind: 'trigger', on: 'frontierEvent', frontierEvent: 'modern:burn:eidolon', effects: [E('eidolon')] }]; break;
      case 'Roiling Vortex': d.abilities = [trig('eachUpkeep', [E('upkeep')]), { kind: 'trigger', on: 'frontierEvent', frontierEvent: 'modern:burn:vortex', effects: [E('vortex')] }, act({ mana: '{R}' }, [E('noGain')], '本回合對手不能獲得生命')]; break;
      case 'Lava Spike': d.spell = { targets: [playerOrWalker], effects: [{ e: 'damage', n: 3, to: 'T0' }] }; break;
      case 'Skullcrack': d.spell = { targets: [playerOrWalker], effects: [E('skullcrack'), { e: 'damage', n: 3, to: 'T0' }] }; break;
      case 'Skewer the Critics': d.meadow!.modernSpectacle = '{R}'; d.spell = { targets: [ANY], effects: [{ e: 'damage', n: 3, to: 'T0' }] }; break;
      case 'Smash to Smithereens': d.spell = { targets: [{ kind: 'permanent', filter: { type: 'Artifact' } }], effects: [E('smash')] }; break;
      case 'Searing Blood': d.spell = { targets: [CR], effects: [E('blood')] }; break;
      case 'Searing Blaze': d.spell = { targets: [playerOrWalker, { kind: 'creature', sameControllerAs: 0 }], effects: [E('blaze')] }; break;
      case 'Deflecting Palm': d.spell = { effects: [E('palm')] }; break;
      case 'Sunbaked Canyon':
        d.produces = ['R', 'W']; d.painMana = true;
        d.abilities = [act({ tap: true, life: 1 }, [{ e: 'addMana', mana: ['R'] }], '支付1生命：加紅', { manaAbility: true }), act({ tap: true, life: 1 }, [{ e: 'addMana', mana: ['W'] }], '支付1生命：加白', { manaAbility: true }), act({ mana: '{1}', tap: true, sacSelf: true }, [{ e: 'draw', n: 1 }], '犧牲：抓一張牌')]; break;
      case 'Barbarian Ring':
        d.produces = ['R']; d.meadow!.modernBarbarianMana = true;
        d.abilities = [act({ tap: true }, [{ e: 'addMana', mana: ['R'] }, { e: 'damage', n: 1, to: 'you' }], '加紅並對你造成1傷害', { manaAbility: true }), act({ mana: '{R}', tap: true, sacSelf: true }, [{ e: 'damage', n: 2, to: 'T0' }], '門檻：犧牲，造成2傷害', { targets: [ANY], cond: { c: 'gyCount', filter: {}, n: 7 } })]; break;
    }
    add(d);
  }
}
