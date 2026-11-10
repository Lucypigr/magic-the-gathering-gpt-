# MH3 摩登新篇3

收錄303種非基本地牌名：新增296種，沿用既有7種同名牌的機制並補上MH3重印關聯。基本地與異畫／閃卡等同名版本不重複計數。收藏與組牌的MH3篩選、商店補充包均使用這303種；系列未加入標準賽卡池，近代賽仍排除禁牌（例如Nadu, Winged Wisdom）。

英文費用、類別、身材、效果及雙面資訊依[固定版本與SHA-256](../scripts/modern-sources.json)，逐筆出處、UUID、原始身材字串保存在[MH3原文卡表](../src/data/sets/mh3-catalog.json)。Modern合法性沿用2026-10-23快照；不代表即時查詢最新禁限牌表。

303種牌及其背面／歷險共329筆名稱與規則文字皆有中文來源。優先沿用已出版中文；其餘採MTGZH人工審校資料，不自行猜名。規則文字須與英文Oracle正規化後精確匹配、stage大於0且排除AI來源，再用OpenCC轉為繁體。[中文來源與授權](../scripts/localization/modern-burn-source.json)固定2026-11-08版本與雜湊；[逐筆效果來源](../scripts/localization/mh3-rules.json)保留行號、Oracle ID與原文。卡圖與原專案未修改。

## 機制與驗證範圍

- 實作能量獲得、替代與支付、能量施放、能量的介面顯示；支援超載、逸脫、化生、神授、呼魂、連鎖、瘋魔、追溯、適應、複製、風暴及其他逐張異能。
- 實作20種可作地使用的雙面牌、5種可轉化鵬洛客與歷險牌；土地進場支付生命或橫置、離場恢復正面。
- 補上靈氣護身、掘墳替代抽牌、無色法術力限制、地類別替代、施放觸發、額外起始階段、延遲回場及能量費用。共用的產生式抽牌路徑使用掘墳替代，使既有系列抽牌效果也能選擇替代。
- 測試逐筆核對303種來源欄位及中文、296種新增牌的基本施放／進場流程、雙面與指定目標，以及能量、神授、囚籠、腥紅之月、反擊、額外費用、傷害與延遲狀態等具體搭配。基本施放測試只選一般施放及首個模式，沒有合法目標的場景不施放；它不等同逐個模式與所有跨系列組合均已驗證。
- `tests/mh3.test.ts`保留場景斷言；整體回歸使用`npm test`，型別與正式建置使用`npm run build`。瀏覽器另確認收藏303種、中文詳細效果、MH3商店開包與組牌篩選。

## 重建與盤點

先執行`python scripts/audit-modern.py --write`下載並核對固定來源，再執行`python scripts/generate-mh3.py`。中文來源取得方式見`docs/modern-red.md`，接著執行`node scripts/import-mh3-names.mjs`、`node scripts/import-mh3-rules.mjs`、`node scripts/export-card-text.mjs`、`python scripts/localize-cards.py`。名稱與效果來源匯入會驗證檔案雜湊。

`python scripts/audit-modern.py --write`及`python scripts/render-modern-report.py`更新系列與牌表缺口。此批將MH3補至303/303；Modern合法牌名增加293種，50份牌表樣本的缺口由341降至287種。既有6副完整預設牌組維持原牌表。
