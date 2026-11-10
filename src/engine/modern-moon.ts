import{mh3Refresh}from'./mh3';
import { abilitiesSuppressed } from './state';
import type { Card, CardDef, GameState } from './types';
const refreshing = new WeakSet<GameState>();
// Land subtypes are replaced; unrelated creature/artifact subtypes are retained.
const landTypes = new Set('Cave Cloud Desert Forest Gate Island Lair Locus Mine Mountain Plains Planet Power-Plant Sphere Swamp Tower Town Urza’s Urza\'s'.split(' '));
const overlays = new WeakMap<CardDef, CardDef>();
const islandOverlays=new WeakMap<CardDef,CardDef>();
const isMoon=(c:Card)=>c.def.abilities?.some(a=>a.kind==='static'&&(a.frontier==='modern:moon'||a.frontier==='modern:mh3:islands'));
export function modernRefresh(g: GameState, entering?: Card) {
  mh3Refresh(g,entering);
  if (entering&&isMoon(entering)) g.modernMoonActive = true;
  if (!g.modernMoonActive || refreshing.has(g)) return;
  refreshing.add(g);
  try {
    const cards = g.battlefield.map(id => g.cards[id]);
    if (entering && !cards.includes(entering)) cards.push(entering);
    const sources=cards.filter(c=>isMoon(c)&&!abilitiesSuppressed(g,c));const active=sources.length>0;const island=!!sources.at(-1)?.def.abilities?.some(a=>a.kind==='static'&&a.frontier==='modern:mh3:islands');const cache=island?islandOverlays:overlays;
    for (const c of cards) {
      // Other type/copy effects may replace the underlying definition between refreshes.
      if (c.modernMoonBase && c.def !== overlays.get(c.modernMoonBase)&&c.def!==islandOverlays.get(c.modernMoonBase)) c.modernMoonBase = undefined;
      const base = c.modernMoonBase ?? c.def;
      if (active && base.types.includes('Land') && !base.supertypes?.includes('Basic')) {
        if (!c.modernMoonBase) c.modernMoonBase = base;
        let view = cache.get(base);
        if (!view) {
          view = { ...base, subtypes: [...(base.subtypes ?? []).filter(t => !landTypes.has(t)), island?'Island':'Mountain'], abilities: [], keywords: [], produces: [island?'U':'R'], painMana: false, sacOnMana: false, filterMana: undefined, chosenColorMana: false, manaOnly: undefined, etbTapped: false, etbTappedUnless: undefined, shock: false, ecl: undefined, meadow: undefined, frontier: undefined, foundation: undefined, fin: undefined, msh: undefined, mkm: undefined, aura: undefined, equip: undefined, etbCounters: undefined };
          cache.set(base, view);
        }
        c.def = view;
      } else if (c.modernMoonBase) { c.def = c.modernMoonBase; c.modernMoonBase = undefined; }
    }
    // Keep observing suppression while a Moon remains on the battlefield.
    g.modernMoonActive = cards.some(c=>isMoon(c));
  } finally { refreshing.delete(g); }
}
