# TLA 卡池

主系列 001–281 全數可用：280 張歸在 TLA，另有既有的 Lightning Strike 重印。基本地與異畫不重複計數。卡名、費用、類別、稀有度、正背面與原文規則保存在 `src/data/sets/tla-catalog.json`；新增卡的中文實際效果與 DSL 在 `tla-extra.ts`。

資料核對來源：[Forge TLA 系列清單](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Avatar%20The%20Last%20Airbender.txt) 及該專案 `forge-gui/res/cardsfolder/` 中的逐張 Oracle 資料。執行遊戲及測試不需要連線取得卡牌資料。

## 遊戲中的規則

- 御氣：放逐物件；非衍生物的擁有者可支付 {2} 重施放，仍須遵守正常時機。
- 御水：費用可由法術力或橫置己方神器／生物支付；召喚失調不妨礙協助，珍寶協助時不犧牲。
- 御火：攻擊觸發產生紅色法術力，跨戰鬥步驟保留，到該戰鬥結束清空；傲宰與最後的烈火決鬥另有保留效果。
- 大地彎折沿用原遊戲的簡化：派出帶指示物與敏捷的大地元素，而非將既有地變成生物。依賴地生物的 Toph／額外戰鬥等能力同時計入這些元素。這不包含官方地死亡／放逐後返回的效果。
- 祭祠、課程、御術觸發、任務指示物、傳紀轉化、返照及預示有實際引擎效果；任務／烈火指示物不會增加生物身材。

沿用簡化決策模型的差異：Crashing Wave、Foggy Swamp Visions、Katara 的可變御水費用，以及選用御水費用，在結算時選擇並支付；變更咒語／異能目標與自由數量的選擇也使用結算決策介面。Bumi 的三項試煉以可用數量選擇；Fire Lord Sozin 復活時支付所選生物的總費用。預示與預謀共用放逐操作介面，預示重施放時仍收取預示費用。遊戲不是完整的官方規則裁判引擎。

## 精簡驗證

`npm exec -- vitest run tests/tla.test.ts --maxWorkers=2` 核對完整卡池與御術、祭祠、雙面牌、盟友觸發。`npm run build` 包含 TypeScript 檢查。原有 AI 勝率分析不屬於這次必要測試。
