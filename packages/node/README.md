# `@gt6tg/node`

Node 适配层：CLI 门禁、本地 dev server、worker_threads 算法宿主、文件系统与生成物。

## CLI 门禁

CLI 只读配置/source/golden/legacy；允许写 `packages/node/dist` 和 `packages/node/.perf`。

```bash
cd packages/node

npm run lint:config          # 配置 schema/lint；error 时退出码 1
npm run parity               # 生成 -> 回读 dist -> 与 legacy golden 对比
npm run hash                 # 输出 sha256 前 16 位
npm run generate             # 只生成 dist
npm run perf -- --label=before
npm run perf -- --label=after
npm run perf:compare
npm run gate -- --runs=1 --warmup=0   # lint + parity + hash + perf
```

基线：`mismatch=0`、`unknownMismatch=0`、`unknown=774`、`hash=db41064a4b4c34dd`、`roundTrip.ok=true`。
`project.jsonc`/legacy `config.yml` 中历史缺失组 `materialProductWoodType` 是 `gate` 的已知基线；严格 `lint` 仍会报 error。

## Dev server

```bash
npm run dev
# WS:   ws://127.0.0.1:5175/__gt6tg_rpc
# HTTP: http://127.0.0.1:5176/health
```

开发 web 由 `packages/web` 的 Vite dev server 提供；Node server 只提供 WS 控制与 HTTP 文件通道，不托管生产静态页面。

- 配置写入：**只有 dev server 写 `project.jsonc`**，使用临时文件 + rename 原子写和毫秒级 `.bak-*` 备份。
- 算法：`worker_threads` 中运行 `@gt6tg/runtime`；CLI 与 dev server 共用 `NodeEngineClient`。
- 停止任务：terminate worker；下一次请求重新创建并编译。
- HTTP `/api/files` 支持 raw body 上传、下载、删除；内存中最多保留 16 个文件。

## Worker bundle

`npm run build` / `npm run build:worker` 用 esbuild 生成 `.build/worker.cjs`（JSONC parser 保持 external）。`.build/` 与 `.perf/` 均被 gitignore。

## 目录

```
src/
  cli/            CLI main/commands/perf/lib
  worker/         worker_threads 入口与 transport
  index.ts         dev server 启动/组合根
  rpc.ts          WebSocket JSON-RPC framing/队列
  handlers.ts     RPC 方法表
  http.ts         HTTP 文件通道
  engine-client.ts  worker_threads 客户端
  projectStore.ts 配置状态、校验、保存/备份/legacy YAML 导入
  io.ts           checkIo/generate/testEntry（调用 worker，不跑算法）
  paths.ts        仓库路径/写入守卫/原子写
  hash.ts         node:crypto HashProvider + 同步 hash
  memory.ts       process.memoryUsage 快照
```
