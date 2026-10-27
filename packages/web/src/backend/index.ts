import { BrowserBackend } from './browser';
import { DevBackend } from './dev';
import type { ConsoleBackend } from './types';

export * from './types';

const RPC_PATH = '/__gt6tg_rpc';

/**
 * node 托管构建（`vite build --mode node`）与 Vite dev 默认走 WebSocket；
 * 纯静态生产构建默认走浏览器 Worker。可用 `?mode=repl` / `?mode=dev` 强制切换。
 */
export function resolveRpcUrl(): string {
  if (import.meta.env.VITE_RPC_URL) return import.meta.env.VITE_RPC_URL;
  if (import.meta.env.MODE === 'node') {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${location.host}${RPC_PATH}`;
  }
  return `ws://127.0.0.1:5176${RPC_PATH}`;
}

export function createBackend(): ConsoleBackend {
  const queryMode = new URLSearchParams(location.search).get('mode');
  const defaultMode = import.meta.env.DEV || import.meta.env.MODE === 'node' ? 'dev' : 'repl';
  const mode = queryMode === 'repl' || queryMode === 'dev' ? queryMode : defaultMode;
  if (mode === 'repl') return new BrowserBackend();
  return new DevBackend(resolveRpcUrl());
}
