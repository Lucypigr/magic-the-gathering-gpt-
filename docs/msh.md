# MSH 漫威英雄

補齊主系列編號 001–276 的 276 張非基本地牌；基本地、異圖與主系列外的額外牌不重複計數。共用牌保留既有 ID 和系列歸屬，透過重印卡池讓 MSH 也能抽到，避免讓先前系列少牌。

## 資料與實作

`src/data/sets/msh-catalog.json` 保存英文牌面文字、費用、類別、身材及五張雙面英雄的另一面；`msh-extra.ts` 補齊全部主系列的可執行定義，並修正既有簡化效果。

資料核對日期：2026-10-23。來源為 [Forge MSH edition](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Marvel%20Super%20Heroes.txt) 與 [Forge card scripts](https://github.com/Card-Forge/forge/tree/master/forge-gui/res/cardsfolder) 的 Oracle 欄位。Guerrilla Gorilla 另參照 [XMage cards](https://github.com/magefree/mage/tree/master/Mage.Sets/src/mage/cards)，亦以 XMage 交叉核對部分雙面英雄。這些是公開規則資料鏡像，不是 Wizards 官方 API。

## 本次規則

- 強化每個異能限用一次、進場當回合減去本身法力費用；Wonder Man 增加次數、Hulk 減費及 Kang 額外回合中的限制。
- Teamwork 是可選額外費用，選擇總力量足夠的己方生物來橫置，包含剛進場的生物；保留是否支付供傷害、目標限制與「兩項模式」判斷，並觸發 Maria Hill。
- 七張 Plan 的指示物、達到門檻後犧牲與後續效果；The Mind Stone 的駕馭與啟用後異能。
- 五張雙面英雄可施放兩面並轉化；傳紀章節、額外戰鬥、額外回合及暫時複製。
- 護盾及關鍵字指示物、Doc Samson、反派／英雄觸發、神器協造、限定用途法力、條件式雙色地與 Arc Reactor 的三點無色法力。
- 堆疊異能複製、Photon Blast Barrage 的 X 次複製、Zemo 的誇耀放逐費用與選牌介面，以及放逐後使用權限。

## 驗證範圍

`tests/msh.test.ts` 有 22 個測試，核對 276 張主系列牌與實際補充包卡池，以及強化、Teamwork、護盾、Plan、駕馭、協造、雙面牌、條件地、法力、傷害、批次衍生物、誇耀費用及咒語複製。另執行全專案回歸、型別檢查、正式建置與瀏覽器進入對戰檢查。

本地完整回歸為 424 項通過、1 項沿用既有跳過；之後追加 Hydraulic Helper 法力限制案例，MSH 的最終 22 項測試及正式建置均通過。瀏覽器可進入練習對戰，沒有 JavaScript 錯誤。最終提交另由 Pages 工作流程執行全專案測試與建置。

全部牌有可執行定義不代表已窮舉所有對戰組合。引擎的連續效果層次、複製相依性，以及所有同時取代效果與觸發排序仍有未覆蓋範圍；部分複雜選擇以獨立選擇視窗呈現。測試通過不能解讀成所有組合已 100% 通過官方裁定認證。

## 後續指示物修正

隱形女俠現在以每次同時放置指示物的指示判斷觸發：一次對多個英雄放置只派一面牆；同一效果中的兩次獨立放置各自觸發，單獨呼叫放置也不會漏觸發。暈眩、充能、傳紀、關鍵字與進場的非 +1/+1 指示物事件會標示種類，避免誤觸隱形女俠、Knight of Wundagore、Beast 或護咒條件。

新增三個回歸案例，MSH 專項測試共 25 項通過（含原本的 276 張卡池核對）。修正後完整回歸 428 項通過、1 項沿用既有跳過；型別檢查與正式建置通過。
