# `@gt6tg/core`

GregTech6 翻译工具链的算法与配置核心。它只做四类事情：

1. 解析/校验/编辑 JSONC v2 工程配置；
2. 把旧版 `.lang` 文本解析成词条，或把词条写回旧版 `.lang`；
3. 把配置编译成 `LIT`/`LEX`/`REDUCE` 模式，并匹配输入值、生成候选；
4. 提供 lint、统计、diff 和单条目 trace。

它**不**负责文件系统、HTTP/WebSocket、Vue 或 Naive UI。文件读写和本地 RPC 在 `packages/server`，浏览器控制台在 `packages/web`。

- 配置唯一事实来源：`packages/core/project.jsonc`
- 设计/性能/迁移文档：`packages/core/docs/`
- 公共入口：`packages/core/src/index.ts`
- 包本身是 source-only（`main`/`types` 指向 `src/index.ts`），由 `tsx`/Vite/测试运行器直接消费；`npm run build` 实际是 `tsc --noEmit`。

---

## 1. 运行方式

### 1.1 作为库

```bash
cd packages/core
npx tsx your-script.ts
```

```ts
import { compileConfig, parseProjectJsonc } from '@gt6tg/core';
```

在 Rush/pnpm workspace 中，`packages/server` 和 `packages/web` 通过 workspace 依赖引用 core。server 用 `tsx` 运行，web 只做 type-only import（API DTO），所以浏览器包不会把算法打进 UI。

### 1.2 真实语料 parity

```bash
cd packages/core
npx tsx scripts/check-parity.ts
```

脚本会读取：

- `packages/core/project.jsonc`
- `packages/legacy/workplace/en/GregTech.lang`
- `packages/legacy/workplace/zh/GregTech.fallback.lang`
- `packages/legacy/workplace/zh/GregTech.lang`（golden）
- `packages/legacy/workplace/zh/GregTech.unknown.lang`

输出编译耗时、生成耗时、pattern 统计、`mismatch`、`unknownMismatch`、hash。当前基线必须是：

```
mismatch = 0
unknownMismatch = 0
unknown = 774
hash = db41064a4b4c34dd
```

### 1.3 单测、类型、lint、格式

```bash
cd packages/core
npx vitest run
npx tsc --noEmit
npx oxlint
npx oxfmt --check
```

### 1.4 通过本地控制台间接运行

```bash
# 仓库根目录
node scripts/dev.mjs
```

它会同时启动 `packages/server`（WebSocket RPC，127.0.0.1:5175）和 `packages/web`（Vite，127.0.0.1:5173）。core 的编译/匹配/生成都在 server 进程里执行。

### 1.5 core 不做什么

- 不读文件：调用方把 JSONC/YAML/`.lang` 文本传进来，或把解析后的词条数组传进来。
- 不解析相对路径：`TargetConfig` 里的路径由 server 解析和做越界校验。
- 不启动服务：RPC 实现在 `packages/server`，core 只声明 `ServerMethodMap` 类型。
- 不处理 GT6W JSON：当前只实现 `legacy-lang` 目标。

---

## 2. 目录与分层

```
packages/core/
├── project.jsonc                 # JSONC v2 工程配置
├── docs/                         # 算法/性能/迁移文档
├── scripts/check-parity.ts       # 真实语料 parity
├── test/                         # vitest 单测
└── src/
    ├── index.ts                  # 公共 API 汇总
    ├── types/
    │   ├── config.ts             # 配置模型
    │   ├── issues.ts             # 诊断/统计
    │   ├── lang.ts               # 旧版 .lang 文档
    │   └── api.ts                # RPC/控制台 DTO
    ├── config/
    │   ├── schema.ts             # zod schema
    │   ├── jsonc.ts              # JSONC 解析/目标修改
    │   ├── lint.ts               # 语义 lint
    │   └── legacyYaml.ts         # config.yml -> v2
    └── engine/
        ├── tokenizer.ts          # 严格分词
        ├── model.ts              # generator/group 图、大小、顺序
        ├── lexicon.ts            # 词法条目、affix 特化、token trie
        ├── compile.ts            # LIT/LEX/REDUCE、namespace trie
        ├── matcher.ts            # 模式执行、候选、trace
        ├── apply.ts              # 生成、去重、fallback、unknown
        ├── entryTest.ts          # 单条测试
        ├── legacyLang.ts         # .lang 读写
        └── stats.ts              # 统计/diff
```

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 类型层 | `src/types/*` | 纯类型/常量；不依赖引擎实现 |
| 配置层 | `src/config/*` | 解析、schema、lint、JSONC 编辑、YAML 导入 |
| 引擎层 | `src/engine/*` | 分词、编译、匹配、生成、trace |
| 入口层 | `src/index.ts` | 统一导出；提供 `compileConfig` 一站式编译 |

