# 近代賽果敢套牌首批補卡

新增21種牌與Brazen Borrower的Petty Theft歷險面。三副Forge原牌表：鐵木爾、伊捷、潔斯凱果敢，各保留60張主牌與15張備牌；重複列出的同名牌按張數合併，不替換牌。

## 使用方式

首頁「抄牌組」上方選擇近代賽果敢牌組，可免費試玩、先建立或買齊主牌與備牌。練習對戰與天梯另有「近代賽」入口；牌庫篩選可選「近代賽合法」。收藏與原存檔進度保留。備牌會保存、顯示，並與主牌合計檢查同名四張上限與收藏數量；目前仍為單局對戰，未提供局間換備牌。

## 來源

- 卡片印刷資料及Modern合法性：MTGJSON鏡像2026-10-23快照，固定revision與SHA-256見[來源清單](../scripts/modern-sources.json)。這是離線快照，並非即時官方禁牌查詢。
- 三副牌表：Forge Extras固定版本的currentmodernmetagame.zip，檔案內日期2026-10-17，完整主牌與備牌及來源見[牌表資料](../src/data/modern-decklists.json)。
- 新增卡片放於「競技環境精選」分類供取得；原印刷系列、UUID與來源雜湊保存於[原文卡表](../src/data/sets/modern-prowess-catalog.json)。Tormod's Crypt的來源special稀有度對應遊戲R；不改動官方費用或效果。
- 名稱優先採中文印刷名稱，其次中文化魔風卡庫。效果22個牌面均以英文效果正規化精確匹配、有人工翻譯階段及來源記錄的MTGZH文本匯入，簡體僅轉繁體；[中文效果與逐筆來源](../scripts/localization/modern-prowess-rules.json)。卡圖未修改。

## 卡片

| 英文原名 | 來源印刷系列 |
|---|---|
| Arid Mesa | ZEN |
| Assault Strobe | SOM |
| Bloodstained Mire | KTK |
| Brazen Borrower | ELD |
| Consign to Memory | MH3 |
| Dragon's Rage Channeler | MH2 |
| Expressive Iteration | STX |
| Fiery Islet | MH1 |
| Lava Dart | MH1 |
| Lightning Bolt | M10 |
| Meltdown | MH3 |
| Mishra's Bauble | CSP |
| Murktide Regent | MH2 |
| Mutagenic Growth | NPH |
| Obsidian Charmaw | MH2 |
| Preordain | M11 |
| Prismatic Ending | MH2 |
| Scalding Tarn | ZEN |
| Tormod's Crypt | TSB |
| Unholy Heat | MH2 |
| Wooded Foothills | KTK |

## 驗證

- `npx vitest run tests/modern-format.test.ts tests/modern-prowess.test.ts`：逐張印刷資料、中文、費用與效果，加上牌表60+15、購卡、合併張數、Modern合法性、舊存檔升級、90份生成對手牌組與三場固定種子的果敢對戰。
- 特殊互動含：找地與休克地、返照被反擊仍放逐、非瑞克西亞生命費用、掘穴保留藍色費用及Murktide逐卡觸發、覆誦改目標及原咒語被反擊後仍複製、實際支付顏色的輝映、延遲至下一維持抓牌、躁狂在結算時檢查。
- 整體測試836項通過、1項原有跳過；最後補強後的近代賽專項78項通過，正式建置與瀏覽器匯入／保存／試玩檢查通過。測試通過只代表上述場景，不宣稱已窮舉所有跨系列互動。

## 重建

先執行`python scripts/audit-modern.py --write`取得並驗證固定版本快取，再執行`python scripts/generate-modern-prowess.py`可重建21種牌來源、三副牌表及合法性快照。中文來源取得方式沿用`python scripts/fetch-mtgzh-name-source.py`，然後依序執行`node scripts/export-card-text.mjs`、`node scripts/import-modern-prowess-rules.mjs`、`node scripts/import-sourced-card-names.mjs`、`python scripts/localize-cards.py`。
