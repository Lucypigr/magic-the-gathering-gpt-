# FIN 最終幻想

本次補齊 FIN 的 306 個不同牌名：293 張主系列非基本地、12 張起始牌組專屬牌，以及 Wastes。五種一般基本地、異圖和重複印刷不另計。所有變更只在 `magic-the-gathering-gpt-` 倉庫。

## 資料與定義

`src/data/sets/fin-catalog.json` 保存完整英文牌面文字、費用、類別、身材及 33 張雙面牌的另一面；`fin-extra.ts` 覆寫原先的簡化效果並補齊缺漏。五張冒險地牌使用冒險施放流程，不作為轉化永久物。

核對日期：2026-10-22。公開資料來源為 [Forge FIN edition](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Final%20Fantasy.txt)、[Forge card scripts](https://github.com/Card-Forge/forge/tree/master/forge-gui/res/cardsfolder) 的 Oracle 欄位，並以 [XMage FIN cards](https://github.com/magefree/mage/tree/master/Mage.Sets/src/mage/cards) 交叉核對部分雙面牌名稱。這些是規則資料鏡像，不是 Wizards 官方 API。

## 主要規則

- Job select 派出無色 Hero 並結附裝備，賦予職業類別與裝備異能。
- Tiered 選擇額外費用、Kicker 的犧牲或回手費用、返照與付費時機。
- 召喚生物傳紀的章節、傳紀指示物、最後章節犧牲，以及角色放逐後以背面進場、最後章節再回正面的流程。
- 轉化、融合、冒險地牌、墳墓場／放逐區施放、終命指示物與施放後改為放逐。
- 實際支付法力、Vivi 產法力、限定用途法力、Gogo 複製堆疊異能、額外戰鬥／回合／結束步驟。
- 水晶的生命、指示物、磨牌與放逐取代；傷害重導、防止、加倍；角色與裝備的動態數值。
- Cid 可放任意數量同名牌，Wastes 作為基本地處理。

## 驗證及限制

`tests/fin.test.ts` 核對全目錄與代表性互動，另外執行全專案回歸、型別檢查、正式建置及瀏覽器進入對戰檢查。測試項目與結果以該提交及 CI 為準。

後續新增 25 個 [ECL／FIN 跨系列互動測試](ecl-fin-audit.md)，涵蓋傷害、衍生物取代順序、雙面牌、複製、指示物及離場處理；該紀錄列出修正與剩餘限制。

306 張均有可執行定義，但這不代表已窮舉所有 Comprehensive Rules 組合。引擎沿用既有的複製及永久物定義替換模型，尚未完整實作連續效果各層的相依性、任意數量同時取代效果的玩家排序，以及所有跨系列複製／融合互動。部分規則選擇使用獨立模式或異能按鈕呈現；AI 的策略也不代表最佳規則選擇。不能據此宣稱所有互動已 100% 通過官方裁定驗證。

## 牌張清單

以下編號保留來源中首次出現的印刷編號，起始牌組專屬牌可能早於 jumpstart 區段列於異圖清單。

| 編號 | 牌名 |
| --- | --- |
| 001 | Summon: Bahamut |
| 002 | Ultima, Origin of Oblivion |
| 003 | Adelbert Steiner |
| 004 | Aerith Gainsborough |
| 005 | Aerith Rescue Mission |
| 006 | Ambrosia Whiteheart |
| 007 | Ashe, Princess of Dalmasca |
| 008 | Auron's Inspiration |
| 009 | Battle Menu |
| 010 | Cloud, Midgar Mercenary |
| 011 | Cloudbound Moogle |
| 012 | Coeurl |
| 013 | Crystal Fragments |
| 014 | The Crystal's Chosen |
| 015 | Delivery Moogle |
| 016 | Dion, Bahamut's Dominant |
| 017 | Dragoon's Lance |
| 018 | Dwarven Castle Guard |
| 019 | Fate of the Sun-Cryst |
| 020 | From Father to Son |
| 021 | G'raha Tia |
| 022 | Gaelicat |
| 023 | Machinist's Arsenal |
| 024 | Magitek Armor |
| 025 | Magitek Infantry |
| 026 | Minwu, White Mage |
| 027 | Moogles' Valor |
| 028 | Paladin's Arms |
| 029 | Phoenix Down |
| 030 | Restoration Magic |
| 031 | Sidequest: Catch a Fish |
| 032 | Slash of Light |
| 033 | Snow Villiers |
| 034 | Stiltzkin, Moogle Merchant |
| 035 | Summon: Choco/Mog |
| 036 | Summon: Knights of Round |
| 037 | Summon: Primal Garuda |
| 038 | Ultima |
| 039 | Venat, Heart of Hydaelyn |
| 040 | Weapons Vendor |
| 041 | White Auracite |
| 042 | White Mage's Staff |
| 043 | The Wind Crystal |
| 044 | You're Not Alone |
| 045 | Zack Fair |
| 046 | Astrologian's Planisphere |
| 047 | Cargo Ship |
| 048 | Combat Tutorial |
| 049 | Dragoon's Wyvern |
| 050 | Dreams of Laguna |
| 051 | Edgar, King of Figaro |
| 052 | Eject |
| 053 | Ether |
| 054 | Gogo, Master of Mimicry |
| 055 | Ice Flan |
| 056 | Ice Magic |
| 057 | Il Mheg Pixie |
| 058 | Jill, Shiva's Dominant |
| 059 | Louisoix's Sacrifice |
| 060 | The Lunar Whale |
| 061 | Magic Damper |
| 062 | Matoya, Archon Elder |
| 063 | Memories Returning |
| 064 | The Prima Vista |
| 065 | Qiqirn Merchant |
| 066 | Quistis Trepe |
| 067 | Relm's Sketching |
| 068 | Retrieve the Esper |
| 069 | Rook Turret |
| 070 | Sage's Nouliths |
| 071 | Sahagin |
| 072 | Scorpion Sentinel |
| 073 | Sidequest: Card Collection |
| 074 | Sleep Magic |
| 075 | Stolen Uniform |
| 076 | Stuck in Summoner's Sanctum |
| 077 | Summon: Leviathan |
| 078 | Summon: Shiva |
| 079 | Swallowed by Leviathan |
| 080 | Syncopate |
| 081 | Thief's Knife |
| 082 | Travel the Overworld |
| 083 | Ultros, Obnoxious Octopus |
| 084 | Valkyrie Aerial Unit |
| 085 | The Water Crystal |
| 086 | Y'shtola Rhul |
| 087 | Ahriman |
| 088 | Al Bhed Salvagers |
| 089 | Ardyn, the Usurper |
| 090 | Black Mage's Rod |
| 091 | Cecil, Dark Knight |
| 092 | Circle of Power |
| 093 | Cornered by Black Mages |
| 094 | Dark Confidant |
| 095 | Dark Knight's Greatsword |
| 096 | The Darkness Crystal |
| 097 | Demon Wall |
| 098 | Evil Reawakened |
| 099 | Fang, Fearless l'Cie |
| 100 | Fight On! |
| 101 | The Final Days |
| 102 | Gaius van Baelsar |
| 103 | Hecteyes |
| 104 | Jecht, Reluctant Guardian |
| 105 | Kain, Traitorous Dragoon |
| 106 | Malboro |
| 107 | Namazu Trader |
| 108 | Ninja's Blades |
| 109 | Overkill |
| 110 | Phantom Train |
| 111 | Poison the Waters |
| 112 | Qutrub Forayer |
| 113 | Reno and Rude |
| 114 | Resentful Revelation |
| 115 | Sephiroth, Fabled SOLDIER |
| 116 | Sephiroth's Intervention |
| 117 | Shambling Cie'th |
| 118 | Shinra Reinforcements |
| 119 | Sidequest: Hunt the Mark |
| 120 | Summon: Anima |
| 121 | Summon: Primal Odin |
| 122 | Tonberry |
| 123 | Undercity Dire Rat |
| 124 | Vayne's Treachery |
| 125 | Vincent Valentine |
| 126 | Vincent's Limit Break |
| 127 | Zenos yae Galvus |
| 128 | Zodiark, Umbral God |
| 129 | Barret Wallace |
| 130 | Blazing Bomb |
| 131 | Call the Mountain Chocobo |
| 132 | Choco-Comet |
| 133 | Clive, Ifrit's Dominant |
| 134 | Coral Sword |
| 135 | The Fire Crystal |
| 136 | Fire Magic |
| 137 | Firion, Wild Rose Warrior |
| 138 | Freya Crescent |
| 139 | Gilgamesh, Master-at-Arms |
| 140 | Haste Magic |
| 141 | Hill Gigas |
| 142 | Item Shopkeep |
| 143 | Laughing Mad |
| 144 | Light of Judgment |
| 145 | Mysidian Elder |
| 146 | Nibelheim Aflame |
| 147 | Opera Love Song |
| 148 | Prompto Argentum |
| 149 | Queen Brahne |
| 150 | Random Encounter |
| 151 | Raubahn, Bull of Ala Mhigo |
| 152 | Red Mage's Rapier |
| 153 | Sabotender |
| 154 | Samurai's Katana |
| 155 | Sandworm |
| 156 | Seifer Almasy |
| 157 | Self-Destruct |
| 158 | Sidequest: Play Blitzball |
| 159 | Sorceress's Schemes |
| 160 | Summon: Brynhildr |
| 161 | Summon: Esper Ramuh |
| 162 | Summon: G.F. Cerberus |
| 163 | Summon: G.F. Ifrit |
| 164 | Suplex |
| 165 | Thunder Magic |
| 166 | Triple Triad |
| 167 | Unexpected Request |
| 168 | Vaan, Street Thief |
| 169 | Warrior's Sword |
| 170 | Zell Dincht |
| 171 | Airship Crash |
| 172 | Ancient Adamantoise |
| 173 | Balamb T-Rexaur |
| 174 | Bard's Bow |
| 175 | Bartz and Boko |
| 176 | Blitzball Shot |
| 177 | Cactuar |
| 178 | Chocobo Kick |
| 179 | Chocobo Racetrack |
| 180 | Clash of the Eikons |
| 181 | Coliseum Behemoth |
| 182 | Commune with Beavers |
| 183 | Diamond Weapon |
| 184 | The Earth Crystal |
| 185 | Esper Origins |
| 186 | Galuf's Final Act |
| 187 | Gigantoad |
| 188 | Goobbue Gardener |
| 189 | Gran Pulse Ochu |
| 190 | Gysahl Greens |
| 191 | Jumbo Cactuar |
| 192 | Loporrit Scout |
| 193 | Prishe's Wanderings |
| 194 | Quina, Qu Gourmet |
| 195 | Reach the Horizon |
| 196 | A Realm Reborn |
| 197 | Ride the Shoopuf |
| 198 | Rydia's Return |
| 199 | Sazh Katzroy |
| 200 | Sazh's Chocobo |
| 201 | Sidequest: Raise a Chocobo |
| 202 | Summon: Fat Chocobo |
| 203 | Summon: Fenrir |
| 204 | Summon: Titan |
| 205 | Summoner's Grimoire |
| 206 | Tifa Lockhart |
| 207 | Tifa's Limit Break |
| 208 | Torgal, A Fine Hound |
| 209 | Town Greeter |
| 210 | Traveling Chocobo |
| 211 | Vanille, Cheerful l'Cie |
| 212 | Absolute Virtue |
| 213 | Balthier and Fran |
| 214 | Black Waltz No. 3 |
| 215 | Choco, Seeker of Paradise |
| 216 | Cid, Timeless Artificer |
| 217 | Cloud of Darkness |
| 218 | Emet-Selch, Unsundered |
| 219 | The Emperor of Palamecia |
| 220 | Exdeath, Void Warlock |
| 221 | Garland, Knight of Cornelia |
| 222 | Garnet, Princess of Alexandria |
| 223 | Giott, King of the Dwarves |
| 224 | Gladiolus Amicitia |
| 225 | Golbez, Crystal Collector |
| 226 | Hope Estheim |
| 227 | Ignis Scientia |
| 228 | Jenova, Ancient Calamity |
| 229 | Joshua, Phoenix's Dominant |
| 230 | Judge Magister Gabranth |
| 231 | Kefka, Court Mage |
| 232 | Kuja, Genome Sorcerer |
| 233 | Lightning, Army of One |
| 234 | Locke Cole |
| 235 | Noctis, Prince of Lucis |
| 236 | Omega, Heartless Evolution |
| 237 | Rinoa Heartilly |
| 238 | Rufus Shinra |
| 239 | Rydia, Summoner of Mist |
| 240 | Serah Farron |
| 241 | Shantotto, Tactician Magician |
| 242 | Sin, Spira's Punishment |
| 243 | Squall, SeeD Mercenary |
| 244 | Tellah, Great Sage |
| 245 | Terra, Magical Adept |
| 246 | Tidus, Blitzball Star |
| 247 | Ultimecia, Time Sorceress |
| 248 | Vivi Ornitier |
| 249 | The Wandering Minstrel |
| 250 | Yuna, Hope of Spira |
| 251 | Zidane, Tantalus Thief |
| 252 | Adventurer's Airship |
| 253 | Aettir and Priwen |
| 254 | Blitzball |
| 255 | Buster Sword |
| 256 | Elixir |
| 257 | Excalibur II |
| 258 | Genji Glove |
| 259 | Instant Ramen |
| 260 | Iron Giant |
| 261 | Lion Heart |
| 262 | Lunatic Pandora |
| 263 | Magic Pot |
| 264 | The Masamune |
| 265 | Monk's Fist |
| 266 | PuPu UFO |
| 267 | The Regalia |
| 268 | Relentless X-ATM092 |
| 269 | Ring of the Lucii |
| 270 | World Map |
| 271 | Adventurer's Inn |
| 272 | Balamb Garden, SeeD Academy |
| 273 | Baron, Airship Kingdom |
| 274 | Capital City |
| 275 | Clive's Hideaway |
| 276 | Crossroads Village |
| 277 | Eden, Seat of the Sanctum |
| 278 | Gohn, Town of Ruin |
| 279 | The Gold Saucer |
| 280 | Gongaga, Reactor Town |
| 281 | Guadosalam, Farplane Gateway |
| 282 | Insomnia, Crown City |
| 283 | Ishgard, the Holy See |
| 284 | Jidoor, Aristocratic Capital |
| 285 | Lindblum, Industrial Regency |
| 286 | Midgar, City of Mako |
| 287 | Rabanastre, Royal City |
| 288 | Sharlayan, Nation of Scholars |
| 289 | Starting Town |
| 290 | Treno, Dark City |
| 291 | Vector, Imperial Capital |
| 292 | Windurst, Federation Center |
| 293 | Zanarkand, Ancient Metropolis |
| 426 | Beatrix, Loyal General |
| 431 | Rosa, Resolute White Mage |
| 441 | Ultimecia, Temporal Threat |
| 452 | Seymour Flux |
| 462 | Lightning, Security Sergeant |
| 482 | Cloud, Planet's Champion |
| 505 | Sephiroth, Planet's Heir |
| 516 | Xande, Dark Mage |
| 557 | Deadly Embrace |
| 559 | Judgment Bolt |
| 562 | Magitek Scythe |
| 563 | Ultima Weapon |
| 309 | Wastes |
