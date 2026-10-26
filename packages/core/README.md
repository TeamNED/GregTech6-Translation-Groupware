# `@gt6tg/core`

GregTech6 翻译工具链的**纯算法与配置核心**。它只做：

1. 解析/校验/编辑 JSONC v2 工程配置；
2. 把旧版 `.lang` 文本解析成词条，或把词条写回旧版 `.lang`；
3. 把配置编译成 `LIT` / `LEX` / `REDUCE` 模式，匹配输入值并生成候选；
4. 提供 lint、统计、diff、parity 比较原语、Hook 和单条目 trace。

它**不**负责文件系统、HTTP/WebSocket、Vue/Naive UI、RPC 传输、CLI 或 hash 实现。当前分层：

```
core (纯算法/配置/Hook/领域类型)
  ↑
runtime (EngineHost、任务调度、编译缓存、传输无关协议、HashProvider 注入)
  ↑
node (CLI、dev server、worker_threads、fs)     web (Vue UI、Worker)
```

- 公共入口：`packages/core/src/index.ts`（全量 `export *` barrel）。
- 包是 source-only：`main`/`types` 指向 `src/index.ts`，由 `tsx`/Vite/测试直接消费；`npm run build` 是 `tsc --noEmit`。
- 默认配置和生成物不在 core：见 `packages/node/project.jsonc`、`packages/node/dist/`。
- 算法设计细节见 [docs/algorithms.md](docs/algorithms.md)；迁移背景见 [docs/migration-plan.md](docs/migration-plan.md)。

---

## 1. 使用方式

```ts
import {
  compileConfig,
  generateFromEntries,
  parseLegacyLang,
  parseProjectJsonc,
  type ProjectConfigV2,
} from '@gt6tg/core';

const parsed = parseProjectJsonc(rawConfig);
if (!parsed.config) throw new Error('配置无效');
const compiled = compileConfig(parsed.config);
const source = parseLegacyLang(sourceText);
const fallback = parseLegacyLang(fallbackText);
const result = generateFromEntries(compiled, source.entries, fallback.entries);
```

浏览器/Node 的完整运行链路由 `@gt6tg/runtime` 的 `EngineHost` 提供；core 本身不读写文件、不启动 Worker。

---

## 2. 配置模型

`ProjectConfigV2`（`src/types/config.ts`）：

```ts
interface ProjectConfigV2 {
  schemaVersion: 2;
  legacy?: { version?: string | number; lang?: string; sourceFile?: string };
  defaultTarget: string;
  targets: TargetConfig[];
  generators: GeneratorConfig[];
}
```

- `TargetConfig`：`id/label/format/workplace/source/fallback/output/unknown/encoding/lineEnding/notes`；目前 `format` 只支持 `legacy-lang`。
- `GeneratorConfig`：`group`、`namespace`、`completed`、`dict`、`rules`；一个块可以同时包含 dict 和 rules。
- `RuleDefinition`：`{ s, t, subs }`。

配置 API：

| API | 作用 |
| --- | --- |
| `parseProjectJsonc(raw)` | 解析 JSONC + schema + 语义问题；不抛错，返回 `config: null` 或 issues |
| `lintProject(config)` | 语义 lint + `ProjectStats`（generator 数、组、规则模板、槽位、dict 条目、缺失组、环） |
| `getTarget(config, targetId?)` | 按 id 或 defaultTarget 取 target |
| `updateTargetJsonc(raw, targetId, patch)` | 用 `jsonc-parser.modify` 只改 target，保留注释；返回新 raw + issues |
| `stringifyProjectConfig(config)` | 序列化 JSONC v2 文本（会丢失原注释） |

legacy `config.yml` 导入在 `packages/node`，不在 core；core 不依赖 `yaml`。

---

## 3. 引擎数据流

```
config
  → buildModel           generator/group/namespace/规则图
  → buildLexicon         词法条目、affix、token trie
  → compileProject       展开为 LIT / LEX / REDUCE 模式 + namespace trie
  → Matcher.match        输入 key/value → 候选
  → generateFromEntries  按原文值聚合、去重、fallback、unknown、统计
```

- `compileConfig(config)`：一次完成 model + lexicon + compile，并写入 `timings`。
- 匹配器有 token/namespace 缓存；一个 `Matcher` 可复用一个输入文件，但不要并发共享。
- 生成结果包括 `output`、`unknown`、`stats`、`candidatesByValue`、`timings`。浏览器/Node 宿主通常不保留 `candidatesByValue`，只在调试时读取。
- 单条目 `testEntry` 返回 tokens、候选、最终选择、fallback、unknown 和 LIT/LEX/REDUCE/EMIT trace。

---

## 4. 公共 API

### 4.1 编译

