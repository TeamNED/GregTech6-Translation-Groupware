import { parentPort } from 'node:worker_threads';
import {
  createRuntimeDispatcher,
  EngineHost,
  RuntimeError,
  type CoreEvent,
  type CoreRequest,
  type CoreResponse,
} from '@gt6tg/runtime';
import { nodeHashProvider } from '../hash';
import { nodeMemory } from '../memory';

if (!parentPort) {
  throw new Error('worker/main.ts 必须在 worker_threads 中运行');
}

const port = parentPort;
const host = new EngineHost({ hash: nodeHashProvider, memory: nodeMemory });
const dispatcher = createRuntimeDispatcher(host, (event: CoreEvent) => post(event));

port.on('message', (request: CoreRequest) => {
  void handleRequest(request);
});

async function handleRequest(request: CoreRequest): Promise<void> {
  try {
    const result = await dispatcher.handle(request.method, request.params);
    post({ id: request.id, result });
  } catch (error) {
    post({ id: request.id, error: toErrorPayload(error) });
  }
}

function post(message: CoreResponse | CoreEvent): void {
  try {
    port.postMessage(message);
  } catch {
    // 主线程已经关闭；worker 随后会被 terminate。
  }
}

function toErrorPayload(error: unknown) {
  return {
    code: error instanceof RuntimeError ? error.code : 'internal',
    message: error instanceof Error ? error.message : String(error),
    details: error instanceof RuntimeError ? error.details : undefined,
  };
}
