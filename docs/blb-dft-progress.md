# BLB／DFT 補卡進度（尚未完成）

這次新增 47 張實際卡牌定義，並以完整規則覆寫本批已核對的既有簡化定義。不能把「出現在遊戲裡」等同於「效果已全部核對」。

| 系列 | 遊戲可用（含跨系列重印） | 本批逐張核對 | 印刷卡清單 | 待核對 |
| --- | ---: | ---: | ---: | ---: |
| BLB 布隆堡 | 145 | 109 | 274 | 165 |
| DFT 以太競速 | 153 | 130 | 271 | 141 |

完整待辦（含目前是否已有舊版定義）見 [blb-dft-progress.json](blb-dft-progress.json)。BLB 清單包含入門套牌獨有卡；不計重複插畫和基本地。系列清單有兩張共用重印牌，因此合計為 543 個不同名稱。

本批修正子嗣為可以回應的進場觸發，複製品仍會觸發自身的進場異能；修正多個靈技實例，並補齊原先漏掉的目標篩選、搭載、騎乘、最高速度限制與耗竭費用。未核對卡的進階機制（例如完整季節、掘食與部分載具互動）仍在待辦，未用空效果補滿數量。

卡圖、英文識別名稱和原專案未修改。顯示用中文名稱依現有名稱匯入程序加入中文卡庫的逐筆來源。534 個名稱的中文效果採用 MTGZH／MTGso 譯文，並要求來源英文 Oracle 與本地英文逐字正規化後相同；排除標示 AI 或未審核的譯文，繁簡轉換只用於顯示。六張無規則文字的生物不需要譯文；另三張未納入本批的鵬洛客因 Oracle 文字差異保留待核對。

來源與重建：

- 英文印刷特徵：`scripts/localization/name-sources.json` 固定版本的 MTGJSON 鏡像。執行 `python scripts/generate-blb-dft.py` 重建清單與嚴格轉換的原生效果；不支援的完整效果會跳過，人工定義位於 `blb-dft-verified.ts`。
- 中文譯文：[MTGZH data-2026-10-18](https://github.com/HeliumOctahelide/magic-cards-zhs/releases/tag/data-2026-10-18)。逐筆出處與原文保存在 `scripts/localization/blb-dft-rules.json`，上游資料依 CC BY-SA 授權，牌名與規則文字保留其原權利歸屬。
- `python scripts/fetch-mtgzh-name-source.py`、`node scripts/import-blb-dft-rules.mjs`、`node scripts/export-card-text.mjs`、`node scripts/import-sourced-card-names.mjs`、`python scripts/localize-cards.py`、`node scripts/audit-card-names.mjs`。
- `node scripts/audit-blb-dft.mjs --write` 重建可用／核對／待辦數量。

驗證：本批相關 25 項測試通過，涵蓋印刷特徵、中文來源、子嗣、靈技、載具、速度、耗竭與目標合法性。未宣稱所有跨系列組合都已驗證。