---

## 3. 数据流

```
ProjectConfigV2
   │ buildModel
   ▼
GeneratorModel（gens / groupIndex / groupSize / resolveGroup / 顺序比较）
   │ buildLexicon
   ▼
Lexicon（dict + affix 词条、token trie、RuleMeta）
   │ compileProject
   ▼
CompiledProject（groupPatterns / topPatterns / namespaceRoot）
   │ new Matcher(...) 或 generateFromEntries(...)
   ▼
Candidate[] ──dedupeCandidates──► selectCandidate ──► output / fallback / unknown
```

单条测试在同样的编译结果上运行，只是额外收集 `TraceStep`。

---

## 4. 配置模型

### 4.1 `ProjectConfigV2`

```ts
interface ProjectConfigV2 {
  schemaVersion: 2;
  legacy?: { version?: string | number; lang?: string; sourceFile?: string };
  defaultTarget: string;
  targets: TargetConfig[];
  generators: GeneratorConfig[];
}
```

- `defaultTarget` 必须存在于 `targets`。
- `generators` 的顺序很重要：最终候选按 `(generator, rule, combo)` 取最后命中。
- `legacy` 只用于追溯，不参与算法。

### 4.2 `GeneratorConfig`

```ts
interface GeneratorConfig {
  group?: string;
  namespace?: string;
  cached?: boolean;
  completed?: boolean;   // 默认 true
  complete?: boolean;    // 旧配置笔误；C++ 不读，core 也不使用
  extensions?: string;   // 旧配置笔误；C++ 只读 extension（单数），core 不使用
  dict?: Record<string, string | Record<string, string>>;
  rules?: RuleDefinition[];
}
```

- **一个块可以同时有 `dict` 和 `rules`**。当前配置有 10 个这样的块；`buildModel` 会按对象键顺序同时生成 dict generator 和 rule generator。
- `completed: false` 的 generator 可以作为子组使用，但不会直接产生顶层候选。
- `cached` 当前不参与匹配；它保留给未来的生成缓存。
- 嵌套 dict：

  ```jsonc
  "Carminite": {
    "S:": "砷铅铁",
    "S:oredict.gem": "砷铅铁矿石"
  }
  ```

  会展开成多个 dict generator，分别使用内部 namespace。
- `RuleDefinition`：

  ```ts
  interface RuleDefinition {
    s: string;        // "Crate of {0}"
    t: string;        // "{0}板条箱"
    subs: string[];   // ["dust"]
  }
  ```

  `{n}` 对应 `subs[n]`。槽位可以出现在 `s` 和 `t` 中，检查见 `lintProject`。

### 4.3 `TargetConfig` 与路径

```ts
interface TargetConfig {
  id: string;
  label: string;
  format: 'legacy-lang';
  workplace: string; // 相对仓库根目录
  source: string;    // 相对 workplace
  fallback: string;
  output: string;
  unknown: string;
  encoding: 'utf-8';
  lineEnding: 'crlf' | 'lf';
  notes?: string;
}
```

core 只保存路径字符串，**不解析、不校验越界**。`packages/server/src/paths.ts` 负责 `resolveInsideRepo` 和文件读写。

