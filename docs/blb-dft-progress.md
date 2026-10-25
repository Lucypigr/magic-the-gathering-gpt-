# BLB／DFT 補卡完成

| 系列 | 遊戲可用（含跨系列重印） | 已核對 | 印刷卡清單 | 待補 |
| --- | ---: | ---: | ---: | ---: |
| BLB 布隆堡 | 274 | 274 | 274 | 0 |
| DFT 以太競速 | 271 | 271 | 271 | 0 |

完整清單核對結果見 [blb-dft-progress.json](blb-dft-progress.json)。BLB 包含入門套牌獨有卡；不計重複插畫和基本地。兩系列合計 545 筆印刷記錄、543 個不同名稱，共用重印牌不會建立重複定義。本次補完其餘 BLB 165 張、DFT 141 張的完整效果，覆寫既有簡化定義。

BLB 支援贈禮、掘食、消耗、子嗣、季節重複模式、職業升級、特殊指示物、複製與延遲返回；DFT 支援啟動引擎、最高速度、耗竭與耗竭重用、搭載／騎乘、特殊法術力費用、可變 X 循環、載具變成生物與裝備互動。這些效果接入遊戲結算、目標與費用流程，沒有用空效果填滿數量。

卡圖、英文識別名稱和原專案未修改。中文名稱沿用具逐筆出處的名稱資料庫，537 個有規則文字的主系列名稱採用 MTGZH／MTGso 的人工譯文（另六張為無規則文字生物），四個新衍生物／徽記亦有相符來源。匯入要求來源英文 Oracle 與本地英文正規化後相同，排除標示 AI 或未審核的譯文；繁簡轉換只用於顯示。其餘簡單衍生物文字由既有中文規則轉換器處理。

來源與重建：

- 英文印刷特徵：`scripts/localization/name-sources.json` 固定版本的 MTGJSON 鏡像。`python scripts/generate-blb-dft.py` 重建清單與原生效果；人工效果定義位於 `blb-dft-verified.ts`、`blb-remaining.ts`、`dft-remaining.ts`。
- 中文譯文：[MTGZH data-2026-10-18](https://github.com/HeliumOctahelide/magic-cards-zhs/releases/tag/data-2026-10-18)。逐筆出處與原文保存在 `scripts/localization/blb-dft-rules.json`；上游資料依 CC BY-SA 授權，牌名與規則文字保留其原權利歸屬。
- 先執行 `python scripts/fetch-mtgzh-name-source.py`，再依序執行 `node scripts/export-card-text.mjs`、`node scripts/import-sourced-card-names.mjs`、`node scripts/import-blb-dft-rules.mjs`、`python scripts/localize-cards.py`、`node scripts/audit-card-names.mjs`。
- `node scripts/audit-blb-dft.mjs --write` 重建可用／核對／待辦數量。

驗證包括全系列印刷特徵與中文來源，以及贈禮順序、季節重複模式、掘食費用、消耗門檻、指示物加倍、延遲返回、搭載力量、耗竭複製、X 循環、死亡時資訊、職業觸發、持續效應時間順序及狀態複製隔離。跨系列組合未逐一窮舉。

完成驗證：`npm test` 為 584 項通過、1 項既有跳過；`npm run build` 通過。本機正式版以瀏覽器抽查四張新補卡，中文名稱與規則可見，無 JavaScript 錯誤。
