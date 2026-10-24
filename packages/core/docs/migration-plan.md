# GregTech6 翻译工具迁移方案

日期：2026-10-23
范围：`src/` 中的 C++ 替换器、`workplace/config.yml` 规则体系、`workplace/*/*.lang` 语言文件，以及向 Node.js 前端 / GT6W JSON / 多 addon 多目标迁移。

---

## 0. 结论摘要

1. **瓶颈已定位，并用同语言原型验证。** 现有算法「先物化全部组合，再逐条查表」：真实配置生成 **459,046** 对，只有 **131,608**（28.7%）有用；合成 400 万对场景下，Node 实现达到 **1.92 GB 堆 / 4.03 s**，正好复现用户观察到的 ~2 GB。
2. **实测结论（Node 24，3 轮中位数，详见 [perf-evaluation.md](perf-evaluation.md)）**：
   - **编译型 pattern（新默认引擎）**：真实 **0.611 s / 62.6 MB 活堆**；4× addon **2.445 s / 153.5 MB**；400 万对爆炸 **0.595 s / 64.7 MB**。它不展开 completed-only 笛卡尔积，时间与 P 解耦。
   - **流式过滤（速度回退）**：真实 **0.607 s / 190.8 MB**；4× addon **2.243 s / 552 MB**（绝对速度比 pattern 快 9%）；400 万对 **1.277 s / 193.3 MB**。
   - **字符级 token（极端 P/K 备选）**：真实 0.650 s / 300 MB；4× addon 2.398 s / 750 MB；400 万对 0.623 s / 308 MB。
   - 六种引擎输出与现有生成文件逐条一致：`mismatch = 0`、`unknownMismatch = 0`。
3. **Debug 构建放大了问题**：同一语料 Debug **11.8 s / 607 MB**，Release **1.0 s / 215 MB**；Node pattern/流式均已优于 Release C++ 基线，因此 N-API 不是前置项，只作为后续可选优化。
4. **其余五个诉求分别独立成阶段**：Web 前端（配置测试/编辑）、GT6W JSON 后端、书本/散文管线、addon/target/输出管理、JS 与 N-API 性能对比。
5. 迁移期间**保留 C++ 实现作为 parity oracle**，用逐字节输出对比作为硬门槛，直到新实现连续两个版本完全一致。

---

## 1. 现状与证据

### 1.1 生成链路

```
workplace/en/GregTech.lang (125,676 keys)
        │
        ▼
ConfigParser (ryml YAML) ──► 168 个生成器（103 rule / 65 dict）
        │
        ▼
Replacer::generate_map()
   ├─ 按 group 递归求值，结果缓存
   ├─ rule: subs 各组结果做笛卡尔积，fmt {0}{1} 填模板
   └─ 产出 map<原文, vector<(meta, 译文)>>
        │
        ▼
Replacer::replace()
   ├─ 主要输入 en/GregTech.lang
   ├─ 次要输入 zh/GregTech.fallback.lang（按 key 手写覆盖）
   ├─ 命名空间前缀过滤（key 必须以生成器 namespace 开头）
   ├─ 冲突时后写入者获胜（顺序敏感）
   └─ 输出 zh/GregTech.lang + zh/GregTech.unknown.lang
```

关键语义（迁移必须逐条复刻）：

- 组名可对应多个生成器，结果取并集。
- 规则结果 = 各 `subs` 组结果的笛卡尔积；`empty()` 的组会使整条规则失效。
- 命名空间合并：一方是另一方前缀时取较长者，否则整条组合作废。
- `completed: false` 的生成器只供其他组引用，不直接进入最终映射。
- 替换阶段按语言文件的 key 做**前缀匹配**；同一原文有多个候选时，**最后一次命中覆盖前面的**。
- `-r` 会删除 fallback 中已被生成器覆盖的条目（有破坏性）。

### 1.2 实测基线（本机，2026-10-23）

| 构建 | 命令 | 墙钟时间 | 峰值工作集 | 输出 |
| --- | --- | ---: | ---: | --- |
| Debug（仓库现有） | `GT6TG.exe -w workplace -e qt` | 11.8 s | 607 MB | 与仓库现有生成文件逐字节一致 |
| Release（本次新建） | 同上 | **1.02 s** | **215 MB** | 一致 |

说明：Debug 使用 `/Od /Ob0 /RTC1` 和 MSVC 迭代器调试，时间和内存都被显著放大；Release 使用 `/O2`。两者都使用同一份 125,676 条英文语料。

### 1.2b 算法基准（Node.js，同语言实现）

六种算法共用同一份配置模型与输出逻辑，差异只在算法本身。3–5 轮中位数（pattern/stream/token 为 3 轮；forward 为 5 轮），Node 24.21.0：

