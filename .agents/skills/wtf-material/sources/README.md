# 信源索引

`wtf-material` 在【操作流程】第 2 步按需读取本目录。每个文件记录一个信源的**信源信息、涵盖内容、注意事项**。

| 文件 | 信源 | 主要用途 |
| --- | --- | --- |
| `search-engines.md` | Google/Bing/DuckDuckGo/百度、DeepSeek 搜索、browser use | 广撒网、找作品 Wiki、打开原始页面 |
| `wikipedia.md` | Wikipedia 中文/英文 | 现实元素、化合物、矿物、宝石；作品条目 |
| `huijiwiki.md` | 灰机 Wiki 平台与作品站 | 平台入口与作品站；GTNH 中文站资料见 `gtnh-wiki.md` |
| `fandom.md` | Fandom（含子 Wiki 登记表） | Minecraft mod、影视游戏作品 Wiki；子 Wiki 统一在该文件的表里登记 |
| `gamepedia.md` | Gamepedia（已并入 Fandom） | 旧链接迁移、历史 Wiki 页面 |
| `ftb-wiki.md` | FTB Wiki（ftb.fandom.com） | GregTech 各版本条目、整合包资料 |
| `mcmod.md` | MC百科 | 中文 mod 条目、物品/材料页、教程 |
| `gtnh-wiki.md` | GTNH 百科（中/英） | GT5U/GTNH 材料与术语对照 |
| `termonline.md` | 术语在线 | 规范中文术语、学科义项 |
| `gt6-official.md` | GT6 官网/论坛/GitHub/CHANGELOG | 一手材料定义、内部名、版本变更 |
| `mod-localization-github.md` | 各 mod 与整合包的 GitHub 汉化 | 同名词译名、术语参考 |
| `gt6tg-github.md` | 本仓库及前身（GT6TG / gregtech6-chinese-translation） | docs、issue、PR、release、commit 中的译名决策与历史 |
| `mod-release-pages.md` | CurseForge / Modrinth / GitHub Releases / 特定 mod 发布站 | 模组版本、changelog、材料引入/改名/移除的版本证据 |
| `mod-wikis.md` | 小模组 Wiki 与指南（9Minecraft、ATL、dev.ftbwiki、AE2、TFC、HBM） | mod 原创材料、命名、配方与版本差异 |
| `fiction-wikis.md` | 其他游戏/影视/文学作品 Wiki（Terraria、Team Fortress、Tolkien；Fandom/灰机子 Wiki 见对应平台页） | 虚构材料的名称、首次登场与设定 |
| `real-world-databases.md` | Mindat / ATHENA / NIMRF / PubChem / POWO / Geology.com / JOGG | 现实矿物、植物、化合物、岩石、宝石数据库 |
| `minecraft-wiki.md` | https://minecraft.wiki/w/Nether_Star | Minecraft Wiki：下界之星/下界石英/红石/腐肉等原版物品 |

## 登记约定

- 同一个站点只在一个文件里展开写，其他文件用一句话指向它，避免两处维护同一套注意事项。
- 平台与其上的具体 Wiki 分开登记：Fandom、灰机作为平台各占一行，具体 Wiki 在平台的“子 Wiki”表里逐条列出。
- 已重定向的旧域名（Gamepedia）保留独立文件用于迁移，但不算独立站点。
- 单一材料的单篇新闻、评测、论文不单独成文件，作为材料条目的证据 URL 保留。

规模（2026-10-31 统计）：17 个信源文件，去重后 67 个独立站点。按文件内条目逐条计为 72 条，多出的 5 条是跨文件登记：GTNH 中文站、TeamNED 本仓、CurseForge、FTB Wiki 各登记两次，Gamepedia 与 Fandom 同源。

## 通用规则

1. 一手来源（代码、官方 changelog、官方 Wiki）优先于二手来源（玩家 Wiki、教程、视频）。
2. 同一个事实尽量用两个独立信源交叉验证；只有单一来源时注明来源。
3. 引用具体页面，不引用搜索结果页；记录访问日期。
4. 社区 Wiki 可能过时、机翻或混入整合包改动，不能直接当 GT6 原版事实。
5. 汉化文件只用于查“别人怎么译”，不能证明材料的现实出处。
6. 页面返回 403、需要登录或内容由 JS 渲染时，改用 browser use，不要凭搜索结果摘要作答。
