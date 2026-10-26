import type { Worker } from 'node:worker_threads';
import type { CoreMessage, CoreRequest, CoreTransport } from '@gt6tg/runtime';

/** 主线程侧：把 worker_threads 的 postMessage 包装成 CoreTransport。 */
export class WorkerThreadTransport implements CoreTransport {
  private readonly listeners = new Set<(message: CoreMessage) => void>();
  private closed = false;

  constructor(private readonly worker: Worker) {
    this.worker.on('message', (message: CoreMessage) => {
      for (const listener of this.listeners) listener(message);
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
    void this.worker.terminate();
  }
}
