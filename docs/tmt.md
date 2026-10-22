# TMT 忍者龜卡池

主系列 001–190 全數加入卡池：189 張 TMT 定義與既有 Negate 重印；基本地和異畫不重複計數。卡名、費用、類別、稀有度與原文規則在 `src/data/sets/tmt-catalog.json`；新增卡的實際中文規則與可執行 DSL 在 `tmt-extra.ts`。

來源：[Forge 系列清單](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Teenage%20Mutant%20Ninja%20Turtles.txt) 與 `forge-gui/res/cardsfolder/` 逐張資料。Bespoke Bō 的資料另由 [XMage](https://github.com/magefree/mage/blob/master/Mage.Sets/src/mage/cards/b/BespokeBo.java) 核對。遊戲與測試均使用本機卡表，不需要連線取得資料。

## 新增機制

- **潛行**：僅在宣告阻擋完成後，收回你的未被阻擋攻擊生物並支付替代費用。這仍是施放咒語，可被反擊；生物進場時橫置且攻擊。介面會讓你選擇收回哪個生物，AI 使用相同付款路徑。Ninja Teen 可授予墳墓場生物潛行；Sewer Samurai 的一般墳墓場施放另有終結指示物。
- **消逝**：追蹤每位玩家本回合是否有自己的永久物離場，包括死亡、犧牲、收回與放逐；在每回合開始重置。
- **突變劑**：神器衍生物，支付 {1}、橫置並犧牲，在目標生物上放一個 +1/+1 指示物；限法術時機。支援費用減免、指示物替代效果與神器死亡觸發。
- **職業**：依序升至 2、3 級；升級限法術時機，結算後才獲得該等級的效果，不能跳級或重複購買同一級。職業等級和充能指示物會顯示在戰場。
- 同時接上忍者觸發加倍、神器共鳴、神器動畫與複製、指示物繼承、載具駕駛記錄及額外戰鬥等卡牌效果。

## 沿用的簡化

這是既有遊戲引擎的卡牌實作，不是完整官方裁判引擎。沿用 TLA 的固定效果與結算選擇介面，部分可變數量、可選支付和反射觸發在結算中處理；移除指示物、犧牲數個永久物等費用由引擎選擇合適物件。Raphael 的「若能阻擋則須阻擋」會補上一個合法阻擋者。Turtles Forever 與 North Wind Avatar 的「局外」候選使用本機卡牌資料庫，不是獨立的比賽備牌或玩家實體收藏。Quintessential Katana 的戰鬥傷害觸發同時支援傷害玩家與生物。已存在的卡牌仍保留原有簡化，並補入卡表中標示的潛行費用。

## 精簡驗證

`npm exec -- vitest run tests/tmt.test.ts --maxWorkers=2` 核對全部 190 張、實際補充包卡池、潛行時機／付款、消逝、突變劑、職業、墳墓場施放及代表性卡牌。`npm run build` 包含 TypeScript 檢查。共享引擎修改另外跑一次既有測試；不執行選用的 AI 勝率分析。
