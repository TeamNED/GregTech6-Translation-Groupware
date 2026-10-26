import type { RpcNotification, ServerMethodName, ServerParams, ServerResult } from '@gt6tg/core';
import type { CompareResult } from '@gt6tg/runtime';
import { RpcClient, type ConnectionStatus } from '../rpc/client';
import { downloadText } from './download';
import type { BackendCapabilities, ConsoleBackend, FileRole, FileSlot, HistoryEntry, ProgressInfo } from './types';

/** 开发模式：沿用旧 WebSocket RPC；配置写入仓库由 node dev server 负责。 */
export class DevBackend implements ConsoleBackend {
  readonly mode = 'dev' as const;
  readonly capabilities: BackendCapabilities = {
    saveConfig: true,
    importLegacy: true,
    updateTarget: true,
    writeDist: true,
    upload: false,
    download: false,
    history: false,
  };

  private readonly client: RpcClient;
  private statusListener: ((status: ConnectionStatus) => void) | undefined;
  private readonly progressListeners = new Set<(progress: ProgressInfo) => void>();

  constructor(url: string) {
    this.client = new RpcClient(
      url,
      (status) => this.statusListener?.(status),
      (notification) => this.handleNotification(notification),
    );
  }

  connect(onStatus: (status: ConnectionStatus) => void): void {
    this.statusListener = onStatus;
    this.client.connect();
  }

  call<Method extends ServerMethodName>(
    method: Method,
    ...params: ServerParams<Method>
  ): Promise<ServerResult<Method>> {
    return this.client.call<ServerResult<Method>>(method, ...params);
  }

  setText(_role: FileRole, _text: string, _name?: string): void {
    // 开发模式直接读仓库文件，不走上传。
  }

  clearFile(_role: FileRole): void {
    // 开发模式直接读仓库文件，不走上传。
  }

  files(): Record<FileRole, FileSlot | undefined> {
    return { source: undefined, fallback: undefined, golden: undefined, goldenUnknown: undefined };
  }

  download(_kind: 'output' | 'unknown'): void {
    throw new Error('开发模式请使用 node/dist 中的产物');
  }

  async exportConfig(): Promise<void> {
    const project = await this.call('getProject');
    downloadText('project.jsonc', project.raw);
  }

  async resetConfig(): Promise<void> {
    await this.call('getProject');
  }

  history(): HistoryEntry[] {
    return [];
  }

  setHistoryLimit(_limit: number): void {
    // 开发模式的运行对比请使用 CLI。
  }

  async compareCurrent(_mode: 'golden' | 'run'): Promise<CompareResult> {
    throw new Error('开发模式的运行对比请使用 CLI');
  }

  cancel(): void {
    // WebSocket 模式下没有可终止的 Worker；请求由 node 侧队列处理。
  }

  onProgress(listener: (progress: ProgressInfo) => void): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private handleNotification(notification: RpcNotification): void {
    if (notification.type !== 'progress') return;
    const data = notification.data ?? {};
    const phase = typeof data.phase === 'string' ? data.phase : 'progress';
    const processed = typeof data.processed === 'number' ? data.processed : 0;
    const total = typeof data.total === 'number' ? data.total : 0;
    for (const listener of this.progressListeners) listener({ phase, processed, total });
  }
}
