import { describe, it, expect } from 'vitest';
import { MODERN_AI_DECKS, aiDecksFor, isModernLegal, isModernBanned, isStandardLegal, deckSize, expandDeck, slug } from '../src/data';
import lists from '../src/data/modern-decklists.json';
import catalog from '../src/data/sets/modern-prowess-catalog.json';
import { runHeadless } from '../src/engine/controller';
import { getDef } from '../src/engine/registry';
import { checkDeck, newProfile, loadProfile, type SavedDeck } from '../src/meta/profile';
import { resolveDeck, buildCards, buyMissing } from '../src/meta/deckImport';
import { zhName, sourcedChineseName, publishedChineseName } from '../src/data/names';
import { traditionalRulesText } from '../src/data/localization';
import { buildOpponentDeck } from '../src/meta/oppDecks';

describe('Modern legality and exact source decks', () => {
  it('uses Modern legality rather than Standard legality', () => {
    expect(isStandardLegal(getDef('monstrous-rage'))).toBe(false);
    expect(isModernLegal(getDef('monstrous-rage'))).toBe(true);
    expect(isModernBanned({ name: 'Up the Beanstalk' })).toBe(true);
    expect(isModernLegal({ name: 'Up the Beanstalk' })).toBe(false);
    expect(isModernLegal({ name: 'Tactical Advantage' })).toBe(false);
    expect(isModernLegal({ name: 'Petty Theft' })).toBe(false);
    expect(isModernLegal(getDef('island'))).toBe(true);
    expect(aiDecksFor('modern')).toEqual(MODERN_AI_DECKS);
  });
  it.each(catalog)('$name has traceable Chinese names and rules and is Modern legal', row => {
    const c = getDef(slug(row.name));
    expect(isModernLegal(c)).toBe(true);
    for (const face of [c, c.adventure].filter(Boolean)) {
      expect(zhName(face!), row.name).toMatch(/\p{Script=Han}/u);
      expect(sourcedChineseName(face!) ?? publishedChineseName(face!)).toBeDefined();
      expect(traditionalRulesText(face!.text), row.name).toMatch(/\p{Script=Han}/u);
    }
  });
  it.each(lists)('$name imports exactly 60 + 15 original cards, buys both zones and validates', list => {
    const p = newProfile(); p.collection = {}; p.gold = 100000;
    const convert = (rows: (string | number)[][]) => rows.map(([n, name]) => ({ n: Number(n), name: String(name) }));
    const parsed = { main: convert(list.main), side: convert(list.side) };
    const main = resolveDeck(p, parsed, { substitute: false });
    const side = resolveDeck(p, { main: parsed.side, side: [] }, { substitute: false });
    const purchase = resolveDeck(p, { main: [...parsed.main, ...parsed.side], side: [] }, { substitute: false });
    const d: SavedDeck = { id: list.id, name: list.name, cards: buildCards(main, true), sideboard: buildCards(side, true), format: 'modern' };
    const ai = MODERN_AI_DECKS.find(d => d.id === list.id)!;
    expect(d.cards).toEqual(ai.cards); expect(d.sideboard).toEqual(ai.sideboard);
    expect(main.exact).toBe(60); expect(side.exact).toBe(15);
    expect(main.dropped + main.spellSubs + main.landSubs + side.dropped + side.spellSubs + side.landSubs).toBe(0);
    expect(deckSize(d)).toBe(60); expect(Object.values(d.sideboard!).reduce((a, b) => a + b, 0)).toBe(15);
    expect(checkDeck(p, d, 'modern').ok).toBe(false);
    expect(buyMissing(p, purchase)).toBe(true);
    expect(checkDeck(p, d, 'modern').errors).toEqual([]);
    const invalid = { ...d, sideboard: { ...d.sideboard, 'lightning-bolt': 4 } };
    expect(checkDeck(p, invalid, 'modern').ok).toBe(false);
    expect(checkDeck(p, { ...d, cards: { island: 59 }, sideboard: {} }, 'modern').ok).toBe(false);
  });
  it('generated opponents across every rank use legal Modern main decks of at least 60 cards', () => {
    let seed = 34; const rnd = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
    for (let tier = 0; tier < 6; tier++) for (let i = 0; i < 15; i++) {
      const { deck } = buildOpponentDeck('modern', tier, rnd);
      expect(deckSize(deck), deck.name).toBeGreaterThanOrEqual(60);
      for (const [id, n] of Object.entries(deck.cards)) {
        const c = getDef(id); expect(isModernLegal(c), c.name).toBe(true);
        if (!c.supertypes?.includes('Basic') && !c.anyNumber) expect(n, c.name).toBeLessThanOrEqual(4);
      }
    }
  });
  it('three original Modern main decks finish representative AI matches', () => {
    for (let i = 0; i < 3; i++) {
      const a = MODERN_AI_DECKS[i], b = MODERN_AI_DECKS[(i + 1) % 3];
      const g = runHeadless({ name: 'A', deckName: a.name, deck: expandDeck(a), isAI: true }, { name: 'B', deckName: b.name, deck: expandDeck(b), isAI: true }, ['normal', 'normal'], 800 + i, ['tempo', 'tempo']);
      expect(g.winner).not.toBeNull();
    }
  });
  it('migrates an old profile with no Modern ladder while preserving collection, decks and rank', () => {
    const p = newProfile(); const stored = { ...p, gold: 12345, ladder: { standard: { ...p.ladder.standard, points: 31 }, free: p.ladder.free, history: [] } };
    const data = new Map([['mtg-duel-arena-profile-v1', JSON.stringify(stored)]]);
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); } };
    const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
    try { const loaded = loadProfile(); expect(loaded.gold).toBe(12345); expect(loaded.collection).toEqual(p.collection); expect(loaded.decks).toEqual(p.decks); expect(loaded.ladder.standard.points).toBe(31); expect(loaded.ladder.modern.points).toBe(0); }
    finally { if (old) Object.defineProperty(globalThis, 'localStorage', old); else Reflect.deleteProperty(globalThis, 'localStorage'); }
  });
});
