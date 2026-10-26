import { Worker } from 'node:worker_threads';
import type { EntryTestResult, LintReport } from '@gt6tg/core';
import {
  DirectClient,
  type CompileResult,
  type ConfigParseResult,
  type CoreEvent,
  type JobStartParams,
  type JobStartResult,
  type MetricsSnapshot,
  type TestEntryParams,
} from '@gt6tg/runtime';
import { WorkerThreadTransport } from './worker/transport';

export interface NodeEngineClientOptions {
  workerUrl?: string | URL;
}

/**
 * 主线程侧 runtime 客户端。
 *
 * 每个 CLI 进程/Node dev server 持有一个实例；算法在 worker_threads 中执行。
 * 停止任务 = terminate()，丢弃编译缓存和部分结果。
 */
export class NodeEngineClient {
  private worker: Worker | null = null;
  private client: DirectClient | null = null;
  private closed = false;
  private readonly workerUrl: string | URL;

  constructor(options: NodeEngineClientOptions = {}) {
    this.workerUrl = options.workerUrl ?? new URL('../.build/worker.cjs', import.meta.url);
  }

  compile(text: string): Promise<CompileResult> {
    return this.ensure().request('engine.compile', { text });
  }

  run(params: JobStartParams): Promise<JobStartResult> {
    return this.ensure().request('job.start', params);
  }

  testEntry(params: TestEntryParams): Promise<EntryTestResult> {
    return this.ensure().request('entry.test', params);
  }

  parseConfig(text: string): Promise<ConfigParseResult> {
    return this.ensure().request('config.parse', { text });
  }

  lintConfig(text: string): Promise<LintReport> {
    return this.ensure().request('config.lint', { text });
  }

  metrics(): Promise<MetricsSnapshot> {
    return this.ensure().request('metrics.snapshot', {});
  }

  onEvent(listener: (event: CoreEvent) => void): () => void {
    return this.ensure().onEvent(listener);
  }

  /** 终止当前 worker，但允许下一次请求自动创建新 worker。 */
  terminate(): void {
    const client = this.client;
    const worker = this.worker;
    this.client = null;
    this.worker = null;
    if (client) {
      client.close();
    } else if (worker) {
      void worker.terminate();
    }
  }

  close(): void {
    this.closed = true;
    this.terminate();
  }

  private ensure(): DirectClient {
    if (this.closed) {
      throw new Error('NodeEngineClient 已关闭');
    }
    if (this.client) return this.client;

    const worker = new Worker(this.workerUrl, { execArgv: [] });
    const client = new DirectClient(new WorkerThreadTransport(worker));
    const fail = () => {
      if (this.worker !== worker) return;
      this.client = null;
      this.worker = null;
      client.close();
    };
    worker.on('error', (error) => {
      if (this.worker !== worker) return;
      if (process.env.GT6TG_DEBUG) console.error('[engine] worker error', error);
      fail();
    });
    worker.on('exit', (code) => {
      if (this.worker !== worker) return;
      if (process.env.GT6TG_DEBUG && code !== 0) {
        console.error(`[engine] worker exited with code ${code}`);
      }
      fail();
    });
    this.worker = worker;
    this.client = client;
    return client;
  }
}