| 场景 | 引擎 | 时间 | 峰值 RSS | 堆 | 候选条目 |
| --- | --- | ---: | ---: | ---: | ---: |
| 真实 125,676 keys / 459k pairs | forward（现有算法） | 0.732 s | 460 MB | 277 MB | 436,070 |
| 真实 | **pattern** | **0.611 s** | 376 MB | **62.6 MB** | 114,270 |
| 真实 | stream | 0.607 s | **343 MB** | 190.8 MB | 123,280 |
| 真实 | token | 0.650 s | 464 MB | 300.1 MB | 186,311 |
| 4× addon / 1.84M pairs | forward | 2.727 s | 953 MB | 552 MB | 1,744,280 |
| 4× addon | pattern | 2.445 s | 777 MB | **153.5 MB** | 457,080 |
| 4× addon | **stream** | **2.243 s** | **740 MB** | 552 MB | 493,120 |
| 4× addon | token | 2.398 s | 904 MB | 749.8 MB | 745,244 |
| 400 万对 / 100 命中 | forward | 4.032 s | **2,212 MB** | **1,921 MB** | 4,436,070 |
| 400 万对 | **pattern** | **0.595 s** | 376 MB | **64.7 MB** | 114,370 |
| 400 万对 | stream | 1.277 s | 343 MB | 193.3 MB | 123,380 |
| 400 万对 | token | 0.623 s | 467 MB | 308 MB | 186,411 |

结论：**编译型 pattern 是默认引擎；stream 在多 addon 且输入 key 很大时作为绝对速度回退（快 9%）；token 只作为极端 P/K 备选。** 三者都应与 golden 保持逐条一致。

### 1.3 规则图的静态膨胀分析

用 Python 按 C++ 语义复刻生成器后统计（脚本可复现，结果与真实输出完全对齐）：

| 指标 | 数值 |
| --- | ---: |
| 生成器块 | 168（103 rule + 65 dict） |
| 不同组名 | 143 |
| `completed: false` 生成器 | 48 |
| 带 `extension` 的生成器 | 0（`-e` 目前实际不起过滤作用） |
| dict 词汇对总数 | 2,507 |
| 最终生成的 (原文, 译文) 对 | **459,046** |
| 其中原文在英文文件中出现过的 | **131,608（28.7%）** |
| 生成的不同原文字符串 | 404,009 |
| 从未在英文文件中出现的原文字符串 | **294,705（72.9%）** |
| 生成器覆盖的输入 key | 118,457 |
| fallback 覆盖的输入 key | 6,445 |
| 两者并集 | **124,902** |
| 实际 unknown | **774**（125,676 − 124,902，与输出完全一致） |
| 同一输入 key 有多个不同候选译文 | **122（当前按顺序取最后一个）** |

体积最大的生成热点：

| 组合 | 数量 | 来源 |
| --- | ---: | --- |
| `oreComplex` = `{0} {1}` | 217,474（上界） | oreTypePrefix × ore |
| `materialProduct` = `{0} {1}` | 42,588 | material × materialProductType |
| `toolHead` = `{0} {1}` | ~41,200 | material × toolHeadType |
| `plateComplex` = `{0} {1}` | 24,325 | plateType × plate |
| `qt_machine` = `{0} {1}` | ~14,100 | material × qt_machineType |
| `crate16` = `Crate of {0}` | ~10,200 | plate/dust/ingot/… |

结论：**当前是「先展开、后淘汰」**。只要把评估顺序倒过来（先看输入，再按需展开），就能同时解决时间和内存。

### 1.4 内容特征

| 指标 | 数值 | 影响 |
| --- | ---: | --- |
| 英文 key | 125,676 | 主输入规模 |
| 不同英文值 | 114,078 | 去重后可减少约 9% 的匹配工作 |
| 空值 | 939 | JSON 输出必须省略空值，否则会遮盖代码默认值 |
| 含 `=` 的值 | 555 | 旧 `.lang` 按第一个 `=` 切分没问题；JSON 无需转义 |
| 含 `¶` 的值 | 563 | GT6 用 `¶` 表示换行，必须原样保留 |
| `written.book.*` | 742 | 书本页，长散文，最大 253 字符 |
| key 前缀 | oredict 105,812 / gt 16,639 / qwertech 1,356 / written 742 / fluid 691 / itemGroup 196 / bc 80 / qt 52 | 规则和 addon 的主战场是 oredict |

另外发现两个应当在迁移前修掉的数据问题：

1. `materialProductWood` 规则引用了**不存在的组** `materialProductWoodType`，该规则目前静默产出 0 条。新工具需要「缺失组」lint。
2. 122 个输入 key 存在多个不同候选译文，最终结果依赖生成器遍历顺序。新工具应显式报告冲突，并允许配置优先级。

### 1.5 GT6W（高版本目标）事实

目标仓库：`https://github.com/wolfram0108/gregtech6_w`（MC 1.20.1 / 26.1.2 NeoForge）。

