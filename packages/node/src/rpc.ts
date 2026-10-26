import type { RpcRequest, RpcResponse } from '@gt6tg/core';
import type { WebSocket } from 'ws';
import type { ServerHandlers } from './handlers';

function send(ws: WebSocket, response: RpcResponse): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(response));
}

function sendError(ws: WebSocket, id: number, code: string, message: string, details?: unknown): void {
  send(ws, { id, error: { code, message, details } });
}

/**
 * 极简 JSON-RPC over WebSocket：
 * 请求 { id, method, params }，响应 { id, result } 或 { id, error }。
 * 同一连接上的请求串行执行，避免配置保存和生成同时写文件。
 */
export function attachRpc(ws: WebSocket, handlers: ServerHandlers): void {
  let queue: Promise<void> = Promise.resolve();

  ws.on('message', (data) => {
    queue = queue.then(async () => {
      let request: RpcRequest;
      try {
        const parsed = JSON.parse(data.toString()) as Partial<RpcRequest>;
        if (typeof parsed.id !== 'number' || typeof parsed.method !== 'string' || !Array.isArray(parsed.params)) {
          throw new Error('RPC 请求格式错误');
        }
        request = { id: parsed.id, method: parsed.method, params: parsed.params };
      } catch (error) {
        sendError(ws, 0, 'bad-request', error instanceof Error ? error.message : String(error));
        return;
      }

      const handler = (handlers as Record<string, unknown>)[request.method];
      if (typeof handler !== 'function') {
        sendError(ws, request.id, 'unknown-method', `未知方法：${request.method}`);
        return;
      }

      try {
        const result = await (handler as (...args: unknown[]) => Promise<unknown>)(...request.params);
        send(ws, { id: request.id, result: result ?? null });
      } catch (error) {
        sendError(
          ws,
          request.id,
          'internal',
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error.stack : undefined,
        );
      }
    });
  });

  ws.on('error', (error) => {
    console.error('[gt6tg] WebSocket 错误:', error);
  });
}
