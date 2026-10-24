// 顯示用的卡名。規則引擎一律以英文原名辨識卡牌，只有顯示在畫面與紀錄時才換成中文。
// 優先採用隨網站保存的中文印刷卡名；即時查詢只補充尚未收錄的名稱。
import publishedNames from './localization/zh-names.json';

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

/** 出版名稱與來源；zhs 僅轉換字形，未自行翻譯英文名。 */
export function publishedChineseName(def: Named): PublishedChineseName | undefined {
  return published[def.name.toLowerCase()];
}

export const publishedChineseNameCount = Object.keys(published).length;

interface Named {
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
  return publishedChineseName(def)?.name ?? zhNames.get(def.name.toLowerCase()) ?? def.zh;
}

/** 依目前的語言設定回傳要顯示的卡名 */
export function displayName(def: Named): string {
  return (useZh && zhName(def)) || def.name || (def.room?'房間（尚未解鎖）':'');
}

export function isChineseCardLanguage(): boolean { return useZh; }
