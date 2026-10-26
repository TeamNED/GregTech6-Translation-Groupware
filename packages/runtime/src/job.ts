import type { CompiledProject, LangEntry } from '@gt6tg/core';
import { generateFromEntries } from '@gt6tg/core';
import type { Clock } from './clock';
import { roundMs } from './clock';
import type { HashProvider } from './hash';
import { hashOutput } from './hash';
import type { RunResult, RunSummary } from './run-summary';

export type JobScope = { kind: 'all' } | { kind: 'keys'; keys: readonly string[] };
export type JobProgressPhase = 'prepare' | 'run' | 'done';

export interface JobProgress {
  jobId: string;
  phase: JobProgressPhase;
  processed: number;
  total: number;
}

export interface JobRunInput {
  jobId: string;
  compileId: string;
  compiled: CompiledProject;
  sourceEntries: readonly LangEntry[];
  fallbackEntries?: readonly LangEntry[];
  scope?: JobScope;
  includeCandidates?: boolean;
  hash: HashProvider;
  clock: Clock;
  onProgress?: (progress: JobProgress) => void;
}

/**
 * 当前阶段的 JobRunner 仍调用 core 的同步生成函数；
 * 分块让出事件循环会在 Node/浏览器宿主接入后补齐。
 * 这里先把任务范围、进度、摘要和候选释放语义固定下来。
 */
export class JobRunner {
  async run(input: JobRunInput): Promise<RunResult> {
    const startedAt = input.clock.now();
    const scope = input.scope ?? { kind: 'all' };
    const entries = selectEntries(input.sourceEntries, scope);
    const total = entries.length;
    const requestedKeys = scope.kind === 'keys' ? scope.keys.length : input.sourceEntries.length;

    emit(input, 'prepare', 0, total);
    emit(input, 'run', 0, total);

    const generated = generateFromEntries(input.compiled, entries, [...(input.fallbackEntries ?? [])]);

    emit(input, 'run', total, total);

    let candidateBuckets = 0;
    let candidateItems = 0;
    for (const candidates of generated.candidatesByValue.values()) {
      candidateBuckets++;
      candidateItems += candidates.length;
    }

    const hash = await hashOutput(input.hash, generated.output);
    const summary: RunSummary = {
      jobId: input.jobId,
      compileId: input.compileId,
      scope: scope.kind,
      requestedKeys,
      sourceKeys: generated.stats.sourceKeys,
      processed: total,
      stats: generated.stats,
      timings: generated.timings,
      hash,
      candidateBuckets,
      candidateItems,
      durationMs: roundMs(input.clock.now() - startedAt),
    };

    emit(input, 'done', total, total);

    return {
      summary,
      output: generated.output,
      unknown: generated.unknown,
      candidatesByValue: input.includeCandidates ? generated.candidatesByValue : new Map(),
    };
  }
}

function selectEntries(sourceEntries: readonly LangEntry[], scope: JobScope): LangEntry[] {
  if (scope.kind === 'all') return [...sourceEntries];
  const keys = new Set(scope.keys);
  return sourceEntries.filter((entry) => keys.has(entry.key));
}

function emit(input: JobRunInput, phase: JobProgressPhase, processed: number, total: number): void {
  if (!input.onProgress) return;
  try {
    input.onProgress({ jobId: input.jobId, phase, processed, total });
  } catch {
    // 进度回调只做观测，不能影响生成结果。
  }
}
