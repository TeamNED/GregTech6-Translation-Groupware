# 材料出处索引

> 本目录按材料名称的主出处归类，数据来自 `packages/legacy/workplace` 的 `gt.material.*` 语料、GT6CE 生成数据、gregtech6_w 的 `MT.java` 与 GT6 官方仓库。最后更新日期：2026-10-31 10:52。

## 分类

| 文件 | 内容 | 材料组数 |
| --- | --- | ---: |
| [real-world.md](real-world.md) | 现实材料 | 588 |
| [gt6.md](gt6.md) | GT6 自创材料 | 59 |
| [mods.md](mods.md) | 其他 Minecraft mod 材料 | 285 |
| [fiction.md](fiction.md) | 外部作品与神话材料 | 42 |
| [unknown.md](unknown.md) | 未确定出处的材料 | 17 |

## 判定规则

- 主出处按**名称首创**判定：现实已有的名称归现实，某个 mod 首创归该 mod，外部文学/影视/游戏首创归该作品，GT6 自创归 GT6，无法判定归 unknown。
- 一个材料只放一个主出处；其他来源写在“出处”列的 `also_in`。
- 现实材料按木头/岩层/矿物/宝石/化合物/合金/其他分节，mods 按 mod 分节，fiction 按作品分节，gt6 按类别分节。
- 英文名来自 legacy `en/GregTech.lang`，中文名来自 `zh/GregTech.lang`。中文仍是英文的标为“未译”，括号内为 GT6CE 或外部信源的参考译名，不改动词料。
- 组成优先使用 GT6CE `MaterialCompositionData`、材料定义中的化学式、gregtech6_w `MT.java` 的 `setMcfg`/`uumMcfg`，没有证据写“未知”。
- 形态来自 GT6CE `MaterialForms` 的 flags，多种状态并列，例如“固态/液态”。
- 证据等级：信源（代码/官方/百科明确写出）、推断（多条证据推出）、未知。表格中的“信源”链接指向主要外部证据；本地代码数据不附外链。
- 表格列：英文名、中文名、组成、形态、出处、证据等级、语言键、备注。备注包含 also_in、译名建议、数据异常和待核对项；它是探索记录，不是项目现行译名。

## 排除规则

以下类别不进入本目录：

- 反物质变体（Anti*）
- GT6 自创/系统命名元素
- 现实元素/同位素
- 抽象/任意条目
- 食物/饮品
- 颜色
- 抽象/加工/杂物条目
- 粉末/食物类材料
- 水变体（只保留 Water/Brine）
- 简单流体/环境物质
- 蜜蜂相关
- 抽象/机器等级条目
- 处理形态

具体岩层+矿物组合物品、机器名、材料制品、矿石物品等不在 `gt.material.*` 命名空间，按命名空间天然排除。

## 数据来源

- `packages/legacy/workplace/en/GregTech.lang`、`zh/GregTech.lang`：材料键与英中名称。
- `packages/legacy/workplace/config.yml`、`packages/node/project.jsonc`：分组与词表提示。
- `GregTech6CE-New/core/src/main/java/gregtech/content/`：`MaterialForms`、`MaterialCompositionData`、`MaterialModTags`、`ModReferences` 与生成的材质目录。
- `gregtech6_w/src/main/java/gregapi/data/MT.java`：官方派生材料定义、别名和 mod 标签。
- [GT6 官方 MT.java](https://github.com/GregTech6/gregtech6/blob/master/src/main/java/gregapi/data/MT.java)、[CHANGELOG.md](https://github.com/GregTech6/gregtech6/blob/master/CHANGELOG.md)。
- 外部信源：Wikipedia、GTNH 中文/英文 Wiki、MC百科、FTB Wiki、Fandom、huijiwiki、术语在线及各 mod/作品 Wiki；详见技能 `.agents/skills/wtf-material/sources/`。

## 说明

- 本目录是翻译辅助资料，不是 GT6 官方文档。材料是否属于某个 mod/作品，以代码、官方 changelog 和外部信源为准。
- 本目录不记录键数统计，材料条目以各文件表格为准。
- 旧语料/CE 数据可能存在别名、拼写变体和未译项。已尽量合并别名，但仍以“语言键”列保留原始键，便于回溯。
- 组成和形态缺失时写“未知”，没有用猜测填充。
