# GregTech6 翻译工具链架构设计

> 状态：已确认，作为 `core` / `runtime` / `node` / `web` 重构与后续实现的依据。
>
> 范围：Node 开发环境、浏览器生产环境、CLI 门禁、算法运行时、控制协议、配置与文件边界、对比与性能指标。
>
> 不在范围：C++ legacy 实现替换、发布/打包到公共 registry、多用户/远程部署。

---

## 1. 产品形态

### 1.1 Node 开发环境

Node 用来做两件事：

1. **CLI 门禁**：在仓库里读取配置、语料和 golden，运行算法与检查，输出结果与退出码。CLI 不写配置，只写可重建的 dist 与 perf 记录。
2. **本地 web 开发控制台**：Vite dev server 提供统一 web UI，Node dev server 提供 WebSocket 控制通道和 HTTP 文件通道。算法运行在 Node `worker_threads` 中，HTTP/WS 主线程不被 1.9 s 的生成阻塞。

Node server 只在开发环境存在。**不提供生产版 Node web 服务**。

### 1.2 浏览器生产环境

浏览器生产形态是一个**纯静态 web REPL**：

- 没有 Node 后端，静态文件即可运行。
- 算法运行在 Dedicated Web Worker 中，主线程只负责 UI。
- 只保证当前单 GT6 语料：源文件约 7.66 MB、golden 约 7.38 MB、配置约 136 KB。
- 状态仅存在内存：刷新即丢失，不做 IndexedDB/OPFS 持久化。
- 构建时内置一份只读默认 `project.jsonc`；用户可以在内存中编辑并导出 JSONC。
- 源/golden/unknown 文件通过 File API 上传；目标/unknown 通过 Blob 下载。
- 不支持 legacy `config.yml` 导入；浏览器只处理 JSONC。

### 1.3 能力矩阵

| 能力 | Node CLI | Node dev web | 浏览器生产 web |
| --- | --- | --- | --- |
| 运行全部条目 | 是 | 是 | 是 |
| 运行任意 key 列表 | 是 | 是 | 是 |
| 运行单 key | 是 | 是 | 是 |
| 任意开始/停止 | 是（进程内 worker） | 是（终止 worker） | 是（终止 worker） |
| 时间指标 | 是 | 是 | 是 |
| 空间指标 | Node 进程内存 | worker/进程内存 | 尽力而为 |
| 上传源语言文件 | 读取仓库/参数路径 | HTTP 上传 | File API |
| 下载目标语言文件 | 写 dist | HTTP 下载 | Blob 下载 |
| 查看/修改配置 | 只读 | 读写仓库配置 | 内存编辑 + 导出 |
| 对比 golden | 是 | 是 | 是（上传 golden） |
| 对比两次运行 | 文本/记录 | 是 | 是（最近 N 次） |
| 修改仓库默认配置 | 否 | 是（node dev server 独占写） | 否 |
| legacy config.yml 导入 | 否 | 是 | 否 |

---

## 2. 包布局与依赖

```
packages/
  legacy/   原始 C++ 替换器与 workplace 语料（不变）
  core/     纯算法 + 配置 schema/解析/lint + Hook + 共用领域类型
  runtime/  EngineHost、JobRunner、编译缓存、传输无关协议
  node/     Node 适配：CLI、dev server、worker_threads、文件系统、配置/产物/perf
  web/      Vue 面板式控制台 + Worker 入口 + Worker/WS 客户端
```

### 2.1 职责

| 包 | 职责 | 运行环境 |
| --- | --- | --- |
| `core` | 分词、编译、匹配、生成、单条 trace、parity 比较原语、配置 schema/JSONC 解析/lint、Hook 类型、领域类型 | Node / 浏览器 Worker（同构） |
| `runtime` | EngineHost、JobRunner、编译缓存、协议端点、客户端/传输接口、hash/clock 注入点 | Node / 浏览器 Worker（同构） |
| `node` | CLI 门禁、dev server（WS/HTTP）、worker_threads 宿主、fs、配置写、dist/perf | 仅 Node |
| `web` | 统一面板式 UI、浏览器 Worker 入口、Worker/WS 两种客户端、File API、历史对比 | 仅浏览器 |
| `legacy` | C++ oracle 与职场语料 | 不参与 TS 依赖 |

### 2.2 依赖方向

