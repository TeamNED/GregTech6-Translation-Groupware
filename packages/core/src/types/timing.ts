/** 计时报告类型；纯类型，不依赖引擎实现。 */

export interface PhaseTiming {
  name: string;
  ms: number;
}

export interface TimingReport {
  label: string;
  totalMs: number;
  phases: PhaseTiming[];
}
