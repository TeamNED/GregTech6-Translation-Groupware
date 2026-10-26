export type ConnectionStatus = 'connecting' | 'open' | 'closed';

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

interface RpcResponse {
  id: number;
  result?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

/**
 * 浏览器端 JSON-RPC over WebSocket。
 *
 * 服务端是 packages/node 的 dev server，只绑定 127.0.0.1；断线后自动重连，
 * 但不会自动重放请求，避免重复写文件。
 */
export class RpcClient {
  private socket: WebSocket | null = null;
  private pending = new Map<number, PendingCall>();
  private nextId = 1;
  private reconnectTimer: number | undefined;
  private disposed = false;

  constructor(
    private readonly url: string,
    private readonly onStatus: (status: ConnectionStatus) => void,
  ) {}

  connect(): void {
    if (this.disposed) return;
    this.onStatus('connecting');
    this.socket = new WebSocket(this.url);
    this.socket.addEventListener('open', () => this.onStatus('open'));
    this.socket.addEventListener('message', (event) => this.handleMessage(event.data));
    this.socket.addEventListener('close', () => {
      this.onStatus('closed');
      this.rejectAll(new Error('RPC 连接已断开'));
      this.scheduleReconnect();
    });
    this.socket.addEventListener('error', () => {
      this.socket?.close();
    });
  }

  close(): void {
    this.disposed = true;
    window.clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  async call<Result>(method: string, ...params: unknown[]): Promise<Result> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('RPC 尚未连接，请等待控制台连接成功');
    }
    const id = this.nextId++;
    return new Promise<Result>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
      this.socket!.send(JSON.stringify({ id, method, params }));
    });
  }

  private handleMessage(data: string): void {
    let response: RpcResponse;
    try {
      response = JSON.parse(data) as RpcResponse;
    } catch {
      return;
    }
    const pending = this.pending.get(response.id);
    if (!pending) return;
    this.pending.delete(response.id);
    if (response.error) pending.reject(new Error(response.error.message));
    else pending.resolve(response.result);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private scheduleReconnect(): void {
    if (this.disposed) return;
    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = window.setTimeout(() => this.connect(), 1500);
  }
}