### 4.4 命名空间与顺序

- `combineNamespaces(a, b)`：一方是另一方前缀时取较长者，否则返回 `null`，整条组合作废。
- 候选排序：`isBetterOrder(a, b)` 按 `generator > rule > combo` 比较；同一原文有多个候选时最后命中者获胜。
- fallback 的重复 key 必须**首次获胜**，用 `buildFallbackMap` 构建，不能直接 `Map.set` 后写覆盖。

---

## 5. 主要类型

### 5.1 配置与诊断

| 类型 | 作用 | 关键字段 |
| --- | --- | --- |
| `ProjectConfigV2` | JSONC v2 根配置 | `schemaVersion`, `defaultTarget`, `targets`, `generators` |
| `TargetConfig` | 单目标文件布局 | `workplace`, `source`, `fallback`, `output`, `unknown`, `lineEnding` |
| `GeneratorConfig` | 一个 generator 块 | `group`, `namespace`, `completed`, `dict`, `rules` |
| `RuleDefinition` | 规则模板 | `s`, `t`, `subs` |
| `ConfigIssue` | lint/解析诊断 | `severity`, `code`, `message`, `path`, `line`, `column` |
| `ProjectStats` | 配置规模统计 | generator/group/rule/slot/dict/completed/mixed/missing/cycles |
| `LintReport` | lint 结果 | `issues`, `stats` |

`lintProject` 的常见 code：

- `group.missing`、`group.cycle`
- `rule.slot-out-of-range`、`rule.unused-sub`、`rule.adjacent-slots`
- `rule.affix`（词内拼接，编译期特化）
- `rule.empty-source`、`rule.empty-sub`
- `dict.empty-key`、`dict.empty-value`
- `legacy.complete-key`、`legacy.extensions-key`（旧键被忽略）

### 5.2 旧版 `.lang`

| 类型 | 作用 | 关键字段 |
| --- | --- | --- |
| `LangEntry` | 一条词条 | `key`, `value`, `line` |
| `LangDuplicate` | 重复 key | `key`, `value`, `line`, `previousValue`, `previousLine` |
| `LangDocument` | 解析后的文件 | `entries`, `map`, `duplicates`, `lineEnding`, `issues` |
| `LangFileStats` | 统计 | `keys`, `uniqueKeys`, `emptyValues`, `duplicateKeys`, `valuesWithParagraph`, `valuesWithEquals`, `lineEnding` |

`LangDocument.map` 是后写覆盖，用于按 key 查源文/输出；fallback 的首次获胜语义由 `buildFallbackMap` 单独实现。

### 5.3 引擎内部类型

| 类型 | 作用 |
| --- | --- |
| `EngineGenerator` | 规范化后的 generator：`id`, `group`, `namespace`, `completed`, `kind`, `payload` |
| `GeneratorModel` | generator 数组、组索引、`groupSize`、`resolveGroup`、`combineNs`、`betterOrder`、`compileTemplate` |
| `ResolvedEntry` | `resolveGroup` 的具体结果：`s`, `t`, `ns`, `gen`, `ri`, `combo`, `idx` |
| `LexEntry` | 词法表条目：`terms`, `target`, `namespace`, `generatorId`, `rule`, `combo`, `index`, `groupId` |
| `RuleMeta` | 规则编译元数据：`srcParts`, `tgtParts`, `subs`, `subSizes`, `slotOrder`, `slotCount`, `base`, `count` |
| `Lexicon` | 词法表：`byFirst`, `last`, `trie`, `groupRuleMetas`, `ruleMetaByKey` |
| `PatternOp` | `{kind:'lit'}` / `{kind:'lex'}` / `{kind:'reduce'}` |
| `CompiledPattern` | `ops`, `min`, `max`, `first`, `last`, `required`, `rem` |
| `NamespaceNode` | namespace trie 节点：`children`, `patterns`, `candidates`, `firstIndex` |
| `CompiledProject` | `model`, `lexicon`, `groupPatterns`, `topPatterns`, `namespaceRoot`, `stats` |
| `Candidate` | 运行时候选：`target`, `namespace`, `idx`, `generatorId`, `rule`, `combo` |
| `CandidateView` | 前端候选视图：`target`, `namespace`, `generator`, `generatorId`, `rule`, `combo` |
| `GenerationResult` | `output: Map<string,string>`, `unknown: Set<string>`, `stats`, `candidatesByValue` |
| `EntryTestResult` | 单条测试结果：`tokens`, `selected`, `candidates`, `fallback`, `unknown`, `steps`, `issues` |
| `TraceStep` | 单步 trace：`stage`, `message`, `data` |

