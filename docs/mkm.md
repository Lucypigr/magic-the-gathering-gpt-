# MKM 卡洛夫莊園謀殺案

補齊主系列編號 001–271 的 271 張非基本地牌。基本地、異圖、額外宣傳牌不重複計數。與其他系列共用的 Escape Tunnel、Make Your Move、Murder、Shock、Lightning Helix 沿用共用牌 ID 與重印卡池，避免影響既有系列。

## 資料與實作

`src/data/sets/mkm-catalog.json` 保存英文牌面文字、費用、類別及身材；`mkm-extra.ts` 為全部主系列牌提供可執行定義，並覆寫既有簡化效果。五張連體牌提供兩半施放選項，結算後進入墳墓場；Kellan 保留真正的冒險流程。

資料核對日期：2026-10-23。來源為 [Forge MKM edition](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Murders%20at%20Karlov%20Manor.txt) 及 [Forge card scripts](https://github.com/Card-Forge/forge/tree/master/forge-gui/res/cardsfolder) 的 Oracle 欄位。Fanatical Strength、Kellan, Inquisitive Prodigy 另外參照 [XMage cards](https://github.com/magefree/mage/tree/master/Mage.Sets/src/mage/cards)。這些是公開規則資料鏡像，不是 Wizards 官方 API。

## 本次規則

- 蒐證作為額外費用、起動費用、守護費用及替代法力費用；介面可選擇用於蒐證的墳墓場牌。
- 案件在操控者的結束步驟檢查破解條件，破解後啟用對應效果；離場後失去破解狀態。
- 偽裝、斗篷、翻正面、翻面時的指示物、限制翻面、面朝下死亡後返場。
- 懷疑與取消懷疑、調查、線索犧牲、毒指示物，以及衍生物取代效果。
- 同時蒐證多張生物牌時，Insidious Roots 等「一張或更多」觸發一次；Delney 複製小生物觸發，Doorkeeper Thrull 阻止指定進場觸發。
- 修正 No More Lies 的放逐、Vein Ripper 的守護、部分裝備、職業類別、重印卡池與連體牌法力值。

## 驗證與限制

`tests/mkm.test.ts` 有 17 個測試，核對 271 張牌與卡池、蒐證付款及失敗不扣費、案件破解、同時離開墳墓場、偽裝、斗篷、傷害、額外戰鬥及連體牌。本次全專案回歸為 403 項通過、1 項沿用既有跳過；型別檢查及正式建置通過，瀏覽器可進入對戰起手牌畫面，沒有 JavaScript 錯誤。

271 張有定義不代表所有對戰組合已窮舉驗證。既有引擎的連續效果層次、複製相依性、同時觸發與取代效果的完整玩家排序仍有未覆蓋範圍；部分複雜選牌以獨立選擇視窗呈現。不能將牌張數或代表性測試通過解讀成全規則已 100% 通過官方裁定認證。

2026-10-24 費用、連續效果及觸發期限複核與修正，見 [MKM / MSH 規則複核](mkm-msh-rules-audit.md)。
