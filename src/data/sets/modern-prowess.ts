import catalog from './modern-prowess-catalog.json';
import { add, act, etb, trig, slug, ANY, CR } from '../dsl';
import type { CardDef, Effect } from '../../engine/types';
const E = (action: string): Effect => ({ e: 'frontier', action: 'modern:' + action });
const delirium = { c: 'frontier' as const, action: 'modern:delirium' };
export function completeModernProwess() {
  for (const row of catalog) {
    const d = { ...row, id: slug(row.name), meadow: { modernBatch: true } } as CardDef;
    const spell = (effects: Effect[], targets = [ANY]) => { d.spell = { effects, targets }; };
    switch (row.name) {
      case 'Lightning Bolt': spell([{ e: 'damage', n: 3, to: 'T0' }]); break;
      case 'Lava Dart':
        spell([{ e: 'damage', n: 1, to: 'T0' }]); d.flashback = '{0}'; d.flashbackAddCost = { sac: { type: 'Land', sub: 'Mountain' } }; break;
      case 'Unholy Heat': spell([{ e: 'if', cond: delirium, then: [{ e: 'damage', n: 6, to: 'T0' }], else: [{ e: 'damage', n: 2, to: 'T0' }] }], [{ kind: 'creatureOrPlaneswalker' }]); break;
      case 'Assault Strobe': spell([{ e: 'pump', what: 'T0', p: 0, t: 0, kw: ['double_strike'] }], [CR]); break;
      case 'Mutagenic Growth': spell([{ e: 'pump', what: 'T0', p: 2, t: 2 }], [CR]); d.meadow!.modernPhyrexian = true; break;
      case 'Preordain': spell([{ e: 'scry', n: 2 }, { e: 'draw', n: 1 }], []); break;
      case 'Expressive Iteration': spell([E('iteration')], []); break;
      case 'Meltdown': spell([E('meltdown')], []); break;
      case 'Prismatic Ending': spell([E('ending')], [{ kind: 'permanent', filter: { nonType: 'Land' } }]); break;
      case 'Mishra\'s Bauble': d.abilities = [act({ tap: true, sacSelf: true }, [E('bauble')], '檢視牌庫頂，下回合抓牌', { targets: [{ kind: 'player' }] })]; break;
      case 'Tormod\'s Crypt': d.abilities = [act({ tap: true, sacSelf: true }, [E('crypt')], '放逐目標玩家的墳墓場', { targets: [{ kind: 'player' }] })]; break;
      case 'Dragon\'s Rage Channeler': d.abilities = [trig('castNoncreature', [{ e: 'surveil', n: 1 }]), { kind: 'static', frontier: 'modern:channeler' }]; break;
      case 'Murktide Regent':
        d.keywords = ['flying']; d.meadow!.modernDelve = true;
        d.abilities = [{ kind: 'trigger', on: 'frontierEvent', frontierEvent: 'modern:graveSpellLeaves', effects: [{ e: 'counters', what: 'self', n: 1 }] }]; break;
      case 'Obsidian Charmaw':
        d.keywords = ['flying']; d.meadow!.modernCharmaw = true;
        d.abilities = [etb([{ e: 'destroy', what: 'T0' }], { targets: [{ kind: 'permanent', filter: { type: 'Land', basic: false, ctrl: 'opp' } }] })]; break;
      case 'Brazen Borrower': {
        d.keywords = ['flash', 'flying']; d.abilities = [{ kind: 'static', frontier: 'modern:blockFlyingOnly' }];
        const a = (row as any).adventure;
        d.adventure = { ...a, spell: { targets: [{ kind: 'permanent', filter: { nonType: 'Land', ctrl: 'opp' } }], effects: [{ e: 'bounce', what: 'T0' }] } }; break;
      }
      case 'Consign to Memory': d.frontierStack = 'modernConsign'; d.meadow!.modernReplicate = 1; spell([E('counter')], []); break;
      case 'Fiery Islet':
        d.produces = ['U', 'R']; d.painMana = true;
        d.abilities = [act({ tap: true, life: 1 }, [{ e: 'addMana', mana: ['U'] }], '支付1生命：加藍', { manaAbility: true }), act({ tap: true, life: 1 }, [{ e: 'addMana', mana: ['R'] }], '支付1生命：加紅', { manaAbility: true }), act({ mana: '{1}', tap: true, sacSelf: true }, [{ e: 'draw', n: 1 }], '犧牲：抓一張牌')]; break;
      default: {
        const types: Record<string, string[]> = { 'Arid Mesa': ['Mountain', 'Plains'], 'Bloodstained Mire': ['Swamp', 'Mountain'], 'Scalding Tarn': ['Island', 'Mountain'], 'Wooded Foothills': ['Mountain', 'Forest'] };
        if (!types[row.name]) throw Error('Missing Modern definition: ' + row.name);
        d.abilities = [act({ tap: true, life: 1, sacSelf: true }, [{ e: 'tutor', filter: { type: 'Land', sub: types[row.name] }, to: 'battlefield' }], '支付1生命並犧牲：搜尋地')];
      }
    }
    add(d);
  }
}
