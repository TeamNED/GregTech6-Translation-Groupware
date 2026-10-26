# `@gt6tg/web`

统一 Web 控制台：一套 Vue 面板，两种后端。

| 模式 | 后端 | 用途 |
| --- | --- | --- |
| `dev` | WebSocket → `@gt6tg/node` dev server | 本地开发；可读写仓库配置、读取仓库语料 |
| `repl` | 浏览器 Dedicated Worker | 生产静态 REPL；配置/文件仅在内存 |

选择：开发默认 `dev`，生产构建默认 `repl`；开发时可用 `?mode=repl` 强制 Worker。

```bash
cd packages/web
npx vite            # dev
npx vite build      # 生产静态 dist/
```

## REPL 能力

- 构建期内置 `packages/node/project.jsonc` 只读副本；配置只存在内存，可导出 JSONC。
- “文件 / 历史”页上传 source/fallback/golden/unknown；结果可下载；默认保留最近 3 次，最多 10 次。
- 支持 golden 对比与 run-to-run 对比；停止 = terminate Worker，下一次运行重新编译。
- 时间始终上报；内存使用 `performance.memory`（可用时），否则显示“不可用”。

## 结构

```
src/
  backend/    ConsoleBackend 抽象、DevBackend、BrowserBackend、Worker transport、Web Crypto hash、report
  worker/     浏览器 Worker 入口（runtime dispatcher）
  components/ 配置/目标/IO/单条测试/文件与历史
  composables/useConsole.ts
  default-config.ts
```

生产构建的 Worker chunk 不包含 `node:*`；`@gt6tg/core`/`@gt6tg/runtime` 在 Worker 内运行。
