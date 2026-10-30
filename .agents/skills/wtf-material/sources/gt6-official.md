# GT6 官方来源

## 信源信息

- 官网：https://gregtech.mechaenetia.com/
- 官方论坛：https://forum.mechaenetia.com/
- GitHub：https://github.com/GregTech6/gregtech6
- Changelog：https://github.com/GregTech6/gregtech6/blob/master/CHANGELOG.md
- 材料定义（一手）：https://github.com/GregTech6/gregtech6/blob/master/src/main/java/gregapi/data/MT.java
- 语言注册：https://github.com/GregTech6/gregtech6/blob/master/src/main/java/gregapi/lang/LanguageHandler.java
- NeoForge 移植版（非原版）：https://www.curseforge.com/minecraft/mc-mods/gregtech-6-neoforge

## 涵盖内容

- `MT.java` 是 GT6 材料注册表：每个材料用 `element(...)`、`metalore(...)`、`alloy(...)` 等工厂方法定义，包含内部名、元素/合金组成、颜色、熔点、工具属性、别名和本地化名。
- `CHANGELOG.md` 记录材料的新增、改名、移除和配方变化。
- `LanguageHandler.java` 决定语言键如何生成；游戏根目录的 `GregTech.lang` 是运行时/Forge 配置产物，不是仓库里的静态文件。
- GitHub Issues/Commits 可查材料为什么改名、某个名字是谁加的。

## 注意事项

- 内部名、显示名、语言键不是一回事。例如 GT6 的 `Tritanium` 内部常量是 `TritaniumAlloy`，英文显示 `Tritanium Alloy`，中文语料是“钛金”。
- 查组成时看 `MT.java` 里的 `element(...)` / `alloy(...)` / `uumAloy(...)` 参数，不要只看语言文件。
- `CHANGELOG.md` 只记录作者愿意写的变化，材料可能早已存在但没有条目；不能因为 changelog 没写就断定“不是 GT6 的”。
- GT6、GT6CE、GT6 NeoForge 移植版、gregtech6_w 是不同的代码库，材料集合可能不同；引用时写清楚是哪一个。
- `.setLocal(...)`、`element(...)` 的别名参数、`@Deprecated` 段的同义常量都可能给出俗名或旧名，是“英文/别名”字段的好证据。
- 官网和论坛可能停更或需要登录；GitHub 是最可靠的一手来源。
- 引用时给文件路径 + 符号名（或行号/commit），方便复核；行号会随提交变化。

## 示例：Tritanium

- 在 `MT.java` 搜索 `Tritanium`，可以看到 `TritaniumAlloy = alloymachine(8752, "Tritanium", ...)`，以及 `Tn = element(1250, "TritaniumElemental", "Tn", 125, ..., "Unbipentium")`、`Dn = element(1450, "DuraniumElemental", "Dn", 145, ..., "Unquadpentium")`。
- 这说明 GT6 的 Tritanium 是虚构元素 125（`TritaniumElemental`，别名 `Unbipentium`）与虚构元素 145（`DuraniumElemental`，别名 `Unquadpentium`）的合金，不是现实中的钛合金。
- `Unbipentium` / `Unquadpentium` 是 IUPAC 临时系统命名风格；Tritanium 和 Duranium 与《星际迷航》中的虚构材料同名，但是否致敬要另查 changelog/issue，不要直接断言。
- 中文语料 `gt.material.Tritanium=钛金`、`gt.material.TritaniumElemental=三钛` 是社区译名，不是官方译名。
