# Modern 卡池與套牌缺口

卡片合法性依 MTGJSON **2026-10-23** 快照；50 份 Modern 牌表來自 Forge Extras 的 Current Modern Metagame 壓縮包，ZIP 內牌表日期為 **2026-10-17**。這是固定版本的盤點，沒有宣稱是今日官方最新禁牌或即時環境排名。

## 盤點結果

- Modern 來源清單共 118 個產品；排除 11 個純重印、入門及合併產品後，核心／擴充與直接加入 Modern 的特別系列共 **107 個**。
- 依『牌名是否有可載入定義』判斷，完整 **18 個**，未完整 **89 個**；其中 **7 個**完全沒有非基本地牌名。其餘未齊系列已有部分同名重印牌，不是整個系列都空白。
- 合法 Modern 卡池共 **22,708 種牌名**，遊戲已有 **5,219 種**（23.0%），缺 **17,489 種**。同名跨系列重印只算一次，基本地包含在此卡池總數。
- 50 份牌表樣本中，主牌能完整還原 **0/50**；包含備牌能完整還原 **0/50**。這 50 份牌表合計缺 **391 種不同的牌**。

這裡統計的是遊戲是否收錄，不是帳號已擁有幾張，也不使用顏色／法術力相近牌來代換。同名可找到定義不代表卡片的所有官方效果已驗證；相關限制見 [逐卡測試](per-card-tests.md)。

遊戲目前只有 free／standard 賽制，尚無獨立 Modern 合法性與禁牌篩選；熱門牌組資料來源也仍是 Standard。遊戲的既有牌庫可用來組部分 Modern 合法套牌，但不能因此視為已支援 Modern 環境。現有對局也沒有完整的局間換備牌流程。

## 優先補的 Modern 系列

| 系列 | 名稱 | 已收錄 | 全系列非基本地 | 尚缺 |
|---|---|---:|---:|---:|
| MH3 | Modern Horizons 3 | 0 | 303 | 303 |
| MH2 | Modern Horizons 2 | 1 | 304 | 303 |
| MH1 | Modern Horizons | 7 | 250 | 243 |
| LTR | The Lord of the Rings: Tales of Middle-earth | 0 | 284 | 284 |
| ACR | Assassin's Creed | 4 | 133 | 129 |

如果目標是先還原競技牌表，先補這 50 份樣本共缺的 391 種牌，比直接補完整 17,489 種卡池更集中。仍需逐張實作／驗證效果與加入賽制支援，不能只匯入顯示文字。

## 現有系列的新發現

- MKM 原本的 271 張主清單之外，MTGJSON 還收錄 3 張 Modern 合法特殊編號牌：Melek, Reforged Researcher（430）、Tomik, Wielder of Law（431）、Voja, Jaws of the Conclave（432）。這次完整系列分母為 274，三張都尚未收錄。
- FRA 已有 280／280 張非基本地；也列入本次盤點。完整 18 系列因此包含 FRA，並未把只收錄 271／274 的 MKM 算成完整。
- FIN 在先前主清單中含 Wastes。此處系列表排除所有基本地，所以 FIN 為 305／305；不是刪掉或漏算該卡。
- 系列表分母包含該系列全部非基本地獨立牌（含目前禁牌）；Modern 合法卡池總數則排除禁牌。兩者目的及分母不同，各系列缺牌不能直接相加當作不同牌名總數。

## 50 份牌表樣本

來源前綴 #01 等是上游檔名順序，不另宣稱即時排名。所有 50 份牌表的牌名在此次 Modern 合法性快照中都合法；盤點只做牌名與基本張數檢查，不是賽事裁判認證。Amulet Titan 的來源主牌為 61 張，保留原數量。

