import { DirectClient, type CoreMessage, type CoreRequest, type CoreTransport } from '@gt6tg/runtime';

/** 主线程侧：把浏览器 Worker 的 postMessage 包装成 CoreTransport。 */
class BrowserWorkerTransport implements CoreTransport {
  private readonly listeners = new Set<(message: CoreMessage) => void>();
  private closed = false;

  constructor(private readonly worker: Worker) {
    this.worker.addEventListener('message', (event: MessageEvent<CoreMessage>) => {
      for (const listener of this.listeners) listener(event.data);
    });
  }

  send(request: CoreRequest): void {
    if (this.closed) return;
    this.worker.postMessage(request);
  }

  onMessage(listener: (message: CoreMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.listeners.clear();
    this.worker.terminate();
  }
}

export interface BrowserEngine {
  client: DirectClient;
  terminate(): void;
}

export function createBrowserEngine(): BrowserEngine {
  const worker = new Worker(new URL('../worker/main.ts', import.meta.url), { type: 'module' });
  const client = new DirectClient(new BrowserWorkerTransport(worker));
  worker.addEventListener('error', () => client.close());
  worker.addEventListener('messageerror', () => client.close());
  return {
    client,
    terminate: () => client.close(),
  };
}
