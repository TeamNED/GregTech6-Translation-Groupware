import {
  createRuntimeDispatcher,
  EngineHost,
  RuntimeError,
  type CoreEvent,
  type CoreRequest,
  type CoreResponse,
} from '@gt6tg/runtime';
import { webCryptoHash } from '../backend/hash';
import { browserMemory } from '../backend/memory';

interface WorkerScope {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent<CoreRequest>) => void) | null;
}

const scope = self as unknown as WorkerScope;
const host = new EngineHost({ hash: webCryptoHash, memory: browserMemory });
const dispatcher = createRuntimeDispatcher(host, (event: CoreEvent) => post(event));

scope.onmessage = (event) => {
  void handle(event.data);
};

async function handle(request: CoreRequest): Promise<void> {
  try {
    const result = await dispatcher.handle(request.method, request.params);
    post({ id: request.id, result });
  } catch (error) {
    post({ id: request.id, error: toErrorPayload(error) });
  }
}

function post(message: CoreResponse | CoreEvent): void {
  scope.postMessage(message);
}

function toErrorPayload(error: unknown) {
  return {
    code: error instanceof RuntimeError ? error.code : 'internal',
    message: error instanceof Error ? error.message : String(error),
    details: error instanceof RuntimeError ? error.details : undefined,
  };
}