| 樣本牌表 | 主牌已收錄／總張數 | 備牌已收錄／總張數 | 還缺幾種牌 |
|---|---:|---:|---:|
| [Modern] #01 - Eldrazi | 10/60 | 1/15 | 23 |
| [Modern] #02 - Eldrazi Ramp | 9/60 | 2/15 | 25 |
| [Modern] #03 - Izzet Prowess | 22/60 | 3/15 | 18 |
| [Modern] #04 - Esper Blink | 24/60 | 3/15 | 17 |
| [Modern] #05 - Affinity | 16/60 | 0/15 | 23 |
| [Modern] #06 - Domain Zoo | 16/60 | 0/15 | 21 |
| [Modern] #07 - Boros Energy | 14/60 | 3/15 | 23 |
| [Modern] #08 - Goryo's Vengeance | 16/60 | 2/15 | 20 |
| [Modern] #09 - Jeskai Energy | 20/60 | 2/15 | 20 |
| [Modern] #10 - Ruby Storm | 14/60 | 0/15 | 22 |
| [Modern] #11 - Mono-Green Basking Broodscale Combo | 8/60 | 1/15 | 25 |
| [Modern] #12 - Azorius Control | 13/60 | 4/15 | 26 |
| [Modern] #13 - Amulet Titan | 10/61 | 5/15 | 26 |
| [Modern] #14 - Tron | 13/60 | 0/15 | 29 |
| [Modern] #15 - Rakdos Midrange | 20/60 | 0/15 | 22 |
| [Modern] #16 - Neobrand | 7/60 | 1/15 | 27 |
| [Modern] #17 - Boros Ponza | 30/60 | 7/15 | 14 |
| [Modern] #18 - Living End | 14/60 | 4/15 | 22 |
| [Modern] #19 - Dimir Midrange | 25/60 | 0/15 | 19 |
| [Modern] #20 - Eldrazi Tron | 18/60 | 2/15 | 20 |
| [Modern] #21 - Belcher | 5/60 | 4/15 | 20 |
| [Modern] #22 - Mono-Green Eldrazi | 12/60 | 1/15 | 22 |
| [Modern] #23 - Izzet Murktide | 15/60 | 2/15 | 22 |
| [Modern] #24 - Yawgmoth | 22/60 | 0/15 | 21 |
| [Modern] #25 - Grixis Reanimator | 13/60 | 4/15 | 19 |
| [Modern] #26 - 4c HollowOne | 18/60 | 3/15 | 19 |
| [Modern] #27 - Devoted Combo | 18/60 | 3/15 | 25 |
| [Modern] #28 - Indomitable Creativity | 17/60 | 1/15 | 24 |
| [Modern] #29 - Dimir Murktide | 20/60 | 1/15 | 24 |
| [Modern] #30 - The Rock | 14/60 | 1/15 | 22 |
| [Modern] #31 - Temur Prowess | 22/60 | 7/15 | 14 |
| [Modern] #32 - Boros Burn | 21/60 | 0/15 | 17 |
| [Modern] #33 - Living End | 14/60 | 4/15 | 20 |
| [Modern] #34 - Hammer Time | 18/60 | 2/15 | 20 |
| [Modern] #35 - Grixis Control | 22/60 | 2/15 | 21 |
| [Modern] #36 - Izzet Steel-Cutter | 17/60 | 1/15 | 24 |
| [Modern] #37 - Song of Creation | 6/60 | 2/15 | 29 |
| [Modern] #38 - Mono-Black Midrange | 5/60 | 1/15 | 27 |
| [Modern] #39 - Death's Shadow | 8/60 | 0/15 | 20 |
| [Modern] #40 - Merfolk | 11/60 | 0/15 | 17 |
| [Modern] #41 - Titan Shift | 19/60 | 3/15 | 25 |
| [Modern] #42 - Jeskai Prowess | 23/60 | 2/15 | 17 |
| [Modern] #43 - 4c Midrange | 21/60 | 2/15 | 23 |
| [Modern] #44 - Rakdos Aggro | 21/60 | 0/15 | 21 |
| [Modern] #45 - Azorius Blink | 17/60 | 6/15 | 15 |
| [Modern] #46 - Bant Blink | 20/61 | 6/15 | 20 |
| [Modern] #47 - Rakdos HollowOne | 17/60 | 2/15 | 19 |
| [Modern] #48 - Mill | 5/60 | 4/15 | 31 |
| [Modern] #49 - Esper Reanimator | 18/60 | 3/15 | 18 |
| [Modern] #50 - Mono-Red Burn | 13/60 | 2/15 | 19 |

## 最常缺的共用牌

下表頻次是這 50 份樣本中有幾副需要該缺牌；主牌與備牌合併，每副只計一次。

| 牌名 | 需要它的樣本數 |
|---|---:|
| Consign to Memory | 25 |
| Mystical Dispute | 19 |
| Arid Mesa | 15 |
| Lightning Bolt | 15 |
| Bloodstained Mire | 14 |
| Fatal Push | 14 |
| Flooded Strand | 14 |
| Force of Negation | 14 |
| Polluted Delta | 14 |
| Scalding Tarn | 14 |
| Grafdigger's Cage | 13 |
| Misty Rainforest | 12 |
| Obsidian Charmaw | 12 |
| Surgical Extraction | 12 |
| Thoughtseize | 12 |
| Boseiju, Who Endures | 11 |
| Mishra's Bauble | 11 |
| Vexing Bauble | 11 |
| Wooded Foothills | 11 |
| Dismember | 9 |
| Endurance | 9 |
| Meltdown | 9 |
| Solitude | 9 |
| Urza's Saga | 9 |
| Force of Vigor | 8 |

