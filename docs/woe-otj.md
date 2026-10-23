# WOE 艾卓荒野與 OTJ 奧流交會雷霆峽

本次只修改 `magic-the-gathering-gpt-`。WOE 補齊 276 張非基本地牌（主系列 001–261，加 Jumpstart 308–322），OTJ 補齊主系列 001–271。基本地與異圖不重複計數；原有兩張 BIG 獎勵牌 Simulacrum Synthesizer、Harvester of Misery 保留定義，但不混入 OTJ 主系列補充包的 271 張卡池。

## 資料與實作

`src/data/sets/woe-catalog.json`、`otj-catalog.json` 保存英文牌面文字、費用、類別、身材與冒險面；`*-extra.ts`、`*-auto.json` 提供可執行定義，覆寫原有簡化效果。共用重印牌保留牌 ID 與原系列歸屬。

牌面依 [Forge WOE edition](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Wilds%20of%20Eldraine.txt)、[Forge OTJ edition](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Outlaws%20of%20Thunder%20Junction.txt) 與 [Forge card scripts 的 Oracle 欄位](https://github.com/Card-Forge/forge/tree/master/forge-gui/res/cardsfolder) 核對；Mintstrosity 另參照 [XMage](https://github.com/magefree/mage/blob/master/Mage.Sets/src/mage/cards/m/Mintstrosity.java)。這些是公開的牌面規則資料鏡像，不是 Wizards 官方 API 或官方驗證服務。

## 規則實作重點

- WOE：交易的犧牲與減費、冒險面獨立特性與結算後放逐、慶典、六種角色及同控制者角色替換、英雄傳、指示物分配、依附與複製、連結放逐及使用期限。
- OTJ：謀定與次回合巫術時機免費施放、連力的模式組合與所有額外費用、犯罪的咒語／起動／觸發異能目標、坐騎與騎乘、亡命徒、額外維持步驟、額外戰鬥、複製與重新指定堆疊目標。
- 堆疊目標、分配指示物與 Three Bowls of Porridge 模式在施放／起動時選定；非法分配或 Likeness Looter 的錯誤 X 在付款前拒絕。
- 守護使用觸發流程，Gisa 的法力及生命一併選擇支付；Terror of the Peaks 的生命為施放額外費用。
- Roxanne 與 Intrepid Stablemaster 額外法力維持同一顏色，Stablemaster、Troyan 的剩餘法力保留用途限制；Archangel of Tithes 收取攻擊／阻擋費用。

## 驗證範圍

`tests/woe.test.ts`、`otj.test.ts` 核對全部 547 張的牌面欄位、冒險定義與卡池，並驗證代表性對戰流程；`frontier-rules.test.ts` 驗證目標時機、複製、守護、同色與用途限制法力等邊界。全專案測試、TypeScript 檢查與正式建置一併執行，避免共用引擎變更破壞既有系列。

547 張均有可執行定義，不等於已逐一窮舉所有牌組互動。此專案既有引擎對連續效果層次／相依性、同時取代效果的玩家排序與特殊物件變更仍有測試未覆蓋的範圍；複雜選擇有時使用額外視窗。不能將資料完整度或代表性測試解讀為所有綜合規則均已通過官方裁定認證。

本次驗證結果：兩系列專項 42 項通過；完整回歸 479 項通過、1 項既有平衡測試跳過。正式建置與瀏覽器練習對戰開局通過，沒有 JavaScript 錯誤。