### 5.4 RPC / 控制台 DTO

| 类型 | 作用 |
| --- | --- |
| `ProjectSnapshot` | 当前 raw、解析后的 config、issues、stats、targets、activeTargetId |
| `SaveProjectResult` | 保存结果：`savedAt`, `backupPath` |
| `TargetPatch` | 目标字段补丁（不能改 `id`/`format`/`encoding`） |
| `FileInfo` | 文件是否存在、大小、行数、key 数、空值、重复、`¶`/`=`、换行符 |
| `DiffStats` / `DiffSample` | 两个 key→value 映射的差异统计和样例 |
| `IoCheckReport` | IO 检查结果：四个文件信息、生成摘要、diff、notes |
| `GenerateResult` | 生成结果：统计、hash、diff、写入路径/备份 |
| `EntryTestRequest` / `EntryTestResult` | 单条测试请求/结果 |
| `ServerMethodMap` | RPC 方法签名表，server 实现、web 只 type-import |

`ServerMethodMap` 的方法：

| 方法 | 参数 | 返回 |
| --- | --- | --- |
| `getProject` | `[]` | `ProjectSnapshot` |
| `validateProject` | `[raw]` | `ProjectSnapshot` |
| `saveProject` | `[raw]` | `SaveProjectResult` |
| `updateTarget` | `[raw, targetId, patch]` | `ProjectSnapshot` |
| `checkIo` | `[targetId]` | `IoCheckReport` |
| `generate` | `[targetId, write, includeOutput?]` | `GenerateResult` |
| `testEntry` | `[targetId, key, value?]` | `EntryTestResult` |
| `importLegacyConfig` | `[]` | `ProjectSnapshot` |

类型工具：

```ts
type P = ServerParams<'testEntry'>; // [targetId: string, key: string, value?: string]
type R = ServerResult<'testEntry'>; // EntryTestResult
```

core 只声明这些类型；实现位于 `packages/server/src/handlers.ts`。

---

## 6. API 参考

以下签名省略了部分泛型细节，以源码 `src/index.ts` 为准。

### 6.1 配置解析与编辑

#### `parseProjectJsonc(raw: string): { config: ProjectConfigV2 | null; issues: ConfigIssue[] }`

解析允许注释和尾逗号的 JSONC；语法错误会带 1-based 行列号，schema 错误带 `path`。

```ts
const parsed = parseProjectJsonc(raw);
if (!parsed.config) {
  console.error(parsed.issues);
  throw new Error('配置无效');
}
```

#### `lintProject(config: ProjectConfigV2): LintReport`

语义 lint：缺失组、环、槽位越界/未使用、相邻占位符、affix、空 dict key/value、旧键 `complete`/`extensions` 等。返回 `issues` 和 `stats`。

#### `getTarget(config, targetId?): TargetConfig`

`targetId` 省略时使用 `config.defaultTarget`；找不到会抛错。

#### `updateTargetJsonc(raw, targetId, patch): { raw: string; issues: ConfigIssue[] }`

用 `jsonc-parser.modify` 只改目标对象，保留文件里的注释和其他内容。返回的新 `raw` 仍需重新解析/lint 后再写盘。`patch` 不接受 `id`/`format`/`encoding`。

