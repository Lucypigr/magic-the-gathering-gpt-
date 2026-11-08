# 純紅燒牌補卡

新增6種牌，補齊Forge原始Mono-Red Burn的60張主牌與15張備牌。首頁「抄牌組 → 近代賽完整牌組 → 純紅燒牌」可試玩或保存原始牌表；備牌隨牌組保存，目前對戰仍為單局。

原文費用、類別、身材與效果使用[固定版本來源及SHA-256](../scripts/modern-sources.json)，逐張印刷系列、UUID與雜湊保存在[原文卡表](../src/data/sets/modern-red-catalog.json)。原始牌表日期為2026-10-17，合法性採2026-10-23快照。

| 英文原名 | 有來源中文名 |
|---|---|
| Arena of Glory | 榮光競技場 |
| Chandra's Incinerator | 茜卓的焚焰靈 |
| Exquisite Firecraft | 精巧火術 |
| Grafdigger's Cage | 挖墳人囚籠 |
| Rift Bolt | 時縫之雷 |
| Seal of Fire | 火焰之緘印 |

名稱優先使用已出版中文，其餘使用MTGZH人工審校資料；不自行猜名。六張效果皆與英文Oracle正規化後精確匹配，stage大於0且不採AI來源，再以OpenCC轉為繁體。[固定中文來源](../scripts/localization/modern-burn-source.json)保留2026-11-08下載及檔案雜湊，[效果逐筆出處](../scripts/localization/modern-red-rules.json)保留原文、行號與Oracle ID。卡圖及原專案未修改。

## 機制與驗證

- 榮光競技場檢查山脈類別（包含非基本地），督戰略過下一次自己的重置；追蹤兩點紅法術力實際花費，僅花在生物咒語上的部分給予敏捷直到回合結束。涵蓋一般加紅、混合法術力池、消耗、閃爍與腥紅之月。
- 茜卓的焚焰靈只計實際造成的非戰鬥傷害，包含對手來源對自己的傷害；費用增加後才套用減費。己方來源對對手造成傷害另行觸發，指定該對手的生物或鵬洛客。
- 精巧火術在反擊效果結算時重新檢查咒語精熟，支援墳墓場牌數改變及既有不同系列的反擊效果。
- 挖墳人囚籠阻止從墳墓場／牌庫施放任何咒語，並阻止其中的生物牌進場。依固定來源所附2019-07-12裁定，以原區域的牌類別判斷，非生物複製品可進場後成為生物；生物不能藉複製非生物繞過限制。從這兩個區域顯化任何牌均被阻止；手牌／放逐區進場與異能被移除的情況亦有測試。
- 時縫之雷的延緩是特殊動作，不觸發施放咒語異能。維持移去時間指示物、移去最後一個後可免費施放，兩次觸發可分別被反擊；拒絕施放則保持放逐。免費施放保留法術力值3，費用增加仍須支付；測試盛歡幻靈、狂攪漩渦、囚籠、反擊與閃現許可。
- 火焰之緘印在起動時犧牲作為費用，結算才造成2點傷害；與只能反擊觸發式異能的牌區分。
- 固定種子AI對戰與瀏覽器檢查中文名稱／效果、60+15保存與試玩入口。測試是具體場景的驗證，未窮舉所有跨系列組合。

## 重建

先執行`python scripts/audit-modern.py --write`驗證快取，再執行`python scripts/generate-modern-red.py`；保留既有五副牌組。中文使用`python scripts/fetch-mtgzh-name-source.py /tmp/mtgzh-burn-source scripts/localization/modern-burn-source.json`，接著執行`node scripts/import-modern-red-names.mjs`、`node scripts/import-modern-red-rules.mjs`、`node scripts/export-card-text.mjs`、`python scripts/localize-cards.py`。

`npx vitest run tests/modern-red.test.ts tests/modern-format.test.ts`涵蓋本批及模式；`npm test`做整體回歸，`npm run build`檢查型別與正式建置。盤點透過`python scripts/audit-modern.py --write`與`python scripts/render-modern-report.py`更新。
