# EOE / TDM 卡片與驗證

EOE 已收錄 **261 / 261**、TDM 已收錄 **271 / 271**。此次補入剩餘 EOE 95 張、TDM 60 張，並補上先前已收錄但尚未覆核的複雜定義。數量包含同名跨系列重印，不包含基本地與替代插畫的重複版本；可用數量見 [進度資料](eoe-tdm-progress.json)。

新增定義位於 `src/data/sets/orbit-final-eoe.ts`、`orbit-final-tdm.ts`，與先前的 `orbit-extra.ts`、`orbit-station-data.ts`、`orbit-tdm-more.ts` 一起載入。完整載入時檢查缺漏，既有跨系列重印保留原定義與刊印規則文字。

規則引擎新增免費施放與預兆、暫停、探掘、臨時和聲、分配指示物／傷害、額外戰鬥與主要階段、進場前選擇、衍生物取代、持續操控、保護、延遲犧牲、施放／墓地權限、限定法術力、費用減少與充電指示物互動。蓄勢以結算時的力量計算，離場時使用該物件最後已知數值；Tapestry Warden 可以改用較高的防禦力。

英文費用、類別、規則文字與完整卡表取自 `scripts/localization/name-sources.json` 鎖定版本並驗證 SHA-256 的 MTGJSON 鏡像。中文名稱優先使用有刊印依據的名稱，其餘使用 [MTGZH 中文化魔風資料](https://github.com/HeliumOctahelide/magic-cards-zhs/releases/tag/data-2026-10-18) 中非 AI、已經人工處理的名稱及規則文字，透過 OpenCC 轉為繁體。`scripts/localization/eoe-tdm-rules.json` 保存英文對照、來源、原檔行號與識別碼；547 個有規則文字的牌面／衍生物找到英文完全一致的中文對照，沒有缺漏。

`tests/eoe-tdm.test.ts`、`tests/orbit-station.test.ts` 與 `tests/orbit-final.test.ts` 驗證來源資料與中文、續戰、預兆反擊／洗回、躍遷、動員、復新、蓄勢、複製、免費施放、保護、分配目標、傷害防止、限定起動、衍生物取代，以及新增永久物對一般遊戲事件的處理。另執行全專案回歸測試與正式建置。這些測試驗證具體情境，不代表窮舉所有跨系列牌組與所有規則順序。

僅修改 GPT 版專案；卡圖與圖片載入設定未改動。