## 全部系列的收錄進度

| 系列 | 名稱 | 已收錄 | 全系列非基本地 | 尚缺 |
|---|---|---:|---:|---:|
| 8ED | Eighth Edition | 22 | 337 | 315 |
| MRD | Mirrodin | 7 | 286 | 279 |
| DST | Darksteel | 3 | 165 | 162 |
| 5DN | Fifth Dawn | 0 | 165 | 165 |
| CHK | Champions of Kamigawa | 3 | 286 | 283 |
| BOK | Betrayers of Kamigawa | 0 | 165 | 165 |
| SOK | Saviors of Kamigawa | 1 | 165 | 164 |
| 9ED | Ninth Edition | 26 | 339 | 313 |
| RAV | Ravnica: City of Guilds | 10 | 286 | 276 |
| GPT | Guildpact | 5 | 165 | 160 |
| DIS | Dissension | 6 | 180 | 174 |
| CSP | Coldsnap | 2 | 150 | 148 |
| TSP | Time Spiral | 4 | 281 | 277 |
| TSB | Time Spiral Timeshifted | 2 | 121 | 119 |
| PLC | Planar Chaos | 0 | 165 | 165 |
| FUT | Future Sight | 2 | 180 | 178 |
| 10E | Tenth Edition | 28 | 363 | 335 |
| LRW | Lorwyn | 4 | 281 | 277 |
| MOR | Morningtide | 5 | 150 | 145 |
| SHM | Shadowmoor | 1 | 281 | 280 |
| EVE | Eventide | 1 | 180 | 179 |
| ALA | Shards of Alara | 3 | 229 | 226 |
| CON | Conflux | 2 | 145 | 143 |
| ARB | Alara Reborn | 1 | 145 | 144 |
| M10 | Magic 2010 | 32 | 229 | 197 |
| ZEN | Zendikar | 12 | 229 | 217 |
| WWK | Worldwake | 4 | 145 | 141 |
| ROE | Rise of the Eldrazi | 7 | 228 | 221 |
| M11 | Magic 2011 | 27 | 229 | 202 |
| SOM | Scars of Mirrodin | 9 | 229 | 220 |
| MBS | Mirrodin Besieged | 4 | 145 | 141 |
| NPH | New Phyrexia | 0 | 165 | 165 |
| M12 | Magic 2012 | 25 | 229 | 204 |
| ISD | Innistrad | 9 | 249 | 240 |
| DKA | Dark Ascension | 5 | 158 | 153 |
| AVR | Avacyn Restored | 5 | 229 | 224 |
| M13 | Magic 2013 | 29 | 229 | 200 |
| RTR | Return to Ravnica | 22 | 249 | 227 |
| GTC | Gatecrash | 17 | 249 | 232 |
| DGM | Dragon's Maze | 14 | 156 | 142 |
| M14 | Magic 2014 | 21 | 229 | 208 |
| THS | Theros | 11 | 229 | 218 |
| BNG | Born of the Gods | 5 | 165 | 160 |
| JOU | Journey into Nyx | 5 | 165 | 160 |
| M15 | Magic 2015 | 21 | 264 | 243 |
| KTK | Khans of Tarkir | 18 | 249 | 231 |
| FRF | Fate Reforged | 12 | 175 | 163 |
| DTK | Dragons of Tarkir | 14 | 249 | 235 |
| ORI | Magic Origins | 19 | 268 | 249 |
| BFZ | Battle for Zendikar | 8 | 249 | 241 |
| OGW | Oath of the Gatewatch | 6 | 182 | 176 |
| SOI | Shadows over Innistrad | 6 | 282 | 276 |
| EMN | Eldritch Moon | 5 | 205 | 200 |
| KLD | Kaladesh | 18 | 259 | 241 |
| AER | Aether Revolt | 4 | 194 | 190 |
| AKH | Amonkhet | 8 | 267 | 259 |
| HOU | Hour of Devastation | 5 | 194 | 189 |
| XLN | Ixalan | 21 | 269 | 248 |
| RIX | Rivals of Ixalan | 16 | 200 | 184 |
| DOM | Dominaria | 25 | 260 | 235 |
| M19 | Core Set 2019 | 65 | 294 | 229 |
| GRN | Guilds of Ravnica | 22 | 263 | 241 |
| RNA | Ravnica Allegiance | 17 | 263 | 246 |
| WAR | War of the Spark | 9 | 260 | 251 |
| MH1 | Modern Horizons | 7 | 250 | 243 |
| M20 | Core Set 2020 | 57 | 324 | 267 |
| ELD | Throne of Eldraine | 20 | 280 | 260 |
| THB | Theros Beyond Death | 11 | 268 | 257 |
| IKO | Ikoria: Lair of Behemoths | 20 | 260 | 240 |
| M21 | Core Set 2021 | 52 | 280 | 228 |
| ZNR | Zendikar Rising | 13 | 265 | 252 |
| KHM | Kaldheim | 12 | 295 | 283 |
| STX | Strixhaven: School of Mages | 4 | 275 | 271 |
| MH2 | Modern Horizons 2 | 1 | 304 | 303 |
| AFR | Adventures in the Forgotten Realms | 3 | 261 | 258 |
| MID | Innistrad: Midnight Hunt | 15 | 267 | 252 |
| VOW | Innistrad: Crimson Vow | 17 | 267 | 250 |
| NEO | Kamigawa: Neon Dynasty | 16 | 282 | 266 |
| SNC | Streets of New Capenna | 12 | 261 | 249 |
| DMU | Dominaria United | 19 | 266 | 247 |
| BRO | The Brothers' War | 13 | 272 | 259 |
| ONE | Phyrexia: All Will Be One | 14 | 266 | 252 |
| MOM | March of the Machine | 16 | 291 | 275 |
| MAT | March of the Machine: The Aftermath | 0 | 50 | 50 |
| LTR | The Lord of the Rings: Tales of Middle-earth | 0 | 284 | 284 |
| WOE | Wilds of Eldraine | 276 | 276 | 0 |
| LCI | The Lost Caverns of Ixalan | 286 | 286 | 0 |
| MKM | Murders at Karlov Manor | 271 | 274 | 3 |
| OTJ | Outlaws of Thunder Junction | 271 | 271 | 0 |
| BIG | The Big Score | 2 | 30 | 28 |
| MH3 | Modern Horizons 3 | 0 | 303 | 303 |
| ACR | Assassin's Creed | 4 | 133 | 129 |
| BLB | Bloomburrow | 274 | 274 | 0 |
| DSK | Duskmourn: House of Horror | 271 | 271 | 0 |
| FDN | Foundations | 512 | 512 | 0 |
| DFT | Aetherdrift | 271 | 271 | 0 |
| TDM | Tarkir: Dragonstorm | 271 | 271 | 0 |
| FIN | Final Fantasy | 305 | 305 | 0 |
| EOE | Edge of Eternities | 261 | 261 | 0 |
| SPM | Marvel's Spider-Man | 188 | 188 | 0 |
| TLA | Avatar: The Last Airbender | 281 | 281 | 0 |
| ECL | Lorwyn Eclipsed | 268 | 268 | 0 |
| TMT | Teenage Mutant Ninja Turtles | 190 | 190 | 0 |
| SOS | Secrets of Strixhaven | 266 | 266 | 0 |
| MSH | Marvel Super Heroes | 276 | 276 | 0 |
| HOB | The Hobbit | 188 | 188 | 0 |
| FRA | Reality Fracture | 280 | 280 | 0 |