```
runtime → core
node    → core, runtime
web     → core (types + worker), runtime (worker)
legacy  → 无 TS 依赖
```

禁止：

- `core` / `runtime` import `node:*`、`fs`、`path`、`process`、`Buffer`、`yaml`、DOM API。
- `core` 依赖 `runtime` / `node` / `web`。
- `web` 依赖 `node` 的运行时代码；仅允许构建期读取 `packages/node/project.jsonc` 作为数据。
- `node` 依赖 `web` 的运行时代码；dev 启动由根脚本编排。

### 2.3 包迁移

- `packages/server` 重命名为 `packages/node`，包名 `@gt6tg/node`。
- CLI 并入 `packages/node`，不新增 `packages/cli`。
- 删除 `packages/core/scripts`；删除 core 的 `generate/parity/perf/perf:compare` npm scripts。
- 新增 `packages/runtime`，加入 `rush.json`。
- `package.json` 仍采用 source-only（`main`/`types` 指向 `src/index.ts`）；只有 `node` 的 CLI/worker 有额外的 JS 分发构建。

---

## 3. 双端运行模型

### 3.1 Node 开发

```
Vite web UI
  ├── WebSocket /__gt6tg_rpc  → node dev server → worker_threads → runtime → core
  └── HTTP /api/files/*       → node dev server → fs / 上传缓冲
node dev server
  ├── 读 packages/node/project.jsonc
  ├── 写 packages/node/project.jsonc（唯一写入者）
  └── 桥接 WS 与 worker 协议

CLI
  └── worker_threads → runtime → core → 读 packages/node 配置与 packages/legacy 语料，写 dist/.perf
```

关键点：

- Node dev server 的主线程只做 HTTP/WS/文件与生命周期，不跑算法。
- Node CLI 也通过 `worker_threads` 跑算法，保持与 dev server 相同的 runtime 路径。
- 停止任务 = `worker.terminate()`；下一次任务重新创建 worker 并重新编译（约 16–35 ms）。

### 3.2 浏览器生产

```
Vue UI（主线程）
  ↕ CoreClient 协议（postMessage / MessageChannel / transferable）
Dedicated Web Worker
  ├── runtime EngineHost（编译缓存、JobRunner）
  ├── core（算法/配置）
  └── VirtualWorkspace（source/fallback/golden/unknown 内存文件）
```

关键点：

- 主线程不加载算法、不解析 7 MB 语料。
- Worker 内保存编译结果；主线程只拿 `compileId`、摘要、进度和可下载 Blob。
- 终止 Worker = 立即取消；部分结果和编译缓存丢弃。
- 历史结果保存在主线程（序列化文本 + 摘要），不依赖 Worker 存活。

### 3.3 模式选择

`web` 同一套 UI，通过 `CoreClient` 选择传输：

- **开发**：`VITE_CORE_MODE=ws`，连接 Node dev server；支持保存仓库配置、HTTP 文件上传/下载。
- **生产**：默认 `worker`，纯静态；配置只读默认值/内存编辑/JSONC 导出；File API。

UI 必须显式显示当前模式及能力差异（例如“保存到仓库”只在 dev 可用）。

---

## 4. 控制协议

### 4.1 设计原则

- 传输无关：协议不依赖 HTTP/WS/Worker 任一实现。
- 请求/响应 + 通知：请求有 `id`，通知无 `id`。
- 大对象不跨边界：编译结果留在宿主；只传 `compileId`、摘要、样本、Blob。
- 取消是宿主行为：终止 Worker，不进入 runtime 的优雅取消状态机。

### 4.2 消息形态

```ts
type CoreRequest =
  | { id: number; method: 'config.parse'; params: { text: string } }
  | { id: number; method: 'config.lint'; params: { text: string } }
  | { id: number; method: 'engine.compile'; params: { text: string } }
  | { id: number; method: 'job.start'; params: { compileId: string; scope: 'all' | 'keys'; keys?: string[] } }
  | { id: number; method: 'job.status'; params: { jobId: string } }
  | { id: number; method: 'job.export'; params: { jobId: string; kind: 'output' | 'unknown' } }
  | { id: number; method: 'entry.test'; params: { compileId: string; key: string; value?: string } }
  | { id: number; method: 'result.compare'; params: { left: string; right: string; mode: 'golden' | 'run' } }
  | { id: number; method: 'metrics.snapshot'; params: {} };

type CoreResponse =
  | { id: number; result: unknown }
  | { id: number; error: { code: string; message: string; details?: unknown } };

type CoreEvent =
  | { type: 'event'; event: 'job.progress'; payload: { jobId: string; processed: number; total: number; phase: string } }
  | { type: 'event'; event: 'job.done'; payload: { jobId: string; summary: RunSummary } }
  | { type: 'event'; event: 'job.error'; payload: { jobId: string; message: string } }
  | { type: 'event'; event: 'engine.compiled'; payload: { compileId: string; stats: CompileStats } };
```