- 语言文件：`src/main/resources/assets/gregtech6/lang/zh_cn.json`，**扁平 JSON**，键值均为字符串，UTF-8。
- 现有 `zh_cn.json` 约 **102,539** 个 key；与本仓库英文 key 的交集 **101,148**。
- 仅 JSON 有的 key 约 **1,391**（Jade、效果、附魔、移植新功能）；仅旧文件有的 key 约 **24,528**（其中 oredict 21,687、qwertech 1,356、gt 967、written 303、bc 80）。
- 书本页：`written.book.<BookID>.page.<n>`，共 **744** 页（当前 `zh_cn.json` 已翻 **742** 页），换行用 `¶`，运行时写入 NBT 前才转成 `\n`。
- 旧 `GregTech.lang` 仍然被读取，但**同 key 时 JSON 优先**；因此不能只生成旧 `.lang`，否则会被旧 JSON 遮盖。
- 英文 `en_us.json` 只有 6 个 key，英文默认值由代码注册；**不能把 `en_us.json` 当作完整 key 清单**，应以旧 `GregTech.lang` + `zh_cn.json` 的并集作为 key 目录。
- addon 键空间示例：`qwertech.*`、`qt.*`、`gtww.*`、`gtweapons.*`；1.7.10 的 addon 大多把动态名称写进共享 `GregTech.lang`，GT6W 侧则走 `LanguageHandler` / 资源包 JSON。

---

## 2. 目标与成功标准

| 用户诉求 | 目标 | 验收指标 |
| --- | --- | --- |
| 1. 算法/内存 | 不再物化无用组合 | 真实 < 0.7 s、活堆 < 160 MB；4× < 2.6 s、活堆 < 250 MB；400 万对 < 0.8 s、活堆 < 160 MB |
| 2. 前端 | 网页调试/编辑配置 | 本地 `localhost` 启动；配置校验、规则图、实时翻译测试、diff、覆盖率面板可用 |
| 3. JS vs C++ | 有数据支撑的选型 | 同一语料、同一输出，JS / N-API / Release C++ 三组基准（中位数 + p95 + RSS） |
| 4. 书本 | 非词法内容可维护 | 742 个静态书页可导入/编辑/校验（页数、`¶`、长度）；动态材料词典有明确支持边界 |
| 5. addon/版本/输出 | 多目标多 addon | 旧 1.7.10 `.lang` 与 GT6W JSON 同源生成；addon 分层、冲突报告、产物清单 |

**硬门槛（所有阶段共同）**：

- 旧目标输出与当前 `workplace/zh/GregTech.lang` / `GregTech.unknown.lang` **逐字节一致**（或规范化后完全等价）。
- 774 条 unknown、1,986 条同英文项、122 条冲突项的集合可解释、可导出。
- 不得静默改变现有译文；任何语义变化必须通过显式开关。

---

## 3. 目标架构

### 3.1 仓库布局（pnpm monorepo）

```
packages/
  core/            # 纯 TS：语言文件模型、生成器引擎、匹配器、报告
  config/          # JSONC schema v2、YAML 导入、校验、迁移
  targets/         # legacy-lang / gt6w-json 的 key 适配与读写
  cli/             # gt6tg 命令行（兼容旧参数 + 新子命令）
  native/          # 可选：N-API 包装现有 C++
apps/
  web/             # Vite + React + Monaco + 本地 API
  bench/           # 基准与结果对比
fixtures/
  legacy/          # 当前 en/fallback/期望输出（golden）
  gt6w/            # zh_cn.json 样本与 key 目录
docs/
  migration-plan.md
```

### 3.2 核心 API（示意）

```ts
interface GenerateRequest {
  target: TargetProfile;
  config: ProjectConfig;       // 已合并 base/target/addon
  source: LangDocument;        // legacy .lang 或 JSON
  fallback?: LangDocument;
}

interface GenerateResult {
  output: LangDocument;
  unknown: LangDocument;
  stats: {
    generatedPairs: number;
    matchedPairs: number;
    conflicts: Conflict[];
    missingGroups: string[];
    coverage: Coverage;
  };
}
```

- `core` 不依赖文件系统，便于在 Web Worker、CLI、测试中复用。
- 所有字符串输出保持确定性（稳定排序 + 稳定优先级），避免「换机器结果不同」。

### 3.3 配置分层

合并顺序（后者覆盖前者，但每次覆盖都记录）：

```
base 项目配置  <  target 覆盖  <  addon 覆盖（按 priority）  <  本地 override
```

- **target**：游戏版本、格式（legacy-lang / gt6w-json）、key 适配器、输入 key 目录、输出路径、换行/编码/排序策略、空值策略。
- **addon**：id、版本范围、命名空间前缀、priority、来源文件、维护者。
- **输出管理**：每个 target 产出 `output`、`unknown`、`coverage.json`、`conflicts.json`、`manifest.json`（含 hash），并支持 `--dry-run` 与上一版 diff。

---

## 4. 分阶段计划

### Phase 0：基线与安全网（1–2 天）

**目标**：在写新代码前锁定「正确」和「性能」两个基准。

工作项：

1. 固化 golden fixtures：当前 `zh/GregTech.lang`、`GregTech.unknown.lang`，以及每个前缀的抽样。
2. 建立 parity harness：同一输入下新实现输出与 golden 逐字节/规范化对比。
3. 基准脚本：Release C++、Debug C++、Node（后续）统一测量墙钟、峰值 RSS、输出 hash。
4. 规则图 lint 的第一版（Python/TS 均可）：缺失组、环、空组、未引用组、`completed` 分布、笛卡尔积上界。
5. 修复 `materialProductWoodType` 缺失（或显式标记为已知忽略），并导出 122 条冲突清单。

