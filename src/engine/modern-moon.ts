import { abilitiesSuppressed } from './state';
import type { Card, CardDef, GameState } from './types';
const refreshing = new WeakSet<GameState>();
// Land subtypes are replaced; unrelated creature/artifact subtypes are retained.
const landTypes = new Set('Cave Cloud Desert Forest Gate Island Lair Locus Mine Mountain Plains Planet Power-Plant Sphere Swamp Tower Town Urza’s Urza\'s'.split(' '));
const overlays = new WeakMap<CardDef, CardDef>();
export function modernRefresh(g: GameState, entering?: Card) {
  if (entering?.def.abilities?.some(a => a.kind === 'static' && a.frontier === 'modern:moon')) g.modernMoonActive = true;
  if (!g.modernMoonActive || refreshing.has(g)) return;
  refreshing.add(g);
  try {
    const cards = g.battlefield.map(id => g.cards[id]);
    if (entering && !cards.includes(entering)) cards.push(entering);
    const active = cards.some(c => c.def.abilities?.some(a => a.kind === 'static' && a.frontier === 'modern:moon') && !abilitiesSuppressed(g, c));
    for (const c of cards) {
      // Other type/copy effects may replace the underlying definition between refreshes.
      if (c.modernMoonBase && c.def !== overlays.get(c.modernMoonBase)) c.modernMoonBase = undefined;
      const base = c.modernMoonBase ?? c.def;
      if (active && base.types.includes('Land') && !base.supertypes?.includes('Basic')) {
        if (!c.modernMoonBase) c.modernMoonBase = base;
        let view = overlays.get(base);
        if (!view) {
          view = { ...base, subtypes: [...(base.subtypes ?? []).filter(t => !landTypes.has(t)), 'Mountain'], abilities: [], keywords: [], produces: ['R'], painMana: false, sacOnMana: false, filterMana: undefined, chosenColorMana: false, manaOnly: undefined, etbTapped: false, etbTappedUnless: undefined, shock: false, ecl: undefined, meadow: undefined, frontier: undefined, foundation: undefined, fin: undefined, msh: undefined, mkm: undefined, aura: undefined, equip: undefined, etbCounters: undefined };
          overlays.set(base, view);
        }
        c.def = view;
      } else if (c.modernMoonBase) { c.def = c.modernMoonBase; c.modernMoonBase = undefined; }
    }
    // Keep observing suppression while a Moon remains on the battlefield.
    g.modernMoonActive = cards.some(c => c.def.abilities?.some(a => a.kind === 'static' && a.frontier === 'modern:moon'));
  } finally { refreshing.delete(g); }
}
