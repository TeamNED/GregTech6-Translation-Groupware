# 本仓库及其前身的 GitHub

## 信源信息

- 当前仓库：https://github.com/TeamNED/GregTech6-Translation-Groupware
  - Issues：https://github.com/TeamNED/GregTech6-Translation-Groupware/issues
  - Pull requests：https://github.com/TeamNED/GregTech6-Translation-Groupware/pulls
  - Releases：https://github.com/TeamNED/GregTech6-Translation-Groupware/releases
  - Wiki：https://github.com/TeamNED/GregTech6-Translation-Groupware/wiki （功能开着，但截至 2026-10-31 没有可克隆内容，不要指望这里有资料）
- 前身：https://github.com/TeamNED/gregtech6-chinese-translation （已归档，适配 GT6 6.14.21 及以前）
  - 原 `MoHaDouBiTeam/gregtech6-chinese-translation` 会重定向到这里
  - Issues：https://github.com/TeamNED/gregtech6-chinese-translation/issues
  - Releases：https://github.com/TeamNED/gregtech6-chinese-translation/releases
- 更早的来源：前身 README 鸣谢“原始文件源自 Amamiya 组”，但没有找到该组的公开仓库；只能作为口述来源，标【未知】或【推断】。
- 相关但非前身：`TeamNED/gregtech6-chinese-guide`（GT6 中文指南的 fork），https://github.com/TeamNED/gregtech6-chinese-guide

## 涵盖内容

**当前仓库的 docs**

- `README.md`：包结构、验证命令、数据边界（`packages/legacy` 只读、生成物写 `packages/node/dist/`）。
- `docs/architect.md`：工具链架构、配置与语料的边界。
- `packages/legacy/README.md`、`packages/legacy/docs/quick-start.md`：原 C++ 替换器的生成器/规则/字典原理，解释译名如何生成、fallback 和 unknown 如何工作。
- `packages/core/README.md`、`packages/core/docs/{algorithms,migration-plan,perf-evaluation}.md`：算法、迁移方案和配置 schema。
- `packages/{runtime,node,web}/README.md`：运行方式、产物和浏览器 REPL。
- `.zcode/plans/`：本地会话计划，不在 GitHub 上，但能解释某些改动的动机。

**前身仓库的 docs 与语料**

- `README.md`：项目历史、Weblate、Amamiya 来源、许可证。
- `changelog/Changelog Translation.md`：GT6 官方 changelog 的中文翻译，可查材料新增/改名发生在哪个版本。
- `lang/gt_material/en_us.lang`、`lang/gt_material/zh_cn.lang`：按类别拆分的材料语料，中文约 2,000 行，是当前 `workplace/zh/GregTech.lang` 的前身。
- `config/glossary.yml`：约 2,580 行的术语表，含大量材料中英对照。
- `config/exceptions.yml`：逐键覆盖的例外表。
- `config/division.yml`：按 key 正则分组（`gt_material`、`oredict`、`tooltip` 等）。
- `source/`：旧 Python 工具链。

**Issues / PRs**

已确认与材料直接相关的例子：

- #47 `关于Trinium、Tritanium、Titanium-Gold及其相关译名的翻译`（open）：区分 StarGate、Matter Overdrive 和现实材料，并给出 GTNH 中文 wiki、Wikipedia、CNKI 链接。
- #46 `Distinguish 3 types of "蓝石合金"`（open）：Nikoline Alloy / Blue Alloy / Electrotine Alloy 的消歧，评论里给出最终选择。
- #6 `mistranslating materials`（closed）：`Mercury` 材料应译“汞”而不是“水星”；`Lazurite` 不应译“天青石”；修复见 release `6.15.10-alpha`。
- #1 `关于Naquadah`（closed）：团队对虚构材料译名争议的处理原则——不轻易改动已定译名。
- 前身 #34 `实用扩展(Actually Additions)材料译名征集`（closed）：从“再构XX”改回官方名的决策过程，理由是 NEI 搜索、先到先得和译名统一。

**Releases**

- 当前仓库发布 `GregTech.lang`，tag 对应 GT6 版本；截至 2026-10-31 最新为 `6.17.06-alpha.5`。
- 前身发布到 `v6.14.21`（2021-10-23），之后的版本在 GT6TG。
- 查“某个译名从哪个版本开始存在”时，用 release tag 对照，而不是只看 master。

**Commit / blame**

- `git log -S '<材料名>' -- packages/legacy/workplace`：找译名或原文的改动。
- `git log --grep='<材料名>' -i`：找提交说明里的讨论。
- `git blame packages/legacy/workplace/zh/GregTech.lang`：定位某一行的最后修改提交。

## 注意事项

- 译名决策主要记录在 issue/PR 的正文和评论里，docs 很少逐条讲材料。查材料名时先搜 issue，再搜评论。
- 已关闭 issue 往往包含“最终决定 + 修复版本 + 外部链接”，比 open issue 更有结论性；不要只看 open。
- 前身仓库已归档，issue 不再更新，但它是 2016–2021 年译名历史的唯一记录；当前语料大量继承自它。
- 前身 `lang/gt_material/zh_cn.lang` 和 `config/glossary.yml` 可能落后于当前语料。遇到冲突以当前 `packages/legacy/workplace/zh/GregTech.lang` 和 `packages/node/project.jsonc` 为准，并注明历史版本。
- 同一个英文词可能是材料也可能是地名/星球名。例如 `gt.material.Mercury` 是“汞”，而 `MercuryRock`、`oreMercury` 在水星语境下可能仍是“水星”；先看 key 的命名空间和物品类型。
- 前身 README 的 Weblate 链接可能已失效，不要当现行协作入口。
- “Amamiya 组”没有找到公开仓库；只能引用前身 README 的鸣谢，不能编造其出处。
- Wiki 目前没有可用内容；优先 docs + issues + git。
- 不要把“团队当前决定”当成“现实出处”。issue 只证明译名选择和理由，不证明材料在现实中存在。
- 许可证：前身 README 写 CC BY-NC-SA 4.0，当前 legacy README 对语言文件写 CC0；引用时注意，不要大段复制。

## GitHub 搜索语法

```text
repo:TeamNED/GregTech6-Translation-Groupware 材料
repo:TeamNED/GregTech6-Translation-Groupware Tritanium in:title,body
repo:TeamNED/GregTech6-Translation-Groupware is:issue is:closed 译名
repo:TeamNED/gregtech6-chinese-translation 材料
is:pr is:merged <材料名>
```

也可以用 `gh search issues 'repo:TeamNED/GregTech6-Translation-Groupware 材料'`。引用时给 issue/PR 编号、标题、状态和 URL；引用 docs 时给文件路径和 commit，因为 docs 会随重构移动。
