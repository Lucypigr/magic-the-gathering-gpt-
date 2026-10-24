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

`src/data/localization/zh-names.json` 另存中文印刷名稱，優先採用繁體中文出版版次，其次使用簡體中文出版名稱並以 OpenCC 轉為繁體字。後者不是台灣版官方譯名，詳細資訊會標示來源語言，並提供 Gatherer 官方牌張連結。出版資料未涵蓋時，依使用者指定補入中文魔風卡庫的現成名稱，分開標示來源，不把卡庫名稱當作官方印刷譯名。

來源是 [MTGJSON 資料公開快照](https://github.com/taw/magic-search-engine-data/tree/03baa9d51c50d07a2de44cdd2aa3bcf09b0713fa/data/sets) 的 `foreignData`，只收錄有實際印刷識別碼的中文紀錄。每個名稱保留原始印刷名稱、語言、系列、編號及 Gatherer/Scryfall 識別碼；每份輸入檔的版本與 SHA-256 固定在 `scripts/localization/name-sources.json`。這是出版資料庫來源，不代表已直接連線官網逐張人工核對。查詢完整度也不等於存在官方中文版：新系列與資料庫缺漏可能仍顯示英文。瀏覽器原有 Scryfall 查詢可繼續補充尚未收錄的名字，不改卡圖流程。

更新卡名（原始快照預設快取於 `/tmp/name-printings`，不提交卡圖或整份外部卡庫）：

```sh
node scripts/export-card-text.mjs
node scripts/import-card-names.mjs
```

組牌搜尋、中英文切換、卡牌詳細資訊與對戰預覽共用相同的卡名對照；英文引擎識別名稱維持原值。

卡名匯入也包含 `public/netdecks.json` 的主牌與備牌原名；尚未納入遊戲卡池的原牌仍可顯示已出版的中文名稱。替代與未收錄牌列共用名稱對照，不直接固定顯示英文。

## 全卡池與中文卡庫逐筆對照

完整範圍與逐筆清單見 [核對報告](card-name-audit.md)、[CSV](card-name-audit.csv) 及 [統計 JSON](card-name-audit.json)。數量依目前遊戲實際定義計算，不能直接與官網各系列不同印刷版本的數量相加比較。

新增來源為 [MTGZH / magic-cards-zhs 的正式公開快照 data-2026-10-18](https://github.com/HeliumOctahelide/magic-cards-zhs/releases/tag/data-2026-10-18)。上游明確說明其資料包含官方、MTGso 與志願者翻譯；因此逐筆保留 `declaredSource`，只有實際中文印刷紀錄才標成 `published`，其餘標成 `database` 或衍生物的 `terminology`。來源未細分也不升格為官方。標示 GPT/AI 及 stage 0 的名稱不採用。這是以公開資料逐筆比對英文名稱、牌面與識別碼，不宣稱已逐張人工訪問官網。

- `zh-sourced-names.json`：中文卡庫名稱、原始簡體名稱、來源檔行號、版次、牌面及印刷識別碼；只新增顯示對照，不改卡片原值。
- `zh-token-name-overrides.json`：同一內部英文名對應不同實際徽記時，按 ID 分開記錄。
- `scripts/localization/name-aliases.json`：房間以外的遊戲內部衍生物別名，明確記錄對應與原因。房間則逐門對照後組合，不猜譯整張牌名。
- 重音符號、單／雙斜線及彎引號差異只正規化顯示查詢；有歧義的名稱不任意選一筆。英文引擎身份保持不變。

重新取得固定來源及生成報告：

```sh
node scripts/export-card-text.mjs
python scripts/fetch-mtgzh-name-source.py
node scripts/import-sourced-card-names.mjs
node scripts/audit-card-names.mjs
```

快照下載與每個解壓後檔案都驗證 SHA-256；上游的 PostgreSQL COPY 跳脫層會先還原，再解析 JSON Lines。`zhs_card` 即使標示來源印刷為 Chinese Traditional，儲存的文字仍可能已統一簡化，因此另外保留 `printLanguage`，仍將其字形轉為繁體，不冒充未轉寫的台灣印刷原文。原始整庫與圖片不提交，只有名稱對照及必要的出處進入網站。生成過程不翻譯新名稱，也不修改規則、牌名識別或圖片。

卡庫名稱依上游 CC BY-SA 條款再利用，已轉為繁體字、篩選並加入遊戲別名對照；[保留的上游授權](mtgzh-names-license.txt)。原卡牌文字與名稱仍保留各自的權利歸屬。

`tests/sourced-card-names.test.ts` 覆蓋全卡池、各牌面、來源行號、熱門牌表、重音／斜線差異、同名徽記與語言切換。新增卡片後若缺少來源，測試及核對腳本會失敗，不能沿用舊的完成率。
