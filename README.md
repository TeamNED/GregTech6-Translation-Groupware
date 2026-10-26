# GregTech6 翻译工程

这是 GregTech 6 中文翻译工具链的 Rush monorepo。原始 C++ 替换器和 `workplace` 语料作为 golden/parity 基线保留在 `packages/legacy`；新的算法、同构运行时、Node 服务和统一前端分别位于 `core`、`runtime`、`node`、`web`。

## 包结构

| 包 | 作用 | 关键入口 |
| --- | --- | --- |
| `packages/legacy` | 原 C++ 替换器、`config.yml`、英文源、fallback、golden 输出 | `packages/legacy/src`, `packages/legacy/workplace` |
| `packages/core` | 纯算法、JSONC v2 配置 schema/解析/lint、Hook、共用领域类型 | `packages/core/src/index.ts` |
| `packages/runtime` | EngineHost、任务调度、编译缓存、传输无关协议 | `packages/runtime/src/index.ts` |
| `packages/node` | Node 适配：CLI 门禁、dev WebSocket/HTTP、worker_threads、文件系统、配置与产物 | `packages/node/src/index.ts`, `packages/node/project.jsonc` |
| `packages/web` | Vue 3 + Naive UI 统一控制台；开发用 WebSocket，生产构建用浏览器 Worker | `packages/web/src/App.vue`, `packages/web/src/worker/main.ts` |

`core`/`runtime` 不依赖 Vue/Naive UI/Node 文件系统。Node 侧算法在 worker_threads、浏览器侧在 Dedicated Worker 中执行；web 主线程负责 UI 与轻量报告解析/diff，开发模式通过 `RpcClient` 调 node，生产模式通过 Worker 调 runtime。配置的唯一事实来源是 `packages/node/project.jsonc`。

迁移期有一条硬边界：**`packages/legacy` 只能由 legacy 自身（C++ 工具）修改**。`node`/`core`/`runtime` 不会写入 legacy，也不会生成 `.bak`；Node 的生成物统一写到 `packages/node/dist/<targetId>/`。`packages/legacy/workplace` 下的英文源、fallback、`zh/GregTech.lang` 和 `zh/GregTech.unknown.lang` 都按只读输入使用，后两者作为 parity 的 golden。

## 环境要求

- Node.js >= 24（`.node-version` 为 24.21.0）
- Rush 5.181 / pnpm 10.34（仓库内 `common/scripts/install-run-rush.js` 会自动安装）
- 构建 `packages/legacy` 的 C++ 需要 CMake、MSVC 和 vcpkg（`ryml`、`fmt`、`Boost`），并设置 `VCPKG_ROOT`

## 安装

```bash
node common/scripts/install-run-rush.js update
```

## 启动本地开发控制台

```bash
node scripts/dev.mjs
```

然后打开 <http://127.0.0.1:5173>。它会同时启动：

- `node`：`ws://127.0.0.1:5175/__gt6tg_rpc`（只绑定 localhost），以及 `http://127.0.0.1:5176/health` 文件通道
- `web`：Vite dev server

如果端口冲突，可通过环境变量调整 RPC/HTTP 端口，并让 web 使用同一个地址：

```bash
GT6TG_RPC_PORT=5185 GT6TG_HTTP_PORT=5186 VITE_RPC_URL=ws://127.0.0.1:5185/__gt6tg_rpc node scripts/dev.mjs
```

## 浏览器 REPL（生产构建）

纯静态构建，不需要 Node：

```bash
cd packages/web
npx vite build
# 将 dist/ 交给任意静态文件服务器
```

- 默认使用浏览器 Worker，算法不阻塞 UI；开发时可用 `?mode=repl` 强制测试 Worker 模式。
- 构建期内置 `packages/node/project.jsonc` 的只读副本；配置只存在内存，刷新即恢复默认，可导出 JSONC。
- 在“文件 / 历史”页上传源/fallback/golden/unknown，运行后下载目标/unknown；默认保留最近 3 次成功运行，可做 golden 对比和 run-to-run 对比。
- 停止任务 = 终止 Worker；下一次运行重新创建 Worker 并重新编译（约 16–35 ms）。