| API | 说明 |
| --- | --- |
| `compileConfig(config)` | model + lexicon + compile 的组合入口 |
| `buildModel(config)` | 构建 generator/group 模型 |
| `buildLexicon(model)` | 构建词法表和 trie |
| `compileProject(model, lexicon, timer?)` | 展开模式并构建 namespace trie |
| `patternLabel(compiled, pattern)` | 调试用模式文本 |
| `MAX_TOKENS` | 单条值最大 token 数（128） |

### 4.2 匹配与生成

| API | 说明 |
| --- | --- |
| `Matcher` | 输入驱动的 pattern 匹配器 |
| `generateFromEntries(compiled, source, fallback)` | 全量生成 |
| `buildFallbackMap(entries)` | fallback 首次获胜 |
| `dedupeCandidates(compiled, candidates)` | 候选去重 |
| `selectCandidate(compiled, key, candidates)` | namespace 过滤 + 顺序选择 |
| `candidateViews(compiled, candidates)` | 前端可读候选视图 |
| `testEntry(compiled, key, value, fallbackMap, issues?)` | 单条测试 + trace |

### 4.3 `.lang` 与统计

| API | 说明 |
| --- | --- |
| `parseLegacyLang(text)` | 按 C++ `LangFile` 语义解析；保留 `S:` 前缀、`¶`、值内 `=` |
| `writeLegacyLang(entries, lineEnding?)` | 写回 legacy `.lang` 文本 |
| `analyzeLangDocument(document)` | key/唯一 key/空值/重复/特殊字符/换行统计 |
| `diffLangMaps(expected, actual, sampleLimit?)` | 逐 key diff + 样本 |

### 4.4 parity

`compareToGolden(golden, generated, expectedUnknown, sampleLimit?)`：

- 主输出遍历 golden 的 key，缺失或值不同都算 `mismatch`；
- unknown 做双向集合比较，只比 key；
- 返回 counts + samples；**hash 不在 core**，由 runtime 的 `HashProvider` 计算（Node 用 `node:crypto`，浏览器用 Web Crypto）。

当前真实语料基线：

```
mismatch = 0
unknownMismatch = 0
unknown = 774
hash = db41064a4b4c34dd
roundTrip.ok = true
```

### 4.5 Hook

```ts
interface CoreHookEvents {
  'config:parsed': { issues: ConfigIssue[] };
  'compile:started': { generatorBlocks: number; sourceKeys?: number };
  'compile:finished': { stats: CompileStats; timings: TimingReport; cached: boolean };
  'entry:tested': { key: string; targetId?: string; unknown: boolean };
}
type CoreHooks = { [K in keyof CoreHookEvents]?: (payload: CoreHookEvents[K]) => void };
```

`emitHook(hooks, name, payload)` 同步、可选、吞异常；Hook 只观测，不改变运行结果。runtime 在其上扩展 job 事件。

### 4.6 计时

`Timer` / `createTimer(label)` 记录分阶段 `TimingReport`。核心引擎的 `compileConfig` 和 `generateFromEntries` 会写入 timings；跨运行比较由 `packages/node` 的 CLI perf 负责，不在 core 测试里做性能断言。

### 4.7 类型

`src/types/index.ts` 统一导出：

- `config.ts`：`ProjectConfigV2`、`TargetConfig`、`GeneratorConfig`、`RuleDefinition`
- `issues.ts`：`ConfigIssue`、`ProjectStats`、`LintReport`
- `lang.ts`：`LangEntry`、`LangDocument`、`LangFileStats`
- `parity.ts`：`ParityInput`、`ParityReport`、样本类型
- `timing.ts`：`PhaseTiming`、`TimingReport`
- `api.ts`：控制台/RPC 共用 DTO（`IoCheckReport`、`GenerateResult`、`EntryTestResult`、`MemorySnapshot` 等）

---

## 5. 测试、类型与格式

```bash
cd packages/core
npx vitest run        # 只验证正确性
npx tsc --noEmit
npx oxlint
npx oxfmt --check
npm run verify        # tsc + vitest
```

core 测试不跑真实文件系统、Worker、perf 或 git；`test/exports.test.ts` 会检查公共导出面，防止重新引入已移出的 Node-only 能力。

---

## 6. 性能参考

真实单 GT6 语料（Node 24）：

- `compileConfig`：约 20–30 ms；
- 完整 125,676 key 生成：约 1.5–2.3 s（取决于运行环境/Worker）；
- 峰值对象计数：patterns 993/2866，lexEntries 4,139，candidate buckets 109,271 / items 114,270；
- Node 进程内存量级约 200–270 MB heap、420–570 MB RSS。

浏览器/Node 的 Worker、编译缓存、任务取消和性能记录分别在 `packages/runtime`、`packages/node`、`packages/web` 中实现。
