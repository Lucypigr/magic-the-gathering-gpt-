# 波洛斯燒牌補卡

新增12種牌，完成Forge原始Boros Burn牌表的60張主牌與15張備牌。首頁「抄牌組 → 近代賽完整牌組 → 波洛斯燒牌」提供試玩、先建立與買齊；沒有替代原牌，備牌會保存，目前對戰仍為單局。原專案及卡圖未變動。

## 來源

- 原文費用、類別、身材與效果採[固定版本與SHA-256清單](../scripts/modern-sources.json)，逐張印刷系列、UUID及來源雜湊保存於[卡表](../src/data/sets/modern-burn-catalog.json)。
- 牌表保留Forge Extras 2026-10-17原始數量，來源及逐行牌名見[牌表資料](../src/data/modern-decklists.json)。近代賽合法性仍採2026-10-23快照。
- 舊MTGZH 2026-10-18下載已回傳404。本批改採[2026-11-08固定來源](../scripts/localization/modern-burn-source.json)，保留壓縮包與四個資料檔的SHA-256；既有名稱與翻譯來源未重寫。
- 新增12種牌的中文效果均正規化後精確匹配英文Oracle、人工翻譯stage大於0且不標示AI來源；只將簡體字轉繁體字。[效果及逐筆出處](../scripts/localization/modern-burn-rules.json)。名稱仍優先採已出版中文卡名。

| 英文原名 | 有來源中文名 | 原印刷系列 |
|---|---|---|
| Barbarian Ring | 蠻族決鬥擂臺 | MH3 |
| Deflecting Palm | 饋擊掌 | KTK |
| Eidolon of the Great Revel | 盛歡幻靈 | JOU |
| Goblin Guide | 鬼怪嚮導 | ZEN |
| Lava Spike | 熔岩擊 | CHK |
| Roiling Vortex | 狂攪漩渦 | ZNR |
| Searing Blaze | 炙熱火光 | WWK |
| Searing Blood | 炙熱鮮血 | BNG |
| Skewer the Critics | 遏止倒彩 | RNA |
| Skullcrack | 碎顱擊 | GTC |
| Smash to Smithereens | 砸成碎片 | SHM |
| Sunbaked Canyon | 日灼峽谷 | MH1 |

## 實作與驗證

- 地落記錄本回合曾在己方進場的地，地之後離場仍保留；炙熱火光的兩個目標在施放、介面選擇與結算時檢查操控者關係，允許合法目標各自結算。
- 歡慶僅在對手本回合失去過生命時提供替代費用，仍遵守法術時機，堆疊上保留印刷法術力值。盛歡幻靈亦計入堆疊上選定的X。
- 炙熱鮮血為原生物物件建立本回合死亡延遲觸發，死亡時才決定受傷玩家；放逐、閃爍及回合結束均不誤觸發。
- 饋擊掌在結算時選擇傷害來源，不指定目標；防止下一次傷害事件後以饋擊掌為新來源造成同量傷害。包含堆疊咒語、場上物件、等待中的延遲觸發、閃爍與不能防止傷害的測試。
- 碎顱擊阻止雙方回血並使傷害不能被防止，效期到清除步驟；不能防止的傷害仍移去護盾指示物。狂攪漩渦的回血限制僅作用於異能操控者的對手。
- 蠻族決鬥擂臺的法術力能力造成可防止的傷害；日灼峽谷支付生命。自動支付與手動法術力能力一致；生命費用不可超付，並套用既有生命費用替代效果。腥紅之月可移除原來的法術力副作用與起動式異能。
- 額外涵蓋鬼怪嚮導展示頂牌且僅將地置於手上、砸成碎片對不滅神器仍造成3傷害、雙方維持、零法術力施放、AI狀態複製及固定種子對戰。
- 瀏覽器檢查中文名稱／效果、60+15保存與試玩入口。這些為具體場景的驗證，不宣稱已窮舉所有跨系列互動。

## 重建與測試

先執行`python scripts/audit-modern.py --write`取得並驗證固定版本快取，再執行`python scripts/generate-modern-burn.py`重建本批原文卡表與牌表（保留既有四副牌組）。中文執行`python scripts/fetch-mtgzh-name-source.py /tmp/mtgzh-burn-source scripts/localization/modern-burn-source.json`，接著`node scripts/import-modern-burn-names.mjs`、`node scripts/import-modern-burn-rules.mjs`、`node scripts/export-card-text.mjs`、`python scripts/localize-cards.py`。

`npx vitest run tests/modern-burn.test.ts`檢查本批；`npm test`整體回歸，`npm run build`檢查型別與正式建置。盤點報告以`python scripts/audit-modern.py --write`與`python scripts/render-modern-report.py`更新。
