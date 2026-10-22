# TMT 牌文與實作核對

2026-10-22 核對主系列 001–190，包含原先已完成的卡。比對依據是 `tmt-catalog.json` 的完整英文牌文；資料來源是 Forge 的 Oracle 欄位與 XMage（Bespoke Bō），並非本次向 Wizards 即時查詢的結果。

本表記錄程式核對範圍與具體修正，**不是每張卡所有互動都已測完的認證**。`tests/tmt-rules.test.ts` 檢查全部 TMT 定義的完整牌文、費用、類別、身材與循環資料，並對發現的錯誤作行為回歸測試；`tests/tmt.test.ts` 保留原有機制測試。Negate 共用其他系列的既有定義。

除了下表的卡牌修正，共享引擎也補上：目標離場再回場視為新物件、TMT 傳奇永久物保留選擇、各類指示物事件、TMT 守護的付款／反擊觸發、法術力異能立即結算，以及跨回合延遲觸發與來源實例追蹤。

| 編號 | 卡牌 | 核對／修正 |
| --- | --- | --- |
| 001 | Action News Crew | 補回通魂手牌異能 |
| 002 | Agent Bishop, Man in Black | 目標可包含對手生物 |
| 003 | April O'Neil, Kunoichi Trainee | 牌文與對應實作逐項比對 |
| 004 | Dimensional Exile | 牌文與對應實作逐項比對 |
| 005 | East Wind Avatar | 牌文與對應實作逐項比對 |
| 006 | Featherbrained Filcher | 牌文與對應實作逐項比對 |
| 007 | Grounded for Life | 牌文與對應實作逐項比對 |
| 008 | Hamato Guardian Stance | 牌文與對應實作逐項比對 |
| 009 | High-Flying Ace | 補回賦予飛行的法術時機異能 |
| 010 | Jennika, Bad Apple Big Sister | 補回平原循環 |
| 011 | Koya, Death from Above | 延遲付款不依賴來源仍在場 |
| 012 | The Last Ronin's Technique | 牌文與對應實作逐項比對 |
| 013 | Leader's Talent | 含自身、任意指示物；等級異能離場後仍結算 |
| 014 | Leonardo, Big Brother | 牌文與對應實作逐項比對 |
| 015 | Leonardo, Cutting Edge | 牌文與對應實作逐項比對 |
| 016 | Leonardo, Leader in Blue | 牌文與對應實作逐項比對 |
| 017 | Leonardo, Sewer Samurai | 牌文與對應實作逐項比對 |
| 018 | Leonardo's Technique | 牌文與對應實作逐項比對 |
| 019 | Lita, Little Orphan Amphibian | 觸發上堆疊時選模式，每回合不可重選 |
| 020 | Make Your Move | 牌文與對應實作逐項比對 |
| 021 | Mighty Mutanimals | 牌文與對應實作逐項比對 |
| 022 | Prehistoric Pet | 牌文與對應實作逐項比對 |
| 023 | Quintessential Katana | 分配至數個阻擋者只觸發一次；忍者獲授異能可加倍 |
| 024 | Sally Pride, Lioness Leader | 牌文與對應實作逐項比對 |
| 025 | Triceraton Commander | 牌文與對應實作逐項比對 |
| 026 | Turncoat Kunoichi | 牌文與對應實作逐項比對 |
| 027 | Turtles Forever | 牌文與對應實作逐項比對 |
| 028 | Uneasy Alliance | 補回犧牲光環放逐與派出忍者 |
| 029 | April O'Neil, Hacktivist | 牌文與對應實作逐項比對 |
| 030 | April, Reporter of the Weird | 牌文與對應實作逐項比對 |
| 031 | Bespoke Bō | 牌文與對應實作逐項比對 |
| 032 | Buzz Bots | 牌文與對應實作逐項比對 |
| 033 | Crustacean Commando | 牌文與對應實作逐項比對 |
| 034 | Does Machines | 升級與升級觸發分開上堆疊 |
| 035 | Donatello, Gadget Master | 牌文與對應實作逐項比對 |
| 036 | Donatello, Mutant Mechanic | 繼承各種指示物；先放指示物再動畫 |
| 037 | Donatello, Turtle Techie | 牌文與對應實作逐項比對 |
| 038 | Donatello, Way with Machines | 牌文與對應實作逐項比對 |
| 039 | Donatello's Technique | 牌文與對應實作逐項比對 |
| 040 | Fugitive Droid | 限制可反擊咒語的合法目標 |
| 041 | Kitsune, Dragon's Daughter | 兩目標需不同操控者；交換後召喚失調且移出戰鬥 |
| 042 | Kitsune's Technique | 牌文與對應實作逐項比對 |
| 043 | Krang, Master Mind | 少於四張手牌是介入條件 |
| 044 | Metalhead | 牌文與對應實作逐項比對 |
| 045 | Mind Transfer Protocol | 同時成為神器與生物 |
| 046 | Mondo Gecko | 選擇棄牌費用；多次起動保留各色辟邪 |
| 047 | Negate | 牌文與對應實作逐項比對 |
| 048 | Ooze Spill | 補回派出突變劑 |
| 049 | Ray Fillet, Man Ray | 玩家選擇從哪個生物移除指示物 |
| 050 | Renet, Temporal Apprentice | 牌文與對應實作逐項比對 |
| 051 | Retro-Mutation | 立即適用0/1、龜類別與失去異能 |
| 052 | Return to the Sewers | 牌文與對應實作逐項比對 |
| 053 | Sewer-veillance Cam | 牌文與對應實作逐項比對 |
| 054 | Stockman, Mad Fly-entist | 補回海島循環 |
| 055 | Turtles in Time | 玩家先決定是否洗回，再處理；咒語結算後放逐 |
| 056 | Utrom Scientists | 牌文與對應實作逐項比對 |
| 057 | Anchovy & Banana Pizza | 牌文與對應實作逐項比對 |
| 058 | Armaggon, Future Shark | 可指定任意玩家的生物 |
| 059 | Bebop, Warthog Warrior | 牌文與對應實作逐項比對 |
| 060 | The Cloning of Shredder | 牌文與對應實作逐項比對 |
| 061 | Death in the Family | 牌文與對應實作逐項比對 |
| 062 | Dream Beavers | 牌文與對應實作逐項比對 |
| 063 | Foot Mystic | 補回消逝進場派出忍者 |
| 064 | Insectoid Exterminator | 牌文與對應實作逐項比對 |
| 065 | Lord Dregg, Insect Invader | 牌文與對應實作逐項比對 |
| 066 | Madame Null, Power Broker | 牌文與對應實作逐項比對 |
| 067 | Ninja Teen | 包含自身；原生與授予的潛行費用分開提供 |
| 068 | Oroku Saki, Shredder Rising | 牌文與對應實作逐項比對 |
| 069 | Pain 101 | 賦予真正死亡觸發，可受忍者觸發加倍 |
| 070 | Paramecia Coloniex | 放逐後才選擇反射觸發目標 |
| 071 | Rat King, Verminister | 玩家選擇犧牲三隻老鼠；老鼠能正常阻擋 |
| 072 | Savanti Romero, Time's Exile | 牌文與對應實作逐項比對 |
| 073 | Shark Shredder, Killer Clone | 牌文與對應實作逐項比對 |
| 074 | Shredder, Unrelenting | 牌文與對應實作逐項比對 |
| 075 | Shredder's Armor | 牌文與對應實作逐項比對 |
| 076 | Shredder's Revenge | 兩模式均可指定任一玩家 |
| 077 | Shredder's Technique | 牌文與對應實作逐項比對 |
| 078 | South Wind Avatar | 依死亡生物最後的防禦力獲得生命 |
| 079 | Splinter, Hamato Yoshi | 牌文與對應實作逐項比對 |
| 080 | Splinter's Technique | 牌文與對應實作逐項比對 |
| 081 | Squirrelanoids | 牌文與對應實作逐項比對 |
| 082 | Stomped by the Foot | 牌文與對應實作逐項比對 |
| 083 | Super Shredder | 觸發範圍改為任何其他永久物離場 |
| 084 | Tunnel Rats | 補回墳墓場起動回場 |
| 085 | Bot Bashing Time | 補回本回合死去改放逐 |
| 086 | Broadcast Takeover | 牌文與對應實作逐項比對 |
| 087 | Casey Jones, Jury-Rig Justiciar | 可不取神器；其餘隨機置底 |
| 088 | Casey Jones, Vigilante | 牌文與對應實作逐項比對 |
| 089 | Cool but Rude | 每張棄牌分別觸發；等級3另開觸發 |
| 090 | General Traag, Heart of Stone | 牌文與對應實作逐項比對 |
| 091 | Hard-Won Jitte | 牌文與對應實作逐項比對 |
| 092 | Improvised Arsenal | 牌文與對應實作逐項比對 |
| 093 | Jennika's Technique | 牌文與對應實作逐項比對 |
| 094 | Manhole Missile | 補回手牌置底換牌 |
| 095 | Mouser Attack! | 牌文與對應實作逐項比對 |
| 096 | Mouser Foundry | 補回離場派出機器人 |
| 097 | Mutant Town Musicians | 牌文與對應實作逐項比對 |
| 098 | Null Group Biological Assets | 牌文與對應實作逐項比對 |
| 099 | Old Hob, Alleycat Blues | 牌文與對應實作逐項比對 |
| 100 | Purple Dragon Punks | 牌文與對應實作逐項比對 |
| 101 | Raphael, Most Attitude | 使用時才選放逐牌；每次許可只用一張，保留來源實例 |
| 102 | Raphael, Ninja Destroyer | 專門保留此異能產生的紅色法術力；處理威懾下必須阻擋 |
| 103 | Raphael, the Nightwatcher | 牌文與對應實作逐項比對 |
| 104 | Raphael, Tough Turtle | 牌文與對應實作逐項比對 |
| 105 | Raphael's Technique | 牌文與對應實作逐項比對 |
| 106 | Ravenous Robots | 牌文與對應實作逐項比對 |
| 107 | Rock Soldiers | 牌文與對應實作逐項比對 |
| 108 | Slash, Reptile Rampager | 牌文與對應實作逐項比對 |
| 109 | Spicy Oatmeal Pizza | 牌文與對應實作逐項比對 |
| 110 | Wingnut, Bat on the Belfry | 牌文與對應實作逐項比對 |
| 111 | Zog, Triceraton Castaway | 牌文與對應實作逐項比對 |
| 112 | Courier of Comestibles | 可搜尋但找不到；搜尋仍洗牌 |
| 113 | Cowabunga! | 可不取牌；其餘隨機置底 |
| 114 | Frog Butler | 牌文與對應實作逐項比對 |
| 115 | Groundchuck & Dirtbag | 牌文與對應實作逐項比對 |
| 116 | Guac & Marshmallow Pizza | 牌文與對應實作逐項比對 |
| 117 | Leatherhead, Swamp Stalker | 辟邪指示物進場即存在；移除指示物後另開反射觸發 |
| 118 | Michelangelo, Game Master | 牌文與對應實作逐項比對 |
| 119 | Michelangelo, Improviser | 牌文與對應實作逐項比對 |
| 120 | Michelangelo, Mutant BFF | 任意指示物均符合 |
| 121 | Michelangelo, Weirdness to 11 | 牌文與對應實作逐項比對 |
| 122 | Michelangelo's Technique | 選擇時限制總法術力值；選完後才進場 |
| 123 | Mona Lisa, Science Geek | 牌文與對應實作逐項比對 |
| 124 | Mutagen Man, Living Ooze | 牌文與對應實作逐項比對 |
| 125 | Mutant Chain Reaction | 牌文與對應實作逐項比對 |
| 126 | New Generation's Technique | 牌文與對應實作逐項比對 |
| 127 | Novel Nunchaku | 裝備完成後另開互鬥反射觸發 |
| 128 | Party Dude | 等級異能離場後仍結算 |
| 129 | Primordial Pachyderm | 牌文與對應實作逐項比對 |
| 130 | Ragamuffin Raptor | 牌文與對應實作逐項比對 |
| 131 | Rocksteady, Crash Courser | 牌文與對應實作逐項比對 |
| 132 | Saved by the Shell | 補回操控龜時減費 |
| 133 | Tenderize | 牌文與對應實作逐項比對 |
| 134 | Transdimensional Bovine | 牌文與對應實作逐項比對 |
| 135 | Turtle Power! | 牌文與對應實作逐項比對 |
| 136 | Venus, Torn Between Worlds | 任意指示物均符合 |
| 137 | West Wind Avatar | 牌文與對應實作逐項比對 |
| 138 | Zoo Escapees | 牌文與對應實作逐項比對 |
| 139 | Baxter Stockman | 目標同時符合神器與生物 |
| 140 | Bebop & Rocksteady | 可犧牲任何永久物 |
| 141 | Brilliance Unleashed | 以動畫後的特徵進場，進場觸發可辨識生物 |
| 142 | Dark Leo & Shredder | 牌文與對應實作逐項比對 |
| 143 | Don & Leo, Problem Solvers | 兩個目標可為同一神器生物，同時放逐後返回 |
| 144 | Don & Raph, Hard Science | 重複授予的共鳴可疊加 |
| 145 | EPF Point Squad | 牌文與對應實作逐項比對 |
| 146 | Foot Elite | 牌文與對應實作逐項比對 |
| 147 | Foot Ninjas | 牌文與對應實作逐項比對 |
| 148 | Genghis Frog | 牌文與對應實作逐項比對 |
| 149 | Go Ninja Go | 牌文與對應實作逐項比對 |
| 150 | Ice Cream Kitty | 牌文與對應實作逐項比對 |
| 151 | Karai, Future of the Foot | 牌文與對應實作逐項比對 |
| 152 | Karai's Technique | 兩個模式可指定同一生物 |
| 153 | Krang & Shredder | 牌文與對應實作逐項比對 |
| 154 | The Last Ronin | 第二章磨牌後另選目標；第三章設定單獨攻擊觸發 |
| 155 | Lessons from Life | 放進戰場的地須橫置 |
| 156 | Mechanized Ninja Cavalry | 牌文與對應實作逐項比對 |
| 157 | Mikey & Don, Party Planners | 進場前放指示物；牌庫頂隨時可檢視；守護正常上堆疊 |
| 158 | Mikey & Leo, Chaos & Order | 只限生物，但包含各種指示物 |
| 159 | Mouser Mark III | 牌文與對應實作逐項比對 |
| 160 | The Neutrinos | 觸發上堆疊時選目標 |
| 161 | Nobody | 牌文與對應實作逐項比對 |
| 162 | North Wind Avatar | 施放進場才觸發；僅能取實際持有的局外牌 |
| 163 | Pizza Face, Gastromancer | 牌文與對應實作逐項比對 |
| 164 | Punk Frogs | 牌文與對應實作逐項比對 |
| 165 | Putrid Pals | 補回消逝進場帶兩個指示物 |
| 166 | Raph & Leo, Sibling Rivals | 宣告觸發時選攻擊生物；複數額外戰鬥可累加 |
| 167 | Raph & Mikey, Troublemakers | 牌文與對應實作逐項比對 |
| 168 | Slithering Cryptid | 牌文與對應實作逐項比對 |
| 169 | Splinter, Radical Rat | 牌文與對應實作逐項比對 |
| 170 | Tainted Treats | 先消滅，再依原法術力值派出食物 |
| 171 | Tokka & Rahzar, Terrible Twos | 比較堆疊上含X的法術力值與實付法術力 |
| 172 | Chrome Dome | 複製可複製特徵；下一個結束步驟才犧牲 |
| 173 | Everything Pizza | 牌文與對應實作逐項比對 |
| 174 | Henchbots | 牌文與對應實作逐項比對 |
| 175 | Krang, Utrom Warlord | 牌文與對應實作逐項比對 |
| 176 | Omni-Cheese Pizza | 牌文與對應實作逐項比對 |
| 177 | The Ooze | 確實放逐墳墓場目標；保留離場指示物快照 |
| 178 | Skateboard | 牌文與對應實作逐項比對 |
| 179 | Technodrome | 牌文與對應實作逐項比對 |
| 180 | Turtle Blimp | 牌文與對應實作逐項比對 |
| 181 | Turtle Van | 觸發選目標；累計所有駕駛者；來源離場不抹除已選目標 |
| 182 | Weather Maker | 法術力異能無優先權窗口；充能指示物獨立追蹤 |
| 183 | Dimension X | 牌文與對應實作逐項比對 |
| 184 | Escape Tunnel | 補回犧牲使小生物不能被阻擋 |
| 185 | Foot Headquarters | 牌文與對應實作逐項比對 |
| 186 | Illegitimate Business | 牌文與對應實作逐項比對 |
| 187 | Mutant Town | 牌文與對應實作逐項比對 |
| 188 | Northampton Farm | 牌文與對應實作逐項比對 |
| 189 | TCRI Building | 牌文與對應實作逐項比對 |
| 190 | Turtle Lair | 忍者／龜用的有色法術力不排除無色選項 |

## 驗證界線

這次移除了先前明列的卡牌簡化：不再以整個資料庫冒充玩家持有的局外牌，也不再保留舊卡漏異能或改寫效果。局外牌採本遊戲的休閒雙人對戰方式，從玩家收藏扣除本局起始套牌建立獨立區域；沒有提供局外收藏的玩家，候選為空。

本次核對及回歸測試不能證明完整 Comprehensive Rules 的所有跨系列組合都正確，尤其是多重持續效果的層次／時間戳、多個替代效果的選擇順序及多人遊戲。本遊戲目前為雙人對戰。其他系列原有的簡化不因本次 TMT 修正而一併被認證。
