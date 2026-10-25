# LCI／SOS 補卡與中文

| 系列 | 已收錄 | 完整非基本地清單 | 待補 | 另一面／準備咒語 |
| --- | ---: | ---: | ---: | ---: |
| LCI 伊夏蘭 | 286 | 286 | 0 | 36 |
| SOS 斯翠海文 | 266 | 266 | 0 | 36 |

包含跨系列重印；基本地、重複插畫與特殊版本不重複計數。數量核對見 [lci-sos-progress.json](lci-sos-progress.json)。原有卡片一併以完整英文規則校正，新增效果接入費用、目標、堆疊、觸發及狀態動作。

LCI 包括發現、探險、下潛、製作、製作後引用放逐牌、雙面牌、洞窟法術力、神明返場、衍生物三倍與部族互動。SOS 包括準備咒語、樂章的實付法術力門檻、聚輝、增量、生命門檻、墳墓場離牌事件、範式、返照、奇蹟、連鎖、風暴、死傷與重複模式。關鍵字摘要不能直接當作原有異能：有條件賦予的飛行、踐踏等依牌面條件計算。

中文名稱沿用既有逐筆來源匯入，不自行創造牌名。626 筆主牌、另一面、準備咒語與部分衍生物規則文字使用 MTGZH／MTGso 人工譯文，要求來源英文與本地英文正規化後一致，排除標示 AI 或未審核資料。兩個簡單衍生物的文字由既有中文規則轉換器處理。卡圖與原專案未修改。

## 來源及重建

- 英文資料：`scripts/localization/name-sources.json` 所記錄的 `taw/magic-search-engine-data` 固定版本 MTGJSON 鏡像，下載檔案逐一核對 SHA-256。這是公開 Oracle 資料鏡像，不是直接存取 Wizards API。
- 中文資料：[MTGZH data-2026-10-18](https://github.com/HeliumOctahelide/magic-cards-zhs/releases/tag/data-2026-10-18)。`scripts/localization/lci-sos-rules.json` 保留來源、原文、資料行與 Oracle ID。上游資料依 CC BY-SA 授權；牌名與規則文字保留原權利歸屬。
- `python scripts/generate-lci-sos.py` 重建目錄及嚴格轉換成功的原生效果，無法完整轉換者由 `lci-extra.ts`、`sos-extra.ts` 補齊，不會以空效果自動標記完成。
- 依序執行 `node scripts/export-card-text.mjs`、`node scripts/import-sourced-card-names.mjs`、`node scripts/import-lci-sos-rules.mjs`、`python scripts/localize-cards.py`、`node scripts/audit-card-names.mjs` 更新中文及來源報告。
- `node scripts/audit-lci-sos.mjs --write` 重建數量報告。

## 驗證範圍

`tests/lci-sos.test.ts` 核對全部主牌與另一面／準備咒語的印刷特徵、英文原文及中文名稱，並以實際遊戲狀態檢查代表性機制。案例包含製作放逐費用、發現免費施放、聚輝進場指示物、樂章與增量的實付法力、準備咒語複製、暫時放逐返回、範式、橫置費用返照、神明轉化返場、衍生物倍增、探險連動、同時死亡的力量總和、生命損失、死傷、X 生命費用、製作時放逐觸發、下潛條件關鍵字及製作後讀取放逐區牌張的特徵。

另執行既有系列回歸、型別檢查、正式建置與本機瀏覽器中文顯示檢查。未窮舉所有跨系列組合；不能把完整卡片數量或代表案例通過視為所有官方裁定組合均經認證。

本次本機全套回歸為 605 項通過、1 項既有跳過；最後追加的回歸案例與兩系列專項合計 24 項通過。型別檢查、正式建置及四張卡的瀏覽器中文顯示檢查通過；提交後的 GitHub Pages 工作流程會再次執行完整測試及建置。

FRA 的既有 24 場固定種子 AI 回歸改為逐場計時及回報，保留全部種子和勝負斷言，避免整批共用單一測試的 120 秒上限。新共用檢查也避免對無相關機制的戰場反覆配置陣列與查詢異能。