### 4.3 传输实现

| 传输 | 场景 | 机制 |
| --- | --- | --- |
| `DirectTransport` | runtime 单测、纯函数调用 | 直接调用 handler |
| `WorkerTransport` | 浏览器生产 / Node worker_threads | `postMessage` / `MessagePort` |
| `WebSocketTransport` | Node dev web | WS 请求/响应 + 通知 |
| HTTP | Node dev web 大文件 | multipart 上传、流式下载 |

### 4.4 大文件

- 浏览器 Worker：`File` → `ArrayBuffer`，通过 transferable 传给 Worker；导出由 Worker 生成 `Blob`/`ArrayBuffer`，主线程下载。
- Node dev web：HTTP multipart 上传、HTTP 流式下载；WS 只做控制/进度。
- 不使用 JSON/base64 传 7 MB 语料。

### 4.5 单活动任务

- 每个 runtime 同时只允许一个活动 job。
- 已有任务时再次 start：UI 确认后自动终止旧 Worker，再启动新任务。
- 旧任务的部分结果不保留。
- 任务范围：`all`、`keys[]`、单 key（`keys.length === 1` 或走 `entry.test`）。
- 单条测试走 `entry.test` 以获取完整 trace；批量/单 key 运行走 `job.start`。

---

## 5. Runtime / EngineHost

### 5.1 EngineHost

`runtime` 的核心对象，职责：

- `compile(configText)`：调用 `core.compileConfig`，缓存 `CompiledProject`。
- `startJob({ compileId, scope, keys? })`：创建 JobRunner，按 scope 运行。
- `testEntry({ compileId, key, value? })`：调用 `core.testEntry`。
- `compare({ left, right, mode })`：解析文本并做 key 级 diff。
- `metrics()`：返回当前 job/编译/内存快照。
- 不包含 fs/DOM/Node API；输入输出通过注入的 provider/transport。

### 5.2 编译缓存

```
compileId = fastHash(configText + schemaVersion)
cache: Map<compileId, { compiled, stats, lastUsed }>
容量：默认 2 个版本（当前 + 上一个），LRU 淘汰
```

- `compileId` 使用快速非加密 hash（如 FNV-1a），只用于缓存键；输出 hash 仍用 sha256 前 16 位。
- 编译结果含 Map/Set/闭包/大数组，**不序列化、不跨线程**。
- 配置不变 → 重复 start 直接复用 `compileId`，不重编译。
- 配置改变 → 新 `compileId`；旧 job 若已结束则淘汰，若仍在运行则保留到结束（单活动任务下通常不需要）。
- Worker 终止/刷新 → 缓存丢失；下次 compile 约 16–35 ms，可接受。
- 本轮浏览器不把任何状态持久化到 IndexedDB/OPFS；如果未来需要持久化，应保存配置文本和源文件，而不是编译结果。

### 5.3 JobRunner

- 输入：`CompiledProject` + 源文档 + fallback + scope。
- 按 2k–5k 条分块处理，每块后让出事件循环，检查是否被宿主终止/是否发送进度。
- 输出：
  - `RunSummary`：source/output/unknown 数、sameAsEnglish、conflictKeys、matchedKeys、候选桶/条目数、timings、hash。
  - 完整 output/unknown 文本暂存在 runtime；`job.export` 按需返回/生成 Blob。
- 默认不保留 `candidatesByValue`；仅在调试 `includeCandidates` 时保留。当前真实语料候选桶 109,271、条目 114,270，保留会显著增加浏览器内存。
- 停止 = 宿主 terminate Worker；runtime 不需要实现 pause/resume/cancel 状态机。

### 5.4 单 key / trace

