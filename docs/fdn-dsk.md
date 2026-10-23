# FDN 基石與 DSK 暮靨

只修改 `magic-the-gathering-gpt-`。FDN 卡池包含 512 張不重複的非基本地牌（含初學者產品的獨有牌）；DSK 包含主系列 001–271。異圖、基本地不重複計數。共用重印牌沿用原 ID 與系列歸屬。

`fdn-catalog.json`、`dsk-catalog.json` 保存牌面文字與特性；`*-auto.json` 和 `*-extra.ts` 提供可執行定義。沒有用空效果補足卡池數字。房間保存完整雙門牌面，施放、進場與解鎖後依開啟的門計算名稱、法力值與異能。

資料參照 [Forge FDN 卡表](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Foundations.txt)、[DSK 卡表](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Duskmourn%20House%20of%20Horror.txt) 及 [Forge 卡牌 Oracle 欄位](https://github.com/Card-Forge/forge/tree/master/forge-gui/res/cardsfolder)。Fear of Surveillance 的牌面另參照 [XMage](https://github.com/magefree/mage/blob/master/Mage.Sets/src/mage/cards/f/FearOfSurveillance.java)。這些是公開規則資料鏡像。

主要支援：

- 房間選門施放、法術時機解鎖特殊動作、完整解鎖觸發 eerie。
- 迫臨倒數與非生物狀態、Enduring 以結界回場、生存在第二主階段檢查橫置。
- 倍增旺季的衍生物／指示物取代、鵬洛客進場忠誠與起動費用區別、生命循環。
- 忍術的收回費用、分配傷害、增幅、展示／橫置／放逐等額外費用。
- 特定用途及同色多點法力、Verge 地牌條件、墳墓場與放逐區使用權限、守護與 Nowhere to Run。
- 命名衍生物的正確類別、顏色與身材，包括 Scion of the Deep、Koma's Coil、Everywhere、Niko 的 Shard。

`tests/foundation.test.ts` 核對全部 783 張牌面欄位與卡池，並以代表性對戰狀態測試上述機制和搭配。完整回歸、TypeScript 檢查與正式建置一併執行。測試覆蓋代表性互動，沒有窮舉所有跨系列組合或宣稱官方規則認證。

本次本機驗證：完整測試 531 項通過、1 項既有測試跳過；後續費用、施放權限與霧堤戰鬥傷害修正後，最新 FDN／DSK 專項 32 項全過。正式建置與瀏覽器練習對戰開局成功，沒有 JavaScript 錯誤。推送後另由 GitHub Actions 執行最新版本的完整測試、建置及 Pages 部署。
