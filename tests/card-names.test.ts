import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CARDS } from '../src/data';
import { displayName, publishedChineseName, setCardLanguage, setZhNames, zhName } from '../src/data/names';
import names from '../src/data/localization/zh-names.json';
import sources from '../scripts/localization/name-sources.json';
import { matchFilter } from '../src/ui/DeckBuilder';
import { CardDetail, ImagesEnabled } from '../src/ui/CardView';

vi.mock('../src/ui/images', async (original) => ({
  ...(await original<typeof import('../src/ui/images')>()),
  useImageVersion: () => 0,
}));
afterEach(() => setCardLanguage(false));

describe('published Chinese card names', () => {
  it('uses native Traditional names over stale runtime names and preserves English identities', () => {
    const card = CARDS.find(c => c.name === 'Giant Growth')!;
    const original = card.name;
    setZhNames([[card.name, '錯誤舊快取']]);
    setCardLanguage(true);
    expect(displayName(card)).toBe('變巨術');
    expect(publishedChineseName(card)?.language).toBe('zht');
    expect(card.name).toBe(original);
    expect(matchFilter(card, { q: '變巨術', color: '', type: '', set: '', rarity: '' })).toBe(true);
    setCardLanguage(false);
    expect(displayName(card)).toBe(original);
    expect(zhName(card)).toBe('變巨術');
    expect(publishedChineseName({ name: 'No published Chinese name test fixture' })).toBeUndefined();
    setCardLanguage(true);
    expect(displayName({ name: 'No published Chinese name test fixture' })).toBe('No published Chinese name test fixture');
  });

  it('keeps Adventure faces distinct and labels converted Simplified print names', () => {
    setCardLanguage(true);
    expect(displayName({ name: 'Questing Druid' })).toBe('追索德魯伊');
    expect(displayName({ name: 'Seek the Beast' })).toBe('找尋野獸');
    const card = CARDS.find(c => c.name === 'Doubling Season')!;
    const record = publishedChineseName(card)!;
    expect(record.printedName).toBe('倍产旺季');
    expect(record.name).toBe('倍產旺季');
    const html = renderToStaticMarkup(createElement(ImagesEnabled.Provider, { value: false }, createElement(CardDetail, { def: card })));
    expect(html).toContain('倍產旺季');
    expect(html).toContain('Doubling Season');
    expect(html).toContain('簡體中文印刷版（轉為繁體字顯示）');
    expect(html).toContain(`https://gatherer.wizards.com/Pages/Card/Details.aspx?multiverseid=${record.multiverseId}`);
  });

  it('includes published names of imported cards outside the playable pool', () => {
    const original = { name: "Tishana's Tidebinder" };
    expect(CARDS.some(c => c.name === original.name)).toBe(false);
    setCardLanguage(true);
    expect(displayName(original)).toBe('提莎娜的縛潮師');
    expect(publishedChineseName(original)?.set).toBe('LCI');
    expect(original.name).toBe("Tishana's Tidebinder");
    setCardLanguage(false);
    expect(displayName(original)).toBe(original.name);
  });

  it('retains publication identifiers and pinned source files for every bundled name', () => {
    const files: Record<string, string> = sources.files;
    for (const [en, record] of Object.entries(names)) {
      expect(en).toBe(en.toLowerCase());
      expect(record.name).toMatch(/[\u3400-\u9fff]/);
      expect(record.printedName).toMatch(/[\u3400-\u9fff]/);
      expect(record.multiverseId || record.scryfallId, en).toBeTruthy();
      expect(files[record.sourceFile], en).toMatch(/^[a-f0-9]{64}$/);
      expect(record.sourceFile).toBe(`${record.set}.json`);
      if (record.language === 'zht') expect(record.name).toBe(record.printedName);
    }
  });
});