- `entry.test` 直接调用 `core.testEntry`，返回 tokens、候选、最终选择、fallback、unknown、LIT/LEX/REDUCE/EMIT 的 trace。
- `job.start` 的 `keys` 模式用于批量只跑一部分 key；结果结构与全量一致，但 total/processed 按子集计算。

---

## 6. Worker 与 Node 宿主

### 6.1 浏览器 Worker

- Vite 构建 `new Worker(new URL('./worker/index.ts', import.meta.url), { type: 'module' })`。
- Worker 入口创建 `WorkerTransport`，调用 `serveRuntime(transport, { hash: webCryptoHash, clock: performance })`。
- 主线程 `WorkerTransport` 与 UI 的 `CoreClient` 对接。
- Worker 生命周期跨多次运行；停止/重跑才 terminate。

### 6.2 Node worker_threads

- Node dev server 和 CLI 都通过 `worker_threads` 运行算法。
- worker 入口用 esbuild 打包成 JS（`bin/core-worker.mjs` 或 `dist/worker.mjs`），避免 Node 直接加载 TS worker。
- 主线程通过 `WorkerTransport`（基于 `parentPort`/`MessagePort`）发送请求、接收事件。
- dev server 的 HTTP/WS 主线程只做桥接和文件处理。
- CLI 主线程负责 argv、文件读写、门禁判定；算法在 worker 中执行。

### 6.3 终止语义

- 停止任务 = `worker.terminate()`：
  - 立即停止 CPU 工作。
  - 丢弃部分结果。
  - 丢弃编译缓存。
  - 下一次运行重新创建 worker、重新编译（16–35 ms）。
- 不实现 pause/resume；不依赖 SharedArrayBuffer/COOP/COEP。
- 若未来需要优雅取消，可增加 `job.cancel` 协议，而不改变现有传输。

### 6.4 Node CLI 分发

- `packages/node` 用 esbuild（或等价 bundler）输出：
  - `bin/gt6tg.mjs`：CLI 入口，`package.json` 的 `bin` 指向它。
  - `bin/core-worker.mjs`：worker_threads 入口。
- 开发时可以直接 `tsx src/cli/main.ts`，但 worker 仍用打包产物，避免 TS loader 不确定性。
- `rush build` 包含类型检查与 bundle；`bin`/产物目录加入 `.gitignore`（如需分发再发布）。

---

## 7. 文件与配置

### 7.1 Node 侧路径

全部归 `packages/node`：

```
packages/node/
  project.jsonc                 # 默认配置（唯一事实来源）
  dist/<targetId>/              # 生成物（可重建，不生成 .bak）
  .perf/                        # 性能记录（不入库）
```

- legacy 语料仍读 `packages/legacy/workplace`，只读。
- `dist` 路径由 runtime 的 `distPathsForTarget(target, root)` 推导，`root` 由 node 传入。
- CLI 只读配置/source/golden/legacy；允许写 `packages/node/dist` 和 `packages/node/.perf`。
- Node dev server 是 `project.jsonc` 唯一写入者；CLI 不写配置。

### 7.2 配置写入

- Node dev server 保存配置：
  - 校验 JSONC/schema/lint；有 error 不写。
  - 临时文件 + `rename` 原子替换。
  - 写前保留 `${path}.bak-<timestamp>` 备份（毫秒级，避免同秒覆盖）。
  - 写成功后通知 runtime 使用新配置；旧 job 若在运行则先终止（单活动任务）。
- 浏览器只导出 JSONC，不写仓库。

### 7.3 浏览器 VirtualWorkspace

浏览器没有真实路径，使用角色映射：

```
VirtualWorkspace {
  configText: string
  source?: TextFile
  fallback?: TextFile
  golden?: TextFile
  goldenUnknown?: TextFile
}
```

- 默认配置来自构建期读取 `packages/node/project.jsonc`（Vite `?raw`）。
- UI 展示 target 配置中的期望文件名，用户按角色上传 source/fallback/golden/unknown。
- 缺失 source → 不能运行；缺失 fallback → 仅依赖生成器；缺失 golden → parity 提示按现有口径处理。
- 输出/unknown 在 Worker 内生成，导出时转 Blob 下载。

### 7.4 YAML / JSONC

