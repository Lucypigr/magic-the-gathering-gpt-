# ECL 洛溫蝕

收錄主系列編號 001–268 的全部 268 張非基本地牌；其中 Evolving Wilds 沿用共用重印定義，其他 267 張為 ECL 定義。基本地及異圖不重複計數。

牌面費用、類別、身材、雙面牌背面與完整英文規則文字保存在 `src/data/sets/ecl-catalog.json`；可執行效果由 `ecl-extra.ts` 補齊或修正既有定義。不是以牌張數代表規則已全部驗證。

資料核對日期：2026-10-22。文字來源為 [Forge ECL edition](https://github.com/Card-Forge/forge/blob/master/forge-gui/res/editions/Lorwyn%20Eclipsed.txt) 及 [Forge card scripts](https://github.com/Card-Forge/forge/tree/master/forge-gui/res/cardsfolder) 的 Oracle 欄位；雙面牌使用 front_back 牌檔。這是公開規則資料鏡像，不是 Wizards 官方 API。

## 本次規則實作

- Behold 作為額外費用，區分展示、放逐、可改付法力及共用生物類別；離場後交還 champion 放逐的牌。
- 枯萎在施放／起動時支付，包含 X 枯萎、任意種類指示物移除、凋萎傷害及 persist。
- 雙面轉化、第一主要階段觸發、實際支付顏色判斷 evoke 生物的進場效果與犧牲觸發。
- Vivid、部族類別選擇、五種選兩項指令、共謀付費與堆疊複製、Kirol 的觸發異能選擇。
- 受限制法力、基本地法力加成、Shimmerwilds Growth 的顏色及法力、各種放逐區使用權限。
- 光環、裝備、衍生物規格、保護、守護及非生物部族牌（Kindred）的類別。

## 驗證範圍

`tests/ecl.test.ts` 核對全 268 張目錄及代表性機制，另執行全專案回歸、型別檢查、正式建置和瀏覽器啟動檢查。測試並未窮舉每張牌的全部目標及所有跨系列互動。

目前引擎仍以既有的基礎定義替換方式處理部分複製、失去異能及光環效果，未完整實作 Comprehensive Rules 的連續效果層次、相依性與多個同時取代效果的所有排列；例如多個 Mirrormind Crown 或複製另一個具有進場取代效果的生物，仍需個別驗證。生物類別選單包含現有牌庫出現的類別及 ECL 類別，並非完整歷年官方類別字典。故不能宣稱全規則組合 100% 等同官方裁定。

## 主系列清單

| 編號 | 牌名 |
| --- | --- |
| 001 | Changeling Wayfinder |
| 002 | Rooftop Percher |
| 003 | Adept Watershaper |
| 004 | Ajani, Outland Chaperone |
| 005 | Appeal to Eirdu |
| 006 | Bark of Doran |
| 007 | Brigid, Clachan's Heart |
| 008 | Burdened Stoneback |
| 009 | Champion of the Clachan |
| 010 | Clachan Festival |
| 011 | Crib Swap |
| 012 | Curious Colossus |
| 013 | Eirdu, Carrier of Dawn |
| 014 | Encumbered Reejerey |
| 015 | Evershrike's Gift |
| 016 | Flock Impostor |
| 017 | Gallant Fowlknight |
| 018 | Goldmeadow Nomad |
| 019 | Keep Out |
| 020 | Kinbinding |
| 021 | Kinsbaile Aspirant |
| 022 | Kinscaer Sentry |
| 023 | Kithkeeper |
| 024 | Liminal Hold |
| 025 | Meanders Guide |
| 026 | Moonlit Lamenter |
| 027 | Morningtide's Light |
| 028 | Personify |
| 029 | Protective Response |
| 030 | Pyrrhic Strike |
| 031 | Reluctant Dounguard |
| 032 | Rhys, the Evermore |
| 033 | Riverguard's Reflexes |
| 034 | Shore Lurker |
| 035 | Slumbering Walker |
| 036 | Spiral into Solitude |
| 037 | Sun-Dappled Celebrant |
| 038 | Thoughtweft Imbuer |
| 039 | Timid Shieldbearer |
| 040 | Tributary Vaulter |
| 041 | Wanderbrine Preacher |
| 042 | Wanderbrine Trapper |
| 043 | Winnowing |
| 044 | Aquitect's Defenses |
| 045 | Blossombind |
| 046 | Champions of the Shoal |
| 047 | Disruptor of Currents |
| 048 | Flitterwing Nuisance |
| 049 | Glamer Gifter |
| 050 | Glamermite |
| 051 | Glen Elendra Guardian |
| 052 | Glen Elendra's Answer |
| 053 | Gravelgill Scoundrel |
| 054 | Harmonized Crescendo |
| 055 | Illusion Spinners |
| 056 | Kulrath Mystic |
| 057 | Loch Mare |
| 058 | Lofty Dreams |
| 059 | Mirrorform |
| 060 | Noggle the Mind |
| 061 | Oko, Lorwyn Liege |
| 062 | Omni-Changeling |
| 063 | Pestered Wellguard |
| 064 | Rime Chill |
| 065 | Rimefire Torque |
| 066 | Rimekin Recluse |
| 067 | Run Away Together |
| 068 | Shinestriker |
| 069 | Silvergill Mentor |
| 070 | Silvergill Peddler |
| 071 | Spell Snare |
| 072 | Stratosoarer |
| 073 | Summit Sentinel |
| 074 | Sunderflock |
| 075 | Swat Away |
| 076 | Sygg, Wanderwine Wisdom |
| 077 | Tanufel Rimespeaker |
| 078 | Temporal Cleansing |
| 079 | Thirst for Identity |
| 080 | Unexpected Assistance |
| 081 | Unwelcome Sprite |
| 082 | Wanderwine Distracter |
| 083 | Wanderwine Farewell |
| 084 | Wild Unraveling |
| 085 | Auntie's Sentence |
| 086 | Barbed Bloodletter |
| 087 | Bile-Vial Boggart |
| 088 | Bitterbloom Bearer |
| 089 | Blight Rot |
| 090 | Blighted Blackthorn |
| 091 | Bloodline Bidding |
| 092 | Boggart Mischief |
| 093 | Boggart Prankster |
| 094 | Bogslither's Embrace |
| 095 | Champion of the Weird |
| 096 | Creakwood Safewright |
| 097 | Darkness Descends |
| 098 | Dawnhand Dissident |
| 099 | Dawnhand Eulogist |
| 100 | Dose of Dawnglow |
| 101 | Dream Seizer |
| 102 | Gloom Ripper |
| 103 | Gnarlbark Elm |
| 104 | Graveshifter |
| 105 | Grub, Storied Matriarch |
| 106 | Gutsplitter Gang |
| 107 | Heirloom Auntie |
| 108 | Iron-Shield Elf |
| 109 | Moonglove Extractor |
| 110 | Moonshadow |
| 111 | Mornsong Aria |
| 112 | Mudbutton Cursetosser |
| 113 | Nameless Inversion |
| 114 | Nightmare Sower |
| 115 | Perfect Intimidation |
| 116 | Requiting Hex |
| 117 | Retched Wretch |
| 118 | Scarblade Scout |
| 119 | Scarblade's Malice |
| 120 | Shimmercreep |
| 121 | Taster of Wares |
| 122 | Twilight Diviner |
| 123 | Unbury |
| 124 | Ashling, Rekindled |
| 125 | Boldwyr Aggressor |
| 126 | Boneclub Berserker |
| 127 | Boulder Dash |
| 128 | Brambleback Brute |
| 129 | Burning Curiosity |
| 130 | Champion of the Path |
| 131 | Cinder Strike |
| 132 | Collective Inferno |
| 133 | Elder Auntie |
| 134 | End-Blaze Epiphany |
| 135 | Enraged Flamecaster |
| 136 | Explosive Prodigy |
| 137 | Feed the Flames |
| 138 | Flame-Chain Mauler |
| 139 | Flamebraider |
| 140 | Flamekin Gildweaver |
| 141 | Giantfall |
| 142 | Goatnap |
| 143 | Goliath Daydreamer |
| 144 | Gristle Glutton |
| 145 | Hexing Squelcher |
| 146 | Impolite Entrance |
| 147 | Kindle the Inner Flame |
| 148 | Kulrath Zealot |
| 149 | Lasting Tarfire |
| 150 | Lavaleaper |
| 151 | Meek Attack |
| 152 | Reckless Ransacking |
| 153 | Scuzzback Scrounger |
| 154 | Sear |
| 155 | Sizzling Changeling |
| 156 | Soul Immolation |
| 157 | Soulbright Seeker |
| 158 | Sourbread Auntie |
| 159 | Spinerock Tyrant |
| 160 | Squawkroaster |
| 161 | Sting-Slinger |
| 162 | Tweeze |
| 163 | Warren Torchmaster |
| 164 | Assert Perfection |
| 165 | Aurora Awakener |
| 166 | Bloom Tender |
| 167 | Blossoming Defense |
| 168 | Bristlebane Battler |
| 169 | Bristlebane Outrider |
| 170 | Celestial Reunion |
| 171 | Champions of the Perfect |
| 172 | Chomping Changeling |
| 173 | Crossroads Watcher |
| 174 | Dawn's Light Archer |
| 175 | Dundoolin Weaver |
| 176 | Formidable Speaker |
| 177 | Gilt-Leaf's Embrace |
| 178 | Great Forest Druid |
| 179 | Luminollusk |
| 180 | Lys Alana Dignitary |
| 181 | Lys Alana Informant |
| 182 | Midnight Tilling |
| 183 | Mistmeadow Council |
| 184 | Moon-Vigil Adherents |
| 185 | Morcant's Eyes |
| 186 | Mutable Explorer |
| 187 | Pitiless Fists |
| 188 | Prismabasher |
| 189 | Prismatic Undercurrents |
| 190 | Pummeler for Hire |
| 191 | Safewright Cavalry |
| 192 | Sapling Nursery |
| 193 | Selfless Safewright |
| 194 | Shimmerwilds Growth |
| 195 | Spry and Mighty |
| 196 | Surly Farrier |
| 197 | Tend the Sprigs |
| 198 | Thoughtweft Charge |
| 199 | Trystan, Callous Cultivator |
| 200 | Unforgiving Aim |
| 201 | Vinebred Brawler |
| 202 | Virulent Emissary |
| 203 | Wildvine Pummeler |
| 204 | Abigale, Eloquent First-Year |
| 205 | Ashling's Command |
| 206 | Boggart Cursecrafter |
| 207 | Bre of Clan Stoutarm |
| 208 | Brigid's Command |
| 209 | Catharsis |
| 210 | Chaos Spewer |
| 211 | Chitinous Graspling |
| 212 | Deceit |
| 213 | Deepchannel Duelist |
| 214 | Deepway Navigator |
| 215 | Doran, Besieged by Time |
| 216 | Dream Harvest |
| 217 | Eclipsed Boggart |
| 218 | Eclipsed Elf |
| 219 | Eclipsed Flamekin |
| 220 | Eclipsed Kithkin |
| 221 | Eclipsed Merrow |
| 222 | Emptiness |
| 223 | Feisty Spikeling |
| 224 | Figure of Fable |
| 225 | Flaring Cinder |
| 226 | Gangly Stompling |
| 227 | Glister Bairn |
| 228 | Grub's Command |
| 229 | High Perfect Morcant |
| 230 | Hovel Hurler |
| 231 | Kirol, Attentive First-Year |
| 232 | Lluwen, Imperfect Naturalist |
| 233 | Maralen, Fae Ascendant |
| 234 | Merrow Skyswimmer |
| 235 | Mischievous Sneakling |
| 236 | Morcant's Loyalist |
| 237 | Noggle Robber |
| 238 | Prideful Feastling |
| 239 | Raiding Schemes |
| 240 | Reaping Willow |
| 241 | Sanar, Innovative First-Year |
| 242 | Shadow Urchin |
| 243 | Stoic Grove-Guide |
| 244 | Sygg's Command |
| 245 | Tam, Mindful First-Year |
| 246 | Thoughtweft Lieutenant |
| 247 | Trystan's Command |
| 248 | Twinflame Travelers |
| 249 | Vibrance |
| 250 | Voracious Tome-Skimmer |
| 251 | Wary Farmer |
| 252 | Wistfulness |
| 253 | Chronicle of Victory |
| 254 | Dawn-Blessed Pennant |
| 255 | Firdoch Core |
| 256 | Foraging Wickermaw |
| 257 | Gathering Stone |
| 258 | Mirrormind Crown |
| 259 | Puca's Eye |
| 260 | Springleaf Drum |
| 261 | Stalactite Dagger |
| 262 | Blood Crypt |
| 263 | Eclipsed Realms |
| 264 | Evolving Wilds |
| 265 | Hallowed Fountain |
| 266 | Overgrown Tomb |
| 267 | Steam Vents |
| 268 | Temple Garden |
