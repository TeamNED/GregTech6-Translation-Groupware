# GregTech6 翻译工程

这是 GregTech 6 中文翻译工具链的 Rush monorepo。原始 C++ 替换器和 `workplace` 语料作为 golden/parity 基线保留在 `packages/legacy`；新的算法、RPC 服务和本地自测控制台分别位于 `core`、`server`、`web`。

## 包结构

| 包 | 作用 | 关键入口 |
| --- | --- | --- |
| `packages/legacy` | 原 C++ 替换器、`config.yml`、英文源、fallback、golden 输出 | `packages/legacy/src`, `packages/legacy/workplace` |
| `packages/core` | 纯 TypeScript 算法、JSONC v2 配置、lint、legacy lang 读写、RPC 类型、设计文档 | `packages/core/src/index.ts`, `packages/core/project.jsonc` |
| `packages/server` | 本地 WebSocket RPC 服务：文件读写、配置保存、IO 检查、生成、单条测试 | `packages/server/src/index.ts` |
| `packages/web` | Vue 3 + Naive UI 本地自测控制台（仅 `vite dev`） | `packages/web/src/App.vue` |

`core` 不依赖 Vue/Naive UI/文件系统；`web` 只通过 WebSocket RPC 调用 `server`，不直接依赖算法实现。配置的唯一事实来源是 `packages/core/project.jsonc`；`packages/legacy/workplace/config.yml` 保持只读，仅用于追溯和一次性导入。

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
2. **目标配置**：当前只支持单 GT6 原版 target，编辑 workplace、源/fallback/输出/unknown 路径和换行符。
3. **输入 / 输出检查**：读取源/fallback/当前输出/unknown，跑一次 dry-run 生成，展示文件统计、unknown、冲突、hash 以及与当前输出的逐 key diff；可确认后写入。
4. **单条目测试**：输入 key 和英文值，查看分词、候选、最终选择，以及 LIT/LEX/REDUCE/EMIT 的完整 trace。

## 验证

```bash
# 真实语料 parity：必须 mismatch=0、unknownMismatch=0
cd packages/core
npx tsx scripts/check-parity.ts

# core 单测
npx vitest run

# 各包类型检查 / lint / 格式检查
cd packages/core && npx tsc --noEmit && npx oxlint && npx oxfmt --check
cd packages/server && npx tsc --noEmit && npx oxlint && npx oxfmt --check
cd packages/web && npx vue-tsc --noEmit && npx oxlint && npx oxfmt --check
```

`rush build` 会按依赖顺序执行：legacy 的 CMake 构建、core/server 的类型检查、web 的构建。C++ 构建失败时先检查 `VCPKG_ROOT` 和 `packages/legacy/README.md`。

## 设计文档

- [算法实现说明](packages/core/docs/algorithms.md)
- [性能评估](packages/core/docs/perf-evaluation.md)
- [迁移方案](packages/core/docs/migration-plan.md)
- [原 C++ 使用说明](packages/legacy/README.md)

## 数据与备份

- `packages/legacy/workplace/zh/GregTech.lang` 和 `GregTech.unknown.lang` 是生成物，已被 `.gitignore` 忽略。
- 保存 `project.jsonc`、目标配置或写入输出时，会在同目录保留 `*.bak-*` 备份。
- 控制台的 RPC 只绑定 `127.0.0.1`，不会暴露到局域网。
