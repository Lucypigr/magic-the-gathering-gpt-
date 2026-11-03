import catalog from './modern-murktide-catalog.json';
import { add, act, etb, trig, slug } from '../dsl';
import type { CardDef, Effect, TargetSpec } from '../../engine/types';
const E = (name: string): Effect => ({ e: 'frontier', action: 'modern:' + name });
const spell: TargetSpec = { kind: 'spell' };
export function completeModernMurktide() {
  for (const row of catalog) {
    const d = { ...row, id: slug(row.name), meadow: { modernBatch: true } } as CardDef;
    switch (row.name) {
      case 'Blood Moon': d.abilities = [{ kind: 'static', frontier: 'modern:moon' }]; break;
      case 'Counterspell': d.spell = { targets: [spell], effects: [{ e: 'counter', what: 'T0' }] }; break;
      case 'Mystical Dispute': d.meadow!.modernDispute = true; d.spell = { targets: [spell], effects: [{ e: 'counterUnless', what: 'T0', pay: 3 }] }; break;
      case 'Stern Scolding': d.spell = { targets: [{ kind: 'spell', filter: { type: 'Creature', or: [{ powMax: 2 }, { toughMax: 2 }] } }], effects: [{ e: 'counter', what: 'T0' }] }; break;
      case 'Force of Negation': d.meadow!.modernPitch = true; d.spell = { targets: [{ kind: 'spell', filter: { nonType: 'Creature' } }], effects: [E('force')] }; break;
      case 'Subtlety':
        d.keywords = ['flash', 'flying']; d.evoke = '{0}'; d.meadow!.modernPitch = true;
        d.abilities = [etb([E('subtlety')], { targets: [{ kind: 'spell', filter: { type: ['Creature', 'Planeswalker'] }, optional: true }] })]; break;
      case 'Surgical Extraction': d.meadow!.modernPhyrexian = true; d.meadow!.modernPhyrexianColor = 'B'; d.spell = { targets: [{ kind: 'gyCard', filter: { basic: false } }], effects: [E('surgical')] }; break;
      case 'Test of Talents': d.spell = { targets: [{ kind: 'spell', filter: { type: ['Instant', 'Sorcery'] } }], effects: [E('talents')] }; break;
      case 'Ragavan, Nimble Pilferer': d.meadow!.modernDash = '{1}{R}'; d.abilities = [trig('combatDamagePlayer', [E('ragavan')])]; break;
      default: {
        const sub = row.name === 'Misty Rainforest' ? ['Forest', 'Island'] : ['Island', 'Swamp'];
        d.abilities = [act({ tap: true, life: 1, sacSelf: true }, [{ e: 'tutor', filter: { type: 'Land', sub }, to: 'battlefield' }], '支付1生命並犧牲：搜尋地')];
      }
    }
    add(d);
  }
}
