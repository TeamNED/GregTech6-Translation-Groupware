import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RpcNotification } from '@gt6tg/core';
import type { CoreEvent } from '@gt6tg/runtime';
import { WebSocketServer, type WebSocket } from 'ws';
import { NodeEngineClient } from './engine-client';
import { createHandlers } from './handlers';
import { createHttpServer } from './http';
import { webDistRoot } from './paths';
import { ProjectStore } from './projectStore';
import { attachRpc } from './rpc';

const port = Number(process.env.GT6TG_PORT ?? process.env.GT6TG_HTTP_PORT ?? '5176');
const host = '127.0.0.1';

const store = new ProjectStore();
await store.load();
const engine = new NodeEngineClient();
const handlers = createHandlers(store, engine);
const clients = new Set<WebSocket>();

engine.onEvent((event) => {
  const notification = toNotification(event);
  if (!notification) return;
  const text = JSON.stringify(notification);
  for (const client of clients) {
    if (client.readyState === 1) client.send(text);
  }
});

const httpServer = createHttpServer();
const server = new WebSocketServer({
  server: httpServer,
  path: '/__gt6tg_rpc',
  maxPayload: 32 * 1024 * 1024,
});

if (!existsSync(resolve(webDistRoot, 'index.html'))) {
  console.warn('[gt6tg] 未找到 packages/web/dist；页面请求会返回 503，请先运行 npm run dev。');
}

httpServer.listen(port, host, () => {
  console.log(`[gt6tg] 控制台已启动：http://${host}:${port}/`);
  console.log(`[gt6tg] WebSocket RPC：ws://${host}:${port}/__gt6tg_rpc`);
});
httpServer.on('error', (error) => {
  console.error('[gt6tg] HTTP 服务错误:', error);
  process.exitCode = 1;
});

server.on('connection', (socket) => {
  console.log('[gt6tg] 控制台已连接');
  clients.add(socket);
  socket.on('close', () => clients.delete(socket));
  attachRpc(socket, handlers);
});

server.on('error', (error) => {
  console.error('[gt6tg] WebSocket 服务错误:', error);
  process.exitCode = 1;
});

const shutdown = () => {
  engine.close();
  httpServer.close();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function toNotification(event: CoreEvent): RpcNotification | null {
  if (event.event === 'job.progress') {
    return {
      type: 'progress',
      task: 'job',
      message: `${event.payload.phase} ${event.payload.processed}/${event.payload.total}`,
      data: event.payload as unknown as Record<string, unknown>,
    };
  }
  if (event.event === 'job.done') {
    return {
      type: 'progress',
      task: 'job',
      message: 'done',
      data: { jobId: event.payload.jobId, summary: event.payload.summary },
    };
  }
  if (event.event === 'job.error') {
    return {
      type: 'progress',
      task: 'job',
      message: event.payload.message,
      data: { jobId: event.payload.jobId },
    };
  }
  if (event.event === 'engine.compiled') {
    return {
      type: 'progress',
      task: 'engine',
      message: 'compiled',
      data: { compileId: event.payload.compileId, stats: event.payload.stats },
    };
  }
  return null;
}
