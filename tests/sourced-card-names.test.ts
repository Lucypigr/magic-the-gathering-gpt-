import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARDS, TOKENS } from '../src/data';
import { displayName, publishedChineseName, sourcedChineseName, setCardLanguage } from '../src/data/names';
import entries from '../src/data/localization/zh-sourced-names.json';
import overrides from '../src/data/localization/zh-token-name-overrides.json';
import manifest from '../scripts/localization/mtgzh-name-source.json';
import netdecks from '../public/netdecks.json';
import { CardDetail, ImagesEnabled } from '../src/ui/CardView';
import { matchFilter } from '../src/ui/DeckBuilder';
import { ModeModal } from '../src/ui/battle/Modals';
import type { CardDef, GameState } from '../src/engine/types';

vi.mock('../src/ui/images', async original => ({
  ...(await original<typeof import('../src/ui/images')>()),
  useImageVersion: () => 0,
}));
afterEach(() => setCardLanguage(false));

describe('full pool Chinese name source matching', () => {
  it('covers every card, token, back, Adventure, Room and copy face without rewriting English identities', () => {
    setCardLanguage(true);
    const visit = (c: CardDef) => {
      const original = { name: c.name, text: c.text };
      expect(publishedChineseName(c) ?? sourcedChineseName(c), `${c.id}: ${c.name}`).toBeTruthy();
      expect(displayName(c), c.name).toMatch(/[\u3400-\u9fff]/);
      expect({ name: c.name, text: c.text }).toEqual(original);
      if (c.back) visit(c.back);
      if (c.copyFront) visit(c.copyFront);
      const face = (f: { name: string; text: string }) => visit({ ...c, ...f, back: undefined, copyFront: undefined, adventure: undefined, room: undefined });
      if (c.adventure) face(c.adventure);
      if (c.room) { face(c.room.left); face(c.room.right); }
    };
    for (const c of [...CARDS, ...TOKENS]) visit(c);
  });

  it('resolves the pictured new names, Chinese search and both Room doors', () => {
    setCardLanguage(true);
    expect(displayName({ name: 'Dream Beavers' })).toBe('侵夢海狸');
    expect(displayName({ name: 'Enduring Curiosity' })).toBe('永續好奇體');
    expect(displayName({ name: 'Kaito, Bane of Nightmares' })).toBe('夢魘剋星魁渡');
    expect(displayName({ name: 'Academic Ascent' })).toBe('學業飛昇');
    expect(displayName({ name: "Dollmaker's Shop // Porcelain Gallery" })).toBe('人偶工房 // 瓷作展室');
    const card = CARDS.find(c => c.name === 'Dream Beavers')!;
    expect(matchFilter(card, { q: '侵夢海狸', color: '', type: '', set: '', rarity: '' })).toBe(true);
    setCardLanguage(false);
    expect(displayName(card)).toBe('Dream Beavers');
  });

  it('distinguishes two Chandra emblems sharing one internal name, and traces token aliases', () => {
    setCardLanguage(true);
    const draw = TOKENS.find(c => c.id === 'tok-emblem-chandra-draw')!;
    const burn = TOKENS.find(c => c.id === 'tok-emblem-chandra-burn')!;
    expect(draw.name).toBe(burn.name);
    expect(displayName(draw)).toBe('適令寒冰茜卓徽記');
    expect(displayName(burn)).toBe('反抗烈炬茜卓徽記');
    expect(sourcedChineseName(draw)?.sourceName).toBe('Chandra, Chill of Compliance Emblem');
    expect(sourcedChineseName(burn)?.sourceName).toBe('Chandra, Torch of Defiance Emblem');
    expect(displayName({ name: 'wicked Role' })).toBe('惡人');
    expect(displayName({ name: 'Heartwood' })).toBe('心材');
    expect(sourcedChineseName({ name: 'Heartwood' })?.kind).toBe('terminology');
    expect(sourcedChineseName({ name: 'Firebending Soldier' })?.aliasReason).toBeTruthy();
  });

  it('handles unaccented and single-slash spellings across every current imported deck', () => {
    setCardLanguage(true);
    for (const d of netdecks.decks) for (const row of [...d.main, ...d.side]) {
      const name = String(row[1]);
      expect(publishedChineseName({ name }) ?? sourcedChineseName({ name }), name).toBeTruthy();
      expect(displayName({ name }), name).toMatch(/[\u3400-\u9fff]/);
    }
    expect(displayName({ name: 'Unholy Annex/Ritual Chamber' })).toBe(displayName({ name: 'Unholy Annex // Ritual Chamber' }));
    expect(displayName({ name: "Dain's Company" })).toBe('戴因一行');
    expect(displayName({ name: 'Mjolnir, Hammer of Thor' })).toBe('雷神之錘妙爾尼爾');
  });

  it('labels database names separately and translates mode text without changing decision values', () => {
    setCardLanguage(true);
    const card = CARDS.find(c => c.name === 'Enduring Curiosity')!;
    const detail = renderToStaticMarkup(createElement(ImagesEnabled.Provider, { value: false }, createElement(CardDetail, { def: card })));
    expect(detail).toContain('永續好奇體');
    expect(detail).toContain('Enduring Curiosity');
    expect(detail).toContain('MTGZH／MTGso 中文卡庫收錄名稱');
    expect(detail).toContain(manifest.releaseUrl);
    const options = ['Dream Beavers', 'Enduring Curiosity'];
    const html = renderToStaticMarkup(createElement(ModeModal, { g: { cards: {} } as GameState, d: { type: 'mode', player: 0, prompt: '選擇牌名', options, count: 1, purpose: 'trigger' }, onSubmit: () => {} }));
    expect(html).toContain('侵夢海狸');
    expect(html).toContain('永續好奇體');
    expect(options).toEqual(['Dream Beavers', 'Enduring Curiosity']);
  });

  it('retains source row identifiers and excludes explicitly AI-tagged names', () => {
    const files: Record<string, string> = manifest.files;
    for (const row of [...Object.values(entries), ...Object.values(overrides)]) {
      expect(row.sourceLine).toBeGreaterThan(0);
      expect(files[row.sourceFile]).toMatch(/^[0-9a-f]{64}$/);
      expect(row.sourceUrl).toBe(manifest.releaseUrl);
      expect(row.originalChinese).toMatch(/[\u3400-\u9fff]/);
      expect(row.declaredSource).not.toMatch(/gpt|chatgpt|gemini|claude|(?:^|[^a-z])ai(?:[^a-z]|$)/i);
    }
  });
});
