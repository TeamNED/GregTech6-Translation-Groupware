# `@gt6tg/runtime`

同构运行时：Node 和浏览器 Worker 共用的应用层。

## 职责

- `EngineHost`：`compile`、`run`、`testEntry`、`metrics`；持有编译缓存。
- `CompileCache`：按配置文本生成 `compileId`，默认保留当前 + 上一个版本。
- `JobRunner`：单活动任务、scope（all/keys）、进度、摘要。
- `createRuntimeDispatcher`：环境无关的协议分发器（config/engine/job/entry/compare/metrics）。
- `CoreTransport` / `DirectClient`：Worker（浏览器/worker_threads）共用的请求/响应/事件协议；Node dev WS 仍使用旧的 `RpcClient`。
- `HashProvider` / `Clock` / `MemorySnapshot`：由宿主注入，runtime 不直接依赖 Node/DOM。

## 边界

- 不 import `node:*`、不碰 fs/DOM；浏览器 Worker 与 `worker_threads` 都能打包。
- 编译结果不跨线程序列化，只通过 `compileId` 引用。
- 终止任务 = 宿主 terminate Worker；runtime 不实现 pause/resume。
- 历史/产物由宿主决定是否保留；runtime 默认释放 `candidatesByValue`。

## 入口

```ts
import {
  EngineHost,
  createRuntimeDispatcher,
  DirectClient,
  type HashProvider,
} from '@gt6tg/runtime';
```

Node 的 `nodeHashProvider`/`nodeMemory` 在 `@gt6tg/node`；浏览器的 Web Crypto hash 与 `performance.memory` 在 `@gt6tg/web`。

## 测试

```bash
cd packages/runtime
npx vitest run
npx tsc --noEmit
```
