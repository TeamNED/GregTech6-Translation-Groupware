import type { ProjectSnapshot, ServerMethodName, ServerParams, ServerResult } from '@gt6tg/core';
import { reactive } from 'vue';
import { RpcClient, type ConnectionStatus } from '../rpc/client';

interface ConsoleState {
  project: ProjectSnapshot | null;
  status: ConnectionStatus;
  busy: number;
  error: string;
}

const state = reactive<ConsoleState>({
  project: null,
  status: 'closed',
  busy: 0,
  error: '',
});

const rpcUrl = import.meta.env.VITE_RPC_URL ?? 'ws://127.0.0.1:5175/__gt6tg_rpc';
let client: RpcClient | null = null;
let initializing = false;

async function refreshProject(): Promise<void> {
  const project = await call('getProject');
  state.project = project;
}

async function call<Method extends ServerMethodName>(
  method: Method,
  ...params: ServerParams<Method>
): Promise<ServerResult<Method>> {
  if (!client) throw new Error('RPC 客户端未初始化');
  state.busy++;
  state.error = '';
  try {
    return await client.call<ServerResult<Method>>(method, ...params);
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    state.busy--;
  }
}

function ensureClient(): void {
  if (client || initializing) return;
  initializing = true;
  client = new RpcClient(rpcUrl, (status) => {
    state.status = status;
    if (status === 'open') {
      void refreshProject().catch((error) => {
        state.error = error instanceof Error ? error.message : String(error);
      });
    }
  });
  client.connect();
}

/** 全局唯一的控制台状态；App 与各面板共享。 */
export function useConsole() {
  ensureClient();
  return {
    state,
    rpcUrl,
    call,
    refresh: refreshProject,
  };
}
