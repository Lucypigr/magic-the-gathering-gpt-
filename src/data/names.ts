// 顯示用的卡名。規則引擎一律以英文原名辨識卡牌，只有顯示在畫面與紀錄時才換成中文。
// 優先採用隨網站保存的中文印刷卡名；即時查詢只補充尚未收錄的名稱。
import publishedNames from './localization/zh-names.json';
import sourcedNames from './localization/zh-sourced-names.json';
import tokenOverrides from './localization/zh-token-name-overrides.json';

export interface SourcedChineseName {
  name: string;
  sourceName: string;
  originalChinese: string;
  kind: 'published' | 'database' | 'terminology';
  language: 'zht' | 'zhs';
  declaredSource: string;
  sourceFile: string;
  sourceLine: number;
  sourceUrl: string;
  multiverseId?: string;
  scryfallId?: string;
  faceOracleId?: string;
  set?: string;
  number?: string;
  aliasReason?: string;
}
const sourced: Readonly<Record<string, SourcedChineseName>> = sourcedNames as Record<string, SourcedChineseName>;
const byTokenId: Readonly<Record<string, SourcedChineseName>> = tokenOverrides as Record<string, SourcedChineseName>;

// Deck sites often omit accents or use a single slash between two card faces.
// Normalize only display lookups; ambiguous spellings never choose arbitrarily.
function nameKey(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[’‘]/g, "'").replace(/\s*\/+\s*/g, ' // ').replace(/\s+/g, ' ').trim().toLowerCase();
}
function fallbackIndex<T>(entries: Readonly<Record<string, T>>): ReadonlyMap<string, T> {
  const index = new Map<string, T>();
  const ambiguous = new Set<string>();
  for (const [name, entry] of Object.entries(entries)) {
    const key = nameKey(name);
    if (index.has(key)) ambiguous.add(key);
    else index.set(key, entry);
  }
  for (const key of ambiguous) index.delete(key);
  return index;
}
const sourcedFallback = fallbackIndex(sourced);

/** 中文卡庫的逐筆來源；同名但效果不同的徽記依 ID 分別辨識。 */
export function sourcedChineseName(def: Named): SourcedChineseName | undefined {
  return (def.id ? byTokenId[def.id] : undefined) ?? sourced[def.name.toLowerCase()] ?? sourcedFallback.get(nameKey(def.name));
}

export interface PublishedChineseName {
  name: string;
  printedName: string;
  language: 'zht' | 'zhs';
  set: string;
  number: string;
  multiverseId?: string;
  scryfallId?: string;
  sourceFile: string;
}
const published: Readonly<Record<string, PublishedChineseName>> = publishedNames as Record<string, PublishedChineseName>;
const publishedFallback = fallbackIndex(published);

/** 出版名稱與來源；zhs 僅轉換字形，未自行翻譯英文名。 */
export function publishedChineseName(def: Named): PublishedChineseName | undefined {
  return published[def.name.toLowerCase()] ?? publishedFallback.get(nameKey(def.name));
}

export const publishedChineseNameCount = Object.keys(published).length;
export const sourcedChineseNameCount = Object.keys(sourced).length;

interface Named {
  id?: string;
  name: string;
  zh?: string;room?:unknown;
}

const zhNames = new Map<string, string>();
let useZh = false;

export function setCardLanguage(zh: boolean): void {
  useZh = zh;
}

export function setZhNames(entries: Iterable<[string, string]>): void {
  for (const [en, zh] of entries) zhNames.set(en.toLowerCase(), zh);
}

/** 中文卡名（沒有就回傳 undefined），不受語言設定影響 */
export function zhName(def: Named): string | undefined {
  return publishedChineseName(def)?.name ?? sourcedChineseName(def)?.name ?? zhNames.get(def.name.toLowerCase()) ?? def.zh;
}

/** 依目前的語言設定回傳要顯示的卡名 */
export function displayName(def: Named): string {
  return (useZh && zhName(def)) || def.name || (def.room?'房間（尚未解鎖）':'');
}

export function isChineseCardLanguage(): boolean { return useZh; }
