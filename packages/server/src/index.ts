import { WebSocketServer } from 'ws';
import { createHandlers } from './handlers';
import { ProjectStore } from './projectStore';
import { attachRpc } from './rpc';

const port = Number(process.env.GT6TG_RPC_PORT ?? '5175');
const host = '127.0.0.1';

const store = new ProjectStore();
await store.load();
const handlers = createHandlers(store);

const server = new WebSocketServer({
  host,
  port,
  path: '/__gt6tg_rpc',
  maxPayload: 32 * 1024 * 1024,
});

server.on('listening', () => {
  console.log(`[gt6tg] WebSocket RPC 已启动：ws://${host}:${port}/__gt6tg_rpc`);
});

server.on('connection', (socket) => {
  console.log('[gt6tg] 控制台已连接');
  attachRpc(socket, handlers);
});

server.on('error', (error) => {
  console.error('[gt6tg] WebSocket 服务错误:', error);
  process.exitCode = 1;
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
