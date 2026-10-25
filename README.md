# GregTech6 翻译工程

这是 GregTech 6 中文翻译工具链的 Rush monorepo。原始 C++ 替换器和 `workplace` 语料作为 golden/parity 基线保留在 `packages/legacy`；新的算法、RPC 服务和本地自测控制台分别位于 `core`、`server`、`web`。

## 包结构

| 包 | 作用 | 关键入口 |
| --- | --- | --- |
| `packages/legacy` | 原 C++ 替换器、`config.yml`、英文源、fallback、golden 输出 | `packages/legacy/src`, `packages/legacy/workplace` |
| `packages/core` | 纯 TypeScript 算法、JSONC v2 配置、lint、legacy lang 读写、RPC 类型、设计文档 | `packages/core/src/index.ts`, `packages/core/project.jsonc` |
| `packages/server` | 本地 WebSocket RPC 服务：文件读写、配置保存、IO 检查、生成、单条测试 | `packages/server/src/index.ts` |
| `packages/web` | Vue 3 + Naive UI 本地自测控制台（仅 `vite dev`） | `packages/web/src/App.vue` |

`core` 不依赖 Vue/Naive UI/文件系统；`web` 只通过 WebSocket RPC 调用 `server`，不直接依赖算法实现。配置的唯一事实来源是 `packages/core/project.jsonc`。

迁移期有一条硬边界：**`packages/legacy` 只能由 legacy 自身（C++ 工具）修改**。`server`/`core` 不会写入 legacy，也不会生成 `.bak`；core 的生成物统一写到 `packages/core/dist/<targetId>/`。`packages/legacy/workplace` 下的英文源、fallback、`zh/GregTech.lang` 和 `zh/GregTech.unknown.lang` 都按只读输入使用，后两者作为 parity 的 golden。

## 环境要求

- Node.js >= 24（`.node-version` 为 24.21.0）
- Rush 5.181 / pnpm 10.34（仓库内 `common/scripts/install-run-rush.js` 会自动安装）
- 构建 `packages/legacy` 的 C++ 需要 CMake、MSVC 和 vcpkg（`ryml`、`fmt`、`Boost`），并设置 `VCPKG_ROOT`

## 安装

```bash
node common/scripts/install-run-rush.js update
```

## 启动本地控制台

```bash
node scripts/dev.mjs
```

然后打开 <http://127.0.0.1:5173>。它会同时启动：

- `server`：`ws://127.0.0.1:5175/__gt6tg_rpc`（只绑定 localhost）
- `web`：Vite dev server

如果端口冲突，可通过环境变量调整 RPC 端口，并让 web 使用同一个地址：

```bash
GT6TG_RPC_PORT=5185 VITE_RPC_URL=ws://127.0.0.1:5185/__gt6tg_rpc node scripts/dev.mjs
```

## 控制台功能

1. **配置**：直接编辑 `project.jsonc`，校验 JSONC/schema/lint，保存前自动备份；也可以从 `packages/legacy/workplace/config.yml` 重新导入。
2. **目标配置**：当前只支持单 GT6 原版 target，编辑 workplace、源/fallback 路径和换行符；output/unknown 是只读的 legacy golden。
3. **输入 / 输出检查**：读取源/fallback/legacy golden，跑一次 dry-run 生成，展示文件统计、unknown、冲突、hash、与 golden 的 parity 和逐 key diff；确认后只写入 `packages/core/dist/<targetId>/`。
4. **单条目测试**：输入 key 和英文值，查看分词、候选、最终选择，以及 LIT/LEX/REDUCE/EMIT 的完整 trace。

## 验证

```bash
# 只生成 core/dist，不触碰 legacy
cd packages/core
npx tsx scripts/generate.ts

# 生成 dist -> 回读产物 -> 与 legacy golden 逐 key 对比
# 必须 mismatch=0、unknownMismatch=0、roundTrip.ok=true；否则退出码为 1
npx tsx scripts/check-parity.ts

# 本地性能记录（每次运行写一个 JSON 到 packages/core/.perf/，不入库）
npx tsx scripts/check-perf.ts --label=before
npx tsx scripts/check-perf.ts --label=after
npx tsx scripts/check-perf.ts --compare

# core 单测
npx vitest run

# 各包类型检查 / lint / 格式检查
cd packages/core && npx tsc --noEmit && npx oxlint && npx oxfmt --check
cd packages/server && npx tsc --noEmit && npx oxlint && npx oxfmt --check
cd packages/web && npx vue-tsc --noEmit && npx oxlint && npx oxfmt --check
```

`rush build` 会按依赖顺序执行：legacy 的 CMake 构建、core/server 的类型检查、web 的构建；它不运行 parity。

## 设计文档

- [core 使用与 API](packages/core/README.md)
- [算法实现说明](packages/core/docs/algorithms.md)
- [性能评估](packages/core/docs/perf-evaluation.md)
- [迁移方案](packages/core/docs/migration-plan.md)
- [原 C++ 使用说明](packages/legacy/README.md)

## 数据与备份

- **写入边界**：`packages/legacy` 只读，只有 legacy 自身的 C++ 工具可以修改它；`server`/脚本写入前会做路径守卫，拒绝任何 legacy 路径。
- `packages/core/dist/<targetId>/` 是 core 的生成物目录（已被 `.gitignore` 忽略），可随时重建，**不产生 `.bak`**。
- 迁移阶段以 legacy 产出的 `zh/GregTech.lang` / `GregTech.unknown.lang` 为权威 golden，用 parity 保证 core 的 dist 与之一致；后续阶段由规则和门禁约束，因此仓库不记录产物 hash。
- 性能记录写入 `packages/core/.perf/`，同样不入库；修改前后各跑一次，用 `check-perf.ts --compare` 对比。
- 保存 `project.jsonc` 或目标配置时仍会在同目录保留 `*.bak-*` 备份（这是编辑配置，不是生成产物）。
- 控制台的 RPC 只绑定 `127.0.0.1`，不会暴露到局域网。
