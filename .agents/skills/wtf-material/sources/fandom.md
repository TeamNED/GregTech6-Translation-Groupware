# Fandom

## 信源信息

- 平台：https://www.fandom.com
- 各 Wiki：`https://<topic>.fandom.com`，如 `https://ftb.fandom.com`、`https://terraria.fandom.com`、`https://memory-alpha.fandom.com`（Star Trek）。
- 搜索：站内搜索，或用 `site:<topic>.fandom.com "<关键词>"`。

## 涵盖内容

- Minecraft mod 与整合包（FTB、GregTech、Thaumcraft 等）。
- 大量游戏/影视作品的物品、材料、设定条目。
- 页面通常有信息框（类型、来源、用途）和分类，适合快速判断材料属于哪个作品。

## 子 Wiki

以下子 Wiki 统一登记在此，引用时给具体页面 URL。内容多到需要单独成文件的子 Wiki（目前只有 FTB Wiki）仍在表中占一行，详情放到对应文件，避免同一套注意事项在两处维护。

| 子 Wiki | URL | 涵盖内容 | 注意事项 |
| --- | --- | --- | --- |
| The Aether | https://aether.fandom.com/ | 矿物、木材、石材；Ambrosium / Zanite / Gravitite / Continuum 等 | 模组原创材料，注意与 GT6 兼容材料区分。 |
| The Betweenlands | https://the-betweenlands.fandom.com/wiki/Middle_Gems | Middle Gems 等模组物品 | 与 MC百科交叉验证 Aqua / Crimson / Green Middle Gem 三色命名。 |
| Biomes O' Plenty | https://biomesoplenty.fandom.com/wiki/Sacred_Oak | 1.12 树木/木材；Sacred Oak、Hellbark、Ethereal、Dark Wood 等 | 部分树名在 1.12 列表已变化，按版本核对。 |
| CrazyOres | https://crazyores.fandom.com/ | Zectium、Starconium、Tapazite、Invisium、Osmonium 等矿石 | 直接抓取常返回 403，需 browser use；mcmod.cn/class/27755 可补充。 |
| Dragon Booster | https://dragonbooster.fandom.com/ | Draconium 等虚构能量矿物 | Draconium 作为虚构能量矿物的最早出处。 |
| Final Fantasy | https://finalfantasy.fandom.com | Adamantite、Mythril 等系列物品/材料 | WebFetch 会 403；用 curl 带浏览器 UA 请求 api.php 取 wikitext。 |
| FTB Wiki | https://ftb.fandom.com/wiki/GregTech_6 | FTB 整合包与 GregTech 各版本的机器、材料、教程 | 详情见 `ftb-wiki.md`；开发站 dev.ftbwiki.org 见 `mod-wikis.md`。 |
| HBM's Nuclear Tech Mod | https://ntm.fandom.com/ | Red Copper（Minecraft Grade Copper / Mingrade）等命名与配方 | 以俄语为主，注意与 GT6 的 HBM 兼容名对应。 |
| Hexxit | https://hexxit.fandom.com/wiki/Autumn_Woods | Extra Biomes XL 的 Autumn Woods / 秋树 | 整合包 Wiki，材料归属需回到 EBXL 本体确认。 |
| Marvel Database | https://marvel.fandom.com | Adamantium、Vibranium 等条目与首次登场信息 | 用 api.php 取 wikitext；WebFetch 直接访问会 403。 |
| Memory Alpha | https://memory-alpha.fandom.com | Star Trek 材料、元素、科技设定 | 用 api.php 取 wikitext；Tritanium / Duranium 等条目的首次登场信息。 |
| Metallurgy 2 | https://metallurgy2.fandom.com/ | Carmot 等幻想金属 | 与 GT6 的 Metallurgy 兼容标签对照。 |
| Mo'Creatures | https://mocreatures.fandom.com/wiki/OgreLair_Log | Ogre Lair / Wyvern Lair 木材与木板方块 | 模组方块名，不是现实树种。 |
| Simple Ores 2 | https://simpleores.fandom.com/ | Thyrium、Sinisite、Mythril、Adamantium 等 | Alloys 页给出 Thyrium = Mythril + Adamantium。 |
| Stargate | https://stargate.fandom.com | naquadah、naquadria、trinium 等材料 | 用 api.php；注意 Naquadria 是同位素而非化合物。 |
| Tinkers' Construct | https://tinkers-construct.fandom.com/ | Ardite、Manyullyn、Alumite 等匠魂材料 | 注意与 GT6 / TiC 兼容名对应。 |

## 注意事项

- 每个 Wiki 独立维护，质量差异很大；优先看有引用、有版本标注的页面。
- 粉丝推断和官方设定经常混写，注意“Trivia”“Speculation”段落。
- 广告和动态加载多，直接 curl 常被 403；用 browser use 或 WebFetch。
- 旧 Gamepedia 域名会重定向到 Fandom，见 `gamepedia.md`。
- 引用具体条目标题和 URL，不要引用 Wiki 首页。