**产出**：`fixtures/legacy/`、`bench/baseline.json`、`reports/conflicts.json`、`reports/missing-groups.json`。
**验收**：任何人一条命令即可复现「1.0 s / 215 MB / 输出 hash X」。
**回退**：不改 `src/`，只加测试与报告。

---

### Phase 1：JS 核心 + 编译型 pattern 引擎（1–2 周）

**目标**：用 TypeScript 复刻现有语义，把算法从「全量物化」改成**编译期展开模板 + 运行时扁平匹配**，并作为默认引擎。原型已实测：真实 0.611 s / 62.6 MB 活堆；400 万对 0.595 s / 64.7 MB；4× addon 2.445 s / 153.5 MB；三套语料均与 golden 逐条一致。`stream` 保留为速度回退。

工作项：

1. `packages/config`：`config.yml` 解析（js-yaml，JSON_SCHEMA 避免 YAML 1.1 的 `yes/no` 陷阱），映射到内部模型；同时定义 v2 JSONC schema（见 5.2）。
2. `packages/core`：
   - 严格分词 + ASCII 快路径；检测 3 条 affix 规则并在编译期特化。
   - 展开每个组的规则树，编译为 `LIT`/`LEX`/`REDUCE` 操作序列；混合组同时保留词法槽和规则分支。
   - 元数据：group `min/max/first/last`、rule `slotOrder/subSizes/base/tgtParts`。
   - namespace trie + 首 token 索引 + 末 token/必需字面量剪枝。
   - 执行器：操作数栈 + `minSp` 回溯恢复；`(generator, rule, combo)` 三元组排序。
   - **fallback 重复 key 必须首次获胜**（对齐 C++ 的 `std::map::insert`）；不能用 `Map.set` 的后写覆盖。
   - `stream` 作为回退引擎，复用同一份 parity harness。
   - 输出只保留输入中出现的 key，以及 unknown。
3. `packages/targets`：legacy `.lang` 读写（UTF-8 无 BOM、CRLF、`S:` 前缀、按第一个 `=` 切分）；JSON 读写放到 Phase 4。
4. `packages/cli`：`gt6tg generate -w workplace -e qt` 兼容旧参数；新增 `--report`、`--dry-run`、`--json-stats`。
5. 接入 parity harness 与基准（见 5.7）。
6. **编译结果缓存**：对展开后的模板图、词法表和 namespace trie 按配置 hash 缓存；`stream` 回退路径继续使用 `hash(group) = hash(生成器定义 + 子组 hash)` 的 group 缓存。长驻进程只重算脏组，冷启动用磁盘缓存并按 hash 淘汰。

**产出**：可用的 `npx gt6tg generate`，输出与 golden 逐条一致。
**验收**：真实配置 < 0.65 s、活堆 < 160 MB；4× addon < 2.6 s、活堆 < 250 MB；400 万对 < 0.7 s、活堆 < 160 MB；774 unknown / 1,986 同英文 / 122 冲突的统计与 C++ 一致；fallback 重复 key 用例通过。
**风险/回退**：语义偏差 → 以 C++ 为 oracle 逐条 diff；保留 C++ CLI 作为 `gt6tg-legacy`。

---

### Phase 2：引擎选择与回退（已原型验证，约 1 周）

**目标**：接入 `engine: "pattern" | "stream" | "token" | "auto"`。`pattern` 是默认引擎；`stream` 在输入 key 很大/规则图很大时作为绝对速度回退；`token` 在极端 P/K 且 pattern 候选异常时作为备选。原型数据：pattern 真实 0.611 s / 62.6 MB、4× 2.445 s / 153.5 MB、爆炸 0.595 s / 64.7 MB；stream 0.607/2.243/1.277 s；token 0.650/2.398/0.623 s。

工作项：

1. 固化 `pattern` 编译器接口（Phase 1 已实现）：把中间模板展开为 `LIT`/`LEX`/`REDUCE`；不递归解析组，不展开 completed-only 笛卡尔积；供 CLI/Web/Worker 复用。
2. `token` 引擎保留字符级模板匹配；`stream` 保留正向枚举 + 立即过滤；三者共享 group/rule 语义和 parity 测试。
3. 处理歧义：混合组同时保留词法槽和规则分支；`pattern` 用首 token/namespace/末 token/必需字面量剪枝；`token` 的相邻占位符继续 lint。
4. **自动选择**：默认 `pattern`；估算编译模式数 `C_pattern`、输入 key 数 `K`、生成量 `P`。`C_pattern` 超过阈值（如 5 万）或编译时间 > 2 s 时回退 `stream`；规则图很小但 `P/K` 极高且 pattern 候选异常时回退 `token`。
5. 排序、去重、缓存：用三元组排序；候选按 `(namespace, target)` 去重保留最新；编译结果按配置 hash 缓存。
6. 对「子串替换」场景复用同一套匹配器（书页术语、散文中的材料名），但只产生建议，不自动改写。