```ts
const updated = updateTargetJsonc(raw, 'gt6-legacy', { lineEnding: 'lf' });
if (updated.issues.some((issue) => issue.severity === 'error')) {
  // 不写盘
} else {
  await writeFile('packages/core/project.jsonc', updated.raw);
}
```

#### `stringifyProjectConfig(config): string`

重新序列化整份配置（会丢失原注释）。主要用于 legacy YAML 导入或新建配置。

#### `convertLegacyYamlToProject(yamlText, options?): ProjectConfigV2`

把旧 `config.yml` 文本转成 v2 配置。默认 target 是 `DEFAULT_LEGACY_TARGET`，`sourceFile` 默认 `packages/legacy/workplace/config.yml`。不会自动写盘。

```ts
const config = convertLegacyYamlToProject(yamlText);
const raw = stringifyProjectConfig(config);
```

### 6.2 编译

#### `compileConfig(config): CompiledProject`

一站式编译，等价于：

```ts
const model = buildModel(config);
const lexicon = buildLexicon(model);
const compiled = compileProject(model, lexicon);
```

`compileConfig` 约 30 ms（当前配置）；一次编译后可以多次 `generateFromEntries` 或 `testEntry`。

#### `buildModel(config): GeneratorModel`

把 JSONC generator 块展开成内部 generator 数组，并构建组索引、组大小、`resolveGroup` 和排序函数。

常用方法：

```ts
model.groupSize('dust');          // 近似结果数，用于 combo
model.resolveGroup('material');   // 物化条目（affix 特化用）
model.combineNs('S:', 'S:oredict.');
model.betterOrder(a, b);
model.compileTemplate('Crate of {0}');
```

`resolveGroup` 会物化子组结果；只应在需要具体条目时调用（例如 affix 特化），不要用它做常规匹配。

#### `buildLexicon(model): Lexicon`

构建 dict 词条、affix 特化词条、token trie、`RuleMeta`。

- `hasGroupEntries(gid)`：组是否有词法条目（dict 或 affix）
- `hasGeneratorEntries(gid, genId)`：某个 generator 是否有 affix 词条
- `firstTokens(gid, allowedGen?)`：首 token 集合

#### `compileProject(model, lexicon): CompiledProject`

把所有组和规则展开成 `LIT`/`LEX`/`REDUCE` 模式，构建 namespace trie。可能抛出 pattern 展开上限错误（当前配置远低于上限）。

`CompiledProject.stats` 包含：

```ts
{ topPatterns, allPatterns, maxGroupPatterns, lexEntries }
```

#### `MAX_TOKENS`

`128`。输入值 token 数超过它时跳过匹配。

#### `patternLabel(compiled, pattern): string`

把模式格式化为 `LIT(Crate) | LEX(wood) | REDUCE(material:3) ...`，用于日志/trace。

#### `groupLexEntries(lexicon, groupId): LexEntry[]`

取出某组的全部词法条目，用于调试/统计。

### 6.3 匹配与生成

#### `class Matcher`

```ts
const matcher = new Matcher(compiled);
const result = matcher.match(key, value, {
  trace: [],        // 可选：收集 TraceStep
  attempts: [],     // 可选：记录被尝试的 pattern
  maxSteps: 400,
});
```

返回：

```ts
{
  tokens: string[];
  candidates: Candidate[];
  patternsTried: number;
}
```

`Matcher` 内部缓存 token 和上一次 namespace 节点；可以复用于多个 key，但不要跨线程共享同一个实例。

公开方法：

- `tokenize(value)`：带缓存的严格分词
- `namespaceNode(key)`：沿 namespace trie 找最深节点
- `match(key, value, options?)`：执行匹配

#### `candidateViews(compiled, candidates): CandidateView[]`

把内部 `Candidate` 转成前端展示用视图（补上组名）。

#### `dedupeCandidates(compiled, candidates): Candidate[]`

按 `(namespace, target)` 去重，保留 `(gen,ri,combo)` 更大的候选。

#### `selectCandidate(compiled, key, candidates): Candidate | undefined`

