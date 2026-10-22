# TMT 忍者龜卡池

主系列 001–190 全數加入卡池：189 張 TMT 定義與既有 Negate 重印；基本地和異畫不重複計數。卡名、費用、類別、稀有度與原文規則在 `src/data/sets/tmt-catalog.json`；可執行 DSL 在 `tmt-extra.ts`。TMT 卡牌顯示完整英文牌文，避免中文摘要漏掉異能；卡名仍沿用既有中文名稱設定。

來源：[Forge 系列清單](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Teenage%20Mutant%20Ninja%20Turtles.txt) 與 `forge-gui/res/cardsfolder/` 逐張資料。Bespoke Bō 的資料另由 [XMage](https://github.com/magefree/mage/blob/master/Mage.Sets/src/mage/cards/b/BespokeBo.java) 核對。遊戲與測試均使用本機卡表，不需要連線取得資料。

## 新增機制

- **潛行**：僅在宣告阻擋完成後，收回你的未被阻擋攻擊生物並支付替代費用。這仍是施放咒語，可被反擊；生物進場時橫置且攻擊。介面會讓你選擇收回哪個生物，AI 使用相同付款路徑。Ninja Teen 可授予墳墓場生物潛行；Sewer Samurai 的一般墳墓場施放另有終結指示物。
- **消逝**：追蹤每位玩家本回合是否有自己的永久物離場，包括死亡、犧牲、收回與放逐；在每回合開始重置。
- **突變劑**：神器衍生物，支付 {1}、橫置並犧牲，在目標生物上放一個 +1/+1 指示物；限法術時機。支援費用減免、指示物替代效果與神器死亡觸發。
- **職業**：依序升至 2、3 級；升級限法術時機，結算後才獲得該等級的效果，不能跳級或重複購買同一級。職業等級和充能指示物會顯示在戰場。
- 同時接上忍者觸發加倍、神器共鳴、神器動畫與複製、指示物繼承、載具駕駛記錄及額外戰鬥等卡牌效果。

## 牌文核對與修正

先前「190／190」僅代表收錄數量，不能代表效果完全一致。已重新核對包含舊卡在內的 190 張牌文並修正發現的差異；逐張結果、資料來源與驗證界線見 [核對紀錄](tmt-audit.md)。

修正包含漏掉的通魂、循環、消逝及離場效果，The Last Ronin 的兩個章節、Super Shredder 的觸發範圍、South Wind Avatar 的生命量、職業升級觸發、守護、反射觸發、目標限制及動畫／複製順序。移除指示物、複數犧牲、棄牌和駕駛費用提供玩家選擇。

局外找牌只從玩家本局起始時持有、未放入起始套牌的收藏選擇，不再生成未持有的牌。沒有提供局外收藏時候選為空。

## 精簡驗證

`npm exec -- vitest run tests/tmt.test.ts tests/tmt-rules.test.ts --maxWorkers=2` 核對全部 190 張、實際補充包卡池、潛行時機／付款、消逝、突變劑、職業、墳墓場施放及代表性卡牌。`npm run build` 包含 TypeScript 檢查。共享引擎修改另外跑一次既有測試；不執行選用的 AI 勝率分析。