**产出**：`core/matcher/`（pattern / stream / token）+ 引擎选择器 + 基准报告；三者共享 parity 测试。
**验收**：pattern 输出与 golden 逐条一致；explode < 0.7 s；真实/4× 配置在 `auto` 下默认选 pattern，4× 可在“绝对速度优先”配置下选 stream。
**风险**：pattern 编译膨胀/候选过多 → `auto` 回退 stream；混合组歧义 → 用 golden 覆盖 Mercury 类多 namespace 用例。

---

### Phase 3：Web 前端 MVP（1.5–2 周）

**目标**：把配置调试从命令行搬到浏览器，同时不牺牲可复现性。

技术选型（可替换）：Vite + React + TypeScript + Monaco；本地 API 用 Hono/Fastify；生成跑在 `worker_threads`；校验用 zod + JSON Schema。

页面/能力：

1. **项目/目标/Addon 选择器**：切换 target、启用 addon、查看合并后的有效配置。
2. **配置编辑**：表单视图 + 源码视图（YAML/JSONC），实时 schema 校验与行号错误；保存采用原子写 + 时间戳备份。
3. **规则图**：组依赖、环、缺失组、未使用组、每组结果规模、最大笛卡尔积热点。
4. **翻译测试台**：输入 key + 英文值，显示命中链（group → rule → sub → 最终译文）、候选冲突、未知原因。
5. **覆盖率面板**：unknown、同英文、冲突、空值、书本页占比；一键跳转到 fallback 编辑。
6. **构建/导出**：dry-run、与上一版 diff、多目标产物、报告下载。
7. **基准面板**：C++ / JS / N-API 的时间与内存对比（读取 `bench/` 结果）。

**产出**：`apps/web` 可本地启动；核心操作有 Playwright e2e。
**验收**：浏览器内不阻塞（生成在 Worker）；配置错误能定位到行；保存前必须显式确认。
**风险**：浏览器端文件写入边界 → 只允许项目根目录内的路径，写入前 diff + 备份。

---

### Phase 4：GT6W JSON 后端 + Multi-target（1–1.5 周）

**目标**：同一套规则同时服务旧 `.lang` 与 GT6W `zh_cn.json`。

工作项：

1. **TargetProfile**：`legacy-1.7.10`、`gt6w-1.20.1`、`gt6w-26.1.2`；格式、key 适配器、输出路径、排序/换行/空值策略。
2. **Key 目录**：
   - 旧目标：`workplace/en/GregTech.lang`。
   - GT6W：旧 key 目录 ∪ `zh_cn.json` 的 key；英文值缺失时使用 key 或旧英文值，并标记 `sourceMissing`。