先按 `key.startsWith(namespace)` 过滤，再取 order 最大者。没有合法候选返回 `undefined`。

#### `generateFromEntries(compiled, sourceEntries, fallbackEntries): GenerationResult`

对完整输入生成输出。内部会：

1. 对每个源条目调用 `Matcher.match`；
2. 按原文值聚合候选；
3. 去重、按 key namespace 过滤、取最后命中；
4. 没有候选时使用 fallback；再没有则保留英文并记入 `unknown`。

返回：

```ts
{
  output: Map<string, string>;
  unknown: Set<string>;
  stats: {
    sourceKeys, outputKeys, unknownKeys,
    sameAsEnglish, conflictKeys, matchedKeys
  };
  candidatesByValue: Map<string, Candidate[]>;
}
```

注意：`generateFromEntries` 每次都新建一个 `Matcher`；如果你要连续生成多次，编译结果可以复用，但每次生成会重新建匹配器。

#### `buildFallbackMap(entries): Map<string, string>`

按首次出现构建 fallback 表，对齐 C++ 的 `std::map::insert` 首次获胜语义。

### 6.4 单条测试与 trace

#### `testEntry(compiled, key, value, fallbackMap, issues?): EntryTestResult`

```ts
const result = testEntry(compiled, key, value, buildFallbackMap(fallback.entries));
```

返回：

- `tokens`：严格分词结果
- `selected`：最终候选（`CandidateView`）
- `candidates`：去重后的全部候选
- `fallback`：fallback 值（如果命中）
- `unknown`：既没有候选也没有 fallback
- `steps`：`TraceStep[]`，包含 `tokenize`/`namespace`/`pattern`/`lit`/`lex`/`reduce`/`emit`/`reject`/`select`/`fallback`
- `issues`：调用方传入的配置诊断

core 返回的 `targetId` 是空字符串；server 会在返回前填入实际 target。

`TraceStep`：

```ts
interface TraceStep {
  stage: TraceStage;
  message: string;
  data?: Record<string, unknown>;
}
```

trace 最多 400 步；单条测试的 pattern 尝试最多记录 120 个（`PatternAttempt`）。

### 6.5 旧版 `.lang`

#### `parseLegacyLang(text): LangDocument`

- 从包含 `languagefile` 的行开始；
- 每个含 `=` 的行按第一个 `=` 切分，key 去掉前导空格；
- 遇到含 `}` 的行结束；
- 保留 `S:` 前缀、值中的 `=` 和 `¶`；
- `line` 为 1-based 原始行号；
- `duplicates` 记录重复 key 的当前/上一次位置；
- `map` 是后写覆盖。

#### `writeLegacyLang(entries, lineEnding = 'crlf'): string`

输出与 C++ `LangFile` 对齐的头：

```
# Configuration file
enablelangfile {
    B:UseThisFileAsLanguageFile=true
}

languagefile {
    key=value
}

```

顺序由调用方决定；`generate` 按源文件顺序写。CRLF 是默认值。

### 6.6 统计与 diff

#### `analyzeLangDocument(document): LangFileStats`

统计 key 数、唯一 key、空值、重复 key、含 `¶`、含 `=`、换行符。`lines` 字段当前等于词条数（历史命名），物理行数由 server 的 `FileInfo.lines` 单独计算。

#### `diffLangMaps(expected, actual, sampleLimit = 20): DiffStats`

比较两个 `Map<string,string>`：

- `same`：expected 中存在且值相同
- `changed`：expected 中存在但值不同
- `removed`：expected 有、actual 没有
- `added`：actual 有、expected 没有
- `samples`：前 N 条差异

### 6.7 工具函数