## 控制台功能

1. **配置**：直接编辑 `project.jsonc`，校验 JSONC/schema/lint，保存前自动备份；也可以从 `packages/legacy/workplace/config.yml` 重新导入。
2. **目标配置**：当前只支持单 GT6 原版 target，编辑 workplace、源/fallback 路径和换行符；output/unknown 是只读的 legacy golden。
3. **输入 / 输出检查**：读取源/fallback/legacy golden，跑一次 dry-run 生成，展示文件统计、unknown、冲突、hash、与 golden 的 parity 和逐 key diff；确认后只写入 `packages/node/dist/<targetId>/`。
4. **单条目测试**：输入 key 和英文值，查看分词、候选、最终选择，以及 LIT/LEX/REDUCE/EMIT 的完整 trace。

## 验证

```bash
# 只生成 node/dist，不触碰 legacy
(cd packages/node && npm run generate)

# 生成 dist -> 回读产物 -> 与 legacy golden 逐 key 对比
# 必须 mismatch=0、unknownMismatch=0、roundTrip.ok=true；否则退出码为 1
(cd packages/node && npm run parity)

# 配置 lint / 输出 hash
(cd packages/node && npm run lint:config)
(cd packages/node && npm run hash)

# 本地性能记录（每次运行写一个 JSON 到 packages/node/.perf/，不入库）
(cd packages/node && npm run perf -- --label=before)
(cd packages/node && npm run perf -- --label=after)
(cd packages/node && npm run perf:compare)

# 门禁：lint + parity + hash + perf
(cd packages/node && npm run gate -- --runs=1 --warmup=0)

# core / runtime 单测
(cd packages/core && npx vitest run)
(cd packages/runtime && npx vitest run)

# 各包类型检查 / lint / 格式检查
(cd packages/core && npx tsc --noEmit && npx oxlint && npx oxfmt --check)
(cd packages/runtime && npx tsc --noEmit && npx oxlint && npx oxfmt --check)
(cd packages/node && npx tsc --noEmit && npx oxlint && npx oxfmt --check)
(cd packages/web && npx vue-tsc --noEmit && npx oxlint && npx oxfmt --check)
```

`rush build` 会按依赖顺序执行：legacy 的 CMake 构建、core/runtime/node 的类型检查、web 的构建；它不运行 parity。

> 当前 `project.jsonc` / legacy `config.yml` 存在一个历史缺失组 `materialProductWoodType`：严格 `lint` 会以 error 退出；`gate` 把它作为已知基线跳过，其他 error 仍会失败。

## 设计文档

- [架构设计](docs/architect.md)
- [core 使用与 API](packages/core/README.md)
- [算法实现说明](packages/core/docs/algorithms.md)
- [性能评估](packages/core/docs/perf-evaluation.md)
- [迁移方案](packages/core/docs/migration-plan.md)
- [原 C++ 使用说明](packages/legacy/README.md)

## 数据与备份

- **写入边界**：`packages/legacy` 只读，只有 legacy 自身的 C++ 工具可以修改它；`node`/CLI 写入前会做路径守卫，拒绝任何 legacy 路径。
- `packages/node/dist/<targetId>/` 是 Node 的生成物目录（已被 `.gitignore` 忽略），可随时重建，**不产生 `.bak`**。
- 迁移阶段以 legacy 产出的 `zh/GregTech.lang` / `GregTech.unknown.lang` 为权威 golden，用 parity 保证 Node 的 dist 与之一致；后续阶段由规则和门禁约束，因此仓库不记录产物 hash。
- 性能记录写入 `packages/node/.perf/`，同样不入库；修改前后各跑一次，用 `npm run perf:compare` 对比。
- 保存 `project.jsonc` 或目标配置时仍会在同目录保留 `*.bak-*` 备份（这是编辑配置，不是生成产物）。
- 控制台的 RPC 只绑定 `127.0.0.1`，不会暴露到局域网。