3. **JSON 读写**：
   - 扁平 `Record<string,string>`，键排序稳定（建议按 key 字典序）。
   - 原样保留 `¶`；正确转义 `"` 与 `\`；**省略空值**（避免遮盖代码默认值）。
   - 输出路径 `assets/gregtech6/lang/zh_cn.json`，可打包为资源包 zip。
4. **旧-only / JSON-only 报告**：24,528 条旧-only、1,391 条 JSON-only，明确「保留 / 跳过 / 待补英文」。
5. **兼容模式**：仍可生成 `GregTech.lang`（GT6W 的 `UseThisFileAsLanguageFile=true` 回退路径），并提示 JSON 优先。

**产出**：`gt6tg build --target gt6w-1.20.1` 产出可直接放入资源包的 JSON。
**验收**：101,148 条交集 key 全部保留；旧目标输出仍逐字节一致；空值/`¶`/转义有单测。

---

### Phase 5：书本/散文管线（1–1.5 周）

**目标**：让 `written.book.*` 和运行期组合文本有明确的维护方式。

工作项：

1. **静态书页**：把 742 个 `written.book.<BookID>.page.<n>` 作为一等实体；按书分页编辑器；校验页数、`¶` 数量、长度（当前最大 253）。
2. **术语表（glossary）**：对书页/散文做**最长匹配、大小写敏感、词边界**的术语替换；保护 `¶`、`%s`、`%d`、`§x`、`{0}`、URL 等不可译片段。
3. **差异审阅**：术语替换只给出 before/after 建议，必须人工接受；不自动整句改写。
4. **动态材料词典**：`UT.Books.createMaterialDictionary` 在运行时组合文本，静态 lang 无法覆盖；明确文档化该边界，只维护 `gt.matdict.*` 标签和材料名，并提供一个「组合预览」报告（列出会参与组合的标签/材料，指出缺失翻译）。
5. **GT6W 已有译文导入**：`zh_cn.json` 的 742 页中文可作为初始语料；导入时保留来源与 diff。

**验收**：书本页可导入/导出/校验；术语替换不破坏格式码；动态词典的限制在 UI 与文档中可见。
**风险**：过度自动替换导致语义错误 → 只做建议、可回滚、逐条确认。

---

### Phase 6：Addon / 版本 / 输出管理（1.5–2 周）

**目标**：从「单配置单输出」升级为「多 addon、多版本、多产物」。

工作项：

1. **Addon 注册表**：`{ id, versionRange, namespaces, priority, sourceFiles, owner }`；启动时校验命名空间归属与重叠。
2. **分层合并**：base < target < addon；每次覆盖记录 `shadowedBy`；冲突报告按 key 导出。
3. **版本 target**：识别 key 是否存在于目标 key 目录；旧-only 条目在 GT6W 目标中标记 `legacyOnly`，不写入 JSON；JSON-only 条目标记 `needsEnglish`。
4. **输出管理**：一次构建所有启用的 target；产物 `manifest.json` 含文件 hash、规则版本、配置 hash、时间戳；支持 `--dry-run`、`--diff <prev>`、`--zip`。
5. **迁移命令**：`gt6tg migrate config.yml → project.jsonc`；旧 fallback 拆成 `base.fallback` + 本地 override。

**验收**：同一份规则可为旧 `.lang` 与 GT6W JSON 生成产物；addon 冲突可定位；构建可复现（同配置同 hash）。
**风险**：分层优先级改变现有译文 → 默认保持「按原顺序 last-wins」，只有显式 priority 才改变结果；parity 未过不发布。

---

### Phase 7：JS vs C++ N-API 性能对比（可选，3–5 天）

**目标**：用数据判断是否值得引入原生加速。**当前结论：不必要。** 纯 JS `pattern` 在真实语料上为 0.611 s / 62.6 MB 活堆，`stream` 为 0.607 s / 190.8 MB，均已明显优于 Release C++ 基线（1.0 s / 215 MB，单次参考）；在 400 万对场景下 `pattern` 0.595 s / 64.7 MB，也不依赖原生代码。N-API 只作为 profiling 后的可选项。

工作项：

1. 仅在 JS 侧 profiling 出现明确热点时，把对应核心抽成静态库 + C ABI，用 `node-addon-api` 暴露 `generate(request) → result`。
2. 用 CMake + node-gyp 构建 win-x64 预编译；保留源码构建作为 CI 可选任务。
3. 基准矩阵：Release C++ / TS 流式 / TS 分词器 / TS + N-API；指标：冷启动、真实配置、4× addon、400 万对爆炸、峰值 RSS、输出 hash。
4. 决策门：只有当 N-API 在**真实配置和爆炸配置**上都至少快 2× 且内存不劣化，才作为可选后端；默认始终是纯 JS。

**验收**：`bench/report.md` 可复现；选型记录在 ADR 中。
**风险**：原生模块的跨平台/ABI 维护成本 → 默认不启用，CI 只跑 win-x64。

---

## 5. 关键技术方案

### 5.1 算法：从「物化」到「按需」

**实测选择（2026-10-24 更新，详见 [perf-evaluation.md](perf-evaluation.md)）**

| 场景 | forward（现有） | stream | token | pattern |
| --- | ---: | ---: | ---: | ---: |
| 真实 459k pairs | 0.732 s / 277 MB | 0.607 s / 190.8 MB | 0.650 s / 300 MB | **0.611 s / 62.6 MB** |
| 4× addon 1.84M pairs | 2.727 s / 552 MB | **2.243 s / 552 MB** | 2.398 s / 750 MB | 2.445 s / 153.5 MB |
| 400 万 pairs / 100 命中 | 4.032 s / 1.92 GB | 1.277 s / 193 MB | 0.623 s / 308 MB | **0.595 s / 64.7 MB** |

注：均为端到端口径；pattern/stream/token 为 3 轮中位数，forward 为 5 轮基线（见 1.2b）。

**默认：编译型 pattern。** 编译期展开规则图（真实配置 972 条结构模板），运行时按 `LIT`/`LEX`/`REDUCE` 匹配输入；不枚举 completed-only 笛卡尔积，时间与 P 解耦。namespace trie 负责多 addon 前缀过滤，末 token/必需字面量剪枝控制候选数。真实 0.611 s / 62.6 MB，400 万对 0.595 s / 64.7 MB。

**回退：stream / token。** `stream` 保留正向枚举 + 立即过滤，在 4× addon 这类输入 key 很大时绝对速度更快（2.243 s vs 2.445 s）；`token` 保留字符级模板匹配，作为极端 P/K 且 pattern 候选异常时的备选。

**自动选择**：默认 `pattern`；估算 `C_pattern`、`K`、`P`。`C_pattern` 超过阈值（如 5 万）或编译时间 > 2 s 时回退 `stream`；规则图很小但 `P/K` 极高且 pattern 候选异常时回退 `token`。

**两个必须对齐的细节**：

- **fallback 重复 key 首次获胜**：C++ 使用 `std::map::insert`，不是覆盖；原型曾因此在 `S:"fluid.molten hsla"` 上产生 1 条差异。
- **排序不能用 float 编码**：`generator * 1e12` 在 4× 配置下超过 `Number.MAX_SAFE_INTEGER`，会导致条目被误判为重复；用 `(generator, rule, combo)` 三元组比较。

**已评估的替代表示：严格分词 + token 级规则**

按「配置可以重写」的前提，原型还实现了两个不依赖字符级匹配的版本：

- `grammar`：把 config 编译成 token 级 CFG，输入分词后用记忆化解析器解析。
- `flat-token`：被引用组正向建表，但表键是 token 序列；completed-only 规则按 token 边界切分匹配。

结果（详见 [perf-evaluation.md](perf-evaluation.md) 第 7、9 节）：两者都能做到逐条一致，但真实配置下 `flat-token` 0.843 s、`grammar` 1.12–1.57 s，仍慢于 `pattern` 0.611 s / `stream` 0.607 s。`pattern` 是这条方向的最新实现：编译期展开 972 条结构模板，运行时只做 `LIT`/`LEX`/`REDUCE` 匹配。严格分词还暴露了 3 条词内拼接规则（`{0}Crush Hammer Head`、`{0}s`），目前由编译期特化处理，schema v2 应显式标记。

**结论**：默认引擎改为 `pattern`；`stream` 作为多 addon 绝对速度回退；`token` 作为极端 P/K 备选；`grammar` 保留研究。严格分词现在由 `pattern` 采用，不再只是下一阶段配置模型的基础；3 条 affix 规则在编译期特化，后续应在 schema v2 中显式标记。

### 5.2 配置：JSONC schema v2 + 旧 YAML 兼容

- 新格式：`config/project.jsonc`（允许注释），带 `schemaVersion: 2`。
- 用 zod 做运行时校验，导出 JSON Schema 给编辑器补全。
- 旧 `config.yml` 只读导入：`js-yaml` 的 `JSON_SCHEMA`（YAML 1.2 语义）+ 显式类型校验，避免 `yes/no/on/off`、八进制、时间戳被误解。
- 迁移策略：一次性转换 + 保留旧文件；转换后跑 parity。
- 模板约束 lint：`{n}` 必须连续、数量等于 `subs` 长度、不允许未知转义；组引用必须存在。

### 5.3 GT6W JSON 适配

- `TargetProfile.format = "json"`：
  - 读：扁平 JSON → 有序 Map；key 原样保留。
  - 写：按 key 排序、2 空格缩进、UTF-8、LF；省略空值；保留 `¶`。
- Key 适配器：旧 key `S:foo.bar` ↔ JSON `foo.bar`；旧文件中带引号的 key（如 `S:"loot...`）需要还原。
- 英文源：GT6W `en_us.json` 不完整，使用「旧 en ∪ GT6W zh_cn key」作为目录，缺失英文时标记而不是编造。
- 产物：`assets/gregtech6/lang/zh_cn.json` + 可选 `GregTech.lang` 兼容文件。