| API | 说明 |
| --- | --- |
| `tokenize(value)` | 严格分词；ASCII 走手写快路径 |
| `tokenizeAscii(value)` | 仅 ASCII 的手写分词 |
| `compileTemplate('Crate of {0}')` | 拆成 `['Crate of ', 0]` |
| `combineNamespaces(a, b)` | 前缀兼容则取较长者，否则 `null` |
| `isBetterOrder(a, b)` | `(gen,ri,combo)` 三元组比较 |
| `generatorLabel(model, genId)` | 调试标签 |
| `ruleLabel(model, genId, ruleIndex)` | 调试标签 |
| `patternLabel(compiled, pattern)` | `LIT/LEX/REDUCE` 可读串 |
| `groupLexEntries(lexicon, gid)` | 某组全部词法条目 |

---

## 7. 调用示例

### 7.1 完整生成（不写文件）

```ts
import { readFileSync } from 'node:fs';

import {
  compileConfig,
  generateFromEntries,
  parseLegacyLang,
  parseProjectJsonc,
  writeLegacyLang,
} from '@gt6tg/core';

const raw = readFileSync('packages/core/project.jsonc', 'utf8');
const parsed = parseProjectJsonc(raw);
if (!parsed.config) throw new Error(JSON.stringify(parsed.issues));

const compiled = compileConfig(parsed.config);
const source = parseLegacyLang(readFileSync('packages/legacy/workplace/en/GregTech.lang', 'utf8'));
const fallback = parseLegacyLang(
  readFileSync('packages/legacy/workplace/zh/GregTech.fallback.lang', 'utf8'),
);

const result = generateFromEntries(compiled, source.entries, fallback.entries);

const outputEntries = source.entries.map((entry) => ({
  ...entry,
  value: result.output.get(entry.key) ?? entry.value,
}));
const unknownEntries = source.entries.filter((entry) => result.unknown.has(entry.key));

const outputText = writeLegacyLang(outputEntries, 'crlf');
const unknownText = writeLegacyLang(unknownEntries, 'crlf');

console.log(result.stats, result.output.size, outputText.length, unknownText.length);
```

写盘、备份和路径校验由 `packages/server/src/io.ts` 负责，core 不接触文件。

### 7.2 单条测试 + trace

```ts
import {
  buildFallbackMap,
  compileConfig,
  parseLegacyLang,
  testEntry,
} from '@gt6tg/core';

const compiled = compileConfig(parsed.config);
const fallback = parseLegacyLang(fallbackText);

const result = testEntry(
  compiled,
  'S:oredict.crateGt64DustRainforestJasper',
  'Crate of Rainforest Jasper Dust',
  buildFallbackMap(fallback.entries),
);

console.log(result.selected?.target); // 雨林碧玉粉板条箱
for (const step of result.steps) {
  console.log(step.stage, step.message, step.data);
}
```

### 7.3 检查配置

```ts
import { lintProject, parseProjectJsonc } from '@gt6tg/core';

const parsed = parseProjectJsonc(raw);
if (parsed.config) {
  const lint = lintProject(parsed.config);
  console.log(lint.stats);
  for (const issue of lint.issues) {
    console.log(issue.severity, issue.code, issue.message, issue.path);
  }
}
```

### 7.4 修改 target（保留注释）

```ts
import { writeFile } from 'node:fs/promises';

import { updateTargetJsonc } from '@gt6tg/core';

const { raw: nextRaw, issues } = updateTargetJsonc(raw, 'gt6-legacy', {
  output: 'zh/GregTech.lang',
  lineEnding: 'crlf',
});

if (!issues.some((issue) => issue.severity === 'error')) {
  // 交给 server 的 writeWithBackup
}
```

### 7.5 server 侧调用

```ts
import {
  compileConfig,
  generateFromEntries,
  parseLegacyLang,
  parseProjectJsonc,
  writeLegacyLang,
} from '@gt6tg/core';
```

server 负责：

- 读取 `packages/core/project.jsonc` 和 target 文件；
- `resolveInsideRepo` 路径校验；
- 保存前 `writeWithBackup`；
- 把 core 的 `Map`/`Set` 序列化成 RPC DTO。

### 7.6 web 侧只使用类型

