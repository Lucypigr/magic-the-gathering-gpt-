# MH2 摩登新篇2

收錄304種非基本地牌名：新增292種，沿用12種既有牌的機制並補上MH2重印關聯。基本地與同名異畫／閃卡版本不重複計數。收藏、組牌篩選與商店補充包使用同一份304種卡池；MH2未加入標準賽系列，近代賽仍依既有禁牌快照篩選。

英文費用、類別、身材與Oracle文字取自[固定來源及SHA-256](../scripts/modern-sources.json)，[原文卡表](../src/data/sets/mh2-catalog.json)逐張保留印刷UUID、來源雜湊與原始身材字串。Modern合法性沿用2026-10-23快照，並非即時禁限牌查詢。

304種牌及4個另一半共308筆名稱與規則文字均有中文來源，另補蓋斯異能所引用的6張牌之名稱與效果。名稱優先沿用已出版中文，其餘採MTGZH人工審校資料；效果須與英文Oracle正規化後精確匹配，stage大於0且排除AI來源，再用OpenCC轉為繁體。[中文來源及授權](../scripts/localization/modern-burn-source.json)固定2026-11-08版本與檔案雜湊，[逐筆效果出處](../scripts/localization/mh2-rules.json)保留行號、原文、Oracle ID及來源。卡圖與原專案未修改。

## 機制與測試範圍

- 逐張加入咒語、進場／死亡／施放觸發、起動與靜態異能。共用既有的呼魂、延緩、瘋魔、逃脫、破墳、風暴、連鎖、補強、食腐、永生、循環與交織路徑；新增模組、返響、相位移出、重生、再起及分割牌後半施放等支援。
- 納入學院製造商與松鼠將軍的衍生物替代順序；舊系列自訂效果的11處衍生物建立改用相同的批次路徑，使食物、線索等也適用替代效果。
- 複製費用可選次數，呼魂可選放逐的手牌，犧牲多個永久物的費用可選具體卡片。新系列的特殊選擇與狀態以現有決策介面顯示；卡圖不變動。
- 測試逐筆核對304種來源與中文，檢查292種新增牌的基本施放／延緩／進場路徑，以及可在測試場景起動的印刷異能。基本路徑只取首個可用模式；場景無合法目標／不滿足起動條件時不執行該動作。此類檢查不等同每種模式與所有跨系列組合均已窮舉。
- 場景斷言涵蓋模組及非生物地、虛空替代與死亡觸發、放逐指示物、延緩時間、瘋魔有色費用、呼魂、風暴、超載、相位移出與附件、掘墓前後類別、保護、重生、領域與身材層次、鵬洛客忠誠、衍生物替代、禁閉、法術力加成與限制，以及AI複本的獨立狀態。

## 重建

先執行`python scripts/audit-modern.py --write`驗證固定快取，再執行`python scripts/generate-mh2.py`。中文來源下載方式見`docs/modern-red.md`，接著執行`python scripts/generate-mh2-garth.py`、`node scripts/import-mh2-names.mjs`、`node scripts/import-mh2-rules.mjs`、`node scripts/export-card-text.mjs`、`python scripts/localize-cards.py`。

`npx vitest run tests/mh2.test.ts tests/mh3.test.ts tests/modern-format.test.ts`檢查本批與既有近代賽系列；`npm test`做完整回歸，`npm run build`檢查型別與正式建置。`python scripts/audit-modern.py --write`及`python scripts/render-modern-report.py`更新系列與套牌缺口；既有預設牌組保留原牌表。
