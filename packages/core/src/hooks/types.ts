import type { CompileStats } from '../engine/compile';
import type { ConfigIssue } from '../types/issues';
import type { TimingReport } from '../types/timing';

/** core 生命周期事件：只观测，不改变算法结果。 */
export interface CoreHookEvents {
  'config:parsed': { issues: ConfigIssue[] };
  'compile:started': { generatorBlocks: number; sourceKeys?: number };
  'compile:finished': { stats: CompileStats; timings: TimingReport; cached: boolean };
  'entry:tested': { key: string; targetId?: string; unknown: boolean };
}

export type Hooks<T extends object> = { [K in keyof T]?: (payload: T[K]) => void };
export type CoreHooks = Hooks<CoreHookEvents>;
