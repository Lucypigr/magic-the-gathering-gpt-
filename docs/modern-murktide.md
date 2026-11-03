# 伊捷龍侯補卡

第二批補入11種近代賽卡，完成Forge原始牌表Izzet Murktide的60張主牌與15張備牌。首頁「抄牌組」上方的「近代賽完整牌組」可試玩、先建立或買齊；備牌保存與既有近代賽合法性／同名張數檢查沿用前批。沒有修改卡圖或原專案。

## 來源

- 印刷特徵及效果依[固定版本與SHA-256清單](../scripts/modern-sources.json)，保留原印刷系列、UUID與雜湊於[卡表](../src/data/sets/modern-murktide-catalog.json)。
- 主牌與備牌來自Forge Extras 2026-10-17牌表，版本及原始逐行數量見[牌表資料](../src/data/modern-decklists.json)。
- 11種牌全部有可追溯中文名稱；效果以英文Oracle文字精確比對人工MTGZH譯文，簡體字僅轉為繁體字，[逐筆來源](../scripts/localization/modern-murktide-rules.json)保留原文、行號、翻譯階段與來源。

| 英文原名 | 原印刷系列 |
|---|---|
| Blood Moon | 8ED |
| Counterspell | MH2 |
| Force of Negation | MH1 |
| Misty Rainforest | ZEN |
| Mystical Dispute | ELD |
| Polluted Delta | KTK |
| Ragavan, Nimble Pilferer | MH2 |
| Stern Scolding | LTR |
| Subtlety | MH2 |
| Surgical Extraction | NPH |
| Test of Talents | STX |

## 機制與驗證

- 腥紅之月更換非基本地的地類別、印刷異能與產生的法術力，保留其他卡牌類別及非地副類別；包含休克地進場、失去異能、兩張腥紅之月、複製品、與托芙把神器變地的互動。離場恢復原牌特徵，複製不複製後加的地類別變更。
- 放逐藍牌替代費用：否認之力只可在非己方回合替代支付；銳敏只在呼魂時支付藍牌；均不能放逐正在施放的那張牌。保留印刷法術力值，其他增加費用仍需支付。
- 否認之力成功反擊後直接放逐，不先進墳墓場；無法反擊的咒語留在堆疊。銳敏不反擊，由目標咒語的擁有者決定牌庫頂／底，故可處理不能被反擊的咒語。
- 勒格文疾奔獲得敏捷並於下一結束步驟回手，使用物件版本防止離場重進後誤回手；戰鬥傷害產生珍寶、放逐受傷玩家牌庫頂，僅允許當回合以一般費用施放，不能使用地牌。
- 手術摘除可支付黑色或2生命，不可指定基本地牌；檢視並選擇任意數量的同名牌，最後洗牌。試煉才能反擊後仍完整執行搜尋，不能反擊時也不跳過搜尋；僅為從手牌被放逐的牌補抓。
- 專項測試另含反擊咒語、神秘干擾針對藍色咒語的減費與支付3、目標生物力量或防禦力二以下、兩張找地、每張原文資料與中文、原牌表精確匯入及一場固定種子AI對戰。
- 使用實際瀏覽器確認全中文預覽、主牌60／備牌15保存與試玩入口。測試是明確場景的驗證，不宣稱窮舉全部跨系列互動。

## 重建與測試

`python scripts/audit-modern.py --write`取得並驗證快取後，執行`python scripts/generate-modern-murktide.py`重建資料；兩批生成器會保留另一批牌組。中文沿用既有來源取得流程，再執行`node scripts/export-card-text.mjs`、`node scripts/import-modern-murktide-rules.mjs`、`node scripts/import-sourced-card-names.mjs`、`python scripts/localize-cards.py`。

`npx vitest run tests/modern-murktide.test.ts tests/modern-format.test.ts tests/modern-prowess.test.ts`驗證近代賽兩批；`npm test`跑整體測試，`npm run build`進行型別檢查與正式建置。
