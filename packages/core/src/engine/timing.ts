/**
 * core 内部计时器。
 *
 * 只做观测，不参与任何匹配/生成逻辑；调用方可以忽略 `timings`，
 * 也可以把它透传到 server/web 或写入基准文件。
 */
import type { PhaseTiming, TimingReport } from '../types/timing';

export type { PhaseTiming, TimingReport } from '../types/timing';

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

/** 把毫秒数四舍五入到指定小数位，便于日志/JSON 展示。 */
export function roundMs(ms: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(ms * factor) / factor;
}

/** 把一份计时报告压成单行文本，例如 `generate 612.4ms (match 480.1, apply 90.2)`。 */
export function formatTiming(report: TimingReport): string {
  const phases = report.phases.map((phase) => `${phase.name} ${roundMs(phase.ms)}`).join(', ');
  return `${report.label} ${roundMs(report.totalMs)}ms${phases ? ` (${phases})` : ''}`;
}
