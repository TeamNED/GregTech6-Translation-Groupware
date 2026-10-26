import { emitHook, type CoreHookEvents, type Hooks } from '@gt6tg/core';
import type { JobProgress } from './job';
import type { RunSummary } from './run-summary';

/** runtime 在 core 生命周期事件之外增加任务事件。 */
export interface RuntimeHookEvents extends CoreHookEvents {
  'job:started': {
    jobId: string;
    compileId: string;
    scope: 'all' | 'keys';
    total: number;
  };
  'job:progress': JobProgress;
  'job:finished': { jobId: string; summary: RunSummary };
  'job:failed': { jobId: string; message: string };
}

export type RuntimeHooks = Hooks<RuntimeHookEvents>;

export function emitRuntimeHook<K extends keyof RuntimeHookEvents>(
  hooks: RuntimeHooks | undefined,
  name: K,
  payload: RuntimeHookEvents[K],
): void {
  emitHook(hooks, name, payload);
}