- core：JSONC 解析、schema、lint；不包含 `yaml`。
- node：legacy `config.yml` 导入；使用 `yaml` 依赖。
- 浏览器：只支持 JSONC 导入/导出，不打包 `yaml`。

---

## 8. 对比与历史

### 8.1 对比类型

- **golden 对比**：当前生成结果 vs 上传/仓库中的 legacy golden + unknown。
  - 主输出逐 key：缺 key 或值不同 = mismatch。
  - unknown 双向集合比较。
  - writer roundtrip：内存结果 vs 回读产物。
- **run-to-run 对比**：本次运行 vs 历史运行。
  - key 级 diff：same/changed/added/removed + 样本。
  - 可选导出 diff 文件。

### 8.2 历史结果

- 浏览器主线程保留最近 **3** 次成功运行（可配置，上限 10）。
- 每条历史只存：
  - 序列化 output/unknown 文本
  - `RunSummary`（计数、hash、timings）
  - 时间戳 / 配置 compileId
- 不存 125k 对象图；7.4 MB 文本 × 3 约 22 MB，可接受。
- 对比时把两段文本送进 Worker 解析比较，避免主线程阻塞。
- 停止/终止 Worker 不影响主线程历史；重新运行可继续对比。

---

## 9. 时间与空间指标

### 9.1 基线（当前真实语料，Node 24）

| 指标 | 值 |
| --- | --- |
| 源文件 | 7,657,684 B |
| fallback | 353,807 B |
| golden | 7,375,784 B |
| unknown golden | 171,669 B |
| 配置 | 135,827 B |
| compile | 约 16–35 ms（本次基线 34 ms） |
| generate | 约 1.9 s |
| source/output keys | 125,676 |
| unknown | 774 |
| sameAsEnglish | 1,986 |
| conflictKeys | 724 |
| matchedKeys | 118,457 |
| patterns top/all | 993 / 2,866 |
| lexEntries | 4,139 |
| candidate buckets/items | 109,271 / 114,270 |
| 记录时 heap / RSS（本次基线） | 约 205 MB / 419 MB（历史观测约 268 MB / 569 MB） |

### 9.2 上报策略

- 时间：始终上报。runtime 用注入的 `Clock`（Node/浏览器都是 `performance.now`）。
- 空间：
  - Node：`process.memoryUsage()`（进程级；worker_threads 内也标为进程级）。
  - 浏览器：`performance.memory` 或 `measureUserAgentSpecificMemory()`（支持时）；否则显示“不可用”。
  - 始终上报对象计数（pattern、lexEntries、keys、候选桶/条目），作为跨平台可比的近似空间指标。
- 浏览器只保证单 GT6 语料；4× addon / 400 万对语料只在 Node 端跑。

---

## 10. CLI 门禁

### 10.1 命令

```
gt6tg lint
gt6tg parity
gt6tg hash
gt6tg perf
gt6tg gate        # lint + parity + hash + perf
```

### 10.2 检查项

- `lint`：配置 JSONC/schema/lint；有 error 退出码 1。
- `parity`：读取配置/source/fallback/golden/unknown；编译、生成、写 dist、回读、逐 key 对比、unknown 双向、roundtrip；失败退出码 1。
- `hash`：输出 sha256 前 16 位；默认校验两次运行 hash 一致（确定性），可选 `--expect-hash`。
- `perf`：测量 compile/generate/total、阶段、计数、内存；写 `packages/node/.perf/*.json`；默认报告，`--strict` 超阈值失败（默认 warn 15% / fail 30%）。
- `gate`：按顺序跑全部检查；任一失败即失败。

### 10.3 输出与写盘

- stdout：JSON（`--json`）或人类可读摘要。
- stderr：进度/诊断。
- 退出码：0 成功，1 检查失败，2 参数/内部错误。
- 只读输入：`project.jsonc`、source、golden、legacy。
- 可写：`packages/node/dist`、`packages/node/.perf`。
- CLI 不写配置；配置修改只能通过 Node dev server。

### 10.4 分发

- esbuild 打包 CLI + worker。
- `package.json` 的 `bin.gt6tg` 指向 `bin/gt6tg.mjs`。
- `bin/core-worker.mjs` 与 CLI 同目录，通过 `import.meta.url` 定位。
- 不发布到 npm；仅本地/CI 使用。

---

## 11. Web 前端