## 來源與重跑

- [MTGJSON 卡片鏡像固定版本](https://github.com/taw/magic-search-engine-data/tree/03baa9d51c50d07a2de44cdd2aa3bcf09b0713fa/data/sets)；依每張卡 legalities.modern == Legal 判斷，沒有沿用遊戲的 Standard 禁牌表。
- [Forge Modern 系列清單](https://github.com/Card-Forge/forge/blob/7c34365c749ca46ab71336c5f267340d6088e600/forge-gui/res/formats/Sanctioned/Modern.txt)；核心／擴充之外納入 MH1、MH2、MH3、LTR、ACR，重印／入門產品不當成額外要補的系列。
- [牌表壓縮包固定版本](https://github.com/Card-Forge/forge-extras/blob/d3783237b98ca3714aeea5796ea593f49f6921cb/decks/currentmodernmetagame.zip)。

每個下載檔案的 SHA-256 鎖定於 `scripts/modern-sources.json`。執行 `python scripts/audit-modern.py --write` 可重建 JSON 及 CSV；預設快取 `/tmp/modern-audit`，缺少檔案時會下載固定版本並驗證。未修改遊戲賽制、卡池、卡圖或原專案。

- [系列完整 CSV](modern-series-gap.csv)
- [50 份套牌缺牌 CSV](modern-deck-gap.csv)
- [全部 Modern 缺牌 CSV](modern-missing-cards.csv)
- [391 種優先補牌 CSV](modern-priority-cards.csv)
- [詳細資料與來源 JSON](modern-gap.json)
