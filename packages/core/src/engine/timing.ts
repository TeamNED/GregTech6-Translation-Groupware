/**
 * core 内部计时器。
 *
 * 只做观测，不参与任何匹配/生成逻辑；调用方可以忽略 `timings`，
 * 也可以把它透传到 server/web 或写入基准文件。
 */
import type { PhaseTiming, TimingReport } from '../types/timing';

function clock(): number {
  return globalThis.performance?.now() ?? Date.now();
}

export class Timer {
  private readonly startedAt = clock();
  private lastAt = this.startedAt;
  private readonly phases: PhaseTiming[] = [];

  constructor(private readonly label: string) {}

  /** 记录“从上次 mark/measure 结束到现在”的耗时。 */
  mark(name: string): number {
    const now = clock();
    const ms = now - this.lastAt;
    this.lastAt = now;
    this.phases.push({ name, ms });
    return ms;
  }

  /** 记录一次调用的耗时；即使抛错也会落一条 phase。 */
  measure<T>(name: string, fn: () => T): T {
    const start = clock();
    try {
      return fn();
    } finally {
      const now = clock();
      this.phases.push({ name, ms: now - start });
      this.lastAt = now;
    }
  }

  finish(): TimingReport {
    return {
      label: this.label,
      totalMs: clock() - this.startedAt,
      phases: this.phases.map((phase) => ({ ...phase })),
    };
  }
}

export function createTimer(label: string): Timer {
  return new Timer(label);
}