### 5.4 书本/散文

- 静态书页：key 级实体，支持分页编辑、页数/长度/`¶` 校验。
- 术语替换：Aho-Corasick 多模式匹配 + 最长匹配 + 词边界；保护格式码；只产生建议。
- 动态材料词典：静态语言文件无法覆盖，文档化限制；维护标签与材料名，并提供组合预览。
- 支持导入 GT6W 现有 742 页译文作为起点。

### 5.5 Addon / Target / 输出

- Addon 声明命名空间所有权；合并时检测重叠并报告。
- Target 声明格式、key 目录、输出路径、排序/空值/换行策略。
- Output manager 产出：主输出、unknown、coverage、conflicts、manifest（hash）。
- 所有覆盖操作可 dry-run，写入前 diff + 备份。

### 5.6 Web

- 本地 HTTP 服务只绑定 `127.0.0.1`；写入接口只接受项目根目录内的路径。
- 生成在 Worker 中执行，UI 不阻塞；长任务显示进度与可取消。
- Monaco 编辑器加载 JSON Schema；表单与源码双向同步。
- e2e 用 Playwright；核心逻辑用 vitest 覆盖。

### 5.7 性能基准方法

- 同一语料、同一输出 hash、同一机器。
- 每组 5 次取中位数与 p95；同时记录峰值 RSS。
- 基准场景：真实 125k、4× addon、400 万对爆炸、仅 GT6W 102k、书本 742 页。
- 结果写入 `bench/report.json` 与 `bench/report.md`，PR 中对比。

### 5.8 测试与 CI

- 单元：解析器、模板、命名空间合并、last-wins、JSON 转义。
- 属性测试：随机生成 group/rule，正反向引擎输出一致。
- Parity：golden 逐字节；unknown/conflict/coverage 集合一致。
- e2e：Web 核心路径（加载 → 编辑 → 校验 → 生成 → diff → 保存）。
- CI：Node 单测 + parity + 基准回归阈值（超过基线 20% 失败）。

---

## 6. 里程碑与排期（单人估算）

| 里程碑 | 阶段 | 预计 | 交付价值 |
| --- | --- | ---: | --- |
| M1 基线与 lint | Phase 0 | 1–2 天 | 锁定正确性，发现配置问题 |
| M2 JS 核心可用 | Phase 1 | 1–2 周 | 编译型 pattern 已实测：真实 0.611 s / 63 MB，作为默认 |
| M3 引擎选择与回退 | Phase 2 | 约 1 周 | pattern 默认；stream 多 addon 回退；token 极端 P/K 备选 |
| M4 Web MVP | Phase 3 | 1.5–2 周 | 摆脱命令行，支持测试/改配置 |
| M5 GT6W + 多目标 | Phase 4 | 1–1.5 周 | 高版本兼容 |
| M6 书本管线 | Phase 5 | 1–1.5 周 | 非词法内容可维护 |
| M7 Addon/输出管理 | Phase 6 | 1.5–2 周 | 多 addon 多版本交付 |
| M8 原生基准（可选） | Phase 7 | 3–5 天 | 纯 JS 已优于 C++ 基线，N-API 非必要 |

