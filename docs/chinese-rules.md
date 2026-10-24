# 繁體中文效果文字

中文模式現在從本機翻譯庫取得效果文字，不依賴 Scryfall 查詢成功與否。卡圖下載、網址、語言選擇與特殊卡圖流程維持原樣。沒有官方中文印刷的牌也可以保留原卡圖，另外閱讀中文效果。

- `CardDef.text`、牌名、ID 及所有執行效果維持原值；翻譯只用於顯示。
- `RulesText`、卡牌詳細資訊、效果解說與中文規則搜尋共用同一份翻譯。
- 對戰中點選卡牌後，在原卡圖下方附上「中文效果」文字區；面朝下的隱藏資訊沿用原有權限。
- 中文／英文選項仍可切換，切回英文時顯示原文。
- 機制解說補上房間、迫臨、忍術、顯化懼象、謀定及連力；生存的時機修正為第二主階段。

這是遊戲內的繁中參考文字，不宣稱是官方中文印刷。內容使用既有完整規則轉換器的中譯、共用句型與術語、逐卡覆寫及房間雙門譯文；牌名等專有名稱可保留英文。

更新翻譯庫時，在 GPT 專案執行：

```sh
node scripts/export-card-text.mjs
python scripts/localize-cards.py
```

輸入為目前卡池的英文規則及所有背面、冒險與房間面；輸出為 `src/data/localization/zh-rules.json`。覆寫及術語位於 `scripts/localization/`。生成腳本不修改任何卡牌機制，也不需要網路翻譯服務。

`tests/localization.test.ts` 檢查所有現有卡牌與各牌面都有中文效果、切換語言、原文不被改寫、中文搜尋、解說與原卡圖網址保留。

## 中文出版卡名

`src/data/localization/zh-names.json` 另存中文印刷名稱，優先採用繁體中文出版版次，其次使用簡體中文出版名稱並以 OpenCC 轉為繁體字。後者不是台灣版官方譯名，詳細資訊會標示來源語言，並提供 Gatherer 官方牌張連結。查不到中文出版資料時保留英文，不把社群或 AI 自譯卡名當作官方名字。

來源是 [MTGJSON 資料公開快照](https://github.com/taw/magic-search-engine-data/tree/03baa9d51c50d07a2de44cdd2aa3bcf09b0713fa/data/sets) 的 `foreignData`，只收錄有實際印刷識別碼的中文紀錄。每個名稱保留原始印刷名稱、語言、系列、編號及 Gatherer/Scryfall 識別碼；每份輸入檔的版本與 SHA-256 固定在 `scripts/localization/name-sources.json`。這是出版資料庫來源，不代表已直接連線官網逐張人工核對。查詢完整度也不等於存在官方中文版：新系列與資料庫缺漏可能仍顯示英文。瀏覽器原有 Scryfall 查詢可繼續補充尚未收錄的名字，不改卡圖流程。

更新卡名（原始快照預設快取於 `/tmp/name-printings`，不提交卡圖或整份外部卡庫）：

```sh
node scripts/export-card-text.mjs
node scripts/import-card-names.mjs
```

組牌搜尋、中英文切換、卡牌詳細資訊與對戰預覽共用相同的卡名對照；英文引擎識別名稱維持原值。