```ts
import type {
  EntryTestResult,
  IoCheckReport,
  ProjectSnapshot,
  ServerMethodMap,
} from '@gt6tg/core';

// 实际调用：
// ws.send({ id, method: 'testEntry', params: [targetId, key, value] })
```

web 不 import core 的运行时函数；算法不会进入浏览器包。

---

## 8. 语义与保证

1. **严格分词**：单词（允许内部撇号）+ 标点；空白不作为 token。`Anti-Actinium` → `[Anti, -, Actinium]`。
2. **方向**：从输入 token 出发匹配 `LIT`/`LEX`，不展开 completed-only 笛卡尔积。
3. **affix 特化**：`{0}Crush Hammer Head`、`{0}s` 在编译期展开成具体词条；运行时不需要拆分 token。
4. **候选顺序**：`(generator, rule, combo)` 三元组，最后命中获胜；不能编码成单个 float。
5. **namespace**：`combineNs` 只接受前缀兼容，最终候选还要通过 `key.startsWith(namespace)`。
6. **fallback**：首次获胜；`buildFallbackMap` 已实现。
7. **未知**：没有候选且没有 fallback 时保留英文并写入 `unknown`。
8. **确定性**：相同配置/输入/顺序产生相同输出；hash 可复现。
9. **纯函数/类**：core 不依赖全局状态；`Matcher` 的缓存是实例级。

### 过滤器

pattern 匹配前会依次检查：

- 首 token 索引（namespace 节点内）
- `min`/`max` token 数
- `last` token
- `required` 字面量顺序子序列
- `LEX` 内部的 `remMin`/`remMax` 剩余长度约束

这些过滤器只做剪枝，不改变语义；真正的词法匹配由 token trie 完成。

---

## 9. 性能与并发

- 当前真实配置：编译约 30 ms；完整 125,676 key 生成约 1.8–2.6 s（Node 24，取决于机器/GC）。
- `compileConfig` 只做一次；重复单条测试复用 `CompiledProject`。
- `generateFromEntries` 每次新建 `Matcher`，适合一次完整生成；如果需要多次生成，编译结果可复用，匹配器不必跨次共享。
- `Matcher` 含可变缓存（token/namespace），不要并发共享同一个实例；为每个 worker/请求创建独立实例。
- `generateFromEntries` 的 `candidatesByValue` 会保留候选；如果只需要统计，可在调用后丢弃引用，避免长期占用。

---

## 10. 错误处理

- `parseProjectJsonc` 不抛错：返回 `config: null` 和 `issues`。
- `lintProject` 不抛错：返回问题列表。
- `compileConfig`/`buildModel`/`buildLexicon`/`compileProject` 在配置结构不可编译时抛错（例如 pattern 展开超限）。
- `generateFromEntries` 假设 `CompiledProject` 已成功编译；不会检查源/fallback 文件是否存在。
- `testEntry` 假设 `value` 已由调用方解析；server 负责“key → 英文值”的查找。
- `writeLegacyLang` 只生成字符串，不写文件。

---

## 11. 当前边界

- 只实现 `legacy-lang` target；GT6W JSON 是后续 target。
- 书本/散文没有专门处理；它们会走普通匹配，未命中则进入 unknown。
- `complete`/`extensions` 这两个旧键会被忽略（与 C++ 行为一致）；lint 会给出 info。
- `conflictKeys` 统计的是“对当前 key 通过 namespace 过滤后仍有多个不同译文”的 key 数；与早期文档的 122 口径可能不同。
- 词法 trie 目前是一级 token trie + 每节点 entries；如果规则图继续增长，可以再做共享前缀/子自动机。

---

## 12. 相关文档

- [算法实现说明](docs/algorithms.md)：forward/stream/token/grammar/flat-token/pattern 的对比、编译细节、实测数据。
- [性能评估](docs/perf-evaluation.md)：基准方法、各引擎数字、优化结论。
- [迁移方案](docs/migration-plan.md)：阶段计划、目标架构、风险。
- [仓库 README](../../README.md)：Rush 工作区、server/web 启动方式。