总计约 8–11 周；若只求「旧目标 + Web 调试」，M1–M4 约 4–6 周即可交付。

---

## 7. 风险登记

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 新引擎语义偏差 | 译文悄悄变化 | C++ 作为 oracle；逐字节 parity；属性测试；未过门槛不切换 |
| fallback 重复 key 覆盖语义错误 | 个别译文与现状不同 | 复刻 `std::map::insert` 的首次获胜；加重复 key 回归用例 |
| 排序用 float 溢出 | 条目被误判重复/顺序错乱 | 用 `(generator, rule, combo)` 三元组比较；禁止 `gen * 1e12` |
| 模板歧义 | 反向匹配漏译/错译 | 自动回退流式引擎；lint 标出相邻占位符规则 |
| 122 条冲突改变行为 | 输出与现状不同 | 默认保持 last-wins；仅在显式优先级下改变；导出冲突报告 |
| 书本自动替换过度 | 语义损坏 | 只给建议；保护格式码；人工接受；可回滚 |
| GT6W 英文 key 不完整 | 无法确定源文本 | 用旧 en ∪ zh_cn key；缺失标记 `sourceMissing`，不编造 |
| JSON 空值/`¶` 处理错误 | 游戏内显示异常 | 单测覆盖；省略空值；原样保留 `¶` |
| `-r` 类破坏性操作 | fallback 被误删 | 新工具默认 dry-run；写入前备份 + diff |
| N-API 维护成本 | 构建/ABI 问题 | 默认不启用；仅 win-x64 预编译；保留纯 JS 路径 |
| pattern 编译膨胀/候选过多 | 内存/时间回升 | 估算 `C_pattern`；超过阈值回退 `stream`；编译结果缓存 |
| pattern 栈回溯覆盖父操作数 | 个别歧义词错译 | `minSp` 保存/恢复；golden parity；覆盖 Mercury 类多 namespace 用例 |
| 空格分词拆并重试漏切 | 漏译 | 当前用标点感知分词；未来 addon 用 split 安全网 + lint |
| 基准噪声 | 选型误判 | 固定语料/机器；3–5 轮中位数 + p95；输出 hash 校验 |

---

## 8. 迁移前可立即做的清理

1. 修复 `materialProductWoodType` 缺失（或显式标注忽略），并加入 lint。
2. 导出 122 条冲突清单，逐条确认期望译文，决定是否显式指定优先级。
3. 明确空值策略：939 条空值在 JSON 中省略，在 `.lang` 中保留现状。
4. 停止用 Debug 构建做性能判断；把 Release 基准写进 README/CI。
5. 为 `-r` 增加 dry-run 与备份开关（新 CLI 默认不删 fallback）。
6. 把当前 `zh/GregTech.lang` 与 `unknown.lang` 固化为 golden fixture（不入库生成物，但可在 CI 中重建并比对 hash）。
7. 检查 fallback 中的重复 key（当前至少有 `S:"fluid.molten hsla"` 两条），确认「首次获胜」语义并加入测试。
8. 把 `doc/perf-evaluation.md` 的基准脚本提升为 `bench/`，在 CI 中跑真实、4×、400 万对三个场景，设置回归阈值。
9. 处理 3 条词内拼接规则：`pattern` 当前在编译期特化成 1,632 条具体词条；schema v2 仍应显式标记 `affix`/`suffix`，避免未来新增规则漏检。
10. 不要把「空格分词 + 拆并重试」作为主路径：当前数据有 16,042 条不一致、约 0.13 s 重试成本、0 条合并需求；标点感知分词更简单且无差异。

---

## 9. 开放问题（需要确认后落定）

1. 新工具是否继续以「语言文件 + 规则」为唯一输入，还是也接受 Weblate/TMX 作为译文来源？
2. GT6W 目标是只产出资源包 JSON，还是同时保留旧 `GregTech.lang` 兼容输出？
3. Web 前端技术栈是否有偏好（React/Vue/Svelte）？本文默认 Vite + React + Monaco。
4. addon 的命名空间所有权由谁维护（仓库内声明 vs 扫描 jar/资源包自动发现）？
5. 引擎选择阈值是否接受「默认 pattern；`C_pattern` 超阈值回退 stream；极端 P/K 回退 token」？需要在上线后用真实 addon 配置回归校准。
6. 是否接受 pattern + stream + token 三引擎的维护成本，还是只保留 pattern + stream，并接受极端配置的备选缺失？
7. 长期是否采用 token 级配置模型（严格分词 + pattern）？`pattern` 已经采用严格分词，下一步是否需要把 3 条 affix 规则迁移成显式 schema 标记？
8. 书本术语表是否需要支持多语言（不只是中英）？
