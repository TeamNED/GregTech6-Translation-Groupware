import { BrowserBackend } from './browser';
import { DevBackend } from './dev';
import type { ConsoleBackend } from './types';

export * from './types';

/**
 * 开发默认走 WebSocket + node；生产构建默认走浏览器 Worker。
 * 开发时可用 `?mode=repl` 强制测试浏览器 Worker 模式。
 */
export function createBackend(): ConsoleBackend {
  const queryMode = new URLSearchParams(location.search).get('mode');
  const mode = queryMode === 'repl' || queryMode === 'dev' ? queryMode : import.meta.env.DEV ? 'dev' : 'repl';
  if (mode === 'repl') return new BrowserBackend();
  return new DevBackend(import.meta.env.VITE_RPC_URL ?? 'ws://127.0.0.1:5175/__gt6tg_rpc');
}