### 11.1 统一 UI

沿用面板式控制台：

- 配置：查看/编辑 JSONC、lint 结果、导入/导出。
- 目标/文件：source/fallback/golden/unknown 角色与上传/下载。
- IO 检查：统计、parity、diff、notes。
- 运行：全量/keys/单 key，开始/停止，进度，时间/空间指标。
- 单条测试：tokens、候选、选择、trace。
- 历史/对比：最近 N 次运行、golden 对比、run-to-run diff。

### 11.2 传输选择

- 开发：`WebSocketTransport` + `fetch`/HTTP 文件。
- 生产：`WorkerTransport` + File API。
- `CoreClient` 对上暴露统一方法；组件不直接依赖 WebSocket/Worker。

### 11.3 生产构建

- `vite build` 输出静态文件；`base: './'` 以支持任意静态托管。
- Worker 作为独立 chunk 打包。
- 默认配置在构建期从 `packages/node/project.jsonc` 读取（`?raw`/alias），作为数据依赖，不引入 node 运行时。
- 构建门禁：若 Worker bundle 出现 `node:*`/`fs`，构建失败。

---

## 12. 目标目录

```
packages/core/src/
  index.ts
  types/{index,config,issues,lang,timing,parity,domain}.ts
  config/{index,schema,jsonc,lint}.ts
  hooks/{index,types,emitter}.ts
  engine/{index,tokenizer,model,lexicon,compile,matcher,apply,entryTest,legacyLang,stats,parity,timing}.ts

packages/runtime/src/
  index.ts
  host.ts                 # EngineHost
  job.ts                  # JobRunner
  compile-cache.ts
  protocol.ts             # 请求/响应/事件/CoreClient/CoreTransport
  transport.ts            # DirectTransport
  hash.ts                 # HashProvider 接口
  clock.ts                # Clock 接口
  run-summary.ts
  paths.ts                 # distPathsForTarget 等纯路径推导
  index.ts

packages/node/src/
  index.ts
  cli/{index,main,args,output}.ts
  cli/commands/{index,lint,parity,hash,perf,gate}.ts
  server/{index,http,ws,handlers,notifications}.ts
  worker/{index,main}.ts  # worker_threads 入口
  fs/{paths,workspace,artifacts,config-write}.ts
  config/{defaults,legacyYaml}.ts
  gate/{parity,hash,perf}.ts
  perf/{measure,record,compare,report}.ts

packages/web/src/
  main.ts
  App.vue
  client/{index,core-client,worker-transport,ws-transport,http-files}.ts
  worker/{index,main}.ts
  workspace/{virtual-workspace,file-roles}.ts
  composables/useConsole.ts
  components/*.vue
```

导出规范：

- 每个目录 `index.ts` 使用 `export * from './xxx.ts'`。
- 根 `index.ts` 全量导出该包 public 模块。
- 每个模块自己决定 public export；内部辅助不导出。
- 一个符号只在一个模块定义/导出，避免星号导出冲突。
- `core`/`runtime` 的 index 不得导出 Node-only 模块；`node` 的 index 可以导出 Node-only API。

---

## 13. 迁移阶段

严格按以下顺序执行；每阶段结束后由独立子代理验收，通过后才提交。

### 阶段 1：基线

- 记录 core 测试、`tsc`、parity、perf 的基线结果。
- 基线口径：`mismatch=0`、`unknownMismatch=0`、`unknown=774`、`hash=db41064a4b4c34dd`、`roundTrip.ok=true`。

### 阶段 2：抽 runtime

- 新增 `packages/runtime`：EngineHost、JobRunner、编译缓存、协议、传输接口。
- core 去掉 `node:crypto`：引入 `HashProvider`；Node 实现用 `node:crypto`，浏览器实现用 Web Crypto；输出仍为 sha256 前 16 位。
- runtime 只用 core，不碰 fs/DOM/process；加入 Rush、package.json、tsconfig、单测。

### 阶段 3：纯化 core

- 移出 YAML 导入、fs 相关逻辑、默认配置/产物路径。
- `legacyYaml` 迁至 node（阶段 4 前暂放 server）。
- `distPathsForTarget` 迁至 runtime。
- core 只保留算法、config schema/解析/lint、Hook、共用领域类型。
- 加 Hook 模块并接入 runtime。
- 导出改为 `export *` barrel；清理重复再导出与死导出。

