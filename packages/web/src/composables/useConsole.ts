import type { ServerMethodName, ServerParams, ServerResult } from '@gt6tg/core';
import type { CompareResult } from '@gt6tg/runtime';
import { reactive } from 'vue';
import { createBackend, type BackendCapabilities, type FileRole, type FileSlot, type HistoryEntry } from '../backend';
import type { ConnectionStatus } from '../rpc/client';

interface ConsoleState {
  project: import('@gt6tg/core').ProjectSnapshot | null;
  status: ConnectionStatus;
  busy: number;
  error: string;
  progress: string;
  dataVersion: number;
  cancelVersion: number;
  mode: 'dev' | 'repl';
  capabilities: BackendCapabilities;
}

const backend = createBackend();

const state = reactive<ConsoleState>({
  project: null,
  status: 'closed',
  busy: 0,
  error: '',
  progress: '',
  dataVersion: 0,
  cancelVersion: 0,
  mode: backend.mode,
  capabilities: backend.capabilities,
});

const rpcUrl =
  backend.mode === 'repl'
    ? '浏览器 REPL · Worker（内存）'
    : (import.meta.env.VITE_RPC_URL ?? 'ws://127.0.0.1:5175/__gt6tg_rpc');
let connecting = false;
let cancelling = false;

async function refreshProject(): Promise<void> {
  const project = await call('getProject');
  state.project = project;
}

async function call<Method extends ServerMethodName>(
  method: Method,
  ...params: ServerParams<Method>
): Promise<ServerResult<Method>> {
  state.busy++;
  if (!cancelling) state.error = '';
  try {
    const result = await backend.call(method, ...params);
    if (method === 'generate' || method === 'checkIo') state.dataVersion++;
    return result;
  } catch (error) {
    if (!cancelling) state.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    state.busy--;
  }
}

function ensureBackend(): void {
  if (connecting) return;
  connecting = true;
  backend.connect((status) => {
    state.status = status;
    if (status === 'open') {
      void refreshProject().catch((error) => {
        state.error = error instanceof Error ? error.message : String(error);
      });
    }
  });
}

backend.onProgress((progress) => {
  state.progress =
    progress.phase === 'done' || progress.phase === 'cancelled' || progress.phase === 'error'
      ? ''
      : `${progress.phase} ${progress.processed}/${progress.total}`;
});

/** 全局唯一的控制台状态；App 与各面板共享。 */
export function useConsole() {
  ensureBackend();
  return {
    state,
    rpcUrl,
    call,
    refresh: refreshProject,
    setText: (role: FileRole, text: string, name?: string) => backend.setText(role, text, name),
    clearFile: (role: FileRole) => backend.clearFile(role),
    files: (): Record<FileRole, FileSlot | undefined> => backend.files(),
    download: (kind: 'output' | 'unknown') => backend.download(kind),
    exportConfig: () => backend.exportConfig(),
    resetConfig: () => backend.resetConfig(),
    history: (): HistoryEntry[] => backend.history(),
    setHistoryLimit: (limit: number) => backend.setHistoryLimit(limit),
    compareCurrent: (mode: 'golden' | 'run'): Promise<CompareResult> => backend.compareCurrent(mode),
    cancel: () => {
      cancelling = true;
      state.cancelVersion++;
      backend.cancel();
      state.progress = '';
      state.error = '';
      window.setTimeout(() => {
        cancelling = false;
        state.error = '';
      }, 1000);
    },
  };
}
