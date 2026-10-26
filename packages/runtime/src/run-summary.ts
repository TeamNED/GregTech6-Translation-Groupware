import type { Candidate, GenerationStats, TimingReport } from '@gt6tg/core';

export type RunScopeKind = 'all' | 'keys';

/** 一次成功运行的摘要；完整产物留在宿主，不放进摘要。 */
export interface RunSummary {
  jobId: string;
  compileId: string;
  scope: RunScopeKind;
  requestedKeys: number;
  sourceKeys: number;
  processed: number;
  stats: GenerationStats;
  timings: TimingReport;
  hash: string;
  candidateBuckets: number;
  candidateItems: number;
  durationMs: number;
}

export interface RunResult {
  summary: RunSummary;
  output: Map<string, string>;
  unknown: Set<string>;
  /** 默认不保留；只有调试/测试 includeCandidates 时才填充。 */
  candidatesByValue: Map<string, Candidate[]>;
}