### 阶段 4：server → node

- `packages/server` 重命名为 `packages/node`，包名 `@gt6tg/node`。
- CLI 并入 node；删除 `packages/core/scripts`。
- 迁移 `project.jsonc`、`dist`、`.perf` 到 `packages/node`。
- CLI 改为只读门禁；dev server 只保留 WS/HTTP API。
- 更新 `rush.json`、`scripts/dev.mjs`、`.gitignore`、README。

### 阶段 5：worker_threads + esbuild

- Node CLI / dev server 共用 runtime。
- 删除 server 内重复的 `io.ts`/`projectStore.ts`/`paths.ts`。
- worker_threads 入口用 esbuild 打包；CLI 与 server 都通过 worker 运行算法。
- 实现配置保存（server 独占、原子写+备份）、语料/产物读写、job 生命周期、门禁、HTTP 文件、WS 控制。
- 验证 TS worker 加载与终止/重编译。

### 阶段 6：浏览器化

- web Worker 入口、WorkerTransport、VirtualWorkspace、内置默认配置、File API。
- 统一面板控制台：生产 Worker；开发 WS + Node dev server。
- 实现历史（默认 3、上限 10）、golden 对比、run-to-run 对比、时间/空间指标、单活动任务、终止即丢弃。
- `vite build` 必须通过，且 Worker bundle 无 Node 依赖。

### 阶段 7：清理

- 删除 `core/scripts`、旧 server 路径、旧文档命令。
- 更新 `rush.json`、lockfile、README、docs、`.gitignore`。
- 清理无用依赖、导出、临时兼容层；确认包边界。

### 阶段 8：验收

- `rush build`、core/runtime tests、CLI `gate`、parity 基线、`vite build`、dev 控制台冒烟。
- 独立子代理逐项对照本文档验收；失败修复后重新验收。

---

## 14. 风险与取舍

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| Node worker_threads 直接加载 TS | worker 无法启动 | esbuild 打包 worker；开发时先构建 |
| 浏览器内存约 268 MB heap | 移动端/低内存标签页可能崩溃 | 只保证单 GT6；默认释放候选；历史只存文本；单活动任务 |
| Web Crypto 异步 | hash 接口全链路 async | runtime 注入 `HashProvider`，Node/浏览器同一签名 |
| 终止即取消 | 部分结果/编译缓存丢失 | 下次重新编译 16–35 ms；历史由主线程保留 |
| dev 与生产能力不同 | 用户误以为生产能写仓库 | UI 显式显示模式与能力 |
| 配置/产物从 core 迁到 node | 文档/脚本路径大量更新 | 阶段 4 集中迁移并 grep 校验 |
| web 构建期读取 node 配置 | 构建路径耦合 | 作为数据依赖处理；Vite alias/`?raw`；不引入 node 运行时 |
| 无 CI | 门禁依赖人工 | CLI `gate` 作为统一入口，后续可接 CI |
| 浏览器空间指标不精确 | 无法跨平台比较内存 | 时间必报；内存尽力；始终报对象计数 |

---

## 15. 验收标准

1. `rush build` 全绿；core/runtime/node/web 类型检查通过。
2. core/runtime tests 全绿，测试只验证正确性。
3. CLI `gate` 通过：
   - `mismatch=0`
   - `unknownMismatch=0`
   - `unknown=774`
   - `hash=db41064a4b4c34dd`
   - `roundTrip.ok=true`
4. CLI `lint/parity/hash/perf` 均可独立运行，退出码语义正确。
5. Node dev server：配置读写、IO 检查、生成、单条测试、停止任务均可用；配置保存为原子写 + 备份。
6. 浏览器生产构建：
   - `vite build` 成功；
   - 无 Node 运行时依赖；
   - Worker 模式可加载默认配置、上传文件、运行、停止、下载、对比、保留最近 3 次历史。
7. 包边界：
   - `core`/`runtime` 无 `node:*`/fs/DOM；
   - `node` 仅 Node；
   - `web` 仅浏览器；
   - 无 `core → runtime/node/web`、`runtime → node/web`、`web → node` 的运行时依赖。
8. 文档中的路径、命令、包名与实际仓库一致；旧 `packages/core/scripts` 与 `packages/server` 不再存在。
