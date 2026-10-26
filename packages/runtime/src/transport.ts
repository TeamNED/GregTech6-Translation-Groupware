import type {
  CoreClient,
  CoreErrorPayload,
  CoreEvent,
  CoreEventMap,
  CoreMessage,
  CoreMethodName,
  CoreParams,
  CoreRequest,
  CoreResult,
  CoreTransport,
} from './protocol';

export type DirectRequestHandler = (method: string, params: unknown) => Promise<unknown> | unknown;

/** 同进程直连传输，主要用于单测和未来的 CLI 进程内调用。 */
export class DirectTransport implements CoreTransport {
  private readonly listeners = new Set<(message: CoreMessage) => void>();
  private closed = false;

  constructor(private readonly handler: DirectRequestHandler) {}

  send(request: CoreRequest): void {
    if (this.closed) return;
    void Promise.resolve()
      .then(() => this.handler(request.method, request.params))
      .then((result) => this.emit({ id: request.id, result }))
      .catch((error: unknown) => this.emit({ id: request.id, error: toErrorPayload(error) }));
  }

  emitEvent<K extends keyof CoreEventMap>(event: K, payload: CoreEventMap[K]): void {
    this.emit({ type: 'event', event, payload } as CoreEvent);
  }

  onMessage(listener: (message: CoreMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  close(): void {
    this.closed = true;
    this.listeners.clear();
  }

  private emit(message: CoreMessage): void {
    for (const listener of this.listeners) listener(message);
  }
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

/** 把传输层的结构化错误保留到调用方，而不是只留 message。 */
export class CoreClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'CoreClientError';
  }
}

export class DirectClient implements CoreClient {
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly eventListeners = new Set<(event: CoreEvent) => void>();
  private readonly unsubscribe: () => void;
  private closed = false;

  constructor(private readonly transport: CoreTransport) {
    this.unsubscribe = transport.onMessage((message) => this.receive(message));
  }

  request<M extends CoreMethodName>(method: M, params: CoreParams<M>): Promise<CoreResult<M>> {
    if (this.closed) {
      return Promise.reject(new CoreClientError('client-closed', '传输已关闭'));
    }
    const id = this.nextId++;
    return new Promise<CoreResult<M>>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.transport.send({ id, method, params });
    });
  }

  onEvent(listener: (event: CoreEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  close(): void {
    this.closed = true;
    this.unsubscribe();
    this.transport.close?.();
    for (const pending of this.pending.values()) {
      pending.reject(new CoreClientError('client-closed', '传输已关闭'));
    }
    this.pending.clear();
    this.eventListeners.clear();
  }

  private receive(message: CoreMessage): void {
    if (!('id' in message)) {
      for (const listener of this.eventListeners) listener(message);
      return;
    }

    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) {
      pending.reject(new CoreClientError(message.error.code, message.error.message, message.error.details));
    } else {
      pending.resolve(message.result);
    }
  }
}

function toErrorPayload(error: unknown): CoreErrorPayload {
  const code =
    typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'internal';
  return {
    code,
    message: error instanceof Error ? error.message : String(error),
    details:
      typeof error === 'object' && error !== null && 'details' in error
        ? (error as { details?: unknown }).details
        : error instanceof Error
          ? error.stack
          : undefined,
  };
}
